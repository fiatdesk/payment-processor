/**
 * Hosted checkout's cross-chain payment through NEAR Intents: following the
 * swap until the session completes, and the words and links the panel shows.
 * The poll reads everything from the API, so it resumes after a refresh.
 */
import { WritableSignal } from '@angular/core';
import {
  CheckoutSession,
  CrossChainPaymentStatus,
} from '@fiatdesk/shared-types';

import {
  CheckoutSessionService,
  IsUnreachableError,
} from '../../../data/services/checkout-session.service';

/** A cross-chain payment is checked this often, for this long. */
export const CROSS_CHAIN_POLL_INTERVAL_MS = 5_000;
export const CROSS_CHAIN_POLL_TIMEOUT_MS = 30 * 60_000;

/** Decimals the origin amount is shown with, rounded up so it is enough. */
const ORIGIN_AMOUNT_DECIMALS = 6;

const ORIGIN_EXPLORER_TX_URLS = new Map<string, string>([
  ['near', 'https://nearblocks.io/txns/'],
]);

export type CrossChainFailedStatus = Extract<
  CrossChainPaymentStatus,
  'REFUNDED' | 'FAILED'
>;

/** The swap ended without paying the merchant. */
export class CrossChainFailedError extends Error {
  constructor(readonly status: CrossChainFailedStatus) {
    super(
      status === 'REFUNDED'
        ? 'The payment could not be completed and was refunded to your refund address.'
        : 'The payment could not be completed. Get a new quote to try again.'
    );
  }
}

/** The swap is still running when checkout stops polling. */
export class CrossChainTimeoutError extends Error {
  constructor() {
    super(
      'Your payment is still being processed. Keep this page open, then check again.'
    );
  }
}

export type CrossChainApi = Pick<
  CheckoutSessionService,
  'GetCrossChainPayment'
>;

/** The page state the poller writes. */
export interface CrossChainPollState {
  status: WritableSignal<CrossChainPaymentStatus | null>;
}

export class CrossChainPoller {
  private stopped = false;

  constructor(
    private readonly api: CrossChainApi,
    private readonly state: CrossChainPollState
  ) {}

  /** Stop polling: the page is gone. */
  Stop(): void {
    this.stopped = true;
  }

  /**
   * Read the cross-chain payment every 5 s for up to 30 minutes until the
   * session completes. A refunded or failed swap throws
   * `CrossChainFailedError`; no answer from the API is retried.
   */
  async PollUntilSettled(session: CheckoutSession): Promise<CheckoutSession> {
    const deadline = Date.now() + CROSS_CHAIN_POLL_TIMEOUT_MS;

    while (!this.stopped) {
      const latest = await this.api
        .GetCrossChainPayment(session.url_slug)
        .catch((error: unknown) => {
          if (IsUnreachableError(error)) return null;
          throw error;
        });
      if (latest) {
        const status = latest.payment_details?.cross_chain?.status ?? null;
        this.state.status.set(status);
        if (latest.status === 'complete') return latest;
        if (status === 'REFUNDED' || status === 'FAILED') {
          throw new CrossChainFailedError(status);
        }
      }
      if (Date.now() >= deadline) throw new CrossChainTimeoutError();
      await Delay(CROSS_CHAIN_POLL_INTERVAL_MS);
    }
    throw new CrossChainTimeoutError();
  }
}

function Delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `1.434451061468531973266814` and `wNEAR` → `1.434452 wNEAR`: at most 6
 * decimals, rounded up so the deposit is never short.
 */
export function FormatOriginAmount(
  amountInFormatted: string,
  label: string
): string {
  if (!/^\d+(\.\d+)?$/.test(amountInFormatted)) {
    return `${amountInFormatted} ${label}`;
  }
  const [whole, fraction = ''] = amountInFormatted.split('.');
  const kept = fraction
    .slice(0, ORIGIN_AMOUNT_DECIMALS)
    .padEnd(ORIGIN_AMOUNT_DECIMALS, '0');
  const roundUp = /[1-9]/.test(fraction.slice(ORIGIN_AMOUNT_DECIMALS));
  const units = BigInt(whole + kept) + BigInt(roundUp ? 1 : 0);
  const digits = units.toString().padStart(ORIGIN_AMOUNT_DECIMALS + 1, '0');
  const amount = `${digits.slice(0, -ORIGIN_AMOUNT_DECIMALS)}.${digits.slice(
    -ORIGIN_AMOUNT_DECIMALS
  )}`
    .replace(/0+$/, '')
    .replace(/\.$/, '');
  return `${amount} ${label}`;
}

/** Whole seconds until `quoteDeadline` (Unix seconds) at `now` (ms), at least 0. */
export function DeadlineSeconds(
  quoteDeadline: number,
  now: number = Date.now()
): number {
  return Math.max(0, quoteDeadline - Math.floor(now / 1000));
}

/**
 * Explorer link for a transaction on the origin network, or null for a
 * simulated hash or a network without a known explorer.
 */
export function OriginExplorerTxUrl(
  network: string,
  hash: string | null
): string | null {
  const base = ORIGIN_EXPLORER_TX_URLS.get(network);
  if (!base || !hash || hash.startsWith('sim_')) return null;
  return `${base}${encodeURIComponent(hash)}`;
}
