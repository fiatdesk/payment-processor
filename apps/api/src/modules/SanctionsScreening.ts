/**
 * @fileOverview OFAC Sanctions Screening Module
 *
 * Screens Ethereum wallet addresses against known sanctioned addresses.
 * Currently a static list; entries are EIP-55 checksummed and inputs are
 * normalised the same way before the lookup.
 *
 *
 * @module SanctionsScreening
 */

import { getAddress, isAddress } from 'viem';
import { Logger } from '../utils/Logger';

interface SanctionsCheckResult {
  isSanctioned: boolean;
  source: string;
}

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
    const normalized = isAddress(address) ? getAddress(address) : address;
    const isSanctioned = SANCTIONED_ADDRESSES.has(normalized);

    if (isSanctioned) {
      Logger.warn('Sanctioned address detected', {
        address: address.slice(0, 8) + '...',
      });
    }

    return {
      isSanctioned,
      source: 'OFAC SDN List',
    };
  }
}
