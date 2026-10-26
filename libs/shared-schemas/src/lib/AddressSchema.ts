// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { isAddress } from 'viem/utils';
import { z } from 'zod';

/**
 * An Ethereum address: all-lowercase or correctly EIP-55 checksummed.
 * Modules normalise accepted values with `getAddress` before storing them.
 * The callback returns a plain boolean so the inferred input type stays
 * `string` for API and SDK callers.
 */
export const EthereumAddressSchema = z
  .string()
  .refine((v): boolean => isAddress(v), 'Must be a valid Ethereum address');
