// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * @fileOverview Methods for ExternalWallets
 *
 * An account holds at most 5 active wallets with exactly one default, as
 * Stripe's external accounts do: the first wallet is the default, a later
 * one only when `default_for_currency: true` is passed, and the default
 * cannot be removed. The default does every job (checkout, top-ups, the
 * balance, payouts, subscription plans), so `GetDefaultWallet` is the one
 * place that picks it. Changing a platform's default refuses while a payout
 * batch of the old wallet is built or broadcast, moves the flag in one
 * transaction, and moves the platform's plans on-chain (PlanDestination).
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
import { GetSettlement } from './chains/Settlement';
import { AppError } from '../utils/AppError';
import { ERRORS } from '../utils/Errors';
import {
  CreateExternalWalletSchema,
  CreateExternalWalletInput,
  UpdateExternalWalletSchema,
  UpdateExternalWalletInput,
} from '@fiatdesk/shared-schemas';

const COLLECTION = 'ExternalWallets';

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

/** Newest first; the id breaks ties so the order never depends on storage. */
function NewestFirst(wallets: ExternalWalletType[]): ExternalWalletType[] {
  return [...wallets].sort(
    (a, b) => (b.created ?? 0) - (a.created ?? 0) || b.id.localeCompare(a.id)
  );
}

export class ExternalWalletModule {
  private readonly db: Database;
  private readonly eventService: EventService | null;
  private readonly listHelper: ListHelper<ExternalWalletType>;
  private readonly accountModule: AccountModule;
  private readonly planDestinations: PlanDestinationModule | null;

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
   * `default_for_currency: true`, which switches the default. A sixth
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
    const parsedInput = ValidateUpdate(CreateExternalWalletSchema, input);
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

    const active = await this.GetExternalWalletsByAccount(account);
    if (active.length >= MAX_ACTIVE_WALLETS) {
      throw new AppError(
        WALLET_LIMIT_MESSAGE,
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }
    const isDefault =
      active.length === 0 || validatedInput.default_for_currency === true;

    const externalWallet = this.ExternalWalletObject(
      account,
      platformAccountId,
      { ...validatedInput, default_for_currency: isDefault }
    );
    if (isDefault && active.length > 0) {
      await this.SwitchDefault(accountData, externalWallet, active, true);
    } else {
      await this.db.Set(COLLECTION, externalWallet.id, externalWallet);
    }

    // Emit external_account.created event (routed to platform via EventService)
    if (this.eventService) {
      await this.eventService.Emit(
        'external_account.created',
        account,
        externalWallet
      );
    }

    return externalWallet;
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
   * makes the wallet the default (the switch); `false` changes nothing, as
   * a default only moves when another wallet becomes the default.
   * Emits an 'external_account.updated' event if EventService is configured.
   *
   * @param walletId - The ID of the wallet to update
   * @param input - Object containing the fields to update
   * @returns The updated external wallet
   */
  async UpdateExternalWallet(
    walletId: string,
    input: UpdateExternalWalletInput
  ): Promise<ExternalWalletType> {
    const { default_for_currency: makeDefault, ...validatedUpdate } =
      ValidateUpdate(UpdateExternalWalletSchema, input);

    // Get previous state for the event (before update)
    const previousWallet = await this.GetExternalWallet(walletId);
    if (!previousWallet) throw WalletNotFound();

    if (makeDefault === true) {
      await this.SetDefaultWallet(previousWallet);
    }

    if (Object.keys(validatedUpdate).length > 0) {
      await this.db.Update<ExternalWalletType>(
        COLLECTION,
        walletId,
        validatedUpdate as Partial<ExternalWalletType>
      );
    } else if (makeDefault === true) {
      return (await this.GetExternalWallet(walletId)) ?? previousWallet;
    }

    const wallet = await this.GetExternalWallet(walletId);
    if (!wallet) throw WalletNotFound();

    // Emit external_account.updated event (routed to platform via EventService)
    if (this.eventService) {
      const previousAttributes = ExtractChangedFields(
        previousWallet as unknown as Record<string, unknown>,
        validatedUpdate as Record<string, unknown>
      );

      await this.eventService.Emit(
        'external_account.updated',
        wallet.account ?? '',
        wallet,
        { previousAttributes }
      );
    }

    return wallet;
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
   * archived the flagged one) gets its newest active wallet flagged here, so
   * old data repairs itself on first read.
   *
   * @param account - The account ID to get the default wallet for
   * @returns The default external wallet, or null if none is configured
   */
  async GetDefaultWallet(account: string): Promise<ExternalWalletType | null> {
    const wallets = NewestFirst(
      await this.GetExternalWalletsByAccount(account)
    );
    const flagged = wallets.find((w) => w.default_for_currency === true);
    if (flagged) return flagged;
    const newest = wallets[0];
    if (!newest) return null;
    await this.db.Update<ExternalWalletType>(COLLECTION, newest.id, {
      default_for_currency: true,
    });
    Logger.warn('No active wallet was the default; flagged the newest one', {
      account,
      walletId: newest.id,
    });
    return { ...newest, default_for_currency: true };
  }

  /**
   * List external wallets for an account with cursor-based pagination.
   *
   * @param account - The account ID to list wallets for
   * @param options - Pagination options
   * @returns Paginated list of external wallets
   */
  async ListExternalWallets(
    account: string,
    options: Omit<ListOptions, 'account' | 'filters'> & {
      created?: ListOptions['created'];
    } = {}
  ): Promise<ListResult<ExternalWalletType>> {
    const { limit = 10, startingAfter, endingBefore, created } = options;

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

    if (wallet.status !== 'archived' && wallet.account) {
      const current = await this.GetDefaultWallet(wallet.account);
      if (current?.id === walletId) {
        throw new AppError(
          DELETE_DEFAULT_WALLET_MESSAGE,
          ERRORS.INVALID_REQUEST.status,
          ERRORS.INVALID_REQUEST.type
        );
      }
    }

    await this.db.Update<ExternalWalletType>(COLLECTION, walletId, {
      status: 'archived',
      archived_at: wallet.archived_at ?? Now(),
    });

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

  /** Makes an existing active wallet the account's default. */
  private async SetDefaultWallet(wallet: ExternalWalletType): Promise<void> {
    if (wallet.status === 'archived' || !wallet.account) {
      throw WalletNotFound();
    }
    const account = await this.RequireAccount(wallet.account);
    const active = await this.GetExternalWalletsByAccount(wallet.account);
    const current = await this.GetDefaultWallet(wallet.account);
    if (current?.id === wallet.id) return;
    await this.SwitchDefault(account, wallet, active, false);
  }

  /**
   * The default switch (Q13 #4): refuses while a payout batch of the old
   * platform wallet is built or broadcast (409 `payout_batch_in_progress`);
   * then, in one transaction, saves (or flags) the new default, unflags the
   * others and records the platform's plan destination changes; after the
   * commit, sends those changes without waiting for confirmations.
   * Connected accounts only move the flag (their changes apply to future
   * payouts).
   */
  private async SwitchDefault(
    account: AccountType,
    target: ExternalWalletType,
    active: ExternalWalletType[],
    create: boolean
  ): Promise<void> {
    const platform = IsPlatformAccount(account);
    const previous = await this.GetDefaultWallet(account.id);
    if (platform && previous) {
      await this.AssertNoPayoutBatch(account.id, previous.wallet_address);
    }
    const demoted = active.filter(
      (wallet) =>
        wallet.id !== target.id && wallet.default_for_currency !== false
    );

    const planPrices = await this.db.RunTransaction(
      async (session: ClientSession) => {
        if (create) {
          await this.db.Set(
            COLLECTION,
            target.id,
            { ...target, default_for_currency: true },
            session
          );
        } else {
          await this.db.Update<ExternalWalletType>(
            COLLECTION,
            target.id,
            { default_for_currency: true },
            session
          );
        }
        for (const wallet of demoted) {
          await this.db.Update<ExternalWalletType>(
            COLLECTION,
            wallet.id,
            { default_for_currency: false },
            session
          );
        }
        return platform && this.planDestinations
          ? this.planDestinations.Enqueue(
              account.id,
              target.wallet_address,
              session
            )
          : [];
      }
    );

    Logger.info('Switched the default wallet', {
      account: account.id,
      walletId: target.id,
      previousWalletId: previous?.id ?? null,
      plans: planPrices.length,
    });
    await this.planDestinations?.SyncAll(planPrices);

    if (!this.eventService) return;
    if (!create) {
      await this.EmitDefaultChanged(target.id, false);
    }
    for (const wallet of demoted) {
      if (wallet.default_for_currency === true) {
        await this.EmitDefaultChanged(wallet.id, true);
      }
    }
  }

  private async EmitDefaultChanged(
    walletId: string,
    wasDefault: boolean
  ): Promise<void> {
    const wallet = await this.GetExternalWallet(walletId);
    if (!wallet || !this.eventService) return;
    await this.eventService.Emit(
      'external_account.updated',
      wallet.account ?? '',
      wallet,
      { previousAttributes: { default_for_currency: wasDefault } }
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
