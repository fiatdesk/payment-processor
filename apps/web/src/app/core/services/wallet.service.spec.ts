/** @jest-environment node */
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.

import {
  keccak256,
  parseTransaction,
  recoverTransactionAddress,
  serializeTransaction,
  type Hex,
  type TypedDataDefinition,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  Eip1193Provider,
  IsUserRejectedError,
  WalletNotReadyError,
  WalletService,
} from './wallet.service';

/** Anvil default account #1 (public test key). */
const PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const PAYOUT_BATCH = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

class FakeWindow extends EventTarget {
  location = { origin: 'https://pay.example.com' };
  ethereum?: Eip1193Provider;
}

function FakeProvider(
  handlers: Record<string, (params: unknown) => unknown> = {}
): Eip1193Provider & { request: jest.Mock } {
  return {
    request: jest.fn(async ({ method, params }) => {
      const handler = handlers[method];
      if (!handler) throw new Error(`Unexpected method ${method}`);
      return handler(params);
    }),
  };
}

/** A wallet whose active chain and account change like a real one. */
function StatefulProvider(options: {
  chainId: number;
  account?: string;
  knows?: number[];
  addSwitches?: boolean;
  errorForUnknown?: () => unknown;
}): Eip1193Provider & { request: jest.Mock; state: { chainId: number } } {
  const state = { chainId: options.chainId };
  const known = new Set([options.chainId, ...(options.knows ?? [])]);
  const provider = FakeProvider({
    eth_requestAccounts: () => [options.account ?? ADDRESS],
    eth_accounts: () => [options.account ?? ADDRESS],
    eth_chainId: () => `0x${state.chainId.toString(16)}`,
    eth_sendTransaction: () => `0x${'cd'.repeat(32)}`,
    wallet_switchEthereumChain: (params) => {
      const id = Number((params as [{ chainId: string }])[0].chainId);
      if (!known.has(id)) {
        throw (
          options.errorForUnknown?.() ??
          Object.assign(new Error('Unrecognized chain'), { code: 4902 })
        );
      }
      state.chainId = id;
      return null;
    },
    wallet_addEthereumChain: (params) => {
      const id = Number((params as [{ chainId: string }])[0].chainId);
      known.add(id);
      if (options.addSwitches) state.chainId = id;
      return null;
    },
  });
  return Object.assign(provider, { state });
}

/** The request objects the provider received, in order. */
function Requests(provider: { request: jest.Mock }): unknown[] {
  return provider.request.mock.calls.map(([request]) => request);
}

function Announce(
  fakeWindow: FakeWindow,
  provider: Eip1193Provider,
  name = 'Test Wallet'
): void {
  fakeWindow.dispatchEvent(
    Object.assign(new Event('eip6963:announceProvider'), {
      detail: {
        info: { uuid: name, name, icon: '', rdns: 'com.example.wallet' },
        provider,
      },
    })
  );
}

function UnsignedPayout(overrides: { to?: Hex; chainId?: number } = {}): Hex {
  return serializeTransaction({
    type: 'eip1559',
    chainId: overrides.chainId ?? 11155111,
    nonce: 7,
    to: overrides.to ?? PAYOUT_BATCH,
    data: '0x1234',
    value: BigInt(0),
    gas: BigInt(100000),
    maxFeePerGas: BigInt(30000000000),
    maxPriorityFeePerGas: BigInt(1000000000),
  });
}

describe('WalletService', () => {
  let fakeWindow: FakeWindow;

  beforeEach(() => {
    jest.useFakeTimers();
    fakeWindow = new FakeWindow();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: fakeWindow,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (globalThis as { window?: unknown }).window;
  });

  describe('EIP-6963 discovery', () => {
    it('picks up a provider announced in response to requestProvider', () => {
      const provider = FakeProvider();
      fakeWindow.addEventListener('eip6963:requestProvider', () =>
        Announce(fakeWindow, provider)
      );

      const service = new WalletService();

      expect(service.HasWallet()).toBe(true);
      expect(service.WalletName()).toBe('Test Wallet');
    });

    it('falls back to window.ethereum after 300 ms', () => {
      fakeWindow.ethereum = FakeProvider();
      const service = new WalletService();

      expect(service.HasWallet()).toBe(false);
      jest.advanceTimersByTime(300);
      expect(service.HasWallet()).toBe(true);
    });

    it('keeps the first announced provider', () => {
      const service = new WalletService();
      const first = FakeProvider();
      Announce(fakeWindow, first, 'First');
      Announce(fakeWindow, FakeProvider(), 'Second');

      expect(service.WalletName()).toBe('First');
    });
  });

  describe('with a connected provider', () => {
    let provider: ReturnType<typeof FakeProvider>;
    let service: WalletService;

    beforeEach(() => {
      provider = FakeProvider({
        eth_requestAccounts: () => [ADDRESS.toLowerCase()],
        eth_signTypedData_v4: () => '0xsigned',
        eth_sendTransaction: () => `0x${'ab'.repeat(32)}`,
        eth_chainId: () => '0xaa36a7',
        wallet_switchEthereumChain: () => null,
      });
      service = new WalletService();
      Announce(fakeWindow, provider);
    });

    it('connects and returns a checksummed address', async () => {
      await expect(service.Connect()).resolves.toBe(ADDRESS);
      expect(service.GetAddress()).toBe(ADDRESS);
      expect(Requests(provider)).toContainEqual({
        method: 'eth_requestAccounts',
      });
    });

    it('forwards typed data to eth_signTypedData_v4', async () => {
      await service.Connect();
      const typedData = {
        domain: { name: 'USD Coin', version: '2', chainId: 11155111 },
        types: { Ping: [{ name: 'value', type: 'uint256' }] },
        primaryType: 'Ping',
        message: { value: BigInt(5) },
      } as const satisfies TypedDataDefinition;

      await expect(service.SignTypedData(typedData)).resolves.toBe('0xsigned');

      const call = provider.request.mock.calls.find(
        ([request]) => request.method === 'eth_signTypedData_v4'
      )?.[0];
      expect(call.params[0]).toBe(ADDRESS);
      expect(JSON.parse(call.params[1])).toEqual({
        domain: { name: 'USD Coin', version: '2', chainId: 11155111 },
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
          ],
          Ping: [{ name: 'value', type: 'uint256' }],
        },
        primaryType: 'Ping',
        message: { value: '5' },
      });
    });

    it('sends a transaction on the asserted chain and returns its hash', async () => {
      provider.request.mockImplementation(async ({ method }) =>
        method === 'eth_accounts'
          ? [ADDRESS.toLowerCase()]
          : method === 'eth_chainId'
          ? '0xaa36a7'
          : `0x${'ab'.repeat(32)}`
      );

      await expect(
        service.SendTransaction({
          from: ADDRESS,
          to: PAYOUT_BATCH,
          data: '0x1234',
          chainId: 11155111,
        })
      ).resolves.toBe(`0x${'ab'.repeat(32)}`);
      // The account and chain are read right before the send (viem checks
      // the chain once more itself).
      expect(Requests(provider)).toEqual([
        { method: 'eth_accounts' },
        { method: 'eth_chainId' },
        { method: 'eth_chainId' },
        {
          method: 'eth_sendTransaction',
          params: [
            { from: ADDRESS, to: PAYOUT_BATCH, data: '0x1234', value: '0x0' },
          ],
        },
      ]);
      expect(service.GetAddress()).toBe(ADDRESS);
    });

    it('skips the chain switch when the wallet is already on the chain', async () => {
      await service.EnsureChain(11155111);

      expect(Requests(provider)).not.toContainEqual(
        expect.objectContaining({ method: 'wallet_switchEthereumChain' })
      );
    });

    it('switches chains when the wallet is elsewhere', async () => {
      const stateful = StatefulProvider({ chainId: 11155111, knows: [1] });
      service = new WalletService();
      Announce(fakeWindow, stateful);

      await service.EnsureChain(1);

      expect(Requests(stateful)).toContainEqual({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }],
      });
      expect(stateful.state.chainId).toBe(1);
    });

    it('adds Sepolia when the wallet does not know it', async () => {
      provider = StatefulProvider({ chainId: 1, addSwitches: true });
      service = new WalletService();
      Announce(fakeWindow, provider);

      await service.EnsureChain(11155111);

      const addCall = provider.request.mock.calls.find(
        ([request]) => request.method === 'wallet_addEthereumChain'
      )?.[0];
      expect(addCall.params[0]).toMatchObject({
        chainId: '0xaa36a7',
        chainName: 'Sepolia',
        nativeCurrency: { symbol: 'ETH', decimals: 18 },
      });
    });
  });

  describe('chain and account checks before sending', () => {
    function Use(provider: Eip1193Provider): WalletService {
      const service = new WalletService();
      Announce(fakeWindow, provider);
      return service;
    }

    const send = {
      from: ADDRESS,
      to: PAYOUT_BATCH,
      data: '0x1234',
      chainId: 11155111,
    } as const;

    it('refuses to send while the wallet is on another chain', async () => {
      const provider = StatefulProvider({ chainId: 1 });

      await expect(Use(provider).SendTransaction(send)).rejects.toThrow(
        'The wallet is on chain 1, not 11155111. Switch networks in the wallet and try again.'
      );
      expect(Requests(provider)).not.toContainEqual(
        expect.objectContaining({ method: 'eth_sendTransaction' })
      );
    });

    it("treats viem's chain check failing as not sent", async () => {
      const provider = StatefulProvider({ chainId: 11155111 });
      let reads = 0;
      provider.request.mockImplementation(async ({ method }) => {
        if (method === 'eth_accounts') return [ADDRESS];
        // Our check sees Sepolia; the wallet switches before viem's own check.
        if (method === 'eth_chainId') return reads++ === 0 ? '0xaa36a7' : '0x1';
        return `0x${'cd'.repeat(32)}`;
      });

      const error = await Use(provider)
        .SendTransaction(send)
        .catch((e) => e);

      expect(error).toBeInstanceOf(WalletNotReadyError);
      expect(error.message).toBe(
        'The wallet switched networks before sending. Switch it back to chain 11155111 and try again.'
      );
      expect(Requests(provider)).not.toContainEqual(
        expect.objectContaining({ method: 'eth_sendTransaction' })
      );
    });

    it('re-reads the active account and refuses one that changed', async () => {
      const provider = StatefulProvider({
        chainId: 11155111,
        account: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      });

      await expect(Use(provider).SendTransaction(send)).rejects.toThrow(
        "The wallet's active account is not the platform wallet"
      );
      expect(Requests(provider)).toContainEqual({ method: 'eth_accounts' });
      expect(Requests(provider)).not.toContainEqual(
        expect.objectContaining({ method: 'eth_sendTransaction' })
      );
    });

    it('switches again when adding Sepolia did not switch to it', async () => {
      const provider = StatefulProvider({ chainId: 1 });
      const service = Use(provider);

      await service.EnsureChain(11155111);

      expect(provider.state.chainId).toBe(11155111);
      expect(
        Requests(provider)
          .map((request) => (request as { method: string }).method)
          .filter((method) => method.startsWith('wallet_'))
      ).toEqual([
        'wallet_switchEthereumChain',
        'wallet_addEthereumChain',
        'wallet_switchEthereumChain',
      ]);
    });

    it("recognises MetaMask Mobile's wrapped unrecognized-chain error", async () => {
      const provider = StatefulProvider({
        chainId: 1,
        addSwitches: true,
        errorForUnknown: () =>
          Object.assign(new Error('Internal error'), {
            code: -32603,
            data: { originalError: { code: 4902 } },
          }),
      });

      await Use(provider).EnsureChain(11155111);

      expect(provider.state.chainId).toBe(11155111);
      expect(Requests(provider)).toContainEqual(
        expect.objectContaining({ method: 'wallet_addEthereumChain' })
      );
    });

    it('does not add a chain for an unrelated internal error', async () => {
      const provider = StatefulProvider({
        chainId: 1,
        errorForUnknown: () =>
          Object.assign(new Error('Internal error'), { code: -32603 }),
      });

      await expect(Use(provider).EnsureChain(11155111)).rejects.toThrow();
      expect(Requests(provider)).not.toContainEqual(
        expect.objectContaining({ method: 'wallet_addEthereumChain' })
      );
    });

    it('fails when the wallet reports success but stays on another chain', async () => {
      const provider = StatefulProvider({ chainId: 1, knows: [11155111] });
      provider.request.mockImplementation(async ({ method }) =>
        method === 'eth_chainId' ? '0x1' : null
      );

      await expect(Use(provider).EnsureChain(11155111)).rejects.toThrow(
        'The wallet is on chain 1, not 11155111. Switch networks in the wallet and try again.'
      );
    });

    it('detects a user rejection anywhere in the error chain', () => {
      const rejected = Object.assign(new Error('User rejected the request.'), {
        code: 4001,
      });

      expect(IsUserRejectedError(rejected)).toBe(true);
      expect(
        IsUserRejectedError(
          Object.assign(new Error('wrapped'), { cause: rejected })
        )
      ).toBe(true);
      expect(IsUserRejectedError(new Error('RPC unavailable'))).toBe(false);
    });
  });

  describe('built transactions', () => {
    const service = new WalletService();

    it('hashes a signed transaction the way the chain does', async () => {
      const signed = await service.SignTransactionWithPrivateKey(
        UnsignedPayout(),
        PRIVATE_KEY,
        { from: ADDRESS, to: PAYOUT_BATCH, chainId: 11155111 }
      );

      await expect(service.SignedTransactionHash(signed)).resolves.toBe(
        keccak256(signed)
      );
    });

    it('reads the target and calldata of a built transaction', async () => {
      await expect(
        service.ReadBuiltTransaction(UnsignedPayout(), {
          to: PAYOUT_BATCH,
          chainId: 11155111,
        })
      ).resolves.toEqual({ to: PAYOUT_BATCH, data: '0x1234' });
    });

    it('rejects a built transaction aimed at another contract or chain', async () => {
      await expect(
        service.ReadBuiltTransaction(UnsignedPayout({ to: ADDRESS }), {
          to: PAYOUT_BATCH,
          chainId: 11155111,
        })
      ).rejects.toThrow(
        'Payout transaction does not target the expected contract'
      );
      await expect(
        service.ReadBuiltTransaction(UnsignedPayout({ chainId: 1 }), {
          to: PAYOUT_BATCH,
          chainId: 11155111,
        })
      ).rejects.toThrow('Payout transaction is for a different chain');
    });
  });

  describe('local keys', () => {
    const service = new WalletService();

    it('generates a wallet whose address matches its private key', async () => {
      const wallet = await service.GenerateWallet();

      expect(wallet.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
      expect(wallet.address).toBe(
        privateKeyToAccount(wallet.privateKey).address
      );
    });

    it('derives the checksummed address of a private key', async () => {
      await expect(service.GetPrivateKeyAddress(PRIVATE_KEY)).resolves.toBe(
        ADDRESS
      );
      await expect(
        service.GetPrivateKeyAddress(` ${PRIVATE_KEY.slice(2)} `)
      ).resolves.toBe(ADDRESS);
    });

    it('rejects malformed private keys', async () => {
      await expect(service.GetPrivateKeyAddress('not a key')).rejects.toThrow(
        'Invalid private key. Expected 0x followed by 64 hex characters.'
      );
    });

    it('signs a payout transaction with the matching key', async () => {
      const unsigned = UnsignedPayout();

      const signed = await service.SignTransactionWithPrivateKey(
        unsigned,
        PRIVATE_KEY,
        { from: ADDRESS, to: PAYOUT_BATCH, chainId: 11155111 }
      );

      await expect(
        recoverTransactionAddress({
          serializedTransaction: signed as Parameters<
            typeof recoverTransactionAddress
          >[0]['serializedTransaction'],
        })
      ).resolves.toBe(ADDRESS);
      expect(parseTransaction(signed)).toMatchObject({
        to: PAYOUT_BATCH.toLowerCase(),
        chainId: 11155111,
        nonce: 7,
      });
    });

    it('rejects a key for a different platform wallet', async () => {
      await expect(
        service.SignTransactionWithPrivateKey(UnsignedPayout(), PRIVATE_KEY, {
          from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          to: PAYOUT_BATCH,
          chainId: 11155111,
        })
      ).rejects.toThrow(
        'Private key does not match the configured platform wallet'
      );
    });

    it('rejects a transaction aimed at another contract', async () => {
      await expect(
        service.SignTransactionWithPrivateKey(
          UnsignedPayout({ to: ADDRESS }),
          PRIVATE_KEY,
          { from: ADDRESS, to: PAYOUT_BATCH, chainId: 11155111 }
        )
      ).rejects.toThrow(
        'Payout transaction does not target the expected contract'
      );
    });

    it('rejects a transaction for another chain', async () => {
      await expect(
        service.SignTransactionWithPrivateKey(
          UnsignedPayout({ chainId: 1 }),
          PRIVATE_KEY,
          { from: ADDRESS, to: PAYOUT_BATCH, chainId: 11155111 }
        )
      ).rejects.toThrow('Payout transaction is for a different chain');
    });
  });
});
