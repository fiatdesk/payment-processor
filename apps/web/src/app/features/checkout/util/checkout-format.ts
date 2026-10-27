import type { CheckoutSession, PaymentLink } from '@fiatdesk/shared-types';

export const DEFAULT_CHECKOUT_CONFIRMATION_MESSAGE = 'Thanks for your order';

export function FormatUsdcAmount(cents: number | null | undefined): string {
  return `US$${((cents ?? 0) / 100).toFixed(2)}`;
}

type SubmitType =
  | PaymentLink['submit_type']
  | CheckoutSession['submit_type']
  | null
  | undefined;

/**
 * Label for the hosted checkout / preview pay button. `stillConfirming`:
 * polling stopped, so the button checks on the payment again.
 */
export function GetCheckoutSubmitLabel(
  submitType: SubmitType,
  isSubscription = false,
  stillConfirming = false
): string {
  if (stillConfirming) {
    return isSubscription
      ? 'Check subscription status'
      : 'Check payment status';
  }
  if (isSubscription) return 'Subscribe';
  switch (submitType) {
    case 'book':
      return 'Book';
    case 'donate':
      return 'Donate';
    case 'subscribe':
      return 'Subscribe';
    default:
      return 'Pay';
  }
}

/** Label for the pay button while a payment or subscription is busy. */
export function GetCheckoutBusyLabel(
  phase: string,
  isSubscription: boolean
): string {
  switch (phase) {
    case 'awaiting_wallet':
      return 'Confirm in wallet';
    case 'confirming':
      return isSubscription ? 'Confirming subscription' : 'Confirming payment';
    default:
      return 'Processing';
  }
}
