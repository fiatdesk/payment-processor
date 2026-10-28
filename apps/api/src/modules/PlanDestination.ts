// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Keeps each recurring price's on-chain plan paying the platform's default
 * wallet (Fable Q13 #1).
 *
 * A change is recorded on the Price (`subscription_plan_destination_change`)
 * before anything is sent, one in flight per plan; a repeat request for the
 * same destination is the same change. `setPlanDestination` goes out from
 * SUBSCRIPTION_OPERATOR_KEY under its `sender:` lock, and the billing runner
 * follows it by hash with the charge re-price rule. Until it confirms the
 * plan is not charged (`ReadyToCharge`), so no charge pays the old wallet.
 * A plan another key owns fails with `plan_owner_mismatch`. On confirm the
 * destination flips and `price.updated` is emitted with
 * `previous_attributes`. Simulated plans flip at once, sending nothing.
 *
 * @module PlanDestination
 */

import type { ClientSession } from 'mongoose';
import {
  QueryOperators,
  SameAddress,
  type Price,
  type PriceDestinationChange,
} from '@fiatdesk/shared-types';
import type { Database } from './Database';
import type { EventService } from './EventService';
import { ExternalWalletModule } from './ExternalWallet';
import { GetSettlement, type Settlement } from './chains/Settlement';
import { PLAN_OWNER_MISMATCH } from './chains/types';
import { AppError } from '../utils/AppError';
import { Logger } from '../utils/Logger';
import { Now } from '../utils/Timestamp';

const COLLECTION = 'Prices';
/** Pending changes read per page, and pages read per billing run. */
const RECONCILE_PAGE_SIZE = 100;
const MAX_RECONCILE_PAGES = 20;
const PENDING = 'subscription_plan_destination_change.status';
const PENDING_SINCE = 'subscription_plan_destination_change.created';

/** Whether a plan can be charged now, or waits for its destination change. */
type PlanState = 'ready' | 'pending';

export class PlanDestinationModule {
  private readonly settlement: Settlement;
  private readonly wallets: Pick<ExternalWalletModule, 'GetDefaultWallet'>;

  constructor(
    private readonly db: Database,
    settlement?: Settlement,
    private readonly eventService?: EventService | null,
    wallets?: Pick<ExternalWalletModule, 'GetDefaultWallet'>
  ) {
    this.settlement = settlement ?? GetSettlement();
    this.wallets = wallets ?? new ExternalWalletModule(db);
  }

  /**
   * Inside the wallet-switch transaction: records a change to `destination`
   * for each active on-chain plan of the platform. Returns every active plan
   * price (simulated ones included) for `SyncAll` after the commit.
   */
  async Enqueue(
    platformAccountId: string,
    destination: string,
    session?: ClientSession
  ): Promise<string[]> {
    const prices = await this.ActivePlanPrices(platformAccountId);
    for (const price of prices) {
      if (this.IsSimulatedPlan(price)) continue;
      const change = price.subscription_plan_destination_change;
      if (
        SameAddress(price.subscription_plan_destination, destination) &&
        change?.status !== 'pending'
      ) {
        continue;
      }
      await this.Request(price, destination, session);
    }
    return prices.map((price) => price.id);
  }

  /**
   * Sends (or follows) the recorded changes and flips simulated plans. With
   * `maxSends`, at most that many pending on-chain changes are sent; the
   * rest stay pending for the billing run. Returns how many were left.
   */
  async SyncAll(
    priceIds: string[],
    options: { maxSends?: number } = {}
  ): Promise<number> {
    let sends = 0;
    let queued = 0;
    for (const id of priceIds) {
      const price = await this.db.Get<Price>(COLLECTION, id);
      if (!price) continue;
      const sending =
        !this.IsSimulatedPlan(price) &&
        price.subscription_plan_destination_change?.status === 'pending';
      if (sending && options.maxSends !== undefined) {
        if (sends >= options.maxSends) {
          queued += 1;
          continue;
        }
        sends += 1;
      }
      try {
        await this.Sync(price);
      } catch (error) {
        Logger.error('Could not move a plan to the default wallet', error, {
          priceId: id,
        });
      }
    }
    return queued;
  }

  /**
   * The charge gate: follows the plan's pending change, and moves a plan not
   * on the default wallet, first. False while a change is pending.
   */
  async ReadyToCharge(price: Price): Promise<boolean> {
    return (await this.Sync(price)) === 'ready';
  }

  /**
   * The billing runner's pass: follows every pending change, oldest first
   * and page by page (the `Prices` index on the change's status and time
   * serves it), so changes are not capped at one page.
   */
  async ReconcilePending(platformAccountId?: string): Promise<void> {
    const seen = new Set<string>();
    let cursor: number | undefined;
    for (let page = 0; page < MAX_RECONCILE_PAGES; page++) {
      const pending =
        (await this.db.Query<Price>({
          collection: COLLECTION,
          method: 'READ',
          parameters: [
            { key: PENDING, operator: QueryOperators['=='], value: 'pending' },
            ...(platformAccountId
              ? [
                  {
                    key: 'platform_account',
                    operator: QueryOperators['=='],
                    value: platformAccountId,
                  },
                ]
              : []),
          ],
          orderBy: [{ key: PENDING_SINCE, direction: 'asc' }],
          limit: RECONCILE_PAGE_SIZE,
          ...(cursor === undefined ? {} : { startAt: cursor }),
        })) ?? [];
      const fresh = pending.filter((price) => !seen.has(price.id));
      for (const price of fresh) seen.add(price.id);
      await this.SyncAll(fresh.map((price) => price.id));
      if (pending.length < RECONCILE_PAGE_SIZE || fresh.length === 0) return;
      cursor =
        pending[pending.length - 1].subscription_plan_destination_change
          ?.created;
      if (cursor === undefined) return;
    }
  }

  /**
   * Records a pending change to `destination` (persist before send). The
   * same destination already in flight is that change; another one in
   * flight leaves this request waiting (null).
   */
  async Request(
    price: Price,
    destination: string,
    session?: ClientSession
  ): Promise<Price | null> {
    const InFlight = (current: Price): Price | null => {
      const change = current.subscription_plan_destination_change;
      return change && SameAddress(change.destination, destination)
        ? current
        : null;
    };
    if (price.subscription_plan_destination_change?.status === 'pending') {
      return InFlight(price);
    }
    const change: PriceDestinationChange = {
      destination,
      transaction_hash: null,
      status: 'pending',
      created: Now(),
      failure_message: null,
      sent_at: null,
    };
    const recorded = await this.db.FindOneAndUpdateByFilter<Price>(
      COLLECTION,
      { id: price.id, [PENDING]: { $ne: 'pending' } },
      { subscription_plan_destination_change: change },
      session
    );
    if (recorded) return recorded;
    const current = await this.db.Get<Price>(COLLECTION, price.id);
    return current ? InFlight(current) : null;
  }

  private async Sync(price: Price): Promise<PlanState> {
    const stored = await this.db.Get<Price>(COLLECTION, price.id);
    // Only a stored price records its plan's destination.
    if (!stored?.subscription_plan_id) return 'ready';
    let current = stored;
    if (this.IsSimulatedPlan(current)) {
      const target = await this.DefaultAddress(current);
      if (
        target &&
        !SameAddress(current.subscription_plan_destination, target)
      ) {
        await this.Confirm(current, { destination: target, hash: null });
      }
      return 'ready';
    }

    if (current.subscription_plan_destination_change?.status === 'pending') {
      current = await this.Send(current);
      if (current.subscription_plan_destination_change?.status === 'pending') {
        return 'pending';
      }
    }
    const target = await this.DefaultAddress(current);
    if (!target || SameAddress(current.subscription_plan_destination, target)) {
      return 'ready';
    }
    const change = current.subscription_plan_destination_change;
    // A change the operator cannot make stays surfaced; it is not resent.
    if (
      change?.status === 'failed' &&
      SameAddress(change.destination, target)
    ) {
      return 'ready';
    }
    const recorded = await this.Request(current, target);
    if (!recorded) return 'pending';
    current = await this.Send(recorded);
    return current.subscription_plan_destination_change?.status === 'pending'
      ? 'pending'
      : 'ready';
  }

  /**
   * Sends (or follows) the price's pending change. Each signed hash is
   * recorded before it is sent; a recording that finds the change moved
   * cancels the send. A rail that cannot answer leaves it pending.
   */
  private async Send(price: Price): Promise<Price> {
    const change = price.subscription_plan_destination_change;
    const planKey = price.subscription_plan_id;
    if (change?.status !== 'pending' || !planKey) return price;
    let current = change.transaction_hash;
    try {
      const result = await this.settlement.SetPlanDestination(
        planKey,
        change.destination,
        {
          pendingHash: change.transaction_hash,
          sentAt: change.sent_at,
          onSigned: async (hash) => {
            await this.RecordHash(price, change.destination, current, hash);
            current = hash;
          },
        }
      );
      if (result.status === 'confirmed') {
        return this.Confirm(price, {
          destination: change.destination,
          hash: result.transaction_hash ?? current,
        });
      }
      Logger.info('A plan destination change is waiting for confirmations', {
        priceId: price.id,
        transactionHash: result.transaction_hash,
      });
    } catch (error) {
      if (error instanceof AppError && error.type === PLAN_OWNER_MISMATCH) {
        return this.Fail(price, change.destination, PLAN_OWNER_MISMATCH);
      }
      Logger.warn(
        'A plan destination change could not be sent; it stays pending',
        {
          priceId: price.id,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
    return (await this.db.Get<Price>(COLLECTION, price.id)) ?? price;
  }

  private async RecordHash(
    price: Price,
    destination: string,
    expected: string | null,
    hash: string
  ): Promise<void> {
    const recorded = await this.db.FindOneAndUpdateByFilter<Price>(
      COLLECTION,
      {
        ...this.PendingFilter(price.id, destination),
        'subscription_plan_destination_change.transaction_hash': expected,
      },
      {
        'subscription_plan_destination_change.transaction_hash': hash,
        'subscription_plan_destination_change.sent_at': Now(),
      }
    );
    if (!recorded) {
      throw new AppError(
        'Another process is sending this plan destination change',
        409,
        'plan_destination_pending'
      );
    }
  }

  /**
   * Flips the destination: a confirmed on-chain change, or a simulated plan
   * moved directly. `price.updated` is emitted when the destination moved,
   * not when an untracked plan's destination is only recorded.
   */
  private async Confirm(
    price: Price,
    confirmed: { destination: string; hash: string | null }
  ): Promise<Price> {
    const pending = price.subscription_plan_destination_change;
    const change: PriceDestinationChange =
      pending?.status === 'pending'
        ? {
            ...pending,
            status: 'confirmed',
            transaction_hash: confirmed.hash,
            failure_message: null,
          }
        : {
            destination: confirmed.destination,
            transaction_hash: null,
            status: 'confirmed',
            created: Now(),
            failure_message: null,
            sent_at: null,
          };
    const filter =
      pending?.status === 'pending'
        ? this.PendingFilter(price.id, confirmed.destination)
        : { id: price.id, [PENDING]: { $ne: 'pending' } };
    const updated = await this.db.FindOneAndUpdateByFilter<Price>(
      COLLECTION,
      filter,
      {
        subscription_plan_destination: confirmed.destination,
        subscription_plan_destination_change: change,
      }
    );
    if (!updated) {
      return (await this.db.Get<Price>(COLLECTION, price.id)) ?? price;
    }
    const previous = price.subscription_plan_destination ?? null;
    Logger.info('A plan pays its new destination', {
      priceId: price.id,
      destination: confirmed.destination,
      transactionHash: confirmed.hash,
    });
    if (this.eventService && (confirmed.hash !== null || previous !== null)) {
      await this.eventService.Emit(
        'price.updated',
        updated.platform_account,
        updated,
        {
          previousAttributes: {
            subscription_plan_destination: previous,
            subscription_plan_destination_change: pending ?? null,
          },
        }
      );
    }
    return updated;
  }

  private async Fail(
    price: Price,
    destination: string,
    failureMessage: string
  ): Promise<Price> {
    const pending = price.subscription_plan_destination_change;
    Logger.error('A plan destination change failed', null, {
      priceId: price.id,
      planKey: price.subscription_plan_id,
      destination,
      failureMessage,
    });
    const updated = pending
      ? await this.db.FindOneAndUpdateByFilter<Price>(
          COLLECTION,
          this.PendingFilter(price.id, destination),
          {
            subscription_plan_destination_change: {
              ...pending,
              status: 'failed',
              failure_message: failureMessage,
            },
          }
        )
      : null;
    return updated ?? (await this.db.Get<Price>(COLLECTION, price.id)) ?? price;
  }

  private PendingFilter(
    priceId: string,
    destination: string
  ): Record<string, unknown> {
    return {
      id: priceId,
      [PENDING]: 'pending',
      'subscription_plan_destination_change.destination': destination,
    };
  }

  private async DefaultAddress(price: Price): Promise<string | null> {
    return (
      (await this.wallets.GetDefaultWallet(price.platform_account))
        ?.wallet_address ?? null
    );
  }

  /** Recurring prices of the platform with an on-chain plan, still sold. */
  private async ActivePlanPrices(platformAccountId: string): Promise<Price[]> {
    const prices = await this.db.Query<Price>({
      collection: COLLECTION,
      method: 'READ',
      parameters: [
        {
          key: 'platform_account',
          operator: QueryOperators['=='],
          value: platformAccountId,
        },
        { key: 'type', operator: QueryOperators['=='], value: 'recurring' },
        { key: 'active', operator: QueryOperators['=='], value: true },
      ],
    });
    return prices.filter((price) => !!price.subscription_plan_id);
  }

  /** No chain to change: the simulated rail, or a simulated plan id. */
  private IsSimulatedPlan(price: Price): boolean {
    return (
      this.settlement.Describe().rail === 'simulated' ||
      !/^0x[0-9a-fA-F]{64}$/.test(price.subscription_plan_id ?? '')
    );
  }
}
