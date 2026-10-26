import { DocSubSection, DocPage, Attribute } from './types';
import { NODE_INIT, EXPAND_TOOLTIP, BuildEndpointSummaries } from './shared';
import { GetResourceEventAttributes } from './event-types';

export const INVOICES_SUBSECTION: DocSubSection = {
  id: 'invoices',
  title: 'Invoices',
  children: [
    { id: 'object', title: 'The Invoice object' },
    { id: 'create', title: 'Create an invoice' },
    { id: 'update', title: 'Update an invoice' },
    { id: 'retrieve', title: 'Retrieve an invoice' },
    { id: 'list', title: 'List all invoices' },
    { id: 'delete', title: 'Delete a draft invoice' },
    { id: 'finalize', title: 'Finalize an invoice' },
    { id: 'mark_uncollectible', title: 'Mark an invoice as uncollectible' },
    { id: 'pay', title: 'Pay an invoice' },
    { id: 'void', title: 'Void an invoice' },
  ],
};

// ============================================
// Shared helpers
// ============================================

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

const ADDRESS_CHILDREN: Attribute[] = [
  {
    name: 'city',
    type: 'string',
    nullable: true,
    description: 'City, district, suburb, town, or village.',
  },
  {
    name: 'country',
    type: 'string',
    nullable: true,
    description: 'Two-letter country code (ISO 3166-1 alpha-2).',
  },
  {
    name: 'line1',
    type: 'string',
    nullable: true,
    description: 'Address line 1, such as the street, PO Box, or company name.',
  },
  {
    name: 'line2',
    type: 'string',
    nullable: true,
    description:
      'Address line 2, such as the apartment, suite, unit, or building.',
  },
  {
    name: 'postal_code',
    type: 'string',
    nullable: true,
    description: 'ZIP or postal code.',
  },
  {
    name: 'state',
    type: 'string',
    nullable: true,
    description: 'State, county, province, or region (ISO 3166-2).',
  },
];

const SHIPPING_DETAILS_CHILDREN: Attribute[] = [
  {
    name: 'address',
    type: 'object',
    description: 'Shipping address.',
    expandable: true,
    children: ADDRESS_CHILDREN,
  },
  { name: 'name', type: 'string', description: 'Recipient name.' },
  {
    name: 'phone',
    type: 'string',
    nullable: true,
    description: 'Recipient phone (including extension).',
  },
];

const SHIPPING_DETAILS_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'address',
    type: 'object',
    required: true,
    description: 'Shipping address.',
    expandable: true,
    children: [
      {
        name: 'city',
        type: 'string',
        description: 'City, district, suburb, town, or village.',
      },
      {
        name: 'country',
        type: 'string',
        description: 'Two-letter country code (ISO 3166-1 alpha-2).',
      },
      {
        name: 'line1',
        type: 'string',
        description:
          'Address line 1, such as the street, PO Box, or company name.',
      },
      {
        name: 'line2',
        type: 'string',
        description:
          'Address line 2, such as the apartment, suite, unit, or building.',
      },
      {
        name: 'postal_code',
        type: 'string',
        description: 'ZIP or postal code.',
      },
      {
        name: 'state',
        type: 'string',
        description: 'State, county, province, or region (ISO 3166-2).',
      },
    ],
  },
  {
    name: 'name',
    type: 'string',
    required: true,
    description: 'Recipient name.',
  },
  {
    name: 'phone',
    type: 'string',
    description: 'Recipient phone (including extension).',
  },
];

const ISSUER_CHILDREN: Attribute[] = [
  {
    name: 'type',
    type: 'enum',
    required: true,
    description: 'Type of the account referenced.',
    enumValues: [
      {
        value: 'account',
        description:
          'Indicates that the account being referenced is a connected account which is different from the account making the API request but related to it.',
      },
      {
        value: 'self',
        description:
          'Indicates that the account being referenced is the account making the API request.',
      },
    ],
  },
  {
    name: 'account',
    type: 'string',
    required: true,
    requiredText: 'Required only if type is account',
    tooltip: EXPAND_TOOLTIP,
    description:
      'The connected account being referenced when <code>type</code> is <code>account</code>.',
  },
];

const AUTOMATIC_TAX_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'enabled',
    type: 'boolean',
    required: true,
    description:
      'Whether Zoneless automatically computes tax on this invoice. Incompatible invoice items (manually specified tax rates, negative amounts, or <code>tax_behavior=unspecified</code>) cannot be added to automatic tax invoices.',
  },
  {
    name: 'liability',
    type: 'object',
    description:
      'The account that’s liable for tax. If set, the business address and tax registrations required to perform the tax calculation are loaded from this account.',
    expandable: true,
    children: ISSUER_CHILDREN,
  },
];

const PAYMENT_SETTINGS_CHILDREN: Attribute[] = [
  {
    name: 'default_mandate',
    type: 'string',
    nullable: true,
    description:
      'ID of the mandate to be used for this invoice. It must correspond to the payment method used to pay the invoice, including the invoice’s <code>default_payment_method</code> or <code>default_source</code>, if set.',
  },
  {
    name: 'payment_method_options',
    type: 'object',
    nullable: true,
    description:
      'Payment-method-specific configuration to provide when collecting payment for the invoice.',
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
    type: 'array of enums',
    nullable: true,
    description:
      'The list of payment method types to provide when collecting payment for the invoice. If not set, Zoneless attempts to determine the types to use automatically.',
    enumValues: [
      { value: 'crypto', description: 'USDC wallet payments on Solana.' },
    ],
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless only supports <code>crypto</code>. Card and other fiat payment method types are not available.',
  },
];

const TRANSFER_DATA_CHILDREN: Attribute[] = [
  {
    name: 'destination',
    type: 'string',
    required: true,
    description:
      'ID of an existing connected account where funds from the payment will be transferred.',
  },
  {
    name: 'amount',
    type: 'integer',
    description:
      'The amount that will be transferred automatically when the invoice is paid. If no amount is set, the full amount is transferred. For USDC, this is cents (e.g., 100 = $1 USDC).',
  },
];

const RENDERING_CHILDREN: Attribute[] = [
  {
    name: 'amount_tax_display',
    type: 'enum',
    nullable: true,
    description:
      'How line-item prices and amounts will be displayed with respect to tax on invoice PDFs. One of <code>exclude_tax</code> or <code>include_inclusive_tax</code>.',
    enumValues: [{ value: 'exclude_tax' }, { value: 'include_inclusive_tax' }],
  },
  {
    name: 'pdf',
    type: 'object',
    nullable: true,
    description: 'Invoice PDF rendering options.',
    expandable: true,
    children: [
      {
        name: 'page_size',
        type: 'enum',
        nullable: true,
        description:
          'Page size of the invoice PDF. If set to <code>auto</code>, page size switches to <code>a4</code> or <code>letter</code> based on customer locale.',
        enumValues: [{ value: 'a4' }, { value: 'auto' }, { value: 'letter' }],
      },
    ],
  },
  {
    name: 'template',
    type: 'string',
    nullable: true,
    description:
      'ID of the rendering template that the invoice is formatted by.',
  },
  {
    name: 'template_version',
    type: 'integer',
    nullable: true,
    description: 'Version of the rendering template that the invoice is using.',
  },
];

const DELIVERY_ESTIMATE_BOUND_CHILDREN: Attribute[] = [
  {
    name: 'unit',
    type: 'enum',
    required: true,
    description: 'A unit of time.',
    enumValues: [
      { value: 'business_day' },
      { value: 'day' },
      { value: 'hour' },
      { value: 'month' },
      { value: 'week' },
    ],
  },
  {
    name: 'value',
    type: 'integer',
    required: true,
    description: 'Must be greater than 0.',
  },
];

const SHIPPING_COST_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'shipping_rate',
    type: 'string',
    required: true,
    requiredText: 'Required unless shipping_rate_data is provided',
    description: 'The ID of the shipping rate to use for this invoice.',
  },
  {
    name: 'shipping_rate_data',
    type: 'object',
    required: true,
    requiredText: 'Required unless shipping_rate is provided',
    description:
      'Parameters to create a new ad-hoc shipping rate for this invoice.',
    expandable: true,
    children: [
      {
        name: 'display_name',
        type: 'string',
        required: true,
        description:
          'The name of the shipping rate, meant to be displayable to the customer. Maximum length is 100 characters.',
      },
      {
        name: 'type',
        type: 'enum',
        required: true,
        description: 'The type of calculation to use on the shipping rate.',
        enumValues: [
          {
            value: 'fixed_amount',
            description: 'The shipping rate is a fixed amount.',
          },
        ],
      },
      {
        name: 'fixed_amount',
        type: 'object',
        description:
          'Describes a fixed amount to charge for shipping. Must be present when <code>type</code> is <code>fixed_amount</code>.',
        expandable: true,
        children: [
          {
            name: 'amount',
            type: 'integer',
            required: true,
            description:
              'A non-negative integer in the smallest currency unit representing how much to charge.',
          },
          {
            name: 'currency',
            type: 'enum',
            required: true,
            description:
              'Three-letter currency code, in lowercase. For Zoneless, use <code>usdc</code>.',
            enumNote:
              '<strong>Difference from Stripe:</strong> Use <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
          },
        ],
      },
      {
        name: 'delivery_estimate',
        type: 'object',
        description: 'The estimated range for how long shipping will take.',
        expandable: true,
        children: [
          {
            name: 'maximum',
            type: 'object',
            description:
              'The upper bound of the estimated range. If empty, represents no upper bound.',
            expandable: true,
            children: DELIVERY_ESTIMATE_BOUND_CHILDREN,
          },
          {
            name: 'minimum',
            type: 'object',
            description:
              'The lower bound of the estimated range. If empty, represents no lower bound.',
            expandable: true,
            children: DELIVERY_ESTIMATE_BOUND_CHILDREN,
          },
        ],
      },
      {
        name: 'metadata',
        type: 'object',
        description:
          'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
      },
      {
        name: 'tax_behavior',
        type: 'enum',
        description:
          'Specifies whether the rate is considered inclusive of taxes or exclusive of taxes. One of <code>inclusive</code>, <code>exclusive</code>, or <code>unspecified</code>.',
        enumValues: [
          { value: 'exclusive' },
          { value: 'inclusive' },
          { value: 'unspecified' },
        ],
      },
      {
        name: 'tax_code',
        type: 'string',
        description: 'A tax code ID.',
      },
    ],
  },
];

const CUSTOM_FIELD_CHILDREN: Attribute[] = [
  {
    name: 'name',
    type: 'string',
    required: true,
    description:
      'The name of the custom field. Maximum length is 40 characters.',
  },
  {
    name: 'value',
    type: 'string',
    required: true,
    description:
      'The value of the custom field. Maximum length is 140 characters.',
  },
];

const LINE_ITEM_CHILDREN: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description: 'Unique identifier for the object.',
  },
  {
    name: 'object',
    type: 'string',
    description:
      'String representing the object’s type. Objects of the same type share the same value.',
  },
  {
    name: 'amount',
    type: 'integer',
    description:
      'The amount, in the smallest currency unit. For USDC, this is cents (e.g., 100 = $1 USDC).',
  },
  {
    name: 'currency',
    type: 'enum',
    description:
      'Three-letter currency code, in lowercase. For Zoneless, this is <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Uses <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
  },
  {
    name: 'description',
    type: 'string',
    nullable: true,
    description:
      'An arbitrary string attached to the object. Often useful for displaying to users.',
  },
  {
    name: 'discountable',
    type: 'boolean',
    description:
      'If true, discounts will apply to this line item. Always false for prorations.',
  },
  {
    name: 'invoice',
    type: 'string',
    nullable: true,
    description: 'The ID of the invoice that contains this line item.',
  },
  {
    name: 'livemode',
    type: 'boolean',
    description:
      'Has the value <code>true</code> if the object exists in live mode or the value <code>false</code> if the object exists in test mode.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. For subscription line items, this reflects the current metadata from the subscription unless the line was updated directly.',
  },
  {
    name: 'period',
    type: 'object',
    description:
      'The period this line item covers. For subscription line items, this is the subscription period. For invoice items, this is the time at which the invoice item was created or the period of the item.',
    expandable: true,
    children: [
      {
        name: 'end',
        type: 'timestamp',
        description:
          'The end of the period, which must be greater than or equal to the start. This value is inclusive.',
      },
      {
        name: 'start',
        type: 'timestamp',
        description: 'The start of the period. This value is inclusive.',
      },
    ],
  },
  {
    name: 'pricing',
    type: 'object',
    nullable: true,
    description: 'The pricing information of the line item.',
    expandable: true,
    children: [
      {
        name: 'price_details',
        type: 'object',
        nullable: true,
        description:
          'Additional details about the price this item is associated with. Present only when <code>type</code> is <code>price_details</code>.',
        expandable: true,
        children: [
          {
            name: 'price',
            type: 'string',
            tooltip: EXPAND_TOOLTIP,
            description: 'The ID of the price this item is associated with.',
          },
          {
            name: 'product',
            type: 'string',
            description: 'The ID of the product this item is associated with.',
          },
        ],
      },
      {
        name: 'type',
        type: 'enum',
        description: 'The type of the pricing details.',
        enumValues: [{ value: 'price_details' }],
      },
      {
        name: 'unit_amount_decimal',
        type: 'decimal string',
        nullable: true,
        description:
          'The unit amount (in the <code>currency</code> specified) of the item, as a decimal string with at most 12 decimal places.',
      },
    ],
  },
  {
    name: 'quantity',
    type: 'integer',
    nullable: true,
    description:
      'Quantity of units for the invoice line item in integer format. For full-precision quantity, use <code>quantity_decimal</code>.',
  },
  {
    name: 'quantity_decimal',
    type: 'decimal string',
    nullable: true,
    description:
      'Non-negative decimal with at most 12 decimal places. The quantity of units for the line item.',
  },
  {
    name: 'subtotal',
    type: 'integer',
    description:
      'The subtotal of the line item, in the smallest currency unit, before any discounts or taxes.',
  },
];

// ============================================
// Shared Data
// ============================================

const INVOICE_OBJECT_JSON = `{
  "id": "in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c",
  "object": "invoice",
  "account_country": "US",
  "account_name": "Zoneless Docs",
  "account_tax_ids": null,
  "amount_due": 0,
  "amount_paid": 0,
  "amount_overpaid": 0,
  "amount_remaining": 0,
  "amount_shipping": 0,
  "application": null,
  "attempt_count": 0,
  "attempted": false,
  "auto_advance": false,
  "automatic_tax": {
    "enabled": false,
    "liability": null,
    "status": null
  },
  "billing_reason": "manual",
  "collection_method": "charge_automatically",
  "created": 1723820400,
  "currency": "usdc",
  "custom_fields": null,
  "customer": "cus_z_TpL8wQkR3nVmY",
  "customer_address": null,
  "customer_email": "maya.chen@example.com",
  "customer_name": "Maya Chen",
  "customer_phone": null,
  "customer_shipping": null,
  "customer_tax_exempt": "none",
  "customer_tax_ids": [],
  "confirmation_secret": null,
  "default_payment_method": null,
  "default_source": null,
  "default_tax_rates": [],
  "description": null,
  "discounts": [],
  "due_date": null,
  "ending_balance": null,
  "footer": null,
  "from_invoice": null,
  "hosted_invoice_url": null,
  "invoice_pdf": null,
  "issuer": {
    "type": "self"
  },
  "last_finalization_error": null,
  "latest_revision": null,
  "lines": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/invoices/in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c/lines"
  },
  "payments": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/invoice_payments"
  },
  "livemode": false,
  "metadata": {},
  "next_payment_attempt": null,
  "number": null,
  "on_behalf_of": null,
  "parent": null,
  "payment_settings": {
    "default_mandate": null,
    "payment_method_options": null,
    "payment_method_types": null
  },
  "period_end": 1723820400,
  "period_start": 1723820400,
  "post_payment_credit_notes_amount": 0,
  "pre_payment_credit_notes_amount": 0,
  "receipt_number": null,
  "shipping_cost": null,
  "shipping_details": null,
  "starting_balance": 0,
  "statement_descriptor": null,
  "status": "draft",
  "status_transitions": {
    "finalized_at": null,
    "marked_uncollectible_at": null,
    "paid_at": null,
    "voided_at": null
  },
  "subtotal": 0,
  "subtotal_excluding_tax": 0,
  "test_clock": null,
  "total": 0,
  "total_discount_amounts": [],
  "total_excluding_tax": 0,
  "total_taxes": [],
  "transfer_data": null,
  "webhooks_delivered_at": 1723820400,
  "platform_account": "acct_z_Platform123abc"
}`;

const INVOICE_UPDATED_JSON = `{
  "id": "in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c",
  "object": "invoice",
  "account_country": "US",
  "account_name": "Zoneless Docs",
  "account_tax_ids": null,
  "amount_due": 0,
  "amount_paid": 0,
  "amount_overpaid": 0,
  "amount_remaining": 0,
  "amount_shipping": 0,
  "application": null,
  "attempt_count": 0,
  "attempted": false,
  "auto_advance": false,
  "automatic_tax": {
    "enabled": false,
    "liability": null,
    "status": null
  },
  "billing_reason": "manual",
  "collection_method": "charge_automatically",
  "created": 1723820400,
  "currency": "usdc",
  "custom_fields": null,
  "customer": "cus_z_TpL8wQkR3nVmY",
  "customer_address": null,
  "customer_email": "maya.chen@example.com",
  "customer_name": "Maya Chen",
  "customer_phone": null,
  "customer_shipping": null,
  "customer_tax_exempt": "none",
  "customer_tax_ids": [],
  "default_payment_method": null,
  "default_source": null,
  "default_tax_rates": [],
  "description": null,
  "discounts": [],
  "due_date": null,
  "ending_balance": null,
  "footer": null,
  "from_invoice": null,
  "hosted_invoice_url": null,
  "invoice_pdf": null,
  "issuer": {
    "type": "self"
  },
  "last_finalization_error": null,
  "latest_revision": null,
  "lines": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/invoices/in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c/lines"
  },
  "livemode": false,
  "metadata": {
    "order_id": "9284"
  },
  "next_payment_attempt": null,
  "number": null,
  "on_behalf_of": null,
  "parent": null,
  "payment_settings": {
    "default_mandate": null,
    "payment_method_options": null,
    "payment_method_types": null
  },
  "period_end": 1723820400,
  "period_start": 1723820400,
  "post_payment_credit_notes_amount": 0,
  "pre_payment_credit_notes_amount": 0,
  "receipt_number": null,
  "shipping_cost": null,
  "shipping_details": null,
  "starting_balance": 0,
  "statement_descriptor": null,
  "status": "draft",
  "status_transitions": {
    "finalized_at": null,
    "marked_uncollectible_at": null,
    "paid_at": null,
    "voided_at": null
  },
  "subtotal": 0,
  "subtotal_excluding_tax": 0,
  "test_clock": null,
  "total": 0,
  "total_discount_amounts": [],
  "total_excluding_tax": 0,
  "total_taxes": [],
  "webhooks_delivered_at": 1723820400,
  "platform_account": "acct_z_Platform123abc"
}`;

const INVOICE_FINALIZED_JSON = `{
  "id": "in_z_1RvK9aH3fZwLXmp3Jo5nXy0d",
  "object": "invoice",
  "account_country": "US",
  "account_name": "Zoneless Docs",
  "account_tax_ids": null,
  "amount_due": 0,
  "amount_paid": 0,
  "amount_overpaid": 0,
  "amount_remaining": 0,
  "amount_shipping": 0,
  "application": null,
  "attempt_count": 0,
  "attempted": true,
  "auto_advance": false,
  "automatic_tax": {
    "enabled": false,
    "liability": null,
    "status": null
  },
  "billing_reason": "manual",
  "collection_method": "send_invoice",
  "created": 1723824000,
  "currency": "usdc",
  "custom_fields": null,
  "customer": "cus_z_TpL8wQkR3nVmY",
  "customer_address": null,
  "customer_email": "maya.chen@example.com",
  "customer_name": "Maya Chen",
  "customer_phone": null,
  "customer_shipping": null,
  "customer_tax_exempt": "none",
  "customer_tax_ids": [],
  "default_payment_method": null,
  "default_source": null,
  "default_tax_rates": [],
  "description": null,
  "discounts": [],
  "due_date": 1724428800,
  "ending_balance": 0,
  "footer": null,
  "from_invoice": null,
  "hosted_invoice_url": "https://invoice.yourdomain.com/i/acct_z_Platform123abc/test_aW52b2ljZV96XzFSdk...",
  "invoice_pdf": "https://pay.yourdomain.com/invoice/acct_z_Platform123abc/test_aW52b2ljZV96XzFSdk.../pdf",
  "issuer": {
    "type": "self"
  },
  "last_finalization_error": null,
  "latest_revision": null,
  "lines": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/invoices/in_z_1RvK9aH3fZwLXmp3Jo5nXy0d/lines"
  },
  "livemode": false,
  "metadata": {},
  "next_payment_attempt": null,
  "number": "7B3C9E12-0001",
  "on_behalf_of": null,
  "parent": null,
  "payment_settings": {
    "default_mandate": null,
    "payment_method_options": null,
    "payment_method_types": null
  },
  "period_end": 1723824000,
  "period_start": 1723824000,
  "post_payment_credit_notes_amount": 0,
  "pre_payment_credit_notes_amount": 0,
  "receipt_number": null,
  "shipping_cost": null,
  "shipping_details": null,
  "starting_balance": 0,
  "statement_descriptor": null,
  "status": "paid",
  "status_transitions": {
    "finalized_at": 1723824000,
    "marked_uncollectible_at": null,
    "paid_at": 1723824000,
    "voided_at": null
  },
  "subtotal": 0,
  "subtotal_excluding_tax": 0,
  "test_clock": null,
  "total": 0,
  "total_discount_amounts": [],
  "total_excluding_tax": 0,
  "total_taxes": [],
  "webhooks_delivered_at": 1723824000,
  "platform_account": "acct_z_Platform123abc"
}`;

const INVOICE_UNCOLLECTIBLE_JSON = `{
  "id": "in_z_1RvJ4mN1dYuKXkn2Gi3lVw8b",
  "object": "invoice",
  "account_country": "US",
  "account_name": "Zoneless Docs",
  "account_tax_ids": null,
  "amount_due": 2499,
  "amount_paid": 0,
  "amount_overpaid": 0,
  "amount_remaining": 2499,
  "amount_shipping": 0,
  "application": null,
  "attempt_count": 0,
  "attempted": false,
  "auto_advance": false,
  "automatic_tax": {
    "enabled": false,
    "liability": null,
    "status": null
  },
  "billing_reason": "manual",
  "collection_method": "charge_automatically",
  "created": 1723737600,
  "currency": "usdc",
  "custom_fields": null,
  "customer": "cus_z_TpL8wQkR3nVmY",
  "customer_address": null,
  "customer_email": "maya.chen@example.com",
  "customer_name": "Maya Chen",
  "customer_phone": null,
  "customer_shipping": null,
  "customer_tax_exempt": "none",
  "customer_tax_ids": [],
  "default_payment_method": null,
  "default_source": null,
  "default_tax_rates": [],
  "description": null,
  "discounts": [],
  "due_date": null,
  "ending_balance": null,
  "footer": null,
  "from_invoice": null,
  "hosted_invoice_url": null,
  "invoice_pdf": null,
  "issuer": {
    "type": "self"
  },
  "last_finalization_error": null,
  "latest_revision": null,
  "lines": {
    "object": "list",
    "data": [
      {
        "id": "il_z_1RvJ4mN1dYuKXkn2Hk4pVx9c",
        "object": "line_item",
        "amount": 2499,
        "currency": "usdc",
        "description": "API usage credit pack",
        "discount_amounts": [],
        "discountable": true,
        "discounts": [],
        "livemode": false,
        "metadata": {},
        "parent": {
          "type": "invoice_item_details",
          "invoice_item_details": {
            "invoice_item": "ii_z_1RvJ4mN1dYuKXkn2Gj3oUw7a",
            "proration": false,
            "proration_details": {
              "credited_items": null
            },
            "subscription": null
          }
        },
        "period": {
          "end": 1723737600,
          "start": 1723737600
        },
        "pricing": {
          "price_details": {
            "price": "price_z_1RvJ3kM0cXtJWjm1Fi2nTu6z",
            "product": "prod_z_TpL8xRcS4oWnZ"
          },
          "type": "price_details",
          "unit_amount_decimal": "2499"
        },
        "quantity": 1,
        "quantity_decimal": "1",
        "taxes": []
      }
    ],
    "has_more": false,
    "url": "/v1/invoices/in_z_1RvJ4mN1dYuKXkn2Gi3lVw8b/lines"
  },
  "livemode": false,
  "metadata": {},
  "next_payment_attempt": null,
  "number": null,
  "on_behalf_of": null,
  "parent": null,
  "payment_settings": {
    "default_mandate": null,
    "payment_method_options": null,
    "payment_method_types": null
  },
  "period_end": 1723737600,
  "period_start": 1723737600,
  "post_payment_credit_notes_amount": 0,
  "pre_payment_credit_notes_amount": 0,
  "receipt_number": null,
  "shipping_cost": null,
  "shipping_details": null,
  "starting_balance": 0,
  "statement_descriptor": null,
  "status": "uncollectible",
  "status_transitions": {
    "finalized_at": 1723737800,
    "marked_uncollectible_at": 1723900000,
    "paid_at": null,
    "voided_at": null
  },
  "subtotal": 2499,
  "subtotal_excluding_tax": 2499,
  "test_clock": null,
  "total": 2499,
  "total_discount_amounts": [],
  "total_excluding_tax": 2499,
  "total_taxes": [],
  "webhooks_delivered_at": 1723737800,
  "platform_account": "acct_z_Platform123abc"
}`;

const INVOICE_VOIDED_JSON = `{
  "id": "in_z_1RvK9aH3fZwLXmp3Jo5nXy0d",
  "object": "invoice",
  "account_country": "US",
  "account_name": "Zoneless Docs",
  "account_tax_ids": null,
  "amount_due": 0,
  "amount_paid": 0,
  "amount_overpaid": 0,
  "amount_remaining": 0,
  "amount_shipping": 0,
  "application": null,
  "attempt_count": 0,
  "attempted": false,
  "auto_advance": false,
  "automatic_tax": {
    "enabled": false,
    "liability": null,
    "status": null
  },
  "billing_reason": "manual",
  "collection_method": "charge_automatically",
  "created": 1723820400,
  "currency": "usdc",
  "custom_fields": null,
  "customer": "cus_z_TpL8wQkR3nVmY",
  "customer_address": null,
  "customer_email": "maya.chen@example.com",
  "customer_name": "Maya Chen",
  "customer_phone": null,
  "customer_shipping": null,
  "customer_tax_exempt": "none",
  "customer_tax_ids": [],
  "default_payment_method": null,
  "default_source": null,
  "default_tax_rates": [],
  "description": null,
  "discounts": [],
  "due_date": null,
  "ending_balance": null,
  "footer": null,
  "from_invoice": null,
  "hosted_invoice_url": null,
  "invoice_pdf": null,
  "issuer": {
    "type": "self"
  },
  "last_finalization_error": null,
  "latest_revision": null,
  "lines": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/invoices/in_z_1RvK9aH3fZwLXmp3Jo5nXy0d/lines"
  },
  "livemode": false,
  "metadata": {},
  "next_payment_attempt": null,
  "number": null,
  "on_behalf_of": null,
  "parent": null,
  "payment_settings": {
    "default_mandate": null,
    "payment_method_options": null,
    "payment_method_types": null
  },
  "period_end": 1723820400,
  "period_start": 1723820400,
  "post_payment_credit_notes_amount": 0,
  "pre_payment_credit_notes_amount": 0,
  "receipt_number": null,
  "shipping_cost": null,
  "shipping_details": null,
  "starting_balance": 0,
  "statement_descriptor": null,
  "status": "void",
  "status_transitions": {
    "finalized_at": 1723821000,
    "marked_uncollectible_at": null,
    "paid_at": null,
    "voided_at": 1723905000
  },
  "subtotal": 0,
  "subtotal_excluding_tax": 0,
  "test_clock": null,
  "total": 0,
  "total_discount_amounts": [],
  "total_excluding_tax": 0,
  "total_taxes": [],
  "webhooks_delivered_at": 1723820400,
  "platform_account": "acct_z_Platform123abc"
}`;

const INVOICE_DELETED_JSON = `{
  "id": "in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c",
  "object": "invoice",
  "deleted": true
}`;

const LIST_INVOICES_JSON = `{
  "object": "list",
  "url": "/v1/invoices",
  "has_more": false,
  "data": [
    {
      "id": "in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c",
      "object": "invoice",
      "account_country": "US",
      "account_name": "Zoneless Docs",
      "account_tax_ids": null,
      "amount_due": 0,
      "amount_paid": 0,
      "amount_overpaid": 0,
      "amount_remaining": 0,
      "amount_shipping": 0,
      "application": null,
      "attempt_count": 0,
      "attempted": false,
      "auto_advance": false,
      "automatic_tax": {
        "enabled": false,
        "liability": null,
        "status": null
      },
      "billing_reason": "manual",
      "collection_method": "charge_automatically",
      "created": 1723820400,
      "currency": "usdc",
      "custom_fields": null,
      "customer": "cus_z_TpL8wQkR3nVmY",
      "customer_address": null,
      "customer_email": "maya.chen@example.com",
      "customer_name": "Maya Chen",
      "customer_phone": null,
      "customer_shipping": null,
      "customer_tax_exempt": "none",
      "customer_tax_ids": [],
      "default_payment_method": null,
      "default_source": null,
      "default_tax_rates": [],
      "description": null,
      "discounts": [],
      "due_date": null,
      "ending_balance": null,
      "footer": null,
      "from_invoice": null,
      "hosted_invoice_url": null,
      "invoice_pdf": null,
      "issuer": {
        "type": "self"
      },
      "last_finalization_error": null,
      "latest_revision": null,
      "lines": {
        "object": "list",
        "data": [],
        "has_more": false,
        "total_count": 0,
        "url": "/v1/invoices/in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c/lines"
      },
      "livemode": false,
      "metadata": {},
      "next_payment_attempt": null,
      "number": null,
      "on_behalf_of": null,
      "parent": null,
      "payment_settings": {
        "default_mandate": null,
        "payment_method_options": null,
        "payment_method_types": null
      },
      "period_end": 1723820400,
      "period_start": 1723820400,
      "post_payment_credit_notes_amount": 0,
      "pre_payment_credit_notes_amount": 0,
      "receipt_number": null,
      "shipping_cost": null,
      "shipping_details": null,
      "starting_balance": 0,
      "statement_descriptor": null,
      "status": "draft",
      "status_transitions": {
        "finalized_at": null,
        "marked_uncollectible_at": null,
        "paid_at": null,
        "voided_at": null
      },
      "subtotal": 0,
      "subtotal_excluding_tax": 0,
      "test_clock": null,
      "total": 0,
      "total_discount_amounts": [],
      "total_excluding_tax": 0,
      "total_taxes": [],
      "webhooks_delivered_at": 1723820400,
      "platform_account": "acct_z_Platform123abc"
    }
  ]
}`;

// ============================================
// Object Attributes
// ============================================

const INVOICE_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless invoice IDs are prefixed with <code>in_z_</code>.',
  },
  {
    name: 'object',
    type: 'string',
    description:
      'String representing the object’s type. Objects of the same type share the same value.',
  },
  {
    name: 'account_country',
    type: 'string',
    nullable: true,
    description:
      'The country of the business associated with this invoice, most often the business creating the invoice.',
  },
  {
    name: 'account_name',
    type: 'string',
    nullable: true,
    description:
      'The public name of the business associated with this invoice, most often the business creating the invoice.',
  },
  {
    name: 'amount_due',
    type: 'integer',
    description:
      'Final amount due at this time for this invoice. If the invoice’s total is smaller than the minimum charge amount, or if there is account credit that can be applied, <code>amount_due</code> may be 0. The payment collected for the invoice is for this amount. For USDC, this is cents (e.g., 100 = $1 USDC).',
  },
  {
    name: 'amount_overpaid',
    type: 'integer',
    description:
      'Amount that was overpaid on the invoice. The amount overpaid is credited to the customer’s credit balance.',
  },
  {
    name: 'amount_paid',
    type: 'integer',
    description: 'The amount, in the smallest currency unit, that was paid.',
  },
  {
    name: 'amount_remaining',
    type: 'integer',
    description:
      'The difference between <code>amount_due</code> and <code>amount_paid</code>, in the smallest currency unit.',
  },
  {
    name: 'attempt_count',
    type: 'integer',
    description:
      'Number of payment attempts made for this invoice, from the perspective of the payment retry schedule. Any payment attempt counts as the first attempt, and subsequently only automatic retries increment the attempt count.',
  },
  {
    name: 'attempted',
    type: 'boolean',
    description:
      'Whether an attempt has been made to pay the invoice. An invoice is not attempted until after the <code>invoice.created</code> webhook is delivered, so you might not want to display that invoice as unpaid to your users yet.',
  },
  {
    name: 'auto_advance',
    type: 'boolean',
    description:
      'Controls whether Zoneless performs automatic collection of the invoice. If <code>false</code>, the invoice’s state doesn’t automatically advance without an explicit action.',
  },
  {
    name: 'billing_reason',
    type: 'enum',
    nullable: true,
    description: 'Indicates the reason why the invoice was created.',
    enumValues: [
      { value: 'automatic_pending_invoice_item_invoice' },
      {
        value: 'manual',
        description:
          'Unrelated to a subscription, for example created via the API or Dashboard.',
      },
      { value: 'quote_accept' },
      { value: 'subscription' },
      {
        value: 'subscription_create',
        description: 'A new subscription was created.',
      },
      {
        value: 'subscription_cycle',
        description: 'A subscription advanced into a new period.',
      },
      {
        value: 'subscription_threshold',
        description: 'A subscription reached a billing threshold.',
      },
      {
        value: 'subscription_update',
        description: 'A subscription was updated.',
      },
      { value: 'upcoming' },
    ],
  },
  {
    name: 'collection_method',
    type: 'enum',
    description:
      'Either <code>charge_automatically</code> or <code>send_invoice</code>. When charging automatically, Zoneless attempts to pay this invoice using the default payment method attached to the customer. When sending an invoice, Zoneless emails the customer with payment instructions.',
    enumValues: [
      {
        value: 'charge_automatically',
        description:
          'Attempt payment using the default payment method attached to the customer.',
      },
      {
        value: 'send_invoice',
        description: 'Email payment instructions to the customer.',
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
    name: 'currency',
    type: 'enum',
    description:
      'Three-letter currency code, in lowercase. For Zoneless, this is <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Uses <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
  },
  {
    name: 'customer',
    type: 'string',
    tooltip: EXPAND_TOOLTIP,
    description: 'The ID of the customer to bill.',
  },
  {
    name: 'customer_email',
    type: 'string',
    nullable: true,
    description:
      'The customer’s email. Until the invoice is finalized, this field equals <code>customer.email</code>. Once finalized, it is no longer updated.',
  },
  {
    name: 'customer_name',
    type: 'string',
    nullable: true,
    description:
      'The customer’s name. Until the invoice is finalized, this field equals <code>customer.name</code>. Once finalized, it is no longer updated.',
  },
  {
    name: 'description',
    type: 'string',
    nullable: true,
    description:
      'An arbitrary string attached to the object. Often useful for displaying to users. Referenced as “memo” in the Dashboard.',
  },
  {
    name: 'due_date',
    type: 'timestamp',
    nullable: true,
    description:
      'The date on which payment for this invoice is due. This value is <code>null</code> for invoices where <code>collection_method=charge_automatically</code>.',
  },
  {
    name: 'hosted_invoice_url',
    type: 'string',
    nullable: true,
    description:
      'The URL for the hosted invoice page, which allows customers to view and pay an invoice. <code>null</code> if the invoice has not been finalized yet.',
  },
  {
    name: 'invoice_pdf',
    type: 'string',
    nullable: true,
    description:
      'The link to download the PDF for the invoice. <code>null</code> if the invoice has not been finalized yet.',
  },
  {
    name: 'lines',
    type: 'object',
    description:
      'The individual line items that make up the invoice. Sorted as: (1) pending invoice items (including prorations) in reverse chronological order, (2) subscription items in reverse chronological order, and (3) invoice items added after invoice creation in chronological order.',
    expandable: true,
    children: [
      {
        name: 'object',
        type: 'string',
        description:
          'String representing the object’s type. Always has the value <code>list</code>.',
      },
      {
        name: 'data',
        type: 'array of objects',
        description: 'Details about each line item.',
        expandable: true,
        children: LINE_ITEM_CHILDREN,
      },
      {
        name: 'has_more',
        type: 'boolean',
        description:
          'True if this list has another page of items after this one that can be fetched.',
      },
      {
        name: 'total_count',
        type: 'integer',
        description: 'Total number of line items on the invoice.',
      },
      {
        name: 'url',
        type: 'string',
        description: 'The URL where this list can be accessed.',
      },
    ],
  },
  {
    name: 'livemode',
    type: 'boolean',
    description:
      'Has the value <code>true</code> if the object exists in live mode or the value <code>false</code> if the object exists in test mode.',
  },
  {
    name: 'metadata',
    type: 'object',
    nullable: true,
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'number',
    type: 'string',
    nullable: true,
    description:
      'A unique, identifying string that appears on emails sent to the customer for this invoice. Starts with the customer’s unique <code>invoice_prefix</code> if it is specified.',
  },
  {
    name: 'status',
    type: 'enum',
    nullable: true,
    description:
      'The status of the invoice, one of <code>draft</code>, <code>open</code>, <code>paid</code>, <code>uncollectible</code>, or <code>void</code>.',
    enumValues: [
      { value: 'draft' },
      { value: 'open' },
      { value: 'paid' },
      { value: 'uncollectible' },
      { value: 'void' },
    ],
  },
  {
    name: 'status_transitions',
    type: 'object',
    description: 'The timestamps at which the invoice status was updated.',
    expandable: true,
    children: [
      {
        name: 'finalized_at',
        type: 'timestamp',
        nullable: true,
        description: 'The time that the invoice draft was finalized.',
      },
      {
        name: 'marked_uncollectible_at',
        type: 'timestamp',
        nullable: true,
        description: 'The time that the invoice was marked uncollectible.',
      },
      {
        name: 'paid_at',
        type: 'timestamp',
        nullable: true,
        description: 'The time that the invoice was paid.',
      },
      {
        name: 'voided_at',
        type: 'timestamp',
        nullable: true,
        description: 'The time that the invoice was voided.',
      },
    ],
  },
  {
    name: 'subtotal',
    type: 'integer',
    description:
      'Total of all subscriptions, invoice items, and prorations on the invoice before any invoice-level discount or exclusive tax is applied. Item discounts are already incorporated.',
  },
  {
    name: 'total',
    type: 'integer',
    description: 'Total after discounts and taxes.',
  },
];

const INVOICE_MORE_ATTRIBUTES: Attribute[] = [
  {
    name: 'account_tax_ids',
    type: 'array of strings',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The account tax IDs associated with the invoice. Only editable when the invoice is a draft.',
  },
  {
    name: 'amount_paid_off_stripe',
    type: 'integer',
    description:
      'Amount, in the smallest currency unit, that was paid on the invoice outside of Zoneless.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Field name is retained for API parity; the value represents amounts paid outside of Zoneless.',
  },
  {
    name: 'amount_shipping',
    type: 'integer',
    description: 'The sum of all shipping amounts on the invoice.',
  },
  {
    name: 'application',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'ID of the Connect application that created the invoice.',
  },
  {
    name: 'automatic_tax',
    type: 'object',
    description:
      'Settings and latest results for automatic tax lookup for this invoice.',
    expandable: true,
    children: [
      {
        name: 'disabled_reason',
        type: 'enum',
        nullable: true,
        description:
          'If Zoneless disabled automatic tax, this enum describes why.',
        enumValues: [
          { value: 'finalization_requires_location_inputs' },
          { value: 'finalization_system_error' },
        ],
      },
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Whether Zoneless automatically computes tax on this invoice.',
      },
      {
        name: 'liability',
        type: 'object',
        nullable: true,
        description: 'The account that’s liable for tax.',
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
      {
        name: 'provider',
        type: 'string',
        nullable: true,
        description: 'The tax provider powering automatic tax.',
      },
      {
        name: 'status',
        type: 'enum',
        nullable: true,
        description:
          'The status of the most recent automated tax calculation for this invoice.',
        enumValues: [
          { value: 'complete' },
          { value: 'failed' },
          { value: 'requires_location_inputs' },
        ],
      },
    ],
  },
  {
    name: 'automatically_finalizes_at',
    type: 'timestamp',
    nullable: true,
    description:
      'The time when this invoice is currently scheduled to be automatically finalized. <code>null</code> if the invoice is not scheduled to finalize, or if it is no longer in draft.',
  },
  {
    name: 'confirmation_secret',
    type: 'object',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The confirmation secret associated with this invoice. Contains the <code>client_secret</code> of the PaymentIntent created during invoice finalization.',
    expandable: true,
    children: [
      {
        name: 'client_secret',
        type: 'string',
        description:
          'The client secret of the payment created for the invoice after finalization.',
      },
      {
        name: 'type',
        type: 'string',
        description:
          'The type of client secret. Currently always <code>payment_intent</code>.',
      },
    ],
  },
  {
    name: 'custom_fields',
    type: 'array of objects',
    nullable: true,
    description: 'Custom fields displayed on the invoice.',
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
    name: 'customer_account',
    type: 'string',
    nullable: true,
    description: 'The ID of the account representing the customer to bill.',
  },
  {
    name: 'customer_address',
    type: 'object',
    nullable: true,
    description:
      'The customer’s address. Until the invoice is finalized, this field equals <code>customer.address</code>. Once finalized, it is no longer updated.',
    expandable: true,
    children: ADDRESS_CHILDREN,
  },
  {
    name: 'customer_phone',
    type: 'string',
    nullable: true,
    description:
      'The customer’s phone number. Until the invoice is finalized, this field equals <code>customer.phone</code>. Once finalized, it is no longer updated.',
  },
  {
    name: 'customer_shipping',
    type: 'object',
    nullable: true,
    description:
      'The customer’s shipping information. Until the invoice is finalized, this field equals <code>customer.shipping</code>. Once finalized, it is no longer updated.',
    expandable: true,
    children: SHIPPING_DETAILS_CHILDREN,
  },
  {
    name: 'customer_tax_exempt',
    type: 'enum',
    nullable: true,
    description:
      'The customer’s tax exempt status. Until the invoice is finalized, this field equals <code>customer.tax_exempt</code>. Once finalized, it is no longer updated.',
    enumValues: [{ value: 'exempt' }, { value: 'none' }, { value: 'reverse' }],
  },
  {
    name: 'customer_tax_ids',
    type: 'array of objects',
    nullable: true,
    description:
      'The customer’s tax IDs. Until the invoice is finalized, this field contains the same tax IDs as <code>customer.tax_ids</code>. Once finalized, it is no longer updated.',
    expandable: true,
    children: [
      {
        name: 'type',
        type: 'string',
        description:
          'The type of the tax ID (e.g. <code>us_ein</code>, <code>eu_vat</code>).',
        enumNote:
          '<strong>Difference from Stripe:</strong> Stripe supports 100+ country-specific tax ID types. Zoneless keeps this as a plain string for maintainability.',
      },
      {
        name: 'value',
        type: 'string',
        nullable: true,
        description: 'The value of the tax ID.',
      },
    ],
  },
  {
    name: 'default_payment_method',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the default payment method for the invoice. It must belong to the customer associated with the invoice.',
  },
  {
    name: 'default_source',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the default payment source for the invoice. It must belong to the customer associated with the invoice and be in a chargeable state.',
  },
  {
    name: 'default_tax_rates',
    type: 'array of objects',
    description: 'The tax rates applied to this invoice, if any.',
  },
  {
    name: 'discounts',
    type: 'array of strings',
    tooltip: EXPAND_TOOLTIP,
    description:
      'The discounts applied to the invoice. Line item discounts are applied before invoice discounts. Use <code>expand[]=discounts</code> to expand each discount.',
  },
  {
    name: 'effective_at',
    type: 'timestamp',
    nullable: true,
    description:
      'The date when this invoice is in effect. Same as <code>finalized_at</code> unless overwritten. When defined, this value replaces the system-generated “Date of issue” printed on the invoice PDF and receipt.',
  },
  {
    name: 'ending_balance',
    type: 'integer',
    nullable: true,
    description:
      'Ending customer balance after the invoice is finalized. <code>null</code> if the invoice has not been finalized yet.',
  },
  {
    name: 'footer',
    type: 'string',
    nullable: true,
    description: 'Footer displayed on the invoice.',
  },
  {
    name: 'from_invoice',
    type: 'object',
    nullable: true,
    description: 'Details of the invoice that was cloned for a revision.',
    expandable: true,
    children: [
      {
        name: 'action',
        type: 'string',
        description:
          'The relation between this invoice and the cloned invoice.',
      },
      {
        name: 'invoice',
        type: 'string',
        tooltip: EXPAND_TOOLTIP,
        description: 'The invoice that was cloned.',
      },
    ],
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
  {
    name: 'last_finalization_error',
    type: 'object',
    nullable: true,
    description:
      'The error encountered during the previous attempt to finalize the invoice. Cleared when the invoice is successfully finalized.',
    expandable: true,
    children: [
      {
        name: 'code',
        type: 'string',
        nullable: true,
        description:
          'For some errors that could be handled programmatically, a short string indicating the error code reported.',
      },
      {
        name: 'doc_url',
        type: 'string',
        nullable: true,
        description: 'A URL to more information about the error code reported.',
      },
      {
        name: 'message',
        type: 'string',
        nullable: true,
        description:
          'A human-readable message providing more details about the error.',
      },
      {
        name: 'param',
        type: 'string',
        nullable: true,
        description:
          'If the error is parameter-specific, the parameter related to the error.',
      },
      {
        name: 'type',
        type: 'enum',
        description: 'The type of error returned.',
        enumValues: [
          { value: 'api_error' },
          { value: 'card_error' },
          { value: 'idempotency_error' },
          { value: 'invalid_request_error' },
        ],
      },
    ],
  },
  {
    name: 'latest_revision',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The ID of the most recent non-draft revision of this invoice.',
  },
  {
    name: 'next_payment_attempt',
    type: 'timestamp',
    nullable: true,
    description:
      'The time at which payment will next be attempted. <code>null</code> for invoices where <code>collection_method=send_invoice</code>.',
  },
  {
    name: 'on_behalf_of',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The account (if any) for which the funds of the invoice payment are intended. If set, the invoice is presented with the branding and support information of the specified account.',
  },
  {
    name: 'parent',
    type: 'object',
    nullable: true,
    description: 'The parent that generated this invoice.',
    expandable: true,
    children: [
      {
        name: 'quote_details',
        type: 'object',
        nullable: true,
        description: 'Details about the quote that generated this invoice.',
        expandable: true,
        children: [
          {
            name: 'quote',
            type: 'string',
            description: 'The quote that generated this invoice.',
          },
        ],
      },
      {
        name: 'subscription_details',
        type: 'object',
        nullable: true,
        description:
          'Details about the subscription that generated this invoice.',
        expandable: true,
        children: [
          {
            name: 'metadata',
            type: 'object',
            nullable: true,
            description:
              'Subscription metadata snapshotted when the invoice is created. Becomes immutable at finalization.',
          },
          {
            name: 'subscription',
            type: 'string',
            tooltip: EXPAND_TOOLTIP,
            description: 'The subscription that generated this invoice.',
          },
          {
            name: 'subscription_proration_date',
            type: 'timestamp',
            nullable: true,
            description:
              'Only set for upcoming invoices that preview prorations. The time used to calculate prorations.',
          },
        ],
      },
      {
        name: 'type',
        type: 'enum',
        description: 'The type of parent that generated this invoice.',
        enumValues: [
          {
            value: 'quote_details',
            description:
              'Details of the parent can be found in the <code>quote_details</code> hash.',
          },
          {
            value: 'subscription_details',
            description:
              'Details of the parent can be found in the <code>subscription_details</code> hash.',
          },
        ],
      },
    ],
  },
  {
    name: 'payment_settings',
    type: 'object',
    description:
      'Configuration settings for payment collection when the invoice is finalized.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless only accepts USDC wallet payments, so only the <code>crypto</code> payment method options bag is exposed.',
    expandable: true,
    children: PAYMENT_SETTINGS_CHILDREN,
  },
  {
    name: 'payments',
    type: 'object',
    tooltip: EXPAND_TOOLTIP,
    description: 'Payments for this invoice.',
    expandable: true,
    children: [
      {
        name: 'object',
        type: 'string',
        description:
          'String representing the object’s type. Always has the value <code>list</code>.',
      },
      {
        name: 'data',
        type: 'array of objects',
        description: 'Details about each invoice payment.',
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
    name: 'period_end',
    type: 'timestamp',
    description:
      'The latest timestamp at which invoice items can be associated with this invoice. Use the line item period to get the service period for each price.',
  },
  {
    name: 'period_start',
    type: 'timestamp',
    description:
      'The earliest timestamp at which invoice items can be associated with this invoice. Use the line item period to get the service period for each price.',
  },
  {
    name: 'post_payment_credit_notes_amount',
    type: 'integer',
    description:
      'Total amount of all post-payment credit notes issued for this invoice.',
  },
  {
    name: 'pre_payment_credit_notes_amount',
    type: 'integer',
    description:
      'Total amount of all pre-payment credit notes issued for this invoice.',
  },
  {
    name: 'receipt_number',
    type: 'string',
    nullable: true,
    description:
      'The transaction number that appears on email receipts sent for this invoice.',
  },
  {
    name: 'rendering',
    type: 'object',
    nullable: true,
    description:
      'The rendering-related settings that control how the invoice is displayed on customer-facing surfaces such as PDF and Hosted Invoice Page.',
    expandable: true,
    children: RENDERING_CHILDREN,
  },
  {
    name: 'shipping_cost',
    type: 'object',
    nullable: true,
    description:
      'The details of the cost of shipping, including the shipping rate applied on the invoice.',
    expandable: true,
    children: [
      {
        name: 'amount_subtotal',
        type: 'integer',
        description: 'Total shipping cost before any taxes are applied.',
      },
      {
        name: 'amount_tax',
        type: 'integer',
        description:
          'Total tax amount applied due to shipping costs. Defaults to 0 if no tax was applied.',
      },
      {
        name: 'amount_total',
        type: 'integer',
        description: 'Total shipping cost after taxes are applied.',
      },
      {
        name: 'shipping_rate',
        type: 'string',
        nullable: true,
        tooltip: EXPAND_TOOLTIP,
        description: 'The ID of the shipping rate for this invoice.',
      },
    ],
  },
  {
    name: 'shipping_details',
    type: 'object',
    nullable: true,
    description:
      'Shipping details for the invoice. The invoice PDF uses <code>shipping_details</code> if set; otherwise it renders the shipping address from the customer.',
    expandable: true,
    children: SHIPPING_DETAILS_CHILDREN,
  },
  {
    name: 'starting_balance',
    type: 'integer',
    description:
      'Starting customer balance before the invoice is finalized. If the invoice has not been finalized yet, this is the current customer balance.',
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    nullable: true,
    description:
      'Extra information about an invoice shown on the customer’s payment statement or receipt.',
  },
  {
    name: 'subtotal_excluding_tax',
    type: 'integer',
    nullable: true,
    description:
      'The integer amount in the smallest currency unit representing the subtotal of the invoice before any invoice-level discount or tax is applied. Item discounts are already incorporated.',
  },
  {
    name: 'test_clock',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'ID of the test clock this invoice belongs to.',
  },
  {
    name: 'threshold_reason',
    type: 'object',
    nullable: true,
    description:
      'If <code>billing_reason</code> is <code>subscription_threshold</code>, this returns more information on which threshold rules triggered the invoice.',
    expandable: true,
    children: [
      {
        name: 'amount_gte',
        type: 'integer',
        nullable: true,
        description:
          'The total invoice amount threshold boundary if it triggered the threshold invoice.',
      },
      {
        name: 'item_reasons',
        type: 'array of objects',
        description:
          'Indicates which line items triggered a threshold invoice.',
        expandable: true,
        children: [
          {
            name: 'line_item_ids',
            type: 'array of strings',
            description:
              'The IDs of the line items that triggered the threshold invoice.',
          },
          {
            name: 'usage_gte',
            type: 'integer',
            description:
              'The quantity threshold boundary that applied to the given line item.',
          },
        ],
      },
    ],
  },
  {
    name: 'total_discount_amounts',
    type: 'array of objects',
    nullable: true,
    description:
      'The aggregate amounts calculated per discount across all line items.',
    expandable: true,
    children: [
      {
        name: 'amount',
        type: 'integer',
        description:
          'The amount, in the smallest currency unit, of the discount.',
      },
      {
        name: 'discount',
        type: 'string',
        tooltip: EXPAND_TOOLTIP,
        description:
          'The discount that was applied to get this discount amount.',
      },
    ],
  },
  {
    name: 'total_excluding_tax',
    type: 'integer',
    nullable: true,
    description:
      'The integer amount in the smallest currency unit representing the total amount of the invoice including all discounts but excluding all tax.',
  },
  {
    name: 'total_pretax_credit_amounts',
    type: 'array of objects',
    nullable: true,
    description:
      'Pretax credit amounts (for example discounts or credit grants) that apply to this invoice, combined across all invoice line items.',
  },
  {
    name: 'total_taxes',
    type: 'array of objects',
    nullable: true,
    description: 'The aggregate tax information of all line items.',
  },
  {
    name: 'transfer_data',
    type: 'object',
    nullable: true,
    description:
      'The account (if any) the payment will be attributed to for tax reporting, and where funds from the payment will be transferred to.',
    expandable: true,
    children: [
      {
        name: 'amount',
        type: 'integer',
        nullable: true,
        description:
          'The amount that will be transferred automatically when the invoice is paid. If no amount is set, the full amount is transferred.',
      },
      {
        name: 'destination',
        type: 'string',
        description:
          'The account where funds from the payment will be transferred upon payment success.',
      },
    ],
  },
  {
    name: 'webhooks_delivered_at',
    type: 'timestamp',
    nullable: true,
    description:
      'Invoices are automatically paid or sent after webhooks are delivered, or until all webhook delivery attempts have been exhausted. This field tracks when webhooks for this invoice were successfully delivered. If the invoice had no webhooks to deliver, this is set while the invoice is being created.',
  },
  {
    name: 'platform_account',
    type: 'string',
    description:
      'The platform account that owns this resource. For connected account resources, this is the platform’s account ID. For the platform’s own resources, this equals the account field (self-referential).',
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It enables multi-tenant operation.",
  },
];

// ============================================
// Overview
// ============================================

export const INVOICES_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Invoice object',
  description:
    'Invoices are statements of amounts owed by a customer. They are generated one-off, or periodically from a subscription. They contain invoice items and proration adjustments that may be caused by subscription upgrades or downgrades. Invoices settle in USDC on Solana. If your invoice is configured for automatic collection, Zoneless finalizes the invoice and attempts payment after webhooks are delivered. If configured for send_invoice, Zoneless emails the customer with a link to the hosted invoice page. Any customer credit balance is applied before determining the amount due.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoices',
  endpoints: BuildEndpointSummaries(INVOICES_SUBSECTION, [
    { method: 'POST', path: '/v1/invoices', pageId: 'create' },
    { method: 'POST', path: '/v1/invoices/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/invoices/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/invoices', pageId: 'list' },
    { method: 'DELETE', path: '/v1/invoices/:id', pageId: 'delete' },
    { method: 'POST', path: '/v1/invoices/:id/finalize', pageId: 'finalize' },
    {
      method: 'POST',
      path: '/v1/invoices/:id/mark_uncollectible',
      pageId: 'mark_uncollectible',
    },
    { method: 'POST', path: '/v1/invoices/:id/pay', pageId: 'pay' },
    { method: 'POST', path: '/v1/invoices/:id/void', pageId: 'void' },
  ]),
  events: GetResourceEventAttributes('invoice'),
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: INVOICE_ATTRIBUTES,
          moreAttributes: INVOICE_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE INVOICE OBJECT',
          code: INVOICE_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create
// ============================================

const CREATE_INVOICE_PARAMETERS: Attribute[] = [
  {
    name: 'customer',
    type: 'string',
    required: true,
    requiredText: 'Required unless from_invoice is provided',
    description: 'The ID of the customer to bill.',
  },
  {
    name: 'collection_method',
    type: 'enum',
    description:
      'Either <code>charge_automatically</code> or <code>send_invoice</code>. When charging automatically, Zoneless attempts to pay this invoice using the default payment method attached to the customer. When sending an invoice, Zoneless emails the customer with payment instructions. Defaults to <code>charge_automatically</code>.',
    enumValues: [{ value: 'charge_automatically' }, { value: 'send_invoice' }],
  },
  {
    name: 'currency',
    type: 'enum',
    description:
      'The currency to create this invoice in. Defaults to that of <code>customer</code> if not specified. For Zoneless, use <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Use <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
  },

  {
    name: 'description',
    type: 'string',
    description:
      'An arbitrary string attached to the object. Often useful for displaying to users. Referenced as “memo” in the Dashboard.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
];

const CREATE_INVOICE_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'account_tax_ids',
    type: 'array of strings',
    description:
      'The account tax IDs associated with the invoice. Only editable when the invoice is a draft.',
  },
  {
    name: 'application_fee_amount',
    type: 'integer',
    description:
      'A fee in the smallest currency unit that will be applied to the invoice and transferred to the application owner’s account. The request must be made with an OAuth key or the Zoneless-Account header in order to take an application fee.',
  },
  {
    name: 'auto_advance',
    type: 'boolean',
    description:
      'Controls whether Zoneless performs automatic collection of the invoice. If <code>false</code>, the invoice’s state doesn’t automatically advance without an explicit action. Defaults to <code>false</code>.',
  },
  {
    name: 'automatic_tax',
    type: 'object',
    description: 'Settings for automatic tax lookup for this invoice.',
    expandable: true,
    children: AUTOMATIC_TAX_PARAM_CHILDREN,
  },
  {
    name: 'automatically_finalizes_at',
    type: 'timestamp',
    description:
      'The time when this invoice should be scheduled to finalize (up to 5 years in the future). The invoice is finalized at this time if it’s still in draft state.',
  },
  {
    name: 'custom_fields',
    type: 'array of objects',
    description:
      'A list of up to 4 custom fields to be displayed on the invoice.',
    expandable: true,
    children: CUSTOM_FIELD_CHILDREN,
  },
  {
    name: 'customer_account',
    type: 'string',
    description: 'The ID of the account to bill.',
  },
  {
    name: 'days_until_due',
    type: 'integer',
    description:
      'The number of days from when the invoice is created until it is due. Valid only for invoices where <code>collection_method=send_invoice</code>.',
  },
  {
    name: 'default_payment_method',
    type: 'string',
    description:
      'ID of the default payment method for the invoice. It must belong to the customer associated with the invoice.',
  },
  {
    name: 'default_source',
    type: 'string',
    description:
      'ID of the default payment source for the invoice. It must belong to the customer associated with the invoice and be in a chargeable state.',
  },
  {
    name: 'default_tax_rates',
    type: 'array of strings',
    description:
      'The tax rates that will apply to any line item that does not have <code>tax_rates</code> set.',
  },
  {
    name: 'discounts',
    type: 'array of objects',
    description:
      'The coupons and promotion codes to redeem into discounts for the invoice. If not specified, inherits the discount from the invoice’s customer. Pass an empty string to avoid inheriting any discounts.',
    expandable: true,
    children: DISCOUNT_PARAM_CHILDREN,
  },
  {
    name: 'due_date',
    type: 'timestamp',
    description:
      'The date on which payment for this invoice is due. Valid only for invoices where <code>collection_method=send_invoice</code>.',
  },
  {
    name: 'effective_at',
    type: 'timestamp',
    description:
      'The date when this invoice is in effect. Same as <code>finalized_at</code> unless overwritten. When defined, this value replaces the system-generated “Date of issue” printed on the invoice PDF and receipt.',
  },
  {
    name: 'footer',
    type: 'string',
    description: 'Footer to be displayed on the invoice.',
  },
  {
    name: 'from_invoice',
    type: 'object',
    required: true,
    requiredText: 'Required unless customer is provided',
    description:
      'Revise an existing invoice. The new invoice will be created in <code>status=draft</code>.',
    expandable: true,
    children: [
      {
        name: 'action',
        type: 'string',
        required: true,
        description:
          'The relation between the new invoice and the original invoice. Currently, only <code>revision</code> is permitted.',
      },
      {
        name: 'invoice',
        type: 'string',
        required: true,
        description: 'The <code>id</code> of the invoice that will be cloned.',
      },
    ],
  },
  {
    name: 'issuer',
    type: 'object',
    description:
      'The connected account that issues the invoice. The invoice is presented with the branding and support information of the specified account.',
    expandable: true,
    children: ISSUER_CHILDREN,
  },
  {
    name: 'number',
    type: 'string',
    description:
      'Set the number for this invoice. If no number is present then a number will be assigned automatically when the invoice is finalized. Maximum length is 26 characters.',
  },
  {
    name: 'on_behalf_of',
    type: 'string',
    description:
      'The account (if any) for which the funds of the invoice payment are intended. If set, the invoice is presented with the branding and support information of the specified account.',
  },
  {
    name: 'payment_settings',
    type: 'object',
    description:
      'Configuration settings for payment collection when the invoice is finalized.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless only accepts USDC wallet payments, so only the <code>crypto</code> payment method options bag is exposed.',
    expandable: true,
    children: PAYMENT_SETTINGS_CHILDREN,
  },
  {
    name: 'pending_invoice_items_behavior',
    type: 'enum',
    description:
      'How to handle pending invoice items on invoice creation. Defaults to <code>exclude</code> if the parameter is omitted.',
    enumValues: [
      {
        value: 'exclude',
        description:
          'Always create an empty invoice draft regardless of whether there are pending invoice items.',
      },
      {
        value: 'include',
        description:
          'Include any pending invoice items, and create an empty draft invoice if no pending invoice items exist.',
      },
    ],
  },
  {
    name: 'rendering',
    type: 'object',
    description:
      'The rendering-related settings that control how the invoice is displayed on customer-facing surfaces such as PDF and Hosted Invoice Page.',
    expandable: true,
    children: RENDERING_CHILDREN,
  },
  {
    name: 'shipping_cost',
    type: 'object',
    description: 'Settings for the cost of shipping for this invoice.',
    expandable: true,
    children: SHIPPING_COST_PARAM_CHILDREN,
  },
  {
    name: 'shipping_details',
    type: 'object',
    description:
      'Shipping details for the invoice. The invoice PDF uses <code>shipping_details</code> if set; otherwise it renders the shipping address from the customer.',
    expandable: true,
    children: SHIPPING_DETAILS_PARAM_CHILDREN,
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    description:
      'Extra information about a charge for the customer’s payment statement or receipt. It must contain at least one letter.',
  },
  {
    name: 'subscription',
    type: 'string',
    description:
      'The ID of the subscription to invoice, if any. If set, the created invoice will only include pending invoice items for that subscription. The subscription’s billing cycle and regular subscription events won’t be affected.',
  },
  {
    name: 'transfer_data',
    type: 'object',
    description:
      'If specified, the funds from the invoice will be transferred to the destination and the ID of the resulting transfer will be found on the invoice’s charge.',
    expandable: true,
    children: TRANSFER_DATA_CHILDREN,
  },
];

export const INVOICES_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create an invoice',
  description:
    'This endpoint creates a draft invoice for a given customer. The invoice remains a draft until you finalize the invoice, which allows you to pay or send the invoice to your customers.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoices/create',
  endpoints: [{ method: 'POST', path: '/v1/invoices' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_INVOICE_PARAMETERS,
          moreAttributes: CREATE_INVOICE_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the invoice object. Raises an error if the customer ID provided is invalid.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/invoices' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/invoices \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d customer=cus_z_TpL8wQkR3nVmY`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const invoice = await zoneless.invoices.create({
  customer: 'cus_z_TpL8wQkR3nVmY',
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: INVOICE_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Update
// ============================================

const UPDATE_INVOICE_PARAMETERS: Attribute[] = [
  {
    name: 'auto_advance',
    type: 'boolean',
    description:
      'Controls whether Zoneless performs automatic collection of the invoice.',
  },
  {
    name: 'collection_method',
    type: 'enum',
    description:
      'Either <code>charge_automatically</code> or <code>send_invoice</code>. This field can be updated only on <code>draft</code> invoices.',
    enumValues: [{ value: 'charge_automatically' }, { value: 'send_invoice' }],
  },
  {
    name: 'description',
    type: 'string',
    description:
      'An arbitrary string attached to the object. Often useful for displaying to users. Referenced as “memo” in the Dashboard.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
];

const UPDATE_INVOICE_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'account_tax_ids',
    type: 'array of strings',
    description:
      'The account tax IDs associated with the invoice. Only editable when the invoice is a draft.',
  },
  {
    name: 'application_fee_amount',
    type: 'integer',
    description:
      'A fee in the smallest currency unit that will be applied to the invoice and transferred to the application owner’s account.',
  },
  {
    name: 'automatic_tax',
    type: 'object',
    description: 'Settings for automatic tax lookup for this invoice.',
    expandable: true,
    children: AUTOMATIC_TAX_PARAM_CHILDREN,
  },
  {
    name: 'automatically_finalizes_at',
    type: 'timestamp',
    description:
      'The time when this invoice should be scheduled to finalize (up to 5 years in the future). The invoice is finalized at this time if it’s still in draft state. To turn off automatic finalization, set <code>auto_advance</code> to <code>false</code>.',
  },
  {
    name: 'custom_fields',
    type: 'array of objects',
    description:
      'A list of up to 4 custom fields to be displayed on the invoice. If a value for <code>custom_fields</code> is specified, the list specified replaces the existing custom field list on this invoice. Pass an empty string to remove previously-defined fields.',
    expandable: true,
    children: CUSTOM_FIELD_CHILDREN,
  },
  {
    name: 'days_until_due',
    type: 'integer',
    description:
      'The number of days from which the invoice is created until it is due. Only valid for invoices where <code>collection_method=send_invoice</code>. This field can only be updated on <code>draft</code> invoices.',
  },
  {
    name: 'default_payment_method',
    type: 'string',
    description:
      'ID of the default payment method for the invoice. It must belong to the customer associated with the invoice.',
  },
  {
    name: 'default_source',
    type: 'string',
    description:
      'ID of the default payment source for the invoice. It must belong to the customer associated with the invoice and be in a chargeable state.',
  },
  {
    name: 'default_tax_rates',
    type: 'array of strings',
    description:
      'The tax rates that will apply to any line item that does not have <code>tax_rates</code> set. Pass an empty string to remove previously-defined tax rates.',
  },
  {
    name: 'discounts',
    type: 'array of objects',
    description:
      'The discounts that will apply to the invoice. Pass an empty string to remove previously-defined discounts.',
    expandable: true,
    children: DISCOUNT_PARAM_CHILDREN,
  },
  {
    name: 'due_date',
    type: 'timestamp',
    description:
      'The date on which payment for this invoice is due. Only valid for invoices where <code>collection_method=send_invoice</code>. This field can only be updated on <code>draft</code> invoices.',
  },
  {
    name: 'effective_at',
    type: 'timestamp',
    description:
      'The date when this invoice is in effect. Same as <code>finalized_at</code> unless overwritten. When defined, this value replaces the system-generated “Date of issue” printed on the invoice PDF and receipt.',
  },
  {
    name: 'footer',
    type: 'string',
    description: 'Footer to be displayed on the invoice.',
  },
  {
    name: 'issuer',
    type: 'object',
    description:
      'The connected account that issues the invoice. The invoice is presented with the branding and support information of the specified account.',
    expandable: true,
    children: ISSUER_CHILDREN,
  },
  {
    name: 'number',
    type: 'string',
    description:
      'Set the number for this invoice. If no number is present then a number will be assigned automatically when the invoice is finalized. Maximum length is 26 characters.',
  },
  {
    name: 'on_behalf_of',
    type: 'string',
    description:
      'The account (if any) for which the funds of the invoice payment are intended. If set, the invoice is presented with the branding and support information of the specified account.',
  },
  {
    name: 'payment_settings',
    type: 'object',
    description:
      'Configuration settings for payment collection when the invoice is finalized.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless only accepts USDC wallet payments, so only the <code>crypto</code> payment method options bag is exposed.',
    expandable: true,
    children: PAYMENT_SETTINGS_CHILDREN,
  },
  {
    name: 'rendering',
    type: 'object',
    description:
      'The rendering-related settings that control how the invoice is displayed on customer-facing surfaces such as PDF and Hosted Invoice Page.',
    expandable: true,
    children: RENDERING_CHILDREN,
  },
  {
    name: 'shipping_cost',
    type: 'object',
    description: 'Settings for the cost of shipping for this invoice.',
    expandable: true,
    children: SHIPPING_COST_PARAM_CHILDREN,
  },
  {
    name: 'shipping_details',
    type: 'object',
    description:
      'Shipping details for the invoice. The invoice PDF uses <code>shipping_details</code> if set; otherwise it renders the shipping address from the customer.',
    expandable: true,
    children: SHIPPING_DETAILS_PARAM_CHILDREN,
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    description:
      'Extra information about a charge for the customer’s payment statement or receipt. It must contain at least one letter.',
  },
  {
    name: 'transfer_data',
    type: 'object',
    description:
      'If specified, the funds from the invoice will be transferred to the destination. Pass an empty string to unset.',
    expandable: true,
    children: TRANSFER_DATA_CHILDREN,
  },
];

export const INVOICES_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update an invoice',
  description:
    'Draft invoices are fully editable. Once an invoice is finalized, monetary values, as well as collection_method, become uneditable. If you would like to stop Zoneless from automatically finalizing, reattempting payments on, or sending reminders for invoices, pass auto_advance=false.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoices/update',
  endpoints: [{ method: 'POST', path: '/v1/invoices/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_INVOICE_PARAMETERS,
          moreAttributes: UPDATE_INVOICE_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the invoice object.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/invoices/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/invoices/in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[order_id]"=9284`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const invoice = await zoneless.invoices.update(
  'in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c',
  {
    metadata: {
      order_id: '9284',
    },
  }
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: INVOICE_UPDATED_JSON },
      ],
    },
  ],
};

// ============================================
// Retrieve
// ============================================

export const INVOICES_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve an invoice',
  description: 'Retrieves the invoice with the given ID.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoices/retrieve',
  endpoints: [{ method: 'GET', path: '/v1/invoices/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns an invoice object if a valid invoice ID was provided. Raises an error otherwise. The invoice object contains a <code>lines</code> hash with subscriptions and invoice items applied to the invoice, as well as any prorations Zoneless has automatically calculated. The invoice also has a <code>next_payment_attempt</code> attribute that tells you the next time payment will be automatically attempted. For invoices with manual payment collection, that have been closed, or that have reached the maximum number of retries, <code>next_payment_attempt</code> is <code>null</code>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/invoices/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/invoices/in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const invoice = await zoneless.invoices.retrieve(
  'in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: INVOICE_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// List
// ============================================

const LIST_INVOICES_PARAMETERS: Attribute[] = [
  {
    name: 'customer',
    type: 'string',
    description:
      'Only return invoices for the customer specified by this customer ID.',
  },
  {
    name: 'status',
    type: 'enum',
    description:
      'The status of the invoice, one of <code>draft</code>, <code>open</code>, <code>paid</code>, <code>uncollectible</code>, or <code>void</code>.',
    enumValues: [
      { value: 'draft' },
      { value: 'open' },
      { value: 'paid' },
      { value: 'uncollectible' },
      { value: 'void' },
    ],
  },
  {
    name: 'subscription',
    type: 'string',
    description:
      'Only return invoices for the subscription specified by this subscription ID.',
  },
  {
    name: 'limit',
    type: 'integer',
    description:
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
  },
];

const LIST_INVOICES_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'collection_method',
    type: 'enum',
    description:
      'The collection method of the invoice to retrieve. Either <code>charge_automatically</code> or <code>send_invoice</code>.',
    enumValues: [{ value: 'charge_automatically' }, { value: 'send_invoice' }],
  },
  {
    name: 'created',
    type: 'object',
    description:
      'Only return invoices that were created during the given date interval.',
    expandable: true,
    children: TIMESTAMP_RANGE_CHILDREN,
  },
  {
    name: 'customer_account',
    type: 'string',
    description:
      'Only return invoices for the account representing the customer specified by this account ID.',
  },
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>obj_bar</code>, your subsequent call can include <code>ending_before=obj_bar</code> in order to fetch the previous page of the list.',
  },
  {
    name: 'starting_after',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>obj_foo</code>, your subsequent call can include <code>starting_after=obj_foo</code> in order to fetch the next page of the list.',
  },
];

export const INVOICES_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all invoices',
  description:
    'You can list all invoices, or list the invoices for a specific customer. The invoices are returned sorted by creation date, with the most recently created invoices appearing first.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoices/list',
  endpoints: [{ method: 'GET', path: '/v1/invoices' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_INVOICES_PARAMETERS,
          moreAttributes: LIST_INVOICES_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> invoices, starting after invoice <code>starting_after</code>. Each entry in the array is a separate invoice object. If no more invoices are available, the resulting array is empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/invoices' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/invoices \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const invoices = await zoneless.invoices.list({
  limit: 3,
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: LIST_INVOICES_JSON },
      ],
    },
  ],
};

// ============================================
// Delete
// ============================================

export const INVOICES_DELETE_PAGE: DocPage = {
  id: 'delete',
  title: 'Delete a draft invoice',
  description:
    'Permanently deletes a one-off invoice draft. This cannot be undone. Attempts to delete invoices that are no longer in a draft state will fail; once an invoice has been finalized or if an invoice is for a subscription, it must be voided.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoices/delete',
  endpoints: [{ method: 'DELETE', path: '/v1/invoices/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A successfully deleted invoice. Otherwise, this call raises an error, such as if the invoice has already been deleted.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'DELETE', path: '/v1/invoices/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X DELETE https://api.yourdomain.com/v1/invoices/in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const deleted = await zoneless.invoices.del(
  'in_z_1RvK8pQ2eZvKYlo2Hn4mWx9c'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: INVOICE_DELETED_JSON },
      ],
    },
  ],
};

// ============================================
// Finalize
// ============================================

const FINALIZE_INVOICE_PARAMETERS: Attribute[] = [
  {
    name: 'auto_advance',
    type: 'boolean',
    description:
      'Controls whether Zoneless performs automatic collection of the invoice. If <code>false</code>, the invoice’s state doesn’t automatically advance without an explicit action.',
  },
];

export const INVOICES_FINALIZE_PAGE: DocPage = {
  id: 'finalize',
  title: 'Finalize an invoice',
  description:
    'Zoneless automatically finalizes drafts before sending and attempting payment on invoices. However, if you’d like to finalize a draft invoice manually, you can do so using this method.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoices/finalize',
  endpoints: [{ method: 'POST', path: '/v1/invoices/:id/finalize' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: FINALIZE_INVOICE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns an invoice object with <code>status=open</code> (or <code>paid</code> if the amount due is zero).',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/invoices/:id/finalize' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/invoices/in_z_1RvK9aH3fZwLXmp3Jo5nXy0d/finalize \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -X POST`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const invoice = await zoneless.invoices.finalizeInvoice(
  'in_z_1RvK9aH3fZwLXmp3Jo5nXy0d'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: INVOICE_FINALIZED_JSON },
      ],
    },
  ],
};

// ============================================
// Mark uncollectible
// ============================================

export const INVOICES_MARK_UNCOLLECTIBLE_PAGE: DocPage = {
  id: 'mark_uncollectible',
  title: 'Mark an invoice as uncollectible',
  description:
    'Marking an invoice as uncollectible is useful for keeping track of bad debts that can be written off for accounting purposes.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoices/mark_uncollectible',
  endpoints: [{ method: 'POST', path: '/v1/invoices/:id/mark_uncollectible' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the invoice object.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'POST',
            path: '/v1/invoices/:id/mark_uncollectible',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/invoices/in_z_1RvJ4mN1dYuKXkn2Gi3lVw8b/mark_uncollectible \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -X POST`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const invoice = await zoneless.invoices.markUncollectible(
  'in_z_1RvJ4mN1dYuKXkn2Gi3lVw8b'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: INVOICE_UNCOLLECTIBLE_JSON },
      ],
    },
  ],
};

// ============================================
// Pay
// ============================================

const PAY_INVOICE_PARAMETERS: Attribute[] = [
  {
    name: 'paid_out_of_band',
    type: 'boolean',
    description:
      'Boolean representing whether an invoice is paid outside of Zoneless. This results in no on-chain collection being made. Defaults to <code>false</code>.',
  },
  {
    name: 'payment_method',
    type: 'string',
    description:
      'A PaymentMethod to be charged. The PaymentMethod must belong to the customer associated with the invoice being paid.',
  },
  {
    name: 'settlement_signature',
    type: 'string',
    description:
      'When set, skip on-chain collect and record settlement with this Solana transaction signature (for example, when checkout already collected the first period).',
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API.",
  },
];

const PAY_INVOICE_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'forgive',
    type: 'boolean',
    description:
      'In cases where the source used to pay the invoice has insufficient funds, passing <code>forgive=true</code> controls whether a charge should be attempted for the full amount available on the source, up to the amount to fully pay the invoice. Passing <code>forgive=false</code> fails the charge if the source hasn’t been pre-funded with the right amount. Defaults to <code>false</code>.',
  },
  {
    name: 'mandate',
    type: 'string',
    description:
      'ID of the mandate to be used for this invoice. It must correspond to the payment method used to pay the invoice, including the <code>payment_method</code> param or the invoice’s <code>default_payment_method</code> or <code>default_source</code>, if set.',
  },
  {
    name: 'off_session',
    type: 'boolean',
    description:
      'Indicates if a customer is on or off-session while an invoice payment is attempted. Defaults to <code>true</code> (off-session).',
  },
  {
    name: 'source',
    type: 'string',
    description:
      'A payment source to be charged. The source must belong to the customer associated with the invoice being paid.',
  },
];

export const INVOICES_PAY_PAGE: DocPage = {
  id: 'pay',
  title: 'Pay an invoice',
  description:
    'Zoneless automatically creates and then attempts to collect payment on invoices for customers on subscriptions according to your billing settings. However, if you’d like to attempt payment on an invoice outside of the normal collection schedule, you can do so with this endpoint. Collection settles in USDC on Solana.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoices/pay',
  endpoints: [{ method: 'POST', path: '/v1/invoices/:id/pay' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: PAY_INVOICE_PARAMETERS,
          moreAttributes: PAY_INVOICE_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the invoice object.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/invoices/:id/pay' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/invoices/in_z_1RvK9aH3fZwLXmp3Jo5nXy0d/pay \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -X POST`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const invoice = await zoneless.invoices.pay(
  'in_z_1RvK9aH3fZwLXmp3Jo5nXy0d'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: INVOICE_FINALIZED_JSON },
      ],
    },
  ],
};

// ============================================
// Void
// ============================================

export const INVOICES_VOID_PAGE: DocPage = {
  id: 'void',
  title: 'Void an invoice',
  description:
    'Mark a finalized invoice as void. This cannot be undone. Voiding an invoice is similar to deletion, however it only applies to finalized invoices and maintains a papertrail where the invoice can still be found. Consult with local regulations to determine whether and how an invoice might be amended, canceled, or voided in the jurisdiction you’re doing business in. You might need to issue another invoice or a credit note instead.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoices/void',
  endpoints: [{ method: 'POST', path: '/v1/invoices/:id/void' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the voided invoice object.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/invoices/:id/void' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/invoices/in_z_1RvK9aH3fZwLXmp3Jo5nXy0d/void \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -X POST`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const invoice = await zoneless.invoices.voidInvoice(
  'in_z_1RvK9aH3fZwLXmp3Jo5nXy0d'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: INVOICE_VOIDED_JSON },
      ],
    },
  ],
};

export const INVOICES_PAGES: DocPage[] = [
  INVOICES_OVERVIEW_PAGE,
  INVOICES_CREATE_PAGE,
  INVOICES_UPDATE_PAGE,
  INVOICES_RETRIEVE_PAGE,
  INVOICES_LIST_PAGE,
  INVOICES_DELETE_PAGE,
  INVOICES_FINALIZE_PAGE,
  INVOICES_MARK_UNCOLLECTIBLE_PAGE,
  INVOICES_PAY_PAGE,
  INVOICES_VOID_PAGE,
];
