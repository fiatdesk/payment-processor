// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Hosted checkout's payment steps outside the page: checking what the
 * customer is asked to sign, and confirming the payment until it settles.
 * The page's state is written through `CheckoutPaymentState`, so the
 * component only drives the wallet and decides what to tell the customer.
 */
import { WritableSignal } from '@angular/core';
import {
  CheckoutPaymentTransaction,
  CheckoutSession,
  Eip712TypedData,
  SameAddress,
} from '@zoneless/shared-types';

import {
  CheckoutPaymentConfirmation,
  CheckoutSessionService,
  ReadConfirmRetry,
} from '../../../data/services/checkout-session.service';

export type PaymentPhase =
  | 'idle'
  | 'awaiting_wallet'
  | 'processing'
  | 'confirming'
  | 'complete';

/** A confirming payment is checked again this often, for this long. */
export const CONFIRM_POLL_INTERVAL_MS = 4_000;
export const CONFIRM_POLL_TIMEOUT_MS = 5 * 60_000;

export const CONFIRMING_MESSAGE =
  'Waiting for network confirmations. This can take a minute.';
export const ALREADY_CONFIRMING_MESSAGE =
  'A payment for this checkout is already being confirmed';
const ATTEMPT_ENDED_MESSAGE =
  'The other payment for this checkout did not go through. You can pay now.';
const OUT_OF_DATE_MESSAGE =
  'This payment request is out of date. Reload the page and try again.';
/** USDC has 6 decimals: one cent is 10 000 base units. */
const USDC_UNITS_PER_CENT = BigInt(10_000);

/** The payment is still confirming when checkout stops polling. */
export class StillConfirmingError extends Error {
  constructor() {
    super(
      'Your payment is still confirming. Keep this page open, then check again.'
    );
  }
}

/**
 * The network does not know the relayed payment and no signature is held,
 * so the payer must sign it again. `payerWallet` is the wallet the session
 * recorded; only it can pay until the session expires.
 */
export class SignatureRequiredError extends Error {
  constructor(readonly payerWallet: string | null) {
    super(
      'The payment was not sent to the network. Press Pay to sign it again.'
    );
  }
}

/** The page state the confirmer writes. */
export interface CheckoutPaymentState {
  phase: WritableSignal<PaymentPhase>;
  notice: WritableSignal<string | null>;
  transactionHash: WritableSignal<string | null>;
}

export type CheckoutConfirmApi = Pick<
  CheckoutSessionService,
  'ConfirmPayment' | 'GetPublicCheckoutSession'
>;

export class CheckoutPaymentConfirmer {
  /**
   * The customer's signature of the session's authorization. Confirming
   * again with it is always safe, so it is kept until the payment settles
   * or fails.
   */
  private held: { checkoutSessionId: string; signature: string } | null = null;
  private stopped = false;

  constructor(
    private readonly api: CheckoutConfirmApi,
    private readonly state: CheckoutPaymentState
  ) {}

  Hold(session: CheckoutSession, signature: string): void {
    this.held = { checkoutSessionId: session.id, signature };
  }

  HeldSignature(session: CheckoutSession): string | null {
    return this.held?.checkoutSessionId === session.id
      ? this.held.signature
      : null;
  }

  /**
   * Pay should check on the payment instead of starting one: a signature is
   * held, or polling stopped with a reported transaction.
   */
  CanCheckAgain(session: CheckoutSession): boolean {
    return !!this.HeldSignature(session) || !!this.state.transactionHash();
  }

  /** Forget the signature and the reported transaction. */
  Forget(): void {
    this.held = null;
    this.state.transactionHash.set(null);
  }

  /** Stop polling: the page is gone. */
  Stop(): void {
    this.stopped = true;
  }

  Confirm(
    session: CheckoutSession,
    confirmation: CheckoutPaymentConfirmation
  ): Promise<CheckoutSession> {
    if (this.state.phase() !== 'confirming') this.state.phase.set('processing');
    return this.api.ConfirmPayment(session.url_slug, confirmation);
  }

  /** Shows the payment as confirming; a known hash is kept over null. */
  ShowConfirming(
    transactionHash: string | null,
    notice: string = CONFIRMING_MESSAGE
  ): void {
    this.state.phase.set('confirming');
    if (transactionHash) this.state.transactionHash.set(transactionHash);
    if (notice !== CONFIRMING_MESSAGE || !this.state.notice()) {
      this.state.notice.set(notice);
    }
  }

  /**
   * Confirm, then while the API answers `payment_pending` or
   * `payment_resubmit_required`, or gives no answer, confirm again every
   * 4 s for up to 5 minutes. A held signature is always what is sent: the
   * API never pays twice for it and relays it again if the network dropped
   * the payment. Without one, the payment is followed by its transaction
   * hash; if the network lost it, the payer must sign again
   * (`SignatureRequiredError`).
   */
  async ConfirmUntilSettled(
    session: CheckoutSession,
    knownTransactionHash: string | null = null
  ): Promise<CheckoutSession> {
    const deadline = Date.now() + CONFIRM_POLL_TIMEOUT_MS;
    let transactionHash = knownTransactionHash;

    while (!this.stopped) {
      const confirmation = this.Confirmation(session, transactionHash);
      if (!confirmation) {
        // Defensive: callers pass the hash the API reported or the session
        // recorded. Without one, read what the session records now.
        const latest = await this.api.GetPublicCheckoutSession(
          session.url_slug
        );
        if (latest.status === 'complete') return latest;
        transactionHash = latest.payment_details?.transaction_hash ?? null;
        if (!transactionHash) throw new Error(ATTEMPT_ENDED_MESSAGE);
        continue;
      }
      try {
        return await this.Confirm(session, confirmation);
      } catch (error) {
        const retry = ReadConfirmRetry(error);
        if (!retry) throw error;
        // The API answers this only to a confirm by hash; a held signature
        // (defensive) is simply sent again.
        if (
          retry.reason === 'payment_resubmit_required' &&
          !('signature' in confirmation)
        ) {
          return this.RequireSignature(session);
        }
        transactionHash = retry.transactionHash ?? transactionHash;
        this.ShowConfirming(
          transactionHash,
          retry.anotherConfirmation ? ALREADY_CONFIRMING_MESSAGE : undefined
        );
      }
      if (Date.now() >= deadline) throw new StillConfirmingError();
      await Delay(CONFIRM_POLL_INTERVAL_MS);
    }
    throw new StillConfirmingError();
  }

  /** The held signature, else the payment's hash, else nothing yet. */
  private Confirmation(
    session: CheckoutSession,
    transactionHash: string | null
  ): CheckoutPaymentConfirmation | null {
    const signature = this.HeldSignature(session);
    if (signature) return { signature };
    return transactionHash ? { transaction_hash: transactionHash } : null;
  }

  /** The session if it completed meanwhile, else who must sign again. */
  private async RequireSignature(
    session: CheckoutSession
  ): Promise<CheckoutSession> {
    const latest = await this.api.GetPublicCheckoutSession(session.url_slug);
    if (latest.status === 'complete') return latest;
    throw new SignatureRequiredError(
      latest.payment_details?.payer_wallet ?? null
    );
  }
}

function Delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The prepared EIP-3009 authorization, checked to be for `chainId` (a
 * wallet signs typed data only for the chain it is on) and to pay this
 * checkout: from `payer`, to the merchant, the amount due.
 */
export function RequireAuthorizationTypedData(
  prepared: CheckoutPaymentTransaction,
  chainId: number,
  payer: string
): Eip712TypedData {
  const typedData = prepared.typed_data;
  if (prepared.method !== 'eip3009_transfer' || !typedData) {
    throw new Error(
      'This checkout cannot be paid from a wallet on this network yet.'
    );
  }
  if (typedData.domain.chainId !== chainId) {
    throw new Error(
      'The payment is for a different network than this checkout. Refresh the page and try again.'
    );
  }
  const { from, to, value } = typedData.message;
  const amountDue = BigInt(prepared.amount_total) * USDC_UNITS_PER_CENT;
  if (
    !SameAddress(String(from), payer) ||
    !SameAddress(String(to), prepared.merchant_wallet_address) ||
    String(value) !== amountDue.toString()
  ) {
    throw new Error(OUT_OF_DATE_MESSAGE);
  }
  return typedData;
}

/** `0xABCD…1234` */
export function ShortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
