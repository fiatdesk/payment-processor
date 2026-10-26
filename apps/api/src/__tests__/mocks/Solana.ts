// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Jest stand-in for `modules/chains/Solana`.
 * Keeps unit tests from loading @solana/kit / @solana/subscriptions.
 */

import { CreateMockSettlement } from './Settlement';

export function PlanIdFromPriceId(_priceId: string): bigint {
  return BigInt(1);
}

/** Each instance carries the same jest stubs as `CreateMockSettlement()`. */
export class Solana {
  constructor() {
    Object.assign(this, CreateMockSettlement());
  }
}
