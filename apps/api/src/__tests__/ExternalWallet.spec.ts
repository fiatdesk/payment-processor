import { ExternalWalletModule } from '../modules/ExternalWallet';
import { Database } from '../modules/Database';
import { PlanDestinationModule } from '../modules/PlanDestination';
import { ExternalWallet, Price } from '@fiatdesk/shared-types';
import {
  CreateMockDatabase,
  DeterministicId,
  ResetIdCounter,
  GetFixedTimestamp,
} from './Setup';
import {
  CreateMockSettlement,
  MOCK_DESTINATION_HASH,
} from './mocks/Settlement';
import { MemoryDatabase } from './mocks/MemoryDatabase';

jest.mock('../modules/Database');
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
  GetAppConfig: jest.fn(() => ({
    dashboardUrl: 'http://localhost:4200',
    livemode: false,
    appSecret: 'test-secret',
  })),
}));
const mockSettlement = CreateMockSettlement();
jest.mock('../modules/chains/Settlement', () => ({
  GetSettlement: jest.fn(() => mockSettlement),
  IsSimulatedSettlement: jest.fn(() => false),
}));
jest.mock('../modules/SanctionsScreening', () => ({
  SanctionsScreeningModule: jest.fn().mockImplementation(() => ({
    CheckWalletAddress: jest
      .fn()
      .mockResolvedValue({ isSanctioned: false, source: 'ofac' }),
  })),
}));

const VALID_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const VALID_WALLET_2 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

describe('ExternalWalletModule', () => {
  let module: ExternalWalletModule;
  let mockDb: jest.Mocked<Database>;

  beforeEach(() => {
    jest.clearAllMocks();
    ResetIdCounter();
    mockDb = CreateMockDatabase();
    module = new ExternalWalletModule(mockDb);
  });

  describe('ExternalWalletObject', () => {
    it('should create a wallet object with correct defaults', () => {
      const wallet = module.ExternalWalletObject(
        'acct_fd_1',
        'acct_fd_platform',
        {
          wallet_address: VALID_WALLET,
        }
      );

      expect(wallet.object).toBe('wallet');
      expect(wallet.account).toBe('acct_fd_1');
      expect(wallet.platform_account).toBe('acct_fd_platform');
      expect(wallet.wallet_address).toBe(VALID_WALLET);
      expect(wallet.network).toBe('ethereum');
      expect(wallet.currency).toBe('usdc');
      expect(wallet.status).toBe('new');
      expect(wallet.last4).toBe('2266');
      expect(wallet.available_payout_methods).toEqual(['standard', 'instant']);
    });

    it('should use the last 4 characters of the wallet address', () => {
      const wallet = module.ExternalWalletObject(
        'acct_fd_1',
        'acct_fd_platform',
        { wallet_address: VALID_WALLET_2 }
      );

      expect(wallet.last4).toBe('79C8');
    });

    it('should keep an explicit network', () => {
      const wallet = module.ExternalWalletObject(
        'acct_fd_1',
        'acct_fd_platform',
        { wallet_address: VALID_WALLET, network: 'simulated' }
      );

      expect(wallet.network).toBe('simulated');
    });
  });

  describe('CreateExternalWallet', () => {
    it('should screen, persist, and return the wallet', async () => {
      mockDb.Get = jest.fn().mockResolvedValue({
        id: 'acct_fd_1',
        platform_account: 'acct_fd_platform',
      });

      const wallet = await module.CreateExternalWallet('acct_fd_1', {
        wallet_address: VALID_WALLET,
      });

      expect(wallet.object).toBe('wallet');
      expect(wallet.wallet_address).toBe(VALID_WALLET);
      expect(mockDb.Set).toHaveBeenCalledWith(
        'ExternalWallets',
        wallet.id,
        expect.objectContaining({
          wallet_address: VALID_WALLET,
        }),
        expect.anything()
      );
    });

    it('should accept a lowercase address and store it checksummed', async () => {
      mockDb.Get = jest.fn().mockResolvedValue({
        id: 'acct_fd_1',
        platform_account: 'acct_fd_platform',
      });

      const wallet = await module.CreateExternalWallet('acct_fd_1', {
        wallet_address: VALID_WALLET.toLowerCase(),
      });

      expect(wallet.wallet_address).toBe(VALID_WALLET);
      expect(mockDb.Set).toHaveBeenCalledWith(
        'ExternalWallets',
        wallet.id,
        expect.objectContaining({ wallet_address: VALID_WALLET }),
        expect.anything()
      );
    });

    it.each([
      [
        'a mixed-case address with a bad checksum',
        `0xF${VALID_WALLET.slice(3)}`,
      ],
      ['a non-hex address', 'D8VMZCmmTUUfhejNhNQKAmqvZCKfUq1qU6RqQKxQwXyX'],
      ['a truncated address', VALID_WALLET.slice(0, -1)],
    ])('should reject %s', async (_label, walletAddress) => {
      await expect(
        module.CreateExternalWallet('acct_fd_1', {
          wallet_address: walletAddress,
        })
      ).rejects.toThrow('wallet_address: Must be a valid Ethereum address');
      expect(mockDb.Set).not.toHaveBeenCalled();
    });

    it('should throw when account is not found', async () => {
      await expect(
        module.CreateExternalWallet('nonexistent', {
          wallet_address: VALID_WALLET,
        })
      ).rejects.toThrow('Account not found');
    });
  });

  describe('GetExternalWallet', () => {
    it('should return the wallet when found', async () => {
      const mockWallet = {
        id: 'wa_fd_1',
        object: 'wallet',
      } as ExternalWallet;
      mockDb.Get = jest.fn().mockResolvedValue(mockWallet);

      const result = await module.GetExternalWallet('wa_fd_1');
      expect(result).toEqual(mockWallet);
    });

    it('should return null when not found', async () => {
      const result = await module.GetExternalWallet('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('DeleteExternalWallet', () => {
    it('should archive the wallet (soft delete)', async () => {
      mockDb.Get = jest.fn().mockResolvedValue({
        id: 'wa_fd_1',
        object: 'wallet',
        account: 'acct_fd_1',
      });

      const result = await module.DeleteExternalWallet('wa_fd_1');

      expect(mockDb.Update).toHaveBeenCalledWith(
        'ExternalWallets',
        'wa_fd_1',
        { status: 'archived', archived_at: GetFixedTimestamp() },
        expect.anything()
      );
      expect(result).toEqual({
        id: 'wa_fd_1',
        object: 'wallet',
        deleted: true,
      });
    });

    it('should throw when wallet not found', async () => {
      await expect(module.DeleteExternalWallet('nonexistent')).rejects.toThrow(
        'External wallet not found'
      );
    });
  });

  describe('GetExternalWalletsByAccount', () => {
    it('should exclude archived wallets by default', async () => {
      const wallets = [
        { id: 'wa_fd_1', status: 'new' },
        { id: 'wa_fd_2', status: 'verified' },
      ] as ExternalWallet[];
      mockDb.Find2Custom = jest.fn().mockResolvedValue(wallets);

      const result = await module.GetExternalWalletsByAccount('acct_fd_1');

      expect(result).toHaveLength(2);
      expect(mockDb.Find2Custom).toHaveBeenCalledWith(
        'ExternalWallets',
        'account',
        '==',
        'acct_fd_1',
        'status',
        '!=',
        'archived'
      );
    });

    it('should include archived wallets when requested', async () => {
      const wallets = [
        { id: 'wa_fd_1', status: 'new' },
        { id: 'wa_fd_2', status: 'archived' },
      ] as ExternalWallet[];
      mockDb.Find = jest.fn().mockResolvedValue(wallets);

      const result = await module.GetExternalWalletsByAccount(
        'acct_fd_1',
        true
      );

      expect(result).toHaveLength(2);
      expect(mockDb.Find).toHaveBeenCalledWith(
        'ExternalWallets',
        'account',
        'acct_fd_1'
      );
    });
  });

  describe('Stripe-style wallet rules (MemoryDatabase)', () => {
    const PLATFORM = 'acct_fd_platform';
    const CONNECTED = 'acct_fd_connected';
    const OLD_WALLET = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
    const PLAN_KEY = `0x${'a1'.repeat(32)}`;
    let memory: MemoryDatabase;
    let emit: jest.Mock;
    let wallets: ExternalWalletModule;

    beforeEach(() => {
      memory = new MemoryDatabase();
      emit = jest.fn().mockResolvedValue(undefined);
      memory.Seed(
        'Accounts',
        { id: PLATFORM, platform_account: PLATFORM },
        { id: CONNECTED, platform_account: PLATFORM }
      );
      mockSettlement.SetPlanDestination.mockReset();
      mockSettlement.SetPlanDestination.mockImplementation(
        async (_planKey, _destination, options) => {
          await options.onSigned(MOCK_DESTINATION_HASH);
          return { status: 'pending', transaction_hash: MOCK_DESTINATION_HASH };
        }
      );
      wallets = Wallets();
    });

    function Wallets(): ExternalWalletModule {
      const db = memory.AsDatabase();
      const eventService = { Emit: emit } as never;
      return new ExternalWalletModule(
        db,
        eventService,
        new PlanDestinationModule(db, mockSettlement, eventService)
      );
    }

    function Stored(id: string): ExternalWallet {
      return memory.Doc<ExternalWallet>('ExternalWallets', id);
    }

    function SeedWallet(
      id: string,
      address: string,
      overrides: Partial<ExternalWallet> = {}
    ): void {
      memory.Seed('ExternalWallets', {
        id,
        object: 'wallet',
        account: PLATFORM,
        platform_account: PLATFORM,
        wallet_address: address,
        default_for_currency: false,
        status: 'new',
        created: 1,
        ...overrides,
      });
    }

    function SeedPrice(overrides: Partial<Price>): void {
      memory.Seed('Prices', {
        id: 'price_fd_plan',
        object: 'price',
        active: true,
        type: 'recurring',
        platform_account: PLATFORM,
        subscription_plan_id: PLAN_KEY,
        subscription_plan_destination: OLD_WALLET,
        subscription_plan_destination_change: null,
        ...overrides,
      });
    }

    it('makes the first wallet the default, and later ones only when asked', async () => {
      const first = await wallets.CreateExternalWallet(PLATFORM, {
        wallet_address: OLD_WALLET,
      });
      const second = await wallets.CreateExternalWallet(PLATFORM, {
        wallet_address: VALID_WALLET,
      });

      expect(first.default_for_currency).toBe(true);
      expect(second.default_for_currency).toBe(false);
      expect((await wallets.GetDefaultWallet(PLATFORM))?.id).toBe(first.id);
    });

    it('refuses a sixth active wallet with a 400; removed wallets do not count', async () => {
      for (let i = 1; i <= 5; i++) {
        SeedWallet(`wa_fd_${i}`, VALID_WALLET, {
          default_for_currency: i === 1,
        });
      }
      SeedWallet('wa_fd_removed', VALID_WALLET_2, { status: 'archived' });

      await expect(
        wallets.CreateExternalWallet(PLATFORM, {
          wallet_address: VALID_WALLET_2,
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        type: 'invalid_request_error',
        message:
          'An account can have at most 5 wallets. Remove one before adding another.',
      });
      expect(memory.All('ExternalWallets')).toHaveLength(6);
    });

    it('sets another wallet as the default and unsets the old one', async () => {
      SeedWallet('wa_fd_old', OLD_WALLET, { default_for_currency: true });
      SeedWallet('wa_fd_new', VALID_WALLET);

      const updated = await wallets.UpdateExternalWallet('wa_fd_new', {
        default_for_currency: true,
      });

      expect(updated.default_for_currency).toBe(true);
      expect(Stored('wa_fd_old').default_for_currency).toBe(false);
      expect((await wallets.GetDefaultWallet(PLATFORM))?.id).toBe('wa_fd_new');
      expect(emit).toHaveBeenCalledWith(
        'external_account.updated',
        PLATFORM,
        expect.objectContaining({ id: 'wa_fd_new' }),
        { previousAttributes: { default_for_currency: false } }
      );
      expect(emit).toHaveBeenCalledWith(
        'external_account.updated',
        PLATFORM,
        expect.objectContaining({ id: 'wa_fd_old' }),
        { previousAttributes: { default_for_currency: true } }
      );
    });

    it('refuses to remove the default wallet, and archives another one', async () => {
      SeedWallet('wa_fd_old', OLD_WALLET, { default_for_currency: true });
      SeedWallet('wa_fd_new', VALID_WALLET);

      await expect(
        wallets.DeleteExternalWallet('wa_fd_old')
      ).rejects.toMatchObject({
        statusCode: 400,
        type: 'invalid_request_error',
        message: 'Set another wallet as the default before removing this one.',
      });
      expect(Stored('wa_fd_old').status).toBe('new');

      await wallets.DeleteExternalWallet('wa_fd_new');
      expect(Stored('wa_fd_new')).toMatchObject({
        status: 'archived',
        archived_at: GetFixedTimestamp(),
      });
    });

    it('never returns an archived wallet, and repairs an account whose flagged default was archived', async () => {
      // What the old Settings flow left: the default archived with its flag,
      // its replacement active without one.
      SeedWallet('wa_fd_old', OLD_WALLET, {
        status: 'archived',
        default_for_currency: true,
        created: 1,
      });
      SeedWallet('wa_fd_kept', VALID_WALLET_2, {
        default_for_currency: null,
        created: 2,
      });
      SeedWallet('wa_fd_new', VALID_WALLET, {
        default_for_currency: null,
        created: 3,
      });

      const wallet = await wallets.GetDefaultWallet(PLATFORM);

      // The wallet the old fallback (`wallets[0]`, storage order) picked, so
      // nothing it pays changes.
      expect(wallet?.id).toBe('wa_fd_kept');
      expect(Stored('wa_fd_kept').default_for_currency).toBe(true);
      expect(Stored('wa_fd_new').default_for_currency).toBeNull();
      // The archived wallet keeps no flag.
      expect(Stored('wa_fd_old')).toMatchObject({
        status: 'archived',
        default_for_currency: false,
      });
      expect(emit.mock.calls).toEqual([
        [
          'external_account.updated',
          PLATFORM,
          expect.objectContaining({ id: 'wa_fd_kept' }),
          { previousAttributes: { default_for_currency: null } },
        ],
        [
          'external_account.updated',
          PLATFORM,
          expect.objectContaining({ id: 'wa_fd_old' }),
          { previousAttributes: { default_for_currency: true } },
        ],
      ]);
      // Once repaired, the flag decides, and nothing more is written.
      await expect(wallets.GetDefaultWallet(PLATFORM)).resolves.toMatchObject({
        id: 'wa_fd_kept',
        default_for_currency: true,
      });
      expect(emit).toHaveBeenCalledTimes(2);
    });

    it('repairs through the list endpoint too, and lists each wallet with its on-chain USDC', async () => {
      SeedWallet('wa_fd_first', OLD_WALLET, { default_for_currency: null });
      SeedWallet('wa_fd_second', VALID_WALLET, {
        default_for_currency: null,
        created: 2,
      });
      mockSettlement.GetUSDCBalance.mockImplementation(async (address) => {
        if (address === VALID_WALLET) throw new Error('rpc down');
        return 125.5;
      });

      const list = await wallets.ListExternalWallets(PLATFORM, {
        includeUsdcBalance: true,
      });

      expect(Stored('wa_fd_first').default_for_currency).toBe(true);
      expect(
        list.data.map((wallet) => [wallet.id, wallet.usdc_balance])
      ).toEqual([
        ['wa_fd_second', null],
        ['wa_fd_first', 125.5],
      ]);
      const plain = await wallets.ListExternalWallets(PLATFORM);
      expect(plain.data[0]).not.toHaveProperty('usdc_balance');
    });

    it('writes the account guard in every wallet change, so concurrent changes conflict', async () => {
      const guardWrites = jest.spyOn(memory, 'Set');

      await wallets.CreateExternalWallet(PLATFORM, {
        wallet_address: OLD_WALLET,
      });

      expect(guardWrites).toHaveBeenCalledWith(
        'ExternalWalletGuards',
        PLATFORM,
        { id: PLATFORM, updated: GetFixedTimestamp() },
        expect.anything()
      );
    });

    it('retries a wallet change once after a write conflict', async () => {
      SeedWallet('wa_fd_old', OLD_WALLET, { default_for_currency: true });
      const run = memory.RunTransaction.bind(memory);
      const conflict = Object.assign(new Error('WriteConflict'), {
        code: 112,
      });
      const transactions = jest
        .spyOn(memory, 'RunTransaction')
        .mockRejectedValueOnce(conflict)
        .mockImplementation(run);

      const wallet = await wallets.CreateExternalWallet(PLATFORM, {
        wallet_address: VALID_WALLET,
        default_for_currency: true,
      });

      expect(transactions).toHaveBeenCalledTimes(2);
      expect(Stored(wallet.id).default_for_currency).toBe(true);
      expect(Stored('wa_fd_old').default_for_currency).toBe(false);

      transactions.mockReset();
      transactions.mockRejectedValue(conflict);
      await expect(
        wallets.CreateExternalWallet(PLATFORM, {
          wallet_address: VALID_WALLET_2,
        })
      ).rejects.toBe(conflict);
      expect(transactions).toHaveBeenCalledTimes(2);
    });

    describe('when two changes run at once', () => {
      /**
       * Mongo serializes the wallet transactions of one account: both write
       * its guard document, so one conflicts and is retried after the other.
       * MemoryDatabase stands in by running them one after the other.
       */
      beforeEach(() => {
        const run = memory.RunTransaction.bind(memory);
        let queue: Promise<unknown> = Promise.resolve();
        jest
          .spyOn(memory, 'RunTransaction')
          .mockImplementation(<T>(fn: (session: never) => Promise<T>) => {
            const next = queue.then(() => run(fn));
            queue = next.catch(() => undefined);
            return next;
          });
      });

      it('ends with exactly one default after two concurrent switches', async () => {
        SeedWallet('wa_fd_old', OLD_WALLET, { default_for_currency: true });

        await Promise.all([
          wallets.CreateExternalWallet(PLATFORM, {
            wallet_address: VALID_WALLET,
            default_for_currency: true,
          }),
          wallets.CreateExternalWallet(PLATFORM, {
            wallet_address: VALID_WALLET_2,
            default_for_currency: true,
          }),
        ]);

        const flagged = memory
          .All<ExternalWallet>('ExternalWallets')
          .filter((wallet) => wallet.default_for_currency === true);
        expect(flagged).toHaveLength(1);
        expect(memory.All('ExternalWallets')).toHaveLength(3);
      });

      it('lets only one of two concurrent adds take the fifth place', async () => {
        for (let i = 1; i <= 4; i++) {
          SeedWallet(`wa_fd_${i}`, OLD_WALLET, {
            default_for_currency: i === 1,
          });
        }

        const results = await Promise.allSettled([
          wallets.CreateExternalWallet(PLATFORM, {
            wallet_address: VALID_WALLET,
          }),
          wallets.CreateExternalWallet(PLATFORM, {
            wallet_address: VALID_WALLET_2,
          }),
        ]);

        expect(results.map((result) => result.status).sort()).toEqual([
          'fulfilled',
          'rejected',
        ]);
        expect(
          memory
            .All<ExternalWallet>('ExternalWallets')
            .filter((wallet) => wallet.status !== 'archived')
        ).toHaveLength(5);
      });
    });

    describe('switching the platform default', () => {
      beforeEach(() => {
        SeedWallet('wa_fd_old', OLD_WALLET, { default_for_currency: true });
      });

      it('creates the new default and unsets the old one in one transaction, then moves the plans', async () => {
        SeedPrice({ id: 'price_fd_a' });
        SeedPrice({ id: 'price_fd_b' });
        SeedPrice({ id: 'price_fd_inactive', active: false });
        SeedPrice({
          id: 'price_fd_sim',
          subscription_plan_id: 'sim_plan_price_fd_sim',
        });
        const transactions = jest.spyOn(memory, 'RunTransaction');

        const wallet = await wallets.CreateExternalWallet(PLATFORM, {
          wallet_address: VALID_WALLET,
          default_for_currency: true,
        });

        expect(transactions).toHaveBeenCalledTimes(1);
        expect(wallet.default_for_currency).toBe(true);
        expect(Stored('wa_fd_old').default_for_currency).toBe(false);
        expect((await wallets.GetDefaultWallet(PLATFORM))?.id).toBe(wallet.id);
        const Change = (id: string) =>
          memory.Doc<Price>('Prices', id).subscription_plan_destination_change;
        for (const id of ['price_fd_a', 'price_fd_b']) {
          expect(Change(id)).toMatchObject({
            destination: VALID_WALLET,
            status: 'pending',
            transaction_hash: MOCK_DESTINATION_HASH,
          });
        }
        expect(Change('price_fd_inactive')).toBeNull();
        expect(Change('price_fd_sim')).toMatchObject({
          destination: VALID_WALLET,
          status: 'confirmed',
          transaction_hash: null,
        });
        expect(mockSettlement.SetPlanDestination).toHaveBeenCalledTimes(2);
      });

      it('replaces the default in one transaction with archive_previous, even at 5 wallets', async () => {
        for (let i = 2; i <= 5; i++) {
          SeedWallet(`wa_fd_${i}`, VALID_WALLET_2, {
            default_for_currency: false,
          });
        }
        const transactions = jest.spyOn(memory, 'RunTransaction');

        const wallet = await wallets.CreateExternalWallet(PLATFORM, {
          wallet_address: VALID_WALLET,
          default_for_currency: true,
          archive_previous: true,
        });

        expect(transactions).toHaveBeenCalledTimes(1);
        expect(Stored(wallet.id).default_for_currency).toBe(true);
        expect(Stored('wa_fd_old')).toMatchObject({
          status: 'archived',
          archived_at: GetFixedTimestamp(),
          default_for_currency: false,
        });
        expect(emit).toHaveBeenCalledWith(
          'external_account.deleted',
          PLATFORM,
          expect.objectContaining({ id: 'wa_fd_old' })
        );
        expect(emit).not.toHaveBeenCalledWith(
          'external_account.updated',
          PLATFORM,
          expect.objectContaining({ id: 'wa_fd_old' }),
          expect.anything()
        );
      });

      it('refuses archive_previous without default_for_currency: true', async () => {
        await expect(
          wallets.CreateExternalWallet(PLATFORM, {
            wallet_address: VALID_WALLET,
            archive_previous: true,
          })
        ).rejects.toThrow(
          'archive_previous can only be used with default_for_currency: true'
        );
      });

      it('emits one update per wallet, with the default flag it had stored', async () => {
        SeedWallet('wa_fd_new', VALID_WALLET, {
          default_for_currency: null,
          metadata: { label: 'spare' },
        });
        SeedWallet('wa_fd_other', VALID_WALLET_2, {
          default_for_currency: null,
        });

        await wallets.UpdateExternalWallet('wa_fd_new', {
          default_for_currency: true,
          metadata: { label: 'treasury' },
        });

        const updates = emit.mock.calls.filter(
          ([type]) => type === 'external_account.updated'
        );
        expect(updates).toEqual([
          [
            'external_account.updated',
            PLATFORM,
            expect.objectContaining({
              id: 'wa_fd_new',
              default_for_currency: true,
              metadata: { label: 'treasury' },
            }),
            {
              previousAttributes: {
                default_for_currency: null,
                metadata: { label: 'spare' },
              },
            },
          ],
          [
            'external_account.updated',
            PLATFORM,
            expect.objectContaining({ id: 'wa_fd_old' }),
            { previousAttributes: { default_for_currency: true } },
          ],
          [
            'external_account.updated',
            PLATFORM,
            expect.objectContaining({ id: 'wa_fd_other' }),
            { previousAttributes: { default_for_currency: null } },
          ],
        ]);
      });

      it('sends at most 3 plan changes itself and says how many the billing run sends', async () => {
        for (const id of ['a', 'b', 'c', 'd', 'e']) {
          SeedPrice({ id: `price_fd_${id}` });
        }

        const wallet = await wallets.CreateExternalWallet(PLATFORM, {
          wallet_address: VALID_WALLET,
          default_for_currency: true,
        });

        expect(wallet.plan_migrations_queued).toBe(2);
        expect(mockSettlement.SetPlanDestination).toHaveBeenCalledTimes(3);
        const changes = memory
          .All<Price>('Prices')
          .map((price) => price.subscription_plan_destination_change);
        expect(changes.every((change) => change?.status === 'pending')).toBe(
          true
        );
        expect(
          changes.filter((change) => change?.transaction_hash === null)
        ).toHaveLength(2);
      });

      it('rolls the switch back when a step inside the transaction fails', async () => {
        SeedPrice({ id: 'price_fd_a' });
        jest
          .spyOn(PlanDestinationModule.prototype, 'Enqueue')
          .mockRejectedValueOnce(new Error('WriteConflict'));

        await expect(
          wallets.CreateExternalWallet(PLATFORM, {
            wallet_address: VALID_WALLET,
            default_for_currency: true,
          })
        ).rejects.toThrow('WriteConflict');

        expect(memory.All('ExternalWallets')).toHaveLength(1);
        expect(Stored('wa_fd_old').default_for_currency).toBe(true);
        expect(mockSettlement.SetPlanDestination).not.toHaveBeenCalled();
      });

      it('refuses with 409 payout_batch_in_progress while a batch of the old wallet is built or broadcast', async () => {
        SeedWallet('wa_fd_new', VALID_WALLET);
        memory.Seed('PayoutBatches', {
          id: 'pob_fd_1',
          platform_account: PLATFORM,
          chain_id: 11155111,
          wallet_address: OLD_WALLET,
          status: 'broadcast',
        });

        await expect(
          wallets.UpdateExternalWallet('wa_fd_new', {
            default_for_currency: true,
          })
        ).rejects.toMatchObject({
          statusCode: 409,
          type: 'payout_batch_in_progress',
        });
        expect(Stored('wa_fd_old').default_for_currency).toBe(true);
        expect(Stored('wa_fd_new').default_for_currency).toBe(false);
      });

      it('moves no plans and checks no payouts for a connected account', async () => {
        memory.Seed('ExternalWallets', {
          id: 'wa_fd_connected',
          account: CONNECTED,
          platform_account: PLATFORM,
          wallet_address: OLD_WALLET,
          default_for_currency: true,
          status: 'new',
          created: 1,
        });
        memory.Seed('PayoutBatches', {
          id: 'pob_fd_1',
          platform_account: CONNECTED,
          chain_id: 11155111,
          wallet_address: OLD_WALLET,
          status: 'built',
        });
        SeedPrice({ id: 'price_fd_a' });

        const wallet = await wallets.CreateExternalWallet(CONNECTED, {
          wallet_address: VALID_WALLET,
          default_for_currency: true,
        });

        expect((await wallets.GetDefaultWallet(CONNECTED))?.id).toBe(wallet.id);
        expect(Stored('wa_fd_connected').default_for_currency).toBe(false);
        expect(mockSettlement.SetPlanDestination).not.toHaveBeenCalled();
      });
    });
  });
});
