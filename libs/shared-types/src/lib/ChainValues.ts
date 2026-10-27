// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Formats of on-chain values shared by the API, its schemas and clients.
 */

/** An Ethereum transaction hash: `0x` followed by 64 hex characters. */
export const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export function IsTransactionHash(value: string): boolean {
  return TRANSACTION_HASH_PATTERN.test(value);
}

/** Address equality ignoring case; false when either side is missing. */
export function SameAddress(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}
