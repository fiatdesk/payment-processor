// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Per-chain contract addresses for the Ethereum rail. Each entry can be
 * overridden by its env variable (USDC_ADDRESS, PAYOUT_BATCH_ADDRESS,
 * SUBSCRIPTIONS_ADDRESS, SANCTIONS_ORACLE_ADDRESS). Reads that batch through
 * Multicall3 use the address bundled with viem's chain definitions.
 *
 * @module chains/contracts
 */

import type { Address } from 'viem';
import type { SupportedChainId } from '../AppConfig';

export interface ChainContracts {
  /** Circle USDC (6 decimals); Anvil deploys MockUSDC and injects it. */
  usdc: Address | null;
  payoutBatch: Address | null;
  subscriptions: Address | null;
  /** Chainalysis sanctions oracle, `isSanctioned(address)`. */
  sanctionsOracle: Address | null;
}

export const CHAIN_CONTRACTS: Record<SupportedChainId, ChainContracts> = {
  1: {
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    payoutBatch: null,
    subscriptions: null,
    sanctionsOracle: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb',
  },
  11155111: {
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    payoutBatch: null,
    subscriptions: null,
    sanctionsOracle: null,
  },
  31337: {
    usdc: null,
    payoutBatch: null,
    subscriptions: null,
    sanctionsOracle: null,
  },
};

/** Block explorer origin per chain; Anvil has none. */
export const CHAIN_EXPLORERS: Record<SupportedChainId, string> = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  31337: '',
};
