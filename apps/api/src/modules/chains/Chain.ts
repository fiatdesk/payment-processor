// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Chain selection and viem clients for the Ethereum rail. The resolved
 * config and the public client are memoised; tests that change the chain
 * env call ResetChainClientsForTests().
 *
 * @module chains/Chain
 */

import {
  createPublicClient,
  createWalletClient,
  fallback,
  getAddress,
  http,
  isAddress,
  type Address,
  type Chain as ViemChain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, mainnet, sepolia } from 'viem/chains';
import {
  GetChainConfig as GetChainEnvironment,
  ReloadRailSettingsForTests,
  type SupportedChainId,
} from '../AppConfig';
import { CHAIN_CONTRACTS, CHAIN_EXPLORERS } from './contracts';

export interface ChainConfig {
  chainId: SupportedChainId;
  rpcUrls: string[];
  confirmations: number;
  usdc: Address;
  payoutBatch: Address | null;
  subscriptions: Address | null;
  sanctionsOracle: Address | null;
  /** Explorer origin, empty when the chain has none (Anvil). */
  explorer: string;
}

const VIEM_CHAINS: Record<SupportedChainId, ViemChain> = {
  1: mainnet,
  11155111: sepolia,
  31337: foundry,
};

let chainConfig: ChainConfig | null = null;
let publicClient: PublicClient | null = null;
let generation = 0;

/** Chain id, RPC URLs and contract addresses (env overrides applied). */
export function GetChainConfig(): ChainConfig {
  if (!chainConfig) chainConfig = ResolveChainConfig();
  return chainConfig;
}

export function GetPublicClient(): PublicClient {
  if (!publicClient) {
    const { chainId, rpcUrls } = GetChainConfig();
    publicClient = createPublicClient({
      chain: VIEM_CHAINS[chainId],
      transport: Transport(rpcUrls),
    });
  }
  return publicClient;
}

export function GetWalletClient(privateKey: Hex): WalletClient {
  const { chainId, rpcUrls } = GetChainConfig();
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: VIEM_CHAINS[chainId],
    transport: Transport(rpcUrls),
  });
}

/**
 * True when the chain has no Multicall3 deployment (Anvil); viem then runs
 * multicall reads deployless, through `eth_call` with the bytecode inline.
 */
export function IsDeploylessMulticall(): boolean {
  return !VIEM_CHAINS[GetChainConfig().chainId].contracts?.multicall3;
}

/** Changes on every reset so callers can drop state tied to old clients. */
export function ChainClientsGeneration(): number {
  return generation;
}

/** Re-reads the rail and chain env and drops every client built from it. */
export function ResetChainClientsForTests(): void {
  ReloadRailSettingsForTests();
  chainConfig = null;
  publicClient = null;
  generation += 1;
}

function ResolveChainConfig(): ChainConfig {
  const { chainId, rpcUrls, confirmations } = GetChainEnvironment();
  const contracts = CHAIN_CONTRACTS[chainId];
  const usdc = AddressSetting('USDC_ADDRESS', contracts.usdc);
  if (!usdc) {
    throw new Error(`USDC_ADDRESS is required on chain ${chainId}`);
  }
  return {
    chainId,
    rpcUrls,
    confirmations,
    usdc,
    payoutBatch: AddressSetting('PAYOUT_BATCH_ADDRESS', contracts.payoutBatch),
    subscriptions: AddressSetting(
      'SUBSCRIPTIONS_ADDRESS',
      contracts.subscriptions
    ),
    sanctionsOracle: AddressSetting(
      'SANCTIONS_ORACLE_ADDRESS',
      contracts.sanctionsOracle
    ),
    explorer: CHAIN_EXPLORERS[chainId],
  };
}

/** The env override or the per-chain default, validated and EIP-55. */
function AddressSetting(
  name: string,
  defaultAddress: Address | null
): Address | null {
  const value = (process.env[name] || '').trim();
  if (!value) return defaultAddress ? getAddress(defaultAddress) : null;
  if (!isAddress(value)) {
    throw new Error(`${name} must be a valid Ethereum address`);
  }
  return getAddress(value);
}

function Transport(rpcUrls: string[]) {
  if (rpcUrls.length === 0) {
    throw new Error('ETH_RPC_URL is required when SETTLEMENT_RAIL=onchain');
  }
  return fallback(rpcUrls.map((url) => http(url)));
}
