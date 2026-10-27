// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { ApiService, type ApiError } from '../../core';
import {
  CheckoutPaymentTransaction,
  CheckoutSession,
} from '@fiatdesk/shared-types';
import {
  CreateCheckoutSessionInput,
  UpdateCheckoutSessionInput,
} from '@fiatdesk/shared-schemas';

/**
 * Subscription mode: the signed `Subscribe`, the signed USDC permit when
 * prepare asked for one, and the `deadline` both were signed with.
 */
export interface CheckoutSubscribeConfirmation {
  permit_signature?: string;
  subscribe_signature: string;
  deadline: number;
}

/**
 * What confirm takes: the customer's signature of the prepared
 * authorization (or subscription), or, to follow a payment already
 * relayed, its hash.
 */
export type CheckoutPaymentConfirmation =
  | { signature: string }
  | CheckoutSubscribeConfirmation
  | { transaction_hash: string }
  | { already_subscribed: true; subscription_onchain_id?: string };

/**
 * Confirm waits server-side for up to `CHECKOUT_CONFIRM_TIMEOUT_MS` (90 s
 * by default), so its request outlives that.
 */
export const CONFIRM_REQUEST_TIMEOUT_MS = 120_000;

/** Answers that mean a gateway, not the API, gave up on the request. */
const GATEWAY_FAILURE_STATUSES = [502, 503, 504];

/** A confirm that did not finish but can be sent again. */
export interface CheckoutConfirmRetry {
  /**
   * `payment_pending`: still confirming. `payment_resubmit_required`: the
   * network does not know the recorded relay; only the signature can
   * relay it again. `unreachable`: no answer (network error or timeout) or
   * a 502/503/504, so the payment may be in flight.
   */
  reason: 'payment_pending' | 'payment_resubmit_required' | 'unreachable';
  /** The payment transaction the API reported, if it has one yet */
  transactionHash: string | null;
  /** Another confirm is relaying or recording this payment. */
  anotherConfirmation: boolean;
}

/** How to retry a failed confirm, or null when retrying cannot help. */
export function ReadConfirmRetry(error: unknown): CheckoutConfirmRetry | null {
  if (!(error instanceof Error)) return null;
  const { status, type, details } = error as ApiError;
  if (type === 'payment_pending' || type === 'payment_resubmit_required') {
    const transactionHash = details?.['transaction_hash'];
    return {
      reason: type,
      transactionHash:
        typeof transactionHash === 'string' ? transactionHash : null,
      anotherConfirmation: details?.['reason'] === 'another_confirmation',
    };
  }
  // A gateway's 502/503 is as unknown an outcome as its 504, and the API's
  // own 502 (the network was unreachable) asks for a retry too. Retrying with
  // the signature never pays twice; the poll's 5 minutes bound the cost.
  if (status === undefined || GATEWAY_FAILURE_STATUSES.includes(status)) {
    return {
      reason: 'unreachable',
      transactionHash: null,
      anotherConfirmation: false,
    };
  }
  return null;
}

@Injectable({
  providedIn: 'root',
})
export class CheckoutSessionService {
  private readonly api = inject(ApiService);

  loading: WritableSignal<boolean> = signal(false);

  async CreateCheckoutSession(
    data: CreateCheckoutSessionInput
  ): Promise<CheckoutSession> {
    this.loading.set(true);
    try {
      const checkoutSession = await this.api.Call<CheckoutSession>(
        'POST',
        `checkout/sessions`,
        data
      );
      return checkoutSession;
    } finally {
      this.loading.set(false);
    }
  }

  async UpdateCheckoutSession(
    checkoutSessionId: string,
    data: UpdateCheckoutSessionInput
  ): Promise<CheckoutSession> {
    this.loading.set(true);
    try {
      const checkoutSession = await this.api.Call<CheckoutSession>(
        'POST',
        `checkout/sessions/${checkoutSessionId}`,
        data
      );
      return checkoutSession;
    } finally {
      this.loading.set(false);
    }
  }

  async DeleteCheckoutSession(checkoutSessionId: string): Promise<void> {
    this.loading.set(true);
    try {
      await this.api.Call<void>(
        'DELETE',
        `checkout/sessions/${checkoutSessionId}`
      );
    } finally {
      this.loading.set(false);
    }
  }

  async GetCheckoutSession(
    checkoutSessionId: string
  ): Promise<CheckoutSession> {
    this.loading.set(true);
    try {
      const checkoutSession = await this.api.Call<CheckoutSession>(
        'GET',
        `checkout/sessions/${checkoutSessionId}`
      );
      return checkoutSession;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Open a payment link via the public payment pages endpoint.
   * `urlSlug` is the opaque slug from `/b/{url_slug}`.
   */
  async OpenPaymentLink(urlSlug: string): Promise<CheckoutSession> {
    this.loading.set(true);
    try {
      return await this.api.Call<CheckoutSession>(
        'POST',
        `payment_pages/from_payment_link/${urlSlug}`
      );
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Fetch a checkout session via the public payment pages endpoint.
   * `urlSlug` is the opaque slug from `/c/{url_slug}`.
   */
  async GetPublicCheckoutSession(urlSlug: string): Promise<CheckoutSession> {
    this.loading.set(true);
    try {
      const checkoutSession = await this.api.Call<CheckoutSession>(
        'GET',
        `payment_pages/${urlSlug}`
      );
      return checkoutSession;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Prepare what the customer signs for a checkout session via the public
   * payment pages endpoint: an EIP-3009 USDC authorization as EIP-712
   * typed data or, in subscription mode, the `Subscribe` and maybe a USDC
   * permit. The API relays them and pays the gas.
   */
  async PreparePayment(
    urlSlug: string,
    payerWallet: string,
    customerDetails?: {
      email?: string;
      name?: string;
      business_name?: string;
      phone?: string;
      address?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
      };
      shipping_address?: {
        name?: string;
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
      };
      tax_id?: string;
      custom_fields?: { key: string; value: string }[];
      terms_of_service_accepted?: boolean;
    }
  ): Promise<CheckoutPaymentTransaction> {
    return this.api.Call<CheckoutPaymentTransaction>(
      'POST',
      `payment_pages/${urlSlug}/prepare`,
      {
        payer_wallet: payerWallet,
        ...customerDetails,
      }
    );
  }

  /**
   * Confirm a checkout payment. The API relays a `signature` (or the
   * subscribe signatures), waits for confirmations and returns the
   * completed session, or a 409 `payment_pending` while it confirms (see
   * `ReadConfirmRetry`).
   */
  async ConfirmPayment(
    urlSlug: string,
    confirmation: CheckoutPaymentConfirmation
  ): Promise<CheckoutSession> {
    return this.api.Call<CheckoutSession>(
      'POST',
      `payment_pages/${urlSlug}/confirm`,
      confirmation,
      { timeout: CONFIRM_REQUEST_TIMEOUT_MS }
    );
  }
}
