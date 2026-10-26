import { DocSubSection, DocPage, Attribute } from './types';
import { GetResourceEventAttributes } from './event-types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const PRICES_SUBSECTION: DocSubSection = {
  id: 'prices',
  title: 'Prices',
  children: [
    { id: 'object', title: 'The Price object' },
    { id: 'create', title: 'Create a price' },
    { id: 'update', title: 'Update a price' },
    { id: 'retrieve', title: 'Retrieve a price' },
    { id: 'list', title: 'List all prices' },
  ],
};

// ============================================
// Shared Data
// ============================================
const PRICES_OBJECT_JSON = `{
  "id": "price_z_yXmLn04Bpw9Wbjx2",
  "object": "price",
  "active": true,
  "billing_scheme": "per_unit",
  "created": 1778605292,
  "currency": "usdc",
  "custom_unit_amount": null,
  "livemode": false,
  "lookup_key": null,
  "metadata": {},
  "nickname": "Pro Plan Price",
  "product": "prod_z_oJaYlHpf6YmRzCMm",
  "recurring": {
    "aggregate_usage": null,
    "interval": "month",
    "interval_count": 1,
    "trial_period_days": null,
    "usage_type": "licensed"
  },
  "tax_behavior": "unspecified",
  "tiers_mode": null,
  "transform_quantity": null,
  "type": "recurring",
  "unit_amount": 1000,
  "unit_amount_decimal": "1000"
}`;

const PRICES_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description: 'Unique identifier for the object.',
  },
  {
    name: 'active',
    type: 'boolean',
    description: 'Whether the price can be used for new purchases.',
  },
  {
    name: 'currency',
    type: 'enum',
    description:
      'ISO currency code, in lowercase. Should always be <code>usdc</code>.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'nickname',
    type: 'string',
    nullable: true,
    description: 'A brief description of the price, hidden from customers.',
  },
  {
    name: 'product',
    type: 'string',
    description: 'The ID of the product this price is associated with.',
    tooltip: {
      label: 'Expandable',
      content:
        'This can be <a href="/expanding_objects">expanded</a> into an object with the <code>expand</code> request parameter.',
    },
  },
  {
    name: 'recurring',
    type: 'object',
    nullable: true,
    description:
      'The recurring components of a price such as <code>interval</code> and <code>usage_type</code>.',
    expandable: true,
    children: [
      {
        name: 'interval',
        type: 'enum',
        description:
          'The frequency at which a subscription is billed. One of <code>day</code>, <code>week</code>, <code>month</code> or <code>year</code>.',
        enumValues: [
          { value: 'day', description: 'Billed daily.' },
          { value: 'week', description: 'Billed weekly.' },
          { value: 'month', description: 'Billed monthly.' },
          { value: 'year', description: 'Billed yearly.' },
        ],
      },
      {
        name: 'interval_count',
        type: 'number',
        description:
          'The number of intervals (specified in the <code>interval</code> attribute) between subscription billings. For example, <code>interval=month</code> and <code>interval_count=3</code> bills every 3 months.',
      },
      {
        name: 'trial_period_days',
        type: 'number',
        nullable: true,
        description:
          'The number of trial days before the customer is charged for the first time.',
      },
      {
        name: 'usage_type',
        type: 'enum',
        description:
          'Configures how the quantity per period should be determined. Can be either <code>metered</code> or <code>licensed</code>. <code>licensed</code> automatically bills the quantity set when adding it to a subscription. <code>metered</code> aggregates the total usage based on usage records. Defaults to <code>licensed</code>.',
        enumValues: [
          {
            value: 'metered',
            description: 'Usage is aggregated from usage records.',
          },
          {
            value: 'licensed',
            description: 'Bills the configured quantity automatically.',
          },
        ],
      },
      {
        name: 'meter',
        type: 'string',
        nullable: true,
        description: 'The meter tracking the usage of a metered price',
      },
    ],
  },
  {
    name: 'tax_behavior',
    type: 'enum',
    nullable: true,
    description:
      'Only required if a default tax behavior was not provided in the Stripe Tax settings. Specifies whether the price is considered inclusive of taxes or exclusive of taxes. One of <code>inclusive</code>, <code>exclusive</code>, or <code>unspecified</code>. Once specified as either <code>inclusive</code> or <code>exclusive</code>, it cannot be changed.',
    enumValues: [
      { value: 'inclusive', description: 'Tax is included in the price.' },
      { value: 'exclusive', description: 'Tax is added on top of the price.' },
      { value: 'unspecified', description: 'No explicit tax behavior is set.' },
    ],
  },
  {
    name: 'type',
    type: 'enum',
    description:
      'One of <code>one_time</code> or <code>recurring</code> depending on whether the price is for a one-time purchase or a recurring (subscription) purchase.',
    enumValues: [
      { value: 'one_time', description: 'A one-time purchase price.' },
      { value: 'recurring', description: 'A subscription (recurring) price.' },
    ],
  },
  {
    name: 'unit_amount',
    type: 'number',
    nullable: true,
    description:
      'The unit amount in the smallest currency unit to be charged, represented as a whole integer if possible. Only set if <code>billing_scheme=per_unit</code>.',
  },
];

const PRICES_MORE_ATTRIBUTES: Attribute[] = [
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value.",
  },
  {
    name: 'billing_scheme',
    type: 'enum',
    description:
      'Describes how to compute the price per period. Either <code>per_unit</code> or <code>tiered</code>. <code>per_unit</code> indicates that the fixed amount (specified in <code>unit_amount</code> or <code>unit_amount_decimal</code>) will be charged per unit in <code>quantity</code> (for prices with <code>usage_type=licensed</code>), or per unit of total usage (for prices with <code>usage_type=metered</code>). <code>tiered</code> indicates that the unit pricing will be computed using a tiering strategy as defined using the <code>tiers</code> and <code>tiers_mode</code> attributes.',
    enumValues: [
      { value: 'per_unit', description: 'A fixed amount is charged per unit.' },
      {
        value: 'tiered',
        description: 'Pricing is computed using configured tiers.',
      },
    ],
  },
  {
    name: 'created',
    type: 'number',
    description:
      'Time at which the object was created. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'currency_options',
    type: 'object',
    nullable: true,
    description:
      'Prices defined in each available currency option. Each key must be a three-letter ISO currency code and a supported currency.',
    expandable: true,
    children: [
      {
        name: 'currency_options.<currency>.custom_unit_amount',
        type: 'object',
        description:
          'When set, provides configuration for the amount to be adjusted by the customer during Checkout Sessions and Payment Links.',
        expandable: true,
        nullable: true,
        children: [
          {
            name: 'enabled',
            type: 'boolean',
            description: 'Whether the custom unit amount is enabled.',
          },
          {
            name: 'maximum',
            type: 'number',
            nullable: true,
            description:
              'The maximum unit amount the customer can specify for this item.',
          },
          {
            name: 'minimum',
            type: 'number',
            nullable: true,
            description:
              'The minimum unit amount the customer can specify for this item. Must be at least the minimum charge amount.',
          },
          {
            name: 'preset',
            type: 'number',
            nullable: true,
            description:
              'The starting unit amount which can be updated by the customer.',
          },
        ],
      },
      {
        name: 'currency_options.<currency>.tax_behavior',
        type: 'enum',
        nullable: true,
        description:
          'Only required if a default tax behavior was not provided in the Stripe Tax settings. Specifies whether the price is considered inclusive of taxes or exclusive of taxes. One of <code>inclusive</code>, <code>exclusive</code>, or <code>unspecified</code>. Once specified as either <code>inclusive</code> or <code>exclusive</code>, it cannot be changed.',
        enumValues: [
          { value: 'inclusive', description: 'Tax is included in the price.' },
          {
            value: 'exclusive',
            description: 'Tax is added on top of the price.',
          },
          {
            value: 'unspecified',
            description: 'No explicit tax behavior is set.',
          },
        ],
      },
      {
        name: 'currency_options.<currency>.tiers',
        type: 'array of objects',
        nullable: true,
        description:
          'Each element represents a pricing tier. This parameter requires <code>billing_scheme</code> to be set to <code>tiered</code>. See also the documentation for <code>billing_scheme</code>.',
        expandable: true,
        children: [
          {
            name: 'flat_amount',
            type: 'number',
            nullable: true,
            description: 'Price for the entire tier.',
          },
          {
            name: 'flat_amount_decimal',
            type: 'decimal string',
            nullable: true,
            description:
              'Same as <code>flat_amount</code>, but contains a decimal value with at most 12 decimal places.',
          },
          {
            name: 'unit_amount',
            type: 'number',
            nullable: true,
            description: 'Per unit price for units relevant to the tier.',
          },
          {
            name: 'unit_amount_decimal',
            type: 'decimal string',
            nullable: true,
            description:
              'Same as <code>unit_amount</code>, but contains a decimal value with at most 12 decimal places.',
          },
          {
            name: 'up_to',
            type: 'number',
            nullable: true,
            description:
              'Up to and including to this quantity will be contained in the tier.',
          },
        ],
      },
      {
        name: 'unit_amount',
        type: 'number',
        nullable: true,
        description:
          'The unit amount in the smallest currency unit to be charged, represented as a whole integer if possible. Only set if <code>billing_scheme=per_unit</code>.',
      },
      {
        name: 'unit_amount_decimal',
        type: 'decimal string',
        nullable: true,
        description:
          'The unit amount in the smallest currency unit to be charged, represented as a decimal string with at most 12 decimal places. Only set if <code>billing_scheme=per_unit</code>.',
      },
    ],
  },
  {
    name: 'custom_unit_amount',
    type: 'object',
    nullable: true,
    description:
      'When set, provides configuration for the amount to be adjusted by the customer during Checkout Sessions and Payment Links.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description: 'Whether the custom unit amount is enabled.',
      },
      {
        name: 'maximum',
        type: 'number',
        nullable: true,
        description:
          'The maximum unit amount the customer can specify for this item.',
      },
      {
        name: 'minimum',
        type: 'number',
        nullable: true,
        description:
          'The minimum unit amount the customer can specify for this item. Must be at least the minimum charge amount.',
      },
      {
        name: 'preset',
        type: 'number',
        nullable: true,
        description:
          'The starting unit amount which can be updated by the customer.',
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
    name: 'lookup_key',
    type: 'string',
    nullable: true,
    description:
      'A lookup key used to retrieve prices dynamically from a static string. This may be up to 200 characters.',
  },
  {
    name: 'tiers',
    type: 'array of objects',
    nullable: true,
    description:
      'Each element represents a pricing tier. This parameter requires <code>billing_scheme</code> to be set to <code>tiered</code>. See also the documentation for <code>billing_scheme</code>.',
    expandable: true,
    children: [
      {
        name: 'flat_amount',
        type: 'number',
        nullable: true,
        description: 'Price for the entire tier.',
      },
      {
        name: 'flat_amount_decimal',
        type: 'decimal string',
        nullable: true,
        description:
          'Same as flat_amount, but contains a decimal value with at most 12 decimal places.',
      },
      {
        name: 'unit_amount',
        type: 'number',
        nullable: true,
        description: 'Per unit price for units relevant to the tier.',
      },
      {
        name: 'unit_amount_decimal',
        type: 'decimal string',
        nullable: true,
        description:
          'Same as unit_amount, but contains a decimal value with at most 12 decimal places.',
      },
      {
        name: 'up_to',
        type: 'number',
        nullable: true,
        description:
          'Up to and including to this quantity will be contained in the tier.',
      },
    ],
  },
  {
    name: 'tiers_mode',
    type: 'enum',
    nullable: true,
    description:
      'Defines if the tiering price should be <code>graduated</code> or <code>volume</code> based. In volume-based tiering, the maximum quantity within a period determines the per unit price. In graduated tiering, pricing can change as the quantity grows.',
    enumValues: [
      {
        value: 'graduated',
        description: 'Pricing changes progressively as quantity increases.',
      },
      {
        value: 'volume',
        description:
          'One unit price is applied based on the maximum quantity tier reached.',
      },
    ],
  },
  {
    name: 'transform_quantity',
    type: 'object',
    nullable: true,
    description:
      'Apply a transformation to the reported usage or set quantity before computing the amount billed. Cannot be combined with <code>tiers</code>.',
    expandable: true,
    children: [
      {
        name: 'divide_by',
        type: 'number',
        description: 'Divide usage by this number.',
      },
      {
        name: 'round',
        type: 'enum',
        description:
          'After division, either round the result <code>up</code> or <code>down</code>',
        enumValues: [
          { value: 'up', description: 'Round up after division.' },
          { value: 'down', description: 'Round down after division.' },
        ],
      },
    ],
  },
  {
    name: 'unit_amount_decimal',
    type: 'decimal string',
    nullable: true,
    description:
      'The unit amount in the smallest currency unit to be charged, represented as a decimal string with at most 12 decimal places. Only set if <code>billing_scheme=per_unit</code>.',
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
// Pages
// ============================================
export const PRICES_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Price object',
  description:
    'Prices define the unit cost, currency, and (optional) billing cycle for both recurring and one-time purchases of products. Products help you track inventory or provisioning, and prices help you track payment terms. Different physical goods or levels of service should be represented by products, and pricing options should be represented by prices. This approach lets you change prices without having to change your provisioning scheme. For example, you might have a single “Pro pass" product that has prices for $10 USDC/month, $100 USDC/year, and $9 USDC once-off.',
  stripeDocsUrl: 'https://docs.stripe.com/api/prices',
  endpoints: BuildEndpointSummaries(PRICES_SUBSECTION, [
    { method: 'POST', path: '/v1/prices', pageId: 'create' },
    { method: 'POST', path: '/v1/prices/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/prices/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/prices', pageId: 'list' },
  ]),
  events: GetResourceEventAttributes('price'),
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: PRICES_ATTRIBUTES,
          moreAttributes: PRICES_MORE_ATTRIBUTES,
        },
      ],
      right: [
        { type: 'object', title: 'THE PRICE OBJECT', code: PRICES_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Create Product Parameters
// ============================================
const CREATE_PRICE_PARAMETERS: Attribute[] = [
  {
    name: 'currency',
    type: 'enum',
    required: true,
    description:
      'ISO currency code, in lowercase. Should always be <code>usdc</code>.',
  },
  {
    name: 'active',
    type: 'boolean',
    description: 'Whether the price can be used for new purchases.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'nickname',
    type: 'string',
    description: 'A brief description of the price, hidden from customers.',
  },
  {
    name: 'product',
    type: 'string',
    required: true,
    requiredText: 'Required unless product_data is provided',
    description: 'The ID of the product this price is associated with.',
  },
  {
    name: 'recurring',
    type: 'object',
    description:
      'The recurring components of a price such as <code>interval</code> and <code>usage_type</code>.',
    expandable: true,
    children: [
      {
        name: 'interval',
        type: 'enum',
        description:
          'The frequency at which a subscription is billed. One of <code>day</code>, <code>week</code>, <code>month</code> or <code>year</code>.',
        enumValues: [
          { value: 'day', description: 'Billed daily.' },
          { value: 'week', description: 'Billed weekly.' },
          { value: 'month', description: 'Billed monthly.' },
          { value: 'year', description: 'Billed yearly.' },
        ],
      },
      {
        name: 'interval_count',
        type: 'number',
        description:
          'The number of intervals (specified in the <code>interval</code> attribute) between subscription billings. For example, <code>interval=month</code> and <code>interval_count=3</code> bills every 3 months.',
      },
      {
        name: 'trial_period_days',
        type: 'number',
        description:
          'The number of trial days before the customer is charged for the first time.',
      },
      {
        name: 'usage_type',
        type: 'enum',
        description:
          'Configures how the quantity per period should be determined. Can be either <code>metered</code> or <code>licensed</code>. <code>licensed</code> automatically bills the quantity set when adding it to a subscription. <code>metered</code> aggregates the total usage based on usage records. Defaults to <code>licensed</code>.',
        enumValues: [
          {
            value: 'metered',
            description: 'Usage is aggregated from usage records.',
          },
          {
            value: 'licensed',
            description: 'Bills the configured quantity automatically.',
          },
        ],
      },
      {
        name: 'meter',
        type: 'string',
        description: 'The meter tracking the usage of a metered price',
      },
    ],
  },
  {
    name: 'tax_behavior',
    type: 'enum',
    description:
      'Only required if a default tax behavior was not provided in the Stripe Tax settings. Specifies whether the price is considered inclusive of taxes or exclusive of taxes. One of <code>inclusive</code>, <code>exclusive</code>, or <code>unspecified</code>. Once specified as either <code>inclusive</code> or <code>exclusive</code>, it cannot be changed.',
    enumValues: [
      { value: 'inclusive', description: 'Tax is included in the price.' },
      { value: 'exclusive', description: 'Tax is added on top of the price.' },
      { value: 'unspecified', description: 'No explicit tax behavior is set.' },
    ],
  },
  {
    name: 'unit_amount',
    type: 'number',
    description:
      'The unit amount in the smallest currency unit to be charged, represented as a whole integer if possible. Only set if <code>billing_scheme=per_unit</code>.',
  },
];

const CREATE_PRICE_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'billing_scheme',
    type: 'enum',
    description:
      'Describes how to compute the price per period. Either <code>per_unit</code> or <code>tiered</code>. <code>per_unit</code> indicates that the fixed amount (specified in <code>unit_amount</code> or <code>unit_amount_decimal</code>) will be charged per unit in <code>quantity</code> (for prices with <code>usage_type=licensed</code>), or per unit of total usage (for prices with <code>usage_type=metered</code>). <code>tiered</code> indicates that the unit pricing will be computed using a tiering strategy as defined using the <code>tiers</code> and <code>tiers_mode</code> attributes.',
    enumValues: [
      { value: 'per_unit', description: 'A fixed amount is charged per unit.' },
      {
        value: 'tiered',
        description: 'Pricing is computed using configured tiers.',
      },
    ],
  },
  {
    name: 'product_data',
    type: 'object',
    required: true,
    requiredText: 'Required unless product is provided',
    expandable: true,
    description:
      'These fields can be used to create a new product that this price will belong to.',
    children: [
      {
        name: 'name',
        type: 'string',
        description:
          "The product's name, meant to be displayable to the customer.",
      },
      {
        name: 'active',
        type: 'boolean',
        description: 'Whether the product is currently available for purchase.',
      },
      {
        name: 'metadata',
        type: 'object',
        description:
          'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
      },
      {
        name: 'statement_descriptor',
        type: 'string',
        description:
          'An arbitrary string to be used as a decriptor for statements.',
      },
      {
        name: 'tax_code',
        type: 'string',
        description: 'A tax code ID.',
      },
      {
        name: 'tax_details',
        type: 'object',
        description:
          '<strong>Preview feature.</strong> Tax details for this product, including the tax code and an optional performance location.',
        expandable: true,
        children: [
          {
            name: 'performance_location',
            type: 'string',
            description:
              'A tax location ID. Depending on the tax code, this is required, optional, or not supported.',
          },
          {
            name: 'tax_code',
            type: 'string',
            description: 'A tax code ID.',
          },
        ],
      },
      {
        name: 'unit_label',
        type: 'string',
        description:
          "A label that represents units of this product. When set, this will be included in customers' receipts, invoices, Checkout, and the customer portal. The maximum length is 12 characters.",
      },
    ],
  },
  {
    name: 'currency_options',
    type: 'object',
    description:
      'Prices defined in each available currency option. Each key must be a three-letter ISO currency code and a supported currency.',
    expandable: true,
    children: [
      {
        name: 'currency_options.<currency>.custom_unit_amount',
        type: 'object',
        description:
          'When set, provides configuration for the amount to be adjusted by the customer during Checkout Sessions and Payment Links.',
        expandable: true,
        children: [
          {
            name: 'enabled',
            type: 'boolean',
            description: 'Whether the custom unit amount is enabled.',
          },
          {
            name: 'maximum',
            type: 'number',
            description:
              'The maximum unit amount the customer can specify for this item.',
          },
          {
            name: 'minimum',
            type: 'number',
            description:
              'The minimum unit amount the customer can specify for this item. Must be at least the minimum charge amount.',
          },
          {
            name: 'preset',
            type: 'number',
            description:
              'The starting unit amount which can be updated by the customer.',
          },
        ],
      },
      {
        name: 'currency_options.<currency>.tax_behavior',
        type: 'enum',
        description:
          'Only required if a default tax behavior was not provided in the Stripe Tax settings. Specifies whether the price is considered inclusive of taxes or exclusive of taxes. One of <code>inclusive</code>, <code>exclusive</code>, or <code>unspecified</code>. Once specified as either <code>inclusive</code> or <code>exclusive</code>, it cannot be changed.',
        enumValues: [
          { value: 'inclusive', description: 'Tax is included in the price.' },
          {
            value: 'exclusive',
            description: 'Tax is added on top of the price.',
          },
          {
            value: 'unspecified',
            description: 'No explicit tax behavior is set.',
          },
        ],
      },
      {
        name: 'currency_options.<currency>.tiers',
        type: 'array of objects',
        description:
          'Each element represents a pricing tier. This parameter requires <code>billing_scheme</code> to be set to <code>tiered</code>. See also the documentation for <code>billing_scheme</code>.',
        expandable: true,
        children: [
          {
            name: 'flat_amount',
            type: 'number',
            description: 'Price for the entire tier.',
          },
          {
            name: 'flat_amount_decimal',
            type: 'decimal string',
            description:
              'Same as <code>flat_amount</code>, but contains a decimal value with at most 12 decimal places.',
          },
          {
            name: 'unit_amount',
            type: 'number',
            description: 'Per unit price for units relevant to the tier.',
          },
          {
            name: 'unit_amount_decimal',
            type: 'decimal string',
            description:
              'Same as <code>unit_amount</code>, but contains a decimal value with at most 12 decimal places.',
          },
          {
            name: 'up_to',
            type: 'number',
            description:
              'Up to and including to this quantity will be contained in the tier.',
          },
        ],
      },
      {
        name: 'unit_amount',
        type: 'number',
        description:
          'The unit amount in the smallest currency unit to be charged, represented as a whole integer if possible. Only set if <code>billing_scheme=per_unit</code>.',
      },
      {
        name: 'unit_amount_decimal',
        type: 'decimal string',
        description:
          'The unit amount in the smallest currency unit to be charged, represented as a decimal string with at most 12 decimal places. Only set if <code>billing_scheme=per_unit</code>.',
      },
    ],
  },
  {
    name: 'custom_unit_amount',
    type: 'object',
    description:
      'When set, provides configuration for the amount to be adjusted by the customer during Checkout Sessions and Payment Links.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description: 'Whether the custom unit amount is enabled.',
      },
      {
        name: 'maximum',
        type: 'number',
        description:
          'The maximum unit amount the customer can specify for this item.',
      },
      {
        name: 'minimum',
        type: 'number',
        description:
          'The minimum unit amount the customer can specify for this item. Must be at least the minimum charge amount.',
      },
      {
        name: 'preset',
        type: 'number',
        description:
          'The starting unit amount which can be updated by the customer.',
      },
    ],
  },
  {
    name: 'lookup_key',
    type: 'string',
    description:
      'A lookup key used to retrieve prices dynamically from a static string. This may be up to 200 characters.',
  },
  {
    name: 'tiers',
    type: 'array of objects',
    description:
      'Each element represents a pricing tier. This parameter requires <code>billing_scheme</code> to be set to <code>tiered</code>. See also the documentation for <code>billing_scheme</code>.',
    expandable: true,
    children: [
      {
        name: 'flat_amount',
        type: 'number',

        description: 'Price for the entire tier.',
      },
      {
        name: 'flat_amount_decimal',
        type: 'decimal string',
        description:
          'Same as flat_amount, but contains a decimal value with at most 12 decimal places.',
      },
      {
        name: 'unit_amount',
        type: 'number',
        description: 'Per unit price for units relevant to the tier.',
      },
      {
        name: 'unit_amount_decimal',
        type: 'decimal string',
        description:
          'Same as unit_amount, but contains a decimal value with at most 12 decimal places.',
      },
      {
        name: 'up_to',
        type: 'number',
        description:
          'Up to and including to this quantity will be contained in the tier.',
      },
    ],
  },
  {
    name: 'tiers_mode',
    type: 'enum',
    description:
      'Defines if the tiering price should be <code>graduated</code> or <code>volume</code> based. In volume-based tiering, the maximum quantity within a period determines the per unit price. In graduated tiering, pricing can change as the quantity grows.',
    enumValues: [
      {
        value: 'graduated',
        description: 'Pricing changes progressively as quantity increases.',
      },
      {
        value: 'volume',
        description:
          'One unit price is applied based on the maximum quantity tier reached.',
      },
    ],
  },
  {
    name: 'transform_lookup_key',
    type: 'boolean',
    description:
      'If set to true, will atomically remove the lookup key from the existing price, and assign it to this price.',
  },
  {
    name: 'transform_quantity',
    type: 'object',
    description:
      'Apply a transformation to the reported usage or set quantity before computing the amount billed. Cannot be combined with <code>tiers</code>.',
    expandable: true,
    children: [
      {
        name: 'divide_by',
        type: 'number',
        description: 'Divide usage by this number.',
      },
      {
        name: 'round',
        type: 'enum',
        description:
          'After division, either round the result <code>up</code> or <code>down</code>',
        enumValues: [
          { value: 'up', description: 'Round up after division.' },
          { value: 'down', description: 'Round down after division.' },
        ],
      },
    ],
  },
  {
    name: 'unit_amount_decimal',
    type: 'decimal string',
    description:
      'The unit amount in the smallest currency unit to be charged, represented as a decimal string with at most 12 decimal places. Only set if <code>billing_scheme=per_unit</code>.',
  },
];

export const PRICES_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a price',
  description: 'Creates a new price object.',
  stripeDocsUrl: 'https://docs.stripe.com/api/prices/create',
  endpoints: [{ method: 'POST', path: '/v1/prices' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_PRICE_PARAMETERS,
          moreAttributes: CREATE_PRICE_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Price</code> object if the call succeeds.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/prices' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/prices \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d currency=usdc \\
  -d unit_amount=1000 \\
  -d "recurring[interval]=month" \\
  -d "product_data[name]=Pro Plan Price"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const price = await zoneless.prices.create({
  currency: 'usdc',
  unit_amount: 1000,
  recurring: {
    interval: 'month',
  },
  product_data: {
    name: 'Pro Plan Price',
  },
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: PRICES_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Update Price Parameters
// ============================================
const UPDATE_PRICE_PARAMETERS: Attribute[] = [
  {
    name: 'active',
    type: 'boolean',
    description: 'Whether the price can be used for new purchases.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'nickname',
    type: 'string',
    description: 'A brief description of the price, hidden from customers.',
  },
  {
    name: 'tax_behavior',
    type: 'enum',
    description:
      'Only required if a default tax behavior was not provided in the Stripe Tax settings. Specifies whether the price is considered inclusive of taxes or exclusive of taxes. One of <code>inclusive</code>, <code>exclusive</code>, or <code>unspecified</code>. Once specified as either <code>inclusive</code> or <code>exclusive</code>, it cannot be changed.',
    enumValues: [
      { value: 'inclusive', description: 'Tax is included in the price.' },
      { value: 'exclusive', description: 'Tax is added on top of the price.' },
      { value: 'unspecified', description: 'No explicit tax behavior is set.' },
    ],
  },
];

const UPDATE_PRICE_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'currency_options',
    type: 'object',
    description:
      'Prices defined in each available currency option. Each key must be a three-letter ISO currency code and a supported currency.',
    expandable: true,
    children: [
      {
        name: 'currency_options.<currency>.custom_unit_amount',
        type: 'object',
        description:
          'When set, provides configuration for the amount to be adjusted by the customer during Checkout Sessions and Payment Links.',
        expandable: true,
        children: [
          {
            name: 'enabled',
            type: 'boolean',
            description: 'Whether the custom unit amount is enabled.',
          },
          {
            name: 'maximum',
            type: 'number',
            description:
              'The maximum unit amount the customer can specify for this item.',
          },
          {
            name: 'minimum',
            type: 'number',
            description:
              'The minimum unit amount the customer can specify for this item. Must be at least the minimum charge amount.',
          },
          {
            name: 'preset',
            type: 'number',
            description:
              'The starting unit amount which can be updated by the customer.',
          },
        ],
      },
      {
        name: 'currency_options.<currency>.tax_behavior',
        type: 'enum',
        description:
          'Only required if a default tax behavior was not provided in the Stripe Tax settings. Specifies whether the price is considered inclusive of taxes or exclusive of taxes. One of <code>inclusive</code>, <code>exclusive</code>, or <code>unspecified</code>. Once specified as either <code>inclusive</code> or <code>exclusive</code>, it cannot be changed.',
        enumValues: [
          { value: 'inclusive', description: 'Tax is included in the price.' },
          {
            value: 'exclusive',
            description: 'Tax is added on top of the price.',
          },
          {
            value: 'unspecified',
            description: 'No explicit tax behavior is set.',
          },
        ],
      },
      {
        name: 'currency_options.<currency>.tiers',
        type: 'array of objects',
        description:
          'Each element represents a pricing tier. This parameter requires <code>billing_scheme</code> to be set to <code>tiered</code>. See also the documentation for <code>billing_scheme</code>.',
        expandable: true,
        children: [
          {
            name: 'flat_amount',
            type: 'number',
            description: 'Price for the entire tier.',
          },
          {
            name: 'flat_amount_decimal',
            type: 'decimal string',
            description:
              'Same as <code>flat_amount</code>, but contains a decimal value with at most 12 decimal places.',
          },
          {
            name: 'unit_amount',
            type: 'number',
            description: 'Per unit price for units relevant to the tier.',
          },
          {
            name: 'unit_amount_decimal',
            type: 'decimal string',
            description:
              'Same as <code>unit_amount</code>, but contains a decimal value with at most 12 decimal places.',
          },
          {
            name: 'up_to',
            type: 'number',
            description:
              'Up to and including to this quantity will be contained in the tier.',
          },
        ],
      },
      {
        name: 'unit_amount',
        type: 'number',
        description:
          'The unit amount in the smallest currency unit to be charged, represented as a whole integer if possible. Only set if <code>billing_scheme=per_unit</code>.',
      },
      {
        name: 'unit_amount_decimal',
        type: 'decimal string',
        description:
          'The unit amount in the smallest currency unit to be charged, represented as a decimal string with at most 12 decimal places. Only set if <code>billing_scheme=per_unit</code>.',
      },
    ],
  },
  {
    name: 'lookup_key',
    type: 'string',
    description:
      'A lookup key used to retrieve prices dynamically from a static string. This may be up to 200 characters.',
  },
  {
    name: 'transform_lookup_key',
    type: 'boolean',
    description:
      'If set to true, will atomically remove the lookup key from the existing price, and assign it to this price.',
  },
];

// ============================================
// Shared Data
// ============================================
const PRICES_UPDATE_JSON = `{
  "id": "price_z_yXmLn04Bpw9Wbjx2",
  "object": "price",
  "active": true,
  "billing_scheme": "per_unit",
  "created": 1778605292,
  "currency": "usdc",
  "custom_unit_amount": null,
  "livemode": false,
  "lookup_key": null,
  "metadata": {
    "order_id": "1234"
  },
  "nickname": "Pro Plan Price",
  "product": "prod_z_oJaYlHpf6YmRzCMm",
  "recurring": {
    "aggregate_usage": null,
    "interval": "month",
    "interval_count": 1,
    "trial_period_days": null,
    "usage_type": "licensed"
  },
  "tax_behavior": "unspecified",
  "tiers_mode": null,
  "transform_quantity": null,
  "type": "recurring",
  "unit_amount": 1000,
  "unit_amount_decimal": "1000"
}`;

export const PRICES_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a price',
  description:
    'Updates the specific price by setting the values of the parameters passed. Any parameters not provided will be left unchanged.',
  stripeDocsUrl: 'https://docs.stripe.com/api/prices/update',
  endpoints: [{ method: 'POST', path: '/v1/prices/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_PRICE_PARAMETERS,
          moreAttributes: UPDATE_PRICE_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the <code>Price</code> object if the update succeeds.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/prices/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/prices/price_z_yXmLn04Bpw9Wbjx2 \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[order_id]"=1234`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const price = await zoneless.prices.update('price_z_yXmLn04Bpw9Wbjx2', {
  metadata: {
    order_id: '1234',
  },
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: PRICES_UPDATE_JSON },
      ],
    },
  ],
};

// ============================================
// Retrieve Price
// ============================================
export const PRICES_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a price',
  stripeDocsUrl: 'https://docs.stripe.com/api/prices/retrieve',
  description: 'Retrieves the price with the given ID.',
  endpoints: [{ method: 'GET', path: '/v1/prices/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Price</code> object if you provide a valid identifier. Raises an error otherwise.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/prices/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/prices/price_z_yXmLn04Bpw9Wbjx2 \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const price = await zoneless.prices.retrieve('price_z_yXmLn04Bpw9Wbjx2');`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: PRICES_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// List Prices Parameters
// ============================================
const LIST_PRICES_PARAMETERS: Attribute[] = [
  {
    name: 'active',
    type: 'boolean',
    description:
      'Only return prices that are active or inactive (e.g., pass <code>false</code> to list all inactive prices).',
  },
  {
    name: 'currency',
    type: 'enum',
    description: 'Only return prices for the given currency.',
  },
  {
    name: 'product',
    type: 'string',
    description: 'Only return prices for the given product.',
  },
  {
    name: 'type',
    type: 'enum',
    description:
      'Only return prices of type <code>recurring</code> or <code>one_time</code>.',
    enumValues: [{ value: 'one_time' }, { value: 'recurring' }],
  },
];

const LIST_PRICES_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'created',
    type: 'object',
    description:
      'A filter on the list based on the <code>created</code> field. The value can be an integer Unix timestamp or a dictionary with filter options.',
    expandable: true,
    children: [
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
    ],
  },
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>tu_z_bar</code>, your subsequent call can include <code>ending_before=tu_z_bar</code> in order to fetch the previous page of the list.',
  },
  {
    name: 'limit',
    type: 'integer',
    description:
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
  },
  {
    name: 'starting_after',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>tu_z_foo</code>, your subsequent call can include <code>starting_after=tu_z_foo</code> in order to fetch the next page of the list.',
  },
  {
    name: 'lookup_keys',
    type: 'array of strings',
    description:
      'Only return the price with these lookup_keys, if any exist. You can specify up to 10 lookup_keys.',
  },
  {
    name: 'recurring',
    type: 'object',
    description: 'Only return prices with these recurring fields.',
    expandable: true,
    children: [
      {
        name: 'interval',
        type: 'enum',
        description:
          'Filter by billing frequency. Either <code>day</code>, <code>week</code>, <code>month</code> or <code>year</code>.',
        enumValues: [
          { value: 'day' },
          { value: 'week' },
          { value: 'month' },
          { value: 'year' },
        ],
      },
      {
        name: 'usage_type',
        type: 'enum',
        description:
          'Filter by the usage type for this price. Can be either <code>metered</code> or <code>licensed</code>.',
        enumValues: [{ value: 'metered' }, { value: 'licensed' }],
      },
      {
        name: 'meter',
        type: 'string',
        description: "Filter by the price's meter.",
      },
    ],
  },
];

const LIST_PRICES_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/prices",
  "has_more": false,
  "data": [
  {
    "id": "price_z_yXmLn04Bpw9Wbjx2",
    "object": "price",
    "active": true,
    "billing_scheme": "per_unit",
    "created": 1778605292,
    "currency": "usdc",
    "custom_unit_amount": null,
    "livemode": false,
    "lookup_key": null,
    "metadata": {},
    "nickname": "Pro Plan Price",
    "product": "prod_z_oJaYlHpf6YmRzCMm",
    "recurring": {
      "aggregate_usage": null,
      "interval": "month",
      "interval_count": 1,
      "trial_period_days": null,
      "usage_type": "licensed"
    },
    "tax_behavior": "unspecified",
    "tiers_mode": null,
    "transform_quantity": null,
    "type": "recurring",
      "unit_amount": 1000,
      "unit_amount_decimal": "1000"
   }
  ]
}`;

export const PRICES_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all prices',
  description:
    'Returns a list of prices. The prices are returned in sorted order, with the most recently created prices appearing first.',
  endpoints: [{ method: 'GET', path: '/v1/prices' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_PRICES_PARAMETERS,
          moreAttributes: LIST_PRICES_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> prices. If no more prices are available, the resulting array will be empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/prices' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/prices \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const prices = await zoneless.prices.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_PRICES_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const PRICES_PAGES: DocPage[] = [
  PRICES_OVERVIEW_PAGE,
  PRICES_CREATE_PAGE,
  PRICES_UPDATE_PAGE,
  PRICES_RETRIEVE_PAGE,
  PRICES_LIST_PAGE,
];
