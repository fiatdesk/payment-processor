// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * @fileOverview Methods for ExternalWallets
 *
 * An account holds at most 5 active wallets with exactly one default, as
 * Stripe's external accounts do: the first wallet is the default, a later
 * one only when `default_for_currency: true` is passed, and the default
 * cannot be removed. The default does every job (checkout, top-ups, the
 * balance, payouts, subscription plans), so `GetDefaultWallet` is the one
 * place that picks it.
 *
 * Every change to an account's wallets runs in one transaction that first
 * writes the account's guard document, so two changes at once conflict and
 * the losing one is retried once: the 5-wallet count and the single default
 * hold under concurrency. Changing a platform's default refuses while a
 * payout batch of the old wallet is built or broadcast, and moves the
 * platform's plans on-chain (PlanDestination).
 *
 * @module ExternalWallet
 */

import type { ClientSession } from 'mongoose';
import { getAddress } from 'viem';
import { Database } from './Database';
import { EventService } from './EventService';
import { ExtractChangedFields } from './Event';
import { AccountModule } from './Account';
import { GetPlatformAccountId, IsPlatformAccount } from './PlatformAccess';
import { PayoutBatchInProgress, PayoutBatchStore } from './PayoutBatchStore';
import type { PlanDestinationModule } from './PlanDestination';
import { GenerateId } from '../utils/IdGenerator';
import { Now } from '../utils/Timestamp';
import { Logger } from '../utils/Logger';
import { ListHelper, ListOptions, ListResult } from '../utils/ListHelper';
import {
  Account as AccountType,
  ExternalWallet as ExternalWalletType,
  QueryOperators,
} from '@fiatdesk/shared-types';
import { ValidateUpdate } from './Util';
import { SanctionsScreeningModule } from './SanctionsScreening';
import { GetSettlement, IsSimulatedSettlement } from './chains/Settlement';
import { AppError } from '../utils/AppError';
import { ERRORS } from '../utils/Errors';
import {
  CreateExternalWalletSchema,
  CreateExternalWalletInput,
  UpdateExternalWalletSchema,
  UpdateExternalWalletInput,
} from '@fiatdesk/shared-schemas';

const COLLECTION = 'ExternalWallets';
/** One document per account; every wallet change writes it. */
const GUARDS = 'ExternalWalletGuards';
/** Plan destination changes a switch sends itself; the billing run sends the rest. */
const INLINE_PLAN_MIGRATIONS = 3;

/** Most active wallets an account can hold. */
export const MAX_ACTIVE_WALLETS = 5;
export const WALLET_LIMIT_MESSAGE = `An account can have at most ${MAX_ACTIVE_WALLETS} wallets. Remove one before adding another.`;
export const DELETE_DEFAULT_WALLET_MESSAGE =
  'Set another wallet as the default before removing this one.';

/** Response object for deleted external wallet */
export interface DeletedExternalWallet {
  id: string;
  object: 'wallet';
  deleted: boolean;
}

/** What a default switch wrote, for the work after its commit. */
interface DefaultMove {
  /** Wallets that stopped being flagged, with the value stored before */
  unflagged: Array<{ id: string; previous: boolean | null }>;
  /** The previous default, deleted by `archive_previous` */
  archived: string | null;
  /** Plan prices to sync (platform switches only) */
  plans: string[];
  platform: boolean;
}

/** The account's default among its active wallets, as `GetDefaultWallet` picks it. */
function DefaultOf(active: ExternalWalletType[]): ExternalWalletType | null {
  return (
    active.find((w) => w.default_for_currency === true) ?? active[0] ?? null
  );
}

/** A write conflict with a concurrent transaction: retrying can succeed. */
function IsTransientTransactionError(error: unknown): boolean {
  const failure = error as {
    code?: number;
    codeName?: string;
    errorLabels?: string[];
    hasErrorLabel?: (label: string) => boolean;
  } | null;
  return (
    failure?.code === 112 ||
    failure?.codeName === 'WriteConflict' ||
    !!failure?.errorLabels?.includes('TransientTransactionError') ||
    !!failure?.hasErrorLabel?.('TransientTransactionError')
  );
}

export class ExternalWalletModule {
  private readonly db: Database;
  private readonly eventService: EventService | null;
  private readonly listHelper: ListHelper<ExternalWalletType>;
  private readonly accountModule: AccountModule;
  private readonly planDestinations: PlanDestinationModule | null;
  private healEvents: EventService | null = null;

  /**
   * @param planDestinations - Moves a platform's plans when its default
   *   changes; without it a switch leaves them to the billing runner.
   */
  constructor(
    db: Database,
    eventService?: EventService,
    planDestinations?: PlanDestinationModule
  ) {
    this.db = db;
    this.eventService = eventService || null;
    this.planDestinations = planDestinations || null;
    this.accountModule = new AccountModule(db);
    this.listHelper = new ListHelper<ExternalWalletType>(db, {
      collection: COLLECTION,
      orderByField: 'created',
      orderDirection: 'desc',
      urlPath: '/v1/accounts/:account/external_accounts',
    });
  }

  /**
   * Creates a new external wallet with the provided fields.
   * Only wallet_address is required - other fields have sensible defaults.
   * The address is stored EIP-55 checksummed.
   *
   * Performs OFAC sanctions screening before saving the wallet. The first
   * wallet becomes the default; a later one only with
   * `default_for_currency: true`, which switches the default (and with
   * `archive_previous: true` also deletes the previous default). A sixth
   * active wallet is a 400.
   * Emits an 'external_account.created' event if EventService is configured.
   *
   * @param account - The account ID this wallet belongs to
   * @param input - Object containing wallet fields
   * @returns The created external wallet
   */
  async CreateExternalWallet(
    account: string,
    input: CreateExternalWalletInput
  ): Promise<ExternalWalletType> {
    const { archive_previous: archivePrevious, ...parsedInput } =
      ValidateUpdate(CreateExternalWalletSchema, input);
    const validatedInput = {
      ...parsedInput,
      wallet_address: getAddress(parsedInput.wallet_address),
    };

    // Screen wallet address against OFAC sanctions list
    const sanctionsModule = new SanctionsScreeningModule();
    const screeningResult = await sanctionsModule.CheckWalletAddress(
      validatedInput.wallet_address
    );

    if (screeningResult.isSanctioned) {
      throw new AppError(
        'This wallet address cannot be added due to compliance restrictions',
        403,
        'compliance_error'
      );
    }

    // Get the account to determine the platform
    const accountData = await this.RequireAccount(account);
    const platformAccountId = GetPlatformAccountId(accountData);
    const externalWallet = this.ExternalWalletObject(
      account,
      platformAccountId,
      validatedInput
    );

    const move = await this.InWalletTransaction(account, async (session) => {
      const active = await this.ActiveWallets(account, session);
      const current = DefaultOf(active);
      const replaced = archivePrevious && current ? 1 : 0;
      if (active.length - replaced >= MAX_ACTIVE_WALLETS) {
        throw new AppError(
          WALLET_LIMIT_MESSAGE,
          ERRORS.INVALID_REQUEST.status,
          ERRORS.INVALID_REQUEST.type
        );
      }
      const isDefault =
        active.length === 0 || validatedInput.default_for_currency === true;
      externalWallet.default_for_currency = isDefault;
      await this.db.Set(COLLECTION, externalWallet.id, externalWallet, session);
      if (!isDefault || active.length === 0) return null;
      return this.MoveDefault(
        accountData,
        externalWallet,
        active,
        !!archivePrevious,
        session
      );
    });

    // Emit external_account.created event (routed to platform via EventService)
    if (this.eventService) {
      await this.eventService.Emit(
        'external_account.created',
        account,
        externalWallet
      );
    }
    if (!move) return externalWallet;
    const queued = await this.AfterMove(accountData, externalWallet.id, move);
    return move.platform
      ? { ...externalWallet, plan_migrations_queued: queued }
      : externalWallet;
  }

  ExternalWalletObject(
    account: string,
    platformAccountId: string,
    input: CreateExternalWalletInput
  ): ExternalWalletType {
    const walletAddress = input.wallet_address;
    const externalWallet: ExternalWalletType = {
      id: GenerateId('wa'),
      object: 'wallet',
      account: account,
      platform_account: platformAccountId,
      account_holder_name: input.account_holder_name ?? null,
      account_holder_type: input.account_holder_type ?? null,
      available_payout_methods: ['standard', 'instant'],
      created: Now(),
      country: '',
      currency: input.currency ?? 'usdc',
      customer: null,
      default_for_currency: input.default_for_currency ?? null,
      fingerprint: null,
      future_requirements: null,
      last4: walletAddress.slice(-4),
      metadata: input.metadata ?? null,
      network: input.network ?? GetSettlement().Describe().network,
      requirements: null,
      status: 'new',
      wallet_address: walletAddress,
    };
    return externalWallet;
  }

  /**
   * Updates an external wallet with the provided fields.
   * Only updatable fields will be accepted. `default_for_currency: true`
   * makes the wallet the default (the switch), in the same transaction as
   * the other fields; `false` changes nothing, as a default only moves when
   * another wallet becomes the default.
   * Emits one 'external_account.updated' event per wallet it changed.
   *
   * @param walletId - The ID of the wallet to update
   * @param input - Object containing the fields to update
   * @returns The updated external wallet
   */
  async UpdateExternalWallet(
    walletId: string,
    input: UpdateExternalWalletInput
  ): Promise<ExternalWalletType> {
    const {
      default_for_currency: makeDefault,
      archive_previous: archivePrevious,
      ...validatedUpdate
    } = ValidateUpdate(UpdateExternalWalletSchema, input);
    const fields = validatedUpdate as Partial<ExternalWalletType>;
    const hasFields = Object.keys(fields).length > 0;

    // Get previous state for the event (before update)
    const previousWallet = await this.GetExternalWallet(walletId);
    if (!previousWallet) throw WalletNotFound();

    let move: DefaultMove | null = null;
    let account: AccountType | null = null;
    if (makeDefault === true && previousWallet.default_for_currency !== true) {
      if (previousWallet.status === 'archived' || !previousWallet.account) {
        throw WalletNotFound();
      }
      const owner = await this.RequireAccount(previousWallet.account);
      account = owner;
      move = await this.InWalletTransaction(owner.id, async (session) => {
        const active = await this.ActiveWallets(owner.id, session);
        const target = active.find((wallet) => wallet.id === walletId);
        if (!target) throw WalletNotFound();
        const moved = await this.MoveDefault(
          owner,
          target,
          active,
          !!archivePrevious,
          session
        );
        if (hasFields) {
          await this.db.Update<ExternalWalletType>(
            COLLECTION,
            walletId,
            fields,
            session
          );
        }
        return moved;
      });
    } else if (hasFields) {
      await this.db.Update<ExternalWalletType>(COLLECTION, walletId, fields);
    }

    const wallet = await this.GetExternalWallet(walletId);
    if (!wallet) throw WalletNotFound();

    // One event for this wallet: its default change and its other fields.
    if (this.eventService && (move || hasFields)) {
      const previousAttributes = {
        ...(move
          ? { default_for_currency: previousWallet.default_for_currency }
          : {}),
        ...ExtractChangedFields(
          previousWallet as unknown as Record<string, unknown>,
          fields as Record<string, unknown>
        ),
      };
      await this.eventService.Emit(
        'external_account.updated',
        wallet.account ?? '',
        wallet,
        { previousAttributes }
      );
    }

    if (!move || !account) return wallet;
    const queued = await this.AfterMove(account, walletId, move);
    return move.platform
      ? { ...wallet, plan_migrations_queued: queued }
      : wallet;
  }

  async GetExternalWallet(
    walletId: string
  ): Promise<ExternalWalletType | null> {
    return this.db.Get<ExternalWalletType>(COLLECTION, walletId);
  }

  /**
   * Get all external wallets for an account (without pagination).
   * Excludes archived wallets by default.
   *
   * @param account - The account ID to get wallets for
   * @param includeArchived - Whether to include archived wallets (default: false)
   * @returns Array of external wallets
   */
  async GetExternalWalletsByAccount(
    account: string,
    includeArchived = false
  ): Promise<ExternalWalletType[]> {
    if (includeArchived) {
      const externalWallets = await this.db.Find<ExternalWalletType>(
        COLLECTION,
        'account',
        account
      );
      return externalWallets || [];
    }

    const externalWallets = await this.db.Find2Custom<ExternalWalletType>(
      COLLECTION,
      'account',
      '==',
      account,
      'status',
      '!=',
      'archived'
    );
    return externalWallets || [];
  }

  /**
   * The account's default wallet: the active wallet flagged
   * `default_for_currency`. An archived wallet never counts, flag or not.
   * An account with no active wallet flagged (left by an older switch that
   * archived the flagged one, or by wallets created before the flag was
   * kept) gets its first active wallet in storage order flagged, the wallet
   * the old fallback picked, so nothing it pays changes. Archived wallets
   * still flagged are unflagged at the same time, and each change emits
   * `external_account.updated`. Old data repairs itself on first read.
   *
   * @param account - The account ID to get the default wallet for
   * @returns The default external wallet, or null if none is configured
   */
  async GetDefaultWallet(account: string): Promise<ExternalWalletType | null> {
    const wallets = await this.GetExternalWalletsByAccount(account);
    const flagged = wallets.find((w) => w.default_for_currency === true);
    if (flagged) return flagged;
    if (wallets.length === 0) return null;
    return this.HealDefault(account);
  }

  /**
   * List external wallets for an account with cursor-based pagination.
   * With `includeUsdcBalance`, each wallet carries its on-chain USDC
   * (`usdc_balance`; null on the simulated rail or when the chain cannot be
   * read). An account without a flagged default is repaired first.
   *
   * @param account - The account ID to list wallets for
   * @param options - Pagination options
   * @returns Paginated list of external wallets
   */
  async ListExternalWallets(
    account: string,
    options: Omit<ListOptions, 'account' | 'filters'> & {
      created?: ListOptions['created'];
      includeUsdcBalance?: boolean;
    } = {}
  ): Promise<ListResult<ExternalWalletType>> {
    const {
      limit = 10,
      startingAfter,
      endingBefore,
      created,
      includeUsdcBalance,
    } = options;

    await this.GetDefaultWallet(account);
    const result = await this.listHelper.List({
      account,
      limit,
      startingAfter,
      endingBefore,
      created,
      filters: {
        status: { operator: QueryOperators['!='], value: 'archived' },
      },
    });

    // Update the URL to include the account ID
    return {
      ...result,
      data: includeUsdcBalance
        ? await this.WithUsdcBalances(result.data)
        : result.data,
      url: `/v1/accounts/${account}/external_accounts`,
    };
  }

  /**
   * Archives an external wallet by ID (soft-delete).
   * The wallet record is preserved for audit trails and payout history,
   * but excluded from active wallet queries. The default wallet cannot be
   * removed (400); set another wallet as the default first.
   * Emits an 'external_account.deleted' event if EventService is configured.
   *
   * @param walletId - The ID of the wallet to archive
   * @returns Object indicating whether the deletion was successful (Stripe format)
   */
  async DeleteExternalWallet(walletId: string): Promise<DeletedExternalWallet> {
    const wallet = await this.GetExternalWallet(walletId);

    if (!wallet) throw WalletNotFound();

    const archive = async (session?: ClientSession) =>
      this.db.Update<ExternalWalletType>(
        COLLECTION,
        walletId,
        { status: 'archived', archived_at: wallet.archived_at ?? Now() },
        session
      );
    if (wallet.status !== 'archived' && wallet.account) {
      await this.InWalletTransaction(wallet.account, async (session) => {
        const active = await this.ActiveWallets(
          wallet.account as string,
          session
        );
        if (DefaultOf(active)?.id === walletId) {
          throw new AppError(
            DELETE_DEFAULT_WALLET_MESSAGE,
            ERRORS.INVALID_REQUEST.status,
            ERRORS.INVALID_REQUEST.type
          );
        }
        await archive(session);
      });
    } else {
      await archive();
    }

    if (this.eventService) {
      await this.eventService.Emit(
        'external_account.deleted',
        wallet.account ?? '',
        wallet
      );
    }

    return {
      id: walletId,
      object: 'wallet',
      deleted: true,
    };
  }

  /**
   * The default switch (Q13 #4), inside the wallet transaction: refuses
   * while a payout batch of the old platform wallet is built or broadcast
   * (409 `payout_batch_in_progress`); flags the target and unflags every
   * other active wallet with one filtered update; with `archivePrevious`,
   * deletes the previous default; records the platform's plan destination
   * changes. Connected accounts only move the flag (their changes apply to
   * future payouts).
   */
  private async MoveDefault(
    account: AccountType,
    target: ExternalWalletType,
    active: ExternalWalletType[],
    archivePrevious: boolean,
    session: ClientSession
  ): Promise<DefaultMove> {
    const platform = IsPlatformAccount(account);
    const current = DefaultOf(active);
    if (platform && current && current.id !== target.id) {
      await this.AssertNoPayoutBatch(account.id, current.wallet_address);
    }
    await this.db.Update<ExternalWalletType>(
      COLLECTION,
      target.id,
      { default_for_currency: true },
      session
    );
    await this.db.UpdateMany(
      COLLECTION,
      {
        account: account.id,
        id: { $ne: target.id },
        status: { $ne: 'archived' },
        default_for_currency: { $ne: false },
      },
      { default_for_currency: false },
      session
    );
    const archived =
      archivePrevious && current && current.id !== target.id
        ? current.id
        : null;
    if (archived) {
      await this.db.Update<ExternalWalletType>(
        COLLECTION,
        archived,
        { status: 'archived', archived_at: Now(), default_for_currency: false },
        session
      );
    }
    const plans =
      platform && this.planDestinations
        ? await this.planDestinations.Enqueue(
            account.id,
            target.wallet_address,
            session
          )
        : [];
    return {
      unflagged: active
        .filter(
          (wallet) =>
            wallet.id !== target.id &&
            wallet.id !== archived &&
            wallet.default_for_currency !== false
        )
        .map((wallet) => ({
          id: wallet.id,
          previous: wallet.default_for_currency,
        })),
      archived,
      plans,
      platform,
    };
  }

  /**
   * After a switch commits: sends up to 3 plan destination changes (the
   * billing run sends the rest) and emits one event per other wallet it
   * changed. Returns how many plan changes are left queued.
   */
  private async AfterMove(
    account: AccountType,
    targetId: string,
    move: DefaultMove
  ): Promise<number> {
    Logger.info('Switched the default wallet', {
      account: account.id,
      walletId: targetId,
      archivedWalletId: move.archived,
      plans: move.plans.length,
    });
    const queued = this.planDestinations
      ? await this.planDestinations.SyncAll(move.plans, {
          maxSends: INLINE_PLAN_MIGRATIONS,
        })
      : 0;
    if (this.eventService) {
      for (const { id, previous } of move.unflagged) {
        await this.EmitUpdated(this.eventService, id, previous);
      }
      if (move.archived) {
        const archived = await this.GetExternalWallet(move.archived);
        if (archived) {
          await this.eventService.Emit(
            'external_account.deleted',
            archived.account ?? '',
            archived
          );
        }
      }
    }
    return queued;
  }

  /** Flags the first active wallet of an account that has no default. */
  private async HealDefault(
    account: string
  ): Promise<ExternalWalletType | null> {
    const healed = await this.InWalletTransaction(account, async (session) => {
      const all =
        (await this.db.Find<ExternalWalletType>(
          COLLECTION,
          'account',
          account,
          session
        )) ?? [];
      const active = all.filter((wallet) => wallet.status !== 'archived');
      const flagged = active.find((w) => w.default_for_currency === true);
      if (flagged || !active[0])
        return { wallet: flagged ?? null, changed: [] };
      const pick = active[0];
      const stale = all.filter(
        (wallet) =>
          wallet.status === 'archived' && wallet.default_for_currency === true
      );
      await this.db.Update<ExternalWalletType>(
        COLLECTION,
        pick.id,
        { default_for_currency: true },
        session
      );
      for (const wallet of stale) {
        await this.db.Update<ExternalWalletType>(
          COLLECTION,
          wallet.id,
          { default_for_currency: false },
          session
        );
      }
      return {
        wallet: { ...pick, default_for_currency: true },
        changed: [
          { id: pick.id, previous: pick.default_for_currency },
          ...stale.map((wallet) => ({ id: wallet.id, previous: true })),
        ],
      };
    });
    if (healed.changed.length > 0) {
      Logger.warn('No active wallet was the default; flagged the first one', {
        account,
        walletId: healed.wallet?.id,
      });
      try {
        const events = this.eventService ?? this.HealEvents();
        for (const { id, previous } of healed.changed) {
          await this.EmitUpdated(events, id, previous);
        }
      } catch (error) {
        // The repair is stored; its events must not fail the read.
        Logger.error('Could not emit the default wallet repair', error, {
          account,
        });
      }
    }
    return healed.wallet;
  }

  private HealEvents(): EventService {
    this.healEvents ??= new EventService(this.db);
    return this.healEvents;
  }

  private async EmitUpdated(
    events: EventService,
    walletId: string,
    previous: boolean | null
  ): Promise<void> {
    const wallet = await this.GetExternalWallet(walletId);
    if (!wallet) return;
    await events.Emit(
      'external_account.updated',
      wallet.account ?? '',
      wallet,
      {
        previousAttributes: { default_for_currency: previous },
      }
    );
  }

  /**
   * Runs one change of the account's wallets in a transaction that first
   * writes the account's guard document: two changes at once conflict, and
   * the losing one is retried once.
   */
  private async InWalletTransaction<T>(
    account: string,
    work: (session: ClientSession) => Promise<T>
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.db.RunTransaction(async (session: ClientSession) => {
          await this.db.Set(
            GUARDS,
            account,
            { id: account, updated: Now() },
            session
          );
          return work(session);
        });
      } catch (error) {
        if (attempt > 1 || !IsTransientTransactionError(error)) throw error;
        Logger.warn('A wallet change met a concurrent one; retrying', {
          account,
        });
      }
    }
  }

  private async ActiveWallets(
    account: string,
    session: ClientSession
  ): Promise<ExternalWalletType[]> {
    const wallets =
      (await this.db.Find<ExternalWalletType>(
        COLLECTION,
        'account',
        account,
        session
      )) ?? [];
    return wallets.filter((wallet) => wallet.status !== 'archived');
  }

  /** Each wallet's on-chain USDC; null when it cannot be read. */
  private async WithUsdcBalances(
    wallets: ExternalWalletType[]
  ): Promise<ExternalWalletType[]> {
    if (IsSimulatedSettlement()) {
      return wallets.map((wallet) => ({ ...wallet, usdc_balance: null }));
    }
    const settlement = GetSettlement();
    return Promise.all(
      wallets.map(async (wallet) => {
        try {
          return {
            ...wallet,
            usdc_balance: await settlement.GetUSDCBalance(
              wallet.wallet_address
            ),
          };
        } catch (error) {
          Logger.warn('Could not read a wallet USDC balance', {
            walletId: wallet.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return { ...wallet, usdc_balance: null };
        }
      })
    );
  }

  /** The old wallet signs its own outstanding batch; a switch waits for it. */
  private async AssertNoPayoutBatch(
    platformAccountId: string,
    walletAddress: string
  ): Promise<void> {
    const batch = await new PayoutBatchStore(this.db).FindOutstanding(
      platformAccountId,
      GetSettlement().Describe().chain_id,
      walletAddress
    );
    if (batch) {
      throw PayoutBatchInProgress(
        `Wallet ${walletAddress} has a payout batch awaiting broadcast or confirmation. Finish or replace it before changing the default wallet.`
      );
    }
  }

  private async RequireAccount(accountId: string): Promise<AccountType> {
    const account = await this.accountModule.GetAccount(accountId);
    if (!account) {
      throw new AppError(
        ERRORS.ACCOUNT_NOT_FOUND.message,
        ERRORS.ACCOUNT_NOT_FOUND.status,
        ERRORS.ACCOUNT_NOT_FOUND.type
      );
    }
    return account;
  }
}

function WalletNotFound(): AppError {
  return new AppError(
    ERRORS.EXTERNAL_WALLET_NOT_FOUND.message,
    ERRORS.EXTERNAL_WALLET_NOT_FOUND.status,
    ERRORS.EXTERNAL_WALLET_NOT_FOUND.type
  );
}
