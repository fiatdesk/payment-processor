// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  GetChainConfig,
  GetCheckoutRelayerKey,
  IsCheckoutRelayed,
  RequireSubscriptionOperatorKey,
} from '../modules/AppConfig';

const RELAYER_KEY =
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';
const OPERATOR_KEY =
  '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a';

const ENV_KEYS = [
  'LIVEMODE',
  'SETTLEMENT_RAIL',
  'APP_SECRET',
  'ETH_CHAIN_ID',
  'ETH_RPC_URL',
  'ETH_CONFIRMATIONS',
  'CHECKOUT_RELAYER_KEY',
  'SUBSCRIPTION_OPERATOR_KEY',
];

describe('AppConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('private key settings', () => {
    it('returns null and disables relaying without CHECKOUT_RELAYER_KEY', () => {
      expect(GetCheckoutRelayerKey()).toBeNull();
      expect(IsCheckoutRelayed()).toBe(false);
    });

    it('returns a well-formed CHECKOUT_RELAYER_KEY', () => {
      process.env.CHECKOUT_RELAYER_KEY = RELAYER_KEY;

      expect(GetCheckoutRelayerKey()).toBe(RELAYER_KEY);
      expect(IsCheckoutRelayed()).toBe(true);
    });

    it('rejects a malformed CHECKOUT_RELAYER_KEY', () => {
      process.env.CHECKOUT_RELAYER_KEY = 'abc';

      expect(() => GetCheckoutRelayerKey()).toThrow(
        'CHECKOUT_RELAYER_KEY must be 0x followed by 64 hex characters'
      );
    });

    it('requires SUBSCRIPTION_OPERATOR_KEY for recurring plans', () => {
      expect(() => RequireSubscriptionOperatorKey()).toThrow(
        'SUBSCRIPTION_OPERATOR_KEY is required for recurring subscription plans'
      );
    });

    it('rejects a SUBSCRIPTION_OPERATOR_KEY without the 0x hex format', () => {
      process.env.SUBSCRIPTION_OPERATOR_KEY =
        '4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw7nU3nQ4F5mEsfRdcUoWbjvskdmSRCFQzc6W6n9NxGanfB';

      expect(() => RequireSubscriptionOperatorKey()).toThrow(
        'SUBSCRIPTION_OPERATOR_KEY must be 0x followed by 64 hex characters'
      );
    });

    it('returns a well-formed SUBSCRIPTION_OPERATOR_KEY', () => {
      process.env.SUBSCRIPTION_OPERATOR_KEY = OPERATOR_KEY;

      expect(RequireSubscriptionOperatorKey()).toBe(OPERATOR_KEY);
    });

    it('fails at startup when a configured key is malformed', () => {
      process.env.CHECKOUT_RELAYER_KEY = 'abc';

      jest.isolateModules(() => {
        const config = require('../modules/AppConfig');
        expect(() => config.GetAppConfig()).toThrow(/CHECKOUT_RELAYER_KEY/);
      });
    });
  });

  describe('ReloadRailSettingsForTests', () => {
    it('lets ResetChainClientsForTests move a memoised simulated rail on-chain', () => {
      jest.isolateModules(() => {
        const appConfig: typeof import('../modules/AppConfig') = require('../modules/AppConfig');
        const chain: typeof import('../modules/chains/Chain') = require('../modules/chains/Chain');
        const settlement: typeof import('../modules/chains/Settlement') = require('../modules/chains/Settlement');
        const {
          Ethereum,
        }: typeof import('../modules/chains/Ethereum') = require('../modules/chains/Ethereum');

        const memoised = appConfig.GetAppConfig();
        memoised.appSecret = 'secret-from-the-database';
        expect(settlement.GetSettlement()).toBeInstanceOf(
          settlement.SimulatedSettlement
        );

        process.env.SETTLEMENT_RAIL = 'onchain';
        expect(settlement.IsSimulatedSettlement()).toBe(true);
        chain.ResetChainClientsForTests();

        expect(appConfig.GetAppConfig()).toBe(memoised);
        expect(memoised).toMatchObject({
          livemode: false,
          settlement_rail: 'onchain',
          appSecret: 'secret-from-the-database',
        });
        expect(settlement.GetSettlement()).toBeInstanceOf(Ethereum);
      });
    });

    it('re-reads LIVEMODE into the memoised config', () => {
      jest.isolateModules(() => {
        const appConfig: typeof import('../modules/AppConfig') = require('../modules/AppConfig');
        expect(appConfig.GetAppConfig().livemode).toBe(false);

        process.env.LIVEMODE = 'true';
        appConfig.ReloadRailSettingsForTests();

        expect(appConfig.GetAppConfig()).toMatchObject({
          livemode: true,
          settlement_rail: 'onchain',
        });
      });
    });
  });

  describe('GetChainConfig', () => {
    it('defaults test mode to Sepolia with two confirmations', () => {
      expect(GetChainConfig()).toEqual({
        chainId: 11155111,
        rpcUrls: [],
        confirmations: 2,
      });
    });

    it('uses Ethereum mainnet in live mode', () => {
      process.env.LIVEMODE = 'true';
      process.env.ETH_RPC_URL = 'https://rpc-a.example.com';

      expect(GetChainConfig()).toEqual({
        chainId: 1,
        rpcUrls: ['https://rpc-a.example.com'],
        confirmations: 2,
      });
    });

    it('honours ETH_CHAIN_ID=31337 in test mode', () => {
      process.env.ETH_CHAIN_ID = '31337';
      process.env.ETH_CONFIRMATIONS = '1';
      process.env.ETH_RPC_URL =
        'http://127.0.0.1:8545,, http://127.0.0.1:8546 ';

      expect(GetChainConfig()).toEqual({
        chainId: 31337,
        rpcUrls: ['http://127.0.0.1:8545', 'http://127.0.0.1:8546'],
        confirmations: 1,
      });
    });

    it('throws when ETH_CHAIN_ID is set in live mode', () => {
      process.env.LIVEMODE = 'true';
      process.env.ETH_CHAIN_ID = '1';

      expect(() => GetChainConfig()).toThrow(
        'ETH_CHAIN_ID is only allowed when LIVEMODE=false'
      );
    });

    it('rejects a test-mode ETH_CHAIN_ID that is not Sepolia or Anvil', () => {
      process.env.ETH_CHAIN_ID = '1';

      expect(() => GetChainConfig()).toThrow(
        'ETH_CHAIN_ID must be 11155111 (Sepolia) or 31337 (Anvil)'
      );
    });

    it('rejects a non-positive ETH_CONFIRMATIONS', () => {
      process.env.ETH_CONFIRMATIONS = '0';

      expect(() => GetChainConfig()).toThrow(
        'ETH_CONFIRMATIONS must be a positive integer'
      );
    });
  });
});
