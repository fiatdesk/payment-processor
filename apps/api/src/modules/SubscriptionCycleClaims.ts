// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * @fileOverview Atomic claims on on-chain billing cycles.
 *
 * Before collecting a period from an on-chain subscription, its collector
 * (a checkout session or an invoice) inserts the claim
 * `${subscriptionOnchainId}:${dueAt}`, where `dueAt` is the grid point the
 * charge collects. The claim is written once, by an upsert that only inserts
 * (`$setOnInsert`), so exactly one actor owns a cycle. It goes through
 * `Database.Set`, as every collection's writes do: a mongoose document
 * (`new model(data).save()`) would drop `id`, which the schema's `id`
 * virtual shadows.
 * The claim also holds the hash of each `charge` before it is sent (the
 * original and every re-priced replacement, append-only), so a collection
 * that timed out or crashed is reconciled by all of them.
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
  /** The newest `charge` transaction, recorded before it is sent */
  charge_hash: string | null;
  /** Every `charge` transaction ever signed for this cycle, oldest first */
  charge_hashes: string[];
  /** The nonce `charge_hash` was signed with */
  charge_nonce: number | null;
  /** When `charge_hash` was recorded, for re-pricing a stuck charge */
  charge_sent_at: number | null;
  /**
   * The billing period the charge that paid this cycle paid, from the
   * `Charged` event: `[nextChargeAt - period, nextChargeAt]`
   */
  paid_period: { start: number; end: number } | null;
  /**
   * The invoice's `next_payment_attempt` while collection is paused, so
   * resuming keeps its dunning schedule
   */
  paused_retry_at: number | null;
  created: number;
}

/** Every hash a claim recorded (older claims kept only `charge_hash`). */
export function ClaimHashes(claim: SubscriptionCycleClaim): string[] {
  const hashes = [...(claim.charge_hashes ?? [])];
  if (claim.charge_hash && !hashes.includes(claim.charge_hash)) {
    hashes.push(claim.charge_hash);
  }
  return hashes;
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
   * Claim the cycle for `owner`: inserted when absent, else left as it is.
   * Returns the stored claim and whether `owner` holds it; an existing claim
   * of the same owner (a retry) counts as held.
   */
  async Claim(
    subscriptionOnchainId: string,
    dueAt: number,
    owner: string
  ): Promise<{ claim: SubscriptionCycleClaim; owned: boolean }> {
    const id = CycleClaimId(subscriptionOnchainId, dueAt);
    const claim: Omit<SubscriptionCycleClaim, 'id'> = {
      object: 'subscription_cycle_claim',
      subscription_onchain_id: subscriptionOnchainId,
      due_at: dueAt,
      owner,
      charge_hash: null,
      charge_hashes: [],
      charge_nonce: null,
      charge_sent_at: null,
      paid_period: null,
      paused_retry_at: null,
      created: Now(),
    };
    // The filter supplies `id` to an inserted claim.
    const stored = await this.db.Set<SubscriptionCycleClaim>(COLLECTION, id, {
      $setOnInsert: claim,
    } as Partial<SubscriptionCycleClaim>);
    if (!stored) throw new Error(`The cycle claim ${id} was not stored`);
    return { claim: stored, owned: stored.owner === owner };
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

  /** Claims, of any cycle, that recorded `hash` among their charges. */
  async FindByChargeHash(hash: string): Promise<SubscriptionCycleClaim[]> {
    return (
      (await this.db.Find<SubscriptionCycleClaim>(
        COLLECTION,
        'charge_hashes',
        hash
      )) ?? []
    );
  }

  /**
   * Compare-and-set of the claim's charge hash: changes it only while it
   * still equals `expected`. A new hash is also appended to
   * `charge_hashes` with its nonce, so no signed charge is ever forgotten;
   * clearing keeps them. Returns false when another write came first.
   */
  async SetChargeHash(
    id: string,
    hash: string | null,
    expected: string | null,
    signed?: { nonce: number }
  ): Promise<boolean> {
    const update: Record<string, unknown> = hash
      ? {
          $set: {
            charge_hash: hash,
            charge_sent_at: Now(),
            ...(signed ? { charge_nonce: signed.nonce } : {}),
          },
          $addToSet: { charge_hashes: hash },
        }
      : { $set: { charge_hash: null, charge_sent_at: null } };
    const updated =
      await this.db.FindOneAndUpdateByFilter<SubscriptionCycleClaim>(
        COLLECTION,
        { id, charge_hash: expected },
        update
      );
    return updated !== null;
  }

  /** Records the period the charge that paid this cycle paid. */
  async SetPaidPeriod(
    id: string,
    period: { start: number; end: number } | null
  ): Promise<void> {
    await this.db.Update<SubscriptionCycleClaim>(COLLECTION, id, {
      paid_period: period,
    });
  }

  /** Keeps (or, with null, drops) an invoice's schedule over a pause. */
  async SetPausedRetryAt(id: string, retryAt: number | null): Promise<void> {
    await this.db.Update<SubscriptionCycleClaim>(COLLECTION, id, {
      paused_retry_at: retryAt,
    });
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
