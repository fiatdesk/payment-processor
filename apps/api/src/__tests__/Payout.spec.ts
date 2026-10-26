// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { MAX_BATCH_RECIPIENTS, PayoutModule } from '../modules/Payout';
import { Database } from '../modules/Database';
import type { Balance, Payout, PayoutBatch } from '@zoneless/shared-types';
import type { Settlement } from '../modules/chains/Settlement';
import { ComputeBatchId } from '../modules/chains/PayoutEncoding';
import { AppError } from '../utils/AppError';
import {
  CreateMockDatabase,
  DeterministicId,
  ResetIdCounter,
  GetFixedTimestamp,
} from './Setup';
import { MemoryDatabase } from './mocks/MemoryDatabase';
import { MOCK_PAYOUT_NONCE, MockReceipt } from './mocks/Settlement';

jest.mock('../modules/Database');
jest.mock('../utils/IdGenerator', () => ({
  GenerateId: jest.fn((prefix: string) => DeterministicId(prefix)),
}));
jest.mock('../utils/Timestamp', () => ({
  Now: jest.fn(() => GetFixedTimestamp()),
}));
jest.mock('../modules/AppConfig', () => ({
  GetAppConfig: jest.fn(() => ({
    dashboardUrl: 'http://localhost:4200',
    livemode: false,
    appSecret: 'test-secret',
  })),
}));
jest.mock('../modules/chains/Settlement', () => ({
  GetSettlement: () => require('./mocks/Settlement').CreateMockSettlement(),
  IsSimulatedSettlement: jest.fn(() => false),
}));
jest.mock('../modules/SanctionsScreening', () => ({
  SanctionsScreeningModule: jest.fn().mockImplementation(() => ({
    CheckWalletAddresses: jest.fn().mockResolvedValue([]),
  })),
}));
jest.mock('../modules/identity/IdentityLite', () => ({
  IdentityLiteModule: jest.fn().mockImplementation(() => ({
    EvaluateAndApply: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('../utils/Logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('PayoutModule', () => {
  let module: PayoutModule;
  let mockDb: jest.Mocked<Database>;

  beforeEach(() => {
    jest.clearAllMocks();
    ResetIdCounter();
    mockDb = CreateMockDatabase();
    module = new PayoutModule(mockDb);
  });

  describe('PayoutObject', () => {
    it('should build a payout with correct fields', () => {
      const payout = module.PayoutObject({
        account: 'acct_z_seller',
        platformAccountId: 'acct_z_platform',
        amount: 5000,
        currency: 'usdc',
        destination: 'wa_z_1',
        description: 'Weekly payout',
        method: 'instant',
        metadata: {},
      });

      expect(payout.object).toBe('payout');
      expect(payout.amount).toBe(5000);
      expect(payout.currency).toBe('usdc');
      expect(payout.account).toBe('acct_z_seller');
      expect(payout.platform_account).toBe('acct_z_platform');
      expect(payout.destination).toBe('wa_z_1');
      expect(payout.status).toBe('pending');
      expect(payout.method).toBe('instant');
      expect(payout.type).toBe('wallet');
      expect(payout.source_type).toBe('wallet');
      expect(payout.id).toMatch(/^po_z_test/);
    });

    it('should default to instant method', () => {
      const payout = module.PayoutObject({
        account: 'acct_z_1',
        platformAccountId: 'acct_z_platform',
        amount: 100,
        currency: 'usdc',
        destination: 'wa_z_1',
      });

      expect(payout.method).toBe('instant');
    });

    it('should default automatic to false', () => {
      const payout = module.PayoutObject({
        account: 'acct_z_1',
        platformAccountId: 'acct_z_platform',
        amount: 100,
        currency: 'usdc',
        destination: 'wa_z_1',
      });

      expect(payout.automatic).toBe(false);
    });
  });

  describe('GetPayout', () => {
    it('should return the payout when found', async () => {
      const mockPayout = { id: 'po_z_1', object: 'payout' } as Payout;
      mockDb.Get = jest.fn().mockResolvedValue(mockPayout);

      const result = await module.GetPayout('po_z_1');
      expect(result).toEqual(mockPayout);
    });

    it('should return null when not found', async () => {
      const result = await module.GetPayout('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('CreatePayout', () => {
    it('should reject when payouts are not enabled', async () => {
      jest
        .spyOn((module as any).accountModule, 'GetAccount')
        .mockResolvedValue({
          id: 'acct_z_seller',
          payouts_enabled: false,
        });

      await expect(
        module.CreatePayout('acct_z_seller', {
          amount: 1000,
          currency: 'usdc',
        })
      ).rejects.toThrow(/Payouts are not enabled/);
    });
  });

  describe('UpdatePayout', () => {
    it('should update payout metadata', async () => {
      const existingPayout = {
        id: 'po_z_1',
        object: 'payout',
        account: 'acct_z_1',
        metadata: {},
      } as Payout;
      mockDb.Get = jest.fn().mockResolvedValue(existingPayout);

      const result = await module.UpdatePayout('po_z_1', {
        metadata: { tracking: '12345' },
      });

      expect(mockDb.Update).toHaveBeenCalledWith(
        'Payouts',
        'po_z_1',
        expect.objectContaining({ metadata: { tracking: '12345' } })
      );
      expect(result).toEqual(existingPayout);
    });

    it('should throw when payout not found', async () => {
      await expect(
        module.UpdatePayout('nonexistent', { metadata: {} })
      ).rejects.toThrow('Payout not found');
    });
  });

  describe('CancelPayout', () => {
    it('should cancel a pending payout and refund the balance', async () => {
      const pendingPayout = {
        id: 'po_z_1',
        object: 'payout',
        status: 'pending',
        amount: 1000,
        currency: 'usdc',
        account: 'acct_z_1',
        balance_transaction: 'txn_z_1',
      } as Payout;

      const balance = {
        id: 'bal_z_1',
        available: [{ amount: 0, currency: 'usdc' }],
        pending: [],
      };

      mockDb.Get = jest
        .fn()
        .mockResolvedValueOnce(pendingPayout) // GetPayout
        .mockResolvedValue(pendingPayout); // subsequent gets
      mockDb.Find = jest.fn().mockResolvedValue([balance]);

      const result = await module.CancelPayout('po_z_1');

      expect(mockDb.Update).toHaveBeenCalledWith(
        'Payouts',
        'po_z_1',
        { status: 'canceled' },
        expect.anything()
      );
    });

    it('should throw when payout not found', async () => {
      await expect(module.CancelPayout('nonexistent')).rejects.toThrow(
        'Payout not found'
      );
    });

    it('should throw when payout is not pending', async () => {
      const paidPayout = {
        id: 'po_z_1',
        status: 'paid',
      } as Payout;
      mockDb.Get = jest.fn().mockResolvedValue(paidPayout);

      await expect(module.CancelPayout('po_z_1')).rejects.toThrow(
        'Payout cannot be canceled'
      );
    });
  });
});

const PLATFORM_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const RECIPIENTS = [
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
];
const WALLET_HASH = `0x${'ab'.repeat(32)}`;
const SPEED_UP_HASH = `0x${'cd'.repeat(32)}`;

describe('PayoutModule payout batches', () => {
  let memory: MemoryDatabase;
  let module: PayoutModule;
  let settlement: jest.Mocked<Settlement>;
  let sanctions: { CheckWalletAddresses: jest.Mock };

  /** Seller payouts of 1000, 2000, 3000 cents, each to its own wallet. */
  const IDS = ['po_z_1', 'po_z_2', 'po_z_3'];

  beforeEach(() => {
    jest.clearAllMocks();
    ResetIdCounter();
    memory = new MemoryDatabase();
    memory.Seed(
      'Accounts',
      { id: 'acct_z_platform', platform_account: 'acct_z_platform' },
      { id: 'acct_z_seller', platform_account: 'acct_z_platform' }
    );
    memory.Seed(
      'ExternalWallets',
      {
        id: 'wa_z_platform',
        account: 'acct_z_platform',
        wallet_address: PLATFORM_WALLET,
        default_for_currency: true,
        status: 'new',
      },
      ...RECIPIENTS.map((address, i) => ({
        id: `wa_z_${i + 1}`,
        account: 'acct_z_seller',
        wallet_address: address,
        status: 'new',
      }))
    );
    memory.Seed('Balances', {
      id: 'bal_z_seller',
      account: 'acct_z_seller',
      available: [{ amount: 0, currency: 'usdc' }],
      pending: [],
    });
    memory.Seed(
      'Payouts',
      ...IDS.map((id, i) => ({
        id,
        object: 'payout',
        account: 'acct_z_seller',
        platform_account: 'acct_z_platform',
        amount: 1000 * (i + 1),
        currency: 'usdc',
        destination: `wa_z_${i + 1}`,
        status: 'pending',
        balance_transaction: `txn_z_${i + 1}`,
        metadata: {},
      }))
    );
    module = new PayoutModule(memory.AsDatabase());
    const internals = module as unknown as {
      settlement: jest.Mocked<Settlement>;
      sanctionsModule: { CheckWalletAddresses: jest.Mock };
    };
    settlement = internals.settlement;
    sanctions = internals.sanctionsModule;
  });

  function Payouts(): Payout[] {
    return memory.All<Payout>('Payouts');
  }

  function Batches(): PayoutBatch[] {
    return memory.All<PayoutBatch>('PayoutBatches');
  }

  function AvailableBalance(): number {
    return memory.Doc<Balance>('Balances', 'bal_z_seller').available[0].amount;
  }

  function Statuses(): Record<string, string> {
    return Object.fromEntries(Payouts().map((p) => [p.id, p.status]));
  }

  async function Rejection(promise: Promise<unknown>): Promise<AppError> {
    const error = await promise.then(
      () => {
        throw new Error('expected a rejection');
      },
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(AppError);
    return error as AppError;
  }

  const Build = (payouts = IDS.slice(0, 2), replace?: boolean) =>
    module.BuildPayoutsBatch('acct_z_platform', { payouts, replace });

  const BroadcastSigned = (payouts = IDS.slice(0, 2), signed = 'signed_tx') =>
    module.BroadcastPayoutsBatch('acct_z_platform', {
      signed_transaction: signed,
      payouts,
    });

  const BroadcastHash = (payouts = IDS.slice(0, 2), hash = WALLET_HASH) =>
    module.BroadcastPayoutsBatch('acct_z_platform', {
      transaction_hash: hash,
      payouts,
    });

  describe('BuildPayoutsBatch', () => {
    it('records a built batch and keeps the payouts pending', async () => {
      const result = await Build();

      expect(result).toMatchObject({
        object: 'payout_batch_build',
        payout_batch: 'pob_z_test001',
        replaced_payout_batch: null,
        unsigned_transaction: '0x02unsigned_payout',
        transaction_type: 'payout',
        batch_id: ComputeBatchId(['po_z_1', 'po_z_2']),
        chain_id: 11155111,
        nonce: MOCK_PAYOUT_NONCE,
        gas_limit: '60000',
        max_fee_per_gas: '3000000000',
        max_priority_fee_per_gas: '1000000000',
        total_amount: 3000,
        recipients_count: 2,
      });
      expect(result.payouts.map((p) => p.id)).toEqual(['po_z_1', 'po_z_2']);
      expect(settlement.BuildBatchPayoutTransaction).toHaveBeenCalledWith(
        PLATFORM_WALLET,
        [
          { destinationAddress: RECIPIENTS[0], amountInCents: 1000 },
          { destinationAddress: RECIPIENTS[1], amountInCents: 2000 },
        ],
        { batchId: ComputeBatchId(['po_z_1', 'po_z_2']) }
      );
      expect(Batches()).toEqual([
        expect.objectContaining({
          id: 'pob_z_test001',
          status: 'built',
          wallet_address: PLATFORM_WALLET,
          nonce: MOCK_PAYOUT_NONCE,
          payouts: ['po_z_1', 'po_z_2'],
          total_amount: 3000,
          transaction_type: 'payout',
          build_block: 100,
        }),
      ]);
      expect(Statuses()).toEqual({
        po_z_1: 'pending',
        po_z_2: 'pending',
        po_z_3: 'pending',
      });
    });

    it('returns the approval variant with no payouts when the allowance is short', async () => {
      settlement.BuildBatchPayoutTransaction.mockImplementationOnce(
        (sender, _recipients, options) =>
          settlement.BuildApprovalTransaction(sender, options)
      );

      const result = await Build();

      expect(result).toMatchObject({
        transaction_type: 'approval',
        unsigned_transaction: '0x02unsigned_approval',
        batch_id: null,
        payouts: [],
        total_amount: 0,
        recipients_count: 0,
      });
      expect(Batches()).toEqual([
        expect.objectContaining({
          status: 'built',
          transaction_type: 'approval',
          payouts: [],
          batch_id: null,
        }),
      ]);
    });

    it('refuses a second build while a batch is outstanding for the wallet', async () => {
      await Build();

      const error = await Rejection(Build(['po_z_3']));

      expect(error).toMatchObject({
        statusCode: 409,
        type: 'payout_batch_in_progress',
      });
      expect(settlement.BuildBatchPayoutTransaction).toHaveBeenCalledTimes(1);
      expect(Batches()).toHaveLength(1);
    });

    it(`refuses more than ${MAX_BATCH_RECIPIENTS} payouts`, async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `po_z_x${i}`);

      const error = await Rejection(Build(ids));

      expect(error.statusCode).toBe(400);
      expect(settlement.BuildBatchPayoutTransaction).not.toHaveBeenCalled();
    });

    it('refuses blacklisted recipients up front without recording a batch', async () => {
      settlement.IsBlacklisted.mockResolvedValue([RECIPIENTS[1]]);

      const error = await Rejection(Build());

      expect(error).toMatchObject({ statusCode: 400, type: 'account_frozen' });
      expect(error.message).toContain(RECIPIENTS[1]);
      expect(error.message).toContain('po_z_2');
      expect(settlement.IsBlacklisted).toHaveBeenCalledWith(
        RECIPIENTS.slice(0, 2)
      );
      expect(settlement.BuildBatchPayoutTransaction).not.toHaveBeenCalled();
      expect(Batches()).toEqual([]);
    });

    it('refuses sanctioned recipients', async () => {
      sanctions.CheckWalletAddresses.mockResolvedValue([RECIPIENTS[0]]);

      const error = await Rejection(Build());

      expect(error).toMatchObject({
        statusCode: 400,
        type: 'sanctioned_address',
      });
      expect(error.message).toContain(RECIPIENTS[0]);
      expect(Batches()).toEqual([]);
    });

    it('refuses payouts held by an outstanding batch of another wallet', async () => {
      memory.Seed('PayoutBatches', {
        id: 'pob_z_old',
        platform_account: 'acct_z_platform',
        wallet_address: RECIPIENTS[2],
        chain_id: 11155111,
        nonce: MOCK_PAYOUT_NONCE,
        status: 'built',
        payouts: ['po_z_1'],
        transaction_hashes: [],
        created: 1,
      });

      const error = await Rejection(Build());

      expect(error).toMatchObject({
        statusCode: 409,
        type: 'payout_batch_in_progress',
      });
    });

    it('supersedes a built batch with a different payout set when replace is true', async () => {
      const first = await Build(['po_z_1']);

      const second = await Build(['po_z_1', 'po_z_2'], true);

      expect(second.replaced_payout_batch).toBe(first.payout_batch);
      expect(settlement.BuildBatchPayoutTransaction).toHaveBeenLastCalledWith(
        PLATFORM_WALLET,
        expect.any(Array),
        {
          batchId: ComputeBatchId(['po_z_1', 'po_z_2']),
          nonce: MOCK_PAYOUT_NONCE,
          replacing: {
            maxFeePerGas: '3000000000',
            maxPriorityFeePerGas: '1000000000',
          },
        }
      );
      expect(Batches()).toEqual([
        expect.objectContaining({
          id: first.payout_batch,
          status: 'replaced',
          replaced_by: second.payout_batch,
        }),
        expect.objectContaining({
          id: second.payout_batch,
          status: 'built',
          replaces: first.payout_batch,
          nonce: MOCK_PAYOUT_NONCE,
        }),
      ]);
    });

    it('re-prices a signed broadcast batch with the same payouts at the same nonce', async () => {
      const built = await Build();
      settlement.BroadcastSignedTransaction.mockResolvedValueOnce(
        MockReceipt('pending', '0xhash_of_signed_tx')
      );
      await BroadcastSigned();

      const repriced = await Build(IDS.slice(0, 2), true);

      expect(repriced).toMatchObject({
        payout_batch: built.payout_batch,
        replaced_payout_batch: null,
        batch_id: built.batch_id,
        nonce: built.nonce,
        max_fee_per_gas: '3375000000',
      });
      expect(Batches()).toEqual([
        expect.objectContaining({
          status: 'broadcast',
          transaction_hashes: ['0xhash_of_signed_tx'],
          max_fee_per_gas: '3375000000',
        }),
      ]);
      expect(Statuses()).toMatchObject({
        po_z_1: 'in_transit',
        po_z_2: 'in_transit',
      });
    });

    it('re-prices a signed broadcast approval while the payouts stay pending', async () => {
      settlement.BuildBatchPayoutTransaction.mockImplementation(
        (sender, _recipients, options) =>
          settlement.BuildApprovalTransaction(sender, options)
      );
      const approval = await Build();
      settlement.BroadcastSignedTransaction.mockResolvedValueOnce(
        MockReceipt('pending', '0xhash_of_signed_tx')
      );
      await BroadcastSigned([]);

      const repriced = await Build(IDS.slice(0, 2), true);

      expect(repriced).toMatchObject({
        payout_batch: approval.payout_batch,
        transaction_type: 'approval',
        payouts: [],
        max_fee_per_gas: '3375000000',
      });
      expect(Statuses()).toMatchObject({
        po_z_1: 'pending',
        po_z_2: 'pending',
      });
    });

    it('refuses to re-price a broadcast batch with a different payout set', async () => {
      await Build();
      settlement.BroadcastSignedTransaction.mockResolvedValueOnce(
        MockReceipt('pending', '0xhash_of_signed_tx')
      );
      await BroadcastSigned();

      const error = await Rejection(Build(['po_z_3'], true));

      expect(error).toMatchObject({
        statusCode: 409,
        type: 'payout_batch_in_progress',
      });
    });

    it('refuses to re-price a batch a wallet broadcast (use_wallet_speed_up)', async () => {
      await Build();
      settlement.BroadcastSignedTransaction.mockResolvedValueOnce(
        MockReceipt('pending', WALLET_HASH)
      );
      await BroadcastHash();

      const error = await Rejection(Build(IDS.slice(0, 2), true));

      expect(error).toMatchObject({
        statusCode: 400,
        type: 'use_wallet_speed_up',
      });
    });

    it('reconciles first, so a built batch whose nonce was consumed no longer blocks', async () => {
      await Build(['po_z_1']);
      settlement.GetAccountNonce.mockResolvedValue(MOCK_PAYOUT_NONCE + 1);

      await expect(Build(['po_z_2'])).resolves.toMatchObject({
        payout_batch: 'pob_z_test002',
      });
      expect(Batches()[0].status).toBe('replaced');
    });
  });

  describe('BroadcastPayoutsBatch', () => {
    it('settles a signed batch as paid', async () => {
      const built = await Build();

      const result = await BroadcastSigned();

      expect(settlement.BroadcastSignedTransaction).toHaveBeenCalledWith(
        'signed_tx',
        expect.objectContaining({
          wallet: PLATFORM_WALLET,
          nonce: MOCK_PAYOUT_NONCE,
          unsignedTransaction: '0x02unsigned_payout',
          transactionType: 'payout',
          batchId: built.batch_id,
          recipientsCount: 2,
          totalCents: 3000,
          fromBlock: 100,
        })
      );
      expect(result).toMatchObject({
        object: 'payout_batch_broadcast',
        transaction_hash: '0xhash_of_signed_tx',
        status: 'paid',
        transaction_type: 'payout',
      });
      expect(result.payouts.map((p) => p.status)).toEqual(['paid', 'paid']);
      expect(memory.Doc<Payout>('Payouts', 'po_z_1').metadata).toMatchObject({
        network: 'ethereum',
        blockchain_tx: '0xhash_of_signed_tx',
        gas_fee_currency: 'eth',
      });
      expect(Batches()[0]).toMatchObject({
        status: 'paid',
        broadcast_mode: 'signed_transaction',
      });
    });

    it('persists broadcast and in_transit before submitting the signed transaction', async () => {
      await Build();
      settlement.BroadcastSignedTransaction.mockImplementationOnce(async () => {
        expect(Batches()[0]).toMatchObject({
          status: 'broadcast',
          transaction_hash: '0xhash_of_signed_tx',
        });
        expect(Statuses()).toMatchObject({
          po_z_1: 'in_transit',
          po_z_2: 'in_transit',
        });
        return MockReceipt('paid', '0xhash_of_signed_tx');
      });

      await BroadcastSigned();

      expect(settlement.BroadcastSignedTransaction).toHaveBeenCalledTimes(1);
    });

    it('keeps payouts in_transit without a refund when confirmation times out', async () => {
      await Build();
      settlement.BroadcastSignedTransaction.mockResolvedValueOnce(
        MockReceipt('pending', '0xhash_of_signed_tx')
      );

      const result = await BroadcastSigned();

      expect(result).toMatchObject({
        status: 'pending',
        transaction_hash: '0xhash_of_signed_tx',
      });
      expect(Statuses()).toMatchObject({
        po_z_1: 'in_transit',
        po_z_2: 'in_transit',
      });
      expect(AvailableBalance()).toBe(0);
      expect(Batches()[0]).toMatchObject({
        status: 'broadcast',
        transaction_hash: '0xhash_of_signed_tx',
        transaction_hashes: ['0xhash_of_signed_tx'],
      });
    });

    it('fails a reverted batch with account_frozen and refunds the balance', async () => {
      await Build();
      settlement.BroadcastSignedTransaction.mockResolvedValueOnce(
        MockReceipt('failed', '0xhash_of_signed_tx', {
          failure_code: 'account_frozen',
          failure_message: 'Blacklistable: account is blacklisted',
        })
      );

      const result = await BroadcastSigned();

      expect(result).toMatchObject({
        status: 'failed',
        failure_code: 'account_frozen',
        failure_message: 'Blacklistable: account is blacklisted',
      });
      expect(memory.Doc<Payout>('Payouts', 'po_z_1')).toMatchObject({
        status: 'failed',
        failure_code: 'account_frozen',
      });
      expect(AvailableBalance()).toBe(3000);
      expect(Batches()[0].status).toBe('failed');
    });

    it('restores the batch and payouts when the signed transaction is not accepted', async () => {
      await Build();
      settlement.BroadcastSignedTransaction.mockRejectedValueOnce(
        new AppError('nonce too low', 400, 'blockchain_error')
      );

      const error = await Rejection(BroadcastSigned());

      expect(error.message).toBe('nonce too low');
      expect(Batches()[0]).toMatchObject({
        status: 'built',
        transaction_hash: null,
      });
      expect(Statuses()).toMatchObject({
        po_z_1: 'pending',
        po_z_2: 'pending',
      });
      expect(AvailableBalance()).toBe(0);
    });

    it('rejects a signed transaction that does not match the batch, changing nothing', async () => {
      await Build();
      settlement.MatchPayoutTransaction.mockResolvedValueOnce({
        status: 'mismatch',
        reason: 'nonce 3 does not match the built nonce 7',
      });

      const error = await Rejection(BroadcastSigned());

      expect(error).toMatchObject({
        statusCode: 409,
        type: 'payout_batch_mismatch',
      });
      expect(error.message).toContain('nonce 3');
      expect(settlement.BroadcastSignedTransaction).not.toHaveBeenCalled();
      expect(Batches()[0].status).toBe('built');
      expect(Statuses().po_z_1).toBe('pending');
    });

    it('rejects payout ids that differ from the built batch', async () => {
      await Build();

      const error = await Rejection(BroadcastSigned(['po_z_1']));

      expect(error).toMatchObject({
        statusCode: 409,
        type: 'payout_batch_mismatch',
      });
      expect(settlement.MatchPayoutTransaction).not.toHaveBeenCalled();
    });

    it('returns transaction_not_found when a wallet hash is not visible, leaving the batch built', async () => {
      await Build();
      settlement.MatchPayoutTransaction.mockResolvedValueOnce({
        status: 'not_found',
      });

      const error = await Rejection(BroadcastHash());

      expect(error).toMatchObject({
        statusCode: 409,
        type: 'transaction_not_found',
      });
      expect(Batches()[0].status).toBe('built');
      expect(Statuses().po_z_1).toBe('pending');
    });

    it('waits on a wallet hash and records the nonce the wallet used', async () => {
      await Build();
      settlement.MatchPayoutTransaction.mockResolvedValueOnce({
        status: 'match',
        transactionHash: WALLET_HASH,
        nonce: 9,
      });

      const result = await BroadcastHash();

      expect(settlement.BroadcastSignedTransaction).toHaveBeenCalledWith(
        WALLET_HASH,
        expect.objectContaining({ nonce: 9 })
      );
      expect(result.status).toBe('paid');
      expect(Batches()[0]).toMatchObject({
        status: 'paid',
        nonce: 9,
        broadcast_mode: 'transaction_hash',
        transaction_hash: WALLET_HASH,
      });
    });

    it('returns the current state when the same hash is posted again', async () => {
      await Build();
      settlement.BroadcastSignedTransaction.mockResolvedValueOnce(
        MockReceipt('pending', WALLET_HASH)
      );
      await BroadcastHash();

      const again = await BroadcastHash();

      expect(again).toMatchObject({
        status: 'pending',
        transaction_hash: WALLET_HASH,
      });
      expect(settlement.BroadcastSignedTransaction).toHaveBeenCalledTimes(1);
      expect(Batches()[0].transaction_hashes).toEqual([WALLET_HASH]);
    });

    it('appends a wallet speed-up hash that matches the batch', async () => {
      await Build();
      settlement.BroadcastSignedTransaction.mockResolvedValue(
        MockReceipt('pending', WALLET_HASH)
      );
      await BroadcastHash();

      await BroadcastHash(IDS.slice(0, 2), SPEED_UP_HASH);

      expect(Batches()[0]).toMatchObject({
        status: 'broadcast',
        transaction_hash: SPEED_UP_HASH,
        transaction_hashes: [WALLET_HASH, SPEED_UP_HASH],
      });
      expect(Statuses().po_z_1).toBe('in_transit');
    });

    it('rejects a different hash that does not match the batch', async () => {
      await Build();
      settlement.BroadcastSignedTransaction.mockResolvedValue(
        MockReceipt('pending', WALLET_HASH)
      );
      await BroadcastHash();
      settlement.MatchPayoutTransaction.mockResolvedValueOnce({
        status: 'mismatch',
        reason: 'the transaction calls a different contract',
      });

      const error = await Rejection(
        BroadcastHash(IDS.slice(0, 2), SPEED_UP_HASH)
      );

      expect(error).toMatchObject({
        statusCode: 409,
        type: 'payout_batch_mismatch',
      });
      expect(Batches()[0].transaction_hashes).toEqual([WALLET_HASH]);
    });

    it('rejects a speed-up hash that uses a different nonce', async () => {
      await Build();
      settlement.BroadcastSignedTransaction.mockResolvedValue(
        MockReceipt('pending', WALLET_HASH)
      );
      await BroadcastHash();
      settlement.MatchPayoutTransaction.mockResolvedValueOnce({
        status: 'match',
        transactionHash: SPEED_UP_HASH,
        nonce: MOCK_PAYOUT_NONCE + 1,
      });

      const error = await Rejection(
        BroadcastHash(IDS.slice(0, 2), SPEED_UP_HASH)
      );

      expect(error).toMatchObject({
        statusCode: 409,
        type: 'payout_batch_mismatch',
      });
    });

    it('broadcasts the approval with no payouts and releases the lock', async () => {
      settlement.BuildBatchPayoutTransaction.mockImplementationOnce(
        (sender, _recipients, options) =>
          settlement.BuildApprovalTransaction(sender, options)
      );
      await Build();

      const result = await BroadcastSigned([]);

      expect(result).toMatchObject({
        status: 'paid',
        transaction_type: 'approval',
        payouts: [],
      });
      expect(Batches()[0].status).toBe('paid');
      await expect(Build()).resolves.toMatchObject({
        transaction_type: 'payout',
      });
    });

    it('requires a built batch for the wallet', async () => {
      const error = await Rejection(BroadcastSigned());

      expect(error).toMatchObject({
        statusCode: 409,
        type: 'payout_batch_mismatch',
      });
    });
  });

  describe('ReconcilePayoutBatches', () => {
    async function BroadcastPending(): Promise<void> {
      await Build();
      settlement.BroadcastSignedTransaction.mockResolvedValueOnce(
        MockReceipt('pending', '0xhash_of_signed_tx')
      );
      await BroadcastSigned();
    }

    it('marks a batch paid once its receipt is confirmed', async () => {
      await BroadcastPending();
      settlement.GetTransactionStatus.mockResolvedValue(
        MockReceipt('paid', '0xhash_of_signed_tx')
      );

      await expect(
        module.ReconcilePayoutBatches('acct_z_platform')
      ).resolves.toEqual({
        object: 'payout_reconcile',
        reconciled: 1,
        paid: 1,
        failed: 0,
        pending: 0,
      });
      expect(Statuses()).toMatchObject({ po_z_1: 'paid', po_z_2: 'paid' });
      expect(Batches()[0].status).toBe('paid');
    });

    it('leaves a batch pending while its nonce is not consumed', async () => {
      await BroadcastPending();

      await expect(
        module.ReconcilePayoutBatches('acct_z_platform')
      ).resolves.toMatchObject({ reconciled: 1, pending: 1 });
      expect(Statuses().po_z_1).toBe('in_transit');
      expect(settlement.FindBatchPayment).not.toHaveBeenCalled();
    });

    it('reads the confirmed nonce before the receipts', async () => {
      await BroadcastPending();

      await module.ReconcilePayoutBatches('acct_z_platform');

      expect(settlement.GetAccountNonce).toHaveBeenCalledWith(
        PLATFORM_WALLET,
        'confirmed'
      );
      expect(
        settlement.GetAccountNonce.mock.invocationCallOrder[0]
      ).toBeLessThan(
        settlement.GetTransactionStatus.mock.invocationCallOrder[0]
      );
    });

    it('settles a batch paid by an unknown transaction through its BatchPaid log', async () => {
      await BroadcastPending();
      settlement.GetAccountNonce.mockResolvedValue(MOCK_PAYOUT_NONCE + 1);
      settlement.FindBatchPayment.mockResolvedValue(
        MockReceipt('paid', SPEED_UP_HASH)
      );

      await expect(
        module.ReconcilePayoutBatches('acct_z_platform')
      ).resolves.toMatchObject({ paid: 1 });
      expect(memory.Doc<Payout>('Payouts', 'po_z_1')).toMatchObject({
        status: 'paid',
        metadata: expect.objectContaining({ blockchain_tx: SPEED_UP_HASH }),
      });
      expect(AvailableBalance()).toBe(0);
    });

    it('replaces a broadcast batch and refunds when another transaction took its nonce', async () => {
      await BroadcastPending();
      settlement.GetAccountNonce.mockResolvedValue(MOCK_PAYOUT_NONCE + 1);

      await expect(
        module.ReconcilePayoutBatches('acct_z_platform')
      ).resolves.toMatchObject({ failed: 1 });
      expect(Batches()[0].status).toBe('replaced');
      expect(memory.Doc<Payout>('Payouts', 'po_z_1')).toMatchObject({
        status: 'failed',
        failure_code: 'blockchain_error',
      });
      expect(AvailableBalance()).toBe(3000);
    });

    it('fails a batch whose own transaction reverted and refunds it', async () => {
      await BroadcastPending();
      settlement.GetTransactionStatus.mockResolvedValue(
        MockReceipt('failed', '0xhash_of_signed_tx', {
          failure_code: 'account_frozen',
          failure_message: 'Blacklistable: account is blacklisted',
        })
      );

      await module.ReconcilePayoutBatches('acct_z_platform');

      expect(Batches()[0].status).toBe('failed');
      expect(Statuses().po_z_1).toBe('failed');
      expect(AvailableBalance()).toBe(3000);
    });

    it('replaces a built batch whose nonce was consumed, leaving its payouts pending', async () => {
      await Build();
      settlement.GetAccountNonce.mockResolvedValue(MOCK_PAYOUT_NONCE + 1);

      await module.ReconcilePayoutBatches('acct_z_platform');

      expect(Batches()[0].status).toBe('replaced');
      expect(Statuses()).toMatchObject({
        po_z_1: 'pending',
        po_z_2: 'pending',
      });
      expect(AvailableBalance()).toBe(0);
    });

    it('leaves every batch untouched when the chain cannot be read', async () => {
      await BroadcastPending();
      settlement.GetAccountNonce.mockResolvedValue(MOCK_PAYOUT_NONCE + 1);
      settlement.FindBatchPayment.mockRejectedValue(
        new Error('query exceeds max block range')
      );

      await expect(
        module.ReconcilePayoutBatches('acct_z_platform')
      ).resolves.toMatchObject({ reconciled: 1, pending: 1 });
      expect(Batches()[0].status).toBe('broadcast');
      expect(Statuses().po_z_1).toBe('in_transit');
      expect(AvailableBalance()).toBe(0);
    });
  });

  describe('tenant isolation on a shared platform wallet', () => {
    /** Another platform's batch on the same wallet and chain. */
    const FOREIGN = {
      id: 'pob_z_foreign',
      object: 'payout_batch',
      platform_account: 'acct_z_other',
      wallet_address: PLATFORM_WALLET,
      chain_id: 11155111,
      nonce: MOCK_PAYOUT_NONCE,
      batch_id: '0xforeign_batch',
      payouts: ['po_z_foreign_1'],
      total_amount: 500,
      transaction_type: 'payout',
      transaction_hash: WALLET_HASH,
      transaction_hashes: [WALLET_HASH],
      broadcast_mode: 'transaction_hash',
      unsigned_transaction: '0x02foreign',
      max_fee_per_gas: '3000000000',
      max_priority_fee_per_gas: '1000000000',
      replaced_by: null,
      created: 1,
    };

    function ExpectNoForeignIds(error: AppError): void {
      for (const id of [
        'pob_z_foreign',
        'po_z_foreign_1',
        'acct_z_other',
        '0xforeign_batch',
      ]) {
        expect(error.message).not.toContain(id);
      }
    }

    it.each(['built', 'broadcast'])(
      'blocks a build behind a %s batch of another platform without naming it, even with replace',
      async (status) => {
        const foreign = { ...FOREIGN, status };
        memory.Seed('PayoutBatches', foreign);

        for (const replace of [undefined, true]) {
          const error = await Rejection(Build(IDS.slice(0, 2), replace));
          expect(error).toMatchObject({
            statusCode: 409,
            type: 'payout_batch_in_progress',
          });
          ExpectNoForeignIds(error);
        }
        expect(settlement.BuildBatchPayoutTransaction).not.toHaveBeenCalled();
        expect(Batches()).toEqual([foreign]);
      }
    );

    it('does not name another platform’s batch that holds the requested payouts', async () => {
      memory.Seed('PayoutBatches', {
        ...FOREIGN,
        wallet_address: RECIPIENTS[2],
        status: 'built',
        payouts: ['po_z_1'],
      });

      const build = await Rejection(Build(['po_z_1']));
      const cancel = await Rejection(module.CancelPayout('po_z_1'));

      for (const error of [build, cancel]) {
        expect(error.statusCode).toBe(409);
        ExpectNoForeignIds(error);
      }
    });

    it('broadcast ignores another platform’s batch on the same wallet', async () => {
      const foreign = {
        ...FOREIGN,
        status: 'broadcast',
        payouts: ['po_z_1', 'po_z_2'],
      };
      memory.Seed('PayoutBatches', foreign);

      const signed = await Rejection(BroadcastSigned());
      const byHash = await Rejection(BroadcastHash(IDS.slice(0, 2)));

      for (const error of [signed, byHash]) {
        expect(error).toMatchObject({
          statusCode: 409,
          type: 'payout_batch_mismatch',
        });
        ExpectNoForeignIds(error);
      }
      expect(settlement.MatchPayoutTransaction).not.toHaveBeenCalled();
      expect(settlement.BroadcastSignedTransaction).not.toHaveBeenCalled();
      expect(Batches()).toEqual([foreign]);
      expect(Statuses().po_z_1).toBe('pending');
    });

    it('reconcile ignores another platform’s batch', async () => {
      const foreign = { ...FOREIGN, status: 'broadcast' };
      memory.Seed('PayoutBatches', foreign);
      settlement.GetAccountNonce.mockResolvedValue(MOCK_PAYOUT_NONCE + 1);

      await expect(
        module.ReconcilePayoutBatches('acct_z_platform')
      ).resolves.toEqual({
        object: 'payout_reconcile',
        reconciled: 0,
        paid: 0,
        failed: 0,
        pending: 0,
      });
      expect(settlement.GetAccountNonce).not.toHaveBeenCalled();
      expect(Batches()).toEqual([foreign]);
    });
  });

  describe('CancelPayout', () => {
    it('refuses to cancel a payout held by an outstanding batch', async () => {
      await Build();

      const error = await Rejection(module.CancelPayout('po_z_1'));

      expect(error).toMatchObject({
        statusCode: 409,
        type: 'payout_batch_in_progress',
      });
      expect(Statuses().po_z_1).toBe('pending');
      expect(AvailableBalance()).toBe(0);
    });
  });
});
