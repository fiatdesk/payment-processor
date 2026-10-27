// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * @fileOverview Subscription billing runner
 *
 * Finds due subscriptions and invoices to retry, claims each subscription
 * atomically, and collects it through Invoice → PaymentIntent → chain, then
 * advances periods or marks past_due / unpaid.
 *
 * The chain is the source of truth for status and schedule. Each run reads
 * a subscription's on-chain state and charges it at most once:
 * - canceled on-chain → canceled here, open invoices voided, no dunning;
 * - paused on-chain → `pause_collection`, lifted when it resumes on-chain;
 * - otherwise the invoice whose period starts at the grid point due now is
 *   paid (created when missing); open invoices for earlier periods, which
 *   the contract skipped, are voided; after the charge the period follows
 *   the charge's `Charged` event.
 * A charge sent earlier is reconciled by its recorded hash before anything
 * else. Waits (a pending charge, a collected period, a pause) neither fail
 * the subscription nor count toward the batch.
 *
 * Safe for multi-instance deployments (Cloud Run) via billing_lock_until claims.
 *
 * @module SubscriptionBilling
 */

import { Database } from './Database';
import { EventService } from './EventService';
import { SubscriptionModule } from './Subscription';
import { InvoiceModule, INVOICE_MAX_PAYMENT_ATTEMPTS } from './Invoice';
import { CustomerModule } from './Customer';
import { PriceModule } from './Price';
import { ProductModule } from './Product';
import { InvoiceItemModule } from './InvoiceItem';
import { PaymentIntentModule } from './PaymentIntent';
import { ChargeModule } from './Charge';
import { GetSettlement, type Settlement } from './chains/Settlement';
import { CurrentDueAt } from './chains/SubscriptionAuthorization';
import {
  CANCELED_ON_CHAIN,
  COLLECTION_DECLINE_CODES,
  CYCLE_MISSED,
  PAUSED_ON_CHAIN,
  type OnchainSubscriptionState,
} from './chains/types';
import {
  Invoice as InvoiceType,
  QueryOperators,
  Subscription as SubscriptionType,
  SubscriptionItem as SubscriptionItemType,
} from '@zoneless/shared-types';
import { Now } from '../utils/Timestamp';
import { Logger } from '../utils/Logger';
import { ExpandableId } from './Util';

const DEFAULT_BATCH_SIZE = 25;
const BILLING_LOCK_SECONDS = 5 * 60;
/** Invoices of skipped periods voided per subscription per run. */
const MAX_MISSED_CYCLES_PER_RUN = 12;
/** Due subscription items read per page, and pages read per run. */
const DUE_PAGE_SIZE = 100;
const MAX_DUE_PAGES = 20;

type QueryParam = {
  key: string;
  operator: (typeof QueryOperators)[keyof typeof QueryOperators];
  value: unknown;
};

/** Whether a subscription's turn counted toward the batch. */
type Turn = 'processed' | 'skipped';

export interface BillingRunResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ subscription: string; error: string }>;
}

/**
 * Wire Invoice + Subscription once for billing (routes / monitor / tests).
 */
export function CreateSubscriptionBilling(
  db: Database
): SubscriptionBillingModule {
  const eventService = new EventService(db);
  const customerModule = new CustomerModule(db, eventService);
  const productModule = new ProductModule(db, eventService);
  const priceModule = new PriceModule(db, eventService, productModule);
  const paymentIntentModule = new PaymentIntentModule(
    db,
    eventService,
    customerModule
  );
  const chargeModule = new ChargeModule(db, eventService, customerModule);
  const invoiceItemModule = new InvoiceItemModule(
    db,
    eventService,
    customerModule,
    priceModule
  );
  const invoiceModule = new InvoiceModule(
    db,
    eventService,
    customerModule,
    invoiceItemModule,
    paymentIntentModule,
    chargeModule,
    priceModule
  );
  const subscriptionModule = new SubscriptionModule(
    db,
    eventService,
    customerModule,
    priceModule,
    invoiceModule
  );
  return new SubscriptionBillingModule(db, subscriptionModule, invoiceModule);
}

export class SubscriptionBillingModule {
  private readonly db: Database;
  private readonly subscriptionModule: SubscriptionModule;
  private readonly invoiceModule: InvoiceModule;
  private readonly settlement: Settlement;

  constructor(
    db: Database,
    subscriptionModule: SubscriptionModule,
    invoiceModule: InvoiceModule,
    settlement?: Settlement
  ) {
    this.db = db;
    this.subscriptionModule = subscriptionModule;
    this.invoiceModule = invoiceModule;
    this.settlement = settlement || GetSettlement();
  }

  /**
   * Run one billing pass: invoice retries, then due renewals, then on-chain
   * cancels still pending. A subscription gets at most one turn per run.
   */
  async Run(
    options: {
      platformAccountId?: string;
      batchSize?: number;
    } = {}
  ): Promise<BillingRunResult> {
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const now = Now();
    const result: BillingRunResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    const attempted = new Set<string>();

    const retryInvoices = await this.FindRetryInvoices(
      now,
      options.platformAccountId,
      batchSize
    );
    for (const invoice of retryInvoices) {
      if (result.processed >= batchSize) break;
      const subscriptionId = ExpandableId(
        invoice.parent?.subscription_details?.subscription
      );
      if (!subscriptionId || attempted.has(subscriptionId)) {
        result.skipped += 1;
        continue;
      }
      attempted.add(subscriptionId);
      await this.WithBillingClaim(subscriptionId, result, (claimed) =>
        this.CollectSubscription(claimed, result)
      );
    }

    for await (const subscriptionId of this.DueSubscriptionIds(
      now,
      options.platformAccountId
    )) {
      if (result.processed >= batchSize) break;
      if (attempted.has(subscriptionId)) continue;
      attempted.add(subscriptionId);
      await this.WithBillingClaim(subscriptionId, result, (claimed) =>
        this.CollectSubscription(claimed, result)
      );
    }

    await this.SendPendingOnchainCancels(options.platformAccountId, batchSize);

    return this.Finish(result);
  }

  private Finish(result: BillingRunResult): BillingRunResult {
    Logger.info('Subscription billing run completed', {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
      errorCount: result.errors.length,
    });
    return result;
  }

  /**
   * Claim → work. A turn that only waited (a pause, a pending charge, a
   * period not due) counts as skipped, not toward the batch, so waiting
   * subscriptions cannot crowd out due ones.
   */
  private async WithBillingClaim(
    subscriptionId: string,
    result: BillingRunResult,
    work: (claimed: SubscriptionType) => Promise<Turn>
  ): Promise<void> {
    const claimed = await this.subscriptionModule.ClaimForBilling(
      subscriptionId,
      Now() + BILLING_LOCK_SECONDS
    );
    if (!claimed) {
      result.skipped += 1;
      return;
    }

    try {
      const turn = await work(claimed);
      if (turn === 'processed') result.processed += 1;
      else result.skipped += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.processed += 1;
      result.failed += 1;
      result.errors.push({ subscription: subscriptionId, error: message });
      try {
        await this.subscriptionModule.MarkSubscriptionPastDue(subscriptionId);
      } catch {
        await this.subscriptionModule.ReleaseBillingLock(subscriptionId);
      }
    }
  }

  /** Releases the claim; the turn was a wait. */
  private async Skip(subscription: SubscriptionType): Promise<Turn> {
    await this.subscriptionModule.ReleaseBillingLock(subscription.id);
    return 'skipped';
  }

  /** One subscription's turn: at most one charge. */
  private async CollectSubscription(
    claimed: SubscriptionType,
    result: BillingRunResult
  ): Promise<Turn> {
    let subscription = claimed;
    const onchainId = subscription.subscription_onchain_id;
    if (!onchainId || !IsBillable(subscription)) return this.Skip(subscription);
    // A pause the merchant set: nothing to read or collect.
    if (subscription.pause_collection && !subscription.paused_on_chain) {
      return this.Skip(subscription);
    }

    // A charge sent earlier is settled by its hash before anything else.
    const open = await this.invoiceModule.ListOpenSubscriptionInvoices(
      subscription.id
    );
    for (const invoice of open) {
      if (await this.invoiceModule.HasPendingCharge(invoice)) {
        const paid = await this.invoiceModule.PayInvoice(invoice.id);
        return this.HandleInvoiceOutcome(subscription, paid, result);
      }
    }

    const state = await this.ReadState(subscription);
    if (!state) return this.Skip(subscription);
    if (state.status === 'canceled' || state.status === 'none') {
      await this.subscriptionModule.CancelFromChain(subscription.id);
      return 'processed';
    }
    if (state.status === 'paused') {
      if (subscription.paused_on_chain) return this.Skip(subscription);
      await this.subscriptionModule.PauseCollectionOnChain(subscription.id);
      return 'skipped';
    }
    if (subscription.paused_on_chain) {
      subscription = await this.subscriptionModule.ResumeCollectionFromChain(
        subscription.id
      );
    }
    if (!this.CanAutoCollect(subscription)) return this.Skip(subscription);

    const wallClock = Now();
    const periodStart = Math.min(
      ...subscription.items.data.map((item) => item.current_period_start)
    );
    const periodEnd = Math.min(
      ...subscription.items.data.map((item) => item.current_period_end)
    );
    const dueForTrialEnd =
      subscription.status === 'trialing' &&
      !!subscription.trial_end &&
      subscription.trial_end <= wallClock;
    if (periodEnd > wallClock && !dueForTrialEnd) {
      return this.Skip(subscription);
    }
    if (this.ShouldFinalizeCancelAtPeriodEnd(subscription, wallClock)) {
      await this.subscriptionModule.FinalizeCancelAtPeriodEnd(subscription.id);
      await this.subscriptionModule.ReleaseBillingLock(subscription.id);
      result.succeeded += 1;
      return 'processed';
    }

    const now = state.chain_time ?? wallClock;
    const periodSeconds = state.period_seconds ?? periodEnd - periodStart;
    const nextChargeAt = state.next_charge_at ?? periodEnd;
    if (now < nextChargeAt) {
      await this.invoiceModule.ScheduleOpenSubscriptionInvoices(
        subscription.id,
        nextChargeAt
      );
      return this.Skip(subscription);
    }
    const dueAt = CurrentDueAt(nextChargeAt, now, periodSeconds);

    // Periods before `dueAt` were skipped on-chain: void, never collect.
    const stale = open.filter((invoice) => invoice.period_start < dueAt);
    for (const invoice of stale.slice(0, MAX_MISSED_CYCLES_PER_RUN)) {
      await this.invoiceModule.VoidInvoice(invoice.id);
      Logger.info('Voided the invoice of a skipped billing period', {
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
      });
    }
    if (stale.length > MAX_MISSED_CYCLES_PER_RUN) {
      await this.subscriptionModule.ReleaseBillingLock(subscription.id);
      return 'processed';
    }

    if (periodEnd !== dueAt) {
      subscription = await this.subscriptionModule.AlignToCycle(
        subscription.id,
        { start: dueAt - periodSeconds, end: dueAt }
      );
    }
    let invoice =
      open.find((candidate) => candidate.period_start === dueAt) ??
      (await this.subscriptionModule.CreateCycleInvoice(
        subscription.platform_account,
        subscription.id,
        { finalize: true, collect: false }
      ));
    if (invoice.status === 'open') {
      invoice = await this.invoiceModule.PayInvoice(invoice.id);
    }
    return this.HandleInvoiceOutcome(subscription, invoice, result);
  }

  /** The on-chain state; null (a wait) when the chain cannot be read. */
  private async ReadState(
    subscription: SubscriptionType
  ): Promise<OnchainSubscriptionState | null> {
    try {
      return await this.settlement.GetSubscriptionState(
        subscription.subscription_onchain_id as string
      );
    } catch (error) {
      Logger.warn('Could not read an on-chain subscription; waiting', {
        subscriptionId: subscription.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private CanAutoCollect(subscription: SubscriptionType): boolean {
    if (!IsBillable(subscription) || subscription.pause_collection) {
      return false;
    }
    if (
      subscription.status === 'trialing' &&
      subscription.trial_end &&
      subscription.trial_end > Now()
    ) {
      return false;
    }
    return true;
  }

  private ShouldFinalizeCancelAtPeriodEnd(
    subscription: SubscriptionType,
    now: number
  ): boolean {
    if (subscription.status === 'canceled') {
      return false;
    }
    if (subscription.cancel_at_period_end) {
      return true;
    }
    if (subscription.cancel_at != null && subscription.cancel_at <= now) {
      return true;
    }
    return false;
  }

  private async HandleInvoiceOutcome(
    subscription: SubscriptionType,
    invoice: InvoiceType,
    result: BillingRunResult
  ): Promise<Turn> {
    if (invoice.status === 'paid') {
      await this.subscriptionModule.AdvanceSubscriptionPeriod(
        subscription.id,
        invoice.id,
        await this.PaidPeriod(subscription)
      );
      result.succeeded += 1;
      return 'processed';
    }

    const code = invoice.metadata?.['last_payment_error_code'];
    if (code === PAUSED_ON_CHAIN) {
      await this.subscriptionModule.PauseCollectionOnChain(subscription.id);
      return 'skipped';
    }
    if (code === CANCELED_ON_CHAIN) {
      await this.subscriptionModule.CancelFromChain(subscription.id);
      return 'processed';
    }
    if (code === CYCLE_MISSED) {
      await this.invoiceModule.VoidInvoice(invoice.id);
      return this.Skip(subscription);
    }
    // Every other collection code is a wait: no failure, no past_due.
    if (code && !COLLECTION_DECLINE_CODES.has(code)) {
      return this.Skip(subscription);
    }

    if (
      invoice.status === 'open' &&
      invoice.attempt_count >= INVOICE_MAX_PAYMENT_ATTEMPTS
    ) {
      await this.invoiceModule.MarkInvoiceUncollectible(invoice.id);
      await this.subscriptionModule.MarkSubscriptionUnpaid(
        subscription.id,
        invoice.id
      );
      result.failed += 1;
      result.errors.push({
        subscription: subscription.id,
        error: 'Payment retries exhausted',
      });
      return 'processed';
    }

    await this.subscriptionModule.MarkSubscriptionPastDue(
      subscription.id,
      invoice.id
    );
    result.failed += 1;
    result.errors.push({
      subscription: subscription.id,
      error:
        invoice.metadata?.['last_payment_error'] ?? 'Invoice payment failed',
    });
    return 'processed';
  }

  /**
   * The period a confirmed charge paid, from the chain's schedule after it:
   * `[nextChargeAt - period, nextChargeAt]`. Undefined on a rail with no
   * schedule, or when the chain cannot be read (the period then moves one
   * interval on).
   */
  private async PaidPeriod(
    subscription: SubscriptionType
  ): Promise<{ start: number; end: number } | undefined> {
    const state = await this.ReadState(subscription);
    if (state?.next_charge_at == null || state.period_seconds == null) {
      return undefined;
    }
    return {
      start: state.next_charge_at - state.period_seconds,
      end: state.next_charge_at,
    };
  }

  /**
   * Sends again the on-chain cancels of subscriptions canceled here whose
   * cancel has not landed (`cancel_pending_on_chain`).
   */
  private async SendPendingOnchainCancels(
    platformAccountId: string | undefined,
    limit: number
  ): Promise<void> {
    const pending =
      (await this.db.Query<SubscriptionType>({
        collection: 'Subscriptions',
        method: 'READ',
        parameters: this.WithPlatformFilter(
          [
            {
              key: 'cancel_pending_on_chain',
              operator: QueryOperators['=='],
              value: true,
            },
          ],
          platformAccountId
        ),
        limit,
      })) ?? [];
    for (const subscription of pending) {
      await this.subscriptionModule.SendOnchainCancel(subscription.id);
    }
  }

  /**
   * Open subscription invoices due for another attempt. Paused ones have no
   * `next_payment_attempt` and waits are scheduled at their own time, so
   * neither comes up here early.
   */
  private async FindRetryInvoices(
    now: number,
    platformAccountId: string | undefined,
    limit: number
  ): Promise<InvoiceType[]> {
    return (
      (await this.db.Query<InvoiceType>({
        collection: 'Invoices',
        method: 'READ',
        parameters: this.WithPlatformFilter(
          [
            { key: 'status', operator: QueryOperators['=='], value: 'open' },
            {
              key: 'collection_method',
              operator: QueryOperators['=='],
              value: 'charge_automatically',
            },
            {
              key: 'next_payment_attempt',
              operator: QueryOperators['<='],
              value: now,
            },
            {
              key: 'billing_reason',
              operator: QueryOperators['in'],
              value: [
                'subscription_cycle',
                'subscription_create',
                'subscription_update',
              ],
            },
          ],
          platformAccountId
        ),
        orderBy: [{ key: 'next_payment_attempt', direction: 'asc' }],
        limit,
      })) ?? []
    );
  }

  /**
   * Subscriptions with an item whose period has ended, oldest first, read
   * page by page so subscriptions that only wait (paused ones) cannot hide
   * the rest.
   */
  private async *DueSubscriptionIds(
    now: number,
    platformAccountId: string | undefined
  ): AsyncGenerator<string> {
    const seen = new Set<string>();
    let cursor: number | undefined;
    for (let page = 0; page < MAX_DUE_PAGES; page++) {
      const items =
        (await this.db.Query<SubscriptionItemType>({
          collection: 'SubscriptionItems',
          method: 'READ',
          parameters: this.WithPlatformFilter(
            [
              {
                key: 'current_period_end',
                operator: QueryOperators['<='],
                value: now,
              },
            ],
            platformAccountId
          ),
          orderBy: [{ key: 'current_period_end', direction: 'asc' }],
          limit: DUE_PAGE_SIZE,
          ...(cursor === undefined ? {} : { startAt: cursor }),
        })) ?? [];
      let fresh = false;
      for (const item of items) {
        if (seen.has(item.subscription)) continue;
        seen.add(item.subscription);
        fresh = true;
        yield item.subscription;
      }
      if (items.length < DUE_PAGE_SIZE || !fresh) return;
      cursor = items[items.length - 1].current_period_end;
    }
  }

  private WithPlatformFilter(
    parameters: QueryParam[],
    platformAccountId: string | undefined
  ): QueryParam[] {
    if (!platformAccountId) return parameters;
    return [
      ...parameters,
      {
        key: 'platform_account',
        operator: QueryOperators['=='],
        value: platformAccountId,
      },
    ];
  }
}

/** Automatically collected, on-chain, and in a status that bills. */
function IsBillable(subscription: SubscriptionType): boolean {
  return (
    !!subscription.subscription_onchain_id &&
    subscription.collection_method === 'charge_automatically' &&
    (subscription.status === 'active' ||
      subscription.status === 'past_due' ||
      subscription.status === 'trialing')
  );
}
