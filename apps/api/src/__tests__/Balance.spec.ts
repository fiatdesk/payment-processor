import { BalanceModule } from '../modules/Balance';
import { Database } from '../modules/Database';
import { Balance } from '@fiatdesk/shared-types';
import {
  CreateMockDatabase,
  DeterministicId,
  ResetIdCounter,
  GetFixedTimestamp,
} from './Setup';
import { CreateMockSettlement } from './mocks/Settlement';
import { MemoryDatabase } from './mocks/MemoryDatabase';
import { ArchivedWalletDepositStore } from '../modules/ArchivedWalletDeposits';

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
const mockSettlement = CreateMockSettlement();
jest.mock('../modules/chains/Settlement', () => ({
  GetSettlement: () => mockSettlement,
  IsSimulatedSettlement: jest.fn(() => false),
}));

describe('BalanceModule', () => {
  let module: BalanceModule;
  let mockDb: jest.Mocked<Database>;

  beforeEach(() => {
    jest.clearAllMocks();
    ResetIdCounter();
    mockDb = CreateMockDatabase();
    module = new BalanceModule(mockDb);
  });

  describe('BalanceObject', () => {
    it('should create a balance with zero USDC available and pending', () => {
      const balance = module.BalanceObject('acct_fd_1', 'acct_fd_platform');

      expect(balance.object).toBe('balance');
      expect(balance.account).toBe('acct_fd_1');
      expect(balance.platform_account).toBe('acct_fd_platform');
      expect(balance.available).toEqual([{ amount: 0, currency: 'usdc' }]);
      expect(balance.pending).toEqual([{ amount: 0, currency: 'usdc' }]);
    });
  });

  describe('CreateBalance', () => {
    it('should persist a new zero balance for the account', async () => {
      mockDb.Get = jest.fn().mockResolvedValue({
        id: 'acct_fd_1',
        platform_account: 'acct_fd_platform',
      });

      const balance = await module.CreateBalance('acct_fd_1');

      expect(mockDb.Set).toHaveBeenCalledWith(
        'Balances',
        balance.id,
        expect.objectContaining({ account: 'acct_fd_1' })
      );
      expect(balance.available[0].amount).toBe(0);
    });
  });

  describe('GetBalance', () => {
    it('should return the balance for an account', async () => {
      const mockBalance: Balance = {
        id: 'bal_fd_1',
        object: 'balance',
        account: 'acct_fd_1',
        platform_account: 'acct_fd_platform',
        livemode: false,
        available: [{ amount: 5000, currency: 'usdc' }],
        pending: [{ amount: 0, currency: 'usdc' }],
      };
      mockDb.Find = jest.fn().mockResolvedValue([mockBalance]);

      const result = await module.GetBalance('acct_fd_1');

      expect(result).toEqual(mockBalance);
    });

    it('should return null when no balance exists', async () => {
      mockDb.Find = jest.fn().mockResolvedValue([]);
      const result = await module.GetBalance('acct_fd_missing');
      expect(result).toBeNull();
    });
  });

  describe('GetBalanceDetails', () => {
    it("should report the wallet's native balance and the rail's native currency", async () => {
      mockDb.Find2Custom = jest.fn().mockResolvedValue([
        {
          id: 'wa_fd_platform',
          wallet_address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          default_for_currency: true,
        },
      ]);
      mockDb.Find = jest.fn().mockResolvedValue([
        {
          id: 'bal_fd_1',
          object: 'balance',
          account: 'acct_fd_platform',
          available: [{ amount: 2500, currency: 'usdc' }],
          pending: [{ amount: 100, currency: 'usdc' }],
        },
      ]);
      mockDb.Aggregate = jest.fn().mockResolvedValue([{ total: 700 }]);
      mockSettlement.GetUSDCBalance.mockResolvedValue(32);
      mockSettlement.GetNativeBalance.mockResolvedValue(0.25);

      const details = await module.GetBalanceDetails('acct_fd_platform');

      expect(mockSettlement.GetNativeBalance).toHaveBeenCalledWith(
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
      );
      expect(details).toEqual({
        object: 'balance_details',
        wallet_usdc: 32,
        wallet_native: 0.25,
        native_currency: 'eth',
        connected_accounts_owed: 700,
        platform_available: 2500,
        platform_pending: 100,
        wallet_address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        archived_wallet_deposits: [],
      });
    });
  });

  describe('archived wallet deposits', () => {
    const PLATFORM = 'acct_fd_platform';
    const DEFAULT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const OLD = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
    let memory: MemoryDatabase;

    function Deposit(id: string, overrides: Record<string, unknown> = {}) {
      return {
        id,
        object: 'archived_wallet_deposit',
        platform_account: PLATFORM,
        wallet_id: 'wa_fd_old',
        wallet_address: OLD,
        transaction_hash: `0x${'ab'.repeat(32)}`,
        log_index: 0,
        amount: 1500,
        block_number: 4500,
        acknowledged: false,
        created: 10,
        ...overrides,
      };
    }

    beforeEach(() => {
      memory = new MemoryDatabase();
      Object.assign(memory, { Aggregate: async () => [] });
      memory.Seed(
        'ExternalWallets',
        {
          id: 'wa_fd_old',
          account: PLATFORM,
          wallet_address: OLD,
          default_for_currency: false,
          status: 'archived',
          created: 1,
        },
        {
          id: 'wa_fd_first',
          account: PLATFORM,
          wallet_address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          default_for_currency: false,
          status: 'new',
          created: 2,
        },
        {
          id: 'wa_fd_default',
          account: PLATFORM,
          wallet_address: DEFAULT,
          default_for_currency: true,
          status: 'new',
          created: 3,
        }
      );
      memory.Seed(
        'ArchivedWalletDeposits',
        Deposit('awd_fd_1', { log_index: 0, created: 10 }),
        Deposit('awd_fd_2', { log_index: 1, created: 11 }),
        Deposit('awd_fd_seen', { log_index: 2, acknowledged: true }),
        Deposit('awd_fd_other', { log_index: 3, platform_account: 'acct_x' }),
        Deposit('awd_fd_in_default', {
          log_index: 4,
          wallet_id: 'wa_fd_default',
          wallet_address: DEFAULT,
        })
      );
      module = new BalanceModule(memory.AsDatabase());
    });

    it("lists the platform's unacknowledged deposits to other wallets, for the default wallet even when it is not the first", async () => {
      const details = await module.GetBalanceDetails(PLATFORM);

      expect(details?.wallet_address).toBe(DEFAULT);
      expect(
        details?.archived_wallet_deposits.map((deposit) => deposit.id)
      ).toEqual(['awd_fd_1', 'awd_fd_2']);
    });

    it('acknowledges a deposit, which then leaves the list', async () => {
      const store = new ArchivedWalletDepositStore(memory.AsDatabase());

      await expect(
        store.Acknowledge(PLATFORM, 'awd_fd_1')
      ).resolves.toMatchObject({
        id: 'awd_fd_1',
        acknowledged: true,
      });

      const details = await module.GetBalanceDetails(PLATFORM);
      expect(
        details?.archived_wallet_deposits.map((deposit) => deposit.id)
      ).toEqual(['awd_fd_2']);
    });

    it("refuses another platform's deposit with a 404", async () => {
      const store = new ArchivedWalletDepositStore(memory.AsDatabase());

      await expect(
        store.Acknowledge(PLATFORM, 'awd_fd_other')
      ).rejects.toMatchObject({ statusCode: 404, type: 'resource_missing' });
      await expect(
        store.Acknowledge(PLATFORM, 'awd_fd_missing')
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('UpdateBalance', () => {
    it('should add to the available balance for an existing currency', () => {
      const balance: Balance = {
        id: 'bal_fd_1',
        object: 'balance',
        account: 'acct_fd_1',
        platform_account: 'acct_fd_platform',
        livemode: false,
        available: [{ amount: 1000, currency: 'usdc' }],
        pending: [{ amount: 0, currency: 'usdc' }],
      };

      const updated = module.UpdateBalance(balance, 500, 'usdc', 'available');

      expect(updated.available[0].amount).toBe(1500);
    });

    it('should subtract from the available balance', () => {
      const balance: Balance = {
        id: 'bal_fd_1',
        object: 'balance',
        account: 'acct_fd_1',
        platform_account: 'acct_fd_platform',
        livemode: false,
        available: [{ amount: 1000, currency: 'usdc' }],
        pending: [{ amount: 0, currency: 'usdc' }],
      };

      const updated = module.UpdateBalance(balance, -300, 'usdc', 'available');

      expect(updated.available[0].amount).toBe(700);
    });

    it('should add a new currency entry when not found', () => {
      const balance: Balance = {
        id: 'bal_fd_1',
        object: 'balance',
        account: 'acct_fd_1',
        platform_account: 'acct_fd_platform',
        livemode: false,
        available: [{ amount: 1000, currency: 'usdc' }],
        pending: [{ amount: 0, currency: 'usdc' }],
      };

      const updated = module.UpdateBalance(balance, 200, 'eth', 'available');

      expect(updated.available).toHaveLength(2);
      expect(updated.available[1]).toEqual({ amount: 200, currency: 'eth' });
    });

    it('should update pending balance separately from available', () => {
      const balance: Balance = {
        id: 'bal_fd_1',
        object: 'balance',
        account: 'acct_fd_1',
        platform_account: 'acct_fd_platform',
        livemode: false,
        available: [{ amount: 1000, currency: 'usdc' }],
        pending: [{ amount: 500, currency: 'usdc' }],
      };

      const updated = module.UpdateBalance(balance, 300, 'usdc', 'pending');

      expect(updated.pending[0].amount).toBe(800);
      expect(updated.available[0].amount).toBe(1000);
    });
  });
});
