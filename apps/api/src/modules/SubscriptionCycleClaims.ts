// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * @fileOverview Atomic claims on on-chain billing cycles.
 *
 * Before collecting a period from an on-chain subscription, its collector
 * (a checkout session or an invoice) inserts the claim
 * `${subscriptionOnchainId}:${dueAt}`, where `dueAt` is the grid point the
 * charge collects. Writes are insert-only, so exactly one actor owns a cycle.
 * The claim also holds the hash of the `charge` before it is sent, so a
 * collection that timed out or crashed is reconciled by that hash.
 *
 * @module SubscriptionCycleClaims
 */

import type { Database } from './Database';
import { Now } from '../utils/Timestamp';

const COLLECTION = 'SubscriptionCycleClaims';

/**
 * Subscription statuses that still bill. Mongo partial indexes cannot
 * express `status != 'canceled'`, so they list these instead.
 */
export const LIVE_SUBSCRIPTION_STATUSES = [
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'paused',
];

export interface SubscriptionCycleClaim {
  /** `${subscription_onchain_id}:${due_at}` */
  id: string;
  object: 'subscription_cycle_claim';
  subscription_onchain_id: string;
  /** The on-chain grid point (Unix seconds) the cycle's charge collects */
  due_at: number;
  /** The checkout session or invoice that collects this cycle */
  owner: string;
  /** The `charge` transaction, recorded before it is sent */
  charge_hash: string | null;
  /** When `charge_hash` was recorded, for re-pricing a stuck charge */
  charge_sent_at: number | null;
  created: number;
}

export function CycleClaimId(
  subscriptionOnchainId: string,
  dueAt: number
): string {
  return `${subscriptionOnchainId}:${dueAt}`;
}

export class SubscriptionCycleClaims {
  constructor(private readonly db: Database) {}

  /**
   * Claim the cycle for `owner`. Returns the claim and whether `owner` holds
   * it: an existing claim of the same owner (a retry) counts as held.
   */
  async Claim(
    subscriptionOnchainId: string,
    dueAt: number,
    owner: string
  ): Promise<{ claim: SubscriptionCycleClaim; owned: boolean }> {
    const id = CycleClaimId(subscriptionOnchainId, dueAt);
    const claim: SubscriptionCycleClaim = {
      id,
      object: 'subscription_cycle_claim',
      subscription_onchain_id: subscriptionOnchainId,
      due_at: dueAt,
      owner,
      charge_hash: null,
      charge_sent_at: null,
      created: Now(),
    };
    try {
      await this.db.AddID(COLLECTION, claim);
      return { claim, owned: true };
    } catch (error) {
      if (!IsDuplicateKey(error)) throw error;
      const existing = await this.db.Get<SubscriptionCycleClaim>(
        COLLECTION,
        id
      );
      if (!existing) throw error;
      return { claim: existing, owned: existing.owner === owner };
    }
  }

  async Get(id: string): Promise<SubscriptionCycleClaim | null> {
    return this.db.Get<SubscriptionCycleClaim>(COLLECTION, id);
  }

  /** The claims `owner` holds on an on-chain subscription, newest first. */
  async FindOwned(
    subscriptionOnchainId: string,
    owner: string
  ): Promise<SubscriptionCycleClaim[]> {
    const claims = await this.db.Find2Custom<SubscriptionCycleClaim>(
      COLLECTION,
      'subscription_onchain_id',
      '==',
      subscriptionOnchainId,
      'owner',
      '==',
      owner
    );
    return [...(claims ?? [])].sort((a, b) => b.due_at - a.due_at);
  }

  /**
   * Compare-and-set of the claim's charge hash: changes it only while it
   * still equals `expected`. Returns false when another write came first.
   */
  async SetChargeHash(
    id: string,
    hash: string | null,
    expected: string | null
  ): Promise<boolean> {
    const updated =
      await this.db.FindOneAndUpdateByFilter<SubscriptionCycleClaim>(
        COLLECTION,
        { id, charge_hash: expected },
        { charge_hash: hash, charge_sent_at: hash ? Now() : null }
      );
    return updated !== null;
  }
}

/** Mongo's duplicate-key error (E11000). */
export function IsDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}
