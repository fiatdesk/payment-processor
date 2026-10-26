// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { Injectable, signal, WritableSignal } from '@angular/core';
import type {
  Address,
  Hex,
  TypedData,
  TypedDataDefinition,
  WalletClient,
} from 'viem';
import { getAddress } from 'viem/utils';

/** The EIP-1193 surface the dashboard and checkout use. */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown }): Promise<unknown>;
}

/** EIP-6963 announcement payload. */
export interface Eip6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

export interface GeneratedWallet {
  address: Address;
  privateKey: Hex;
}

/** Fields the unsigned transaction must match before a local key signs it. */
export interface ExpectedTransaction {
  from: string;
  to: string;
  chainId: number;
}

/** Wallets that never answer EIP-6963 get picked up from window.ethereum. */
const INJECTED_FALLBACK_DELAY_MS = 300;
/** EIP-1193 / EIP-3085: the wallet does not know the requested chain. */
const UNRECOGNIZED_CHAIN_CODE = 4902;
const SEPOLIA_CHAIN_ID = 11155111;
const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;

/**
 * Browser wallet access: EIP-6963 discovery (with a `window.ethereum`
 * fallback), connect, chain switching, typed-data signing and transaction
 * sending, plus local key helpers for the setup wizard and payouts.
 * viem's client and signing code loads on first use, keeping it out of the
 * initial bundle.
 */
@Injectable({ providedIn: 'root' })
export class WalletService {
  readonly wallet: WritableSignal<Eip6963ProviderDetail | null> = signal(null);
  readonly account: WritableSignal<Address | null> = signal(null);

  constructor() {
    if (typeof window === 'undefined') return;

    window.addEventListener('eip6963:announceProvider', (event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (detail?.provider && !this.wallet()) this.wallet.set(detail);
    });
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    setTimeout(() => {
      const injected = (window as { ethereum?: Eip1193Provider }).ethereum;
      if (injected && !this.wallet()) {
        this.wallet.set({
          info: {
            uuid: 'injected',
            name: 'Browser wallet',
            icon: '',
            rdns: '',
          },
          provider: injected,
        });
      }
    }, INJECTED_FALLBACK_DELAY_MS);
  }

  HasWallet(): boolean {
    return this.wallet() !== null;
  }

  WalletName(): string {
    return this.wallet()?.info.name ?? '';
  }

  /** Requests account access and returns the checksummed address. */
  async Connect(): Promise<Address> {
    const [address] = await (await this.Client()).requestAddresses();
    if (!address) throw new Error('The wallet did not return an account');
    const checksummed = getAddress(address);
    this.account.set(checksummed);
    return checksummed;
  }

  Disconnect(): void {
    this.account.set(null);
  }

  GetAddress(): string {
    return this.account() ?? '';
  }

  /** Switches the wallet to `chainId`, adding Sepolia if the wallet lacks it. */
  async EnsureChain(chainId: number): Promise<void> {
    const client = await this.Client();
    if ((await client.getChainId()) === chainId) return;
    try {
      await client.switchChain({ id: chainId });
    } catch (error) {
      if (chainId !== SEPOLIA_CHAIN_ID || !IsUnrecognizedChainError(error)) {
        throw error;
      }
      const { sepolia } = await import('./wallet-viem');
      await client.addChain({ chain: sepolia });
    }
  }

  /** Signs EIP-712 typed data with `eth_signTypedData_v4`. */
  async SignTypedData<
    const typedData extends TypedData | Record<string, unknown>,
    primaryType extends keyof typedData | 'EIP712Domain'
  >(typedData: TypedDataDefinition<typedData, primaryType>): Promise<Hex> {
    const account = this.RequireAccount();
    return (await this.Client()).signTypedData({
      ...typedData,
      account,
    } as Parameters<WalletClient['signTypedData']>[0]);
  }

  /** Sends a transaction from the wallet and returns its hash. */
  async SendTransaction(transaction: {
    to: Address;
    data: Hex;
    value?: bigint;
  }): Promise<Hex> {
    const account = this.RequireAccount();
    return (await this.Client()).sendTransaction({
      account,
      chain: null,
      to: transaction.to,
      data: transaction.data,
      value: transaction.value ?? BigInt(0),
    });
  }

  /** New secp256k1 key generated in the browser; never sent anywhere. */
  async GenerateWallet(): Promise<GeneratedWallet> {
    const { generatePrivateKey, privateKeyToAccount } = await import(
      './wallet-viem'
    );
    const privateKey = generatePrivateKey();
    return { address: privateKeyToAccount(privateKey).address, privateKey };
  }

  async GetPrivateKeyAddress(privateKey: string): Promise<Address> {
    const { privateKeyToAccount } = await import('./wallet-viem');
    return privateKeyToAccount(ParsePrivateKey(privateKey)).address;
  }

  /**
   * Signs an unsigned serialized transaction with a pasted private key after
   * checking the signer, target contract and chain.
   */
  async SignTransactionWithPrivateKey(
    unsignedTransaction: string,
    privateKey: string,
    expected: ExpectedTransaction
  ): Promise<Hex> {
    const { parseTransaction, privateKeyToAccount } = await import(
      './wallet-viem'
    );
    const signer = privateKeyToAccount(ParsePrivateKey(privateKey));
    if (!IsSameAddress(signer.address, expected.from)) {
      throw new Error(
        'Private key does not match the configured platform wallet'
      );
    }

    const transaction = parseTransaction(unsignedTransaction as Hex);
    if (!transaction.to || !IsSameAddress(transaction.to, expected.to)) {
      throw new Error(
        'Payout transaction does not target the expected contract'
      );
    }
    if (transaction.chainId !== expected.chainId) {
      throw new Error('Payout transaction is for a different chain');
    }
    return signer.signTransaction(transaction);
  }

  private async Client(): Promise<WalletClient> {
    const detail = this.wallet();
    if (!detail) throw new Error('No wallet found');
    const { createWalletClient, custom } = await import('./wallet-viem');
    return createWalletClient({
      transport: custom(detail.provider, { retryCount: 0 }),
    });
  }

  private RequireAccount(): Address {
    const address = this.account();
    if (!address) throw new Error('Connect wallet first');
    return address;
  }
}

function ParsePrivateKey(privateKey: string): Hex {
  const trimmed = privateKey.trim();
  const prefixed = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  if (!PRIVATE_KEY_PATTERN.test(prefixed)) {
    throw new Error(
      'Invalid private key. Expected 0x followed by 64 hex characters.'
    );
  }
  return prefixed as Hex;
}

function IsSameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function IsUnrecognizedChainError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (code === UNRECOGNIZED_CHAIN_CODE) return true;
    current = cause;
  }
  return false;
}
