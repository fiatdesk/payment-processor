// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import type { Balance, TopUp } from '@fiatdesk/shared-types';
import type { ChainCursor } from '../modules/ChainCursorStore';
import { TopUpModule } from '../modules/TopUp';
import { TopUpMonitor } from '../modules/TopUpMonitor';
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
});
