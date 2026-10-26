// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import type { PayoutBatch } from '@zoneless/shared-types';
import { Database } from '../modules/Database';
import {
  OUTSTANDING_BATCH_STATUSES,
  PayoutBatchStore,
} from '../modules/PayoutBatchStore';
import { AppError } from '../utils/AppError';
import {
  CreateMockDatabase,
  DeterministicId,
  GetFixedTimestamp,
  ResetIdCounter,
} from './Setup';

jest.mock('../modules/Database');
jest.mock('../utils/IdGenerator', () => ({
  GenerateId: jest.fn((prefix: string) => DeterministicId(prefix)),
}));
jest.mock('../utils/Timestamp', () => ({
  Now: jest.fn(() => GetFixedTimestamp()),
}));
jest.mock('../modules/AppConfig', () => ({
  GetAppConfig: jest.fn(() => ({ livemode: false })),
}));

const WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function NewBatch(store: PayoutBatchStore): PayoutBatch {
  return store.NewPayoutBatch({
    platform_account: 'acct_z_platform',
    wallet_address: WALLET,
    chain_id: 31337,
    nonce: 4,
    batch_id: '0xabc',
    payouts: ['po_z_1'],
    total_amount: 1000,
    transaction_type: 'payout',
    to: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    unsigned_transaction: '0x02unsigned',
    gas_limit: '60000',
    max_fee_per_gas: '3000000000',
    max_priority_fee_per_gas: '1000000000',
    build_block: 12,
    replaces: null,
  });
}

describe('PayoutBatchStore', () => {
  let db: jest.Mocked<Database>;
  let store: PayoutBatchStore;

  beforeEach(() => {
    jest.clearAllMocks();
    ResetIdCounter();
    db = CreateMockDatabase();
    store = new PayoutBatchStore(db);
  });

  describe('NewPayoutBatch', () => {
    it('starts a built batch with a pob id and no hashes', () => {
      expect(NewBatch(store)).toMatchObject({
        id: 'pob_z_test001',
        object: 'payout_batch',
        status: 'built',
        transaction_hash: null,
        transaction_hashes: [],
        broadcast_mode: null,
        replaced_by: null,
        livemode: false,
        created: GetFixedTimestamp(),
        updated: GetFixedTimestamp(),
      });
    });
  });

  describe('Create', () => {
    it('inserts the batch', async () => {
      const batch = NewBatch(store);
      const session = {} as never;

      await expect(store.Create(batch, session)).resolves.toBe(batch);
      expect(db.Set).toHaveBeenCalledWith(
        'PayoutBatches',
        batch.id,
        batch,
        session
      );
    });

    it('maps a duplicate-key error from the nonce lock index to 409 payout_batch_in_progress', async () => {
      db.Set.mockRejectedValue(
        Object.assign(new Error('E11000 duplicate key error'), {
          code: 11000,
        })
      );

      const error = await store.Create(NewBatch(store)).catch((e) => e);

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        statusCode: 409,
        type: 'payout_batch_in_progress',
      });
    });

    it('rethrows other database errors unchanged', async () => {
      const failure = new Error('connection reset');
      db.Set.mockRejectedValue(failure);

      await expect(store.Create(NewBatch(store))).rejects.toBe(failure);
    });
  });

  describe('queries', () => {
    it('finds a platform’s own outstanding batch for a wallet on a chain', async () => {
      const batch = NewBatch(store);
      db.Query.mockResolvedValue([batch]);

      await expect(
        store.FindOutstanding('acct_z_platform', 31337, WALLET)
      ).resolves.toBe(batch);
      expect(db.Query).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'PayoutBatches',
          parameters: [
            {
              key: 'platform_account',
              operator: '==',
              value: 'acct_z_platform',
            },
            { key: 'chain_id', operator: '==', value: 31337 },
            { key: 'wallet_address', operator: '==', value: WALLET },
            {
              key: 'status',
              operator: 'in',
              value: [...OUTSTANDING_BATCH_STATUSES],
            },
          ],
        })
      );
    });

    it('finds the wallet’s outstanding batch across platforms for the nonce lock', async () => {
      await store.FindOutstandingForWallet(31337, WALLET);

      expect(db.Query).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: [
            { key: 'chain_id', operator: '==', value: 31337 },
            { key: 'wallet_address', operator: '==', value: WALLET },
            {
              key: 'status',
              operator: 'in',
              value: [...OUTSTANDING_BATCH_STATUSES],
            },
          ],
        })
      );
    });

    it('returns null when the wallet has no outstanding batch', async () => {
      await expect(
        store.FindOutstanding('acct_z_platform', null, WALLET)
      ).resolves.toBeNull();
    });

    it('gets a batch only for the platform that owns it', async () => {
      await store.GetForPlatform('acct_z_platform', 'pob_z_1');

      expect(db.Query).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: [
            {
              key: 'platform_account',
              operator: '==',
              value: 'acct_z_platform',
            },
            { key: 'id', operator: '==', value: 'pob_z_1' },
          ],
        })
      );
    });

    it('lists a platform’s outstanding batches oldest first', async () => {
      await store.ListOutstanding('acct_z_platform');

      expect(db.Query).toHaveBeenCalledWith({
        method: 'READ',
        collection: 'PayoutBatches',
        parameters: [
          { key: 'platform_account', operator: '==', value: 'acct_z_platform' },
          {
            key: 'status',
            operator: 'in',
            value: [...OUTSTANDING_BATCH_STATUSES],
          },
        ],
        orderBy: [{ key: 'created', direction: 'asc' }],
      });
    });

    it('finds outstanding batches that contain any of the payouts', async () => {
      await store.FindOutstandingWithPayouts(['po_z_1', 'po_z_2']);

      expect(db.Query).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: [
            { key: 'payouts', operator: 'in', value: ['po_z_1', 'po_z_2'] },
            {
              key: 'status',
              operator: 'in',
              value: [...OUTSTANDING_BATCH_STATUSES],
            },
          ],
        })
      );
    });

    it('finds a platform’s batch by any of its transaction hashes', async () => {
      await store.FindByTransactionHash('acct_z_platform', '0xfeed');

      expect(db.Query).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: [
            {
              key: 'platform_account',
              operator: '==',
              value: 'acct_z_platform',
            },
            { key: 'transaction_hashes', operator: '==', value: '0xfeed' },
          ],
        })
      );
    });
  });

  describe('Transition', () => {
    it('updates the batch only while its platform owns it and it is in an expected status', async () => {
      const batch = NewBatch(store);
      db.FindOneAndUpdateByFilter.mockResolvedValue({
        ...batch,
        status: 'broadcast',
      });

      await store.Transition(
        batch,
        ['built'],
        { status: 'broadcast', transaction_hash: '0xfeed' },
        { addTransactionHash: '0xfeed' }
      );

      expect(db.FindOneAndUpdateByFilter).toHaveBeenCalledWith(
        'PayoutBatches',
        {
          id: batch.id,
          platform_account: 'acct_z_platform',
          status: { $in: ['built'] },
        },
        {
          $set: {
            status: 'broadcast',
            transaction_hash: '0xfeed',
            updated: GetFixedTimestamp(),
          },
          $addToSet: { transaction_hashes: '0xfeed' },
        },
        undefined
      );
    });

    it('rejects with 409 when the batch moved on concurrently', async () => {
      await expect(
        store.Transition(
          { id: 'pob_z_1', platform_account: 'acct_z_platform' },
          ['built'],
          { status: 'broadcast' }
        )
      ).rejects.toMatchObject({
        statusCode: 409,
        type: 'payout_batch_in_progress',
      });
    });
  });
});

describe('Database PayoutBatches index', () => {
  it('declares the nonce lock: one built or broadcast batch per wallet and chain', () => {
    const { Database: RealDatabase } = jest.requireActual<
      typeof import('../modules/Database')
    >('../modules/Database');
    const model = (
      new RealDatabase() as unknown as {
        GetModel(name: string): {
          schema: { indexes(): [Record<string, number>, object][] };
        };
      }
    ).GetModel('PayoutBatches');

    expect(model.schema.indexes()).toContainEqual([
      { chain_id: 1, wallet_address: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: {
          status: { $in: [...OUTSTANDING_BATCH_STATUSES] },
        },
      }),
    ]);
  });
});
