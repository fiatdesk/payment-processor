// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Hosted checkout's subscription steps: checking the prepared USDC permit
 * and `Subscribe` against this checkout, describing what the customer
 * authorizes, and signing both for one confirm.
 */
import { WritableSignal } from '@angular/core';
import type { TypedDataDefinition } from 'viem';
import {
  CheckoutPaymentTransaction,
  CheckoutSession,
  Eip712TypedData,
  Price,
  RecurringInterval,
  SameAddress,
} from '@zoneless/shared-types';

import type { WalletService } from '../../../core';
import { CheckoutPaymentConfirmer, ShortAddress } from './checkout-payment';

/** USDC has 6 decimals: one cent is 10 000 base units. */
const USDC_UNITS_PER_CENT = BigInt(10_000);
const USDC_UNITS_PER_USDC = BigInt(1_000_000);
/** A permit covers at least 12 periods and at least a year, as the API sizes it. */
const PERMIT_MIN_PERIODS = BigInt(12);
const SECONDS_PER_DAY = 24 * 3600;
const PERMIT_MIN_SECONDS = BigInt(365 * SECONDS_PER_DAY);

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
  /** With a permit: the allowance this plan adds and the total it sets */
  allowance: { added: string; total: string } | null;
}

/**
 * Signs a prepared subscription and confirms it: the USDC permit first when
 * prepare asked for one, then the `Subscribe`, both checked against this
 * checkout before the wallet is asked. One confirm sends both, and it is
 * retried with them until the subscription settles.
 */
export class CheckoutSubscriber {
  constructor(
    private readonly wallet: Pick<WalletService, 'SignTypedData'>,
    private readonly confirmer: CheckoutPaymentConfirmer,
    private readonly terms: WritableSignal<SubscribeTerms | null>
  ) {}

  /**
   * Completes checkout from the wallet's existing on-chain subscription
   * (a prior subscribe landed but its confirm failed); null when it has
   * none.
   */
  ConfirmExisting(
    session: CheckoutSession,
    prepared: CheckoutPaymentTransaction
  ): Promise<CheckoutSession | null> {
    if (!prepared.already_subscribed) return Promise.resolve(null);
    return this.confirmer.Confirm(session, {
      already_subscribed: true,
      subscription_onchain_id: prepared.subscription_onchain_id,
    });
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
      ? await this.Sign(authorization.permit)
      : null;
    const subscribeSignature = await this.Sign(authorization.subscribe);
    this.confirmer.Hold(session, {
      ...(permitSignature ? { permit_signature: permitSignature } : {}),
      subscribe_signature: subscribeSignature,
      deadline: authorization.deadline,
    });
    return this.confirmer.ConfirmUntilSettled(session);
  }

  private Sign(typedData: Eip712TypedData): Promise<string> {
    return this.wallet.SignTypedData(
      typedData as unknown as TypedDataDefinition
    );
  }
}

/**
 * The prepared `Subscribe` (and permit, when `needs_permit`), checked to be
 * for `chainId` and for this checkout: from `subscriber`, to this plan, for
 * the price's amount and period in the checkout's USDC, with the prepared
 * deadline. The permit must come from `subscriber`, let the Subscriptions
 * contract spend that USDC, and set at least the allowance the plan adds.
 */
export function RequireSubscribeAuthorization(
  prepared: CheckoutPaymentTransaction,
  session: CheckoutSession,
  chainId: number,
  subscriber: string
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
  if (
    !SubscribeMatches(subscribe, subscription.plan_id, deadline, session) ||
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

function SubscribeMatches(
  subscribe: Eip712TypedData,
  planId: string,
  deadline: number,
  session: CheckoutSession
): boolean {
  const terms = subscribe.message;
  const price = PrimaryPrice(session);
  if (!price?.recurring || price.unit_amount === null) return false;
  const periodSeconds =
    PeriodSeconds(price.recurring.interval) *
    (price.recurring.interval_count ?? 1);
  return (
    subscribe.primaryType === 'Subscribe' &&
    String(terms['planKey']).toLowerCase() === planId.toLowerCase() &&
    SameAddress(
      String(terms['token']),
      session.merchant_wallet?.token_address
    ) &&
    Number(terms['deadline']) === deadline &&
    ToBigInt(terms['amount']) ===
      BigInt(price.unit_amount) * USDC_UNITS_PER_CENT &&
    ToBigInt(terms['periodSeconds']) === BigInt(periodSeconds)
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

/**
 * The allowance a plan's permit adds, as the API sizes it:
 * `amount × max(12, ceil(365 days / periodSeconds))`.
 */
function PlanPermitValue(
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

function PrimaryPrice(session: CheckoutSession): Price | null {
  const price = session.line_items?.data?.[0]?.price;
  return price && typeof price === 'object' ? price : null;
}

function PeriodSeconds(interval: RecurringInterval): number {
  return PERIOD_SECONDS.find(([name]) => name === interval)?.[1] ?? 0;
}

/** `month`, `3 months` or `2 weeks` for an on-chain period. */
function PeriodLabel(seconds: number): string {
  for (const [interval, length] of PERIOD_SECONDS) {
    if (seconds > 0 && seconds % length === 0) {
      const count = seconds / length;
      return count === 1 ? interval : `${count} ${interval}s`;
    }
  }
  return `${seconds} seconds`;
}

/** USDC base units as `1,234.50` (2 to 6 decimals). */
function FormatUsdcUnits(units: bigint): string {
  const whole = units / USDC_UNITS_PER_USDC;
  const fraction = (units % USDC_UNITS_PER_USDC)
    .toString()
    .padStart(6, '0')
    .replace(/0{1,4}$/, '');
  return `${whole.toLocaleString('en-US')}.${fraction}`;
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
