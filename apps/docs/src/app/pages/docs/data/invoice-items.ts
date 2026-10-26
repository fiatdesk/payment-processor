import { DocSubSection, DocPage, Attribute } from './types';
import { NODE_INIT, EXPAND_TOOLTIP, BuildEndpointSummaries } from './shared';
import { GetResourceEventAttributes } from './event-types';

export const INVOICE_ITEMS_SUBSECTION: DocSubSection = {
  id: 'invoiceitems',
  title: 'Invoice Items',
  children: [
    { id: 'object', title: 'The Invoice Item object' },
    { id: 'create', title: 'Create an invoice item' },
    { id: 'update', title: 'Update an invoice item' },
    { id: 'retrieve', title: 'Retrieve an invoice item' },
    { id: 'list', title: 'List all invoice items' },
    { id: 'delete', title: 'Delete an invoice item' },
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

const PERIOD_CHILDREN: Attribute[] = [
  {
    name: 'end',
    type: 'timestamp',
    required: true,
    description:
      'The end of the period, which must be greater than or equal to the start. This value is inclusive.',
  },
  {
    name: 'start',
    type: 'timestamp',
    required: true,
    description: 'The start of the period. This value is inclusive.',
  },
];

const PRICE_DATA_CHILDREN: Attribute[] = [
  {
    name: 'currency',
    type: 'enum',
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
    description: 'The ID of the product that this price will belong to.',
  },
  {
    name: 'tax_behavior',
    type: 'enum',
    description:
      'Specifies whether the price is considered inclusive of taxes or exclusive of taxes. One of <code>inclusive</code>, <code>exclusive</code>, or <code>unspecified</code>. Once specified as either <code>inclusive</code> or <code>exclusive</code>, it cannot be changed.',
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
      'A positive integer in the smallest currency unit (or 0 for a free price) representing how much to charge. For USDC, this is cents (e.g., 100 = $1 USDC).',
  },
  {
    name: 'unit_amount_decimal',
    type: 'string',
    required: true,
    requiredText: 'Required unless unit_amount is provided',
    description:
      'Same as <code>unit_amount</code>, but accepts a decimal value in the smallest currency unit with at most 12 decimal places. Only one of <code>unit_amount</code> and <code>unit_amount_decimal</code> can be set.',
  },
];

const TAX_RATE_CHILDREN: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description: 'Unique identifier for the object.',
  },
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value.",
  },
  {
    name: 'active',
    type: 'boolean',
    description:
      'Defaults to <code>true</code>. When set to <code>false</code>, this tax rate cannot be used with new applications, but will still work for subscriptions and invoices that already have it set.',
  },
  {
    name: 'country',
    type: 'string',
    nullable: true,
    description: 'Two-letter country code (ISO 3166-1 alpha-2).',
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Time at which the object was created. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'description',
    type: 'string',
    nullable: true,
    description:
      'An arbitrary string attached to the tax rate for your internal use only. It will not be visible to your customers.',
  },
  {
    name: 'display_name',
    type: 'string',
    description:
      'The display name of the tax rate as it will appear to your customer on their receipt email, PDF, and the hosted invoice page.',
  },
  {
    name: 'inclusive',
    type: 'boolean',
    description: 'Whether this tax rate is inclusive or exclusive.',
  },
  {
    name: 'jurisdiction',
    type: 'string',
    nullable: true,
    description:
      "The jurisdiction for the tax rate. You can use this label field for tax reporting purposes. It also appears on your customer's invoice.",
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
    name: 'percentage',
    type: 'float',
    description: 'Tax rate percentage out of 100.',
  },
  {
    name: 'state',
    type: 'string',
    nullable: true,
    description:
      'ISO 3166-2 subdivision code, without country prefix. For example, “NY” for New York, United States.',
  },
  {
    name: 'tax_type',
    type: 'string',
    nullable: true,
    description:
      'The high-level tax type, such as <code>vat</code> or <code>sales_tax</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Stripe supports many jurisdiction-specific <code>tax_type</code> values. Zoneless keeps this as a plain string for maintainability.',
  },
];

// ============================================
// Shared Data
// ============================================

const INVOICE_ITEM_OBJECT_JSON = `{
  "id": "ii_z_1QfGHtLkdIwHu7ixBYwjAM42",
  "object": "invoiceitem",
  "amount": 2500,
  "currency": "usdc",
  "customer": "cus_z_KmR4eUfNV2Hib",
  "customer_account": null,
  "date": 1721415600,
  "created": 1721415600,
  "description": "Studio license",
  "discountable": true,
  "discounts": [],
  "invoice": null,
  "livemode": false,
  "metadata": {},
  "net_amount": null,
  "parent": null,
  "period": {
    "end": 1721415600,
    "start": 1721415600
  },
  "pricing": {
    "price_details": {
      "price": "price_z_1QfGHsLkdIwHu7ix1be5Ljaj",
      "product": "prod_z_KmR47xbBdJT8EN"
    },
    "type": "price_details",
    "unit_amount_decimal": "2500"
  },
  "proration": false,
  "proration_details": null,
  "quantity": 1,
  "quantity_decimal": "1",
  "tax_rates": [],
  "test_clock": null,
  "platform_account": "acct_z_Platform123abc"
}`;

const INVOICE_ITEM_UPDATED_JSON = `{
  "id": "ii_z_1QfGHtLkdIwHu7ixBYwjAM42",
  "object": "invoiceitem",
  "amount": 2500,
  "currency": "usdc",
  "customer": "cus_z_KmR4eUfNV2Hib",
  "customer_account": null,
  "date": 1721415600,
  "created": 1721415600,
  "description": "Studio license",
  "discountable": true,
  "discounts": [],
  "invoice": null,
  "livemode": false,
  "metadata": {
    "order_id": "9284"
  },
  "net_amount": null,
  "parent": null,
  "period": {
    "end": 1721415600,
    "start": 1721415600
  },
  "pricing": {
    "price_details": {
      "price": "price_z_1QfGHsLkdIwHu7ix1be5Ljaj",
      "product": "prod_z_KmR47xbBdJT8EN"
    },
    "type": "price_details",
    "unit_amount_decimal": "2500"
  },
  "proration": false,
  "proration_details": null,
  "quantity": 1,
  "quantity_decimal": "1",
  "tax_rates": [],
  "test_clock": null,
  "platform_account": "acct_z_Platform123abc"
}`;

const INVOICE_ITEM_DELETED_JSON = `{
  "id": "ii_z_1QfGHtLkdIwHu7ixBYwjAM42",
  "object": "invoiceitem",
  "deleted": true
}`;

const LIST_INVOICE_ITEMS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/invoiceitems",
  "has_more": false,
  "data": [
    {
      "id": "ii_z_1QfGHtLkdIwHu7ixBYwjAM42",
      "object": "invoiceitem",
      "amount": 2500,
      "currency": "usdc",
      "customer": "cus_z_KmR4eUfNV2Hib",
      "customer_account": null,
      "date": 1721415600,
      "created": 1721415600,
      "description": "Studio license",
      "discountable": true,
      "discounts": [],
      "invoice": null,
      "livemode": false,
      "metadata": {},
      "net_amount": null,
      "parent": null,
      "period": {
        "end": 1721415600,
        "start": 1721415600
      },
      "pricing": {
        "price_details": {
          "price": "price_z_1QfGHsLkdIwHu7ix1be5Ljaj",
          "product": "prod_z_KmR47xbBdJT8EN"
        },
        "type": "price_details",
        "unit_amount_decimal": "2500"
      },
      "proration": false,
      "proration_details": null,
      "quantity": 1,
      "quantity_decimal": "1",
      "tax_rates": [],
      "test_clock": null,
      "platform_account": "acct_z_Platform123abc"
    }
  ]
}`;

// ============================================
// Object Attributes
// ============================================

const INVOICE_ITEM_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless invoice item IDs are prefixed with <code>ii_z_</code>.',
  },
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value.",
  },
  {
    name: 'amount',
    type: 'integer',
    description:
      'Amount (in the <code>currency</code> specified) of the invoice item. This should always be equal to <code>unit_amount * quantity</code>. For USDC, this is cents (e.g., 100 = $1 USDC).',
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
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The ID of the customer to bill for this invoice item. <code>null</code> when using <code>customer_account</code>.',
  },
  {
    name: 'customer_account',
    type: 'string',
    nullable: true,
    description: 'The ID of the account to bill for this invoice item.',
  },
  {
    name: 'date',
    type: 'timestamp',
    description:
      'Time at which the object was created. Measured in seconds since the Unix epoch.',
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
      'If true, discounts will apply to this invoice item. Always false for prorations.',
  },
  {
    name: 'discounts',
    type: 'array of strings',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The discounts which apply to the invoice item. Item discounts are applied before invoice discounts. Use <code>expand[]=discounts</code> to expand each discount.',
  },
  {
    name: 'invoice',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'The ID of the invoice this invoice item belongs to.',
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
    name: 'period',
    type: 'object',
    description:
      'The period associated with this invoice item. When set to different values, the period will be rendered on the invoice.',
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
    description: 'The pricing information of the invoice item.',
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
    name: 'proration',
    type: 'boolean',
    description:
      'Whether the invoice item was created automatically as a proration adjustment when the customer switched plans.',
  },
  {
    name: 'quantity',
    type: 'integer',
    description:
      "Quantity of units for the invoice item in integer format, with any decimal precision truncated. For the item's full-precision decimal quantity, use <code>quantity_decimal</code>. This field will be deprecated in favor of <code>quantity_decimal</code> in a future version. If the invoice item is a proration, the quantity of the subscription that the proration was computed for.",
  },
  {
    name: 'quantity_decimal',
    type: 'decimal string',
    description:
      'Non-negative decimal with at most 12 decimal places. The quantity of units for the invoice item.',
  },
];

const INVOICE_ITEM_MORE_ATTRIBUTES: Attribute[] = [
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Creation timestamp used for list ordering and <code>created</code> filters. Mirrors <code>date</code>.',
    enumNote:
      "<strong>Zoneless extension:</strong> Stripe's invoice item object exposes <code>date</code> only. Zoneless also returns <code>created</code> for consistency with other list filters.",
  },
  {
    name: 'net_amount',
    type: 'integer',
    nullable: true,
    description:
      'The amount after discounts, but before credits and taxes. This field is <code>null</code> for <code>discountable=true</code> items.',
  },
  {
    name: 'parent',
    type: 'object',
    nullable: true,
    description: 'The parent that generated this invoice item.',
    expandable: true,
    children: [
      {
        name: 'subscription_details',
        type: 'object',
        nullable: true,
        description:
          'Details about the subscription that generated this invoice item.',
        expandable: true,
        children: [
          {
            name: 'subscription',
            type: 'string',
            description: 'The subscription that generated this invoice item.',
          },
          {
            name: 'subscription_item',
            type: 'string',
            nullable: true,
            description:
              'The subscription item that generated this invoice item.',
          },
        ],
      },
      {
        name: 'type',
        type: 'enum',
        description: 'The type of parent that generated this invoice item.',
        enumValues: [
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
    name: 'proration_details',
    type: 'object',
    nullable: true,
    description:
      'Contains information about proration items. This field is only populated for prorations created from subscriptions with <code>billing_mode=flexible</code>.',
    expandable: true,
    children: [
      {
        name: 'credited_items',
        type: 'object',
        nullable: true,
        description:
          'For a credit proration, links to the debit invoice line items or invoice item that the credit applies to.',
        expandable: true,
        children: [
          {
            name: 'invoice_item',
            type: 'string',
            nullable: true,
            description:
              'When <code>type</code> is <code>invoice_item</code>, the invoice item ID for the debited invoice item corresponding to this credit proration.',
          },
          {
            name: 'invoice_line_item_details',
            type: 'object',
            nullable: true,
            description:
              'When <code>type</code> is <code>invoice_line_items</code>, the invoice and the debited invoice line item(s) on that invoice corresponding to this credit proration.',
            expandable: true,
            children: [
              {
                name: 'invoice',
                type: 'string',
                description: 'The invoice ID for the debited line item(s).',
              },
              {
                name: 'invoice_line_items',
                type: 'array of strings',
                description:
                  'IDs of the debited invoice line item(s) on the invoice that correspond to the credit proration.',
              },
            ],
          },
          {
            name: 'type',
            type: 'enum',
            description:
              'Whether the credit references a pending invoice item or one or more invoice line items on an invoice.',
            enumValues: [
              { value: 'invoice_item' },
              { value: 'invoice_line_items' },
            ],
          },
        ],
      },
      {
        name: 'discount_amounts',
        type: 'array of objects',
        description: 'Discount amounts applied when the proration was created.',
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
    ],
  },
  {
    name: 'tax_rates',
    type: 'array of strings',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The tax rates which apply to the invoice item. When set, the <code>default_tax_rates</code> on the invoice do not apply to this invoice item. Use <code>expand[]=tax_rates</code> to expand each tax rate.',
    expandable: true,
    children: TAX_RATE_CHILDREN,
  },
  {
    name: 'test_clock',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'ID of the test clock this invoice item belongs to.',
  },
  {
    name: 'platform_account',
    type: 'string',
    description:
      "The platform account that owns this resource. For connected account resources, this is the platform's account ID. For the platform's own resources, this equals the account field (self-referential).",
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It enables multi-tenant operation.",
  },
];

// ============================================
// Overview
// ============================================

export const INVOICE_ITEMS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Invoice Item object',
  description:
    "Invoice Items represent the component lines of an invoice. When you create an invoice item with an invoice field, it is attached to the specified invoice and included as an invoice line item within invoice.lines. Invoice items can be created before you are ready to send the invoice, which is useful with subscriptions when you want to add a charge or credit that settles with the customer's wallet at the end of a billing cycle.",
  stripeDocsUrl: 'https://docs.stripe.com/api/invoiceitems',
  endpoints: BuildEndpointSummaries(INVOICE_ITEMS_SUBSECTION, [
    { method: 'POST', path: '/v1/invoiceitems', pageId: 'create' },
    { method: 'POST', path: '/v1/invoiceitems/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/invoiceitems/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/invoiceitems', pageId: 'list' },
    { method: 'DELETE', path: '/v1/invoiceitems/:id', pageId: 'delete' },
  ]),
  events: GetResourceEventAttributes('invoiceitem'),
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: INVOICE_ITEM_ATTRIBUTES,
          moreAttributes: INVOICE_ITEM_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE INVOICE ITEM OBJECT',
          code: INVOICE_ITEM_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create
// ============================================

const CREATE_INVOICE_ITEM_PARAMETERS: Attribute[] = [
  {
    name: 'customer',
    type: 'string',
    required: true,
    requiredText: 'Required unless customer_account is provided',
    description: 'The ID of the customer to bill for this invoice item.',
  },
  {
    name: 'customer_account',
    type: 'string',
    required: true,
    requiredText: 'Required unless customer is provided',
    description:
      'The ID of the account representing the customer to bill for this invoice item.',
  },
  {
    name: 'amount',
    type: 'integer',
    description:
      'The integer amount in the smallest currency unit of the charge to be applied to the upcoming invoice. Passing in a negative <code>amount</code> will reduce the <code>amount_due</code> on the invoice. For USDC, this is cents (e.g., 100 = $1 USDC).',
  },
  {
    name: 'currency',
    type: 'enum',
    description:
      'Three-letter currency code, in lowercase. For Zoneless, use <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Use <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
  },
  {
    name: 'description',
    type: 'string',
    description:
      'An arbitrary string which you can attach to the invoice item. The description is displayed in the invoice for easy tracking.',
  },
  {
    name: 'pricing',
    type: 'object',
    description: 'The pricing information for the invoice item.',
    expandable: true,
    children: [
      {
        name: 'price',
        type: 'string',
        description: 'The ID of the price object.',
      },
    ],
  },
  {
    name: 'quantity',
    type: 'integer',
    description:
      'Non-negative integer. The quantity of units for the invoice item. Use <code>quantity_decimal</code> instead to provide decimal precision. This field will be deprecated in favor of <code>quantity_decimal</code> in a future version.',
  },
];

const CREATE_INVOICE_ITEM_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'discountable',
    type: 'boolean',
    description:
      'Controls whether discounts apply to this invoice item. Defaults to false for prorations or negative invoice items, and true for all other invoice items.',
  },
  {
    name: 'discounts',
    type: 'array of objects',
    description:
      'The coupons and promotion codes to redeem into discounts for the invoice item or invoice line item. Exactly one of <code>coupon</code>, <code>discount</code>, or <code>promotion_code</code> must be specified per entry.',
    expandable: true,
    children: DISCOUNT_PARAM_CHILDREN,
  },
  {
    name: 'invoice',
    type: 'string',
    description:
      'The ID of an existing invoice to add this invoice item to. For subscription invoices, when left blank, the invoice item will be added to the next upcoming scheduled invoice. You can only add invoice items to draft invoices, and there is a maximum of 250 items per invoice.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'period',
    type: 'object',
    description:
      'The period associated with this invoice item. When set to different values, the period will be rendered on the invoice.',
    expandable: true,
    children: PERIOD_CHILDREN,
  },
  {
    name: 'price_data',
    type: 'object',
    description: 'Data used to generate a new Price object inline.',
    expandable: true,
    children: PRICE_DATA_CHILDREN,
  },
  {
    name: 'quantity_decimal',
    type: 'string',
    description:
      'Non-negative decimal with at most 12 decimal places. The quantity of units for the invoice item.',
  },
  {
    name: 'subscription',
    type: 'string',
    description:
      'The ID of a subscription to add this invoice item to. When left blank, the invoice item is added to the next upcoming scheduled invoice. When set, scheduled invoices for subscriptions other than the specified subscription will ignore the invoice item.',
  },
  {
    name: 'tax_behavior',
    type: 'enum',
    description:
      'Specifies whether the price is considered inclusive of taxes or exclusive of taxes. One of <code>inclusive</code>, <code>exclusive</code>, or <code>unspecified</code>. Once specified as either <code>inclusive</code> or <code>exclusive</code>, it cannot be changed.',
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
  {
    name: 'tax_rates',
    type: 'array of strings',
    description:
      'The tax rates which apply to the invoice item. When set, the <code>default_tax_rates</code> on the invoice do not apply to this invoice item.',
  },
  {
    name: 'unit_amount_decimal',
    type: 'string',
    description:
      'The decimal unit amount in the smallest currency unit of the charge to be applied to the upcoming invoice. This <code>unit_amount_decimal</code> will be multiplied by the quantity to get the full amount. Passing in a negative <code>unit_amount_decimal</code> will reduce the <code>amount_due</code> on the invoice. Accepts at most 12 decimal places.',
  },
];

export const INVOICE_ITEMS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create an invoice item',
  description:
    'Creates an item to be added to a draft invoice (up to 250 items per invoice). If no invoice is specified, the item will be on the next invoice created for the customer specified.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoiceitems/create',
  endpoints: [{ method: 'POST', path: '/v1/invoiceitems' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_INVOICE_ITEM_PARAMETERS,
          moreAttributes: CREATE_INVOICE_ITEM_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'The created invoice item object is returned if successful. Otherwise, this call raises an error.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/invoiceitems' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/invoiceitems \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d customer=cus_z_KmR4eUfNV2Hib \\
  -d "pricing[price]"=price_z_1QfGHsLkdIwHu7ix1be5Ljaj`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const invoiceItem = await zoneless.invoiceItems.create({
  customer: 'cus_z_KmR4eUfNV2Hib',
  pricing: {
    price: 'price_z_1QfGHsLkdIwHu7ix1be5Ljaj',
  },
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: INVOICE_ITEM_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Update
// ============================================

const UPDATE_INVOICE_ITEM_PARAMETERS: Attribute[] = [
  {
    name: 'amount',
    type: 'integer',
    description:
      "The integer amount in the smallest currency unit of the charge to be applied to the upcoming invoice. If you want to apply a credit to the customer's account, pass a negative amount.",
  },
  {
    name: 'description',
    type: 'string',
    description:
      'An arbitrary string which you can attach to the invoice item. The description is displayed in the invoice for easy tracking.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'pricing',
    type: 'object',
    description: 'The pricing information for the invoice item.',
    expandable: true,
    children: [
      {
        name: 'price',
        type: 'string',
        description: 'The ID of the price object.',
      },
    ],
  },
  {
    name: 'quantity',
    type: 'integer',
    description:
      'Non-negative integer. The quantity of units for the invoice item. Use <code>quantity_decimal</code> instead to provide decimal precision. This field will be deprecated in favor of <code>quantity_decimal</code> in a future version.',
  },
];

const UPDATE_INVOICE_ITEM_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'discountable',
    type: 'boolean',
    description:
      'Controls whether discounts apply to this invoice item. Defaults to false for prorations or negative invoice items, and true for all other invoice items. Cannot be set to true for prorations.',
  },
  {
    name: 'discounts',
    type: 'array of objects',
    description:
      'The coupons, promotion codes, and existing discounts which apply to the invoice item or invoice line item. Item discounts are applied before invoice discounts. Pass an empty string to remove previously-defined discounts. Exactly one of <code>coupon</code>, <code>discount</code>, or <code>promotion_code</code> must be specified per entry.',
    expandable: true,
    children: DISCOUNT_PARAM_CHILDREN,
  },
  {
    name: 'period',
    type: 'object',
    description:
      'The period associated with this invoice item. When set to different values, the period will be rendered on the invoice.',
    expandable: true,
    children: PERIOD_CHILDREN,
  },
  {
    name: 'price_data',
    type: 'object',
    description: 'Data used to generate a new Price object inline.',
    expandable: true,
    children: PRICE_DATA_CHILDREN,
  },
  {
    name: 'quantity_decimal',
    type: 'string',
    description:
      'Non-negative decimal with at most 12 decimal places. The quantity of units for the line item.',
  },
  {
    name: 'tax_behavior',
    type: 'enum',
    description:
      'Specifies whether the price is considered inclusive of taxes or exclusive of taxes. One of <code>inclusive</code>, <code>exclusive</code>, or <code>unspecified</code>. Once specified as either <code>inclusive</code> or <code>exclusive</code>, it cannot be changed.',
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
  {
    name: 'tax_rates',
    type: 'array of strings',
    description:
      'The tax rates which apply to the invoice item. When set, the <code>default_tax_rates</code> on the invoice do not apply to this invoice item. Pass an empty string to remove previously-defined tax rates.',
  },
  {
    name: 'unit_amount_decimal',
    type: 'string',
    description:
      'The decimal unit amount in the smallest currency unit of the charge to be applied to the upcoming invoice. This <code>unit_amount_decimal</code> will be multiplied by the quantity to get the full amount. Passing in a negative <code>unit_amount_decimal</code> will reduce the <code>amount_due</code> on the invoice. Accepts at most 12 decimal places.',
  },
];

export const INVOICE_ITEMS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update an invoice item',
  description:
    "Updates the amount or description of an invoice item on an upcoming invoice. Updating an invoice item is only possible before the invoice it's attached to is closed.",
  stripeDocsUrl: 'https://docs.stripe.com/api/invoiceitems/update',
  endpoints: [{ method: 'POST', path: '/v1/invoiceitems/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_INVOICE_ITEM_PARAMETERS,
          moreAttributes: UPDATE_INVOICE_ITEM_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'The updated invoice item object is returned upon success. Otherwise, this call raises an error.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/invoiceitems/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/invoiceitems/ii_z_1QfGHtLkdIwHu7ixBYwjAM42 \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[order_id]"=9284`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const invoiceItem = await zoneless.invoiceItems.update(
  'ii_z_1QfGHtLkdIwHu7ixBYwjAM42',
  {
    metadata: {
      order_id: '9284',
    },
  }
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: INVOICE_ITEM_UPDATED_JSON },
      ],
    },
  ],
};

// ============================================
// Retrieve
// ============================================

export const INVOICE_ITEMS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve an invoice item',
  description: 'Retrieves the invoice item with the given ID.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoiceitems/retrieve',
  endpoints: [{ method: 'GET', path: '/v1/invoiceitems/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns an invoice item if a valid invoice item ID was provided. Raises an error otherwise.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/invoiceitems/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/invoiceitems/ii_z_1QfGHtLkdIwHu7ixBYwjAM42 \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const invoiceItem = await zoneless.invoiceItems.retrieve(
  'ii_z_1QfGHtLkdIwHu7ixBYwjAM42'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: INVOICE_ITEM_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// List
// ============================================

const LIST_INVOICE_ITEMS_PARAMETERS: Attribute[] = [
  {
    name: 'customer',
    type: 'string',
    description:
      'The identifier of the customer whose invoice items to return. If none is provided, returns all invoice items.',
  },
  {
    name: 'invoice',
    type: 'string',
    description:
      'Only return invoice items belonging to this invoice. If none is provided, all invoice items will be returned. If specifying an invoice, no customer identifier is needed.',
  },
  {
    name: 'limit',
    type: 'integer',
    description:
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
  },
  {
    name: 'pending',
    type: 'boolean',
    description:
      'Set to <code>true</code> to only show pending invoice items, which are not yet attached to any invoices. Set to <code>false</code> to only show invoice items already attached to invoices. If unspecified, no filter is applied.',
  },
];

const LIST_INVOICE_ITEMS_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'created',
    type: 'object',
    description:
      'Only return invoice items that were created during the given date interval.',
    expandable: true,
    children: TIMESTAMP_RANGE_CHILDREN,
  },
  {
    name: 'customer_account',
    type: 'string',
    description:
      'The identifier of the account representing the customer whose invoice items to return. If none is provided, returns all invoice items.',
  },
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>ii_z_bar</code>, your subsequent call can include <code>ending_before=ii_z_bar</code> in order to fetch the previous page of the list.',
  },
  {
    name: 'starting_after',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>ii_z_foo</code>, your subsequent call can include <code>starting_after=ii_z_foo</code> in order to fetch the next page of the list.',
  },
];

export const INVOICE_ITEMS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all invoice items',
  description:
    'Returns a list of your invoice items. Invoice items are returned sorted by creation date, with the most recently created invoice items appearing first.',
  stripeDocsUrl: 'https://docs.stripe.com/api/invoiceitems/list',
  endpoints: [{ method: 'GET', path: '/v1/invoiceitems' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_INVOICE_ITEMS_PARAMETERS,
          moreAttributes: LIST_INVOICE_ITEMS_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> invoice items, starting after invoice item <code>starting_after</code>. Each entry in the array is a separate invoice item object. If no more invoice items are available, the resulting array will be empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/invoiceitems' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/invoiceitems \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const invoiceItems = await zoneless.invoiceItems.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_INVOICE_ITEMS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Delete
// ============================================

export const INVOICE_ITEMS_DELETE_PAGE: DocPage = {
  id: 'delete',
  title: 'Delete an invoice item',
  description:
    "Deletes an invoice item, removing it from an invoice. Deleting invoice items is only possible when they're not attached to invoices, or if they're attached to a draft invoice.",
  stripeDocsUrl: 'https://docs.stripe.com/api/invoiceitems/delete',
  endpoints: [{ method: 'DELETE', path: '/v1/invoiceitems/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: "An object with the deleted invoice item's ID and a deleted flag upon success. Otherwise, this call raises an error, such as if the invoice item has already been deleted.",
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'DELETE', path: '/v1/invoiceitems/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X DELETE https://api.yourdomain.com/v1/invoiceitems/ii_z_1QfGHtLkdIwHu7ixBYwjAM42 \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const deleted = await zoneless.invoiceItems.del(
  'ii_z_1QfGHtLkdIwHu7ixBYwjAM42'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: INVOICE_ITEM_DELETED_JSON },
      ],
    },
  ],
};

export const INVOICE_ITEMS_PAGES: DocPage[] = [
  INVOICE_ITEMS_OVERVIEW_PAGE,
  INVOICE_ITEMS_CREATE_PAGE,
  INVOICE_ITEMS_UPDATE_PAGE,
  INVOICE_ITEMS_RETRIEVE_PAGE,
  INVOICE_ITEMS_LIST_PAGE,
  INVOICE_ITEMS_DELETE_PAGE,
];
