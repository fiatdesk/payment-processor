// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { parseTransaction, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { BaseResource } from './Base';
import { RequestExtraOptions, ZonelessPayoutBatchError } from '../HttpClient';
import { ApplyDateFilter } from '../utils';
import {
  EnsureAllowanceResult,
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

/** Most payouts one batch transaction pays (the API's limit). */
const MAX_BATCH_PAYOUTS = 100;

/** The API waits up to 60 s for confirmations of a signed transaction. */
const SIGNED_BROADCAST_TIMEOUT_MS = 90000;
/** A reported hash can take 60 s to appear, then 60 s to confirm. */
const HASH_BROADCAST_TIMEOUT_MS = 150000;

/**
 * Thrown by `processAll()` when a batch fails: `results` holds the batches
 * processed before it.
 */
export type ProcessAllError = Error & { results: ProcessPendingResult[] };

export interface SignPayoutOptions {
  /** Platform wallet address the private key must belong to */
  expectedSigner?: string;
}

export interface EnsureAllowanceOptions extends SignPayoutOptions {
  /**
   * Request options for every call. `idempotencyKey` is ignored: the helper
   * makes several requests.
   */
  requestOptions?: RequestExtraOptions;
}

export interface ProcessBatchOptions extends EnsureAllowanceOptions {
  /** Maximum payouts in the batch (default and maximum: 100) */
  limit?: number;
  /**
   * Re-price the wallet's outstanding batch of the same payouts (fresh fees
   * and deadline) instead of failing with `payout_batch_in_progress`. A
   * different set still waits until that batch is paid or expired.
   */
  replace?: boolean;
}

export interface ProcessAllOptions extends RequestExtraOptions {
  /** Pause between batches in milliseconds (default: 2000) */
  delayBetweenBatchesMs?: number;
  /** Platform wallet address the private key must belong to */
  expectedSigner?: string;
}

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
   * The first build for a wallet may return `transaction_type: 'approval'`
   * (the one-time allowance): sign and broadcast it with `payouts: []`, then
   * build again, or let `ensureAllowance()` do both.
   *
   * @param params - Payout IDs, plus optional `replace` and `deadline_seconds`
   * @param options - Optional request options
   * @returns Unsigned transaction data ready for signing
   * @throws ZonelessPayoutBatchError with `code` set, e.g.
   *   `payout_batch_in_progress` while another batch holds the wallet
   *
   * @example
   * ```typescript
   * const build = await zoneless.payouts.build({
   *   payouts: ['po_z123', 'po_z456', 'po_z789']
   * });
   * console.log(build.transaction_type, build.estimated_fee); // fee in wei
   * ```
   *
   * @see /payouts/build
   */
  async build(
    params: BuildPayoutsBatchInput,
    options?: RequestExtraOptions
  ): Promise<PayoutBatchBuildResponse> {
    return this.PayoutBatchCall(() =>
      this.client.Post<PayoutBatchBuildResponse>(
        '/payouts/build',
        params,
        options
      )
    );
  }

  /**
   * Broadcast a signed batch payout transaction, or report one a wallet sent.
   * `status` is `paid`, `failed`, or `pending` (not confirmed yet; the payouts
   * stay `in_transit` and settle through `reconcile()`).
   *
   * The API waits for confirmations before it answers, so this request waits
   * at least 90 s for a signed transaction and 150 s for a hash, or longer
   * when the client `timeout` is longer. `options.timeout` overrides both.
   *
   * @param params - The signed transaction or hash, and the payout IDs
   * @param options - Optional request options
   * @returns Broadcast result with the transaction hash and updated payouts
   * @throws ZonelessPayoutBatchError with `code` set, e.g.
   *   `transaction_not_found` or `payout_batch_mismatch`, or
   *   `broadcast_timeout` when no answer arrived in time: the transaction may
   *   still be mined, so call `reconcile()` later and never sign it again
   *
   * @example
   * ```typescript
   * const result = await zoneless.payouts.broadcast({
   *   signed_transaction: signedTx,
   *   payouts: ['po_z123', 'po_z456', 'po_z789']
   * });
   * console.log(result.status, result.transaction_hash);
   * ```
   *
   * @see /payouts/broadcast
   */
  async broadcast(
    params: BroadcastPayoutsBatchInput,
    options?: RequestExtraOptions
  ): Promise<PayoutBatchBroadcastResponse> {
    const timeout =
      options?.timeout ??
      Math.max(
        this.client.GetTimeout(),
        params.transaction_hash
          ? HASH_BROADCAST_TIMEOUT_MS
          : SIGNED_BROADCAST_TIMEOUT_MS
      );
    try {
      return await this.PayoutBatchCall(() =>
        this.client.Post<PayoutBatchBroadcastResponse>(
          '/payouts/broadcast',
          params,
          { ...options, timeout }
        )
      );
    } catch (error) {
      if (!IsTimeout(error)) throw error;
      throw new ZonelessPayoutBatchError({
        type: 'broadcast_timeout',
        code: 'broadcast_timeout',
        message: `Broadcast got no answer within ${
          timeout / 1000
        } s. The transaction may still be mined: call payouts.reconcile() later, and do not sign these payouts again.`,
        statusCode: 0,
      });
    }
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
   * Build a payout batch, first signing and broadcasting the platform
   * wallet's one-time PayoutBatch approval when build asks for it, then
   * building once more. Sign and broadcast the returned `build` yourself.
   *
   * @param privateKey - Your platform wallet's private key (`0x` + 64 hex)
   * @param params - Build parameters (payout IDs, `replace`, `deadline_seconds`)
   * @param options - `expectedSigner` and request options
   * @returns The payout build, and the approval broadcast if one was sent.
   *   `build` is null when the approval is `pending` (reconcile later) or `failed`.
   *
   * @example
   * ```typescript
   * const { build, approval } = await zoneless.payouts.ensureAllowance(
   *   process.env.WALLET_PRIVATE_KEY as `0x${string}`,
   *   { payouts: ['po_z123', 'po_z456'] }
   * );
   * if (!build) console.log(`Approval ${approval?.status}; reconcile later`);
   * ```
   *
   * @see /payouts/build
   */
  async ensureAllowance(
    privateKey: Hex,
    params: BuildPayoutsBatchInput,
    options?: EnsureAllowanceOptions
  ): Promise<EnsureAllowanceResult> {
    const requestOptions = WithoutIdempotencyKey(options?.requestOptions);
    const signOptions = { expectedSigner: options?.expectedSigner };

    const first = await this.build(params, requestOptions);
    if (first.transaction_type !== 'approval') {
      return { build: first, approval: null };
    }

    const approval = await this.broadcast(
      {
        signed_transaction: await this.sign(first, privateKey, signOptions),
        payouts: [],
      },
      requestOptions
    );
    if (approval.status !== 'paid') return { build: null, approval };

    // The approval no longer holds the wallet, so a replace would only
    // supersede a batch someone else built in the meantime.
    const rebuild = { ...params };
    delete rebuild.replace;
    const build = await this.build(rebuild, requestOptions);
    if (build.transaction_type === 'approval') {
      throw new Error(
        'Build still asks for an approval after the approval was confirmed'
      );
    }
    return { build, approval };
  }

  /**
   * Process a single batch of pending payouts (up to 100):
   * 1. Fetches pending payouts
   * 2. Builds the batch, signing the one-time approval first if needed
   * 3. Signs the payout transaction locally with the private key
   * 4. Broadcasts it
   *
   * A `pending` status means the transaction (or the approval) was submitted
   * but is not confirmed yet: call `reconcile()` later, then process again.
   *
   * @param privateKey - Your platform wallet's private key (`0x` + 64 hex)
   * @param options - `limit` (default and max 100), `replace`, `expectedSigner`
   *   and request options
   * @returns Result containing the transaction hash, processed payouts, and has_more flag
   * @throws ZonelessPayoutBatchError, e.g. `payout_batch_in_progress` while
   *   another batch holds the wallet (retry with `replace: true` for the same set)
   *
   * @example
   * ```typescript
   * const result = await zoneless.payouts.processBatch(
   *   process.env.WALLET_PRIVATE_KEY as `0x${string}`
   * );
   * console.log(`${result.status}: ${result.payouts.length} payouts`);
   * ```
   *
   * @see /payouts/process-batch
   */
  async processBatch(
    privateKey: Hex,
    options?: ProcessBatchOptions
  ): Promise<ProcessPendingResult> {
    const limit = Math.min(
      Math.max(options?.limit ?? MAX_BATCH_PAYOUTS, 1),
      MAX_BATCH_PAYOUTS
    );
    const requestOptions = WithoutIdempotencyKey(options?.requestOptions);

    const pendingPayouts = await this.list(
      { status: 'pending', limit },
      requestOptions
    );

    if (pendingPayouts.data.length === 0) {
      return {
        transaction_hash: '',
        status: 'paid',
        transaction_type: 'payout',
        viewer_url: '',
        payouts: [],
        total_amount: 0,
        has_more: false,
      };
    }

    const payoutIds = pendingPayouts.data.map((p) => p.id);
    const { build, approval } = await this.ensureAllowance(
      privateKey,
      { payouts: payoutIds, ...(options?.replace ? { replace: true } : {}) },
      { expectedSigner: options?.expectedSigner, requestOptions }
    );

    if (!build) {
      // The approval is not confirmed, so the payouts were not processed.
      const stopped = approval as PayoutBatchBroadcastResponse;
      return {
        transaction_hash: stopped.transaction_hash,
        status: stopped.status,
        transaction_type: 'approval',
        viewer_url: stopped.viewer_url,
        payouts: [],
        total_amount: 0,
        has_more: true,
        failure_message: stopped.failure_message,
      };
    }

    const broadcastResult = await this.broadcast(
      {
        signed_transaction: await this.sign(build, privateKey, {
          expectedSigner: options?.expectedSigner,
        }),
        payouts: build.payouts.map((p) => p.id),
      },
      requestOptions
    );

    return {
      transaction_hash: broadcastResult.transaction_hash,
      status: broadcastResult.status,
      transaction_type: broadcastResult.transaction_type,
      viewer_url: broadcastResult.viewer_url,
      payouts: broadcastResult.payouts,
      total_amount: build.total_amount,
      has_more: pendingPayouts.has_more,
      failure_message: broadcastResult.failure_message,
    };
  }

  /**
   * Process all pending payouts, in batches of up to 100, until none remain.
   * Stops at the first batch that is not `paid` and returns the results so
   * far including that one (with `has_more: true`): after a `pending` result,
   * call `reconcile()` later and process again.
   *
   * @param privateKey - Your platform wallet's private key (`0x` + 64 hex)
   * @param options - `delayBetweenBatchesMs`, `expectedSigner` and request options
   * @returns Array of results, one per batch processed
   * @throws The failing batch's error (see `processBatch`) as a
   *   `ProcessAllError`: its `results` holds the batches processed before it
   *
   * @example
   * ```typescript
   * const results = await zoneless.payouts.processAll(
   *   process.env.WALLET_PRIVATE_KEY as `0x${string}`
   * );
   * const last = results[results.length - 1];
   * if (last?.status === 'pending') await zoneless.payouts.reconcile();
   * ```
   *
   * @see /payouts/process-all
   */
  async processAll(
    privateKey: Hex,
    options?: ProcessAllOptions
  ): Promise<ProcessPendingResult[]> {
    const { delayBetweenBatchesMs, expectedSigner, ...requestOptions } =
      options ?? {};
    const results: ProcessPendingResult[] = [];
    const delayMs = delayBetweenBatchesMs ?? 2000;

    for (;;) {
      let result: ProcessPendingResult;
      try {
        result = await this.processBatch(privateKey, {
          expectedSigner,
          requestOptions,
        });
      } catch (error) {
        // Tell the caller which batches settled before this one failed.
        if (error instanceof Error) Object.assign(error, { results });
        throw error;
      }
      if (result.transaction_hash) results.push(result);

      if (result.status !== 'paid') {
        result.has_more = true;
        return results;
      }
      if (!result.has_more) return results;

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Sign a built transaction locally with an Ethereum private key. Before
   * signing it checks that the transaction calls `build.to` on
   * `build.chain_id` and, with `expectedSigner`, that the key is that wallet's.
   *
   * @param build - The `build()` result to sign (payout or approval)
   * @param privateKey - Platform wallet private key (`0x` + 64 hex)
   * @param options - `expectedSigner`: the platform wallet address
   * @returns Serialized signed transaction ready for `broadcast()`
   *
   * @example
   * ```typescript
   * const build = await zoneless.payouts.build({
   *   payouts: ['po_z123', 'po_z456']
   * });
   * const signedTx = await zoneless.payouts.sign(
   *   build,
   *   process.env.WALLET_PRIVATE_KEY as `0x${string}`
   * );
   * const result = await zoneless.payouts.broadcast({
   *   signed_transaction: signedTx,
   *   payouts: build.payouts.map((p) => p.id)
   * });
   * ```
   *
   * @see /payouts/sign
   */
  async sign(
    build: Pick<
      PayoutBatchBuildResponse,
      'unsigned_transaction' | 'to' | 'chain_id'
    >,
    privateKey: Hex,
    options?: SignPayoutOptions
  ): Promise<Hex> {
    // The simulated settlement rail has nothing to sign.
    if (build.unsigned_transaction === SIMULATED_TRANSACTION) {
      return SIMULATED_TRANSACTION as Hex;
    }

    const signer = privateKeyToAccount(privateKey);
    if (
      options?.expectedSigner &&
      !IsSameAddress(signer.address, options.expectedSigner)
    ) {
      throw new Error('Private key does not match the expected signer');
    }

    const transaction = parseTransaction(build.unsigned_transaction as Hex);
    if (
      !transaction.to ||
      !build.to ||
      !IsSameAddress(transaction.to, build.to)
    ) {
      throw new Error(
        'Unsigned transaction does not target the expected contract'
      );
    }
    if (build.chain_id === null || transaction.chainId !== build.chain_id) {
      throw new Error('Unsigned transaction is for a different chain');
    }
    return signer.signTransaction(transaction);
  }

  /** Re-throws payout batch API errors as `ZonelessPayoutBatchError`. */
  private async PayoutBatchCall<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw ZonelessPayoutBatchError.From(error);
    }
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

/** `AbortSignal.timeout` rejects fetch with a `TimeoutError` (or `AbortError`). */
function IsTimeout(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}

function IsSameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** One idempotency key across several requests would replay the first. */
function WithoutIdempotencyKey(
  options: RequestExtraOptions | undefined
): RequestExtraOptions | undefined {
  if (!options) return undefined;
  const rest = { ...options };
  delete rest.idempotencyKey;
  return rest;
}
