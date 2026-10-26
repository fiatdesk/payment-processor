// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { Ethereum, NotSupported } from './Ethereum';
import { GetChainConfig, ResetChainClientsForTests } from './Chain';
import type { Settlement } from './Settlement';
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

const ANVIL_USDC = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

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
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb9226',
      'D8VMZCmmTUUfhejNhNQKAmqvZCKfUq1qU6RqQKxQwXyX',
      '',
    ])('rejects %s', async (address) => {
      await expect(ethereum.CheckWalletExists(address)).resolves.toBe(false);
    });
  });

  describe('money flows', () => {
    it('rejects payout builds with not_supported', async () => {
      SetChainEnv({ LIVEMODE: 'false', SETTLEMENT_RAIL: 'onchain' });
      const ethereum: Settlement = new Ethereum();

      await expect(
        ethereum.BuildBatchPayoutTransaction(
          '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          [
            {
              destinationAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
              amountInCents: 500,
            },
          ]
        )
      ).rejects.toMatchObject({
        statusCode: 501,
        type: 'not_supported',
        message:
          'BuildBatchPayoutTransaction is not available on this settlement rail yet',
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
