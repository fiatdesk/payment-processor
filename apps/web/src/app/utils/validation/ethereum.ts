// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { getAddress, isAddress } from 'viem/utils';

/**
 * True for an all-lowercase or correctly EIP-55 checksummed Ethereum address.
 */
export function ValidateEthereumAddress(address: string): boolean {
  return !!address && isAddress(address);
}

/**
 * Returns a validation error message for an Ethereum address, or an empty
 * string if it is valid.
 */
export function GetEthereumAddressError(address: string): string {
  if (!address || !address.trim()) {
    return 'Please enter a wallet address';
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return 'Enter a 0x address with 40 hex characters';
  }
  if (!isAddress(address)) {
    return 'Address checksum is invalid. Paste the address exactly as your wallet shows it.';
  }
  return '';
}

/** EIP-55 checksummed form of a valid address; other input is returned as-is. */
export function NormalizeEthereumAddress(address: string): string {
  return isAddress(address) ? getAddress(address) : address;
}

/**
 * Etherscan link for a transaction or address: mainnet in live mode,
 * Sepolia in test mode.
 */
export function EtherscanUrl(
  type: 'tx' | 'address',
  value: string,
  livemode: boolean
): string {
  const origin = livemode
    ? 'https://etherscan.io'
    : 'https://sepolia.etherscan.io';
  return `${origin}/${type}/${value}`;
}

export const ETHEREUM_NETWORK = 'ethereum';
export const ETHEREUM_CURRENCY = 'usdc';
