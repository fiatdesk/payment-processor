import { Attribute } from './types';

/**
 * Canonical list of webhook/API event types documented on the site.
 * Keep in sync with EVENT_TYPES in @zoneless/shared-types (excluding '*').
 */
export interface EventTypeDefinition {
  name: string;
  /** Resource grouping used to slice events for object pages. */
  resource: string;
  /** Object type shown on the Types of events page (e.g. Account, Charge). */
  objectType: string;
  /** Anchor to the object docs, if any (e.g. #accounts-object). */
  objectHref?: string;
  /** Base description; the Types of events page appends a data.object sentence when objectHref is set. */
  description: string;
}

export const EVENT_TYPE_DEFINITIONS: EventTypeDefinition[] = [
  // Account events
  {
    name: 'account.created',
    resource: 'account',
    objectType: 'Account',
    objectHref: '#accounts-object',
    description: 'Occurs whenever a connected account is created.',
  },
  {
    name: 'account.updated',
    resource: 'account',
    objectType: 'Account',
    objectHref: '#accounts-object',
    description: 'Occurs whenever an account status or property has changed.',
  },

  // API Key events
  {
    name: 'api_key.created',
    resource: 'api_key',
    objectType: 'ApiKey',
    description: 'Occurs whenever a new API key is created for the platform.',
  },
  {
    name: 'api_key.updated',
    resource: 'api_key',
    objectType: 'ApiKey',
    description:
      'Occurs whenever an API key is updated (e.g., name changed or rolled).',
  },
  {
    name: 'api_key.deleted',
    resource: 'api_key',
    objectType: 'ApiKey',
    description: 'Occurs whenever an API key is deleted.',
  },

  // Balance events
  {
    name: 'balance.available',
    resource: 'balance',
    objectType: 'Balance',
    objectHref: '#balance-object',
    description:
      'Occurs whenever your platform balance or a connected account balance has been updated (e.g., when a transfer is created or a payout is processed).',
  },

  // Balance transaction events
  {
    name: 'balance_transaction.created',
    resource: 'balance_transaction',
    objectType: 'BalanceTransaction',
    objectHref: '#balance-transactions-object',
    description:
      'Occurs whenever a new balance transaction is created (transfers, payouts, top-ups, etc.).',
  },

  // Charge events
  {
    name: 'charge.captured',
    resource: 'charge',
    objectType: 'Charge',
    objectHref: '#charges-object',
    description: 'Occurs whenever a previously uncaptured charge is captured.',
  },
  {
    name: 'charge.expired',
    resource: 'charge',
    objectType: 'Charge',
    objectHref: '#charges-object',
    description: 'Occurs whenever an uncaptured charge expires.',
  },
  {
    name: 'charge.failed',
    resource: 'charge',
    objectType: 'Charge',
    objectHref: '#charges-object',
    description: 'Occurs whenever a failed charge attempt occurs.',
  },
  {
    name: 'charge.pending',
    resource: 'charge',
    objectType: 'Charge',
    objectHref: '#charges-object',
    description: 'Occurs whenever a pending charge is created.',
  },
  {
    name: 'charge.refunded',
    resource: 'charge',
    objectType: 'Charge',
    objectHref: '#charges-object',
    description:
      'Occurs whenever a charge is refunded, including partial refunds.',
  },
  {
    name: 'charge.succeeded',
    resource: 'charge',
    objectType: 'Charge',
    objectHref: '#charges-object',
    description: 'Occurs whenever a charge is successful.',
  },
  {
    name: 'charge.updated',
    resource: 'charge',
    objectType: 'Charge',
    objectHref: '#charges-object',
    description:
      'Occurs whenever a charge description or metadata is updated, or upon an asynchronous capture.',
  },

  // Checkout session events
  {
    name: 'checkout.session.async_payment_failed',
    resource: 'checkout.session',
    objectType: 'CheckoutSession',
    objectHref: '#checkout-sessions-object',
    description: "Occurs when a Checkout Session's payment attempt fails.",
  },
  {
    name: 'checkout.session.async_payment_succeeded',
    resource: 'checkout.session',
    objectType: 'CheckoutSession',
    objectHref: '#checkout-sessions-object',
    description: "Occurs when a Checkout Session's payment attempt succeeds.",
  },
  {
    name: 'checkout.session.completed',
    resource: 'checkout.session',
    objectType: 'CheckoutSession',
    objectHref: '#checkout-sessions-object',
    description:
      'Occurs when a Checkout Session has been successfully completed.',
  },
  {
    name: 'checkout.session.expired',
    resource: 'checkout.session',
    objectType: 'CheckoutSession',
    objectHref: '#checkout-sessions-object',
    description: 'Occurs when a Checkout Session is expired.',
  },

  // Customer events
  {
    name: 'customer.created',
    resource: 'customer',
    objectType: 'Customer',
    objectHref: '#customers-object',
    description: 'Occurs whenever a new customer is created.',
  },
  {
    name: 'customer.updated',
    resource: 'customer',
    objectType: 'Customer',
    objectHref: '#customers-object',
    description: 'Occurs whenever any property of a customer changes.',
  },
  {
    name: 'customer.deleted',
    resource: 'customer',
    objectType: 'Customer',
    objectHref: '#customers-object',
    description: 'Occurs whenever a customer is deleted.',
  },

  // Subscription events
  {
    name: 'customer.subscription.created',
    resource: 'subscription',
    objectType: 'Subscription',
    objectHref: '#subscriptions-object',
    description:
      'Occurs whenever a customer is signed up for a new subscription.',
  },
  {
    name: 'customer.subscription.deleted',
    resource: 'subscription',
    objectType: 'Subscription',
    objectHref: '#subscriptions-object',
    description: "Occurs whenever a customer's subscription ends.",
  },
  {
    name: 'customer.subscription.paused',
    resource: 'subscription',
    objectType: 'Subscription',
    objectHref: '#subscriptions-object',
    description:
      "Occurs whenever a subscription's status becomes <code>paused</code> when a trial ends without a payment method.",
  },
  {
    name: 'customer.subscription.pending_update_applied',
    resource: 'subscription',
    objectType: 'Subscription',
    objectHref: '#subscriptions-object',
    description:
      'Occurs whenever a pending update is applied to a subscription after the latest invoice is paid.',
  },
  {
    name: 'customer.subscription.pending_update_expired',
    resource: 'subscription',
    objectType: 'Subscription',
    objectHref: '#subscriptions-object',
    description:
      'Occurs whenever a pending update expires before it can be applied.',
  },
  {
    name: 'customer.subscription.resumed',
    resource: 'subscription',
    objectType: 'Subscription',
    objectHref: '#subscriptions-object',
    description:
      'Occurs whenever a paused subscription is resumed and becomes <code>active</code> again.',
  },
  {
    name: 'customer.subscription.trial_will_end',
    resource: 'subscription',
    objectType: 'Subscription',
    objectHref: '#subscriptions-object',
    description:
      "Occurs three days before a subscription's trial period is scheduled to end, if the subscription has a trial period.",
  },
  {
    name: 'customer.subscription.updated',
    resource: 'subscription',
    objectType: 'Subscription',
    objectHref: '#subscriptions-object',
    description:
      'Occurs whenever a subscription changes (for example, switching from one price to another, or changing the status from trial to active).',
  },

  // External account (wallet) events
  {
    name: 'external_account.created',
    resource: 'external_account',
    objectType: 'ExternalWallet',
    objectHref: '#external-wallets-object',
    description:
      'Occurs whenever an external wallet is created (a Solana wallet address added to receive USDC payouts).',
  },
  {
    name: 'external_account.updated',
    resource: 'external_account',
    objectType: 'ExternalWallet',
    objectHref: '#external-wallets-object',
    description: 'Occurs whenever an external wallet is updated.',
  },
  {
    name: 'external_account.deleted',
    resource: 'external_account',
    objectType: 'ExternalWallet',
    objectHref: '#external-wallets-object',
    description: 'Occurs whenever an external wallet is deleted.',
  },

  // Identity verification session events
  {
    name: 'identity.verification_session.created',
    resource: 'identity.verification_session',
    objectType: 'VerificationSession',
    objectHref: '#identity-verification-sessions-object',
    description: 'Occurs whenever a verification session is created.',
  },
  {
    name: 'identity.verification_session.processing',
    resource: 'identity.verification_session',
    objectType: 'VerificationSession',
    objectHref: '#identity-verification-sessions-object',
    description:
      'Occurs whenever a verification session transitions to <code>processing</code>, once the seller submits their documents or moves through the flow.',
  },
  {
    name: 'identity.verification_session.requires_input',
    resource: 'identity.verification_session',
    objectType: 'VerificationSession',
    objectHref: '#identity-verification-sessions-object',
    description:
      'Occurs whenever a verification session transitions to <code>requires_input</code>, when the seller needs to provide more information or try again.',
  },
  {
    name: 'identity.verification_session.verified',
    resource: 'identity.verification_session',
    objectType: 'VerificationSession',
    objectHref: '#identity-verification-sessions-object',
    description:
      'Occurs whenever a verification session transitions to <code>verified</code>, once the check passes.',
  },
  {
    name: 'identity.verification_session.canceled',
    resource: 'identity.verification_session',
    objectType: 'VerificationSession',
    objectHref: '#identity-verification-sessions-object',
    description: 'Occurs whenever a verification session is canceled.',
  },
  {
    name: 'identity.verification_session.redacted',
    resource: 'identity.verification_session',
    objectType: 'VerificationSession',
    objectHref: '#identity-verification-sessions-object',
    description: 'Occurs whenever a verification session is redacted.',
  },

  // Invoice events
  {
    name: 'invoice.created',
    resource: 'invoice',
    objectType: 'Invoice',
    objectHref: '#invoices-object',
    description: 'Occurs whenever a new invoice is created.',
  },
  {
    name: 'invoice.deleted',
    resource: 'invoice',
    objectType: 'Invoice',
    objectHref: '#invoices-object',
    description: 'Occurs whenever a draft invoice is deleted.',
  },
  {
    name: 'invoice.finalized',
    resource: 'invoice',
    objectType: 'Invoice',
    objectHref: '#invoices-object',
    description:
      'Occurs whenever a draft invoice is finalized and updated to be an open invoice.',
  },
  {
    name: 'invoice.marked_uncollectible',
    resource: 'invoice',
    objectType: 'Invoice',
    objectHref: '#invoices-object',
    description: 'Occurs whenever an invoice is marked uncollectible.',
  },
  {
    name: 'invoice.paid',
    resource: 'invoice',
    objectType: 'Invoice',
    objectHref: '#invoices-object',
    description:
      'Occurs whenever an invoice payment attempt succeeds or an invoice is marked as paid out-of-band.',
  },
  {
    name: 'invoice.payment_failed',
    resource: 'invoice',
    objectType: 'Invoice',
    objectHref: '#invoices-object',
    description:
      'Occurs whenever an invoice payment attempt fails, for example due to insufficient USDC or a missing payment method.',
  },
  {
    name: 'invoice.payment_succeeded',
    resource: 'invoice',
    objectType: 'Invoice',
    objectHref: '#invoices-object',
    description: 'Occurs whenever an invoice payment attempt succeeds.',
  },
  {
    name: 'invoice.updated',
    resource: 'invoice',
    objectType: 'Invoice',
    objectHref: '#invoices-object',
    description:
      'Occurs whenever an invoice changes (for example, the invoice amount).',
  },
  {
    name: 'invoice.voided',
    resource: 'invoice',
    objectType: 'Invoice',
    objectHref: '#invoices-object',
    description: 'Occurs whenever an invoice is voided.',
  },

  // Invoice item events
  {
    name: 'invoiceitem.created',
    resource: 'invoiceitem',
    objectType: 'InvoiceItem',
    objectHref: '#invoiceitems-object',
    description: 'Occurs whenever an invoice item is created.',
  },
  {
    name: 'invoiceitem.deleted',
    resource: 'invoiceitem',
    objectType: 'InvoiceItem',
    objectHref: '#invoiceitems-object',
    description: 'Occurs whenever an invoice item is deleted.',
  },

  // PaymentIntent events
  {
    name: 'payment_intent.created',
    resource: 'payment_intent',
    objectType: 'PaymentIntent',
    objectHref: '#payment-intents-object',
    description: 'Occurs when a new PaymentIntent is created.',
  },
  {
    name: 'payment_intent.updated',
    resource: 'payment_intent',
    objectType: 'PaymentIntent',
    objectHref: '#payment-intents-object',
    description: 'Occurs when a PaymentIntent is updated.',
  },
  {
    name: 'payment_intent.canceled',
    resource: 'payment_intent',
    objectType: 'PaymentIntent',
    objectHref: '#payment-intents-object',
    description: 'Occurs when a PaymentIntent is canceled.',
  },
  {
    name: 'payment_intent.payment_failed',
    resource: 'payment_intent',
    objectType: 'PaymentIntent',
    objectHref: '#payment-intents-object',
    description:
      'Occurs when a PaymentIntent has failed the attempt to create a payment.',
  },
  {
    name: 'payment_intent.processing',
    resource: 'payment_intent',
    objectType: 'PaymentIntent',
    objectHref: '#payment-intents-object',
    description: 'Occurs when a PaymentIntent has started processing.',
  },
  {
    name: 'payment_intent.requires_action',
    resource: 'payment_intent',
    objectType: 'PaymentIntent',
    objectHref: '#payment-intents-object',
    description:
      'Occurs when a PaymentIntent transitions to <code>requires_action</code>.',
  },
  {
    name: 'payment_intent.succeeded',
    resource: 'payment_intent',
    objectType: 'PaymentIntent',
    objectHref: '#payment-intents-object',
    description:
      'Occurs when a PaymentIntent has successfully completed payment.',
  },

  // Payment Link events
  {
    name: 'payment_link.created',
    resource: 'payment_link',
    objectType: 'PaymentLink',
    objectHref: '#payment-links-object',
    description: 'Occurs whenever a payment link is created.',
  },
  {
    name: 'payment_link.updated',
    resource: 'payment_link',
    objectType: 'PaymentLink',
    objectHref: '#payment-links-object',
    description: 'Occurs whenever a payment link is updated.',
  },

  // Payout events
  {
    name: 'payout.created',
    resource: 'payout',
    objectType: 'Payout',
    objectHref: '#payouts-object',
    description: 'Occurs whenever a payout is created.',
  },
  {
    name: 'payout.updated',
    resource: 'payout',
    objectType: 'Payout',
    objectHref: '#payouts-object',
    description: 'Occurs whenever a payout is updated.',
  },
  {
    name: 'payout.paid',
    resource: 'payout',
    objectType: 'Payout',
    objectHref: '#payouts-object',
    description:
      "Occurs whenever a payout is expected to be available in the destination wallet. The USDC has been sent on-chain to the connected account's Solana wallet.",
  },
  {
    name: 'payout.failed',
    resource: 'payout',
    objectType: 'Payout',
    objectHref: '#payouts-object',
    description:
      "Occurs whenever a payout attempt fails. This can happen if the destination wallet is invalid or if there's an on-chain error.",
  },
  {
    name: 'payout.canceled',
    resource: 'payout',
    objectType: 'Payout',
    objectHref: '#payouts-object',
    description: 'Occurs whenever a payout is canceled.',
  },

  // Person events
  {
    name: 'person.created',
    resource: 'person',
    objectType: 'Person',
    objectHref: '#persons-object',
    description:
      'Occurs whenever a person associated with an account is created.',
  },
  {
    name: 'person.updated',
    resource: 'person',
    objectType: 'Person',
    objectHref: '#persons-object',
    description:
      'Occurs whenever a person associated with an account is updated.',
  },
  {
    name: 'person.deleted',
    resource: 'person',
    objectType: 'Person',
    objectHref: '#persons-object',
    description:
      'Occurs whenever a person associated with an account is deleted.',
  },

  // Product events
  {
    name: 'product.created',
    resource: 'product',
    objectType: 'Product',
    objectHref: '#products-object',
    description: 'Occurs whenever a product is created.',
  },
  {
    name: 'product.updated',
    resource: 'product',
    objectType: 'Product',
    objectHref: '#products-object',
    description: 'Occurs whenever a product is updated.',
  },
  {
    name: 'product.deleted',
    resource: 'product',
    objectType: 'Product',
    objectHref: '#products-object',
    description: 'Occurs whenever a product is deleted.',
  },

  // Price events
  {
    name: 'price.created',
    resource: 'price',
    objectType: 'Price',
    objectHref: '#prices-object',
    description: 'Occurs whenever a price is created.',
  },
  {
    name: 'price.updated',
    resource: 'price',
    objectType: 'Price',
    objectHref: '#prices-object',
    description: 'Occurs whenever a price is updated.',
  },
  {
    name: 'price.deleted',
    resource: 'price',
    objectType: 'Price',
    objectHref: '#prices-object',
    description: 'Occurs whenever a price is deleted.',
  },

  // Top-up events
  {
    name: 'topup.created',
    resource: 'topup',
    objectType: 'TopUp',
    objectHref: '#top-ups-object',
    description:
      "Occurs whenever a top-up is created. Top-ups add USDC to your platform balance by sending USDC to your platform's Solana wallet.",
  },
  {
    name: 'topup.canceled',
    resource: 'topup',
    objectType: 'TopUp',
    objectHref: '#top-ups-object',
    description: 'Occurs whenever a top-up is canceled.',
  },
  {
    name: 'topup.failed',
    resource: 'topup',
    objectType: 'TopUp',
    objectHref: '#top-ups-object',
    description: 'Occurs whenever a top-up fails.',
  },
  {
    name: 'topup.reversed',
    resource: 'topup',
    objectType: 'TopUp',
    objectHref: '#top-ups-object',
    description: 'Occurs whenever a top-up is reversed.',
  },
  {
    name: 'topup.succeeded',
    resource: 'topup',
    objectType: 'TopUp',
    objectHref: '#top-ups-object',
    description:
      'Occurs whenever a top-up succeeds and the USDC is available in your platform balance.',
  },

  // Transfer events
  {
    name: 'transfer.created',
    resource: 'transfer',
    objectType: 'Transfer',
    objectHref: '#transfers-object',
    description:
      "Occurs whenever a transfer is created. Transfers move funds from your platform balance to a connected account's balance.",
  },
  {
    name: 'transfer.updated',
    resource: 'transfer',
    objectType: 'Transfer',
    objectHref: '#transfers-object',
    description:
      "Occurs whenever a transfer's description or metadata is updated.",
  },
  {
    name: 'transfer.reversed',
    resource: 'transfer',
    objectType: 'Transfer',
    objectHref: '#transfers-object',
    description: 'Occurs whenever a transfer is reversed.',
  },
];

function ObjectArticle(objectType: string): string {
  return /^[AEIOU]/i.test(objectType) ? 'an' : 'a';
}

/** Attributes for the Types of events docs page. */
export function GetEventTypesListAttributes(): Attribute[] {
  return EVENT_TYPE_DEFINITIONS.map((def) => {
    let description = def.description;
    if (def.objectHref) {
      description += ` <code>data.object</code> is ${ObjectArticle(
        def.objectType
      )} <a href="${def.objectHref}">${def.objectType}</a>.`;
    }
    return {
      name: def.name,
      type: def.objectType,
      description,
    };
  });
}

/** Attributes for per-resource object pages (type shown as "event"). */
export function GetResourceEventAttributes(resource: string): Attribute[] {
  return EVENT_TYPE_DEFINITIONS.filter((def) => def.resource === resource).map(
    (def) => ({
      name: def.name,
      type: 'event',
      description: def.description,
    })
  );
}
