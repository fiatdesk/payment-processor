import { DocSubSection, DocPage, Attribute } from './types';
import { NODE_INIT, EXPAND_TOOLTIP, BuildEndpointSummaries } from './shared';
import { GetResourceEventAttributes } from './event-types';

export const PAYMENT_INTENTS_SUBSECTION: DocSubSection = {
  id: 'payment-intents',
  title: 'Payment Intents',
  children: [
    { id: 'object', title: 'The PaymentIntent object' },
    { id: 'create', title: 'Create a PaymentIntent' },
    { id: 'update', title: 'Update a PaymentIntent' },
    { id: 'retrieve', title: 'Retrieve a PaymentIntent' },
    { id: 'list', title: 'List all PaymentIntents' },
    {
      id: 'amount-details-line-items',
      title: 'List amount details line items',
    },
    { id: 'cancel', title: 'Cancel a PaymentIntent' },
  ],
};

// ============================================
// Shared helpers
// ============================================

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

const ADDRESS_PARAM_CHILDREN: Attribute[] = [
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
    description: 'Address line 1, such as the street, PO Box, or company name.',
  },
  {
    name: 'line2',
    type: 'string',
    description:
      'Address line 2, such as the apartment, suite, unit, or building.',
  },
  { name: 'postal_code', type: 'string', description: 'ZIP or postal code.' },
  {
    name: 'state',
    type: 'string',
    description: 'State, county, province, or region (ISO 3166-2).',
  },
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

const SHIPPING_OBJECT_CHILDREN: Attribute[] = [
  {
    name: 'address',
    type: 'object',
    description: 'Shipping address.',
    expandable: true,
    children: ADDRESS_CHILDREN,
  },
  {
    name: 'carrier',
    type: 'string',
    nullable: true,
    description:
      'The delivery service that shipped a physical product, such as FedEx, UPS, or USPS.',
  },
  { name: 'name', type: 'string', description: 'Recipient name.' },
  {
    name: 'phone',
    type: 'string',
    nullable: true,
    description: 'Recipient phone (including extension).',
  },
  {
    name: 'tracking_number',
    type: 'string',
    nullable: true,
    description:
      'The tracking number for a physical product. If multiple tracking numbers were generated, separate them with commas.',
  },
];

const SHIPPING_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'address',
    type: 'object',
    required: true,
    description: 'Shipping address.',
    expandable: true,
    children: ADDRESS_PARAM_CHILDREN,
  },
  {
    name: 'name',
    type: 'string',
    required: true,
    description: 'Recipient name.',
  },
  {
    name: 'carrier',
    type: 'string',
    description:
      'The delivery service that shipped a physical product, such as FedEx, UPS, or USPS.',
  },
  {
    name: 'phone',
    type: 'string',
    description: 'Recipient phone (including extension).',
  },
  {
    name: 'tracking_number',
    type: 'string',
    description:
      'The tracking number for a physical product. If multiple tracking numbers were generated, separate them with commas.',
  },
];

const AMOUNT_DETAILS_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'discount_amount',
    type: 'integer',
    description:
      'The total discount applied on the transaction, in the smallest currency unit. An integer greater than 0. Mutually exclusive with per-line-item <code>discount_amount</code>.',
  },
  {
    name: 'enforce_arithmetic_validation',
    type: 'boolean',
    description:
      'Set to <code>false</code> to return arithmetic validation errors in the response without failing the request. Omit or set to <code>true</code> to return a 400 error when validation fails.',
  },
  {
    name: 'line_items',
    type: 'array of objects',
    description:
      'A list of line items for the PaymentIntent. Maximum of 200 line items.',
    expandable: true,
    children: [
      {
        name: 'product_name',
        type: 'string',
        required: true,
        description:
          'The product name of the line item. At most 1024 characters.',
      },
      {
        name: 'quantity',
        type: 'integer',
        required: true,
        description: 'The quantity of items. An integer greater than 0.',
      },
      {
        name: 'unit_cost',
        type: 'integer',
        required: true,
        description:
          'The unit cost of the line item in the smallest currency unit. An integer greater than or equal to 0.',
      },
      {
        name: 'discount_amount',
        type: 'integer',
        description:
          'The discount applied on this line item in the smallest currency unit. Mutually exclusive with top-level <code>amount_details.discount_amount</code>.',
      },
      {
        name: 'product_code',
        type: 'string',
        description:
          'The product code of the line item, such as an SKU. At most 12 characters.',
      },
      {
        name: 'tax',
        type: 'object',
        description: 'Contains information about the tax on the item.',
        expandable: true,
        children: [
          {
            name: 'total_tax_amount',
            type: 'integer',
            required: true,
            description:
              'The total amount of tax on this line item in the smallest currency unit. Mutually exclusive with top-level <code>amount_details.tax.total_tax_amount</code>.',
          },
        ],
      },
      {
        name: 'unit_of_measure',
        type: 'string',
        description:
          'A unit of measure for the line item, such as gallons or meters. At most 12 characters.',
      },
    ],
  },
  {
    name: 'shipping',
    type: 'object',
    description:
      'Contains information about the shipping portion of the amount.',
    expandable: true,
    children: [
      {
        name: 'amount',
        type: 'integer',
        description: 'The cost of shipping in the smallest currency unit.',
      },
      {
        name: 'from_postal_code',
        type: 'string',
        description:
          'Postal code of where the good is being shipped from. At most 10 characters.',
      },
      {
        name: 'to_postal_code',
        type: 'string',
        description:
          'Postal code of where the good is being shipped to. At most 10 characters.',
      },
    ],
  },
  {
    name: 'tax',
    type: 'object',
    description: 'Contains information about the tax portion of the amount.',
    expandable: true,
    children: [
      {
        name: 'total_tax_amount',
        type: 'integer',
        required: true,
        description:
          'The total amount of tax on the transaction in the smallest currency unit. Mutually exclusive with per-line-item tax amounts.',
      },
    ],
  },
];

const PAYMENT_METHOD_OPTIONS_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'crypto',
    type: 'object',
    description:
      "If this PaymentIntent's <code>payment_method_types</code> includes <code>crypto</code>, this hash contains configuration applied to each payment attempt of that type.",
    expandable: true,
    children: [
      {
        name: 'setup_future_usage',
        type: 'enum',
        description:
          "Indicates that you intend to make future payments with this PaymentIntent's payment method. Use <code>none</code> to override a top-level <code>setup_future_usage</code> value for this payment method.",
        enumValues: [
          { value: 'none', description: 'Do not reuse this payment method.' },
        ],
      },
    ],
  },
];

const TRANSFER_DATA_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'destination',
    type: 'string',
    required: true,
    description:
      'If specified, successful payments are attributed to the destination account for tax reporting, and funds are transferred to that account after payment success.',
  },
  {
    name: 'amount',
    type: 'integer',
    description:
      'The amount transferred automatically when the payment succeeds. Capped at the total transaction amount. If omitted, the full amount is transferred.',
  },
  {
    name: 'description',
    type: 'string',
    description: 'An arbitrary string attached to the transfer.',
  },
  {
    name: 'metadata',
    type: 'object',
    description: 'Set of key-value pairs attached to the transfer.',
  },
  {
    name: 'payment_data',
    type: 'object',
    description: 'Data used to populate the destination payment.',
    expandable: true,
    children: [
      {
        name: 'description',
        type: 'string',
        description: 'An arbitrary string attached to the destination payment.',
      },
      {
        name: 'metadata',
        type: 'object',
        description:
          'Set of key-value pairs attached to the destination payment.',
      },
    ],
  },
];

// ============================================
// Shared example objects
// ============================================

const PAYMENT_INTENT_OBJECT_JSON = `{
  "id": "pi_z_3PqK8mLkdIwHu7ix2nR5wT9b",
  "object": "payment_intent",
  "amount": 3500,
  "amount_capturable": 0,
  "amount_details": {
    "tip": {}
  },
  "amount_received": 0,
  "application": null,
  "application_fee_amount": null,
  "automatic_payment_methods": {
    "enabled": true
  },
  "canceled_at": null,
  "cancellation_reason": null,
  "capture_method": "automatic_async",
  "client_secret": "pi_z_3PqK8mLkdIwHu7ix2nR5wT9b_secret_mK8vLpQ2nR5wT9bHxJcF",
  "confirmation_method": "automatic",
  "created": 1721486400,
  "currency": "usdc",
  "customer": null,
  "customer_account": null,
  "description": null,
  "excluded_payment_method_types": null,
  "hooks": null,
  "last_payment_error": null,
  "latest_charge": null,
  "livemode": false,
  "managed_payments": null,
  "metadata": {},
  "next_action": null,
  "on_behalf_of": null,
  "payment_details": null,
  "payment_method": null,
  "payment_method_configuration_details": null,
  "payment_method_options": {
    "crypto": {}
  },
  "payment_method_types": [
    "crypto"
  ],
  "presentment_details": null,
  "processing": null,
  "receipt_email": null,
  "review": null,
  "setup_future_usage": null,
  "shared_payment_granted_token": null,
  "shipping": null,
  "statement_descriptor": null,
  "statement_descriptor_suffix": null,
  "status": "requires_payment_method",
  "transfer_data": null,
  "transfer_group": null,
  "platform_account": "acct_z_Platform123abc"
}`;

const PAYMENT_INTENT_UPDATE_RESPONSE_JSON = `{
  "id": "pi_z_3PqK8mLkdIwHu7ix2nR5wT9b",
  "object": "payment_intent",
  "amount": 3500,
  "amount_capturable": 0,
  "amount_details": {
    "tip": {}
  },
  "amount_received": 0,
  "application": null,
  "application_fee_amount": null,
  "automatic_payment_methods": {
    "enabled": true
  },
  "canceled_at": null,
  "cancellation_reason": null,
  "capture_method": "automatic_async",
  "client_secret": "pi_z_3PqK8mLkdIwHu7ix2nR5wT9b_secret_mK8vLpQ2nR5wT9bHxJcF",
  "confirmation_method": "automatic",
  "created": 1721486400,
  "currency": "usdc",
  "customer": null,
  "customer_account": null,
  "description": null,
  "excluded_payment_method_types": null,
  "hooks": null,
  "last_payment_error": null,
  "latest_charge": null,
  "livemode": false,
  "managed_payments": null,
  "metadata": {
    "order_id": "9142"
  },
  "next_action": null,
  "on_behalf_of": null,
  "payment_details": null,
  "payment_method": null,
  "payment_method_configuration_details": null,
  "payment_method_options": {
    "crypto": {}
  },
  "payment_method_types": [
    "crypto"
  ],
  "presentment_details": null,
  "processing": null,
  "receipt_email": null,
  "review": null,
  "setup_future_usage": null,
  "shared_payment_granted_token": null,
  "shipping": null,
  "statement_descriptor": null,
  "statement_descriptor_suffix": null,
  "status": "requires_payment_method",
  "transfer_data": null,
  "transfer_group": null,
  "platform_account": "acct_z_Platform123abc"
}`;

const PAYMENT_INTENT_CANCEL_RESPONSE_JSON = `{
  "id": "pi_z_3PqK8mLkdIwHu7ix2nR5wT9b",
  "object": "payment_intent",
  "amount": 3500,
  "amount_capturable": 0,
  "amount_details": {
    "tip": {}
  },
  "amount_received": 0,
  "application": null,
  "application_fee_amount": null,
  "automatic_payment_methods": {
    "enabled": true
  },
  "canceled_at": 1721487123,
  "cancellation_reason": "requested_by_customer",
  "capture_method": "automatic_async",
  "client_secret": "pi_z_3PqK8mLkdIwHu7ix2nR5wT9b_secret_mK8vLpQ2nR5wT9bHxJcF",
  "confirmation_method": "automatic",
  "created": 1721486400,
  "currency": "usdc",
  "customer": null,
  "customer_account": null,
  "description": null,
  "excluded_payment_method_types": null,
  "hooks": null,
  "last_payment_error": null,
  "latest_charge": null,
  "livemode": false,
  "managed_payments": null,
  "metadata": {},
  "next_action": null,
  "on_behalf_of": null,
  "payment_details": null,
  "payment_method": null,
  "payment_method_configuration_details": null,
  "payment_method_options": {
    "crypto": {}
  },
  "payment_method_types": [
    "crypto"
  ],
  "presentment_details": null,
  "processing": null,
  "receipt_email": null,
  "review": null,
  "setup_future_usage": null,
  "shared_payment_granted_token": null,
  "shipping": null,
  "statement_descriptor": null,
  "statement_descriptor_suffix": null,
  "status": "canceled",
  "transfer_data": null,
  "transfer_group": null,
  "platform_account": "acct_z_Platform123abc"
}`;

const LIST_PAYMENT_INTENTS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/payment_intents",
  "has_more": false,
  "data": [
    {
      "id": "pi_z_3PqK8mLkdIwHu7ix2nR5wT9b",
      "object": "payment_intent",
      "amount": 3500,
      "amount_capturable": 0,
      "amount_details": {
        "tip": {}
      },
      "amount_received": 0,
      "application": null,
      "application_fee_amount": null,
      "automatic_payment_methods": {
        "enabled": true
      },
      "canceled_at": null,
      "cancellation_reason": null,
      "capture_method": "automatic_async",
      "client_secret": "pi_z_3PqK8mLkdIwHu7ix2nR5wT9b_secret_mK8vLpQ2nR5wT9bHxJcF",
      "confirmation_method": "automatic",
      "created": 1721486400,
      "currency": "usdc",
      "customer": null,
      "customer_account": null,
      "description": null,
      "excluded_payment_method_types": null,
      "hooks": null,
      "last_payment_error": null,
      "latest_charge": null,
      "livemode": false,
      "managed_payments": null,
      "metadata": {},
      "next_action": null,
      "on_behalf_of": null,
      "payment_details": null,
      "payment_method": null,
      "payment_method_configuration_details": null,
      "payment_method_options": {
        "crypto": {}
      },
      "payment_method_types": [
        "crypto"
      ],
      "presentment_details": null,
      "processing": null,
      "receipt_email": null,
      "review": null,
      "setup_future_usage": null,
      "shared_payment_granted_token": null,
      "shipping": null,
      "statement_descriptor": null,
      "statement_descriptor_suffix": null,
      "status": "requires_payment_method",
      "transfer_data": null,
      "transfer_group": null,
      "platform_account": "acct_z_Platform123abc"
    }
  ]
}`;

const LIST_LINE_ITEMS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/payment_intents/pi_z_3PqK8mLkdIwHu7ix2nR5wT9b/amount_details_line_items",
  "has_more": false,
  "data": [
    {
      "id": "uli_z_K8mWqR2vLpQbNx",
      "object": "payment_intent_amount_details_line_item",
      "discount_amount": 75,
      "payment_method_options": null,
      "product_code": "SKU214",
      "product_name": "Ceramic Mug",
      "quantity": 1,
      "tax": {
        "total_tax_amount": 28
      },
      "unit_cost": 3500,
      "unit_of_measure": "each"
    }
  ]
}`;

// ============================================
// PaymentIntent object attributes
// ============================================

const PAYMENT_INTENT_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless PaymentIntent IDs are prefixed with <code>pi_z_</code>.',
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
      'Amount intended to be collected by this PaymentIntent. A positive integer in the smallest currency unit. For USDC, this is cents (e.g., 100 = $1 USDC). Supports up to eight digits.',
  },
  {
    name: 'amount_capturable',
    type: 'integer',
    description: 'Amount that can be captured from this PaymentIntent.',
  },
  {
    name: 'amount_details',
    type: 'object',
    nullable: true,
    description: 'Provides industry-specific information about the amount.',
    expandable: true,
    children: [
      {
        name: 'discount_amount',
        type: 'integer',
        nullable: true,
        description:
          'The total discount applied on the transaction in the smallest currency unit.',
      },
      {
        name: 'line_items',
        type: 'array of objects',
        nullable: true,
        description:
          'A list of line items for products in the PaymentIntent. Maximum of 200 line items.',
        expandable: true,
        children: [
          {
            name: 'id',
            type: 'string',
            description: 'Unique identifier for the line item.',
          },
          {
            name: 'object',
            type: 'string',
            description:
              "String representing the object's type. Always <code>payment_intent_amount_details_line_item</code>.",
          },
          {
            name: 'discount_amount',
            type: 'integer',
            nullable: true,
            description:
              'The discount applied on this line item in the smallest currency unit.',
          },
          {
            name: 'payment_method_options',
            type: 'object',
            nullable: true,
            description:
              'Payment method-specific information for the line item.',
          },
          {
            name: 'product_code',
            type: 'string',
            nullable: true,
            description: 'The product code of the line item, such as an SKU.',
          },
          {
            name: 'product_name',
            type: 'string',
            description: 'The product name of the line item.',
          },
          {
            name: 'quantity',
            type: 'integer',
            description: 'The quantity of items.',
          },
          {
            name: 'tax',
            type: 'object',
            nullable: true,
            description: 'Contains information about the tax on the item.',
            expandable: true,
            children: [
              {
                name: 'total_tax_amount',
                type: 'integer',
                description:
                  'The total amount of tax on the line item in the smallest currency unit.',
              },
            ],
          },
          {
            name: 'unit_cost',
            type: 'integer',
            description:
              'The unit cost of the line item in the smallest currency unit.',
          },
          {
            name: 'unit_of_measure',
            type: 'string',
            nullable: true,
            description: 'A unit of measure for the line item.',
          },
        ],
      },
      {
        name: 'shipping',
        type: 'object',
        nullable: true,
        description:
          'Contains information about the shipping portion of the amount.',
        expandable: true,
        children: [
          {
            name: 'amount',
            type: 'integer',
            nullable: true,
            description: 'The cost of shipping in the smallest currency unit.',
          },
          {
            name: 'from_postal_code',
            type: 'string',
            nullable: true,
            description: 'Postal code of where the good is being shipped from.',
          },
          {
            name: 'to_postal_code',
            type: 'string',
            nullable: true,
            description: 'Postal code of where the good is being shipped to.',
          },
        ],
      },
      {
        name: 'tax',
        type: 'object',
        nullable: true,
        description:
          'Contains information about the tax portion of the amount.',
        expandable: true,
        children: [
          {
            name: 'total_tax_amount',
            type: 'integer',
            nullable: true,
            description:
              'The total amount of tax on the transaction in the smallest currency unit.',
          },
        ],
      },
      {
        name: 'tip',
        type: 'object',
        nullable: true,
        description: 'Portion of the amount that corresponds to a tip.',
      },
    ],
  },
  {
    name: 'amount_received',
    type: 'integer',
    description: 'Amount that this PaymentIntent has collected.',
  },
  {
    name: 'application',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the Connect application that created the PaymentIntent.',
  },
  {
    name: 'application_fee_amount',
    type: 'integer',
    nullable: true,
    description:
      "The amount of the application fee (if any) that will be applied to the payment and transferred to the application owner's account. Capped at the total amount captured.",
  },
  {
    name: 'automatic_payment_methods',
    type: 'object',
    nullable: true,
    description:
      'Settings that automatically enable compatible payment methods for this PaymentIntent.',
    expandable: true,
    children: [
      {
        name: 'allow_redirects',
        type: 'enum',
        nullable: true,
        description:
          'Controls whether this PaymentIntent accepts redirect-based payment methods. Redirect methods may require a <code>return_url</code> when confirming.',
        enumValues: [
          {
            value: 'always',
            description: '(Default) Accept redirect-based payment methods.',
          },
          {
            value: 'never',
            description: 'Do not accept redirect-based payment methods.',
          },
        ],
      },
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Whether compatible payment methods are calculated automatically.',
      },
    ],
  },
  {
    name: 'canceled_at',
    type: 'timestamp',
    nullable: true,
    description:
      'Populated when <code>status</code> is <code>canceled</code>. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'cancellation_reason',
    type: 'enum',
    nullable: true,
    description:
      'Reason for cancellation of this PaymentIntent, either user-provided or generated internally.',
    enumValues: [
      { value: 'abandoned' },
      { value: 'automatic' },
      { value: 'duplicate' },
      { value: 'expired' },
      { value: 'failed_invoice' },
      { value: 'fraudulent' },
      { value: 'requested_by_customer' },
      { value: 'void_invoice' },
    ],
  },
  {
    name: 'capture_method',
    type: 'enum',
    description:
      "Controls when funds are captured from the customer's account.",
    enumValues: [
      {
        value: 'automatic',
        description:
          'Funds are captured when the customer authorizes the payment.',
      },
      {
        value: 'automatic_async',
        description:
          '(Default) Funds are captured asynchronously when the customer authorizes the payment.',
      },
      {
        value: 'manual',
        description:
          'Place a hold when the customer authorizes the payment, and capture funds later. Not all payment methods support this.',
      },
    ],
  },
  {
    name: 'client_secret',
    type: 'string',
    nullable: true,
    description:
      'The client secret of this PaymentIntent. Used for client-side retrieval with a publishable key. Do not store, log, or expose it to anyone other than the customer. Use TLS on any page that includes the client secret.',
  },
  {
    name: 'confirmation_method',
    type: 'enum',
    description:
      'Describes whether this PaymentIntent can be confirmed automatically, or requires server-side confirmation.',
    enumValues: [
      {
        value: 'automatic',
        description:
          '(Default) The PaymentIntent can be confirmed with a publishable key. After <code>next_action</code>s are handled, no additional confirmation is required.',
      },
      {
        value: 'manual',
        description:
          'Payment attempts must use a secret key. After handling <code>next_action</code>s, the PaymentIntent returns to <code>requires_confirmation</code>.',
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
    type: 'string',
    description:
      'Three-letter currency code, in lowercase. For Zoneless, this is <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless settles in USDC on Solana rather than fiat currencies.',
  },
  {
    name: 'customer',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the Customer this PaymentIntent belongs to, if one exists. Payment methods attached to other Customers cannot be used with this PaymentIntent.',
  },
  {
    name: 'customer_account',
    type: 'string',
    nullable: true,
    description:
      'ID of the Account representing the customer that this PaymentIntent belongs to, if one exists.',
  },
  {
    name: 'description',
    type: 'string',
    nullable: true,
    description:
      'An arbitrary string attached to the object. Often useful for displaying to users.',
  },
  {
    name: 'last_payment_error',
    type: 'object',
    nullable: true,
    description:
      'The payment error encountered in the previous confirmation attempt. Cleared if the PaymentIntent is later updated.',
    expandable: true,
    children: [
      {
        name: 'charge',
        type: 'string',
        nullable: true,
        description: 'The ID of the failed charge, when applicable.',
      },
      {
        name: 'code',
        type: 'string',
        nullable: true,
        description:
          'For some errors that can be handled programmatically, a short error code.',
      },
      {
        name: 'decline_code',
        type: 'string',
        nullable: true,
        description:
          'A short string indicating why the payment was declined, when available.',
      },
      {
        name: 'doc_url',
        type: 'string',
        nullable: true,
        description:
          'A URL with more information about the reported error code.',
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
        name: 'payment_method',
        type: 'object',
        nullable: true,
        description:
          'The PaymentMethod object for errors returned on a request involving a PaymentMethod.',
      },
      {
        name: 'payment_method_type',
        type: 'string',
        nullable: true,
        description:
          'If the error is specific to a payment method type, the type that had a problem.',
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
    name: 'latest_charge',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the latest Charge created by this PaymentIntent. <code>null</code> until confirmation is attempted.',
  },
  {
    name: 'livemode',
    type: 'boolean',
    description:
      'If the object exists in live mode, the value is <code>true</code>. If the object exists in test mode, the value is <code>false</code>.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. Useful for storing additional information in a structured format.',
  },
  {
    name: 'next_action',
    type: 'object',
    nullable: true,
    description:
      'If present, describes the actions your customer must take to complete the payment—for example, approving a wallet transfer.',
    expandable: true,
    children: [
      {
        name: 'type',
        type: 'string',
        description:
          'Type of the next action to perform. Refer to the other child attributes under <code>next_action</code> for available values (for example, <code>redirect_to_url</code>).',
      },
      {
        name: 'redirect_to_url',
        type: 'object',
        nullable: true,
        description:
          'Contains instructions for authenticating a payment by redirecting your customer to another page or application.',
        expandable: true,
        children: [
          {
            name: 'return_url',
            type: 'string',
            nullable: true,
            description:
              'If the customer does not exit their browser while authenticating, they are redirected here after completion.',
          },
          {
            name: 'url',
            type: 'string',
            nullable: true,
            description:
              'The URL you must redirect your customer to in order to authenticate the payment.',
          },
        ],
      },
    ],
  },
  {
    name: 'on_behalf_of',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The connected account that is the settlement merchant for this payment, when using Connect.',
  },
  {
    name: 'payment_method',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'ID of the payment method used in this PaymentIntent.',
  },
  {
    name: 'payment_method_options',
    type: 'object',
    nullable: true,
    description:
      'Payment-method-specific configuration for this PaymentIntent.',
    expandable: true,
    children: [
      {
        name: 'crypto',
        type: 'object',
        nullable: true,
        description:
          'Configuration applied to crypto (USDC wallet) payment attempts.',
        expandable: true,
        children: [
          {
            name: 'setup_future_usage',
            type: 'enum',
            nullable: true,
            description:
              "Indicates that you intend to make future payments with this PaymentIntent's payment method.",
            enumValues: [{ value: 'none' }],
          },
        ],
      },
    ],
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless exposes only the <code>crypto</code> options bag for USDC wallet payments.',
  },
  {
    name: 'payment_method_types',
    type: 'array of strings',
    description:
      'The list of payment method types that this PaymentIntent is allowed to use. For Zoneless, this is typically <code>crypto</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless currently accepts <code>crypto</code> (USDC on Solana) rather than cards or other fiat rails.',
  },
  {
    name: 'receipt_email',
    type: 'string',
    nullable: true,
    description:
      'Email address that the receipt for the resulting payment will be sent to.',
  },
  {
    name: 'setup_future_usage',
    type: 'enum',
    nullable: true,
    description:
      "Indicates that you intend to make future payments with this PaymentIntent's payment method. If you provide a Customer, the payment method can attach after confirmation.",
    enumValues: [
      {
        value: 'off_session',
        description:
          'Use when your customer may or may not be present in your checkout flow.',
      },
      {
        value: 'on_session',
        description:
          'Use when you intend to reuse the payment method only while the customer is present.',
      },
    ],
  },
  {
    name: 'shipping',
    type: 'object',
    nullable: true,
    description: 'Shipping information for this PaymentIntent.',
    expandable: true,
    children: SHIPPING_OBJECT_CHILDREN,
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    nullable: true,
    description:
      'Text retained for API compatibility as a statement descriptor. Solana USDC transfers do not display bank statement descriptors.',
  },
  {
    name: 'statement_descriptor_suffix',
    type: 'string',
    nullable: true,
    description:
      'Suffix retained for API compatibility with statement descriptors. Blockchain transfers do not display bank statement descriptors.',
  },
  {
    name: 'status',
    type: 'enum',
    description: 'Status of this PaymentIntent.',
    enumValues: [
      {
        value: 'canceled',
        description: 'The PaymentIntent has been canceled.',
      },
      {
        value: 'processing',
        description: 'The PaymentIntent is currently being processed.',
      },
      {
        value: 'requires_action',
        description:
          'The PaymentIntent requires additional action from the customer.',
      },
      {
        value: 'requires_capture',
        description:
          'The PaymentIntent has been confirmed and requires capture.',
      },
      {
        value: 'requires_confirmation',
        description: 'The PaymentIntent requires confirmation.',
      },
      {
        value: 'requires_payment_method',
        description:
          'The PaymentIntent requires a payment method to be attached.',
      },
      { value: 'succeeded', description: 'The PaymentIntent has succeeded.' },
    ],
  },
  {
    name: 'transfer_data',
    type: 'object',
    nullable: true,
    description:
      'The data that automatically creates a Transfer after the payment finalizes. Used with connected accounts.',
    expandable: true,
    children: [
      {
        name: 'amount',
        type: 'integer',
        nullable: true,
        description:
          'The amount transferred to the destination account. Defaults to the entire payment amount when omitted.',
      },
      {
        name: 'description',
        type: 'string',
        nullable: true,
        description: 'An arbitrary string attached to the transfer.',
      },
      {
        name: 'destination',
        type: 'string',
        tooltip: EXPAND_TOOLTIP,
        description:
          'The account the payment is attributed to for tax reporting, and where funds are transferred after payment success.',
      },
      {
        name: 'metadata',
        type: 'object',
        nullable: true,
        description: 'Set of key-value pairs attached to the transfer.',
      },
      {
        name: 'payment_data',
        type: 'object',
        nullable: true,
        description: 'Data used to populate the destination payment.',
        expandable: true,
        children: [
          {
            name: 'description',
            type: 'string',
            nullable: true,
            description:
              'An arbitrary string attached to the destination payment.',
          },
          {
            name: 'metadata',
            type: 'object',
            nullable: true,
            description:
              'Set of key-value pairs attached to the destination payment.',
          },
        ],
      },
    ],
  },
  {
    name: 'transfer_group',
    type: 'string',
    nullable: true,
    description:
      'A string that identifies the resulting payment as part of a group.',
  },
];

const PAYMENT_INTENT_MORE_ATTRIBUTES: Attribute[] = [
  {
    name: 'excluded_payment_method_types',
    type: 'array of strings',
    nullable: true,
    description:
      'The list of payment method types to exclude from use with this payment.',
  },
  {
    name: 'hooks',
    type: 'object',
    nullable: true,
    description: 'Automations to run during the PaymentIntent lifecycle.',
    expandable: true,
    children: [
      {
        name: 'inputs',
        type: 'object',
        nullable: true,
        description: 'Arguments passed into automations.',
        expandable: true,
        children: [
          {
            name: 'tax',
            type: 'object',
            nullable: true,
            description: 'Tax arguments.',
            expandable: true,
            children: [
              {
                name: 'calculation',
                type: 'string',
                description: 'The TaxCalculation ID.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'managed_payments',
    type: 'object',
    nullable: true,
    description: 'Settings for managed payments.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Whether managed payments is enabled for this transaction.',
      },
    ],
  },
  {
    name: 'payment_details',
    type: 'object',
    nullable: true,
    description: 'Payment details for this PaymentIntent.',
    expandable: true,
    children: [
      {
        name: 'customer_reference',
        type: 'string',
        nullable: true,
        description: 'A unique value to identify the customer.',
      },
      {
        name: 'order_reference',
        type: 'string',
        nullable: true,
        description:
          'A unique value assigned by the business to identify the transaction.',
      },
    ],
  },
  {
    name: 'payment_method_configuration_details',
    type: 'object',
    nullable: true,
    description:
      'Information about the payment method configuration used for this PaymentIntent.',
    expandable: true,
    children: [
      {
        name: 'id',
        type: 'string',
        description: 'ID of the payment method configuration used.',
      },
      {
        name: 'parent',
        type: 'string',
        nullable: true,
        description: 'ID of the parent payment method configuration used.',
      },
    ],
  },
  {
    name: 'presentment_details',
    type: 'object',
    nullable: true,
    description:
      'Information about the currency presentation to the customer, including the displayed currency and amount.',
    expandable: true,
    children: [
      {
        name: 'presentment_amount',
        type: 'integer',
        description:
          'Amount intended to be collected, denominated in <code>presentment_currency</code>.',
      },
      {
        name: 'presentment_currency',
        type: 'string',
        description: 'Currency presented to the customer during payment.',
      },
    ],
  },
  {
    name: 'processing',
    type: 'object',
    nullable: true,
    description: 'If present, describes the processing state of the payment.',
  },
  {
    name: 'review',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'ID of the review associated with this PaymentIntent, if any.',
  },
  {
    name: 'shared_payment_granted_token',
    type: 'string',
    nullable: true,
    description:
      'ID of the shared payment token granted for use with this PaymentIntent.',
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

export const PAYMENT_INTENTS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The PaymentIntent object',
  description:
    'A PaymentIntent guides you through collecting a payment from your customer. Create one PaymentIntent per order or customer session, then reference it later to inspect the history of payment attempts for that session.',
  stripeDocsUrl: 'https://docs.stripe.com/api/payment_intents',
  endpoints: BuildEndpointSummaries(PAYMENT_INTENTS_SUBSECTION, [
    { method: 'POST', path: '/v1/payment_intents', pageId: 'create' },
    { method: 'POST', path: '/v1/payment_intents/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/payment_intents/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/payment_intents', pageId: 'list' },
    {
      method: 'GET',
      path: '/v1/payment_intents/:id/amount_details_line_items',
      pageId: 'amount-details-line-items',
    },
    {
      method: 'POST',
      path: '/v1/payment_intents/:id/cancel',
      pageId: 'cancel',
    },
  ]),
  events: GetResourceEventAttributes('payment_intent'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: 'A PaymentIntent transitions through multiple statuses as the customer authorizes a USDC wallet payment on Solana. Successful confirmation creates at most one Charge.',
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: PAYMENT_INTENT_ATTRIBUTES,
          moreAttributes: PAYMENT_INTENT_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE PAYMENTINTENT OBJECT',
          code: PAYMENT_INTENT_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create
// ============================================

const CREATE_PAYMENT_INTENT_PARAMETERS: Attribute[] = [
  {
    name: 'amount',
    type: 'integer',
    required: true,
    description:
      'Amount intended to be collected by this PaymentIntent. A positive integer in the smallest currency unit. For USDC, this is cents (e.g., 100 = $1 USDC). Supports up to eight digits.',
  },
  {
    name: 'currency',
    type: 'string',
    description:
      'Three-letter currency code, in lowercase. Defaults to <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless currently accepts only <code>usdc</code>.',
  },
  {
    name: 'automatic_payment_methods',
    type: 'object',
    description:
      'When enabled, this PaymentIntent accepts payment methods that are compatible with its other parameters.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        required: true,
        description: 'Whether this feature is enabled.',
      },
      {
        name: 'allow_redirects',
        type: 'enum',
        description:
          'Controls whether this PaymentIntent accepts redirect-based payment methods.',
        enumValues: [
          {
            value: 'always',
            description: '(Default) Accept redirect-based payment methods.',
          },
          {
            value: 'never',
            description: 'Do not accept redirect-based payment methods.',
          },
        ],
      },
    ],
  },
  {
    name: 'confirm',
    type: 'boolean',
    description:
      'Set to <code>true</code> to attempt to confirm this PaymentIntent immediately. Defaults to <code>false</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Creating and confirming in a single request is not yet supported. Create the PaymentIntent, then complete payment through your checkout or wallet flow.',
  },
  {
    name: 'customer',
    type: 'string',
    description:
      'ID of the Customer this PaymentIntent belongs to, if one exists. Payment methods attached to other Customers cannot be used with this PaymentIntent.',
  },
  {
    name: 'description',
    type: 'string',
    description:
      'An arbitrary string attached to the object. Often useful for displaying to users.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'payment_method',
    type: 'string',
    description:
      "ID of the payment method to attach to this PaymentIntent. If the payment method is attached to a Customer, you must also provide that Customer's ID.",
  },
  {
    name: 'payment_method_types',
    type: 'array of strings',
    description:
      'The list of payment method types that this PaymentIntent can use. For Zoneless, pass <code>crypto</code>.',
    enumValues: [
      {
        value: 'crypto',
        description: 'USDC wallet payments on Solana.',
      },
    ],
  },
];

const CREATE_PAYMENT_INTENT_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'amount_details',
    type: 'object',
    description: 'Provides industry-specific information about the amount.',
    expandable: true,
    children: AMOUNT_DETAILS_PARAM_CHILDREN,
  },
  {
    name: 'application_fee_amount',
    type: 'integer',
    description:
      "The amount of the application fee (if any) that will be applied to the payment and transferred to the application owner's account. Capped at the total amount captured.",
  },
  {
    name: 'capture_method',
    type: 'enum',
    description:
      "Controls when funds are captured from the customer's account.",
    enumValues: [
      {
        value: 'automatic',
        description: 'Capture funds when the customer authorizes the payment.',
      },
      {
        value: 'automatic_async',
        description:
          '(Default) Capture funds asynchronously when the customer authorizes the payment.',
      },
      {
        value: 'manual',
        description:
          'Place a hold and capture funds later. Not all payment methods support this.',
      },
    ],
  },
  {
    name: 'confirmation_method',
    type: 'enum',
    description:
      'Describes whether this PaymentIntent can be confirmed automatically, or requires server-side confirmation.',
    enumValues: [
      {
        value: 'automatic',
        description: '(Default) Confirmable with a publishable key.',
      },
      {
        value: 'manual',
        description: 'Requires secret-key confirmation for each attempt.',
      },
    ],
  },
  {
    name: 'customer_account',
    type: 'string',
    description:
      'ID of the Account representing the customer that this PaymentIntent belongs to, if one exists.',
  },
  {
    name: 'excluded_payment_method_types',
    type: 'array of strings',
    description:
      'The list of payment method types to exclude from use with this payment.',
  },
  {
    name: 'hooks',
    type: 'object',
    description: 'Automations to run during the PaymentIntent lifecycle.',
    expandable: true,
    children: [
      {
        name: 'inputs',
        type: 'object',
        description: 'Arguments passed into automations.',
        expandable: true,
        children: [
          {
            name: 'tax',
            type: 'object',
            description: 'Tax arguments for automations.',
            expandable: true,
            children: [
              {
                name: 'calculation',
                type: 'string',
                required: true,
                description: 'The TaxCalculation ID.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'on_behalf_of',
    type: 'string',
    description: 'The connected account ID for which these funds are intended.',
  },
  {
    name: 'payment_details',
    type: 'object',
    description: 'Provides industry-specific information about the charge.',
    expandable: true,
    children: [
      {
        name: 'customer_reference',
        type: 'string',
        description: 'A unique value to identify the customer.',
      },
      {
        name: 'order_reference',
        type: 'string',
        description:
          'A unique value assigned by the business to identify the transaction.',
      },
    ],
  },
  {
    name: 'payment_method_configuration',
    type: 'string',
    description:
      'The ID of the payment method configuration to use with this PaymentIntent.',
  },
  {
    name: 'payment_method_options',
    type: 'object',
    description:
      'Payment-method-specific configuration for this PaymentIntent.',
    expandable: true,
    children: PAYMENT_METHOD_OPTIONS_PARAM_CHILDREN,
  },
  {
    name: 'receipt_email',
    type: 'string',
    description: 'Email address to send the receipt to.',
  },
  {
    name: 'setup_future_usage',
    type: 'enum',
    description:
      "Indicates that you intend to make future payments with this PaymentIntent's payment method.",
    enumValues: [{ value: 'off_session' }, { value: 'on_session' }],
  },
  {
    name: 'shipping',
    type: 'object',
    description: 'Shipping information for this PaymentIntent.',
    expandable: true,
    children: SHIPPING_PARAM_CHILDREN,
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    description:
      'Text retained for API compatibility as a statement descriptor. Limited to 22 characters. Blockchain transfers do not display bank statement descriptors.',
  },
  {
    name: 'statement_descriptor_suffix',
    type: 'string',
    description:
      'Suffix retained for API compatibility with statement descriptors.',
  },
  {
    name: 'transfer_data',
    type: 'object',
    description:
      'Parameters used to automatically create a Transfer when the payment succeeds. Used with connected accounts.',
    expandable: true,
    children: TRANSFER_DATA_PARAM_CHILDREN,
  },
  {
    name: 'transfer_group',
    type: 'string',
    description:
      'A string that identifies the resulting payment as part of a group.',
  },
];

export const PAYMENT_INTENTS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a PaymentIntent',
  description:
    'Creates a PaymentIntent object. After creation, attach a payment method and confirm the PaymentIntent to continue the payment. When you later confirm successfully, Zoneless creates the Charge that records the USDC settlement.',
  endpoints: [{ method: 'POST', path: '/v1/payment_intents' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Recommended flow: ',
          text: 'Create exactly one PaymentIntent per order or checkout session. Complete payment through your wallet or Checkout flow so the PaymentIntent can transition to succeeded.',
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_PAYMENT_INTENT_PARAMETERS,
          moreAttributes: CREATE_PAYMENT_INTENT_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a PaymentIntent object.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/payment_intents' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/payment_intents \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d amount=3500 \\
  -d currency=usdc \\
  -d "automatic_payment_methods[enabled]"=true`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const paymentIntent = await zoneless.paymentIntents.create({
  amount: 3500,
  currency: 'usdc',
  automatic_payment_methods: {
    enabled: true,
  },
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: PAYMENT_INTENT_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Update
// ============================================

const UPDATE_PAYMENT_INTENT_PARAMETERS: Attribute[] = [
  {
    name: 'amount',
    type: 'integer',
    description:
      'Amount intended to be collected by this PaymentIntent. A positive integer in the smallest currency unit. For USDC, this is cents.',
  },
  {
    name: 'currency',
    type: 'string',
    description:
      'Three-letter currency code, in lowercase. For Zoneless, use <code>usdc</code>.',
  },
  {
    name: 'customer',
    type: 'string',
    description:
      'ID of the Customer this PaymentIntent belongs to, if one exists.',
  },
  {
    name: 'description',
    type: 'string',
    description:
      'An arbitrary string attached to the object. Often useful for displaying to users.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'payment_method',
    type: 'string',
    description:
      'ID of the payment method to attach to this PaymentIntent. To unset this field, pass an empty string. Updating <code>payment_method</code> typically requires confirming the PaymentIntent again.',
  },
  {
    name: 'receipt_email',
    type: 'string',
    description:
      'Email address that the receipt for the resulting payment will be sent to.',
  },
  {
    name: 'shipping',
    type: 'object',
    description: 'Shipping information for this PaymentIntent.',
    expandable: true,
    children: SHIPPING_PARAM_CHILDREN,
  },
];

const UPDATE_PAYMENT_INTENT_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'amount_details',
    type: 'object',
    description: 'Provides industry-specific information about the amount.',
    expandable: true,
    children: AMOUNT_DETAILS_PARAM_CHILDREN,
  },
  {
    name: 'application_fee_amount',
    type: 'integer',
    description:
      "The amount of the application fee (if any) that will be applied to the payment and transferred to the application owner's account.",
  },
  {
    name: 'capture_method',
    type: 'enum',
    description:
      "Controls when funds are captured from the customer's account.",
    enumValues: [
      { value: 'automatic' },
      { value: 'automatic_async' },
      { value: 'manual' },
    ],
  },
  {
    name: 'customer_account',
    type: 'string',
    description:
      'ID of the Account representing the customer that this PaymentIntent belongs to, if one exists.',
  },
  {
    name: 'excluded_payment_method_types',
    type: 'array of strings',
    description:
      'The list of payment method types to exclude from use with this payment.',
  },
  {
    name: 'hooks',
    type: 'object',
    description: 'Automations to run during the PaymentIntent lifecycle.',
    expandable: true,
    children: [
      {
        name: 'inputs',
        type: 'object',
        description: 'Arguments passed into automations.',
        expandable: true,
        children: [
          {
            name: 'tax',
            type: 'object',
            description: 'Tax arguments for automations.',
            expandable: true,
            children: [
              {
                name: 'calculation',
                type: 'string',
                required: true,
                description: 'The TaxCalculation ID.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'payment_details',
    type: 'object',
    description: 'Provides industry-specific information about the charge.',
    expandable: true,
    children: [
      {
        name: 'customer_reference',
        type: 'string',
        description: 'A unique value to identify the customer.',
      },
      {
        name: 'order_reference',
        type: 'string',
        description:
          'A unique value assigned by the business to identify the transaction.',
      },
    ],
  },
  {
    name: 'payment_method_configuration',
    type: 'string',
    description:
      'The ID of the payment method configuration to use with this PaymentIntent.',
  },
  {
    name: 'payment_method_options',
    type: 'object',
    description:
      'Payment-method-specific configuration for this PaymentIntent.',
    expandable: true,
    children: PAYMENT_METHOD_OPTIONS_PARAM_CHILDREN,
  },
  {
    name: 'payment_method_types',
    type: 'array of strings',
    description:
      'The list of payment method types that this PaymentIntent can use. For Zoneless, pass <code>crypto</code>.',
    enumValues: [{ value: 'crypto' }],
  },
  {
    name: 'setup_future_usage',
    type: 'enum',
    description:
      "Indicates that you intend to make future payments with this PaymentIntent's payment method. If already set and you are using a publishable key, you can only update from <code>on_session</code> to <code>off_session</code>.",
    enumValues: [{ value: 'off_session' }, { value: 'on_session' }],
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    description:
      'Text retained for API compatibility as a statement descriptor. Limited to 22 characters.',
  },
  {
    name: 'statement_descriptor_suffix',
    type: 'string',
    description:
      'Suffix retained for API compatibility with statement descriptors.',
  },
  {
    name: 'transfer_data',
    type: 'object',
    description:
      'Use this parameter to update transfer data when a Transfer will be created after payment success. <code>destination</code> can only be set at create time.',
    expandable: true,
    children: [
      {
        name: 'amount',
        type: 'integer',
        description:
          'The amount transferred automatically when a charge succeeds.',
      },
      {
        name: 'description',
        type: 'string',
        description: 'An arbitrary string attached to the transfer.',
      },
      {
        name: 'metadata',
        type: 'object',
        description: 'Set of key-value pairs attached to the transfer.',
      },
      {
        name: 'payment_data',
        type: 'object',
        description: 'Data used to populate the destination payment.',
        expandable: true,
        children: [
          {
            name: 'description',
            type: 'string',
            description:
              'An arbitrary string attached to the destination payment.',
          },
          {
            name: 'metadata',
            type: 'object',
            description:
              'Set of key-value pairs attached to the destination payment.',
          },
        ],
      },
    ],
  },
  {
    name: 'transfer_group',
    type: 'string',
    description:
      'A string that identifies the resulting payment as part of a group. You can only provide <code>transfer_group</code> if it has not already been set.',
  },
];

export const PAYMENT_INTENTS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a PaymentIntent',
  description:
    'Updates properties on a PaymentIntent object without confirming. Depending on which properties you update, you might need to confirm the PaymentIntent again—for example, updating <code>payment_method</code> always requires confirmation.',
  endpoints: [{ method: 'POST', path: '/v1/payment_intents/:id' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Note: ',
          text: 'A PaymentIntent can only be updated while its status is requires_payment_method, requires_confirmation, or requires_action.',
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_PAYMENT_INTENT_PARAMETERS,
          moreAttributes: UPDATE_PAYMENT_INTENT_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a PaymentIntent object.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/payment_intents/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/payment_intents/pi_z_3PqK8mLkdIwHu7ix2nR5wT9b \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[order_id]"=9142`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const paymentIntent = await zoneless.paymentIntents.update(
  'pi_z_3PqK8mLkdIwHu7ix2nR5wT9b',
  {
    metadata: {
      order_id: '9142',
    },
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: PAYMENT_INTENT_UPDATE_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Retrieve
// ============================================

const RETRIEVE_PAYMENT_INTENT_PARAMETERS: Attribute[] = [
  {
    name: 'client_secret',
    type: 'string',
    requiredText: 'Required if you use a publishable key.',
    description:
      'The client secret of the PaymentIntent. Required when retrieving with a publishable key.',
  },
];

export const PAYMENT_INTENTS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a PaymentIntent',
  description:
    'Retrieves the details of a PaymentIntent that has previously been created. You can retrieve a PaymentIntent client-side using a publishable key when the <code>client_secret</code> is provided. With a publishable key, only a subset of properties is returned.',
  endpoints: [{ method: 'GET', path: '/v1/payment_intents/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: RETRIEVE_PAYMENT_INTENT_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a PaymentIntent if a valid identifier was provided.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/payment_intents/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/payment_intents/pi_z_3PqK8mLkdIwHu7ix2nR5wT9b \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const paymentIntent = await zoneless.paymentIntents.retrieve(
  'pi_z_3PqK8mLkdIwHu7ix2nR5wT9b'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: PAYMENT_INTENT_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// List
// ============================================

const LIST_PAYMENT_INTENTS_PARAMETERS: Attribute[] = [
  {
    name: 'customer',
    type: 'string',
    description:
      'Only return PaymentIntents for the customer specified by this customer ID.',
  },
  {
    name: 'customer_account',
    type: 'string',
    description:
      'Only return PaymentIntents for the account representing the customer specified by this ID.',
  },
  {
    name: 'status',
    type: 'enum',
    description: 'Only return PaymentIntents with this status.',
    enumValues: [
      { value: 'canceled' },
      { value: 'processing' },
      { value: 'requires_action' },
      { value: 'requires_capture' },
      { value: 'requires_confirmation' },
      { value: 'requires_payment_method' },
      { value: 'succeeded' },
      {
        value: 'incomplete',
        description:
          'Convenience filter for every non-succeeded, non-canceled status (matches the Incomplete badge in list UIs).',
      },
    ],
    enumNote:
      '<strong>Zoneless extension:</strong> The <code>incomplete</code> filter expands to all open PaymentIntent statuses for dashboard-style list views.',
  },
];

const LIST_PAYMENT_INTENTS_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'created',
    type: 'object',
    description:
      'Only return PaymentIntents that were created during the given date interval.',
    expandable: true,
    children: TIMESTAMP_RANGE_CHILDREN,
  },
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>pi_z_bar</code>, your subsequent call can include <code>ending_before=pi_z_bar</code> in order to fetch the previous page of the list.',
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
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>pi_z_foo</code>, your subsequent call can include <code>starting_after=pi_z_foo</code> in order to fetch the next page of the list.',
  },
];

export const PAYMENT_INTENTS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all PaymentIntents',
  description: 'Returns a list of PaymentIntents.',
  endpoints: [{ method: 'GET', path: '/v1/payment_intents' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_PAYMENT_INTENTS_PARAMETERS,
          moreAttributes: LIST_PAYMENT_INTENTS_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> PaymentIntents, starting after PaymentIntent <code>starting_after</code>. Each entry in the array is a separate <a href="#payment-intents-object">PaymentIntent</a> object. If no more PaymentIntents are available, the resulting array is empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/payment_intents' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/payment_intents \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const paymentIntents = await zoneless.paymentIntents.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_PAYMENT_INTENTS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// List amount details line items
// ============================================

const LIST_LINE_ITEMS_PARAMETERS: Attribute[] = [
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list.',
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
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list.',
  },
];

export const PAYMENT_INTENTS_AMOUNT_DETAILS_LINE_ITEMS_PAGE: DocPage = {
  id: 'amount-details-line-items',
  title: 'List amount details line items',
  description:
    'Lists all line items under <code>amount_details</code> for a given PaymentIntent.',
  endpoints: [
    {
      method: 'GET',
      path: '/v1/payment_intents/:id/amount_details_line_items',
    },
  ],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_LINE_ITEMS_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> line items for the given PaymentIntent, starting after line item <code>starting_after</code>. Each entry in the array is a separate line item object. If no more line items are available, the resulting array is empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'GET',
            path: '/v1/payment_intents/:id/amount_details_line_items',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/payment_intents/pi_z_3PqK8mLkdIwHu7ix2nR5wT9b/amount_details_line_items \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const lineItems = await zoneless.paymentIntents.listAmountDetailsLineItems(
  'pi_z_3PqK8mLkdIwHu7ix2nR5wT9b'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_LINE_ITEMS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Cancel
// ============================================

const CANCEL_PAYMENT_INTENT_PARAMETERS: Attribute[] = [
  {
    name: 'cancellation_reason',
    type: 'enum',
    description: 'Reason for canceling this PaymentIntent.',
    enumValues: [
      { value: 'abandoned' },
      { value: 'duplicate' },
      { value: 'fraudulent' },
      { value: 'requested_by_customer' },
    ],
  },
];

export const PAYMENT_INTENTS_CANCEL_PAGE: DocPage = {
  id: 'cancel',
  title: 'Cancel a PaymentIntent',
  description:
    'You can cancel a PaymentIntent when its status is <code>requires_payment_method</code>, <code>requires_capture</code>, <code>requires_confirmation</code>, <code>requires_action</code>, or (in rare cases) <code>processing</code>. After cancellation, no additional charges are made and operations on the PaymentIntent fail with an error. For PaymentIntents in <code>requires_capture</code>, the remaining <code>amount_capturable</code> is automatically refunded.',
  endpoints: [{ method: 'POST', path: '/v1/payment_intents/:id/cancel' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CANCEL_PAYMENT_INTENT_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: "Returns a PaymentIntent object if the cancellation succeeds. Returns an error if the PaymentIntent is already canceled or isn't in a cancelable state.",
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/payment_intents/:id/cancel' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/payment_intents/pi_z_3PqK8mLkdIwHu7ix2nR5wT9b/cancel \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d cancellation_reason=requested_by_customer`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const paymentIntent = await zoneless.paymentIntents.cancel(
  'pi_z_3PqK8mLkdIwHu7ix2nR5wT9b',
  {
    cancellation_reason: 'requested_by_customer',
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: PAYMENT_INTENT_CANCEL_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const PAYMENT_INTENTS_PAGES: DocPage[] = [
  PAYMENT_INTENTS_OVERVIEW_PAGE,
  PAYMENT_INTENTS_CREATE_PAGE,
  PAYMENT_INTENTS_UPDATE_PAGE,
  PAYMENT_INTENTS_RETRIEVE_PAGE,
  PAYMENT_INTENTS_LIST_PAGE,
  PAYMENT_INTENTS_AMOUNT_DETAILS_LINE_ITEMS_PAGE,
  PAYMENT_INTENTS_CANCEL_PAGE,
];
