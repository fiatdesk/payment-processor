// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Hosted checkout's subscription steps: checking the prepared USDC permit
 * and `Subscribe` against this checkout, describing what the customer
 * authorizes (and what a trial charges today), and signing both for one
 * confirm.
 */
import { WritableSignal } from '@angular/core';
import {
  CheckoutPaymentTransaction,
  CheckoutSession,
  Eip712TypedData,
  Price,
  RecurringInterval,
  SameAddress,
} from '@fiatdesk/shared-types';

import type { WalletService } from '../../../core';
import {
  CheckoutPaymentConfirmer,
  ShortAddress,
  SignAsPrepared,
  USDC_UNITS_PER_CENT,
} from './checkout-payment';
import { FormatUsdcAmount } from './checkout-format';

const USDC_UNITS_PER_USDC = BigInt(1_000_000);
/** A permit covers at least 12 periods and at least a year, as the API sizes it. */
const PERMIT_MIN_PERIODS = BigInt(12);
const SECONDS_PER_DAY = 24 * 3600;
const PERMIT_MIN_SECONDS = BigInt(365 * SECONDS_PER_DAY);
/** How far past `now + trial` a signed first charge may be (clock skew). */
const FIRST_CHARGE_SLACK_SECONDS = 3600;

/** Period lengths of on-chain plans, longest first: a month is 30 days. */
const PERIOD_SECONDS: [RecurringInterval, number][] = [
  ['year', 365 * SECONDS_PER_DAY],
  ['month', 30 * SECONDS_PER_DAY],
  ['week', 7 * SECONDS_PER_DAY],
  ['day', SECONDS_PER_DAY],
  ['hour', 3600],
];

const OUT_OF_DATE_MESSAGE =
  'This subscription request is out of date. Reload the page and try again.';
const OTHER_NETWORK_MESSAGE =
  'The subscription is for a different network than this checkout. Refresh the page and try again.';

/** The prepared messages, checked against this checkout. */
export interface SubscribeAuthorization {
  /** The USDC permit; null when the allowance already covers the plan */
  permit: Eip712TypedData | null;
  subscribe: Eip712TypedData;
  deadline: number;
}

/** What the customer authorizes, ready to show. */
export interface SubscribeTerms {
  /** e.g. `10.00 USDC every month` */
  recurring: string;
  /** e.g. `USDC (0x1c7D…7238)` */
  token: string;
  /** `First charge today`, or `First charge on 3 Nov 2026` for a trial */
  firstCharge: string;
  /** The signed first charge time (Unix seconds); null when it is now */
  firstChargeAt: number | null;
  /** With a permit: the allowance this plan adds and the total it sets */
  allowance: { added: string; total: string } | null;
}

/** A trial, as the order summary shows it. */
export interface CheckoutTrial {
  /** e.g. `7-day free trial` */
  label: string;
  /** e.g. `First charge on 3 Nov 2026`, or `…around 3 Nov 2026 (estimated)` */
  firstCharge: string;
  /** What the first charge collects, e.g. `US$10.00` */
  amount: string;
}

/**
 * Signs a prepared subscription and confirms it: the USDC permit first when
 * prepare asked for one, then the `Subscribe`, both checked against this
 * checkout before the wallet is asked. One confirm sends both, and it is
 * retried with them until the subscription settles.
 */
export class CheckoutSubscriber {
  constructor(
    private readonly wallet: Pick<
      WalletService,
      'GetAddress' | 'SignTypedData'
    >,
    private readonly confirmer: CheckoutPaymentConfirmer,
    private readonly terms: WritableSignal<SubscribeTerms | null>
  ) {}

  /**
   * Completes checkout from the wallet's existing on-chain subscription
   * (a prior subscribe landed but its confirm failed), retried like any
   * confirm since it collects the first period; null when it has none.
   */
  async ConfirmExisting(
    session: CheckoutSession,
    prepared: CheckoutPaymentTransaction
  ): Promise<CheckoutSession | null> {
    if (!prepared.already_subscribed) return null;
    this.confirmer.Hold(session, {
      already_subscribed: true,
      subscription_onchain_id: prepared.subscription_onchain_id,
    });
    return this.confirmer.ConfirmUntilSettled(session);
  }

  async SignAndConfirm(
    session: CheckoutSession,
    prepared: CheckoutPaymentTransaction,
    chainId: number,
    subscriber: string
  ): Promise<CheckoutSession> {
    const authorization = RequireSubscribeAuthorization(
      prepared,
      session,
      chainId,
      subscriber
    );
    this.terms.set(DescribeSubscribeTerms(authorization));
    const permitSignature = authorization.permit
      ? await SignAsPrepared(
          this.wallet,
          authorization.permit,
          subscriber,
          true
        )
      : null;
    const subscribeSignature = await SignAsPrepared(
      this.wallet,
      authorization.subscribe,
      subscriber,
      true
    );
    this.confirmer.Hold(session, {
      ...(permitSignature ? { permit_signature: permitSignature } : {}),
      subscribe_signature: subscribeSignature,
      deadline: authorization.deadline,
    });
    return this.confirmer.ConfirmUntilSettled(session);
  }
}

/**
 * The prepared `Subscribe` (and permit, when `needs_permit`), checked to be
 * for `chainId` and for this checkout: from `subscriber`, to the price's
 * on-chain plan, for its amount and period in the checkout's USDC, with the
 * prepared deadline and a first charge that matches the price's trial. The
 * permit must come from `subscriber`, let the Subscriptions contract spend
 * that USDC, and set at least the allowance the plan adds.
 */
export function RequireSubscribeAuthorization(
  prepared: CheckoutPaymentTransaction,
  session: CheckoutSession,
  chainId: number,
  subscriber: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): SubscribeAuthorization {
  const subscription = prepared.subscription;
  const subscribe = subscription?.subscribe_typed_data;
  if (!subscription || !subscribe || subscription.deadline === null) {
    throw new Error(
      'This subscription cannot be started from a wallet on this network yet.'
    );
  }
  const permit = subscription.needs_permit
    ? subscription.permit_typed_data
    : null;
  if (
    subscribe.domain.chainId !== chainId ||
    (permit && permit.domain.chainId !== chainId)
  ) {
    throw new Error(OTHER_NETWORK_MESSAGE);
  }
  const { deadline } = subscription;
  const planId = PrimaryPrice(session)?.subscription_plan_id ?? null;
  if (
    !planId ||
    !SameHex(subscription.plan_id, planId) ||
    !SubscribeMatches(subscribe, planId, deadline, session, nowSeconds) ||
    !SameAddress(String(subscribe.message['subscriber']), subscriber) ||
    (subscription.needs_permit &&
      (!permit || !PermitMatches(permit, subscribe, deadline, subscriber)))
  ) {
    throw new Error(OUT_OF_DATE_MESSAGE);
  }
  return { permit, subscribe, deadline };
}

/** What the customer authorizes with `authorization`, ready to show. */
export function DescribeSubscribeTerms(
  authorization: SubscribeAuthorization
): SubscribeTerms {
  const { permit, subscribe } = authorization;
  const amount = ToBigInt(subscribe.message['amount']) ?? BigInt(0);
  const periodSeconds = Number(subscribe.message['periodSeconds']);
  const plan = PlanPermitValue(subscribe);
  const total = permit ? ToBigInt(permit.message['value']) : null;
  // A trial signs its first charge time; 0 (or none) means now.
  const firstChargeAt = Number(subscribe.message['firstChargeAt'] ?? 0);
  return {
    recurring: `${FormatUsdcUnits(amount)} USDC every ${PeriodLabel(
      periodSeconds
    )}`,
    token: `USDC (${ShortAddress(String(subscribe.message['token']))})`,
    firstCharge:
      firstChargeAt > 0
        ? `First charge on ${FormatChargeDate(firstChargeAt)}`
        : 'First charge today',
    firstChargeAt: firstChargeAt > 0 ? firstChargeAt : null,
    allowance:
      plan && total !== null
        ? {
            added: `${FormatUsdcUnits(plan.value)} USDC (${
              plan.periods
            } charges)`,
            total: `${FormatUsdcUnits(total)} USDC`,
          }
        : null,
  };
}

/** Days of free trial the session's price starts with; 0 for none. */
export function TrialPeriodDays(session: CheckoutSession): number {
  if (session.mode !== 'subscription') return 0;
  const days = PrimaryPrice(session)?.recurring?.trial_period_days ?? 0;
  return days > 0 ? days : 0;
}

/**
 * The trial the order summary shows, or null without one. The first charge
 * date is the signed `firstChargeAt` once prepared, else an estimate from
 * the trial length.
 */
export function CheckoutTrialSummary(
  session: CheckoutSession,
  firstChargeAt: number | null,
  nowSeconds = Math.floor(Date.now() / 1000)
): CheckoutTrial | null {
  const days = TrialPeriodDays(session);
  if (!days) return null;
  return {
    label: `${days}-day free trial`,
    firstCharge: firstChargeAt
      ? `First charge on ${FormatChargeDate(firstChargeAt)}`
      : `First charge around ${FormatChargeDate(
          nowSeconds + days * SECONDS_PER_DAY
        )} (estimated)`,
    amount: FormatUsdcAmount(session.amount_total),
  };
}

/** `month`, `3 months` or `2 weeks` for an on-chain period. */
export function PeriodLabel(seconds: number): string {
  for (const [interval, length] of PERIOD_SECONDS) {
    if (seconds > 0 && seconds % length === 0) {
      const count = seconds / length;
      return count === 1 ? interval : `${count} ${interval}s`;
    }
  }
  return `${seconds} seconds`;
}

/** USDC base units as `1,234.50` (2 to 6 decimals). */
export function FormatUsdcUnits(units: bigint): string {
  const whole = units / USDC_UNITS_PER_USDC;
  const fraction = (units % USDC_UNITS_PER_USDC)
    .toString()
    .padStart(6, '0')
    .replace(/0{1,4}$/, '');
  return `${whole.toLocaleString('en-US')}.${fraction}`;
}

/**
 * The allowance a plan's permit adds, as the API sizes it:
 * `amount × max(12, ceil(365 days / periodSeconds))`.
 */
export function PlanPermitValue(
  subscribe: Eip712TypedData
): { value: bigint; periods: bigint } | null {
  const amount = ToBigInt(subscribe.message['amount']);
  const period = ToBigInt(subscribe.message['periodSeconds']);
  if (amount === null || period === null || period <= BigInt(0)) return null;
  const yearOfPeriods = (PERMIT_MIN_SECONDS + period - BigInt(1)) / period;
  const periods =
    yearOfPeriods > PERMIT_MIN_PERIODS ? yearOfPeriods : PERMIT_MIN_PERIODS;
  return { value: amount * periods, periods };
}

function SubscribeMatches(
  subscribe: Eip712TypedData,
  planId: string,
  deadline: number,
  session: CheckoutSession,
  nowSeconds: number
): boolean {
  const terms = subscribe.message;
  const price = PrimaryPrice(session);
  if (!price?.recurring || price.unit_amount === null) return false;
  const periodSeconds =
    PeriodSeconds(price.recurring.interval) *
    (price.recurring.interval_count ?? 1);
  return (
    subscribe.primaryType === 'Subscribe' &&
    SameHex(String(terms['planKey']), planId) &&
    SameAddress(
      String(terms['token']),
      session.merchant_wallet?.token_address
    ) &&
    Number(terms['deadline']) === deadline &&
    ToBigInt(terms['amount']) ===
      BigInt(price.unit_amount) * USDC_UNITS_PER_CENT &&
    ToBigInt(terms['periodSeconds']) === BigInt(periodSeconds) &&
    FirstChargeMatches(terms['firstChargeAt'], session, nowSeconds)
  );
}

/**
 * Without a trial the first charge is now (`firstChargeAt` absent or 0).
 * With one it is after now and at most the trial length (plus slack) away.
 */
function FirstChargeMatches(
  firstChargeAt: string | number | undefined,
  session: CheckoutSession,
  nowSeconds: number
): boolean {
  const days = TrialPeriodDays(session);
  if (!days)
    return firstChargeAt === undefined || ToBigInt(firstChargeAt) === BigInt(0);
  const at = ToBigInt(firstChargeAt);
  return (
    at !== null &&
    at > BigInt(nowSeconds) &&
    at <=
      BigInt(nowSeconds + days * SECONDS_PER_DAY + FIRST_CHARGE_SLACK_SECONDS)
  );
}

function PermitMatches(
  permit: Eip712TypedData,
  subscribe: Eip712TypedData,
  deadline: number,
  subscriber: string
): boolean {
  const value = ToBigInt(permit.message['value']);
  const plan = PlanPermitValue(subscribe);
  return (
    permit.primaryType === 'Permit' &&
    SameAddress(String(permit.message['owner']), subscriber) &&
    SameAddress(
      String(permit.message['spender']),
      subscribe.domain.verifyingContract
    ) &&
    SameAddress(
      permit.domain.verifyingContract,
      String(subscribe.message['token'])
    ) &&
    Number(permit.message['deadline']) === deadline &&
    value !== null &&
    plan !== null &&
    value >= plan.value
  );
}

function PrimaryPrice(session: CheckoutSession): Price | null {
  const price = session.line_items?.data?.[0]?.price;
  return price && typeof price === 'object' ? price : null;
}

function PeriodSeconds(interval: RecurringInterval): number {
  return PERIOD_SECONDS.find(([name]) => name === interval)?.[1] ?? 0;
}

/** Hex equality ignoring case. */
function SameHex(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** e.g. `3 Nov 2026` */
function FormatChargeDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** An integer from typed data, or null when it is not one. */
function ToBigInt(value: string | number | undefined): bigint | null {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  if (typeof value === 'string' && !/^\d+$/.test(value)) return null;
  return value === undefined ? null : BigInt(value);
}
