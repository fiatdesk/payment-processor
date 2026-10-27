// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  BaseError,
  decodeFunctionData,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  keccak256,
  HttpRequestError,
  parseTransaction,
  RawContractError,
  serializeTransaction,
  TransactionReceiptNotFoundError,
  type Hex,
  type Log,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Ethereum, NotSupported, ReplacementFees } from './Ethereum';
import * as Chain from './Chain';
import { GetChainConfig, ResetChainClientsForTests } from './Chain';
import { PAYOUT_BATCH_ABI } from './abi/PayoutBatch';
import { CHAIN_CONTRACTS } from './contracts';
import { ComputeBatchId, EncodeDisperseCall } from './PayoutEncoding';
import type { Settlement } from './Settlement';
import type { PayoutTransactionExpectation } from './types';
import { AppError } from '../../utils/AppError';

const CHAIN_ENV_KEYS = [
  'LIVEMODE',
  'SETTLEMENT_RAIL',
  'ETH_CHAIN_ID',
  'ETH_RPC_URL',
  'ETH_CONFIRMATIONS',
  'USDC_ADDRESS',
  'PAYOUT_BATCH_ADDRESS',
  'SUBSCRIPTIONS_ADDRESS',
  'SANCTIONS_ORACLE_ADDRESS',
] as const;

const ANVIL_USDC: Hex = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const PAYOUT_BATCH: Hex = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
/** Anvil accounts #1 (platform) and #2 (public test keys). */
const PLATFORM_KEY: Hex =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const OTHER_KEY: Hex =
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
const PLATFORM = privateKeyToAccount(PLATFORM_KEY).address;
const RECIPIENT = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

const batchId = ComputeBatchId(['po_z_1']);
const built = {
  type: 'eip1559' as const,
  chainId: 31337,
  nonce: 4,
  to: PAYOUT_BATCH,
  data: EncodeDisperseCall(
    ANVIL_USDC,
    [{ destinationAddress: RECIPIENT, amountInCents: 500 }],
    batchId,
    1_700_001_800n
  ),
  value: 0n,
  gas: 90_000n,
  maxFeePerGas: 3_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
};
const expected: PayoutTransactionExpectation = {
  wallet: PLATFORM,
  chainId: 31337,
  nonce: 4,
  unsignedTransaction: serializeTransaction(built),
  transactionType: 'payout',
  batchId,
  recipientsCount: 1,
  totalCents: 500,
  fromBlock: 10,
};

function SetChainEnv(
  env: Partial<Record<(typeof CHAIN_ENV_KEYS)[number], string>>
) {
  for (const key of CHAIN_ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  ResetChainClientsForTests();
}

describe('Ethereum rail', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    ResetChainClientsForTests();
  });

  describe('Describe', () => {
    it('describes an Anvil chain with an injected USDC address', () => {
      SetChainEnv({
        LIVEMODE: 'false',
        SETTLEMENT_RAIL: 'onchain',
        ETH_CHAIN_ID: '31337',
        USDC_ADDRESS: ANVIL_USDC.toLowerCase(),
      });

      expect(new Ethereum().Describe()).toEqual({
        rail: 'onchain',
        network: 'ethereum',
        chain_id: 31337,
        native_currency: 'eth',
        token_address: ANVIL_USDC,
      });
    });

    it('defaults test mode to Sepolia USDC', () => {
      SetChainEnv({ LIVEMODE: 'false', SETTLEMENT_RAIL: 'onchain' });

      expect(new Ethereum().Describe()).toMatchObject({
        chain_id: 11155111,
        token_address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      });
    });

    it('uses mainnet USDC in live mode', () => {
      SetChainEnv({ LIVEMODE: 'true' });

      expect(new Ethereum().Describe()).toMatchObject({
        chain_id: 1,
        token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      });
    });
  });

  describe('ExplorerUrl', () => {
    it('is empty on Anvil', () => {
      SetChainEnv({ ETH_CHAIN_ID: '31337', USDC_ADDRESS: ANVIL_USDC });

      expect(new Ethereum().ExplorerUrl('tx', '0xab')).toBe('');
    });

    it('links to Sepolia Etherscan in test mode', () => {
      SetChainEnv({ LIVEMODE: 'false' });

      expect(new Ethereum().ExplorerUrl('tx', '0xab')).toBe(
        'https://sepolia.etherscan.io/tx/0xab'
      );
    });

    it('links to Etherscan in live mode', () => {
      SetChainEnv({ LIVEMODE: 'true' });

      expect(new Ethereum().ExplorerUrl('address', '0xab')).toBe(
        'https://etherscan.io/address/0xab'
      );
    });

    it('does not need an RPC URL', () => {
      SetChainEnv({ LIVEMODE: 'false', SETTLEMENT_RAIL: 'onchain' });

      expect(() => new Ethereum().ExplorerUrl('tx', '0xab')).not.toThrow();
    });
  });

  describe('CheckWalletExists', () => {
    const ethereum = new Ethereum();

    it.each([
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
    ])('accepts %s', async (address) => {
      await expect(ethereum.CheckWalletExists(address)).resolves.toBe(true);
    });

    it.each([
      '0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      // All-uppercase hex fails viem's strict checksum check (correction C2).
      '0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266',
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb9226',
      'D8VMZCmmTUUfhejNhNQKAmqvZCKfUq1qU6RqQKxQwXyX',
      '',
    ])('rejects %s', async (address) => {
      await expect(ethereum.CheckWalletExists(address)).resolves.toBe(false);
    });
  });

  describe('money flows', () => {
    it('rejects checkout builds with not_supported', async () => {
      SetChainEnv({ LIVEMODE: 'false', SETTLEMENT_RAIL: 'onchain' });
      const ethereum: Settlement = new Ethereum();

      await expect(
        ethereum.BuildCheckoutPaymentTransaction(
          '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          500,
          'cs_z_1'
        )
      ).rejects.toMatchObject({
        statusCode: 501,
        type: 'not_supported',
        message:
          'BuildCheckoutPaymentTransaction is not available on this settlement rail yet',
      });
    });

    it('builds a 501 not_supported AppError', () => {
      const error = NotSupported('VerifyCheckoutPayment');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        statusCode: 501,
        type: 'not_supported',
        message:
          'VerifyCheckoutPayment is not available on this settlement rail yet',
      });
    });

    it('needs a PayoutBatch address before building payouts', async () => {
      SetChainEnv({ LIVEMODE: 'false', SETTLEMENT_RAIL: 'onchain' });

      await expect(
        new Ethereum().BuildBatchPayoutTransaction(
          PLATFORM,
          [{ destinationAddress: RECIPIENT, amountInCents: 500 }],
          { batchId: ComputeBatchId(['po_z_1']) }
        )
      ).rejects.toMatchObject({
        statusCode: 501,
        type: 'not_supported',
        message: 'Payouts need PAYOUT_BATCH_ADDRESS on chain 11155111',
      });
    });
  });

  describe('payout transactions (no RPC)', () => {
    const ethereum = new Ethereum();
    const Sign = (key: Hex, overrides: Partial<typeof built> = {}) =>
      privateKeyToAccount(key).signTransaction({ ...built, ...overrides });

    it('matches the built transaction signed by the platform wallet', async () => {
      const signed = await Sign(PLATFORM_KEY);

      await expect(
        ethereum.MatchPayoutTransaction(signed, expected)
      ).resolves.toEqual({
        status: 'match',
        transactionHash: keccak256(signed),
        nonce: 4,
      });
      expect(ethereum.GetTransactionHash(signed)).toBe(keccak256(signed));
    });

    it('accepts different fees, as a re-signed or re-priced transaction', async () => {
      const signed = await Sign(PLATFORM_KEY, { maxFeePerGas: 9_000_000_000n });

      await expect(
        ethereum.MatchPayoutTransaction(signed, expected)
      ).resolves.toMatchObject({ status: 'match' });
    });

    it.each([
      ['another signer', OTHER_KEY, {}, /not the platform wallet/],
      ['another nonce', PLATFORM_KEY, { nonce: 5 }, /nonce 5/],
      ['another chain', PLATFORM_KEY, { chainId: 1 }, /chain 1/],
      ['another contract', PLATFORM_KEY, { to: ANVIL_USDC }, /calls/],
      [
        'other calldata',
        PLATFORM_KEY,
        { data: '0xdeadbeef' as Hex },
        /calldata/,
      ],
    ])(
      'rejects a transaction with %s',
      async (_label, key, overrides, reason) => {
        const signed = await Sign(key, overrides);

        await expect(
          ethereum.MatchPayoutTransaction(signed, expected)
        ).resolves.toEqual({
          status: 'mismatch',
          reason: expect.stringMatching(reason),
        });
      }
    );

    it('rejects an unsigned or malformed transaction', async () => {
      await expect(
        ethereum.MatchPayoutTransaction(expected.unsignedTransaction, expected)
      ).resolves.toMatchObject({
        status: 'mismatch',
        reason: 'the transaction is not signed',
      });
      await expect(
        ethereum.MatchPayoutTransaction('0x1234', expected)
      ).resolves.toMatchObject({ status: 'mismatch' });
    });

    it('normalises a hash and recognises nothing else', () => {
      const hash = `0x${'AB'.repeat(32)}`;

      expect(ethereum.GetTransactionHash(hash)).toBe(hash.toLowerCase());
      expect(ethereum.GetTransactionHash('sim_tx')).toBeNull();
    });
  });

  describe('payout settlement gates (mocked RPC)', () => {
    const HASH: Hex = `0x${'aa'.repeat(32)}`;
    const OTHER_HASH: Hex = `0x${'bb'.repeat(32)}`;
    const CONFIRMED = 60;
    const client = {
      getBlock: jest.fn(),
      multicall: jest.fn(),
      estimateGas: jest.fn(),
      estimateMaxPriorityFeePerGas: jest.fn(),
      getBlockNumber: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getTransaction: jest.fn(),
      getTransactionCount: jest.fn(),
      getLogs: jest.fn(),
      readContract: jest.fn(),
      call: jest.fn(),
      sendRawTransaction: jest.fn(),
      waitForTransactionReceipt: jest.fn(),
    };
    let ethereum: Ethereum;

    beforeEach(() => {
      SetChainEnv({
        LIVEMODE: 'false',
        SETTLEMENT_RAIL: 'onchain',
        ETH_CHAIN_ID: '31337',
        ETH_CONFIRMATIONS: '1',
        USDC_ADDRESS: ANVIL_USDC,
        PAYOUT_BATCH_ADDRESS: PAYOUT_BATCH,
      });
      for (const method of Object.values(client)) method.mockReset();
      jest
        .spyOn(Chain, 'GetPublicClient')
        .mockReturnValue(client as unknown as PublicClient);
      ethereum = new Ethereum();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function BatchPaidLog(
      overrides: { count?: bigint; total?: bigint; address?: Hex } = {}
    ): Log {
      return {
        address: overrides.address ?? PAYOUT_BATCH,
        topics: encodeEventTopics({
          abi: PAYOUT_BATCH_ABI,
          eventName: 'BatchPaid',
          args: { payer: PLATFORM, token: ANVIL_USDC, batchId },
        }) as Log['topics'],
        data: encodeAbiParameters(
          [{ type: 'uint256' }, { type: 'uint256' }],
          [overrides.count ?? 1n, overrides.total ?? 5_000_000n]
        ),
        blockHash: null,
        blockNumber: 55n,
        logIndex: 0,
        transactionHash: OTHER_HASH,
        transactionIndex: 0,
        removed: false,
        // getLogs with an `event` also returns the decoded arguments.
        args: {
          payer: PLATFORM,
          token: ANVIL_USDC,
          batchId,
          count: overrides.count ?? 1n,
          total: overrides.total ?? 5_000_000n,
        },
      } as Log;
    }

    function Receipt(overrides: Record<string, unknown> = {}) {
      return {
        transactionHash: HASH,
        from: PLATFORM.toLowerCase(),
        to: PAYOUT_BATCH.toLowerCase(),
        status: 'success',
        blockNumber: 50n,
        logs: [BatchPaidLog()],
        ...overrides,
      };
    }

    /** A node error carrying revert data, as viem surfaces it from eth_call. */
    function Revert(data: Hex): BaseError {
      return new BaseError('Execution reverted', {
        cause: new RawContractError({ data }),
      });
    }

    const BLACKLISTED = Revert(
      encodeErrorResult({
        abi: [{ type: 'error', name: 'Error', inputs: [{ type: 'string' }] }],
        errorName: 'Error',
        args: ['Blacklistable: account is blacklisted'],
      })
    );
    const ALREADY_PAID = Revert(
      encodeErrorResult({
        abi: PAYOUT_BATCH_ABI,
        errorName: 'BatchAlreadyPaid',
      })
    );

    const Status = (receipt: Record<string, unknown>) => {
      client.getTransactionReceipt.mockResolvedValue(receipt);
      return ethereum.GetTransactionStatus(HASH, expected, CONFIRMED);
    };

    it('settles paid from a confirmed receipt with the matching BatchPaid log', async () => {
      await expect(Status(Receipt())).resolves.toMatchObject({
        status: 'paid',
        transaction_hash: HASH,
      });
    });

    it.each([
      ['another sender', { from: RECIPIENT }],
      ['another contract', { to: ANVIL_USDC }],
      ['no BatchPaid log', { logs: [] }],
      [
        'a BatchPaid log with another count',
        { logs: [BatchPaidLog({ count: 2n })] },
      ],
      [
        'a BatchPaid log with another total',
        { logs: [BatchPaidLog({ total: 1n })] },
      ],
    ])('stays pending for a success with %s', async (_label, overrides) => {
      await expect(Status(Receipt(overrides))).resolves.toMatchObject({
        status: 'pending',
      });
    });

    it('stays pending for a revert of other calldata, without replaying it', async () => {
      client.getTransaction.mockResolvedValue({ input: '0xdeadbeef' });

      await expect(
        Status(Receipt({ status: 'reverted' }))
      ).resolves.toMatchObject({ status: 'pending' });
      expect(client.call).not.toHaveBeenCalled();
    });

    it('fails a revert of the batch call with its decoded reason', async () => {
      client.getTransaction.mockResolvedValue({
        from: PLATFORM,
        to: PAYOUT_BATCH,
        input: built.data,
        gas: 90_000n,
        value: 0n,
      });
      client.call.mockRejectedValue(BLACKLISTED);

      await expect(Status(Receipt({ status: 'reverted' }))).resolves.toEqual({
        transaction_hash: HASH,
        status: 'failed',
        viewer_url: '',
        failure_code: 'account_frozen',
        failure_message: 'Blacklistable: account is blacklisted',
      });
      expect(client.call).toHaveBeenCalledWith(
        expect.objectContaining({ blockNumber: 50n })
      );
    });

    it('settles a BatchAlreadyPaid revert as paid by the transaction that paid it', async () => {
      client.getTransaction.mockResolvedValue({ input: built.data });
      client.call.mockRejectedValue(ALREADY_PAID);
      client.readContract.mockResolvedValue(true);
      client.getLogs.mockResolvedValue([BatchPaidLog()]);

      await expect(
        Status(Receipt({ status: 'reverted' }))
      ).resolves.toMatchObject({
        status: 'paid',
        transaction_hash: OTHER_HASH,
      });
      expect(client.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'paid', blockNumber: 50n })
      );
    });

    it('never fails a BatchAlreadyPaid revert, even when paid() disagrees', async () => {
      client.getTransaction.mockResolvedValue({ input: built.data });
      client.call.mockRejectedValue(ALREADY_PAID);
      client.readContract.mockResolvedValue(false);

      await expect(
        Status(Receipt({ status: 'reverted' }))
      ).resolves.toMatchObject({ status: 'pending' });
    });

    it('gates receipts on the confirmed block it is given', async () => {
      await expect(
        Status(Receipt({ blockNumber: BigInt(CONFIRMED + 1) }))
      ).resolves.toMatchObject({ status: 'pending' });
      await expect(
        Status(Receipt({ blockNumber: BigInt(CONFIRMED) }))
      ).resolves.toMatchObject({ status: 'paid' });
      expect(client.getBlockNumber).not.toHaveBeenCalled();
    });

    it('is pending while there is no receipt', async () => {
      client.getTransactionReceipt.mockRejectedValue(
        new TransactionReceiptNotFoundError({ hash: HASH })
      );

      await expect(
        ethereum.GetTransactionStatus(HASH, expected, CONFIRMED)
      ).resolves.toMatchObject({ status: 'pending' });
    });

    it('finds a payment only from a BatchPaid log with the batch count, total and contract', async () => {
      client.getLogs.mockResolvedValue([
        BatchPaidLog({ count: 2n }),
        BatchPaidLog({ total: 1n }),
        BatchPaidLog({ address: ANVIL_USDC }),
      ]);
      await expect(
        ethereum.FindBatchPayment(expected, CONFIRMED)
      ).resolves.toBeNull();

      client.getLogs.mockResolvedValue([
        { ...BatchPaidLog(), address: PAYOUT_BATCH.toLowerCase() },
      ]);
      await expect(
        ethereum.FindBatchPayment(expected, CONFIRMED)
      ).resolves.toMatchObject({
        status: 'paid',
        transaction_hash: OTHER_HASH,
      });
      expect(client.getLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ fromBlock: 10n, toBlock: BigInt(CONFIRMED) })
      );
    });

    it('refuses a log search that ends before the build block', async () => {
      await expect(ethereum.FindBatchPayment(expected, 9)).rejects.toThrow(
        /before the batch was built/
      );
      expect(client.getLogs).not.toHaveBeenCalled();
    });

    it('reads the head once; later reads use that block even if the node falls behind', async () => {
      client.getBlockNumber
        .mockResolvedValueOnce(100n)
        .mockResolvedValueOnce(90n);
      client.getBlock.mockResolvedValue({ number: 99n, timestamp: 5_000n });
      client.getTransactionCount.mockResolvedValue(5);
      client.readContract.mockResolvedValue(false);
      client.getLogs.mockResolvedValue([]);

      const confirmed = await ethereum.GetConfirmedBlock();
      await ethereum.GetAccountNonce(PLATFORM, confirmed.number);
      await ethereum.IsBatchPaid(expected, confirmed.number);
      await ethereum.FindBatchPayment(expected, confirmed.number);

      expect(confirmed).toEqual({ number: 99, timestamp: 5_000 });
      expect(client.getBlock).toHaveBeenCalledWith({ blockNumber: 99n });
      expect(client.getBlockNumber).toHaveBeenCalledTimes(1);
      expect(client.getTransactionCount).toHaveBeenCalledWith({
        address: PLATFORM,
        blockNumber: 99n,
      });
      expect(client.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ blockNumber: 99n })
      );
      expect(client.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({ toBlock: 99n })
      );
    });

    it('leaves a reverted receipt unsettled when the replay fails without a revert', async () => {
      client.getTransaction.mockResolvedValue({ input: built.data });
      client.call.mockRejectedValue(
        new HttpRequestError({ url: 'http://127.0.0.1:8545' })
      );

      await expect(
        Status(Receipt({ status: 'reverted' }))
      ).rejects.toBeInstanceOf(HttpRequestError);

      client.waitForTransactionReceipt.mockResolvedValue(
        Receipt({ status: 'reverted' })
      );
      await expect(
        ethereum.WaitForReceipt(HASH, expected)
      ).resolves.toMatchObject({ status: 'pending' });
    });

    it('builds the batch with a deadline from chain time', async () => {
      client.readContract.mockResolvedValue(6); // decimals
      client.multicall.mockResolvedValue([10n ** 12n, 2n ** 255n, false]);
      client.getBlock.mockResolvedValue({
        number: 40n,
        timestamp: 1_000n,
        baseFeePerGas: 10n,
      });
      client.estimateGas.mockResolvedValue(50_000n);
      client.estimateMaxPriorityFeePerGas.mockResolvedValue(2n);
      client.getTransactionCount.mockResolvedValue(3);

      const batch = await ethereum.BuildBatchPayoutTransaction(
        PLATFORM,
        [{ destinationAddress: RECIPIENT, amountInCents: 500 }],
        { batchId, deadlineSeconds: 600 }
      );

      expect(batch).toMatchObject({
        transaction_type: 'payout',
        deadline: 1_600,
        release_after: 1_612,
        nonce: 3,
        gas_limit: '60000',
        max_fee_per_gas: '22',
      });
      const { data } = parseTransaction(batch.unsigned_transaction as Hex);
      expect(
        decodeFunctionData({ abi: PAYOUT_BATCH_ABI, data: data as Hex }).args
      ).toEqual([ANVIL_USDC, [RECIPIENT], [5_000_000n], batchId, 1_600n]);
    });

    it('refuses to build a batch id the wallet already paid on-chain', async () => {
      client.readContract.mockResolvedValue(6);
      client.multicall.mockResolvedValue([10n ** 12n, 2n ** 255n, true]);

      await expect(
        ethereum.BuildBatchPayoutTransaction(
          PLATFORM,
          [{ destinationAddress: RECIPIENT, amountInCents: 500 }],
          { batchId, deadlineSeconds: 600 }
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        type: 'payout_batch_already_paid',
      });
      expect(client.multicall.mock.calls[0][0].contracts[2]).toMatchObject({
        functionName: 'paid',
        args: [PLATFORM, batchId],
      });
      expect(client.estimateGas).not.toHaveBeenCalled();
    });

    it('reads paid() only for payout batches', async () => {
      await expect(
        ethereum.IsBatchPaid(
          { ...expected, transactionType: 'approval', batchId: null },
          CONFIRMED
        )
      ).resolves.toBe(false);
      expect(client.readContract).not.toHaveBeenCalled();
    });

    describe('WasAccepted', () => {
      async function Broadcast(sendError: Error) {
        const signed = await privateKeyToAccount(PLATFORM_KEY).signTransaction(
          built
        );
        client.sendRawTransaction.mockRejectedValue(sendError);
        client.waitForTransactionReceipt.mockResolvedValue(
          Receipt({ transactionHash: keccak256(signed) })
        );
        return ethereum.BroadcastSignedTransaction(signed, expected);
      }

      it('treats "already known" as accepted and waits for the receipt', async () => {
        await expect(
          Broadcast(new Error('already known'))
        ).resolves.toMatchObject({ status: 'paid' });
        expect(client.waitForTransactionReceipt).toHaveBeenCalled();
      });

      it('treats "nonce too low" as accepted when this very hash was mined', async () => {
        client.getTransactionReceipt.mockResolvedValue(Receipt());

        await expect(
          Broadcast(new Error('nonce too low'))
        ).resolves.toMatchObject({ status: 'paid' });
      });

      it('rejects "nonce too low" when this hash was not mined', async () => {
        client.getTransactionReceipt.mockRejectedValue(
          new TransactionReceiptNotFoundError({ hash: HASH })
        );

        await expect(
          Broadcast(new Error('nonce too low'))
        ).rejects.toMatchObject({ statusCode: 400, type: 'blockchain_error' });
        expect(client.waitForTransactionReceipt).not.toHaveBeenCalled();
      });

      it('rejects any other send error', async () => {
        await expect(
          Broadcast(new Error('insufficient funds for gas * price + value'))
        ).rejects.toMatchObject({ statusCode: 400, type: 'blockchain_error' });
      });
    });
  });

  describe('ReplacementFees', () => {
    const current = {
      maxFeePerGas: 3_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
    };

    it('keeps current fees for a new transaction', () => {
      expect(ReplacementFees(current)).toEqual(current);
    });

    it('raises both fees to at least 1.125x the replaced transaction', () => {
      expect(
        ReplacementFees(current, {
          maxFeePerGas: '4000000000',
          maxPriorityFeePerGas: '1000000001',
        })
      ).toEqual({
        maxFeePerGas: 4_500_000_000n,
        maxPriorityFeePerGas: 1_125_000_002n,
      });
    });

    it('keeps current fees that already exceed the bump', () => {
      expect(
        ReplacementFees(current, {
          maxFeePerGas: '1000000000',
          maxPriorityFeePerGas: '100',
        })
      ).toEqual(current);
    });
  });

  describe('GetChainConfig', () => {
    it('resolves the Anvil chain from env overrides', () => {
      SetChainEnv({
        LIVEMODE: 'false',
        ETH_CHAIN_ID: '31337',
        ETH_RPC_URL: 'http://127.0.0.1:8545, http://127.0.0.1:8546',
        ETH_CONFIRMATIONS: '1',
        USDC_ADDRESS: ANVIL_USDC,
        PAYOUT_BATCH_ADDRESS: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
      });

      expect(GetChainConfig()).toEqual({
        chainId: 31337,
        rpcUrls: ['http://127.0.0.1:8545', 'http://127.0.0.1:8546'],
        confirmations: 1,
        usdc: ANVIL_USDC,
        payoutBatch: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        subscriptions: null,
        sanctionsOracle: null,
        explorer: '',
      });
    });

    it('uses the mainnet sanctions oracle in live mode', () => {
      SetChainEnv({ LIVEMODE: 'true' });

      expect(GetChainConfig()).toMatchObject({
        chainId: 1,
        confirmations: 2,
        rpcUrls: [],
        sanctionsOracle: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb',
        explorer: 'https://etherscan.io',
      });
    });

    it('refuses ETH_CHAIN_ID in live mode', () => {
      SetChainEnv({ LIVEMODE: 'true', ETH_CHAIN_ID: '31337' });

      expect(() => GetChainConfig()).toThrow(/ETH_CHAIN_ID/);
    });

    it('checksums per-chain table addresses', () => {
      const anvil = CHAIN_CONTRACTS[31337];
      const original = anvil.payoutBatch;
      anvil.payoutBatch = PAYOUT_BATCH.toLowerCase() as Hex;
      try {
        SetChainEnv({ ETH_CHAIN_ID: '31337', USDC_ADDRESS: ANVIL_USDC });

        expect(GetChainConfig().payoutBatch).toBe(PAYOUT_BATCH);
      } finally {
        anvil.payoutBatch = original;
      }
    });

    it('requires USDC_ADDRESS on Anvil', () => {
      SetChainEnv({ LIVEMODE: 'false', ETH_CHAIN_ID: '31337' });

      expect(() => GetChainConfig()).toThrow(/USDC_ADDRESS/);
    });

    it('rejects an override address with a bad checksum', () => {
      SetChainEnv({
        LIVEMODE: 'false',
        USDC_ADDRESS: '0x5fbDB2315678afecb367f032d93F642f64180aa3',
      });

      expect(() => GetChainConfig()).toThrow(/USDC_ADDRESS/);
    });
  });
});
