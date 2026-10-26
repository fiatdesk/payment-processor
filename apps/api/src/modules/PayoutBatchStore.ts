// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Storage for `PayoutBatches`, the internal record of each built payout
 * transaction. A unique partial index (see Database.GetModel) allows one
 * `built` or `broadcast` batch per wallet and chain, so two concurrent builds
 * can never hand out the same nonce: the second insert fails with a duplicate
 * key and surfaces as `payout_batch_in_progress`.
 *
 * @module PayoutBatchStore
 */

import type { ClientSession } from 'mongoose';
import {
  QueryOperators,
  type PayoutBatch,
  type PayoutBatchStatus,
} from '@zoneless/shared-types';
import { AppError } from '../utils/AppError';
import { GenerateId } from '../utils/IdGenerator';
import { Now } from '../utils/Timestamp';
import { GetAppConfig } from './AppConfig';
import type { Database } from './Database';

const COLLECTION = 'PayoutBatches';
const DUPLICATE_KEY = 11000;

/** Statuses that hold the wallet's nonce lock. */
export const OUTSTANDING_BATCH_STATUSES: readonly PayoutBatchStatus[] = [
  'built',
  'broadcast',
];

const OUTSTANDING = {
  key: 'status',
  operator: QueryOperators.in,
  value: [...OUTSTANDING_BATCH_STATUSES],
};

export type NewPayoutBatchFields = Pick<
  PayoutBatch,
  | 'platform_account'
  | 'wallet_address'
  | 'chain_id'
  | 'nonce'
  | 'batch_id'
  | 'payouts'
  | 'total_amount'
  | 'transaction_type'
  | 'to'
  | 'unsigned_transaction'
  | 'gas_limit'
  | 'max_fee_per_gas'
  | 'max_priority_fee_per_gas'
  | 'build_block'
  | 'replaces'
>;

export function PayoutBatchInProgress(message: string): AppError {
  return new AppError(message, 409, 'payout_batch_in_progress');
}

export class PayoutBatchStore {
  constructor(private readonly db: Database) {}

  NewPayoutBatch(fields: NewPayoutBatchFields): PayoutBatch {
    const timestamp = Now();
    return {
      id: GenerateId('pob_z'),
      object: 'payout_batch',
      ...fields,
      status: 'built',
      transaction_hash: null,
      transaction_hashes: [],
      broadcast_mode: null,
      replaced_by: null,
      livemode: GetAppConfig().livemode,
      created: timestamp,
      updated: timestamp,
    };
  }

  /** Inserts a batch; refused while the wallet already has an outstanding one. */
  async Create(
    batch: PayoutBatch,
    session?: ClientSession
  ): Promise<PayoutBatch> {
    try {
      await this.db.Set(COLLECTION, batch.id, batch, session);
    } catch (error) {
      if ((error as { code?: number })?.code === DUPLICATE_KEY) {
        throw PayoutBatchInProgress(
          `Wallet ${batch.wallet_address} already has a payout batch awaiting broadcast or confirmation`
        );
      }
      throw error;
    }
    return batch;
  }

  /**
   * The wallet's outstanding batch, whichever platform owns it. Nonces are
   * per wallet, so only the build-time lock check uses this; callers must
   * not act on, or reveal, a batch of another platform.
   */
  async FindOutstandingForWallet(
    chainId: number | null,
    walletAddress: string
  ): Promise<PayoutBatch | null> {
    const [batch] = await this.Query([
      { key: 'chain_id', operator: QueryOperators['=='], value: chainId },
      {
        key: 'wallet_address',
        operator: QueryOperators['=='],
        value: walletAddress,
      },
      OUTSTANDING,
    ]);
    return batch ?? null;
  }

  /** The platform's own outstanding batch for a wallet. */
  async FindOutstanding(
    platformAccountId: string,
    chainId: number | null,
    walletAddress: string
  ): Promise<PayoutBatch | null> {
    const [batch] = await this.Query([
      {
        key: 'platform_account',
        operator: QueryOperators['=='],
        value: platformAccountId,
      },
      { key: 'chain_id', operator: QueryOperators['=='], value: chainId },
      {
        key: 'wallet_address',
        operator: QueryOperators['=='],
        value: walletAddress,
      },
      OUTSTANDING,
    ]);
    return batch ?? null;
  }

  async GetForPlatform(
    platformAccountId: string,
    id: string
  ): Promise<PayoutBatch | null> {
    const [batch] = await this.Query([
      {
        key: 'platform_account',
        operator: QueryOperators['=='],
        value: platformAccountId,
      },
      { key: 'id', operator: QueryOperators['=='], value: id },
    ]);
    return batch ?? null;
  }

  /** Every outstanding batch of a platform, oldest first. */
  async ListOutstanding(platformAccountId: string): Promise<PayoutBatch[]> {
    return this.Query(
      [
        {
          key: 'platform_account',
          operator: QueryOperators['=='],
          value: platformAccountId,
        },
        OUTSTANDING,
      ],
      [{ key: 'created', direction: 'asc' }]
    );
  }

  async FindOutstandingWithPayouts(
    payoutIds: string[]
  ): Promise<PayoutBatch[]> {
    return this.Query([
      { key: 'payouts', operator: QueryOperators.in, value: payoutIds },
      OUTSTANDING,
    ]);
  }

  async FindByTransactionHash(
    platformAccountId: string,
    transactionHash: string
  ): Promise<PayoutBatch | null> {
    const [batch] = await this.Query([
      {
        key: 'platform_account',
        operator: QueryOperators['=='],
        value: platformAccountId,
      },
      {
        key: 'transaction_hashes',
        operator: QueryOperators['=='],
        value: transactionHash,
      },
    ]);
    return batch ?? null;
  }

  /**
   * Applies `changes` only while the batch still belongs to its platform and
   * is in one of `from`, so concurrent requests cannot both move it. Rejects
   * with 409 when it already moved on.
   */
  async Transition(
    batch: Pick<PayoutBatch, 'id' | 'platform_account'>,
    from: readonly PayoutBatchStatus[],
    changes: Partial<PayoutBatch>,
    options: { addTransactionHash?: string; session?: ClientSession } = {}
  ): Promise<PayoutBatch> {
    const update: Record<string, unknown> = {
      $set: { ...changes, updated: Now() },
    };
    if (options.addTransactionHash) {
      update.$addToSet = { transaction_hashes: options.addTransactionHash };
    }
    const updated = await this.db.FindOneAndUpdateByFilter<PayoutBatch>(
      COLLECTION,
      {
        id: batch.id,
        platform_account: batch.platform_account,
        status: { $in: [...from] },
      },
      update,
      options.session
    );
    if (!updated) {
      throw PayoutBatchInProgress(
        `Payout batch ${batch.id} changed while this request ran; retry`
      );
    }
    return updated;
  }

  private Query(
    parameters: {
      key: string;
      operator: QueryOperators;
      value: unknown;
    }[],
    orderBy?: { key: string; direction: 'asc' | 'desc' }[]
  ): Promise<PayoutBatch[]> {
    return this.db.Query<PayoutBatch>({
      method: 'READ',
      collection: COLLECTION,
      parameters,
      ...(orderBy && { orderBy }),
    });
  }
}
