// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  parseTransaction,
  recoverTransactionAddress,
  serializeTransaction,
  type Hex,
  type TransactionSerialized,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type {
  PayoutBatchBroadcastResponse,
  PayoutBatchBuildResponse,
} from '@zoneless/shared-types';
import { Payouts } from '../resources/Payouts';
import {
  HttpClient,
  ZonelessApiError,
  ZonelessPayoutBatchError,
} from '../HttpClient';

/** Anvil default account #0 (public test key). */
const PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const SIGNER = privateKeyToAccount(PRIVATE_KEY).address;
const PAYOUT_BATCH = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const USDC = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const CHAIN_ID = 11155111;

function Unsigned(overrides: { to?: Hex; chainId?: number } = {}): Hex {
  return serializeTransaction({
    type: 'eip1559',
    chainId: overrides.chainId ?? CHAIN_ID,
    nonce: 3,
    to: overrides.to ?? PAYOUT_BATCH,
    data: '0xabcdef',
    value: BigInt(0),
    gas: BigInt(120000),
    maxFeePerGas: BigInt(20000000000),
    maxPriorityFeePerGas: BigInt(1000000000),
  });
}

function Build(
  overrides: Partial<PayoutBatchBuildResponse> = {}
): PayoutBatchBuildResponse {
  return {
    object: 'payout_batch_build',
    payout_batch: 'pob_z_1',
    replaced_payout_batch: null,
    unsigned_transaction: Unsigned(),
    estimated_fee: '2400000000000000',
    fee_currency: 'eth',
    chain_id: CHAIN_ID,
    nonce: 3,
    to: PAYOUT_BATCH,
    gas_limit: '120000',
    max_fee_per_gas: '20000000000',
    max_priority_fee_per_gas: '1000000000',
    deadline: 1761600600,
    release_after: 1761600624,
    transaction_type: 'payout',
    batch_id: `0x${'11'.repeat(32)}`,
    payouts: [],
    total_amount: 0,
    recipients_count: 0,
    ...overrides,
  };
}

function ApprovalBuild(): PayoutBatchBuildResponse {
  return Build({
    payout_batch: 'pob_z_approval',
    unsigned_transaction: Unsigned({ to: USDC }),
    to: USDC,
    deadline: null,
    release_after: null,
    transaction_type: 'approval',
    batch_id: null,
  });
}

function Broadcast(
  overrides: Partial<PayoutBatchBroadcastResponse> = {}
): PayoutBatchBroadcastResponse {
  return {
    object: 'payout_batch_broadcast',
    transaction_hash: `0x${'ab'.repeat(32)}`,
    status: 'paid',
    transaction_type: 'payout',
    viewer_url: '',
    payouts: [],
    ...overrides,
  };
}

async function SignerOf(signed: Hex): Promise<string> {
  return recoverTransactionAddress({
    serializedTransaction: signed as TransactionSerialized,
  });
}

describe('Payouts Resource', () => {
  const Get = jest.fn();
  const Post = jest.fn();
  const payouts = new Payouts({ Get, Post } as unknown as HttpClient);

  /** Posts in order, without the request options. */
  const Posts = () => Post.mock.calls.map(([path, body]) => [path, body]);

  beforeEach(() => {
    Get.mockReset();
    Post.mockReset();
  });

  describe('processBatch', () => {
    const pending = [
      { id: 'po_z_1', amount: 1000 },
      { id: 'po_z_2', amount: 500 },
    ];

    beforeEach(() => {
      Get.mockResolvedValue({ object: 'list', data: pending, has_more: false });
    });

    it('should broadcast only the signed transaction and payout ids', async () => {
      Post.mockImplementation(async (path: string) =>
        path === '/payouts/build'
          ? Build({
              unsigned_transaction: 'sim_tx',
              estimated_fee: '0',
              fee_currency: 'none',
              chain_id: null,
              nonce: null,
              to: null,
              payouts: pending as never,
              total_amount: 1500,
              recipients_count: 2,
            })
          : Broadcast({
              transaction_hash: 'tx_hash_1',
              payouts: pending as never,
            })
      );

      const result = await payouts.processBatch(PRIVATE_KEY);

      expect(Get).toHaveBeenCalledWith(
        '/payouts',
        expect.objectContaining({ status: 'pending', limit: 100 }),
        undefined
      );
      expect(Post).toHaveBeenCalledWith(
        '/payouts/build',
        { payouts: ['po_z_1', 'po_z_2'] },
        undefined
      );
      const broadcastCall = Post.mock.calls.find(
        ([path]) => path === '/payouts/broadcast'
      );
      // Strict: keys present with undefined values must fail too.
      expect(broadcastCall?.[1]).toStrictEqual({
        signed_transaction: 'sim_tx',
        payouts: ['po_z_1', 'po_z_2'],
      });
      expect(result).toEqual({
        transaction_hash: 'tx_hash_1',
        status: 'paid',
        transaction_type: 'payout',
        viewer_url: '',
        payouts: pending,
        total_amount: 1500,
        has_more: false,
        failure_message: undefined,
      });
      expect(result).not.toHaveProperty('signature');
    });

    it('should return an empty transaction_hash when nothing is pending', async () => {
      Get.mockResolvedValue({ object: 'list', data: [], has_more: false });

      const result = await payouts.processBatch(PRIVATE_KEY);

      expect(Post).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        transaction_hash: '',
        status: 'paid',
        transaction_type: 'payout',
        payouts: [],
        has_more: false,
      });
    });

    it('caps the batch at 100 payouts', async () => {
      Get.mockResolvedValue({ object: 'list', data: [], has_more: false });

      await payouts.processBatch(PRIVATE_KEY, { limit: 500 });

      expect(Get).toHaveBeenCalledWith(
        '/payouts',
        expect.objectContaining({ limit: 100 }),
        undefined
      );
    });

    it('signs and broadcasts the one-time approval, then builds and pays the payouts', async () => {
      Post.mockResolvedValueOnce(ApprovalBuild())
        .mockResolvedValueOnce(
          Broadcast({ transaction_type: 'approval', transaction_hash: '0xa1' })
        )
        .mockResolvedValueOnce(
          Build({ payouts: pending as never, total_amount: 1500 })
        )
        .mockResolvedValueOnce(
          Broadcast({ transaction_hash: '0xb2', payouts: pending as never })
        );

      const result = await payouts.processBatch(PRIVATE_KEY, {
        expectedSigner: SIGNER,
      });

      const posts = Posts();
      expect(posts.map(([path]) => path)).toEqual([
        '/payouts/build',
        '/payouts/broadcast',
        '/payouts/build',
        '/payouts/broadcast',
      ]);
      expect(posts[0][1]).toStrictEqual({ payouts: ['po_z_1', 'po_z_2'] });
      expect(posts[1][1]).toStrictEqual({
        signed_transaction: expect.any(String),
        payouts: [],
      });
      expect(posts[2][1]).toStrictEqual({ payouts: ['po_z_1', 'po_z_2'] });
      expect(posts[3][1]).toStrictEqual({
        signed_transaction: expect.any(String),
        payouts: ['po_z_1', 'po_z_2'],
      });

      const approval = posts[1][1].signed_transaction as Hex;
      const payout = posts[3][1].signed_transaction as Hex;
      await expect(SignerOf(approval)).resolves.toBe(SIGNER);
      expect(parseTransaction(approval).to).toBe(USDC.toLowerCase());
      expect(parseTransaction(payout).to).toBe(PAYOUT_BATCH.toLowerCase());
      expect(result).toMatchObject({
        transaction_hash: '0xb2',
        status: 'paid',
        transaction_type: 'payout',
        total_amount: 1500,
      });
    });

    it('stops with a pending result when the approval is not confirmed yet', async () => {
      Post.mockResolvedValueOnce(ApprovalBuild()).mockResolvedValueOnce(
        Broadcast({
          transaction_type: 'approval',
          transaction_hash: '0xa1',
          status: 'pending',
        })
      );

      const result = await payouts.processBatch(PRIVATE_KEY);

      expect(Posts().map(([path]) => path)).toEqual([
        '/payouts/build',
        '/payouts/broadcast',
      ]);
      expect(result).toEqual({
        transaction_hash: '0xa1',
        status: 'pending',
        transaction_type: 'approval',
        viewer_url: '',
        payouts: [],
        total_amount: 0,
        has_more: true,
        failure_message: undefined,
      });
    });

    it('refuses a second approval after the first was confirmed', async () => {
      Post.mockResolvedValueOnce(ApprovalBuild())
        .mockResolvedValueOnce(Broadcast({ transaction_type: 'approval' }))
        .mockResolvedValueOnce(ApprovalBuild());

      await expect(payouts.processBatch(PRIVATE_KEY)).rejects.toThrow(
        'Build still asks for an approval after the approval was confirmed'
      );
      expect(Posts()).toHaveLength(3);
    });

    it('re-prices the outstanding batch only on the first build when replace is set', async () => {
      Post.mockResolvedValueOnce(ApprovalBuild())
        .mockResolvedValueOnce(Broadcast({ transaction_type: 'approval' }))
        .mockResolvedValueOnce(Build({ payouts: pending as never }))
        .mockResolvedValueOnce(Broadcast());

      await payouts.processBatch(PRIVATE_KEY, { replace: true });

      const builds = Posts().filter(([path]) => path === '/payouts/build');
      expect(builds[0][1]).toStrictEqual({
        payouts: ['po_z_1', 'po_z_2'],
        replace: true,
      });
      expect(builds[1][1]).toStrictEqual({ payouts: ['po_z_1', 'po_z_2'] });
    });

    it('never forwards an idempotency key to its several requests', async () => {
      Post.mockResolvedValueOnce(Build()).mockResolvedValueOnce(Broadcast());

      await payouts.processBatch(PRIVATE_KEY, {
        requestOptions: { idempotencyKey: 'once', zonelessAccount: 'acct_1' },
      });

      for (const [, , options] of Post.mock.calls) {
        expect(options).toEqual({ zonelessAccount: 'acct_1' });
      }
    });

    it('surfaces a build conflict as a typed error with its code', async () => {
      Post.mockRejectedValue(
        new ZonelessApiError({
          type: 'payout_batch_in_progress',
          message: 'Payout batch pob_z_9 is built; build with replace: true',
          statusCode: 409,
        })
      );

      const error = await payouts.processBatch(PRIVATE_KEY).catch((e) => e);

      expect(error).toBeInstanceOf(ZonelessPayoutBatchError);
      expect(error).toBeInstanceOf(ZonelessApiError);
      expect(error).toMatchObject({
        code: 'payout_batch_in_progress',
        type: 'payout_batch_in_progress',
        statusCode: 409,
        message: 'Payout batch pob_z_9 is built; build with replace: true',
      });
    });
  });

  describe('processAll', () => {
    it('stops at the first result that is not paid and returns it with has_more', async () => {
      Get.mockResolvedValue({
        object: 'list',
        data: [{ id: 'po_z_1' }],
        has_more: true,
      });
      Post.mockResolvedValueOnce(Build())
        .mockResolvedValueOnce(Broadcast({ transaction_hash: '0x01' }))
        .mockResolvedValueOnce(Build())
        .mockResolvedValueOnce(
          Broadcast({ transaction_hash: '0x02', status: 'pending' })
        );

      const results = await payouts.processAll(PRIVATE_KEY, {
        delayBetweenBatchesMs: 0,
      });

      expect(results.map((r) => [r.transaction_hash, r.status])).toEqual([
        ['0x01', 'paid'],
        ['0x02', 'pending'],
      ]);
      expect(results[1].has_more).toBe(true);
      expect(Post).toHaveBeenCalledTimes(4);
    });

    it('keeps a pending approval in the results', async () => {
      Get.mockResolvedValue({
        object: 'list',
        data: [{ id: 'po_z_1' }],
        has_more: false,
      });
      Post.mockResolvedValueOnce(ApprovalBuild()).mockResolvedValueOnce(
        Broadcast({ transaction_type: 'approval', status: 'pending' })
      );

      const results = await payouts.processAll(PRIVATE_KEY);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        status: 'pending',
        transaction_type: 'approval',
        has_more: true,
      });
    });
  });

  describe('ensureAllowance', () => {
    it('returns the payout build when no approval is needed', async () => {
      const build = Build();
      Post.mockResolvedValueOnce(build);

      await expect(
        payouts.ensureAllowance(PRIVATE_KEY, { payouts: ['po_z_1'] })
      ).resolves.toEqual({ build, approval: null });
      expect(Post).toHaveBeenCalledTimes(1);
    });

    it('returns no build while the approval failed', async () => {
      const approval = Broadcast({
        transaction_type: 'approval',
        status: 'failed',
        failure_message: 'The approval reverted',
      });
      Post.mockResolvedValueOnce(ApprovalBuild()).mockResolvedValueOnce(
        approval
      );

      await expect(
        payouts.ensureAllowance(PRIVATE_KEY, { payouts: ['po_z_1'] })
      ).resolves.toEqual({ build: null, approval });
    });
  });

  describe('reconcile', () => {
    it('posts to /payouts/reconcile and returns the counts', async () => {
      const counts = {
        object: 'payout_reconcile',
        reconciled: 2,
        paid: 1,
        failed: 0,
        pending: 1,
      };
      Post.mockResolvedValue(counts);

      await expect(payouts.reconcile()).resolves.toEqual(counts);
      expect(Post).toHaveBeenCalledWith('/payouts/reconcile', {}, undefined);
    });
  });

  describe('broadcast', () => {
    it('surfaces transaction_not_found as a typed error', async () => {
      Post.mockRejectedValue(
        new ZonelessApiError({
          type: 'transaction_not_found',
          message: 'Transaction 0xab is not visible on the network yet',
          statusCode: 409,
        })
      );

      await expect(
        payouts.broadcast({
          transaction_hash: `0x${'ab'.repeat(32)}`,
          payouts: [],
        })
      ).rejects.toMatchObject({
        name: 'ZonelessPayoutBatchError',
        code: 'transaction_not_found',
      });
    });

    it('leaves other API errors untyped', async () => {
      const validation = new ZonelessApiError({
        type: 'invalid_request_error',
        message:
          'Provide exactly one of signed_transaction or transaction_hash',
        statusCode: 400,
      });
      Post.mockRejectedValue(validation);

      await expect(payouts.broadcast({ payouts: [] } as never)).rejects.toBe(
        validation
      );
    });
  });

  describe('sign', () => {
    it('signs the built EIP-1559 transaction with the private key', async () => {
      const signed = await payouts.sign(Build(), PRIVATE_KEY, {
        expectedSigner: SIGNER,
      });

      await expect(SignerOf(signed)).resolves.toBe(SIGNER);
      expect(parseTransaction(signed)).toMatchObject({
        chainId: CHAIN_ID,
        nonce: 3,
        to: PAYOUT_BATCH.toLowerCase(),
        data: '0xabcdef',
      });
    });

    it('rejects a transaction whose target differs from build.to', async () => {
      await expect(
        payouts.sign(
          Build({ unsigned_transaction: Unsigned({ to: USDC }) }),
          PRIVATE_KEY
        )
      ).rejects.toThrow(
        'Unsigned transaction does not target the expected contract'
      );
    });

    it('rejects a transaction for another chain than build.chain_id', async () => {
      await expect(
        payouts.sign(
          Build({ unsigned_transaction: Unsigned({ chainId: 1 }) }),
          PRIVATE_KEY
        )
      ).rejects.toThrow('Unsigned transaction is for a different chain');
    });

    it('rejects a key that is not the expected signer', async () => {
      await expect(
        payouts.sign(Build(), PRIVATE_KEY, {
          expectedSigner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        })
      ).rejects.toThrow('Private key does not match the expected signer');
    });

    it('passes simulated transactions through unsigned', async () => {
      await expect(
        payouts.sign(
          Build({ unsigned_transaction: 'sim_tx', to: null, chain_id: null }),
          PRIVATE_KEY
        )
      ).resolves.toBe('sim_tx');
    });
  });
});
