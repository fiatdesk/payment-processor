// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import type {
  ArchivedWalletDeposit,
  Balance,
  TopUp,
} from '@fiatdesk/shared-types';
import type { ChainCursor } from '../modules/ChainCursorStore';
import { TopUpModule } from '../modules/TopUp';
import { TopUpMonitor } from '../modules/TopUpMonitor';
import { Logger } from '../utils/Logger';
import type { IncomingDeposit } from '../modules/chains/types';
import { MemoryDatabase } from './mocks/MemoryDatabase';
import { CreateMockSettlement } from './mocks/Settlement';
import { DeterministicId, GetFixedTimestamp, ResetIdCounter } from './Setup';

jest.mock('../utils/IdGenerator', () => ({
  GenerateId: jest.fn((prefix: string) => DeterministicId(prefix)),
}));
jest.mock('../utils/Timestamp', () => ({
  Now: jest.fn(() => GetFixedTimestamp()),
}));
jest.mock('../utils/Logger', () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('../modules/AppConfig', () => ({
  GetAppConfig: jest.fn(() => ({ livemode: false })),
}));
let mockSettlement = CreateMockSettlement();
const mockIsSimulated = jest.fn(() => false);
jest.mock('../modules/chains/Settlement', () => ({
  GetSettlement: () => mockSettlement,
  IsSimulatedSettlement: () => mockIsSimulated(),
  SIMULATED_TEST_WALLET: '0x1111111111111111111111111111111111111111',
}));
const mockChainConfig = { chainId: 11155111, confirmations: 2 };
jest.mock('../modules/chains/Chain', () => ({
  GetChainConfig: () => mockChainConfig,
}));
const mockEmit = jest.fn();
jest.mock('../modules/EventService', () => ({
  EventService: jest.fn().mockImplementation(() => ({ Emit: mockEmit })),
}));

const PLATFORM = 'acct_fd_platform';
const WALLET_ID = 'wa_fd_platform';
const WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const BUYER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const TX = `0x${'ab'.repeat(32)}`;
const SEPOLIA = 11155111;

function Deposit(overrides: Partial<IncomingDeposit> = {}): IncomingDeposit {
  return {
    transactionHash: TX,
    logIndex: 0,
    amount: 15,
    amountCents: 1500,
    senderAddress: BUYER,
    timestamp: 1_700_000_000,
    blockNumber: 4500,
    ...overrides,
  };
}

describe('TopUpMonitor deposit scanning', () => {
  let memory: MemoryDatabase;
  let monitor: TopUpMonitor;

  beforeEach(() => {
    jest.restoreAllMocks();
    ResetIdCounter();
    mockEmit.mockReset().mockResolvedValue(undefined);
    mockIsSimulated.mockReturnValue(false);
    Object.assign(mockChainConfig, { chainId: SEPOLIA, confirmations: 2 });
    mockSettlement = CreateMockSettlement();
    mockSettlement.GetLatestBlockNumber.mockResolvedValue(5000n);

    memory = new MemoryDatabase();
    memory.UniqueIndex('TopUps', [
      'metadata.blockchain_tx',
      'metadata.log_index',
    ]);
    memory.Seed('Accounts', {
      id: PLATFORM,
      platform_account: PLATFORM,
      created: 1,
    });
    memory.Seed('ExternalWallets', {
      id: WALLET_ID,
      account: PLATFORM,
      wallet_address: WALLET,
      default_for_currency: true,
      status: 'new',
    });
    memory.Seed('Balances', {
      id: 'bal_fd_platform',
      account: PLATFORM,
      available: [{ amount: 0, currency: 'usdc' }],
      pending: [{ amount: 0, currency: 'usdc' }],
    });
    monitor = new TopUpMonitor(memory.AsDatabase());
  });

  /** The block ranges handed to GetIncomingDeposits, in call order. */
  function Ranges(): [bigint, bigint][] {
    return mockSettlement.GetIncomingDeposits.mock.calls.map(
      ([, range]) => [range.fromBlock, range.toBlock] as [bigint, bigint]
    );
  }

  function Cursor(): number | undefined {
    return memory
      .All<ChainCursor>('ChainCursors')
      .find((cursor) => cursor.id === WALLET_ID)?.last_scanned_block;
  }

  function SeedCursor(lastScannedBlock: number, chainId = SEPOLIA): void {
    memory.Seed('ChainCursors', {
      id: WALLET_ID,
      chain_id: chainId,
      last_scanned_block: lastScannedBlock,
      updated: 1,
    });
  }

  function Available(): number {
    return memory.Doc<Balance>('Balances', 'bal_fd_platform').available[0]
      .amount;
  }

  const Check = () => monitor.CheckDepositsForAccount(PLATFORM);

  describe('cursor and block ranges', () => {
    it('starts the first scan 1000 blocks back and ends it at latest - confirmations', async () => {
      await Check();

      expect(mockSettlement.GetIncomingDeposits).toHaveBeenCalledWith(WALLET, {
        fromBlock: 4000n,
        toBlock: 4998n,
      });
      expect(Ranges()).toEqual([[4000n, 4998n]]);
      expect(Cursor()).toBe(4998);
    });

    it('respects ETH_CONFIRMATIONS', async () => {
      mockChainConfig.confirmations = 12;

      await Check();

      expect(Ranges()).toEqual([[4000n, 4988n]]);
      expect(Cursor()).toBe(4988);
    });

    it('resumes after the cursor in chunks of at most 2000 blocks', async () => {
      SeedCursor(100);
      mockSettlement.GetLatestBlockNumber.mockResolvedValue(6102n);

      await Check();

      expect(Ranges()).toEqual([
        [101n, 2100n],
        [2101n, 4100n],
        [4101n, 6100n],
      ]);
      expect(Cursor()).toBe(6100);
    });

    it('reads the head once per scan, so no chunk ends past latest - confirmations', async () => {
      SeedCursor(100);
      mockSettlement.GetLatestBlockNumber.mockResolvedValueOnce(
        4102n
      ).mockResolvedValue(9000n);

      await Check();

      expect(mockSettlement.GetLatestBlockNumber).toHaveBeenCalledTimes(1);
      expect(Ranges()).toEqual([
        [101n, 2100n],
        [2101n, 4100n],
      ]);
      expect(Cursor()).toBe(4100);
    });

    it('scans at most 10 chunks per call and continues on the next call', async () => {
      SeedCursor(0);
      mockSettlement.GetLatestBlockNumber.mockResolvedValue(50_002n);

      const first = await Check();

      expect(Ranges()).toHaveLength(10);
      expect(Ranges()[0]).toEqual([1n, 2000n]);
      expect(Ranges()[9]).toEqual([18_001n, 20_000n]);
      expect(Cursor()).toBe(20_000);
      expect(first.message).toMatch(/call again/);

      mockSettlement.GetIncomingDeposits.mockClear();
      await Check();
      expect(Ranges()[0]).toEqual([20_001n, 22_000n]);
      expect(Cursor()).toBe(40_000);

      mockSettlement.GetIncomingDeposits.mockClear();
      const last = await Check();
      expect(Ranges()).toEqual([
        [40_001n, 42_000n],
        [42_001n, 44_000n],
        [44_001n, 46_000n],
        [46_001n, 48_000n],
        [48_001n, 50_000n],
      ]);
      expect(Cursor()).toBe(50_000);
      expect(last.message).not.toMatch(/call again/);
    });

    it('does not scan while no block past the cursor is confirmed', async () => {
      SeedCursor(4998);

      await Check();

      expect(mockSettlement.GetIncomingDeposits).not.toHaveBeenCalled();
      expect(Cursor()).toBe(4998);
    });

    it('starts over for a cursor recorded on another chain', async () => {
      SeedCursor(40, 31337);

      await Check();

      expect(Ranges()).toEqual([[4000n, 4998n]]);
      expect(memory.Doc<ChainCursor>('ChainCursors', WALLET_ID)).toMatchObject({
        chain_id: SEPOLIA,
        last_scanned_block: 4998,
      });
    });

    it('scans nothing on the simulated rail', async () => {
      mockIsSimulated.mockReturnValue(true);

      await expect(Check()).resolves.toMatchObject({ processed: 0 });
      expect(mockSettlement.GetLatestBlockNumber).not.toHaveBeenCalled();
      expect(mockSettlement.GetIncomingDeposits).not.toHaveBeenCalled();
      expect(Cursor()).toBeUndefined();
    });

    it('scans every platform wallet through the same code when polling', async () => {
      await monitor.Poll();

      expect(Ranges()).toEqual([[4000n, 4998n]]);
      expect(Cursor()).toBe(4998);
    });
  });

  describe('crediting deposits', () => {
    const PAIR = [
      Deposit(),
      Deposit({ logIndex: 1, amount: 22.5, amountCents: 2250 }),
    ];

    it('credits two Transfer logs of one transaction as two top-ups', async () => {
      mockSettlement.GetIncomingDeposits.mockResolvedValue(PAIR);

      const result = await Check();

      expect(result).toMatchObject({ processed: 2, errors: 0 });
      expect(
        result.topups.map((topUp) => [
          topUp.amount,
          topUp.metadata.blockchain_tx,
          topUp.metadata.log_index,
        ])
      ).toEqual([
        [1500, TX, '0'],
        [2250, TX, '1'],
      ]);
      expect(Available()).toBe(3750);
      expect(mockEmit).toHaveBeenCalledTimes(4);
    });

    it('credits nothing twice when a range is scanned again', async () => {
      mockSettlement.GetIncomingDeposits.mockResolvedValue(PAIR);
      await Check();
      SeedCursor(3999);

      const again = await Check();

      expect(again).toMatchObject({ processed: 0, errors: 0, topups: [] });
      expect(again.message).toBe('No new deposits found');
      expect(memory.All<TopUp>('TopUps')).toHaveLength(2);
      expect(Available()).toBe(3750);
    });

    it('treats a duplicate key from a concurrent credit as already processed', async () => {
      mockSettlement.GetIncomingDeposits.mockResolvedValue([Deposit()]);
      await Check();
      SeedCursor(3999);
      // Both checks miss the first credit, as in a race between two scans.
      jest
        .spyOn(TopUpModule.prototype, 'GetProcessedDepositKeys')
        .mockResolvedValue(new Set());
      jest
        .spyOn(TopUpModule.prototype, 'IsDepositProcessed')
        .mockResolvedValue(false);

      const again = await Check();

      expect(again).toMatchObject({ processed: 0, errors: 0 });
      expect(memory.All<TopUp>('TopUps')).toHaveLength(1);
      expect(Available()).toBe(1500);
      expect(Cursor()).toBe(4998);
    });

    it('skips transfers worth less than one cent', async () => {
      mockSettlement.GetIncomingDeposits.mockResolvedValue([
        Deposit({ amount: 0.0099, amountCents: 0 }),
      ]);

      await expect(Check()).resolves.toMatchObject({
        processed: 0,
        errors: 0,
      });
      expect(memory.All('TopUps')).toHaveLength(0);
      expect(Cursor()).toBe(4998);
    });
  });

  describe('failures never skip a deposit', () => {
    beforeEach(() => {
      SeedCursor(100);
      mockSettlement.GetLatestBlockNumber.mockResolvedValue(4102n);
    });

    it('keeps the cursor before a chunk whose deposit could not be credited', async () => {
      mockSettlement.GetIncomingDeposits.mockImplementation(
        async (_address, { fromBlock }) =>
          fromBlock === 101n ? [Deposit({ blockNumber: 150 })] : []
      );
      jest
        .spyOn(TopUpModule.prototype, 'CreateFromDeposit')
        .mockRejectedValueOnce(new Error('WriteConflict'));

      const failed = await Check();

      expect(failed).toMatchObject({ processed: 0, errors: 1 });
      expect(Ranges()).toEqual([[101n, 2100n]]);
      expect(Cursor()).toBe(100);

      const retried = await Check();

      expect(retried).toMatchObject({ processed: 1, errors: 0 });
      expect(Available()).toBe(1500);
      expect(Cursor()).toBe(4100);
    });

    it('throws when the node cannot serve a range, never moving past it', async () => {
      mockSettlement.GetIncomingDeposits.mockResolvedValueOnce(
        []
      ).mockRejectedValueOnce(new Error('query exceeds max results'));

      await expect(Check()).rejects.toThrow('query exceeds max results');
      // Only the fully scanned first chunk counts.
      expect(Cursor()).toBe(2100);
    });

    it('throws before scanning when the head cannot be read', async () => {
      mockSettlement.GetLatestBlockNumber.mockRejectedValue(
        new Error('rpc down')
      );

      await expect(Check()).rejects.toThrow('rpc down');
      expect(mockSettlement.GetIncomingDeposits).not.toHaveBeenCalled();
      expect(Cursor()).toBe(100);
    });
  });

  describe('watching the other platform wallets', () => {
    const OTHER_ID = 'wa_fd_other';
    const OTHER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
    const REMOVED_ID = 'wa_fd_removed';
    const REMOVED = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
    const OLD_ID = 'wa_fd_old';
    const OLD = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc';
    const DAY = 24 * 3600;

    beforeEach(() => {
      memory.UniqueIndex('ArchivedWalletDeposits', [
        'transaction_hash',
        'log_index',
      ]);
      memory.Seed(
        'ExternalWallets',
        {
          id: OTHER_ID,
          account: PLATFORM,
          wallet_address: OTHER,
          default_for_currency: false,
          status: 'new',
        },
        {
          id: REMOVED_ID,
          account: PLATFORM,
          wallet_address: REMOVED,
          default_for_currency: true,
          status: 'archived',
          archived_at: GetFixedTimestamp() - 30 * DAY,
        },
        {
          id: OLD_ID,
          account: PLATFORM,
          wallet_address: OLD,
          default_for_currency: false,
          status: 'archived',
          archived_at: GetFixedTimestamp() - 30 * DAY - 1,
        },
        {
          id: 'wa_fd_untracked',
          account: PLATFORM,
          wallet_address: OLD,
          default_for_currency: false,
          status: 'archived',
        }
      );
      mockSettlement.GetIncomingDeposits.mockImplementation(async (address) =>
        address === WALLET
          ? []
          : [Deposit({ logIndex: address === OTHER ? 0 : 1 })]
      );
    });

    function Scanned(): string[] {
      return mockSettlement.GetIncomingDeposits.mock.calls.map(
        ([address]) => address
      );
    }

    function Alerts() {
      return memory
        .All<ArchivedWalletDeposit>('ArchivedWalletDeposits')
        .map((deposit) => ({
          wallet_id: deposit.wallet_id,
          wallet_address: deposit.wallet_address,
          transaction_hash: deposit.transaction_hash,
          log_index: deposit.log_index,
          amount: deposit.amount,
          block_number: deposit.block_number,
          acknowledged: deposit.acknowledged,
        }));
    }

    it('scans non-default wallets and wallets removed in the last 30 days, and credits none of it', async () => {
      const result = await Check();

      expect(Scanned()).toEqual([OTHER, REMOVED, WALLET]);
      expect(result).toMatchObject({ processed: 0, errors: 0, topups: [] });
      expect(memory.All('TopUps')).toHaveLength(0);
      expect(Available()).toBe(0);
      expect(Alerts()).toEqual([
        {
          wallet_id: OTHER_ID,
          wallet_address: OTHER,
          transaction_hash: TX,
          log_index: 0,
          amount: 1500,
          block_number: 4500,
          acknowledged: false,
        },
        {
          wallet_id: REMOVED_ID,
          wallet_address: REMOVED,
          transaction_hash: TX,
          log_index: 1,
          amount: 1500,
          block_number: 4500,
          acknowledged: false,
        },
      ]);
      expect(Logger.warn).toHaveBeenCalledWith(
        'USDC arrived at a platform wallet that is not the default; it is not credited',
        expect.objectContaining({ walletId: OTHER_ID, transactionHash: TX })
      );
      // Each wallet has its own cursor.
      expect(
        memory
          .All<ChainCursor>('ChainCursors')
          .map((cursor) => cursor.id)
          .sort()
      ).toEqual([OTHER_ID, REMOVED_ID, WALLET_ID].sort());
    });

    it('records each transfer once when a range is scanned again', async () => {
      await Check();
      for (const id of [OTHER_ID, REMOVED_ID]) {
        memory.Seed('ChainCursors', {
          id,
          chain_id: SEPOLIA,
          last_scanned_block: 3999,
          updated: 1,
        });
      }

      await Check();

      expect(memory.All('ArchivedWalletDeposits')).toHaveLength(2);
    });

    it('does not alert USDC a watched wallet received before it was added', async () => {
      memory.Seed('ExternalWallets', {
        ...memory.Doc<Record<string, unknown>>('ExternalWallets', OTHER_ID),
        created: 1_700_000_001,
      });

      await Check();

      // The deposit's block time is 1_700_000_000.
      expect(Alerts().map((alert) => alert.wallet_id)).toEqual([REMOVED_ID]);
    });

    it('polls the watched wallets too', async () => {
      await monitor.Poll();

      expect(Scanned()).toEqual([OTHER, REMOVED, WALLET]);
      expect(memory.All('ArchivedWalletDeposits')).toHaveLength(2);
      expect(memory.All('TopUps')).toHaveLength(0);
    });

    describe('counting each cent once', () => {
      const MOVE_TX = `0x${'cd'.repeat(32)}`;
      const PAYMENT_TX = `0x${'ef'.repeat(32)}`;

      function Alert(
        overrides: Partial<ArchivedWalletDeposit> = {}
      ): Record<string, unknown> {
        const alert: ArchivedWalletDeposit = {
          id: 'awd_fd_1',
          object: 'archived_wallet_deposit',
          platform_account: PLATFORM,
          wallet_id: OTHER_ID,
          wallet_address: OTHER,
          transaction_hash: TX,
          log_index: 0,
          amount: 1500,
          block_number: 4000,
          sender_address: BUYER,
          topup: null,
          acknowledged: false,
          created: 1,
          ...overrides,
        };
        return { ...alert };
      }

      function Payment(transactionHash: string): Record<string, unknown> {
        return {
          id: `txn_fd_${transactionHash.slice(2, 6)}`,
          account: PLATFORM,
          type: 'payment',
          amount: 1500,
          metadata: { blockchain_tx: transactionHash },
        };
      }

      /** USDC moved from OTHER to the default at block 4500. */
      function Move(amountCents: number): void {
        mockSettlement.GetIncomingDeposits.mockImplementation(async (address) =>
          address === WALLET
            ? [
                Deposit({
                  transactionHash: MOVE_TX,
                  senderAddress: OTHER,
                  amount: amountCents / 100,
                  amountCents,
                }),
              ]
            : []
        );
      }

      function Credited(id: string): string | null {
        return memory.Doc<ArchivedWalletDeposit>('ArchivedWalletDeposits', id)
          .topup;
      }

      it('does not credit a deposit whose transaction the ledger records as a payment', async () => {
        memory.Seed('BalanceTransactions', Payment(TX));
        mockSettlement.GetIncomingDeposits.mockImplementation(async (address) =>
          address === WALLET ? [Deposit()] : []
        );

        const result = await Check();

        expect(result).toMatchObject({ processed: 0, errors: 0 });
        expect(memory.All('TopUps')).toHaveLength(0);
        expect(Available()).toBe(0);
        expect(Cursor()).toBe(4998);
      });

      it('credits a move only for the uncredited deposits it carries, and marks them credited', async () => {
        memory.Seed(
          'ArchivedWalletDeposits',
          Alert(),
          Alert({ id: 'awd_fd_2', log_index: 1, amount: 700, created: 2 })
        );
        // 50 USDC moved: the two recorded deposits (22 USDC) and 28 USDC
        // the ledger counted while OTHER was the default.
        Move(5000);

        const result = await Check();

        expect(result).toMatchObject({ processed: 1, errors: 0 });
        expect(Available()).toBe(2200);
        const [topUp] = memory.All<TopUp>('TopUps');
        expect(topUp).toMatchObject({
          amount: 2200,
          metadata: { blockchain_tx: MOVE_TX, log_index: '0' },
        });
        expect(Credited('awd_fd_1')).toBe(topUp.id);
        expect(Credited('awd_fd_2')).toBe(topUp.id);
        expect(
          memory.Doc<ArchivedWalletDeposit>(
            'ArchivedWalletDeposits',
            'awd_fd_1'
          ).acknowledged
        ).toBe(true);
      });

      it('credits a move once when its range is scanned again', async () => {
        memory.Seed('ArchivedWalletDeposits', Alert());
        Move(1500);
        await Check();
        SeedCursor(3999);

        await Check();

        expect(memory.All('TopUps')).toHaveLength(1);
        expect(Available()).toBe(1500);
      });

      it('credits nothing for a move of funds the ledger already counts', async () => {
        memory.Seed(
          'ArchivedWalletDeposits',
          Alert({ topup: 'tu_fd_earlier', acknowledged: true }),
          // Funds moved in from another platform wallet, and a payment.
          Alert({ id: 'awd_fd_2', log_index: 1, sender_address: REMOVED }),
          Alert({ id: 'awd_fd_3', transaction_hash: PAYMENT_TX })
        );
        memory.Seed('BalanceTransactions', Payment(PAYMENT_TX));
        Move(5000);

        const result = await Check();

        expect(result).toMatchObject({ processed: 0, errors: 0 });
        expect(memory.All('TopUps')).toHaveLength(0);
        expect(Available()).toBe(0);
        expect(Logger.info).toHaveBeenCalledWith(
          'USDC moved from another platform wallet; the ledger already counts it',
          expect.objectContaining({ transactionHash: MOVE_TX })
        );
      });

      it('leaves out deposits that arrived after the move or do not fit in it', async () => {
        memory.Seed(
          'ArchivedWalletDeposits',
          Alert({ amount: 2000 }),
          Alert({ id: 'awd_fd_2', log_index: 1, amount: 400, created: 2 }),
          Alert({ id: 'awd_fd_3', log_index: 2, block_number: 4600 })
        );
        Move(1500);

        await Check();

        expect(Available()).toBe(400);
        expect(Credited('awd_fd_1')).toBeNull();
        expect(Credited('awd_fd_3')).toBeNull();
      });

      it('retries a move while the sending wallet is not scanned up to it', async () => {
        memory.Seed('ArchivedWalletDeposits', Alert());
        Move(1500);
        mockSettlement.GetIncomingDeposits.mockImplementation(
          async (address) => {
            if (address === OTHER) throw new Error('rpc down');
            return address === WALLET
              ? [Deposit({ transactionHash: MOVE_TX, senderAddress: OTHER })]
              : [];
          }
        );

        const result = await Check();

        expect(result).toMatchObject({ processed: 0, errors: 1 });
        expect(Cursor()).toBeUndefined();
        expect(Credited('awd_fd_1')).toBeNull();
      });

      it('credits deposits recorded at a wallet once it is the default, unless dismissed', async () => {
        memory.Seed(
          'ArchivedWalletDeposits',
          Alert({ wallet_id: WALLET_ID, wallet_address: WALLET }),
          Alert({
            id: 'awd_fd_2',
            wallet_id: WALLET_ID,
            wallet_address: WALLET,
            log_index: 1,
            acknowledged: true,
          })
        );
        mockSettlement.GetIncomingDeposits.mockResolvedValue([]);

        const first = await Check();
        await Check();

        expect(first).toMatchObject({ processed: 1, errors: 0 });
        expect(memory.All('TopUps')).toHaveLength(1);
        expect(Available()).toBe(1500);
        expect(Credited('awd_fd_1')).toEqual(expect.any(String));
        expect(Credited('awd_fd_2')).toBeNull();
      });
    });

    it('still credits the default wallet when a watched wallet cannot be scanned', async () => {
      mockSettlement.GetIncomingDeposits.mockImplementation(async (address) => {
        if (address === WALLET) return [Deposit()];
        throw new Error('rpc down');
      });

      await expect(Check()).resolves.toMatchObject({ processed: 1 });
      expect(Available()).toBe(1500);
    });
  });

  it('scans the first stored wallet when none is flagged, and records it as the default', async () => {
    memory = new MemoryDatabase();
    memory.Seed('Accounts', { id: PLATFORM, platform_account: PLATFORM });
    memory.Seed(
      'ExternalWallets',
      {
        id: WALLET_ID,
        account: PLATFORM,
        wallet_address: WALLET,
        default_for_currency: null,
        status: 'new',
        created: 2,
      },
      {
        id: 'wa_fd_newer',
        account: PLATFORM,
        wallet_address: BUYER,
        default_for_currency: null,
        status: 'new',
        created: 3,
      }
    );
    monitor = new TopUpMonitor(memory.AsDatabase());

    await monitor.CheckDepositsForAccount(PLATFORM);

    expect(mockSettlement.GetIncomingDeposits.mock.calls.at(-1)?.[0]).toBe(
      WALLET
    );
    expect(
      memory.Doc<{ default_for_currency: boolean }>(
        'ExternalWallets',
        WALLET_ID
      ).default_for_currency
    ).toBe(true);
  });

  it('scans the default wallet even when it is not the first one stored', async () => {
    memory = new MemoryDatabase();
    memory.Seed('Accounts', { id: PLATFORM, platform_account: PLATFORM });
    memory.Seed(
      'ExternalWallets',
      {
        id: 'wa_fd_first',
        account: PLATFORM,
        wallet_address: BUYER,
        default_for_currency: false,
        status: 'new',
      },
      {
        id: WALLET_ID,
        account: PLATFORM,
        wallet_address: WALLET,
        default_for_currency: true,
        status: 'new',
      }
    );
    monitor = new TopUpMonitor(memory.AsDatabase());

    await monitor.CheckDepositsForAccount(PLATFORM);

    expect(mockSettlement.GetIncomingDeposits.mock.calls.at(-1)?.[0]).toBe(
      WALLET
    );
  });
});
