import { parseTransaction, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { BaseResource } from './Base';
import { RequestExtraOptions } from '../HttpClient';
import { ApplyDateFilter } from '../utils';
import {
  Payout,
  PayoutBatchBuildResponse,
  PayoutBatchBroadcastResponse,
  ProcessPendingResult,
  ReconcileResponse,
  ListResponse,
} from '@zoneless/shared-types';
import type {
  CreatePayoutInput,
  UpdatePayoutInput,
  ListPayoutsInput,
  BuildPayoutsBatchInput,
  BroadcastPayoutsBatchInput,
} from '../generated/Inputs';

const SIMULATED_TRANSACTION = 'sim_tx';

/**
 * @see /payouts
 */
export class Payouts extends BaseResource {
  /** @see /payouts/create */
  async create(
    params: CreatePayoutInput,
    options?: RequestExtraOptions
  ): Promise<Payout> {
    return this.client.Post<Payout>('/payouts', params, options);
  }

  /** @see /payouts/retrieve */
  async retrieve(id: string, options?: RequestExtraOptions): Promise<Payout> {
    return this.client.Get<Payout>(`/payouts/${id}`, undefined, options);
  }

  /** @see /payouts/update */
  async update(
    id: string,
    params: UpdatePayoutInput,
    options?: RequestExtraOptions
  ): Promise<Payout> {
    return this.client.Post<Payout>(`/payouts/${id}`, params, options);
  }

  /** @see /payouts/list */
  async list(
    params: ListPayoutsInput = {},
    options?: RequestExtraOptions
  ): Promise<ListResponse<Payout>> {
    const query = this.BuildQuery(params);
    return this.client.Get<ListResponse<Payout>>('/payouts', query, options);
  }

  /** @see /payouts/cancel */
  async cancel(id: string, options?: RequestExtraOptions): Promise<Payout> {
    return this.client.Post<Payout>(`/payouts/${id}/cancel`, {}, options);
  }

  /**
   * Build an unsigned batch payout transaction for multiple pending payouts.
   * This enables self-custodial payouts where the platform signs transactions locally.
   *
   * @param params - Object containing array of payout IDs to include
   * @param options - Optional request options
   * @returns Unsigned transaction data ready for signing
   *
   * @example
   * ```typescript
   * const buildResult = await zoneless.payouts.build({
   *   payouts: ['po_z123', 'po_z456', 'po_z789']
   * });
   * console.log(buildResult.unsigned_transaction); // Serialized unsigned transaction
   * ```
   *
   * @see /payouts/build
   */
  async build(
    params: BuildPayoutsBatchInput,
    options?: RequestExtraOptions
  ): Promise<PayoutBatchBuildResponse> {
    return this.client.Post<PayoutBatchBuildResponse>(
      '/payouts/build',
      params,
      options
    );
  }

  /**
   * Broadcast a signed batch payout transaction to the settlement network.
   * Updates all included payouts to 'paid' or 'failed' status.
   *
   * @param params - Object containing the signed transaction and payout IDs
   * @param options - Optional request options
   * @returns Broadcast result with the transaction hash and updated payouts
   *
   * @example
   * ```typescript
   * const result = await zoneless.payouts.broadcast({
   *   signed_transaction: signedTxBase64,
   *   payouts: ['po_z123', 'po_z456', 'po_z789']
   * });
   * console.log(result.transaction_hash);
   * ```
   *
   * @see /payouts/broadcast
   */
  async broadcast(
    params: BroadcastPayoutsBatchInput,
    options?: RequestExtraOptions
  ): Promise<PayoutBatchBroadcastResponse> {
    return this.client.Post<PayoutBatchBroadcastResponse>(
      '/payouts/broadcast',
      params,
      options
    );
  }

  /**
   * Settle the platform's outstanding payout batches from the chain. A
   * broadcast that returned `pending` settles here once it is confirmed.
   *
   * @param options - Optional request options
   * @returns Counts of the batches examined and settled
   *
   * @example
   * ```typescript
   * const result = await zoneless.payouts.reconcile();
   * console.log(`${result.paid} paid, ${result.pending} still pending`);
   * ```
   *
   * @see /payouts/reconcile
   */
  async reconcile(options?: RequestExtraOptions): Promise<ReconcileResponse> {
    return this.client.Post<ReconcileResponse>(
      '/payouts/reconcile',
      {},
      options
    );
  }

  /**
   * Process a single batch of pending payouts (up to 10).
   * This is the lower-level method that orchestrates:
   * 1. Fetches pending payouts (up to 10)
   * 2. Builds an unsigned transaction
   * 3. Signs it locally using the provided private key
   * 4. Broadcasts the signed transaction
   *
   * Use `processAll` to automatically process all pending payouts.
   *
   * @param privateKey - Your platform wallet's private key (`0x` + 64 hex)
   * @param options - Optional configuration
   * @param options.limit - Maximum number of payouts to process (default: 10, max: 10)
   * @param options.requestOptions - Additional request options
   * @returns Result containing the transaction hash, processed payouts, and has_more flag
   *
   * @example
   * ```typescript
   * const result = await zoneless.payouts.processBatch(
   *   process.env.WALLET_PRIVATE_KEY as `0x${string}`
   * );
   * console.log(`Processed ${result.payouts.length} payouts`);
   * if (result.has_more) {
   *   console.log('More payouts pending...');
   * }
   * ```
   *
   * @see /payouts/process-batch
   */
  async processBatch(
    privateKey: Hex,
    options?: {
      limit?: number;
      requestOptions?: RequestExtraOptions;
    }
  ): Promise<ProcessPendingResult> {
    const limit = Math.min(options?.limit ?? 10, 10);
    const requestOptions = options?.requestOptions;

    // Step 1: Get pending payouts
    const pendingPayouts = await this.list(
      { status: 'pending', limit },
      requestOptions
    );

    if (pendingPayouts.data.length === 0) {
      return {
        transaction_hash: '',
        status: 'paid',
        viewer_url: '',
        payouts: [],
        total_amount: 0,
        has_more: false,
      };
    }

    const payoutIds = pendingPayouts.data.map((p) => p.id);

    // Step 2: Build the unsigned transaction
    const buildResult = await this.build(
      { payouts: payoutIds },
      requestOptions
    );

    // Step 3: Sign the transaction locally
    const signedTransaction = await this.sign(
      buildResult.unsigned_transaction as Hex,
      privateKey
    );

    // Step 4: Broadcast the signed transaction
    const broadcastResult = await this.broadcast(
      {
        signed_transaction: signedTransaction,
        payouts: payoutIds,
      },
      requestOptions
    );

    return {
      transaction_hash: broadcastResult.transaction_hash,
      status: broadcastResult.status,
      viewer_url: broadcastResult.viewer_url,
      payouts: broadcastResult.payouts,
      total_amount: buildResult.total_amount,
      has_more: pendingPayouts.has_more,
      failure_message: broadcastResult.failure_message,
    };
  }

  /**
   * Process all pending payouts, automatically handling multiple batches.
   * Loops through all pending payouts in batches of up to 10 until none remain.
   *
   * @param privateKey - Your platform wallet's private key (`0x` + 64 hex)
   * @param options - Optional request options
   * @returns Array of results, one per batch processed
   *
   * @example
   * ```typescript
   * const results = await zoneless.payouts.processAll(
   *   process.env.WALLET_PRIVATE_KEY as `0x${string}`
   * );
   * const totalProcessed = results.reduce((sum, r) => sum + r.payouts.length, 0);
   * console.log(`Processed ${totalProcessed} payouts in ${results.length} batches`);
   * ```
   *
   * @see /payouts/process-all
   */
  async processAll(
    privateKey: Hex,
    options?: RequestExtraOptions & { delayBetweenBatchesMs?: number }
  ): Promise<ProcessPendingResult[]> {
    const results: ProcessPendingResult[] = [];
    const delayMs = options?.delayBetweenBatchesMs ?? 2000;
    let hasMore = true;

    while (hasMore) {
      const result = await this.processBatch(privateKey, {
        requestOptions: options,
      });

      if (result.payouts.length > 0) {
        results.push(result);
      }

      hasMore = result.has_more;

      if (hasMore && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Sign an unsigned transaction locally with an Ethereum private key.
   * Use this after calling `build()` to sign the transaction before broadcasting.
   *
   * @param unsignedTransaction - Serialized unsigned transaction (`0x…`) from `build()`
   * @param privateKey - Platform wallet private key (`0x` + 64 hex)
   * @returns Serialized signed transaction ready for `broadcast()`
   *
   * @example
   * ```typescript
   * const buildResult = await zoneless.payouts.build({
   *   payouts: ['po_z123', 'po_z456']
   * });
   * const signedTx = await zoneless.payouts.sign(
   *   buildResult.unsigned_transaction as `0x${string}`,
   *   process.env.WALLET_PRIVATE_KEY as `0x${string}`
   * );
   * const result = await zoneless.payouts.broadcast({
   *   signed_transaction: signedTx,
   *   payouts: ['po_z123', 'po_z456']
   * });
   * ```
   *
   * @see /payouts/sign
   */
  async sign(unsignedTransaction: Hex, privateKey: Hex): Promise<Hex> {
    // The simulated settlement rail has nothing to sign.
    if ((unsignedTransaction as string) === SIMULATED_TRANSACTION) {
      return unsignedTransaction;
    }

    return privateKeyToAccount(privateKey).signTransaction(
      parseTransaction(unsignedTransaction)
    );
  }

  private BuildQuery(
    params: ListPayoutsInput
  ): Record<string, string | number | undefined> {
    const query: Record<string, string | number | undefined> = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      destination: params.destination,
      status: params.status,
    };

    ApplyDateFilter(query, 'arrival_date', params.arrival_date);
    ApplyDateFilter(query, 'created', params.created);

    return query;
  }
}
