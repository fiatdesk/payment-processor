// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Hosted checkout's payment steps outside the page: checking what the
 * customer is asked to sign, and confirming the payment until it settles.
 * The page's state is written through `CheckoutPaymentState`, so the
 * component only drives the wallet and decides what to tell the customer.
 */
import { WritableSignal } from '@angular/core';
import type { TypedDataDefinition } from 'viem';
import {
  CheckoutPaymentTransaction,
  CheckoutSession,
  Eip712TypedData,
  SameAddress,
} from '@zoneless/shared-types';

import {
  GetApiErrorCode,
  IsUserRejectedError,
  type WalletService,
} from '../../../core';
import {
  CheckoutPaymentConfirmation,
  CheckoutSessionService,
  CheckoutSubscribeConfirmation,
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
export const ALREADY_CONFIRMING_MESSAGE = AlreadyConfirmingMessage(false);
const OUT_OF_DATE_MESSAGE =
  'This payment request is out of date. Reload the page and try again.';
/** USDC has 6 decimals: one cent is 10 000 base units. */
export const USDC_UNITS_PER_CENT = BigInt(10_000);

/**
 * The words checkout uses for what the customer is doing: a payment and
 * Pay, or (`isSubscription`) a subscription and Subscribe.
 */
export function CheckoutWords(isSubscription: boolean): {
  noun: string;
  action: string;
  verb: string;
} {
  return isSubscription
    ? { noun: 'subscription', action: 'Subscribe', verb: 'subscribe' }
    : { noun: 'payment', action: 'Pay', verb: 'pay' };
}

/** "A payment (or subscription) for this checkout is already being confirmed" */
export function AlreadyConfirmingMessage(isSubscription: boolean): string {
  return `A ${
    CheckoutWords(isSubscription).noun
  } for this checkout is already being confirmed`;
}

function IsSubscriptionSession(session: CheckoutSession): boolean {
  return session.mode === 'subscription';
}

/** The payment is still confirming when checkout stops polling. */
export class StillConfirmingError extends Error {
  constructor(isSubscription = false) {
    super(
      `Your ${
        CheckoutWords(isSubscription).noun
      } is still confirming. Keep this page open, then check again.`
    );
  }
}

/**
 * The network does not know the relayed payment and no signature is held,
 * so the payer must sign it again. `payerWallet` is the wallet the session
 * recorded; only it can pay until the session expires.
 */
export class SignatureRequiredError extends Error {
  constructor(
    readonly payerWallet: string | null,
    readonly isSubscription = false
  ) {
    const { noun, action } = CheckoutWords(isSubscription);
    super(
      `The ${noun} was not sent to the network. Press ${action} to sign it again.`
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

/** Completes from the wallet's existing on-chain subscription. */
export interface AlreadySubscribedConfirmation {
  already_subscribed: true;
  subscription_onchain_id?: string;
}

/**
 * What confirm is retried with until it settles: a payment's signature, a
 * subscription's signatures, or an existing on-chain subscription.
 */
export type SignedConfirmation =
  | { signature: string }
  | CheckoutSubscribeConfirmation
  | AlreadySubscribedConfirmation;

export class CheckoutPaymentConfirmer {
  /**
   * What the customer signed for the session. Confirming again with it is
   * always safe, so it is kept until the payment settles or fails.
   */
  private held: {
    checkoutSessionId: string;
    confirmation: SignedConfirmation;
  } | null = null;
  private stopped = false;

  constructor(
    private readonly api: CheckoutConfirmApi,
    private readonly state: CheckoutPaymentState
  ) {}

  /** Holds a payment's `signature`, or a subscription's confirm body. */
  Hold(
    session: CheckoutSession,
    signed: string | Exclude<SignedConfirmation, { signature: string }>
  ): void {
    this.held = {
      checkoutSessionId: session.id,
      confirmation: typeof signed === 'string' ? { signature: signed } : signed,
    };
  }

  Held(session: CheckoutSession): SignedConfirmation | null {
    return this.held?.checkoutSessionId === session.id
      ? this.held.confirmation
      : null;
  }

  /**
   * Pay should check on the payment instead of starting one: a signature is
   * held, or polling stopped with a reported transaction.
   */
  CanCheckAgain(session: CheckoutSession): boolean {
    return !!this.Held(session) || !!this.state.transactionHash();
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
    const isSubscription = IsSubscriptionSession(session);
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
        if (!transactionHash) {
          const { noun, verb } = CheckoutWords(isSubscription);
          throw new Error(
            `The other ${noun} for this checkout did not go through. You can ${verb} now.`
          );
        }
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
          'transaction_hash' in confirmation
        ) {
          return this.RequireSignature(session);
        }
        transactionHash = retry.transactionHash ?? transactionHash;
        this.ShowConfirming(
          transactionHash,
          retry.anotherConfirmation
            ? AlreadyConfirmingMessage(isSubscription)
            : undefined
        );
      }
      if (Date.now() >= deadline) {
        throw new StillConfirmingError(isSubscription);
      }
      await Delay(CONFIRM_POLL_INTERVAL_MS);
    }
    throw new StillConfirmingError(isSubscription);
  }

  /** What is held, else the payment's hash, else nothing yet. */
  private Confirmation(
    session: CheckoutSession,
    transactionHash: string | null
  ): CheckoutPaymentConfirmation | null {
    const held = this.Held(session);
    if (held) return held;
    return transactionHash ? { transaction_hash: transactionHash } : null;
  }

  /** The session if it completed meanwhile, else who must sign again. */
  private async RequireSignature(
    session: CheckoutSession
  ): Promise<CheckoutSession> {
    const latest = await this.api.GetPublicCheckoutSession(session.url_slug);
    if (latest.status === 'complete') return latest;
    throw new SignatureRequiredError(
      latest.payment_details?.payer_wallet ?? null,
      IsSubscriptionSession(session)
    );
  }
}

/**
 * Signs `typedData` with the wallet, but only while its account is still
 * `signer`, the wallet it was prepared for: a switched account would sign
 * a message the API then refuses.
 */
export function SignAsPrepared(
  wallet: Pick<WalletService, 'GetAddress' | 'SignTypedData'>,
  typedData: Eip712TypedData,
  signer: string,
  isSubscription: boolean
): Promise<string> {
  if (!SameAddress(wallet.GetAddress(), signer)) {
    throw new Error(
      `Your wallet switched accounts. Press ${
        CheckoutWords(isSubscription).action
      } to start again.`
    );
  }
  return wallet.SignTypedData(typedData as unknown as TypedDataDefinition);
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

/** `0x12345678…90abcdef` */
export function ShortHash(transactionHash: string): string {
  return `${transactionHash.slice(0, 10)}…${transactionHash.slice(-8)}`;
}

/**
 * Who must sign a lost payment again. Another connected wallet cannot pay
 * the session until it expires: `blockedBy` is then the recorded payer.
 */
export function ReadSignatureRequired(
  error: SignatureRequiredError,
  connected: string | null
): { message: string; blockedBy: string | null } {
  const payer = error.payerWallet;
  if (!payer) return { message: error.message, blockedBy: null };
  const { noun, action } = CheckoutWords(error.isSubscription);
  const lost = `The ${noun} from ${ShortAddress(
    payer
  )} did not reach the network.`;
  if (connected && !SameAddress(connected, payer)) {
    const blocked = error.isSubscription
      ? "can't subscribe with this checkout"
      : "can't pay this checkout";
    return {
      message: `${lost} Open this checkout with that wallet to sign it again. Another wallet ${blocked} until it expires.`,
      blockedBy: payer,
    };
  }
  return {
    message: `${lost} Press ${action} and sign it again with that wallet.`,
    blockedBy: null,
  };
}

/** Fixed words for API error codes whose own message is not for customers. */
const CHECKOUT_ERROR_MESSAGES = new Map<string, string>([
  [
    'period_already_collected',
    "This billing period was already charged to your wallet outside this checkout, so this checkout didn't start a subscription. Contact the merchant for help.",
  ],
  [
    'onchain_plan_amount_exceeded',
    'This subscription can only be bought with a quantity of 1. Contact the merchant for a new checkout link.',
  ],
  [
    'subscription_authorization_stale',
    'This subscription request expired before it was sent. Press Subscribe to sign a new one.',
  ],
]);

/** What to tell the customer about a failed payment or subscription. */
export function CheckoutErrorMessage(
  error: unknown,
  isSubscription: boolean
): string {
  if (IsUserRejectedError(error)) {
    return 'The request was rejected in your wallet.';
  }
  const fixed = CHECKOUT_ERROR_MESSAGES.get(GetApiErrorCode(error) ?? '');
  if (fixed) return fixed;
  // viem's errors carry a one-line summary next to their long message.
  const shortMessage = (error as { shortMessage?: unknown } | null)
    ?.shortMessage;
  if (typeof shortMessage === 'string' && shortMessage) return shortMessage;
  if (error instanceof Error && error.message) return error.message;
  return isSubscription
    ? 'Something went wrong starting your subscription. Please try again.'
    : 'Something went wrong processing your payment. Please try again.';
}
