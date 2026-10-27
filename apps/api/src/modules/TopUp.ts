/**
 * @fileOverview Methods for TopUps
 *
 * TopUps represent incoming USDC deposits to a platform wallet.
 * When an incoming deposit is detected, a TopUp is created along with
 * a BalanceTransaction, and the platform's balance is increased.
 *
 * A deposit is one USDC `Transfer` log, identified by its transaction hash
 * and log index (`metadata.blockchain_tx`, `metadata.log_index`). A unique
 * index on that pair (see Database.GetModel) lets each log credit once.
 *
 *
 * @module TopUp
 */

import { ClientSession } from 'mongoose';
import { Database } from './Database';
import { EventService } from './EventService';
import { BalanceTransactionModule } from './BalanceTransaction';
import { BalanceModule } from './Balance';
import { GetAppConfig } from './AppConfig';
import { GenerateId } from '../utils/IdGenerator';
import { Now } from '../utils/Timestamp';
import { AppError } from '../utils/AppError';
import { ERRORS } from '../utils/Errors';
import {
  TopUp as TopUpType,
  TopUpStatus,
  TopUpSource,
  QueryOperators,
} from '@zoneless/shared-types';
import { ListHelper, ListOptions, ListResult } from '../utils/ListHelper';
import { GetSettlement, SIMULATED_TEST_WALLET } from './chains/Settlement';
import type { IncomingDeposit } from './chains/types';
import { CreateTopUpInput, UpdateTopUpInput } from '@zoneless/shared-schemas';

/** Metadata keys that identify the Transfer log a top-up credits. */
const DEPOSIT_KEY_FIELDS = ['blockchain_tx', 'log_index'];

/** One USDC Transfer log: its transaction hash and log index. */
export function DepositKey(
  transactionHash: string,
  logIndex: number | string
): string {
  return `${transactionHash}:${logIndex}`;
}

export class TopUpModule {
  private readonly db: Database;
  private readonly eventService: EventService | null;
  private readonly listHelper: ListHelper<TopUpType>;

  constructor(db: Database, eventService?: EventService) {
    this.db = db;
    this.eventService = eventService || null;
    this.listHelper = new ListHelper<TopUpType>(db, {
      collection: 'TopUps',
      orderByField: 'created',
      orderDirection: 'desc',
      urlPath: '/v1/topups',
    });
  }

  /**
   * Creates a TopUp via the API.
   * This is the standard API endpoint for platforms to create top-ups.
   * Emits a 'topup.created' event.
   *
   * @param input - The top-up creation input
   * @param platformAccountId - The platform account creating this top-up
   * @returns The created TopUp object
   */
  async Create(
    input: CreateTopUpInput,
    platformAccountId: string
  ): Promise<TopUpType> {
    AssertNoDepositKeys(input.metadata);
    const topUp = this.TopUpObject(
      input.amount,
      input.currency,
      platformAccountId,
      {
        description: input.description,
        statementDescriptor: input.statement_descriptor,
        transferGroup: input.transfer_group,
        metadata: input.metadata || {},
      }
    );

    await this.db.Set('TopUps', topUp.id, topUp);

    // Emit topup.created event
    if (this.eventService) {
      await this.eventService.Emit('topup.created', platformAccountId, topUp);
    }

    return topUp;
  }

  /**
   * Creates a TopUp from an incoming blockchain deposit.
   * This is called by the TopUpMonitor when a deposit is detected.
   * Emits 'topup.created' and 'topup.succeeded' events.
   * Rejects with a duplicate-key error (code 11000) when a top-up already
   * credits the same Transfer log; nothing is credited then.
   *
   * @param deposit - The incoming deposit detected on-chain
   * @param platformAccountId - The platform account to credit
   * @returns The created TopUp object
   */
  async CreateFromDeposit(
    deposit: IncomingDeposit,
    platformAccountId: string
  ): Promise<TopUpType> {
    return this.db
      .RunTransaction(async (session: ClientSession) => {
        const balanceTransactionModule = new BalanceTransactionModule(this.db);
        const balanceModule = new BalanceModule(this.db);

        const settlement = GetSettlement();
        const metadata: Record<string, string> = {
          blockchain_tx: deposit.transactionHash,
          log_index: String(deposit.logIndex),
          network: settlement.Describe().network,
          sender_address: deposit.senderAddress,
          explorer_url: settlement.ExplorerUrl('tx', deposit.transactionHash),
        };

        const topUp = this.TopUpObject(
          deposit.amountCents,
          'usdc',
          platformAccountId,
          {
            description: `Deposit from ${deposit.senderAddress.slice(0, 8)}...`,
            metadata,
          }
        );

        // Mark as succeeded immediately since we detected a confirmed transaction
        const timestamp = Now();
        topUp.status = 'succeeded';
        topUp.arrival_date = timestamp;

        const balanceTransaction =
          balanceTransactionModule.BalanceTransactionObject({
            amount: deposit.amountCents,
            currency: 'usdc',
            account: platformAccountId,
            platformAccountId: platformAccountId,
            type: 'topup',
            source: topUp.id,
            description: `Top Up from ${deposit.senderAddress.slice(0, 8)}...`,
            metadata: {},
            status: 'available',
            available_on: timestamp,
          });

        topUp.balance_transaction = balanceTransaction.id;

        const balanceData = await balanceModule.GetBalance(
          platformAccountId,
          session
        );
        if (!balanceData) {
          throw new Error(`Balance not found for platform account`);
        }

        await this.db.Set('TopUps', topUp.id, topUp, session);
        await this.db.Set(
          'BalanceTransactions',
          balanceTransaction.id,
          balanceTransaction,
          session
        );

        const updatedBalance = balanceModule.UpdateBalance(
          balanceData,
          deposit.amountCents,
          'usdc',
          'available'
        );
        await this.db.Update(
          'Balances',
          updatedBalance.id,
          { available: updatedBalance.available },
          session
        );

        return topUp;
      })
      .then(async (topUp) => {
        // Emit events after transaction commits
        if (this.eventService) {
          await this.eventService.Emit(
            'topup.created',
            platformAccountId,
            topUp
          );
          await this.eventService.Emit(
            'topup.succeeded',
            platformAccountId,
            topUp
          );
        }
        return topUp;
      });
  }

  /**
   * Credit the platform ledger with fake USDC in simulated test mode.
   */
  async CreateSimulatedDeposit(
    amountCents: number,
    platformAccountId: string
  ): Promise<TopUpType> {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new AppError(
        'Amount must be a positive integer number of cents',
        ERRORS.VALIDATION_ERROR.status,
        ERRORS.VALIDATION_ERROR.type
      );
    }

    return this.CreateFromDeposit(
      {
        transactionHash: GenerateId('sim_dep'),
        logIndex: 0,
        amount: amountCents / 100,
        amountCents,
        senderAddress: SIMULATED_TEST_WALLET,
        timestamp: Now(),
        blockNumber: 0,
      },
      platformAccountId
    );
  }

  /**
   * Cancel a pending top-up.
   * Only pending top-ups can be canceled.
   * Emits a 'topup.canceled' event.
   *
   * @param topUpId - The TopUp ID to cancel
   * @returns The canceled TopUp object
   */
  async Cancel(topUpId: string): Promise<TopUpType> {
    const topUp = await this.GetTopUp(topUpId);
    if (!topUp) {
      throw new AppError(
        ERRORS.TOPUP_NOT_FOUND.message,
        ERRORS.TOPUP_NOT_FOUND.status,
        ERRORS.TOPUP_NOT_FOUND.type
      );
    }

    if (topUp.status !== 'pending') {
      throw new AppError(
        'Only pending top-ups can be canceled',
        400,
        'invalid_request_error'
      );
    }

    const update: Partial<TopUpType> = {
      status: 'canceled' as TopUpStatus,
    };

    await this.db.Update<TopUpType>('TopUps', topUpId, update);

    const updatedTopUp = await this.GetTopUp(topUpId);
    if (!updatedTopUp) {
      throw new AppError(
        ERRORS.TOPUP_NOT_FOUND.message,
        ERRORS.TOPUP_NOT_FOUND.status,
        ERRORS.TOPUP_NOT_FOUND.type
      );
    }

    // Emit topup.canceled event
    if (this.eventService) {
      await this.eventService.Emit(
        'topup.canceled',
        updatedTopUp.account,
        updatedTopUp
      );
    }

    return updatedTopUp;
  }

  /**
   * Mark a top-up as failed.
   * Used internally when a deposit fails to process.
   * Emits a 'topup.failed' event.
   *
   * @param topUpId - The TopUp ID to mark as failed
   * @param failureCode - Error code explaining the failure
   * @param failureMessage - Human-readable failure message
   * @returns The failed TopUp object
   */
  async MarkFailed(
    topUpId: string,
    failureCode: string,
    failureMessage: string
  ): Promise<TopUpType> {
    const topUp = await this.GetTopUp(topUpId);
    if (!topUp) {
      throw new AppError(
        ERRORS.TOPUP_NOT_FOUND.message,
        ERRORS.TOPUP_NOT_FOUND.status,
        ERRORS.TOPUP_NOT_FOUND.type
      );
    }

    const update: Partial<TopUpType> = {
      status: 'failed' as TopUpStatus,
      failure_code: failureCode,
      failure_message: failureMessage,
    };

    await this.db.Update<TopUpType>('TopUps', topUpId, update);

    const updatedTopUp = await this.GetTopUp(topUpId);
    if (!updatedTopUp) {
      throw new AppError(
        ERRORS.TOPUP_NOT_FOUND.message,
        ERRORS.TOPUP_NOT_FOUND.status,
        ERRORS.TOPUP_NOT_FOUND.type
      );
    }

    // Emit topup.failed event
    if (this.eventService) {
      await this.eventService.Emit(
        'topup.failed',
        updatedTopUp.account,
        updatedTopUp
      );
    }

    return updatedTopUp;
  }

  /**
   * Whether a top-up already credits this Transfer log, on any platform (the
   * unique index on the same key is global too).
   *
   * @param transactionHash - The deposit's transaction hash
   * @param logIndex - The Transfer log's index in its block
   */
  async IsDepositProcessed(
    transactionHash: string,
    logIndex: number
  ): Promise<boolean> {
    const topUps = await this.db.Query<TopUpType>({
      collection: 'TopUps',
      method: 'READ',
      parameters: [
        {
          key: 'metadata.blockchain_tx',
          operator: QueryOperators['=='],
          value: transactionHash,
        },
        {
          key: 'metadata.log_index',
          operator: QueryOperators['=='],
          value: String(logIndex),
        },
      ],
      limit: 1,
    });
    return topUps.length > 0;
  }

  /**
   * The DepositKey of every Transfer log already credited among the given
   * transactions, on any platform. The TopUpMonitor skips these.
   *
   * @param transactionHashes - Transaction hashes of scanned deposits
   */
  async GetProcessedDepositKeys(
    transactionHashes: string[]
  ): Promise<Set<string>> {
    const keys = new Set<string>();
    if (transactionHashes.length === 0) return keys;
    const topUps = await this.db.Query<TopUpType>({
      collection: 'TopUps',
      method: 'READ',
      parameters: [
        {
          key: 'metadata.blockchain_tx',
          operator: QueryOperators.in,
          value: [...new Set(transactionHashes)],
        },
      ],
    });
    for (const topUp of topUps) {
      const { blockchain_tx, log_index } = topUp.metadata ?? {};
      if (blockchain_tx && log_index !== undefined) {
        keys.add(DepositKey(blockchain_tx, log_index));
      }
    }
    return keys;
  }

  /**
   * Get a single TopUp by ID.
   *
   * @param topUpId - The TopUp ID to retrieve
   * @returns The TopUp object or null if not found
   */
  async GetTopUp(topUpId: string): Promise<TopUpType | null> {
    return this.db.Get<TopUpType>('TopUps', topUpId);
  }

  /**
   * List TopUps with cursor-based pagination.
   * Matches Stripe's GET /v1/topups endpoint.
   *
   * @param options - Pagination and filter options
   * @returns Paginated list of TopUps
   */
  async ListTopUps(
    options: ListOptions & {
      status?: TopUpStatus;
    }
  ): Promise<ListResult<TopUpType>> {
    const { status, ...listOptions } = options;

    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;

    return this.listHelper.List({
      ...listOptions,
      filters: { ...listOptions.filters, ...filters },
    });
  }

  /**
   * Update a TopUp's metadata and/or description.
   * Only description and metadata are editable by design (matches Stripe).
   *
   * @param topUpId - The TopUp ID to update
   * @param input - The fields to update
   * @returns The updated TopUp object
   */
  async UpdateTopUp(
    topUpId: string,
    input: UpdateTopUpInput
  ): Promise<TopUpType | null> {
    const topUp = await this.GetTopUp(topUpId);
    if (!topUp) {
      return null;
    }

    AssertNoDepositKeys(input.metadata);
    const update: Partial<TopUpType> = {};

    if (input.description !== undefined) {
      update.description = input.description;
    }

    if (input.metadata !== undefined) {
      // Merge metadata - empty string values unset the key
      const newMetadata = { ...topUp.metadata };
      for (const [key, value] of Object.entries(input.metadata)) {
        if (value === '') {
          delete newMetadata[key];
        } else {
          newMetadata[key] = value;
        }
      }
      update.metadata = newMetadata;
    }

    if (Object.keys(update).length > 0) {
      await this.db.Update<TopUpType>('TopUps', topUpId, update);
    }

    return this.GetTopUp(topUpId);
  }

  /**
   * Creates a TopUp object with all required fields.
   * For TopUps, the account is always the platform account itself.
   */
  TopUpObject(
    amount: number,
    currency: string,
    account: string,
    options: {
      description?: string;
      statementDescriptor?: string;
      transferGroup?: string;
      metadata?: Record<string, string>;
      source?: TopUpSource;
    } = {}
  ): TopUpType {
    const timestamp = Now();
    const appConfig = GetAppConfig();

    const topUp: TopUpType = {
      id: GenerateId('tu_z'),
      object: 'topup',
      amount: amount,
      balance_transaction: null,
      created: timestamp,
      currency: currency.toLowerCase(),
      description: options.description ?? null,
      expected_availability_date: timestamp,
      failure_code: null,
      failure_message: null,
      livemode: appConfig.livemode,
      metadata: options.metadata || {},
      source: options.source ?? null,
      statement_descriptor: options.statementDescriptor ?? null,
      status: 'pending',
      transfer_group: options.transferGroup ?? null,
      // Zoneless extensions
      account: account,
      platform_account: account, // TopUps are always for platform accounts
      arrival_date: null,
    };

    // If metadata contains blockchain info, create a source object
    if (options.metadata?.blockchain_tx && !options.source) {
      topUp.source = {
        id: GenerateId('src_z'),
        object: 'source',
        type: 'crypto_deposit',
        metadata: {},
      };
    }

    return topUp;
  }
}

/**
 * API callers cannot set or change a deposit's key: erasing it would let the
 * same Transfer log credit again, and claiming one would block a real deposit.
 */
function AssertNoDepositKeys(metadata: Record<string, string> | undefined) {
  if (!metadata) return;
  if (DEPOSIT_KEY_FIELDS.some((key) => key in metadata)) {
    throw new AppError(
      'metadata.blockchain_tx and metadata.log_index identify the deposit a top-up credits and cannot be set or changed',
      ERRORS.INVALID_REQUEST.status,
      ERRORS.INVALID_REQUEST.type
    );
  }
}
