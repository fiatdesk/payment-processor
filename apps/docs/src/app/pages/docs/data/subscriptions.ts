import { DocSubSection, DocPage, Attribute } from './types';
import { NODE_INIT, EXPAND_TOOLTIP, BuildEndpointSummaries } from './shared';
import { GetResourceEventAttributes } from './event-types';

export const SUBSCRIPTIONS_SUBSECTION: DocSubSection = {
  id: 'subscriptions',
  title: 'Subscriptions',
  children: [
    { id: 'object', title: 'The Subscription object' },
    { id: 'create', title: 'Create a subscription' },
    { id: 'update', title: 'Update a subscription' },
    { id: 'retrieve', title: 'Retrieve a subscription' },
    { id: 'list', title: 'List all subscriptions' },
    { id: 'cancel', title: 'Cancel a subscription' },
    { id: 'migrate', title: 'Migrate a subscription' },
    { id: 'resume', title: 'Resume a subscription' },
  ],
};

// ============================================
// Shared helpers
// ============================================

const HOUR_INTERVAL_NOTE =
  "<strong>Zoneless extension:</strong> The <code>hour</code> interval is not present in Stripe's API. It enables short Solana subscription periods.";

const RECURRING_INTERVAL_ENUM: Attribute['enumValues'] = [
  { value: 'hour', description: 'Billed every hour.' },
  { value: 'day', description: 'Billed daily.' },
  { value: 'week', description: 'Billed weekly.' },
  { value: 'month', description: 'Billed monthly.' },
  { value: 'year', description: 'Billed yearly.' },
];

const TIMESTAMP_RANGE_CHILDREN: Attribute[] = [
  {
    name: 'gt',
    type: 'integer',
    description: 'Minimum value to filter by (exclusive).',
  },
  {
    name: 'gte',
    type: 'integer',
    description: 'Minimum value to filter by (inclusive).',
  },
  {
    name: 'lt',
    type: 'integer',
    description: 'Maximum value to filter by (exclusive).',
  },
  {
    name: 'lte',
    type: 'integer',
    description: 'Maximum value to filter by (inclusive).',
  },
];

const SIMPLIFIED_TAX_RATE_CHILDREN: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description: 'Unique identifier for the object.',
  },
  {
    name: 'display_name',
    type: 'string',
    description:
      'The display name of the tax rate as it appears to your customer.',
  },
  {
    name: 'percentage',
    type: 'float',
    description: 'Tax rate percentage out of 100.',
  },
  {
    name: 'inclusive',
    type: 'boolean',
    description: 'Whether this tax rate is inclusive or exclusive.',
  },
  {
    name: 'tax_type',
    type: 'string',
    nullable: true,
    description:
      'The high-level tax type, such as <code>vat</code> or <code>sales_tax</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Stripe supports 40+ jurisdiction-specific <code>tax_type</code> values. Zoneless keeps this as a plain string for maintainability.',
  },
];

const DISCOUNT_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'coupon',
    type: 'string',
    description: 'ID of the coupon to create a new discount for.',
  },
  {
    name: 'discount',
    type: 'string',
    description:
      'ID of an existing discount on the object (or one of its ancestors) to reuse.',
  },
  {
    name: 'promotion_code',
    type: 'string',
    description: 'ID of the promotion code to create a new discount for.',
  },
];

const PRICE_EXPAND_TOOLTIP = {
  label: 'Expandable',
  content:
    'This can be <a href="/prices">expanded</a> into a full <code>Price</code> object with the <code>expand</code> request parameter.',
};

const PRICE_DATA_CHILDREN: Attribute[] = [
  {
    name: 'currency',
    type: 'string',
    required: true,
    description:
      'Three-letter currency code, in lowercase. For Zoneless, use <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Use <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
  },
  {
    name: 'product',
    type: 'string',
    required: true,
    description: 'The ID of the product this price is associated with.',
  },
  {
    name: 'recurring',
    type: 'object',
    required: true,
    description:
      'The recurring components of a price such as <code>interval</code> and <code>interval_count</code>.',
    expandable: true,
    children: [
      {
        name: 'interval',
        type: 'enum',
        required: true,
        description:
          'Specifies billing frequency. One of <code>hour</code>, <code>day</code>, <code>week</code>, <code>month</code>, or <code>year</code>.',
        enumValues: RECURRING_INTERVAL_ENUM,
        enumNote: HOUR_INTERVAL_NOTE,
      },
      {
        name: 'interval_count',
        type: 'integer',
        description:
          'The number of intervals between subscription billings. For example, <code>interval=month</code> and <code>interval_count=3</code> bills every 3 months.',
      },
    ],
  },
  {
    name: 'tax_behavior',
    type: 'enum',
    description:
      'Specifies whether the price is considered inclusive of taxes or exclusive of taxes.',
    enumValues: [
      { value: 'exclusive' },
      { value: 'inclusive' },
      { value: 'unspecified' },
    ],
  },
  {
    name: 'unit_amount',
    type: 'integer',
    description:
      'A positive integer in the smallest currency unit (cents for USDC) representing how much to charge.',
  },
  {
    name: 'unit_amount_decimal',
    type: 'string',
    description:
      'Same as <code>unit_amount</code>, but accepts a decimal string with at most 12 decimal places.',
  },
];

const PAYMENT_SETTINGS_CHILDREN: Attribute[] = [
  {
    name: 'payment_method_options',
    type: 'object',
    description:
      'Payment-method-specific configuration passed to invoices created by the subscription.',
    expandable: true,
    children: [
      {
        name: 'crypto',
        type: 'object',
        description: 'Configuration for USDC wallet payments.',
        expandable: true,
        children: [
          {
            name: 'setup_future_usage',
            type: 'enum',
            description:
              'Indicates that you intend to make future payments with this payment method.',
            enumValues: [
              {
                value: 'none',
                description: 'Use this payment method for a single payment.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'payment_method_types',
    type: 'array of strings',
    description:
      'The list of payment method types to provide to every invoice created by the subscription.',
    enumValues: [
      { value: 'crypto', description: 'USDC wallet payments on Solana.' },
    ],
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless only supports <code>crypto</code>. Card and other fiat payment method types are not available.',
  },
  {
    name: 'save_default_payment_method',
    type: 'enum',
    description:
      'Configure whether Zoneless updates <code>subscription.default_payment_method</code> when payment succeeds. Defaults to <code>off</code>.',
    enumValues: [
      {
        value: 'off',
        description:
          'Zoneless never sets <code>subscription.default_payment_method</code>.',
      },
      {
        value: 'on_subscription',
        description:
          'Zoneless sets <code>subscription.default_payment_method</code> when a subscription payment succeeds.',
      },
    ],
  },
];

const CANCELLATION_FEEDBACK_ENUM: Attribute['enumValues'] = [
  {
    value: 'customer_service',
    description: 'Customer service was less than expected.',
  },
  { value: 'low_quality', description: 'Quality was less than expected.' },
  { value: 'missing_features', description: 'Some features are missing.' },
  { value: 'other', description: 'Other reason.' },
  {
    value: 'switched_service',
    description: 'Switching to a different service.',
  },
  { value: 'too_complex', description: 'Ease of use was less than expected.' },
  { value: 'too_expensive', description: "It's too expensive." },
  { value: 'unused', description: "Doesn't use the service enough." },
];

const BILLING_SCHEDULE_DURATION_CHILDREN: Attribute[] = [
  {
    name: 'interval',
    type: 'enum',
    description:
      'Specifies billing duration. One of <code>hour</code>, <code>day</code>, <code>week</code>, <code>month</code>, or <code>year</code>.',
    enumValues: RECURRING_INTERVAL_ENUM,
    enumNote: HOUR_INTERVAL_NOTE,
  },
  {
    name: 'interval_count',
    type: 'integer',
    description: 'The multiplier applied to the interval.',
  },
];

const BILLING_SCHEDULE_CHILDREN = (billUntilRequired: boolean): Attribute[] => [
  {
    name: 'bill_until',
    type: 'object',
    required: billUntilRequired || undefined,
    description: 'Specifies when this billing schedule ends.',
    expandable: true,
    children: [
      {
        name: 'type',
        type: 'enum',
        required: true,
        description: 'How the end date is determined.',
        enumValues: [
          { value: 'duration', description: 'End after a relative duration.' },
          {
            value: 'timestamp',
            description: 'End at an absolute Unix timestamp.',
          },
        ],
      },
      {
        name: 'duration',
        type: 'object',
        description:
          'Required when <code>type</code> is <code>duration</code>.',
        expandable: true,
        children: BILLING_SCHEDULE_DURATION_CHILDREN,
      },
      {
        name: 'timestamp',
        type: 'timestamp',
        description:
          'Required when <code>type</code> is <code>timestamp</code>.',
      },
    ],
  },
  {
    name: 'applies_to',
    type: 'array of objects',
    description:
      'Which subscription items this schedule applies to. When omitted, applies to all items.',
    expandable: true,
    children: [
      {
        name: 'type',
        type: 'enum',
        required: true,
        description:
          'Controls which subscription items the billing schedule applies to.',
        enumValues: [{ value: 'price' }],
      },
      {
        name: 'price',
        type: 'string',
        description:
          'The price ID of the subscription item this schedule applies to.',
      },
    ],
  },
  {
    name: 'key',
    type: 'string',
    description:
      'Unique identifier for the billing schedule. Up to 200 characters.',
  },
];

const INVOICE_SETTINGS_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'account_tax_ids',
    type: 'array of strings',
    description:
      'The account tax IDs associated with the subscription. Set on invoices generated by the subscription.',
  },
  {
    name: 'custom_fields',
    type: 'array of objects',
    description:
      'A list of up to 4 custom fields to be displayed on the invoice.',
    expandable: true,
    children: [
      {
        name: 'name',
        type: 'string',
        required: true,
        description: 'The name of the custom field.',
      },
      {
        name: 'value',
        type: 'string',
        required: true,
        description: 'The value of the custom field.',
      },
    ],
  },
  {
    name: 'description',
    type: 'string',
    description:
      'An arbitrary string attached to invoices created by this subscription.',
  },
  {
    name: 'footer',
    type: 'string',
    description: 'Footer to be displayed on the invoice.',
  },
  {
    name: 'issuer',
    type: 'object',
    description: 'The connected account that issues the invoice.',
    expandable: true,
    children: [
      {
        name: 'type',
        type: 'enum',
        required: true,
        description: 'Type of the account referenced.',
        enumValues: [{ value: 'account' }, { value: 'self' }],
      },
      {
        name: 'account',
        type: 'string',
        description:
          'The connected account being referenced when <code>type</code> is <code>account</code>.',
      },
    ],
  },
];

const TRANSFER_DATA_CHILDREN: Attribute[] = [
  {
    name: 'destination',
    type: 'string',
    required: true,
    description:
      'The account where funds from the payment are transferred upon payment success.',
  },
  {
    name: 'amount_percent',
    type: 'float',
    description:
      'A non-negative decimal between 0 and 100, with at most two decimal places. By default, the entire amount is transferred to the destination.',
  },
];

const TRIAL_SETTINGS_CHILDREN: Attribute[] = [
  {
    name: 'end_behavior',
    type: 'object',
    required: true,
    description:
      "Defines how the subscription should behave when the user's trial ends.",
    expandable: true,
    children: [
      {
        name: 'missing_payment_method',
        type: 'enum',
        required: true,
        description:
          "Indicates how the subscription should change when the trial ends if the user didn't provide a payment method.",
        enumValues: [
          {
            value: 'cancel',
            description:
              "Cancel the subscription if a payment method isn't attached when the trial ends.",
          },
          {
            value: 'create_invoice',
            description:
              "Create an invoice when the trial ends, even if the user didn't set up a payment method.",
          },
          {
            value: 'pause',
            description:
              "Pause the subscription if a payment method isn't attached when the trial ends.",
          },
        ],
      },
    ],
  },
];

const AUTOMATIC_TAX_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'enabled',
    type: 'boolean',
    required: true,
    description:
      'Whether Zoneless automatically computes tax on this subscription.',
  },
  {
    name: 'liability',
    type: 'object',
    description: "The account that's liable for tax.",
    expandable: true,
    children: [
      {
        name: 'type',
        type: 'enum',
        required: true,
        description: 'Type of the account referenced.',
        enumValues: [{ value: 'account' }, { value: 'self' }],
      },
      {
        name: 'account',
        type: 'string',
        description:
          'The connected account being referenced when <code>type</code> is <code>account</code>.',
      },
    ],
  },
];

const SUBSCRIPTION_ITEM_OBJECT_CHILDREN: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless subscription item IDs are prefixed with <code>si_z_</code>.',
  },
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value.",
  },
  {
    name: 'billed_until',
    type: 'timestamp',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'The time period the subscription item has been billed for.',
  },
  {
    name: 'billing_thresholds',
    type: 'object',
    nullable: true,
    description:
      'Define thresholds at which an invoice is sent, and the related subscription advanced to a new billing period.',
    expandable: true,
    children: [
      {
        name: 'usage_gte',
        type: 'number',
        nullable: true,
        description:
          'Usage threshold that triggers the subscription to create an invoice.',
      },
    ],
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Time at which the object was created. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'current_period_end',
    type: 'timestamp',
    description:
      "The end time of this subscription item's current billing period.",
  },
  {
    name: 'current_period_start',
    type: 'timestamp',
    description:
      "The start time of this subscription item's current billing period.",
  },
  {
    name: 'discounts',
    type: 'array of strings',
    tooltip: EXPAND_TOOLTIP,
    description:
      'The discounts applied to the subscription item. Subscription item discounts are applied before subscription discounts.',
  },
  {
    name: 'metadata',
    type: 'object',
    description: 'Set of key-value pairs that you can attach to an object.',
  },
  {
    name: 'price',
    type: 'string',
    tooltip: PRICE_EXPAND_TOOLTIP,
    description:
      'The price the customer is subscribed to. See the <a href="/prices">Prices API</a> for the full object shape.',
  },
  {
    name: 'quantity',
    type: 'number',
    nullable: true,
    description:
      'The quantity of the plan to which the customer should be subscribed.',
  },
  {
    name: 'subscription',
    type: 'string',
    description: 'The subscription this subscription item belongs to.',
  },
  {
    name: 'tax_rates',
    type: 'array of objects',
    nullable: true,
    description:
      "The tax rates that apply to this subscription item. When set, the subscription's <code>default_tax_rates</code> don't apply to this item.",
    expandable: true,
    children: SIMPLIFIED_TAX_RATE_CHILDREN,
  },
  {
    name: 'platform_account',
    type: 'string',
    description: 'The platform account that owns this resource.',
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It enables multi-tenant operation.",
  },
];

// ============================================
// Shared Data
// ============================================

export const SUBSCRIPTION_OBJECT_JSON = `{
  "id": "sub_z_1QvK9mR2eZvKYlo2CxH4pN8w",
  "object": "subscription",
  "application": null,
  "application_fee_percent": null,
  "automatic_tax": {
    "enabled": false,
    "disabled_reason": null,
    "liability": null
  },
  "billing_cycle_anchor": 1784745600,
  "billing_cycle_anchor_config": null,
  "billing_mode": {
    "type": "flexible",
    "flexible": {
      "proration_discounts": "included"
    },
    "updated_at": 1784745600
  },
  "billing_schedules": [],
  "billing_thresholds": null,
  "cancel_at": null,
  "cancel_at_period_end": false,
  "canceled_at": null,
  "cancellation_details": {
    "comment": null,
    "feedback": null,
    "reason": null
  },
  "collection_method": "charge_automatically",
  "created": 1784745600,
  "currency": "usdc",
  "customer": "cus_z_MayaChen91kL2",
  "customer_account": null,
  "days_until_due": null,
  "default_payment_method": "pm_z_cryptoWallet7Hx",
  "default_source": null,
  "default_tax_rates": [],
  "description": "Pro membership",
  "discounts": [],
  "ended_at": null,
  "invoice_settings": {
    "account_tax_ids": null,
    "custom_fields": null,
    "description": null,
    "footer": null,
    "issuer": {
      "type": "self",
      "account": null
    }
  },
  "items": {
    "object": "list",
    "data": [
      {
        "id": "si_z_9Km2pQxR4vL8nHw",
        "object": "subscription_item",
        "billed_until": null,
        "billing_thresholds": null,
        "created": 1784745601,
        "current_period_end": 1787424000,
        "current_period_start": 1784745600,
        "discounts": [],
        "metadata": {},
        "price": "price_z_ProMonthly25",
        "quantity": 1,
        "subscription": "sub_z_1QvK9mR2eZvKYlo2CxH4pN8w",
        "tax_rates": [],
        "platform_account": "acct_z_Platform123abc"
      }
    ],
    "has_more": false,
    "url": "/v1/subscription_items?subscription=sub_z_1QvK9mR2eZvKYlo2CxH4pN8w"
  },
  "latest_invoice": "in_z_1QvK9nT3eZvKYlo2C8mR2qPx",
  "livemode": false,
  "managed_payments": null,
  "metadata": {},
  "next_pending_invoice_item_invoice": null,
  "on_behalf_of": null,
  "pause_collection": null,
  "payment_settings": {
    "payment_method_options": {
      "crypto": {
        "setup_future_usage": "none"
      }
    },
    "payment_method_types": ["crypto"],
    "save_default_payment_method": "off"
  },
  "pending_invoice_item_interval": null,
  "pending_setup_intent": null,
  "pending_update": null,
  "presentment_details": null,
  "schedule": null,
  "start_date": 1784745600,
  "status": "active",
  "test_clock": null,
  "transfer_data": null,
  "trial_end": null,
  "trial_settings": {
    "end_behavior": {
      "missing_payment_method": "create_invoice"
    }
  },
  "trial_start": null,
  "platform_account": "acct_z_Platform123abc",
  "subscription_delegation_pda": "7xK9Nv3F...abc123",
  "billing_lock_until": null
}`;

const SUBSCRIPTION_UPDATE_RESPONSE_JSON = SUBSCRIPTION_OBJECT_JSON.replace(
  `"managed_payments": null,
  "metadata": {},
  "next_pending_invoice_item_invoice": null`,
  `"managed_payments": null,
  "metadata": {
    "order_id": "8421"
  },
  "next_pending_invoice_item_invoice": null`
);

const SUBSCRIPTION_CANCELED_RESPONSE_JSON = SUBSCRIPTION_OBJECT_JSON.replace(
  '"canceled_at": null',
  '"canceled_at": 1784832000'
)
  .replace(
    `"cancellation_details": {
    "comment": null,
    "feedback": null,
    "reason": null
  }`,
    `"cancellation_details": {
    "comment": null,
    "feedback": null,
    "reason": "cancellation_requested"
  }`
  )
  .replace('"ended_at": null', '"ended_at": 1784832000')
  .replace('"status": "active"', '"status": "canceled"');

const SUBSCRIPTION_LIST_RESPONSE_JSON =
  '{\n  "object": "list",\n  "url": "/v1/subscriptions",\n  "has_more": false,\n  "data": [\n' +
  SUBSCRIPTION_OBJECT_JSON.split('\n')
    .map((line) => (line.length ? '    ' + line : line))
    .join('\n') +
  '\n  ]\n}';

const SUBSCRIPTION_RESUME_RESPONSE_JSON = SUBSCRIPTION_OBJECT_JSON;

// ============================================
// Subscription Object Attributes
// ============================================

export const SUBSCRIPTION_OBJECT_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless subscription IDs are prefixed with <code>sub_z_</code>.',
  },
  {
    name: 'customer',
    type: 'string',
    tooltip: EXPAND_TOOLTIP,
    description: 'ID of the customer who owns the subscription.',
  },
  {
    name: 'status',
    type: 'enum',
    description:
      "For <code>collection_method=charge_automatically</code>, a subscription moves into <code>incomplete</code> if the initial USDC wallet payment fails. Once the first invoice is paid, the subscription becomes <code>active</code>. If the first invoice isn't paid within 23 hours, the subscription transitions to <code>incomplete_expired</code>. A subscription in a trial period is <code>trialing</code> and moves to <code>active</code> when the trial ends. A subscription can only enter <code>paused</code> when a trial ends without a payment method. If collection is automatic, the subscription becomes <code>past_due</code> when payment is required but the customer's wallet payment can't be completed; after retries are exhausted it becomes <code>canceled</code> or <code>unpaid</code> depending on your settings.",
    enumValues: [
      {
        value: 'incomplete',
        description: "Initial payment hasn't succeeded yet.",
      },
      {
        value: 'incomplete_expired',
        description:
          "Initial invoice wasn't paid within 23 hours. Terminal status.",
      },
      { value: 'trialing', description: 'Currently in a trial period.' },
      {
        value: 'active',
        description: 'In good standing and generating invoices.',
      },
      {
        value: 'past_due',
        description: "Payment is required but hasn't succeeded yet.",
      },
      {
        value: 'canceled',
        description: 'Canceled and no longer generating invoices.',
      },
      {
        value: 'unpaid',
        description: 'Payment retries exhausted; invoices may remain open.',
      },
      {
        value: 'paused',
        description:
          'Trial ended without a payment method; no invoices are generated until resumed.',
      },
    ],
  },
  {
    name: 'items',
    type: 'object',
    description: 'List of subscription items, each with an attached price.',
    expandable: true,
    children: [
      {
        name: 'object',
        type: 'string',
        description:
          "String representing the object's type. Always has the value <code>list</code>.",
      },
      {
        name: 'data',
        type: 'array of objects',
        description: 'Details about each subscription item.',
        expandable: true,
        children: SUBSCRIPTION_ITEM_OBJECT_CHILDREN,
      },
      {
        name: 'has_more',
        type: 'boolean',
        description:
          'True if this list has another page of items after this one that can be fetched.',
      },
      {
        name: 'url',
        type: 'string',
        description: 'The URL where this list can be accessed.',
      },
    ],
  },
  {
    name: 'latest_invoice',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The most recent invoice this subscription has generated over its lifecycle (for example, when it cycles or is updated).',
  },
  {
    name: 'currency',
    type: 'enum',
    description:
      'Three-letter ISO currency code, in lowercase. Always <code>usdc</code> for Zoneless.',
    enumValues: [{ value: 'usdc' }],
    enumNote:
      '<strong>Difference from Stripe:</strong> Uses <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
  },
  {
    name: 'collection_method',
    type: 'enum',
    description:
      "Either <code>charge_automatically</code> or <code>send_invoice</code>. When charging automatically, Zoneless attempts to pay this subscription at the end of the cycle using the customer's default payment method (typically a crypto wallet). When sending an invoice, Zoneless emails your customer an invoice with payment instructions and marks the subscription as active.",
    enumValues: [{ value: 'charge_automatically' }, { value: 'send_invoice' }],
  },
  {
    name: 'cancel_at_period_end',
    type: 'boolean',
    description:
      'Whether this subscription will (if <code>status=active</code>) or did (if <code>status=canceled</code>) cancel at the end of the current billing period.',
  },
  {
    name: 'billing_cycle_anchor',
    type: 'timestamp',
    description:
      'The reference point that aligns future billing cycle dates. It sets the day of week for week intervals, the day of month for month and year intervals, and the month of year for year intervals. The timestamp is in UTC format.',
  },
  {
    name: 'default_payment_method',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the default payment method for the subscription. It must belong to the customer associated with the subscription. This takes precedence over <code>default_source</code>.',
  },
  {
    name: 'trial_end',
    type: 'timestamp',
    nullable: true,
    description: 'If the subscription has a trial, the end of that trial.',
  },
  {
    name: 'trial_start',
    type: 'timestamp',
    nullable: true,
    description:
      'If the subscription has a trial, the beginning of that trial.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'description',
    type: 'string',
    nullable: true,
    description:
      "The subscription's description, meant to be displayable to the customer. Maximum length is 500 characters.",
  },
];

export const SUBSCRIPTION_MORE_ATTRIBUTES: Attribute[] = [
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value.",
  },
  {
    name: 'application',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'ID of the Connect Application that created the subscription.',
  },
  {
    name: 'application_fee_percent',
    type: 'float',
    nullable: true,
    description:
      "A non-negative decimal between 0 and 100, with at most two decimal places. This represents the percentage of the subscription invoice total transferred to the application owner's account.",
  },
  {
    name: 'automatic_tax',
    type: 'object',
    description: 'Automatic tax settings for this subscription.',
    expandable: true,
    children: [
      {
        name: 'disabled_reason',
        type: 'enum',
        nullable: true,
        description:
          'If Zoneless disabled automatic tax, this enum describes why.',
        enumValues: [{ value: 'requires_location_inputs' }],
      },
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Whether Zoneless automatically computes tax on this subscription.',
      },
      {
        name: 'liability',
        type: 'object',
        nullable: true,
        description:
          "The account that's liable for tax. If set, the business address and tax registrations required to perform the tax calculation are loaded from this account.",
        expandable: true,
        children: [
          {
            name: 'account',
            type: 'string',
            nullable: true,
            tooltip: EXPAND_TOOLTIP,
            description:
              'The connected account being referenced when <code>type</code> is <code>account</code>.',
          },
          {
            name: 'type',
            type: 'enum',
            description: 'Type of the account referenced.',
            enumValues: [{ value: 'account' }, { value: 'self' }],
          },
        ],
      },
    ],
  },
  {
    name: 'billing_cycle_anchor_config',
    type: 'object',
    nullable: true,
    description:
      'The fixed values used to calculate the <code>billing_cycle_anchor</code>.',
    expandable: true,
    children: [
      {
        name: 'day_of_month',
        type: 'number',
        description:
          'The day of the month of the <code>billing_cycle_anchor</code>.',
      },
      {
        name: 'hour',
        type: 'number',
        nullable: true,
        description:
          'The hour of the day of the <code>billing_cycle_anchor</code>.',
      },
      {
        name: 'minute',
        type: 'number',
        nullable: true,
        description:
          'The minute of the hour of the <code>billing_cycle_anchor</code>.',
      },
      {
        name: 'month',
        type: 'number',
        nullable: true,
        description: 'The month to start full cycle billing periods.',
      },
      {
        name: 'second',
        type: 'number',
        nullable: true,
        description:
          'The second of the minute of the <code>billing_cycle_anchor</code>.',
      },
    ],
  },
  {
    name: 'billing_mode',
    type: 'object',
    description:
      'Controls how prorations and invoices for subscriptions are calculated and orchestrated.',
    expandable: true,
    children: [
      {
        name: 'flexible',
        type: 'object',
        nullable: true,
        description: 'Configure behavior for flexible billing mode.',
        expandable: true,
        children: [
          {
            name: 'proration_discounts',
            type: 'enum',
            description:
              'Controls how invoices and invoice items display proration amounts and discount amounts.',
            enumValues: [
              {
                value: 'included',
                description:
                  'Amounts are net of discounts, and discount amounts are zero.',
              },
              {
                value: 'itemized',
                description:
                  'Amounts are gross of discounts, and discount amounts are accurate.',
              },
            ],
          },
        ],
      },
      {
        name: 'type',
        type: 'enum',
        description:
          'Controls how prorations and invoices for subscriptions are calculated and orchestrated.',
        enumValues: [
          {
            value: 'classic',
            description:
              'Calculations for subscriptions and invoices are based on legacy defaults.',
          },
          {
            value: 'flexible',
            description:
              'Supports more flexible calculation and orchestration options for subscriptions and invoices.',
          },
        ],
      },
      {
        name: 'updated_at',
        type: 'timestamp',
        nullable: true,
        description:
          'Details on when the current <code>billing_mode</code> was adopted.',
      },
    ],
  },
  {
    name: 'billing_schedules',
    type: 'array of objects',
    description: 'Billing schedules for this subscription.',
    expandable: true,
    children: [
      {
        name: 'applies_to',
        type: 'array of objects',
        nullable: true,
        description:
          'Specifies which subscription items the billing schedule applies to.',
        expandable: true,
        children: [
          {
            name: 'price',
            type: 'string',
            nullable: true,
            tooltip: EXPAND_TOOLTIP,
            description:
              'The billing schedule applies to the subscription item with the given price ID.',
          },
          {
            name: 'type',
            type: 'enum',
            description:
              'Controls which subscription items the billing schedule applies to.',
            enumValues: [{ value: 'price' }],
          },
        ],
      },
      {
        name: 'bill_until',
        type: 'object',
        description: 'Specifies the end of the billing period.',
        expandable: true,
        children: [
          {
            name: 'computed_timestamp',
            type: 'timestamp',
            description: 'The timestamp the billing schedule will apply until.',
          },
          {
            name: 'duration',
            type: 'object',
            nullable: true,
            description: 'Specifies the billing period duration.',
            expandable: true,
            children: BILLING_SCHEDULE_DURATION_CHILDREN,
          },
          {
            name: 'timestamp',
            type: 'timestamp',
            nullable: true,
            description:
              'If specified, the billing schedule applies until this timestamp.',
          },
          {
            name: 'type',
            type: 'enum',
            description:
              'Describes how the billing schedule determines the end date.',
            enumValues: [{ value: 'duration' }, { value: 'timestamp' }],
          },
        ],
      },
      {
        name: 'key',
        type: 'string',
        description: 'Unique identifier for the billing schedule.',
      },
    ],
  },
  {
    name: 'billing_thresholds',
    type: 'object',
    nullable: true,
    description:
      'Define thresholds at which an invoice is sent, and the subscription advanced to a new billing period.',
    expandable: true,
    children: [
      {
        name: 'amount_gte',
        type: 'integer',
        nullable: true,
        description:
          'Monetary threshold that triggers the subscription to create an invoice.',
      },
      {
        name: 'reset_billing_cycle_anchor',
        type: 'boolean',
        nullable: true,
        description:
          'Indicates if the <code>billing_cycle_anchor</code> should be reset when a threshold is reached.',
      },
    ],
  },
  {
    name: 'cancel_at',
    type: 'timestamp',
    nullable: true,
    description:
      'A date in the future at which the subscription will automatically get canceled.',
  },
  {
    name: 'canceled_at',
    type: 'timestamp',
    nullable: true,
    description:
      'If the subscription has been canceled, the date of that cancellation. If the subscription was canceled with <code>cancel_at_period_end</code>, <code>canceled_at</code> reflects the time of the most recent update request, not the end of the subscription period.',
  },
  {
    name: 'cancellation_details',
    type: 'object',
    nullable: true,
    description: 'Details about why this subscription was cancelled.',
    expandable: true,
    children: [
      {
        name: 'comment',
        type: 'string',
        nullable: true,
        description:
          'Additional comments about why the user canceled the subscription, if the subscription was canceled explicitly by the user.',
      },
      {
        name: 'feedback',
        type: 'enum',
        nullable: true,
        description:
          'The customer submitted reason for why they canceled, if the subscription was canceled explicitly by the user.',
        enumValues: CANCELLATION_FEEDBACK_ENUM,
      },
      {
        name: 'reason',
        type: 'enum',
        nullable: true,
        description: 'Why this subscription was canceled.',
        enumValues: [
          {
            value: 'canceled_by_retention_policy',
            description:
              'Canceled because a retention policy automatically expires subscriptions with <code>livemode: false</code>.',
          },
          {
            value: 'cancellation_requested',
            description: 'Canceled explicitly through the API or Dashboard.',
          },
          {
            value: 'payment_disputed',
            description: 'Canceled automatically after a dispute was opened.',
          },
          {
            value: 'payment_failed',
            description: 'Canceled automatically after payment failure.',
          },
        ],
      },
    ],
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Time at which the object was created. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'customer_account',
    type: 'string',
    nullable: true,
    description:
      'ID of the account representing the customer who owns the subscription.',
  },
  {
    name: 'days_until_due',
    type: 'number',
    nullable: true,
    description:
      'Number of days a customer has to pay invoices generated by this subscription. This value is <code>null</code> for subscriptions where <code>collection_method=charge_automatically</code>.',
  },
  {
    name: 'default_source',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the default payment source for the subscription. It must belong to the customer associated with the subscription and be in a chargeable state. If <code>default_payment_method</code> is also set, it takes precedence.',
  },
  {
    name: 'default_tax_rates',
    type: 'array of objects',
    nullable: true,
    description:
      "The tax rates that apply to any subscription item that doesn't have <code>tax_rates</code> set.",
    expandable: true,
    children: SIMPLIFIED_TAX_RATE_CHILDREN,
  },
  {
    name: 'discounts',
    type: 'array of strings',
    tooltip: EXPAND_TOOLTIP,
    description:
      'The discounts applied to the subscription. Subscription item discounts are applied before subscription discounts.',
  },
  {
    name: 'ended_at',
    type: 'timestamp',
    nullable: true,
    description:
      'If the subscription has ended, the date the subscription ended.',
  },
  {
    name: 'invoice_settings',
    type: 'object',
    description: 'All invoices are billed using the specified settings.',
    expandable: true,
    children: [
      {
        name: 'account_tax_ids',
        type: 'array of strings',
        nullable: true,
        tooltip: EXPAND_TOOLTIP,
        description:
          'The account tax IDs associated with the subscription. Set on invoices generated by the subscription.',
      },
      {
        name: 'custom_fields',
        type: 'array of objects',
        nullable: true,
        description:
          'A list of up to 4 custom fields to be displayed on the invoice.',
        expandable: true,
        children: [
          {
            name: 'name',
            type: 'string',
            description: 'The name of the custom field.',
          },
          {
            name: 'value',
            type: 'string',
            description: 'The value of the custom field.',
          },
        ],
      },
      {
        name: 'description',
        type: 'string',
        nullable: true,
        description:
          'An arbitrary string attached to the object. Often useful for displaying to users.',
      },
      {
        name: 'footer',
        type: 'string',
        nullable: true,
        description: 'Footer to be displayed on the invoice.',
      },
      {
        name: 'issuer',
        type: 'object',
        description:
          'The connected account that issues the invoice. The invoice is presented with the branding and support information of the specified account.',
        expandable: true,
        children: [
          {
            name: 'account',
            type: 'string',
            nullable: true,
            tooltip: EXPAND_TOOLTIP,
            description:
              'The connected account being referenced when <code>type</code> is <code>account</code>.',
          },
          {
            name: 'type',
            type: 'enum',
            description: 'Type of the account referenced.',
            enumValues: [{ value: 'account' }, { value: 'self' }],
          },
        ],
      },
    ],
  },
  {
    name: 'livemode',
    type: 'boolean',
    description:
      'If the object exists in live mode, the value is <code>true</code>. If the object exists in test mode, the value is <code>false</code>.',
  },
  {
    name: 'managed_payments',
    type: 'object',
    nullable: true,
    description:
      'Settings for Managed Payments for this subscription and resulting invoices and payment intents.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Whether Managed Payments is enabled for this subscription.',
      },
    ],
  },
  {
    name: 'next_pending_invoice_item_invoice',
    type: 'timestamp',
    nullable: true,
    description:
      'Specifies the approximate timestamp on which any pending invoice items are billed according to the schedule provided at <code>pending_invoice_item_interval</code>.',
  },
  {
    name: 'on_behalf_of',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The account (if any) the charge was made on behalf of for charges associated with this subscription.',
  },
  {
    name: 'pause_collection',
    type: 'object',
    nullable: true,
    description:
      "If specified, payment collection for this subscription is paused. The subscription status is unchanged and isn't updated to <code>paused</code>.",
    expandable: true,
    children: [
      {
        name: 'behavior',
        type: 'enum',
        description:
          'The payment collection behavior for this subscription while paused.',
        enumValues: [
          {
            value: 'keep_as_draft',
            description:
              'Keep all invoices as draft while collection is paused.',
          },
          {
            value: 'mark_uncollectible',
            description:
              'Mark all invoices as uncollectible while collection is paused.',
          },
          {
            value: 'void',
            description: 'Void all invoices while collection is paused.',
          },
        ],
      },
      {
        name: 'resumes_at',
        type: 'timestamp',
        nullable: true,
        description:
          'The time after which the subscription resumes collecting payments.',
      },
    ],
  },
  {
    name: 'payment_settings',
    type: 'object',
    nullable: true,
    description:
      'Payment settings passed on to invoices created by the subscription.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Stripe also exposes <code>payment_method_options</code> for dozens of region-specific fiat rails (ACH, iDEAL, Konbini, and so on). Zoneless only supports <code>crypto</code> since every payment settles in USDC.',
    expandable: true,
    children: PAYMENT_SETTINGS_CHILDREN,
  },
  {
    name: 'pending_invoice_item_interval',
    type: 'object',
    nullable: true,
    description:
      'Specifies an interval for how often to bill for any pending invoice items.',
    expandable: true,
    children: [
      {
        name: 'interval',
        type: 'enum',
        description:
          'Specifies invoicing frequency. One of <code>hour</code>, <code>day</code>, <code>week</code>, <code>month</code>, or <code>year</code>.',
        enumValues: RECURRING_INTERVAL_ENUM,
        enumNote: HOUR_INTERVAL_NOTE,
      },
      {
        name: 'interval_count',
        type: 'number',
        description:
          'The number of intervals between invoices. Maximum of one year interval allowed (1 year, 12 months, or 52 weeks).',
      },
    ],
  },
  {
    name: 'pending_setup_intent',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      "You can use this SetupIntent to collect user authentication when creating a subscription without immediate payment, or when updating a subscription's payment method.",
  },
  {
    name: 'pending_update',
    type: 'object',
    nullable: true,
    description:
      'If specified, pending updates that will be applied to the subscription once the <code>latest_invoice</code> has been paid.',
    expandable: true,
    children: [
      {
        name: 'billing_cycle_anchor',
        type: 'timestamp',
        nullable: true,
        description:
          'If the update is applied, determines the date of the first full invoice, and for plans with month or year intervals, the day of the month for subsequent invoices.',
      },
      {
        name: 'expires_at',
        type: 'timestamp',
        description:
          'The point after which the changes reflected by this update are discarded and no longer applied.',
      },
      {
        name: 'subscription_items',
        type: 'array of objects',
        nullable: true,
        description:
          'List of subscription items that will be set if the update is applied.',
      },
      {
        name: 'trial_end',
        type: 'timestamp',
        nullable: true,
        description:
          'Unix timestamp representing the end of the trial period the customer gets before being charged for the first time, if the update is applied.',
      },
      {
        name: 'trial_from_plan',
        type: 'boolean',
        nullable: true,
        description:
          "Indicates if a plan's trial period should be applied to the subscription.",
      },
    ],
  },
  {
    name: 'presentment_details',
    type: 'object',
    nullable: true,
    description:
      'A hash containing information about the currency presented to the customer.',
    expandable: true,
    children: [
      {
        name: 'presentment_currency',
        type: 'string',
        description: 'Currency used for customer payments.',
      },
    ],
  },
  {
    name: 'schedule',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'The schedule attached to the subscription.',
  },
  {
    name: 'start_date',
    type: 'timestamp',
    description:
      'Date when the subscription was first created. The date might differ from the <code>created</code> date due to backdating.',
  },
  {
    name: 'test_clock',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'ID of the test clock this subscription belongs to.',
  },
  {
    name: 'transfer_data',
    type: 'object',
    nullable: true,
    description:
      "The account (if any) the subscription's payments are attributed to for tax reporting, and where funds from each payment are transferred to for each of the subscription's invoices.",
    expandable: true,
    children: [
      {
        name: 'amount_percent',
        type: 'float',
        nullable: true,
        description:
          'A non-negative decimal between 0 and 100, with at most two decimal places. By default, the entire amount is transferred to the destination.',
      },
      {
        name: 'destination',
        type: 'string',
        tooltip: EXPAND_TOOLTIP,
        description:
          'The account where funds from the payment are transferred to upon payment success.',
      },
    ],
  },
  {
    name: 'trial_settings',
    type: 'object',
    nullable: true,
    description: 'Settings related to subscription trials.',
    expandable: true,
    children: TRIAL_SETTINGS_CHILDREN,
  },
  {
    name: 'platform_account',
    type: 'string',
    description:
      "The platform account that owns this resource. For connected account resources, this is the platform's account ID. For the platform's own resources, this equals the account field (self-referential).",
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It enables multi-tenant operation.",
  },
  {
    name: 'subscription_delegation_pda',
    type: 'string',
    nullable: true,
    description:
      'Solana subscriptions program delegation PDA for this subscription. Set when the customer completes hosted checkout subscribe.',
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API.",
  },
  {
    name: 'billing_lock_until',
    type: 'timestamp',
    nullable: true,
    description:
      'Unix timestamp until which this subscription is claimed by a billing runner. Used to prevent duplicate cycle invoices across multiple API instances.',
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API.",
  },
];

// ============================================
// Overview
// ============================================

export const SUBSCRIPTIONS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Subscription object',
  description:
    'Subscriptions allow you to charge a customer on a recurring basis in USDC.',
  stripeDocsUrl: 'https://docs.stripe.com/api/subscriptions',
  endpoints: BuildEndpointSummaries(SUBSCRIPTIONS_SUBSECTION, [
    { method: 'POST', path: '/v1/subscriptions', pageId: 'create' },
    { method: 'POST', path: '/v1/subscriptions/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/subscriptions/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/subscriptions', pageId: 'list' },
    { method: 'DELETE', path: '/v1/subscriptions/:id', pageId: 'cancel' },
    {
      method: 'POST',
      path: '/v1/subscriptions/:id/migrate',
      pageId: 'migrate',
    },
    { method: 'POST', path: '/v1/subscriptions/:id/resume', pageId: 'resume' },
  ]),
  events: GetResourceEventAttributes('subscription'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Processing renewals: ',
          text: 'Creating a subscription does not collect future cycle invoices on its own. Use the <a href="/billing">Billing Helpers</a> API (<code>runForPlatform</code>) on a schedule—or enable the in-process billing monitor—to invoice and collect due subscriptions in USDC.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: SUBSCRIPTION_OBJECT_ATTRIBUTES,
          moreAttributes: SUBSCRIPTION_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE SUBSCRIPTION OBJECT',
          code: SUBSCRIPTION_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create
// ============================================

const CREATE_SUBSCRIPTION_ITEM_CHILDREN: Attribute[] = [
  {
    name: 'price',
    type: 'string',
    required: true,
    requiredText: 'Required unless price_data is provided',
    description: 'The ID of the price object.',
  },
  {
    name: 'price_data',
    type: 'object',
    required: true,
    requiredText: 'Required unless price is provided',
    description:
      'Data used to generate a new Price object inline for this item.',
    expandable: true,
    children: PRICE_DATA_CHILDREN,
  },
  {
    name: 'quantity',
    type: 'integer',
    description: 'Quantity for this item.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to the subscription item.',
  },
  {
    name: 'tax_rates',
    type: 'array of strings',
    description:
      "A list of tax rate IDs that apply to this item. Overrides the subscription's <code>default_tax_rates</code>.",
  },
  {
    name: 'billing_thresholds',
    type: 'object',
    description: 'Define thresholds at which an invoice is sent for this item.',
    expandable: true,
    children: [
      {
        name: 'usage_gte',
        type: 'integer',
        description:
          'Usage threshold that triggers the subscription to create an invoice.',
      },
    ],
  },
  {
    name: 'discounts',
    type: 'array of objects',
    description:
      'The coupons, promotion codes, or existing discounts to apply to this item. Pass exactly one of <code>coupon</code>, <code>discount</code>, or <code>promotion_code</code> per entry.',
    expandable: true,
    children: DISCOUNT_PARAM_CHILDREN,
  },
];

const CREATE_SUBSCRIPTION_PARAMETERS: Attribute[] = [
  {
    name: 'items',
    type: 'array of objects',
    required: true,
    description:
      'A list of up to 20 subscription items, each with an attached price.',
    expandable: true,
    children: CREATE_SUBSCRIPTION_ITEM_CHILDREN,
  },
  {
    name: 'customer',
    type: 'string',
    required: true,
    requiredText: 'Required unless customer_account is provided',
    description: 'The ID of the customer to subscribe.',
  },
  {
    name: 'customer_account',
    type: 'string',
    required: true,
    requiredText: 'Required unless customer is provided',
    description:
      'The ID of the account representing the customer to subscribe.',
  },
  {
    name: 'collection_method',
    type: 'enum',
    description:
      'Either <code>charge_automatically</code>, or <code>send_invoice</code>. When charging automatically, Zoneless attempts to pay this subscription at the end of the cycle using the default payment method attached to the customer. When sending an invoice, Zoneless emails your customer an invoice with payment instructions and marks the subscription as active. Defaults to <code>charge_automatically</code>.',
    enumValues: [{ value: 'charge_automatically' }, { value: 'send_invoice' }],
  },
  {
    name: 'default_payment_method',
    type: 'string',
    description:
      'ID of the default payment method for the subscription. It must belong to the customer associated with the subscription. This takes precedence over <code>default_source</code>.',
  },
  {
    name: 'description',
    type: 'string',
    description:
      "The subscription's description, meant to be displayable to the customer. Maximum length is 500 characters.",
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'payment_behavior',
    type: 'enum',
    description:
      'Only applies when <code>collection_method</code> is <code>charge_automatically</code>. Controls how to handle the initial payment when creating the subscription.',
    enumValues: [
      {
        value: 'allow_incomplete',
        description:
          'Use <code>default_incomplete</code> behavior for SCA, otherwise create the subscription in <code>incomplete</code> status if the first payment fails.',
      },
      {
        value: 'default_incomplete',
        description:
          "Create the subscription in <code>incomplete</code> status if the first payment requires action or fails. Return the latest invoice's payment intent for confirmation.",
      },
      {
        value: 'error_if_incomplete',
        description:
          'Return an HTTP 402 error if the first payment fails. Useful for immediate feedback when the customer is present.',
      },
    ],
  },
  {
    name: 'proration_behavior',
    type: 'enum',
    description:
      'Determines how to handle prorations when billing_cycle_anchor is set or when the subscription start date is backdated.',
    enumValues: [
      {
        value: 'create_prorations',
        description: 'Create prorations when applicable. Default.',
      },
      { value: 'none', description: 'Disable creating prorations.' },
    ],
  },
  {
    name: 'trial_end',
    type: 'string | timestamp',
    description:
      'Unix timestamp representing the end of the trial period the customer will get before being charged for the first time. Can also be the string <code>now</code> to end the trial immediately. Mutually exclusive with <code>trial_from_plan=true</code>.',
  },
  {
    name: 'trial_period_days',
    type: 'integer',
    description:
      'Integer representing the number of trial period days before the customer is charged for the first time. Mutually exclusive with <code>trial_end</code>.',
  },
];

const CREATE_SUBSCRIPTION_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'add_invoice_items',
    type: 'array of objects',
    description:
      'A list of up to 20 prices and quantities that will generate invoice items appended to the next invoice for this subscription.',
    expandable: true,
    children: [
      {
        name: 'price',
        type: 'string',
        required: true,
        requiredText: 'Required unless price_data is provided',
        description: 'The ID of the price object.',
      },
      {
        name: 'price_data',
        type: 'object',
        required: true,
        requiredText: 'Required unless price is provided',
        description:
          'Data used to generate a one-off Price object inline. Unlike subscription item <code>price_data</code>, recurring is not used.',
        expandable: true,
        children: [
          {
            name: 'currency',
            type: 'string',
            required: true,
            description:
              'Three-letter currency code, in lowercase. For Zoneless, use <code>usdc</code>.',
            enumNote:
              '<strong>Difference from Stripe:</strong> Use <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
          },
          {
            name: 'product',
            type: 'string',
            required: true,
            description: 'The ID of the product this price is associated with.',
          },
          {
            name: 'unit_amount',
            type: 'integer',
            description:
              'A non-zero integer in cents representing how much to charge. May be negative to credit the customer.',
          },
          {
            name: 'unit_amount_decimal',
            type: 'string',
            description:
              'Same as <code>unit_amount</code>, but accepts a decimal string with at most 12 decimal places.',
          },
          {
            name: 'tax_behavior',
            type: 'enum',
            description:
              'Specifies whether the price is considered inclusive of taxes or exclusive of taxes.',
            enumValues: [
              { value: 'exclusive' },
              { value: 'inclusive' },
              { value: 'unspecified' },
            ],
          },
        ],
      },
      {
        name: 'quantity',
        type: 'integer',
        description: 'Quantity for this item.',
      },
      {
        name: 'tax_rates',
        type: 'array of strings',
        description: 'The tax rates that apply to this invoice item.',
      },
      {
        name: 'discounts',
        type: 'array of objects',
        description:
          'The coupons, promotion codes, or existing discounts to apply. Pass exactly one of <code>coupon</code>, <code>discount</code>, or <code>promotion_code</code> per entry.',
        expandable: true,
        children: DISCOUNT_PARAM_CHILDREN,
      },
    ],
  },
  {
    name: 'application_fee_percent',
    type: 'float',
    description:
      "A non-negative decimal between 0 and 100, with at most two decimal places. This represents the percentage of the subscription invoice total that will be transferred to the application owner's account.",
  },
  {
    name: 'automatic_tax',
    type: 'object',
    description: 'Automatic tax settings for this subscription.',
    expandable: true,
    children: AUTOMATIC_TAX_PARAM_CHILDREN,
  },
  {
    name: 'backdate_start_date',
    type: 'timestamp',
    description:
      "A past timestamp to backdate the subscription's start date to. If set, the first invoice reflects a prorated amount between the backdate and now. Can be combined with a trial period.",
  },
  {
    name: 'billing_cycle_anchor',
    type: 'timestamp',
    description:
      "A future timestamp to anchor the subscription's billing cycle. Mutually exclusive with <code>billing_cycle_anchor_config</code>.",
  },
  {
    name: 'billing_cycle_anchor_config',
    type: 'object',
    description:
      'Mutually exclusive with <code>billing_cycle_anchor</code>. Only valid with monthly and yearly price intervals. When provided, the billing cycle anchor is set to the next occurrence of the day of month at the hour, minute, and second UTC.',
    expandable: true,
    children: [
      {
        name: 'day_of_month',
        type: 'integer',
        required: true,
        description:
          'The day of the month of the <code>billing_cycle_anchor</code> (1–31).',
      },
      {
        name: 'hour',
        type: 'integer',
        description:
          'The hour of the day of the <code>billing_cycle_anchor</code> (0–23).',
      },
      {
        name: 'minute',
        type: 'integer',
        description:
          'The minute of the hour of the <code>billing_cycle_anchor</code> (0–59).',
      },
      {
        name: 'month',
        type: 'integer',
        description: 'The month to start full cycle billing periods (1–12).',
      },
      {
        name: 'second',
        type: 'integer',
        description:
          'The second of the minute of the <code>billing_cycle_anchor</code> (0–59).',
      },
    ],
  },
  {
    name: 'billing_mode',
    type: 'object',
    description:
      'Controls how prorations and invoices for subscriptions are calculated and orchestrated.',
    expandable: true,
    children: [
      {
        name: 'type',
        type: 'enum',
        required: true,
        description:
          'Controls how prorations and invoices for subscriptions are calculated and orchestrated.',
        enumValues: [{ value: 'classic' }, { value: 'flexible' }],
      },
      {
        name: 'flexible',
        type: 'object',
        description: 'Configure behavior for flexible billing mode.',
        expandable: true,
        children: [
          {
            name: 'proration_discounts',
            type: 'enum',
            description:
              'Controls how invoices and invoice items display proration amounts and discount amounts.',
            enumValues: [{ value: 'included' }, { value: 'itemized' }],
          },
        ],
      },
    ],
  },
  {
    name: 'billing_schedules',
    type: 'array of objects',
    description:
      'Sets the billing schedules for the subscription. On create, each schedule requires <code>bill_until</code>.',
    expandable: true,
    children: BILLING_SCHEDULE_CHILDREN(true),
  },
  {
    name: 'billing_thresholds',
    type: 'object',
    description:
      'Define thresholds at which an invoice is sent, and the subscription advanced to a new billing period.',
    expandable: true,
    children: [
      {
        name: 'amount_gte',
        type: 'integer',
        description:
          'Monetary threshold that triggers the subscription to create an invoice.',
      },
      {
        name: 'reset_billing_cycle_anchor',
        type: 'boolean',
        description:
          'Indicates if the <code>billing_cycle_anchor</code> should be reset when a threshold is reached.',
      },
    ],
  },
  {
    name: 'cancel_at',
    type: 'timestamp | enum',
    description:
      'A timestamp at which the subscription should cancel, or a special value.',
    enumValues: [
      { value: 'max_billed_until' },
      { value: 'max_period_end' },
      { value: 'min_period_end' },
    ],
  },
  {
    name: 'cancel_at_period_end',
    type: 'boolean',
    description:
      'Boolean indicating whether this subscription should cancel at the end of the current period.',
  },
  {
    name: 'currency',
    type: 'string',
    description:
      'Three-letter ISO currency code, in lowercase. For Zoneless, use <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Use <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
  },
  {
    name: 'days_until_due',
    type: 'integer',
    description:
      'Number of days a customer has to pay invoices generated by this subscription. Only valid for subscriptions where <code>collection_method=send_invoice</code>.',
  },
  {
    name: 'default_source',
    type: 'string',
    description:
      'ID of the default payment source for the subscription. It must belong to the customer associated with the subscription and be in a chargeable state.',
  },
  {
    name: 'default_tax_rates',
    type: 'array of strings',
    description:
      'The tax rates that will apply to any subscription item that does not have <code>tax_rates</code> set.',
  },
  {
    name: 'discounts',
    type: 'array of objects',
    description:
      'The coupons, promotion codes, or existing discounts to apply to this subscription. Pass exactly one of <code>coupon</code>, <code>discount</code>, or <code>promotion_code</code> per entry.',
    expandable: true,
    children: DISCOUNT_PARAM_CHILDREN,
  },
  {
    name: 'invoice_settings',
    type: 'object',
    description: 'All invoices will be billed using the specified settings.',
    expandable: true,
    children: INVOICE_SETTINGS_PARAM_CHILDREN,
  },
  {
    name: 'off_session',
    type: 'boolean',
    description:
      'Indicates if a customer is on or off-session while an invoice payment is attempted.',
  },
  {
    name: 'on_behalf_of',
    type: 'string',
    description:
      "The account on behalf of which to charge, for each of the subscription's invoices.",
  },
  {
    name: 'payment_settings',
    type: 'object',
    description:
      'Payment settings to pass to invoices created by the subscription.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless only accepts USDC wallet payments, so only the <code>crypto</code> payment method options bag is exposed.',
    expandable: true,
    children: PAYMENT_SETTINGS_CHILDREN,
  },
  {
    name: 'pending_invoice_item_interval',
    type: 'object',
    description:
      'Specifies an interval for how often to bill for any pending invoice items.',
    expandable: true,
    children: [
      {
        name: 'interval',
        type: 'enum',
        required: true,
        description: 'Specifies invoicing frequency.',
        enumValues: RECURRING_INTERVAL_ENUM,
        enumNote: HOUR_INTERVAL_NOTE,
      },
      {
        name: 'interval_count',
        type: 'integer',
        description: 'The number of intervals between invoices.',
      },
    ],
  },
  {
    name: 'transfer_data',
    type: 'object',
    description:
      "If specified, the funds from the subscription's invoices will be transferred to the destination account.",
    expandable: true,
    children: TRANSFER_DATA_CHILDREN,
  },
  {
    name: 'trial_from_plan',
    type: 'boolean',
    description:
      "Indicates if a plan's <code>trial_period_days</code> should be applied to the subscription. Setting <code>trial_end</code> per subscription is preferred, and this defaults to <code>false</code>. Setting this flag to <code>true</code> together with <code>trial_end</code> is not allowed.",
  },
  {
    name: 'trial_settings',
    type: 'object',
    description: 'Settings related to subscription trials.',
    expandable: true,
    children: TRIAL_SETTINGS_CHILDREN,
  },
];

export const SUBSCRIPTIONS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a subscription',
  description:
    'Creates a new subscription on an existing customer. Each customer can have up to 500 active or scheduled subscriptions. When you create a subscription with collection_method=charge_automatically, the first invoice is finalized as part of the request. The payment_behavior parameter controls what happens if that initial payment fails.',
  stripeDocsUrl: 'https://docs.stripe.com/api/subscriptions/create',
  endpoints: [{ method: 'POST', path: '/v1/subscriptions' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_SUBSCRIPTION_PARAMETERS,
          moreAttributes: CREATE_SUBSCRIPTION_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the newly created <code>Subscription</code> object, which may be in an <code>incomplete</code> status if the initial payment fails and <code>payment_behavior</code> allows incomplete subscriptions.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/subscriptions' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/subscriptions \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d customer=cus_z_MayaChen91kL2 \\
  -d "items[0][price]=price_z_ProMonthly25"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const subscription = await zoneless.subscriptions.create({
  customer: 'cus_z_MayaChen91kL2',
  items: [{ price: 'price_z_ProMonthly25' }],
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: SUBSCRIPTION_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Update
// ============================================

const UPDATE_SUBSCRIPTION_ITEM_CHILDREN: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description: 'Subscription item to update.',
  },
  {
    name: 'deleted',
    type: 'boolean',
    description:
      'Delete the specified subscription item from the subscription.',
  },
  {
    name: 'clear_usage',
    type: 'boolean',
    description:
      "Delete all usage for a given subscription item. Allowed only when <code>deleted</code> is set to <code>true</code> and the plan's <code>usage_type</code> is metered.",
  },
  {
    name: 'price',
    type: 'string',
    description:
      'The ID of the price object. One of <code>price</code> or <code>price_data</code> is required when creating a new item.',
  },
  {
    name: 'price_data',
    type: 'object',
    description:
      'Data used to generate a new Price object inline for this item.',
    expandable: true,
    children: PRICE_DATA_CHILDREN,
  },
  {
    name: 'quantity',
    type: 'integer',
    description: 'Quantity for this item.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to the subscription item.',
  },
  {
    name: 'tax_rates',
    type: 'array of strings',
    description:
      "A list of tax rate IDs that apply to this item. Overrides the subscription's <code>default_tax_rates</code>.",
  },
  {
    name: 'billing_thresholds',
    type: 'object',
    description:
      'Define thresholds at which an invoice is sent for this item. Pass an empty string to remove previously-defined thresholds.',
    expandable: true,
    children: [
      {
        name: 'usage_gte',
        type: 'integer',
        description:
          'Usage threshold that triggers the subscription to create an invoice.',
      },
    ],
  },
  {
    name: 'discounts',
    type: 'array of objects',
    description:
      'The coupons, promotion codes, or existing discounts to apply to this item.',
    expandable: true,
    children: DISCOUNT_PARAM_CHILDREN,
  },
];

const UPDATE_SUBSCRIPTION_PARAMETERS: Attribute[] = [
  {
    name: 'items',
    type: 'array of objects',
    description:
      'A list of up to 20 subscription items, each with an attached price. Include an <code>id</code> to update an existing item, or omit it to create a new one. Set <code>deleted</code> to remove an item.',
    expandable: true,
    children: UPDATE_SUBSCRIPTION_ITEM_CHILDREN,
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'description',
    type: 'string',
    description:
      "The subscription's description, meant to be displayable to the customer. Maximum length is 500 characters.",
  },
  {
    name: 'cancel_at_period_end',
    type: 'boolean',
    description:
      'Boolean indicating whether this subscription should cancel at the end of the current period.',
  },
  {
    name: 'default_payment_method',
    type: 'string',
    description:
      'ID of the default payment method for the subscription. It must belong to the customer associated with the subscription.',
  },
  {
    name: 'collection_method',
    type: 'enum',
    description:
      'Either <code>charge_automatically</code>, or <code>send_invoice</code>.',
    enumValues: [{ value: 'charge_automatically' }, { value: 'send_invoice' }],
  },
  {
    name: 'billing_cycle_anchor',
    type: 'enum',
    description:
      "Either <code>now</code> or <code>unchanged</code>. Setting the value to <code>now</code> resets the subscription's billing cycle anchor to the current time (in UTC).",
    enumValues: [
      {
        value: 'now',
        description: 'Reset the billing cycle anchor to the current time.',
      },
      {
        value: 'unchanged',
        description: 'Keep the existing billing cycle anchor.',
      },
    ],
  },
  {
    name: 'proration_behavior',
    type: 'enum',
    description:
      'Determines how to handle prorations when the billing cycle changes or when items are updated. For example, upgrading from a 100 USDC plan to a 200 USDC plan mid-cycle creates a proration for the unused time on the old price and the remaining time on the new price.',
    enumValues: [
      {
        value: 'create_prorations',
        description: 'Create prorations when applicable. Default.',
      },
      { value: 'none', description: 'Disable creating prorations.' },
      {
        value: 'always_invoice',
        description: 'Create prorations and immediately invoice them.',
      },
    ],
  },
  {
    name: 'proration_date',
    type: 'timestamp',
    description:
      'If set, the proration will be calculated as though the subscription was updated at the given time. Useful for previewing prorations.',
  },
  {
    name: 'payment_behavior',
    type: 'enum',
    description:
      'Use <code>allow_incomplete</code> to create pending updates when the latest invoice payment fails, or <code>pending_if_incomplete</code> to keep the update pending until payment succeeds.',
    enumValues: [
      { value: 'allow_incomplete' },
      { value: 'default_incomplete' },
      { value: 'error_if_incomplete' },
      {
        value: 'pending_if_incomplete',
        description:
          'Keep the update pending until the latest invoice is paid. Exclusive to subscription updates.',
      },
    ],
  },
  {
    name: 'pause_collection',
    type: 'object',
    description:
      'If specified, payment collection for this subscription is paused. Pass an empty string to resume payment collection.',
    expandable: true,
    children: [
      {
        name: 'behavior',
        type: 'enum',
        required: true,
        description:
          'The payment collection behavior for this subscription while paused.',
        enumValues: [
          { value: 'keep_as_draft' },
          { value: 'mark_uncollectible' },
          { value: 'void' },
        ],
      },
      {
        name: 'resumes_at',
        type: 'timestamp',
        description:
          'The time after which the subscription resumes collecting payments.',
      },
    ],
  },
  {
    name: 'cancellation_details',
    type: 'object',
    description: 'Details about why this subscription was cancelled.',
    expandable: true,
    children: [
      {
        name: 'comment',
        type: 'string',
        description:
          'Additional comments about why the user canceled the subscription.',
      },
      {
        name: 'feedback',
        type: 'enum',
        description: 'The customer submitted reason for why they canceled.',
        enumValues: CANCELLATION_FEEDBACK_ENUM,
      },
    ],
  },
];

const UPDATE_SUBSCRIPTION_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'add_invoice_items',
    type: 'array of objects',
    description:
      'A list of up to 20 prices and quantities that will generate invoice items appended to the next invoice for this subscription.',
    expandable: true,
    children: [
      {
        name: 'price',
        type: 'string',
        required: true,
        requiredText: 'Required unless price_data is provided',
        description: 'The ID of the price object.',
      },
      {
        name: 'price_data',
        type: 'object',
        required: true,
        requiredText: 'Required unless price is provided',
        description: 'Data used to generate a one-off Price object inline.',
        expandable: true,
        children: [
          {
            name: 'currency',
            type: 'string',
            required: true,
            description:
              'Three-letter currency code, in lowercase. For Zoneless, use <code>usdc</code>.',
            enumNote:
              '<strong>Difference from Stripe:</strong> Use <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
          },
          {
            name: 'product',
            type: 'string',
            required: true,
            description: 'The ID of the product this price is associated with.',
          },
          {
            name: 'unit_amount',
            type: 'integer',
            description:
              'A non-zero integer in cents representing how much to charge. May be negative to credit the customer.',
          },
          {
            name: 'unit_amount_decimal',
            type: 'string',
            description:
              'Same as <code>unit_amount</code>, but accepts a decimal string with at most 12 decimal places.',
          },
        ],
      },
      {
        name: 'quantity',
        type: 'integer',
        description: 'Quantity for this item.',
      },
    ],
  },
  {
    name: 'application_fee_percent',
    type: 'float',
    description:
      'A non-negative decimal between 0 and 100, with at most two decimal places.',
  },
  {
    name: 'automatic_tax',
    type: 'object',
    description: 'Automatic tax settings for this subscription.',
    expandable: true,
    children: AUTOMATIC_TAX_PARAM_CHILDREN,
  },
  {
    name: 'billing_schedules',
    type: 'array of objects',
    description:
      'Sets the billing schedules for the subscription. On update, <code>bill_until</code> is optional.',
    expandable: true,
    children: BILLING_SCHEDULE_CHILDREN(false),
  },
  {
    name: 'billing_thresholds',
    type: 'object',
    description:
      'Define thresholds at which an invoice is sent. Pass an empty string to remove previously-defined thresholds.',
    expandable: true,
    children: [
      {
        name: 'amount_gte',
        type: 'integer',
        description:
          'Monetary threshold that triggers the subscription to create an invoice.',
      },
      {
        name: 'reset_billing_cycle_anchor',
        type: 'boolean',
        description:
          'Indicates if the <code>billing_cycle_anchor</code> should be reset when a threshold is reached.',
      },
    ],
  },
  {
    name: 'cancel_at',
    type: 'timestamp | enum',
    description:
      'A timestamp at which the subscription should cancel, or a special value.',
    enumValues: [
      { value: 'max_billed_until' },
      { value: 'max_period_end' },
      { value: 'min_period_end' },
    ],
  },
  {
    name: 'days_until_due',
    type: 'integer',
    description:
      'Number of days a customer has to pay invoices generated by this subscription. Only valid for subscriptions where <code>collection_method=send_invoice</code>.',
  },
  {
    name: 'default_source',
    type: 'string',
    description: 'ID of the default payment source for the subscription.',
  },
  {
    name: 'default_tax_rates',
    type: 'array of strings',
    description:
      'The tax rates that will apply to any subscription item that does not have <code>tax_rates</code> set. Pass an empty string to remove previously-defined tax rates.',
  },
  {
    name: 'discounts',
    type: 'array of objects',
    description:
      'The coupons, promotion codes, or existing discounts to apply. Pass an empty string to clear discounts.',
    expandable: true,
    children: DISCOUNT_PARAM_CHILDREN,
  },
  {
    name: 'invoice_settings',
    type: 'object',
    description: 'All invoices will be billed using the specified settings.',
    expandable: true,
    children: INVOICE_SETTINGS_PARAM_CHILDREN,
  },
  {
    name: 'off_session',
    type: 'boolean',
    description:
      'Indicates if a customer is on or off-session while an invoice payment is attempted.',
  },
  {
    name: 'on_behalf_of',
    type: 'string',
    description:
      "The account on behalf of which to charge, for each of the subscription's invoices.",
  },
  {
    name: 'payment_settings',
    type: 'object',
    description:
      'Payment settings to pass to invoices created by the subscription.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless only accepts USDC wallet payments, so only the <code>crypto</code> payment method options bag is exposed.',
    expandable: true,
    children: PAYMENT_SETTINGS_CHILDREN,
  },
  {
    name: 'pending_invoice_item_interval',
    type: 'object',
    description:
      'Specifies an interval for how often to bill for any pending invoice items. Pass an empty string to remove.',
    expandable: true,
    children: [
      {
        name: 'interval',
        type: 'enum',
        description: 'Specifies invoicing frequency.',
        enumValues: RECURRING_INTERVAL_ENUM,
        enumNote: HOUR_INTERVAL_NOTE,
      },
      {
        name: 'interval_count',
        type: 'integer',
        description: 'The number of intervals between invoices.',
      },
    ],
  },
  {
    name: 'transfer_data',
    type: 'object',
    description:
      "If specified, the funds from the subscription's invoices will be transferred to the destination account. Pass an empty string to remove.",
    expandable: true,
    children: TRANSFER_DATA_CHILDREN,
  },
  {
    name: 'trial_end',
    type: 'string | timestamp',
    description:
      'Unix timestamp representing the end of the trial period, or the string <code>now</code> to end the trial immediately. Mutually exclusive with <code>trial_from_plan=true</code>.',
  },
  {
    name: 'trial_from_plan',
    type: 'boolean',
    description:
      "Indicates if a plan's <code>trial_period_days</code> should be applied to the subscription.",
  },
  {
    name: 'trial_settings',
    type: 'object',
    description: 'Settings related to subscription trials.',
    expandable: true,
    children: TRIAL_SETTINGS_CHILDREN,
  },
];

export const SUBSCRIPTIONS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a subscription',
  description:
    'Updates an existing subscription to match the specified parameters. When changing prices or quantities, prorations are created by default. For example, if a customer upgrades from a 100 USDC plan to a 200 USDC plan mid-cycle, Zoneless creates a proration for the unused time on the old price and charges for the remaining time on the new price. Use proration_behavior to control or disable this.',
  stripeDocsUrl: 'https://docs.stripe.com/api/subscriptions/update',
  endpoints: [{ method: 'POST', path: '/v1/subscriptions/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_SUBSCRIPTION_PARAMETERS,
          moreAttributes: UPDATE_SUBSCRIPTION_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the updated <code>Subscription</code> object if the update succeeds.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/subscriptions/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/subscriptions/sub_z_1QvK9mR2eZvKYlo2CxH4pN8w \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[order_id]"=8421`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const subscription = await zoneless.subscriptions.update(
  'sub_z_1QvK9mR2eZvKYlo2CxH4pN8w',
  {
    metadata: {
      order_id: '8421',
    },
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: SUBSCRIPTION_UPDATE_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Retrieve
// ============================================

export const SUBSCRIPTIONS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a subscription',
  description: 'Retrieves the subscription with the given ID.',
  stripeDocsUrl: 'https://docs.stripe.com/api/subscriptions/retrieve',
  endpoints: [{ method: 'GET', path: '/v1/subscriptions/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Subscription</code> object if a valid identifier was provided.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/subscriptions/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/subscriptions/sub_z_1QvK9mR2eZvKYlo2CxH4pN8w \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const subscription = await zoneless.subscriptions.retrieve(
  'sub_z_1QvK9mR2eZvKYlo2CxH4pN8w'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: SUBSCRIPTION_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// List
// ============================================

const LIST_SUBSCRIPTIONS_PARAMETERS: Attribute[] = [
  {
    name: 'customer',
    type: 'string',
    description:
      'The ID of the customer whose subscriptions will be retrieved.',
  },
  {
    name: 'price',
    type: 'string',
    description:
      'Filter for subscriptions that contain this recurring price ID.',
  },
  {
    name: 'status',
    type: 'enum',
    description:
      'The status of the subscriptions to retrieve. By default, returns non-canceled subscriptions. Pass <code>canceled</code> to list canceled subscriptions, or <code>all</code> to list every subscription.',
    enumValues: [
      { value: 'active' },
      { value: 'all' },
      { value: 'canceled' },
      { value: 'ended' },
      { value: 'incomplete' },
      { value: 'incomplete_expired' },
      { value: 'past_due' },
      { value: 'paused' },
      { value: 'trialing' },
      { value: 'unpaid' },
    ],
  },
  {
    name: 'limit',
    type: 'integer',
    description:
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
  },
];

const LIST_SUBSCRIPTIONS_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'automatic_tax',
    type: 'object',
    description: 'Filter subscriptions by automatic tax settings.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Only return subscriptions with this automatic tax enabled value.',
      },
    ],
  },
  {
    name: 'collection_method',
    type: 'enum',
    description: 'The collection method of the subscriptions to retrieve.',
    enumValues: [{ value: 'charge_automatically' }, { value: 'send_invoice' }],
  },
  {
    name: 'created',
    type: 'object',
    description:
      'A filter on the list based on the <code>created</code> field. The value can be an integer Unix timestamp or a dictionary with filter options.',
    expandable: true,
    children: TIMESTAMP_RANGE_CHILDREN,
  },
  {
    name: 'current_period_end',
    type: 'object',
    description:
      "A filter on the list based on the collection's <code>current_period_end</code> field. The value can be an integer Unix timestamp or a dictionary with filter options.",
    expandable: true,
    children: TIMESTAMP_RANGE_CHILDREN,
  },
  {
    name: 'current_period_start',
    type: 'object',
    description:
      "A filter on the list based on the collection's <code>current_period_start</code> field. The value can be an integer Unix timestamp or a dictionary with filter options.",
    expandable: true,
    children: TIMESTAMP_RANGE_CHILDREN,
  },
  {
    name: 'customer_account',
    type: 'string',
    description:
      'The ID of the account representing the customer whose subscriptions will be retrieved.',
  },
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list.',
  },
  {
    name: 'starting_after',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list.',
  },
  {
    name: 'test_clock',
    type: 'string',
    description:
      'Filter for subscriptions associated with the specified test clock.',
  },
];

export const SUBSCRIPTIONS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all subscriptions',
  description:
    'By default, returns a list of subscriptions that have not been canceled. To list canceled subscriptions, specify status=canceled.',
  stripeDocsUrl: 'https://docs.stripe.com/api/subscriptions/list',
  endpoints: [{ method: 'GET', path: '/v1/subscriptions' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_SUBSCRIPTIONS_PARAMETERS,
          moreAttributes: LIST_SUBSCRIPTIONS_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a list of <code>Subscription</code> objects.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/subscriptions' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/subscriptions \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const subscriptions = await zoneless.subscriptions.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: SUBSCRIPTION_LIST_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Cancel
// ============================================

const CANCEL_SUBSCRIPTION_PARAMETERS: Attribute[] = [
  {
    name: 'cancellation_details',
    type: 'object',
    description: 'Details about why this subscription was cancelled.',
    expandable: true,
    children: [
      {
        name: 'comment',
        type: 'string',
        description:
          'Additional comments about why the user canceled the subscription.',
      },
      {
        name: 'feedback',
        type: 'enum',
        description: 'The customer submitted reason for why they canceled.',
        enumValues: CANCELLATION_FEEDBACK_ENUM,
      },
    ],
  },
  {
    name: 'invoice_now',
    type: 'boolean',
    description:
      'Generate a final invoice that invoices for any un-invoiced metered usage and new/pending proration invoice items. Defaults to <code>false</code>.',
  },
  {
    name: 'prorate',
    type: 'boolean',
    description:
      'Generate a prorated invoice for the remaining portion of the subscription period. Defaults to <code>false</code>.',
  },
];

export const SUBSCRIPTIONS_CANCEL_PAGE: DocPage = {
  id: 'cancel',
  title: 'Cancel a subscription',
  description:
    "Cancels a customer's subscription immediately. The customer will not be charged again for the subscription. After cancellation, any outstanding invoices remain open and must be paid separately.",
  stripeDocsUrl: 'https://docs.stripe.com/api/subscriptions/cancel',
  endpoints: [{ method: 'DELETE', path: '/v1/subscriptions/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CANCEL_SUBSCRIPTION_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the canceled <code>Subscription</code> object with <code>status</code> set to <code>canceled</code>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'DELETE', path: '/v1/subscriptions/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X DELETE https://api.yourdomain.com/v1/subscriptions/sub_z_1QvK9mR2eZvKYlo2CxH4pN8w \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const subscription = await zoneless.subscriptions.cancel(
  'sub_z_1QvK9mR2eZvKYlo2CxH4pN8w'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: SUBSCRIPTION_CANCELED_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Migrate
// ============================================

const MIGRATE_SUBSCRIPTION_PARAMETERS: Attribute[] = [
  {
    name: 'billing_mode',
    type: 'object',
    required: true,
    description:
      "Controls how prorations and invoices for subscriptions are calculated and orchestrated. Use this endpoint to upgrade a subscription's billing mode to <code>flexible</code>.",
    expandable: true,
    children: [
      {
        name: 'type',
        type: 'enum',
        required: true,
        description: 'Must be <code>flexible</code> when migrating.',
        enumValues: [{ value: 'flexible' }],
      },
      {
        name: 'flexible',
        type: 'object',
        description: 'Configure behavior for flexible billing mode.',
        expandable: true,
        children: [
          {
            name: 'proration_discounts',
            type: 'enum',
            description:
              'Controls how invoices and invoice items display proration amounts and discount amounts.',
            enumValues: [
              {
                value: 'included',
                description:
                  'Amounts are net of discounts, and discount amounts are zero.',
              },
              {
                value: 'itemized',
                description:
                  'Amounts are gross of discounts, and discount amounts are accurate.',
              },
            ],
          },
        ],
      },
    ],
  },
];

export const SUBSCRIPTIONS_MIGRATE_PAGE: DocPage = {
  id: 'migrate',
  title: 'Migrate a subscription',
  description:
    "Upgrade a subscription's billing mode from classic to flexible.",
  stripeDocsUrl: 'https://docs.stripe.com/api/subscriptions/migrate',
  endpoints: [{ method: 'POST', path: '/v1/subscriptions/:id/migrate' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: MIGRATE_SUBSCRIPTION_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the updated <code>Subscription</code> object with <code>billing_mode.type</code> set to <code>flexible</code>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/subscriptions/:id/migrate' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/subscriptions/sub_z_1QvK9mR2eZvKYlo2CxH4pN8w/migrate \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "billing_mode[type]"=flexible`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const subscription = await zoneless.subscriptions.migrate(
  'sub_z_1QvK9mR2eZvKYlo2CxH4pN8w',
  {
    billing_mode: {
      type: 'flexible',
    },
  }
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: SUBSCRIPTION_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Resume
// ============================================

const RESUME_SUBSCRIPTION_PARAMETERS: Attribute[] = [
  {
    name: 'billing_cycle_anchor',
    type: 'enum',
    description:
      "Either <code>now</code> or <code>unchanged</code>. Setting the value to <code>now</code> resets the subscription's billing cycle anchor to the current time (in UTC). The default is <code>now</code>.",
    enumValues: [
      {
        value: 'now',
        description: 'Reset the billing cycle anchor to the current time.',
      },
      {
        value: 'unchanged',
        description: 'Keep the existing billing cycle anchor.',
      },
    ],
  },
  {
    name: 'proration_behavior',
    type: 'enum',
    description:
      'Determines how to handle prorations when resuming the subscription.',
    enumValues: [
      {
        value: 'create_prorations',
        description: 'Create prorations when applicable.',
      },
      { value: 'none', description: 'Disable creating prorations.' },
      {
        value: 'always_invoice',
        description: 'Create prorations and immediately invoice them.',
      },
    ],
  },
  {
    name: 'proration_date',
    type: 'timestamp',
    description:
      'If set, the proration will be calculated as though the subscription was resumed at the given time.',
  },
];

export const SUBSCRIPTIONS_RESUME_PAGE: DocPage = {
  id: 'resume',
  title: 'Resume a subscription',
  description:
    'Resumes a paused subscription. Only subscriptions with collection_method=charge_automatically can be resumed. The subscription must be in the paused status (typically after a trial ends without a payment method).',
  stripeDocsUrl: 'https://docs.stripe.com/api/subscriptions/resume',
  endpoints: [{ method: 'POST', path: '/v1/subscriptions/:id/resume' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: RESUME_SUBSCRIPTION_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the resumed <code>Subscription</code> object, typically with <code>status</code> set to <code>active</code>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/subscriptions/:id/resume' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/subscriptions/sub_z_1QvK9mR2eZvKYlo2CxH4pN8w/resume \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d billing_cycle_anchor=now`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const subscription = await zoneless.subscriptions.resume(
  'sub_z_1QvK9mR2eZvKYlo2CxH4pN8w',
  {
    billing_cycle_anchor: 'now',
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: SUBSCRIPTION_RESUME_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const SUBSCRIPTIONS_PAGES: DocPage[] = [
  SUBSCRIPTIONS_OVERVIEW_PAGE,
  SUBSCRIPTIONS_CREATE_PAGE,
  SUBSCRIPTIONS_UPDATE_PAGE,
  SUBSCRIPTIONS_RETRIEVE_PAGE,
  SUBSCRIPTIONS_LIST_PAGE,
  SUBSCRIPTIONS_CANCEL_PAGE,
  SUBSCRIPTIONS_MIGRATE_PAGE,
  SUBSCRIPTIONS_RESUME_PAGE,
];
