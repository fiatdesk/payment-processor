// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * @fileOverview Methods for Payouts
 *
 * Batch payouts are built as one unsigned transaction per platform wallet,
 * signed by the platform, then broadcast and reconciled. A payout is refunded
 * only after a final reverted receipt, or once its batch's nonce was proven
 * used by another transaction that did not pay the batch.
 *
 * @module Payout
 */

import { ClientSession } from 'mongoose';
import { Database } from './Database';
import { EventService } from './EventService';
import { ExtractChangedFields } from './Event';
import { BalanceTransactionModule } from './BalanceTransaction';
import { BalanceModule } from './Balance';
import { ExternalWalletModule } from './ExternalWallet';
import { AccountModule } from './Account';
import { GetSettlement, type Settlement } from './chains/Settlement';
import { ComputeBatchId } from './chains/PayoutEncoding';
import type {
  BroadcastResult,
  PayoutBuildOptions,
  PayoutTransactionExpectation,
  PayoutTransactionMatch,
  TransferRecipient,
  UnsignedPayoutBatch,
} from './chains/types';
import {
  OUTSTANDING_BATCH_STATUSES,
  PayoutBatchInProgress,
  PayoutBatchStore,
  type NewPayoutBatchFields,
} from './PayoutBatchStore';
import { SanctionsScreeningModule } from './SanctionsScreening';
import { GetPlatformAccountId } from './PlatformAccess';
import { GetAppConfig } from './AppConfig';
import { GenerateId } from '../utils/IdGenerator';
import { Now } from '../utils/Timestamp';
import { AppError } from '../utils/AppError';
import { ERRORS } from '../utils/Errors';
import { Logger } from '../utils/Logger';
import {
  Payout as PayoutType,
  PayoutBatch,
  PayoutBatchBuildResponse,
  PayoutBatchBroadcastResponse,
  PayoutFailureCode,
  PayoutStatus,
  ReconcileResponse,
} from '@zoneless/shared-types';
import { ListHelper, ListOptions, ListResult } from '../utils/ListHelper';
import { ValidateUpdate } from './Util';
import {
  CreatePayoutSchema,
  CreatePayoutInput,
  UpdatePayoutSchema,
  UpdatePayoutInput,
  BuildPayoutsBatchInput,
  BroadcastPayoutsBatchInput,
  IsRejectedAccountReason,
  MAX_BATCH_PAYOUTS,
} from '@zoneless/shared-schemas';
import { IdentityLiteModule } from './identity/IdentityLite';

/** Most payouts one batch transaction may pay (about 5.1 M gas on Ethereum). */
export const MAX_BATCH_RECIPIENTS = MAX_BATCH_PAYOUTS;

/**
 * Extended list options for payouts with additional filters
 */
export interface PayoutListOptions extends Omit<ListOptions, 'filters'> {
  status?: PayoutType['status'];
  destination?: string;
  arrivalDate?:
    | {
        gt?: number;
        gte?: number;
        lt?: number;
        lte?: number;
      }
    | number;
}

/**
 * List options for fetching payouts by platform (using platform_account field)
 */
export interface PayoutPlatformListOptions
  extends Omit<PayoutListOptions, 'account'> {
  platformAccount: string;
}

export class PayoutModule {
  private readonly db: Database;
  private readonly eventService: EventService | null;
  private readonly listHelper: ListHelper<PayoutType>;
  private readonly platformListHelper: ListHelper<PayoutType>;
  private readonly accountModule: AccountModule;
  private readonly externalWalletModule: ExternalWalletModule;
  private readonly balanceModule: BalanceModule;
  private readonly balanceTransactionModule: BalanceTransactionModule;
  private readonly settlement: Settlement;
  private readonly payoutBatchStore: PayoutBatchStore;
  private readonly sanctionsModule: SanctionsScreeningModule;

  constructor(db: Database, eventService?: EventService) {
    this.db = db;
    this.eventService = eventService || null;
    this.accountModule = new AccountModule(db);
    this.externalWalletModule = new ExternalWalletModule(db);
    this.balanceModule = new BalanceModule(db);
    this.balanceTransactionModule = new BalanceTransactionModule(db);
    this.settlement = GetSettlement();
    this.payoutBatchStore = new PayoutBatchStore(db);
    this.sanctionsModule = new SanctionsScreeningModule();
    this.listHelper = new ListHelper<PayoutType>(db, {
      collection: 'Payouts',
      orderByField: 'created',
      orderDirection: 'desc',
      urlPath: '/v1/payouts',
    });
    // List helper for querying by platform_account (for platform-level queries)
    this.platformListHelper = new ListHelper<PayoutType>(db, {
      collection: 'Payouts',
      orderByField: 'created',
      orderDirection: 'desc',
      urlPath: '/v1/payouts',
      accountField: 'platform_account',
    });
  }

  /**
   * Creates a new payout that transfers funds from a connected account's
   * balance to an external wallet.
   * Emits a 'payout.created' event if EventService is configured.
   *
   * @param account - The connected account ID to debit funds from
   * @param input - Payout creation parameters
   * @returns The created payout object
   */
  async CreatePayout(
    account: string,
    input: CreatePayoutInput
  ): Promise<PayoutType> {
    const validatedInput = ValidateUpdate(CreatePayoutSchema, input);

    const {
      amount,
      currency,
      destination,
      description,
      method,
      metadata,
      statement_descriptor,
    } = validatedInput;

    if (amount <= 0) {
      throw new AppError(
        'Amount must be greater than 0',
        400,
        'invalid_request_error'
      );
    }

    const accountRecord = await this.accountModule.GetAccount(account);
    if (!accountRecord) {
      throw new AppError(
        ERRORS.ACCOUNT_NOT_FOUND.message,
        ERRORS.ACCOUNT_NOT_FOUND.status,
        ERRORS.ACCOUNT_NOT_FOUND.type
      );
    }

    if (IsRejectedAccountReason(accountRecord.requirements?.disabled_reason)) {
      throw new AppError(
        'This account has been rejected and cannot create payouts.',
        400,
        'invalid_request_error'
      );
    }

    if (!accountRecord.payouts_enabled) {
      throw new AppError(
        'Payouts are not enabled for this account. Complete onboarding and identity requirements first.',
        400,
        'invalid_request_error'
      );
    }

    // Get the destination wallet - either specified or the account's default
    let wallet;

    if (destination) {
      // Use specified destination wallet
      wallet = await this.externalWalletModule.GetExternalWallet(destination);

      if (!wallet) {
        throw new AppError(
          ERRORS.EXTERNAL_WALLET_NOT_FOUND.message,
          ERRORS.EXTERNAL_WALLET_NOT_FOUND.status,
          ERRORS.EXTERNAL_WALLET_NOT_FOUND.type
        );
      }

      if (wallet.status === 'archived') {
        throw new AppError(
          'Cannot create a payout to an archived wallet. Please use an active wallet.',
          400,
          'invalid_request_error'
        );
      }

      if (wallet.account !== account) {
        throw new AppError(
          'Destination wallet does not belong to this account',
          400,
          'invalid_request_error'
        );
      }
    } else {
      // Get the account's default external wallet
      const wallets =
        await this.externalWalletModule.GetExternalWalletsByAccount(account);

      if (wallets.length === 0) {
        throw new AppError(
          'No external wallet found for this account. Please add a payout method first.',
          400,
          'invalid_request_error'
        );
      }

      // Use the default wallet (first one marked as default, or just the first one)
      wallet =
        wallets.find((w) => w.default_for_currency === true) || wallets[0];
    }

    // Verify the destination is a valid Ethereum address
    const walletExists = await this.settlement.CheckWalletExists(
      wallet.wallet_address
    );
    if (!walletExists) {
      throw new AppError(
        'Destination wallet address is not a valid Ethereum address',
        400,
        'invalid_request_error'
      );
    }

    // Get the account to determine the platform
    const payoutAccount = await this.accountModule.GetAccount(account);
    if (!payoutAccount) {
      throw new AppError(
        ERRORS.ACCOUNT_NOT_FOUND.message,
        ERRORS.ACCOUNT_NOT_FOUND.status,
        ERRORS.ACCOUNT_NOT_FOUND.type
      );
    }
    const platformAccountId = GetPlatformAccountId(payoutAccount);

    const payout = await this.db.RunTransaction(
      async (session: ClientSession) => {
        // Store the wallet ID as destination (not the wallet address)
        const newPayout = this.PayoutObject({
          account,
          platformAccountId,
          amount,
          currency: currency ?? 'usdc',
          destination: wallet.id,
          description,
          method: method ?? 'instant',
          metadata: metadata ?? {},
          statementDescriptor: statement_descriptor,
        });

        const timestamp = Now();
        const balanceTransaction =
          this.balanceTransactionModule.BalanceTransactionObject({
            amount: -amount,
            currency: currency ?? 'usdc',
            account: account,
            platformAccountId,
            type: 'payout',
            source: newPayout.id,
            description: description || `Payout to wallet ${wallet.id}`,
            metadata: {},
            status: 'pending',
            available_on: timestamp,
          });

        newPayout.balance_transaction = balanceTransaction.id;

        // Verify account has sufficient funds
        const balanceData = await this.balanceModule.GetBalance(
          account,
          session
        );
        if (!balanceData) {
          throw new AppError(
            ERRORS.BALANCE_NOT_FOUND.message,
            ERRORS.BALANCE_NOT_FOUND.status,
            ERRORS.BALANCE_NOT_FOUND.type
          );
        }

        const availableAmount =
          balanceData.available.find((b) => b.currency === (currency ?? 'usdc'))
            ?.amount || 0;

        if (availableAmount < amount) {
          throw new AppError(
            'Insufficient funds in account balance',
            402,
            'insufficient_funds'
          );
        }

        // Persist payout and balance transaction
        await this.db.Set('Payouts', newPayout.id, newPayout, session);
        await this.db.Set(
          'BalanceTransactions',
          balanceTransaction.id,
          balanceTransaction,
          session
        );

        // Deduct from available balance
        const updatedBalance = this.balanceModule.UpdateBalance(
          balanceData,
          -amount,
          currency ?? 'usdc',
          'available'
        );
        await this.db.Update(
          'Balances',
          updatedBalance.id,
          { available: updatedBalance.available },
          session
        );

        return newPayout;
      }
    );

    // Emit payout.created event
    if (this.eventService) {
      await this.eventService.Emit('payout.created', account, payout);
    }

    return payout;
  }

  /**
   * Get a single payout by ID.
   *
   * @param payoutId - The payout ID to retrieve
   * @returns The payout object or null if not found
   */
  async GetPayout(payoutId: string): Promise<PayoutType | null> {
    return this.db.Get<PayoutType>('Payouts', payoutId);
  }

  /**
   * Update a payout's metadata.
   * Emits a 'payout.updated' event if EventService is configured.
   *
   * @param payoutId - The payout ID to update
   * @param input - The fields to update
   * @returns The updated payout object
   */
  async UpdatePayout(
    payoutId: string,
    input: UpdatePayoutInput
  ): Promise<PayoutType> {
    const validatedUpdate = ValidateUpdate(UpdatePayoutSchema, input);

    // Get previous state for the event
    const previousPayout = this.eventService
      ? await this.GetPayout(payoutId)
      : null;

    if (Object.keys(validatedUpdate).length > 0) {
      await this.db.Update<PayoutType>(
        'Payouts',
        payoutId,
        validatedUpdate as Partial<PayoutType>
      );
    }

    const payout = await this.GetPayout(payoutId);
    if (!payout) {
      throw new AppError(
        ERRORS.PAYOUT_NOT_FOUND.message,
        ERRORS.PAYOUT_NOT_FOUND.status,
        ERRORS.PAYOUT_NOT_FOUND.type
      );
    }

    // Emit payout.updated event
    if (this.eventService && Object.keys(validatedUpdate).length > 0) {
      const previousAttributes = previousPayout
        ? ExtractChangedFields(
            previousPayout as unknown as Record<string, unknown>,
            validatedUpdate as Record<string, unknown>
          )
        : null;

      await this.eventService.Emit('payout.updated', payout.account, payout, {
        previousAttributes,
      });
    }

    return payout;
  }

  /**
   * List payouts with cursor-based pagination.
   * Supports filtering by status, destination, created, and arrival_date.
   *
   * @param options - Pagination and filter options
   * @returns Paginated list of payouts
   */
  async ListPayouts(
    options: PayoutListOptions
  ): Promise<ListResult<PayoutType>> {
    const { status, destination, arrivalDate, ...listOptions } = options;

    // Build filters for direct field matching
    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;
    if (destination) filters.destination = destination;

    // Use the list helper for basic pagination
    let result = await this.listHelper.List({
      ...listOptions,
      filters,
    });

    // Apply arrival_date filter (post-filter since it's not in the standard ListHelper)
    if (arrivalDate) {
      result = {
        ...result,
        data: this.FilterByArrivalDate(result.data, arrivalDate),
      };
    }

    return result;
  }

  /**
   * List payouts for a platform (queries by platform_account field).
   * Returns all payouts belonging to the platform and its connected accounts.
   * Supports the same filtering as ListPayouts.
   *
   * @param options - Pagination and filter options with platform account ID
   * @returns Paginated list of payouts
   */
  async ListPayoutsByPlatform(
    options: PayoutPlatformListOptions
  ): Promise<ListResult<PayoutType>> {
    const {
      platformAccount,
      status,
      destination,
      arrivalDate,
      ...listOptions
    } = options;

    // Build filters for direct field matching
    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;
    if (destination) filters.destination = destination;

    // Use the platform list helper which queries by platform_account
    let result = await this.platformListHelper.List({
      ...listOptions,
      account: platformAccount, // This will query platform_account field
      filters,
    });

    // Apply arrival_date filter (post-filter since it's not in the standard ListHelper)
    if (arrivalDate) {
      result = {
        ...result,
        data: this.FilterByArrivalDate(result.data, arrivalDate),
      };
    }

    return result;
  }

  /**
   * Filter payouts by arrival_date
   */
  private FilterByArrivalDate(
    payouts: PayoutType[],
    arrivalDate:
      | { gt?: number; gte?: number; lt?: number; lte?: number }
      | number
  ): PayoutType[] {
    if (typeof arrivalDate === 'number') {
      return payouts.filter((p) => p.arrival_date === arrivalDate);
    }

    return payouts.filter((payout) => {
      const date = payout.arrival_date;
      if (arrivalDate.gt !== undefined && date <= arrivalDate.gt) return false;
      if (arrivalDate.gte !== undefined && date < arrivalDate.gte) return false;
      if (arrivalDate.lt !== undefined && date >= arrivalDate.lt) return false;
      if (arrivalDate.lte !== undefined && date > arrivalDate.lte) return false;
      return true;
    });
  }

  /**
   * Cancel a pending payout and refund the account balance.
   * Emits a 'payout.canceled' event if EventService is configured.
   *
   * @param payoutId - The payout ID to cancel
   * @returns The cancelled payout object
   */
  async CancelPayout(payoutId: string): Promise<PayoutType> {
    const payout = await this.GetPayout(payoutId);

    if (!payout) {
      throw new AppError(
        ERRORS.PAYOUT_NOT_FOUND.message,
        ERRORS.PAYOUT_NOT_FOUND.status,
        ERRORS.PAYOUT_NOT_FOUND.type
      );
    }

    if (payout.status !== 'pending') {
      throw new AppError(
        `Payout cannot be canceled because it has status: ${payout.status}`,
        400,
        'invalid_request_error'
      );
    }

    // A built transaction may still be signed and broadcast; refunding the
    // payout now could pay it twice.
    const [holder] = await this.payoutBatchStore.FindOutstandingWithPayouts([
      payoutId,
    ]);
    if (holder) {
      throw PayoutBatchInProgress(
        holder.platform_account === payout.platform_account
          ? `Payout ${payoutId} is in payout batch ${holder.id}, which may still be broadcast; replace or settle that batch first`
          : `Payout ${payoutId} is in a payout batch that may still be broadcast`
      );
    }

    const canceledPayout = await this.db.RunTransaction(
      async (session: ClientSession) => {
        // Mark payout as canceled
        await this.db.Update(
          'Payouts',
          payoutId,
          { status: 'canceled' },
          session
        );

        // Update balance transaction status
        if (payout.balance_transaction) {
          await this.db.Update(
            'BalanceTransactions',
            payout.balance_transaction,
            { status: 'canceled' },
            session
          );
        }

        // Refund the balance
        await this.RefundPayoutBalance(payout, session);

        const updatedPayout = await this.db.Get<PayoutType>(
          'Payouts',
          payoutId,
          session
        );

        return updatedPayout!;
      }
    );

    // Emit payout.canceled event
    if (this.eventService) {
      await this.eventService.Emit(
        'payout.canceled',
        canceledPayout.account,
        canceledPayout
      );
    }

    return canceledPayout;
  }

  /**
   * Gets the platform's default wallet address from ExternalWallet.
   * Used for building batch payout transactions.
   *
   * @param platformAccountId - The platform account ID
   * @returns The platform's wallet address
   */
  private async GetPlatformWalletPublicKey(
    platformAccountId: string
  ): Promise<string> {
    const wallets = await this.externalWalletModule.GetExternalWalletsByAccount(
      platformAccountId
    );
    const platformWallet =
      wallets.find((w) => w.default_for_currency) || wallets[0];
    if (!platformWallet) {
      throw new AppError(
        'Platform wallet not found. Please set up your wallet first.',
        400,
        'invalid_request_error'
      );
    }
    return platformWallet.wallet_address;
  }

  /**
   * Build an unsigned batch payout transaction for pending payouts. The
   * platform signs it locally, then broadcasts it. When the platform wallet
   * has not approved the payout contract yet, the result is the one-time
   * approval transaction (`transaction_type: 'approval'`, no payouts); sign
   * and broadcast it, then build again.
   *
   * One batch per wallet can be outstanding (built or broadcast). Pass
   * `replace: true` to re-price it at the same nonce or, before broadcast,
   * to supersede it with a different set of payouts.
   *
   * @param platformAccountId - The platform account ID (for verification)
   * @param input - Payout IDs and the optional replace flag
   * @returns Unsigned transaction data ready for signing
   */
  async BuildPayoutsBatch(
    platformAccountId: string,
    input: BuildPayoutsBatchInput
  ): Promise<PayoutBatchBuildResponse> {
    const payoutIds = UniquePayoutIds(input.payouts);
    if (payoutIds.length === 0 || payoutIds.length > MAX_BATCH_RECIPIENTS) {
      throw new AppError(
        `A payout batch includes between 1 and ${MAX_BATCH_RECIPIENTS} payouts`,
        400,
        'invalid_request_error'
      );
    }

    await this.ReconcilePayoutBatches(platformAccountId);

    const walletAddress = await this.GetPlatformWalletPublicKey(
      platformAccountId
    );
    // Nonces are per wallet, so the lock spans platforms that share one.
    // Another platform's batch blocks the build but is never named, replaced
    // or re-priced.
    const outstanding = await this.payoutBatchStore.FindOutstandingForWallet(
      this.settlement.Describe().chain_id,
      walletAddress
    );
    if (outstanding && outstanding.platform_account !== platformAccountId) {
      throw PayoutBatchInProgress(
        `Wallet ${walletAddress} has a payout batch in progress; build again once it settles`
      );
    }
    const plan = PlanBatchBuild(outstanding, payoutIds, input.replace === true);
    // Re-pricing a broadcast payout batch keeps its payouts in transit; an
    // approval never moves payouts.
    const expectedStatus: PayoutStatus =
      plan === 'reprice' &&
      outstanding?.status === 'broadcast' &&
      outstanding.transaction_type === 'payout'
        ? 'in_transit'
        : 'pending';
    const payouts = await this.LoadPlatformPayouts(
      platformAccountId,
      payoutIds,
      expectedStatus
    );
    await this.EnsurePayoutsUnclaimed(
      platformAccountId,
      payoutIds,
      outstanding
    );
    const recipients = await this.ResolveRecipients(payouts);
    await this.ScreenRecipients(payouts, recipients);

    const batchId = ComputeBatchId(payoutIds);
    const options: PayoutBuildOptions = { batchId };
    if (outstanding) {
      if (outstanding.nonce !== null) options.nonce = outstanding.nonce;
      options.replacing = {
        maxFeePerGas: outstanding.max_fee_per_gas,
        maxPriorityFeePerGas: outstanding.max_priority_fee_per_gas,
      };
    }
    const unsigned = await this.settlement.BuildBatchPayoutTransaction(
      walletAddress,
      recipients,
      options
    );

    const approval = unsigned.transaction_type === 'approval';
    const fields: NewPayoutBatchFields = {
      platform_account: platformAccountId,
      wallet_address: walletAddress,
      chain_id: unsigned.chain_id,
      nonce: unsigned.nonce,
      batch_id: approval ? null : batchId,
      payouts: approval ? [] : payoutIds,
      total_amount: approval
        ? 0
        : payouts.reduce((sum, p) => sum + p.amount, 0),
      transaction_type: unsigned.transaction_type,
      to: unsigned.to,
      unsigned_transaction: unsigned.unsigned_transaction,
      gas_limit: unsigned.gas_limit,
      max_fee_per_gas: unsigned.max_fee_per_gas,
      max_priority_fee_per_gas: unsigned.max_priority_fee_per_gas,
      build_block: unsigned.block_number,
      replaces: plan === 'supersede' && outstanding ? outstanding.id : null,
    };

    let batch: PayoutBatch;
    if (plan === 'reprice' && outstanding) {
      batch = await this.RepriceBatch(outstanding, unsigned);
    } else if (plan === 'supersede' && outstanding) {
      batch = await this.SupersedeBatch(outstanding, fields);
    } else {
      batch = await this.payoutBatchStore.Create(
        this.payoutBatchStore.NewPayoutBatch(fields)
      );
    }

    return {
      object: 'payout_batch_build',
      payout_batch: batch.id,
      replaced_payout_batch: batch.replaces,
      unsigned_transaction: unsigned.unsigned_transaction,
      estimated_fee: unsigned.estimated_fee,
      fee_currency: unsigned.fee_currency,
      chain_id: unsigned.chain_id,
      nonce: unsigned.nonce,
      to: unsigned.to,
      gas_limit: unsigned.gas_limit,
      max_fee_per_gas: unsigned.max_fee_per_gas,
      max_priority_fee_per_gas: unsigned.max_priority_fee_per_gas,
      transaction_type: batch.transaction_type,
      batch_id: batch.batch_id,
      payouts: approval ? [] : payouts,
      total_amount: batch.total_amount,
      recipients_count: approval ? 0 : unsigned.recipients_count,
    };
  }

  /**
   * Broadcast a batch transaction and settle its payouts. Send the signed
   * transaction (the API submits it) or the hash of a transaction the wallet
   * already submitted. Payouts move to `in_transit` before submission; a
   * confirmation timeout leaves them there (`status: 'pending'`) for
   * reconcile, and only a final reverted receipt refunds them.
   *
   * @param platformAccountId - The platform account ID (for verification)
   * @param input - The signed transaction or hash, and the batch's payout IDs
   * @returns Broadcast result with updated payouts
   */
  async BroadcastPayoutsBatch(
    platformAccountId: string,
    input: BroadcastPayoutsBatchInput
  ): Promise<PayoutBatchBroadcastResponse> {
    const { signed_transaction, transaction_hash } = input;
    const submitted = signed_transaction ?? transaction_hash;
    if (!submitted || (signed_transaction && transaction_hash)) {
      throw new AppError(
        'Provide exactly one of signed_transaction or transaction_hash',
        400,
        'invalid_request_error'
      );
    }
    const mode = signed_transaction ? 'signed_transaction' : 'transaction_hash';
    const payoutIds = UniquePayoutIds(input.payouts);

    await this.ReconcilePayoutBatches(platformAccountId);

    // Re-posting a hash we already track returns the batch's current state.
    const knownHash = this.settlement.GetTransactionHash(submitted);
    const tracked = knownHash
      ? await this.payoutBatchStore.FindByTransactionHash(
          platformAccountId,
          knownHash
        )
      : null;
    if (tracked && tracked.status !== 'built') {
      AssertPayoutSet(tracked, payoutIds);
      return this.BroadcastResponse(
        tracked,
        tracked.transaction_hash ?? submitted
      );
    }

    const walletAddress = await this.GetPlatformWalletPublicKey(
      platformAccountId
    );
    const batch = await this.payoutBatchStore.FindOutstanding(
      platformAccountId,
      this.settlement.Describe().chain_id,
      walletAddress
    );
    if (!batch) {
      throw BatchMismatch(
        `No payout batch is awaiting broadcast for wallet ${walletAddress}; build one first`
      );
    }
    AssertPayoutSet(batch, payoutIds);
    if (
      mode === 'signed_transaction' &&
      batch.broadcast_mode === 'transaction_hash'
    ) {
      throw BatchMismatch(
        `Payout batch ${batch.id} was broadcast from a wallet; speed it up in the wallet instead`
      );
    }

    const match = await this.settlement.MatchPayoutTransaction(
      submitted,
      this.Expectation(batch)
    );
    if (match.status === 'not_found') {
      throw new AppError(
        `Transaction ${submitted} is not visible on the network yet; broadcast again once it is, or reconcile later`,
        409,
        'transaction_not_found'
      );
    }
    if (match.status === 'mismatch') {
      throw BatchMismatch(
        `The transaction does not match payout batch ${batch.id}: ${match.reason}`
      );
    }
    if (batch.status === 'broadcast' && match.nonce !== batch.nonce) {
      throw BatchMismatch(
        `The transaction uses nonce ${match.nonce}; payout batch ${batch.id} is bound to nonce ${batch.nonce}`
      );
    }

    const broadcastBatch = await this.MarkBatchBroadcast(batch, match, mode);
    let result: BroadcastResult;
    try {
      result = await this.settlement.BroadcastSignedTransaction(
        submitted,
        this.Expectation(broadcastBatch)
      );
    } catch (error) {
      await this.RestoreBatch(batch);
      throw error;
    }

    const settled = await this.SettleBatch(broadcastBatch, result);
    return this.BroadcastResponse(settled, result.transaction_hash, result);
  }

  /**
   * Settle every outstanding payout batch of a platform from the chain. Runs
   * at the start of build and broadcast and via `POST /v1/payouts/reconcile`.
   * A batch is paid when its own receipt or a `BatchPaid` log for its batch
   * id is confirmed, failed when its own transaction reverted, and replaced
   * when its nonce went to another transaction that did not pay it. Anything
   * the chain cannot answer leaves the batch as it is.
   *
   * @param platformAccountId - The platform account ID
   * @returns Counts of examined and settled batches
   */
  async ReconcilePayoutBatches(
    platformAccountId: string
  ): Promise<ReconcileResponse> {
    const batches = await this.payoutBatchStore.ListOutstanding(
      platformAccountId
    );
    const result: ReconcileResponse = {
      object: 'payout_reconcile',
      reconciled: batches.length,
      paid: 0,
      failed: 0,
      pending: 0,
    };
    for (const batch of batches) {
      try {
        result[await this.ReconcileBatch(batch)] += 1;
      } catch (error) {
        Logger.warn('Payout batch reconcile skipped', {
          payoutBatch: batch.id,
          error: error instanceof Error ? error.message : String(error),
        });
        result.pending += 1;
      }
    }
    return result;
  }

  private async ReconcileBatch(
    batch: PayoutBatch
  ): Promise<'paid' | 'failed' | 'pending'> {
    const expected = this.Expectation(batch);
    // Read the nonce first: once it is consumed at confirmed depth, none of
    // the hashes checked below can still be mined later.
    const confirmedNonce = await this.settlement.GetAccountNonce(
      batch.wallet_address,
      'confirmed'
    );
    for (const hash of batch.transaction_hashes) {
      const status = await this.settlement.GetTransactionStatus(hash, expected);
      if (status.status === 'paid') {
        await this.SettleBatchPaid(batch, status);
        return 'paid';
      }
      if (status.status === 'failed') {
        await this.SettleBatchFailed(
          batch,
          batch.status === 'broadcast' ? 'failed' : 'replaced',
          status.failure_code ?? 'blockchain_error',
          status.failure_message ?? 'The payout transaction reverted'
        );
        return 'failed';
      }
    }

    if (
      typeof confirmedNonce !== 'number' ||
      typeof batch.nonce !== 'number' ||
      confirmedNonce <= batch.nonce
    ) {
      return 'pending';
    }

    // The nonce went to a transaction we do not track. It still paid the
    // batch if it emitted this batch's BatchPaid log (a wallet speed-up).
    const payment = await this.settlement.FindBatchPayment(expected);
    if (payment) {
      await this.SettleBatchPaid(batch, payment);
      return 'paid';
    }
    await this.SettleBatchFailed(
      batch,
      'replaced',
      'blockchain_error',
      'Another transaction from the platform wallet used this batch’s nonce; the payout was not sent'
    );
    return 'failed';
  }

  /** Validates payout ownership and status for a batch. */
  private async LoadPlatformPayouts(
    platformAccountId: string,
    payoutIds: string[],
    expectedStatus: PayoutStatus
  ): Promise<PayoutType[]> {
    const payouts: PayoutType[] = [];
    for (const payoutId of payoutIds) {
      const payout = await this.GetPayout(payoutId);
      if (!payout) {
        throw new AppError(
          `Payout ${payoutId} not found`,
          ERRORS.PAYOUT_NOT_FOUND.status,
          ERRORS.PAYOUT_NOT_FOUND.type
        );
      }

      if (payout.status !== expectedStatus) {
        throw new AppError(
          `Payout ${payoutId} is not ${expectedStatus} (status: ${payout.status})`,
          400,
          'invalid_request_error'
        );
      }

      // Verify payout belongs to a connected account of this platform
      const payoutAccount = await this.accountModule.GetAccount(payout.account);
      if (!payoutAccount) {
        throw new AppError(
          `Account ${payout.account} not found for payout ${payoutId}`,
          400,
          'invalid_request_error'
        );
      }
      if (GetPlatformAccountId(payoutAccount) !== platformAccountId) {
        throw new AppError(
          `Payout ${payoutId} does not belong to your platform`,
          403,
          'permission_denied'
        );
      }

      payouts.push(payout);
    }
    return payouts;
  }

  /** A payout may sit in one outstanding batch only (any wallet). */
  private async EnsurePayoutsUnclaimed(
    platformAccountId: string,
    payoutIds: string[],
    outstanding: PayoutBatch | null
  ): Promise<void> {
    const holders = await this.payoutBatchStore.FindOutstandingWithPayouts(
      payoutIds
    );
    const holder = holders.find((batch) => batch.id !== outstanding?.id);
    if (holder) {
      throw PayoutBatchInProgress(
        holder.platform_account === platformAccountId
          ? `Payouts are already in payout batch ${holder.id} (${holder.status})`
          : 'Payouts are already in a payout batch in progress'
      );
    }
  }

  private async ResolveRecipients(
    payouts: PayoutType[]
  ): Promise<TransferRecipient[]> {
    const recipients: TransferRecipient[] = [];
    const invalid: string[] = [];
    for (const payout of payouts) {
      const wallet = await this.externalWalletModule.GetExternalWallet(
        payout.destination
      );
      if (!wallet) {
        throw new AppError(
          `External wallet ${payout.destination} not found for payout ${payout.id}`,
          400,
          'invalid_request_error'
        );
      }
      if (!(await this.settlement.CheckWalletExists(wallet.wallet_address))) {
        invalid.push(`${payout.id} (${wallet.wallet_address})`);
      }
      recipients.push({
        destinationAddress: wallet.wallet_address,
        amountInCents: payout.amount,
      });
    }
    if (invalid.length > 0) {
      throw new AppError(
        `Destination wallet addresses are not valid: ${invalid.join(', ')}`,
        400,
        'invalid_request_error'
      );
    }
    return recipients;
  }

  /** Refuses recipients the token issuer froze or sanctions screening flags. */
  private async ScreenRecipients(
    payouts: PayoutType[],
    recipients: TransferRecipient[]
  ): Promise<void> {
    const addresses = [...new Set(recipients.map((r) => r.destinationAddress))];
    const [blacklisted, sanctioned] = await Promise.all([
      this.settlement.IsBlacklisted(addresses),
      this.sanctionsModule.CheckWalletAddresses(addresses),
    ]);
    const Offenders = (flagged: string[]) => {
      const set = new Set(flagged.map((a) => a.toLowerCase()));
      return payouts
        .map((payout, i) => ({
          payout,
          address: recipients[i].destinationAddress,
        }))
        .filter(({ address }) => set.has(address.toLowerCase()))
        .map(({ payout, address }) => `${payout.id} (${address})`)
        .join(', ');
    };
    if (blacklisted.length > 0) {
      throw new AppError(
        `Recipients are blacklisted by the USDC issuer: ${Offenders(
          blacklisted
        )}`,
        400,
        'account_frozen'
      );
    }
    if (sanctioned.length > 0) {
      throw new AppError(
        `Recipients failed sanctions screening: ${Offenders(sanctioned)}`,
        400,
        'sanctioned_address'
      );
    }
  }

  /** Same batch, same nonce, higher fees; earlier hashes stay tracked. */
  private RepriceBatch(
    batch: PayoutBatch,
    unsigned: UnsignedPayoutBatch
  ): Promise<PayoutBatch> {
    if (unsigned.transaction_type !== batch.transaction_type) {
      throw PayoutBatchInProgress(
        `The payout allowance changed while payout batch ${batch.id} is outstanding; reconcile once it settles`
      );
    }
    return this.payoutBatchStore.Transition(batch, [batch.status], {
      unsigned_transaction: unsigned.unsigned_transaction,
      to: unsigned.to,
      gas_limit: unsigned.gas_limit,
      max_fee_per_gas: unsigned.max_fee_per_gas,
      max_priority_fee_per_gas: unsigned.max_priority_fee_per_gas,
    });
  }

  /** Retires a built batch and records its successor at the same nonce. */
  private SupersedeBatch(
    batch: PayoutBatch,
    fields: NewPayoutBatchFields
  ): Promise<PayoutBatch> {
    const successor = this.payoutBatchStore.NewPayoutBatch(fields);
    return this.db.RunTransaction(async (session: ClientSession) => {
      await this.payoutBatchStore.Transition(
        batch,
        ['built'],
        { status: 'replaced', replaced_by: successor.id },
        { session }
      );
      return this.payoutBatchStore.Create(successor, session);
    });
  }

  /** Records the hash and moves payouts to in_transit before submission. */
  private MarkBatchBroadcast(
    batch: PayoutBatch,
    match: Extract<PayoutTransactionMatch, { status: 'match' }>,
    mode: 'signed_transaction' | 'transaction_hash'
  ): Promise<PayoutBatch> {
    return this.db.RunTransaction(async (session: ClientSession) => {
      const updated = await this.payoutBatchStore.Transition(
        batch,
        [batch.status],
        {
          status: 'broadcast',
          transaction_hash: match.transactionHash,
          nonce: match.nonce ?? batch.nonce,
          broadcast_mode: batch.broadcast_mode ?? mode,
        },
        { addTransactionHash: match.transactionHash, session }
      );
      if (batch.status === 'built') {
        for (const payoutId of batch.payouts) {
          await this.MovePayout(payoutId, 'pending', 'in_transit', session);
        }
      }
      return updated;
    });
  }

  /**
   * Undoes MarkBatchBroadcast after the transaction was not accepted. The
   * hash stays in `transaction_hashes` so reconcile still checks it.
   */
  private async RestoreBatch(batch: PayoutBatch): Promise<void> {
    await this.db.RunTransaction(async (session: ClientSession) => {
      await this.payoutBatchStore.Transition(
        batch,
        ['broadcast'],
        {
          status: batch.status,
          transaction_hash: batch.transaction_hash,
          nonce: batch.nonce,
          broadcast_mode: batch.broadcast_mode,
        },
        { session }
      );
      if (batch.status === 'built') {
        for (const payoutId of batch.payouts) {
          await this.MovePayout(payoutId, 'in_transit', 'pending', session);
        }
      }
    });
  }

  private async MovePayout(
    payoutId: string,
    from: PayoutStatus,
    to: PayoutStatus,
    session: ClientSession
  ): Promise<void> {
    const moved = await this.db.FindOneAndUpdateByFilter<PayoutType>(
      'Payouts',
      { id: payoutId, status: from },
      { status: to },
      session
    );
    if (!moved) {
      throw PayoutBatchInProgress(
        `Payout ${payoutId} is no longer ${from}; build the batch again`
      );
    }
  }

  private SettleBatch(
    batch: PayoutBatch,
    result: BroadcastResult
  ): Promise<PayoutBatch> {
    if (result.status === 'paid') return this.SettleBatchPaid(batch, result);
    if (result.status === 'failed') {
      return this.SettleBatchFailed(
        batch,
        'failed',
        result.failure_code ?? 'blockchain_error',
        result.failure_message ?? 'The payout transaction reverted'
      );
    }
    return Promise.resolve(batch);
  }

  private async SettleBatchPaid(
    batch: PayoutBatch,
    result: BroadcastResult
  ): Promise<PayoutBatch> {
    const { network, native_currency } = this.settlement.Describe();
    for (const payoutId of batch.payouts) {
      await this.MarkPayoutPaid(payoutId, {
        network,
        blockchain_tx: result.transaction_hash,
        gas_fee: 0, // Fee was paid by platform, not deducted from payout
        gas_fee_currency: native_currency,
        viewer_url: result.viewer_url,
      });
    }
    return this.payoutBatchStore.Transition(
      batch,
      OUTSTANDING_BATCH_STATUSES,
      { status: 'paid', transaction_hash: result.transaction_hash },
      { addTransactionHash: result.transaction_hash }
    );
  }

  /** Refunds in_transit payouts; payouts of a built batch never left pending. */
  private async SettleBatchFailed(
    batch: PayoutBatch,
    status: 'failed' | 'replaced',
    failureCode: PayoutFailureCode,
    failureMessage: string
  ): Promise<PayoutBatch> {
    if (batch.status === 'broadcast') {
      for (const payoutId of batch.payouts) {
        await this.MarkPayoutFailed(payoutId, failureCode, failureMessage);
      }
    }
    return this.payoutBatchStore.Transition(batch, OUTSTANDING_BATCH_STATUSES, {
      status,
    });
  }

  private async BroadcastResponse(
    batch: PayoutBatch,
    transactionHash: string,
    result?: BroadcastResult
  ): Promise<PayoutBatchBroadcastResponse> {
    const payouts: PayoutType[] = [];
    for (const payoutId of batch.payouts) {
      const payout = await this.GetPayout(payoutId);
      if (payout) payouts.push(payout);
    }
    const status =
      batch.status === 'paid'
        ? 'paid'
        : batch.status === 'failed' || batch.status === 'replaced'
        ? 'failed'
        : 'pending';
    const failureCode = result?.failure_code ?? payouts[0]?.failure_code;
    const failureMessage =
      result?.failure_message ?? payouts[0]?.failure_message;
    return {
      object: 'payout_batch_broadcast',
      transaction_hash: transactionHash,
      status,
      transaction_type: batch.transaction_type,
      viewer_url:
        result?.viewer_url ??
        this.settlement.ExplorerUrl('tx', transactionHash),
      payouts,
      ...(status === 'failed' && {
        failure_code: failureCode ?? 'blockchain_error',
        failure_message: failureMessage ?? 'The payout transaction failed',
      }),
    };
  }

  private Expectation(batch: PayoutBatch): PayoutTransactionExpectation {
    return {
      wallet: batch.wallet_address,
      chainId: batch.chain_id,
      nonce: batch.nonce,
      unsignedTransaction: batch.unsigned_transaction,
      transactionType: batch.transaction_type,
      batchId: batch.batch_id,
      recipientsCount: batch.payouts.length,
      totalCents: batch.total_amount,
      fromBlock: batch.build_block,
    };
  }

  /**
   * Mark a payout as paid and emit the payout.paid event. A payout that is
   * no longer pending or in transit was settled already and is skipped.
   */
  private async MarkPayoutPaid(
    payoutId: string,
    response: {
      network: string;
      blockchain_tx: string;
      gas_fee: number;
      gas_fee_currency: string;
      viewer_url: string;
    }
  ): Promise<void> {
    const payout = await this.db.RunTransaction(
      async (session: ClientSession) => {
        const updated = await this.db.FindOneAndUpdateByFilter<PayoutType>(
          'Payouts',
          { id: payoutId, status: { $in: ['pending', 'in_transit'] } },
          {
            status: 'paid',
            arrival_date: Now(),
            'metadata.network': response.network,
            'metadata.blockchain_tx': response.blockchain_tx,
            'metadata.gas_fee': response.gas_fee,
            'metadata.gas_fee_currency': response.gas_fee_currency,
            'metadata.viewer_url': response.viewer_url,
          },
          session
        );

        if (updated?.balance_transaction) {
          await this.db.Update(
            'BalanceTransactions',
            updated.balance_transaction,
            { status: 'available' },
            session
          );
        }
        return updated;
      }
    );
    if (!payout) return;

    // Emit payout.paid event
    if (this.eventService) {
      await this.eventService.Emit('payout.paid', payout.account, payout);
    }

    // Re-evaluate identity requirements (payout volume threshold → IDV)
    try {
      const identityLite = new IdentityLiteModule(this.db, this.eventService);
      await identityLite.EvaluateAndApply(payout.account);
    } catch (err) {
      // Payout already settled — soft-fail identity re-eval
      Logger.warn('Identity re-evaluation after payout.paid failed', {
        accountId: payout.account,
        payoutId: payout.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Mark an in-transit payout as failed, refund the balance, and emit the
   * payout.failed event. A payout that is not in transit is skipped, so a
   * repeated settlement never refunds twice.
   */
  private async MarkPayoutFailed(
    payoutId: string,
    failureCode: PayoutFailureCode,
    failureMessage: string
  ): Promise<void> {
    const payout = await this.db.RunTransaction(
      async (session: ClientSession) => {
        const updated = await this.db.FindOneAndUpdateByFilter<PayoutType>(
          'Payouts',
          { id: payoutId, status: 'in_transit' },
          {
            status: 'failed',
            failure_code: failureCode,
            failure_message: failureMessage,
          },
          session
        );
        if (!updated) return null;

        if (updated.balance_transaction) {
          await this.db.Update(
            'BalanceTransactions',
            updated.balance_transaction,
            { status: 'failed' },
            session
          );
        }

        await this.RefundPayoutBalance(updated, session);
        return updated;
      }
    );
    if (!payout) return;

    // Emit payout.failed event
    if (this.eventService) {
      await this.eventService.Emit('payout.failed', payout.account, payout);
    }
  }

  /**
   * Refunds the payout amount back to the account's available balance.
   * Used when a payout is canceled, blocked, or fails.
   *
   * @param payout - The payout to refund
   * @param session - Optional database session for transaction
   */
  private async RefundPayoutBalance(
    payout: PayoutType,
    session?: ClientSession
  ): Promise<void> {
    const balanceData = await this.balanceModule.GetBalance(
      payout.account,
      session
    );

    if (balanceData) {
      const updatedBalance = this.balanceModule.UpdateBalance(
        balanceData,
        payout.amount,
        payout.currency,
        'available'
      );
      await this.db.Update(
        'Balances',
        updatedBalance.id,
        { available: updatedBalance.available },
        session
      );
    }
  }

  /**
   * Creates a payout object with all required fields.
   */
  PayoutObject(params: {
    account: string;
    platformAccountId: string;
    amount: number;
    currency: string;
    destination: string;
    description?: string;
    method?: 'standard' | 'instant';
    metadata?: Record<string, string>;
    statementDescriptor?: string;
    automatic?: boolean;
  }): PayoutType {
    const {
      account,
      platformAccountId,
      amount,
      currency,
      destination,
      description,
      method = 'instant',
      metadata = {},
      statementDescriptor,
      automatic = false,
    } = params;

    const timestamp = Now();
    const payout: PayoutType = {
      id: GenerateId('po_z'),
      object: 'payout',
      account: account,
      platform_account: platformAccountId,
      amount: amount,
      arrival_date: timestamp,
      automatic: automatic,
      balance_transaction: null,
      created: timestamp,
      currency: currency,
      description: description || null,
      destination: destination,
      livemode: GetAppConfig().livemode,
      metadata: metadata,
      method: method,
      source_type: 'wallet',
      statement_descriptor: statementDescriptor || null,
      status: 'pending',
      type: 'wallet',
    };

    return payout;
  }
}

/** Duplicate ids would pay one payout twice in the same transaction. */
function UniquePayoutIds(payoutIds: string[]): string[] {
  if (new Set(payoutIds).size !== payoutIds.length) {
    throw new AppError(
      'Each payout may appear only once in a batch',
      400,
      'invalid_request_error'
    );
  }
  return payoutIds;
}

function SamePayoutSet(a: string[], b: string[]): boolean {
  const set = new Set(a);
  return a.length === b.length && b.every((id) => set.has(id));
}

function BatchMismatch(message: string): AppError {
  return new AppError(message, 409, 'payout_batch_mismatch');
}

function AssertPayoutSet(batch: PayoutBatch, payoutIds: string[]): void {
  if (!SamePayoutSet(batch.payouts, payoutIds)) {
    throw BatchMismatch(
      `The payouts do not match payout batch ${batch.id} (${
        batch.payouts.length
          ? batch.payouts.join(', ')
          : 'none; it is the approval transaction'
      })`
    );
  }
}

/**
 * How a build treats the wallet's outstanding batch: none → a new batch;
 * `replace: true` re-prices it (same payouts, same nonce) or, while it is
 * only built, supersedes it with a different set.
 */
function PlanBatchBuild(
  outstanding: PayoutBatch | null,
  payoutIds: string[],
  replace: boolean
): 'new' | 'reprice' | 'supersede' {
  if (!outstanding) return 'new';
  if (!replace) {
    throw PayoutBatchInProgress(
      `Payout batch ${outstanding.id} for wallet ${outstanding.wallet_address} is ${outstanding.status}; broadcast it, let it settle, or build with replace: true`
    );
  }
  const sameBatch =
    outstanding.transaction_type === 'approval' ||
    SamePayoutSet(outstanding.payouts, payoutIds);
  if (outstanding.status === 'broadcast') {
    if (outstanding.broadcast_mode === 'transaction_hash') {
      throw new AppError(
        `Payout batch ${outstanding.id} was broadcast from a wallet; speed it up in the wallet instead. Reconcile settles it from its on-chain batch id.`,
        400,
        'use_wallet_speed_up'
      );
    }
    if (!sameBatch) {
      throw PayoutBatchInProgress(
        `Payout batch ${outstanding.id} is already broadcast; it can only be re-priced with the same payouts`
      );
    }
    return 'reprice';
  }
  return sameBatch ? 'reprice' : 'supersede';
}
