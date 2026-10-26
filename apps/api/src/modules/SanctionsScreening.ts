// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * @fileOverview OFAC Sanctions Screening Module
 *
 * Screens Ethereum wallet addresses against a static list of sanctioned
 * addresses (EIP-55) and, on-chain, the Chainalysis sanctions oracle when
 * the chain has one (SANCTIONS_ORACLE_ADDRESS). The simulated rail skips
 * the oracle. An oracle RPC failure is logged and does not block.
 *
 * @module SanctionsScreening
 */

import { getAddress, isAddress, parseAbi, type Address } from 'viem';
import { Logger } from '../utils/Logger';
import {
  GetChainConfig,
  GetPublicClient,
  IsDeploylessMulticall,
} from './chains/Chain';
import { IsSimulatedSettlement } from './chains/Settlement';

interface SanctionsCheckResult {
  isSanctioned: boolean;
  source: string;
}

const SANCTIONS_ORACLE_ABI = parseAbi([
  'function isSanctioned(address addr) view returns (bool)',
]);

// Hardcoded list of sanctioned Ethereum addresses (EIP-55 checksummed).
// Add addresses here as OFAC designates them
const SANCTIONED_ADDRESSES: Set<string> = new Set([
  // Example format (not a real sanctioned address):
  // '0x00000000000000000000000000000000DeaDBeef',
]);

export class SanctionsScreeningModule {
  /**
   * Check if a wallet address is on the sanctions list.
   *
   * @param address - The wallet address to check
   * @returns SanctionsCheckResult indicating if address is sanctioned
   */
  async CheckWalletAddress(address: string): Promise<SanctionsCheckResult> {
    const sanctioned = await this.CheckWalletAddresses([address]);
    return {
      isSanctioned: sanctioned.length > 0,
      source: 'OFAC SDN List',
    };
  }

  /**
   * Screens several addresses at once.
   *
   * @param addresses - Wallet addresses to check
   * @returns The sanctioned addresses (EIP-55 when valid), in input order
   */
  async CheckWalletAddresses(addresses: string[]): Promise<string[]> {
    const normalized = [
      ...new Set(addresses.map((a) => (isAddress(a) ? getAddress(a) : a))),
    ];
    const sanctioned = new Set(
      normalized.filter((address) => SANCTIONED_ADDRESSES.has(address))
    );
    for (const address of await this.CheckOracle(normalized)) {
      sanctioned.add(address);
    }

    const flagged = normalized.filter((address) => sanctioned.has(address));
    for (const address of flagged) {
      Logger.warn('Sanctioned address detected', {
        address: address.slice(0, 8) + '...',
      });
    }
    return flagged;
  }

  /** Addresses the chain's sanctions oracle flags; none when unavailable. */
  private async CheckOracle(addresses: string[]): Promise<Address[]> {
    const candidates = addresses.filter((a): a is Address => isAddress(a));
    if (candidates.length === 0 || IsSimulatedSettlement()) return [];
    try {
      const oracle = GetChainConfig().sanctionsOracle;
      if (!oracle) return [];
      const results = await GetPublicClient().multicall({
        contracts: candidates.map((address) => ({
          address: oracle,
          abi: SANCTIONS_ORACLE_ABI,
          functionName: 'isSanctioned' as const,
          args: [address] as const,
        })),
        allowFailure: false,
        deployless: IsDeploylessMulticall(),
      });
      return candidates.filter((_, i) => results[i]);
    } catch (error) {
      Logger.warn(
        'Sanctions oracle check failed; screening with the static list only',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return [];
    }
  }
}
