import { DocSubSection, DocPage, Attribute } from './types';
import { NODE_INIT, EXPAND_TOOLTIP, BuildEndpointSummaries } from './shared';
import { GetResourceEventAttributes } from './event-types';

export const CHECKOUT_SESSIONS_SUBSECTION: DocSubSection = {
  id: 'checkout-sessions',
  title: 'Checkout Sessions',
  children: [
    { id: 'object', title: 'The Checkout Session object' },
    { id: 'create', title: 'Create a Checkout Session' },
    { id: 'update', title: 'Update a Checkout Session' },
    { id: 'retrieve', title: 'Retrieve a Checkout Session' },
    { id: 'list', title: 'List all Checkout Sessions' },
    { id: 'expire', title: 'Expire a Checkout Session' },
    {
      id: 'list-line-items',
      title: "Retrieve a Checkout Session's line items",
    },
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
    name: 'line1',
    type: 'string',
    required: true,
    description: 'Address line 1, such as the street, PO Box, or company name.',
  },
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

const ADJUSTABLE_QUANTITY_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'enabled',
    type: 'boolean',
    required: true,
    description:
      'Set to <code>true</code> to allow the customer to adjust the line item quantity at checkout.',
  },
  {
    name: 'maximum',
    type: 'integer',
    description:
      'The maximum quantity the customer can purchase. Must be between 1 and 999999.',
  },
  {
    name: 'minimum',
    type: 'integer',
    description:
      'The minimum quantity the customer can purchase. Must be 0 or greater.',
  },
];

const PRODUCT_DATA_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'name',
    type: 'string',
    required: true,
    description: 'The product name, meant to be displayable to the customer.',
  },
  {
    name: 'description',
    type: 'string',
    description:
      'The product description, meant to be displayable to the customer.',
  },
  {
    name: 'images',
    type: 'array of strings',
    description:
      'A list of up to 8 image URLs, meant to be displayable to the customer.',
  },
  {
    name: 'metadata',
    type: 'object',
    description: 'Set of key-value pairs that you can attach to the product.',
  },
  { name: 'tax_code', type: 'string', description: 'A tax code ID.' },
];

const PRICE_DATA_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'currency',
    type: 'string',
    required: true,
    description:
      'Three-letter currency code, in lowercase. For Zoneless, use <code>usdc</code>.',
  },
  {
    name: 'product',
    type: 'string',
    requiredText: 'Required unless product_data is provided',
    description: 'The ID of the product this price belongs to.',
  },
  {
    name: 'product_data',
    type: 'object',
    requiredText: 'Required unless product is provided',
    description: 'Data used to generate a new Product object inline.',
    expandable: true,
    children: PRODUCT_DATA_PARAM_CHILDREN,
  },
  {
    name: 'recurring',
    type: 'object',
    description:
      'The recurring components of a price used for subscription-mode line items.',
    expandable: true,
    children: [
      {
        name: 'interval',
        type: 'enum',
        required: true,
        description: 'The frequency at which a subscription is billed.',
        enumValues: [
          { value: 'day' },
          { value: 'week' },
          { value: 'month' },
          { value: 'year' },
        ],
      },
      {
        name: 'interval_count',
        type: 'integer',
        description:
          'The number of intervals between subscription billings. Defaults to 1.',
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
    requiredText: 'Required unless unit_amount_decimal is provided',
    description:
      'A positive integer in the smallest currency unit representing the amount to charge.',
  },
  {
    name: 'unit_amount_decimal',
    type: 'string',
    requiredText: 'Required unless unit_amount is provided',
    description:
      'Same as <code>unit_amount</code>, but accepts a decimal string with at most 12 decimal places.',
  },
];

const CREATE_LINE_ITEM_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'price',
    type: 'string',
    requiredText: 'Required unless price_data is provided',
    description:
      'The ID of the price object. One of <code>price</code> or <code>price_data</code> is required.',
  },
  {
    name: 'price_data',
    type: 'object',
    requiredText: 'Required unless price is provided',
    description:
      'Data used to generate a new Price object inline for this line item.',
    expandable: true,
    children: PRICE_DATA_PARAM_CHILDREN,
  },
  {
    name: 'quantity',
    type: 'integer',
    description: 'The quantity of the line item being purchased.',
  },
  {
    name: 'adjustable_quantity',
    type: 'object',
    description:
      'When set, provides configuration for the customer to adjust the quantity of the line item at checkout.',
    expandable: true,
    children: ADJUSTABLE_QUANTITY_PARAM_CHILDREN,
  },
  {
    name: 'metadata',
    type: 'object',
    description: 'Set of key-value pairs that you can attach to the line item.',
  },
  {
    name: 'tax_rates',
    type: 'array of strings',
    description: 'The tax rate IDs that apply to this line item.',
  },
  {
    name: 'dynamic_tax_rates',
    type: 'array of strings',
    description: 'The dynamic tax rate IDs that apply to this line item.',
  },
];

const UPDATE_LINE_ITEM_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    requiredText: 'Required to retain or update an existing line item',
    description:
      'The ID of an existing line item on the Checkout Session. To retain a line item unchanged, specify only its <code>id</code>. To update one, specify its <code>id</code> along with the fields to change.',
  },
  {
    name: 'price',
    type: 'string',
    requiredText:
      'Required to add a new line item, unless price_data is provided',
    description:
      'The ID of the price object. Omit <code>id</code> when adding a new line item.',
  },
  {
    name: 'price_data',
    type: 'object',
    requiredText: 'Required to add a new line item, unless price is provided',
    description:
      'Data used to generate a new Price object inline for this line item.',
    expandable: true,
    children: PRICE_DATA_PARAM_CHILDREN,
  },
  {
    name: 'quantity',
    type: 'integer',
    description: 'The quantity of the line item being purchased.',
  },
  {
    name: 'adjustable_quantity',
    type: 'object',
    description:
      'When set, provides configuration for the customer to adjust the quantity of the line item at checkout.',
    expandable: true,
    children: ADJUSTABLE_QUANTITY_PARAM_CHILDREN,
  },
  {
    name: 'metadata',
    type: 'object',
    description: 'Set of key-value pairs that you can attach to the line item.',
  },
  {
    name: 'tax_rates',
    type: 'array of strings',
    description: 'The tax rate IDs that apply to this line item.',
  },
];

const SHIPPING_OPTION_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'shipping_rate',
    type: 'string',
    requiredText: 'Required unless shipping_rate_data is provided',
    description: 'The ID of the ShippingRate to use for this shipping option.',
  },
  {
    name: 'shipping_rate_data',
    type: 'object',
    requiredText: 'Required unless shipping_rate is provided',
    description: 'Data used to generate a new ShippingRate object inline.',
    expandable: true,
    children: [
      {
        name: 'display_name',
        type: 'string',
        required: true,
        description:
          'The name of the shipping rate, meant to be displayable to the customer.',
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
            description: 'The upper bound of the estimated range.',
            expandable: true,
            children: [
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
            ],
          },
          {
            name: 'minimum',
            type: 'object',
            description: 'The lower bound of the estimated range.',
            expandable: true,
            children: [
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
            ],
          },
        ],
      },
      {
        name: 'fixed_amount',
        type: 'object',
        description: 'Describes a fixed amount to charge for shipping.',
        expandable: true,
        children: [
          {
            name: 'amount',
            type: 'integer',
            required: true,
            description:
              'A non-negative integer in the smallest currency unit representing the shipping charge.',
          },
          {
            name: 'currency',
            type: 'string',
            required: true,
            description: 'Three-letter currency code, in lowercase.',
          },
        ],
      },
      {
        name: 'metadata',
        type: 'object',
        description:
          'Set of key-value pairs that you can attach to the shipping rate.',
      },
      {
        name: 'tax_behavior',
        type: 'enum',
        description:
          'Specifies whether the rate is considered inclusive of taxes or exclusive of taxes.',
        enumValues: [
          { value: 'exclusive' },
          { value: 'inclusive' },
          { value: 'unspecified' },
        ],
      },
      { name: 'tax_code', type: 'string', description: 'A tax code ID.' },
    ],
  },
];

// ============================================
// Shared example objects
// ============================================

const CHECKOUT_SESSION_OBJECT_JSON = `{
  "id": "cs_z_a8KmQ2vLpR5wT9bHxJcFnW4uY",
  "object": "checkout.session",
  "after_expiration": null,
  "allow_promotion_codes": null,
  "amount_subtotal": 4598,
  "amount_total": 4598,
  "automatic_tax": {
    "enabled": false,
    "liability": null,
    "provider": null,
    "status": null
  },
  "billing_address_collection": null,
  "branding_settings": null,
  "cancel_url": null,
  "client_reference_id": null,
  "client_secret": null,
  "collected_information": null,
  "consent": null,
  "consent_collection": null,
  "created": 1723910400,
  "currency": "usdc",
  "custom_fields": [],
  "custom_text": {
    "after_submit": null,
    "shipping_address": null,
    "submit": null,
    "terms_of_service_acceptance": null
  },
  "customer": null,
  "customer_account": null,
  "customer_creation": "if_required",
  "customer_details": null,
  "customer_email": null,
  "discounts": null,
  "expires_at": 1723996800,
  "invoice": null,
  "invoice_creation": {
    "enabled": false,
    "invoice_data": {
      "account_tax_ids": null,
      "custom_fields": null,
      "description": null,
      "footer": null,
      "issuer": null,
      "metadata": {},
      "rendering_options": null
    }
  },
  "livemode": false,
  "locale": null,
  "metadata": {},
  "mode": "payment",
  "payment_intent": null,
  "payment_link": null,
  "payment_method_collection": "always",
  "payment_method_options": {
    "crypto": {}
  },
  "payment_method_types": [
    "crypto"
  ],
  "payment_status": "unpaid",
  "phone_number_collection": {
    "enabled": false
  },
  "recovered_from": null,
  "setup_intent": null,
  "shipping_address_collection": null,
  "shipping_cost": null,
  "shipping_options": [],
  "status": "open",
  "submit_type": null,
  "subscription": null,
  "success_url": "https://shop.example.com/order/complete",
  "total_details": {
    "amount_discount": 0,
    "amount_shipping": 0,
    "amount_tax": 0
  },
  "ui_mode": "hosted_page",
  "url": "https://checkout.yourdomain.com/c/x7k9m2p4q8",
  "return_url": null,
  "platform_account": "acct_z_Platform123abc",
  "url_slug": "x7k9m2p4q8",
  "payment_details": null
}`;

const CHECKOUT_SESSION_UPDATE_RESPONSE_JSON = `{
  "id": "cs_z_a8KmQ2vLpR5wT9bHxJcFnW4uY",
  "object": "checkout.session",
  "after_expiration": null,
  "allow_promotion_codes": null,
  "amount_subtotal": 4598,
  "amount_total": 4598,
  "automatic_tax": {
    "enabled": false,
    "liability": null,
    "provider": null,
    "status": null
  },
  "billing_address_collection": null,
  "branding_settings": null,
  "cancel_url": null,
  "client_reference_id": null,
  "client_secret": null,
  "collected_information": null,
  "consent": null,
  "consent_collection": null,
  "created": 1723910400,
  "currency": "usdc",
  "custom_fields": [],
  "custom_text": {
    "after_submit": null,
    "shipping_address": null,
    "submit": null,
    "terms_of_service_acceptance": null
  },
  "customer": null,
  "customer_account": null,
  "customer_creation": "if_required",
  "customer_details": null,
  "customer_email": null,
  "discounts": null,
  "expires_at": 1723996800,
  "invoice": null,
  "invoice_creation": {
    "enabled": false,
    "invoice_data": {
      "account_tax_ids": null,
      "custom_fields": null,
      "description": null,
      "footer": null,
      "issuer": null,
      "metadata": {},
      "rendering_options": null
    }
  },
  "livemode": false,
  "locale": null,
  "metadata": {
    "order_id": "8841"
  },
  "mode": "payment",
  "payment_intent": null,
  "payment_link": null,
  "payment_method_collection": "always",
  "payment_method_options": {
    "crypto": {}
  },
  "payment_method_types": [
    "crypto"
  ],
  "payment_status": "unpaid",
  "phone_number_collection": {
    "enabled": false
  },
  "recovered_from": null,
  "setup_intent": null,
  "shipping_address_collection": null,
  "shipping_cost": null,
  "shipping_options": [],
  "status": "open",
  "submit_type": null,
  "subscription": null,
  "success_url": "https://shop.example.com/order/complete",
  "total_details": {
    "amount_discount": 0,
    "amount_shipping": 0,
    "amount_tax": 0
  },
  "ui_mode": "hosted_page",
  "url": "https://checkout.yourdomain.com/c/x7k9m2p4q8",
  "return_url": null,
  "platform_account": "acct_z_Platform123abc",
  "url_slug": "x7k9m2p4q8",
  "payment_details": null
}`;

const CHECKOUT_SESSION_EXPIRE_RESPONSE_JSON = `{
  "id": "cs_z_b3Ae6ClgOkjygKwrf9B3L6ITtUu",
  "object": "checkout.session",
  "after_expiration": null,
  "allow_promotion_codes": null,
  "amount_subtotal": 4598,
  "amount_total": 4598,
  "automatic_tax": {
    "enabled": false,
    "liability": null,
    "provider": null,
    "status": null
  },
  "billing_address_collection": null,
  "branding_settings": null,
  "cancel_url": null,
  "client_reference_id": null,
  "client_secret": null,
  "collected_information": null,
  "consent": null,
  "consent_collection": null,
  "created": 1723824000,
  "currency": "usdc",
  "custom_fields": [],
  "custom_text": {
    "after_submit": null,
    "shipping_address": null,
    "submit": null,
    "terms_of_service_acceptance": null
  },
  "customer": null,
  "customer_account": null,
  "customer_creation": "if_required",
  "customer_details": null,
  "customer_email": null,
  "discounts": null,
  "expires_at": 1723910400,
  "invoice": null,
  "invoice_creation": {
    "enabled": false,
    "invoice_data": {
      "account_tax_ids": null,
      "custom_fields": null,
      "description": null,
      "footer": null,
      "issuer": null,
      "metadata": {},
      "rendering_options": null
    }
  },
  "livemode": false,
  "locale": null,
  "metadata": {},
  "mode": "payment",
  "payment_intent": null,
  "payment_link": null,
  "payment_method_collection": "always",
  "payment_method_options": {
    "crypto": {}
  },
  "payment_method_types": [
    "crypto"
  ],
  "payment_status": "unpaid",
  "phone_number_collection": {
    "enabled": false
  },
  "recovered_from": null,
  "setup_intent": null,
  "shipping_address_collection": null,
  "shipping_cost": null,
  "shipping_options": [],
  "status": "expired",
  "submit_type": null,
  "subscription": null,
  "success_url": "https://shop.example.com/order/complete",
  "total_details": {
    "amount_discount": 0,
    "amount_shipping": 0,
    "amount_tax": 0
  },
  "ui_mode": "hosted_page",
  "url": null,
  "return_url": null,
  "platform_account": "acct_z_Platform123abc",
  "url_slug": "x7k9m2p4q8",
  "payment_details": null
}`;

const LIST_CHECKOUT_SESSIONS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/checkout/sessions",
  "has_more": false,
  "data": [
    {
      "id": "cs_z_a8KmQ2vLpR5wT9bHxJcFnW4uY",
      "object": "checkout.session",
      "after_expiration": null,
      "allow_promotion_codes": null,
      "amount_subtotal": 4598,
      "amount_total": 4598,
      "automatic_tax": {
        "enabled": false,
        "liability": null,
        "provider": null,
        "status": null
      },
      "billing_address_collection": null,
      "branding_settings": null,
      "cancel_url": null,
      "client_reference_id": null,
      "client_secret": null,
      "collected_information": null,
      "consent": null,
      "consent_collection": null,
      "created": 1723910400,
      "currency": "usdc",
      "custom_fields": [],
      "custom_text": {
        "after_submit": null,
        "shipping_address": null,
        "submit": null,
        "terms_of_service_acceptance": null
      },
      "customer": null,
      "customer_account": null,
      "customer_creation": "if_required",
      "customer_details": null,
      "customer_email": null,
      "discounts": null,
      "expires_at": 1723996800,
      "invoice": null,
      "invoice_creation": {
        "enabled": false,
        "invoice_data": {
          "account_tax_ids": null,
          "custom_fields": null,
          "description": null,
          "footer": null,
          "issuer": null,
          "metadata": {},
          "rendering_options": null
        }
      },
      "livemode": false,
      "locale": null,
      "metadata": {},
      "mode": "payment",
      "payment_intent": null,
      "payment_link": null,
      "payment_method_collection": "always",
      "payment_method_options": {
        "crypto": {}
      },
      "payment_method_types": [
        "crypto"
      ],
      "payment_status": "unpaid",
      "phone_number_collection": {
        "enabled": false
      },
      "recovered_from": null,
      "setup_intent": null,
      "shipping_address_collection": null,
      "shipping_cost": null,
      "shipping_options": [],
      "status": "open",
      "submit_type": null,
      "subscription": null,
      "success_url": "https://shop.example.com/order/complete",
      "total_details": {
        "amount_discount": 0,
        "amount_shipping": 0,
        "amount_tax": 0
      },
      "ui_mode": "hosted_page",
      "url": "https://checkout.yourdomain.com/c/x7k9m2p4q8",
      "return_url": null,
      "platform_account": "acct_z_Platform123abc",
      "url_slug": "x7k9m2p4q8",
      "payment_details": null
    }
  ]
}`;

const LIST_LINE_ITEMS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/checkout/sessions/cs_z_a8KmQ2vLpR5wT9bHxJcFnW4uY/line_items",
  "has_more": false,
  "data": [
    {
      "id": "li_z_1RqBEoLkdIwHu7ixWtXug1yk",
      "object": "item",
      "amount_discount": 0,
      "amount_subtotal": 4598,
      "amount_tax": 0,
      "amount_total": 4598,
      "currency": "usdc",
      "description": "Canvas Tote",
      "discounts": [],
      "metadata": {},
      "price": {
        "id": "price_z_1RqEsLkdIwHu7ix7Ssho8Cl",
        "object": "price",
        "active": true,
        "billing_scheme": "per_unit",
        "created": 1723910400,
        "currency": "usdc",
        "custom_unit_amount": null,
        "livemode": false,
        "lookup_key": null,
        "metadata": {},
        "nickname": null,
        "product": "prod_z_9K2mLpQ8vRxWnJc4",
        "recurring": null,
        "tax_behavior": "unspecified",
        "tiers_mode": null,
        "transform_quantity": null,
        "type": "one_time",
        "unit_amount": 2299,
        "unit_amount_decimal": "2299"
      },
      "quantity": 2,
      "taxes": []
    }
  ]
}`;

// ============================================
// CheckoutSession object attributes
// ============================================

const CHECKOUT_SESSION_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless Checkout Session IDs are prefixed with <code>cs_z_</code>.',
  },
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value.",
  },
  {
    name: 'amount_subtotal',
    type: 'integer',
    nullable: true,
    description:
      'Total of all items before discounts or taxes are applied, in the smallest currency unit.',
  },
  {
    name: 'amount_total',
    type: 'integer',
    nullable: true,
    description:
      'Total of all items after discounts and taxes are applied, in the smallest currency unit.',
  },
  {
    name: 'cancel_url',
    type: 'string',
    nullable: true,
    description:
      'If set, Checkout displays a back button and customers are directed to this URL if they decide to cancel payment.',
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
    nullable: true,
    description:
      'Three-letter ISO currency code, in lowercase. For Zoneless, this is <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless settles in USDC on Solana rather than fiat currencies.',
  },
  {
    name: 'customer',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The ID of the Customer for this Session. For Checkout Sessions in <code>subscription</code> mode, or in <code>payment</code> mode with <code>customer_creation</code> set to <code>always</code>, Checkout creates a new Customer unless an existing one was provided.',
  },
  {
    name: 'customer_email',
    type: 'string',
    nullable: true,
    description:
      "If provided, this value is used to prefill the customer's email at Checkout. Use this if you already have an email on file.",
  },
  {
    name: 'expires_at',
    type: 'timestamp',
    description: 'The timestamp at which the Checkout Session expires.',
  },
  {
    name: 'line_items',
    type: 'object',
    nullable: true,
    description:
      'The line items purchased by the customer. Not returned by default; expand this field with the <code>expand</code> request parameter to include it.',
    expandable: true,
    children: [
      {
        name: 'object',
        type: 'string',
        description:
          "String representing the object's type. Always <code>list</code>.",
      },
      {
        name: 'data',
        type: 'array of objects',
        description: 'Details about each line item.',
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
              "String representing the object's type. Always <code>item</code>.",
          },
          {
            name: 'amount_discount',
            type: 'integer',
            description:
              'Total discount amount applied. If no discounts were applied, defaults to 0.',
          },
          {
            name: 'amount_subtotal',
            type: 'integer',
            description: 'Total before any discounts or taxes are applied.',
          },
          {
            name: 'amount_tax',
            type: 'integer',
            description:
              'Total tax amount applied. If no tax was applied, defaults to 0.',
          },
          {
            name: 'amount_total',
            type: 'integer',
            description: 'Total after discounts and taxes.',
          },
          {
            name: 'currency',
            type: 'string',
            description: 'Three-letter ISO currency code, in lowercase.',
          },
          {
            name: 'description',
            type: 'string',
            nullable: true,
            description:
              'An arbitrary string attached to the object. Defaults to the product name.',
          },
          {
            name: 'price',
            type: 'object',
            nullable: true,
            tooltip: EXPAND_TOOLTIP,
            description:
              'The <a href="#prices-object">Price</a> object used to generate the line item.',
          },
          {
            name: 'quantity',
            type: 'integer',
            nullable: true,
            description: 'The quantity of products being purchased.',
          },
        ],
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
    name: 'livemode',
    type: 'boolean',
    description:
      'If the object exists in live mode, the value is <code>true</code>. If the object exists in test mode, the value is <code>false</code>.',
  },
  {
    name: 'metadata',
    type: 'object',
    nullable: true,
    description:
      'Set of key-value pairs that you can attach to an object. Useful for storing additional information in a structured format.',
  },
  {
    name: 'mode',
    type: 'enum',
    description: 'The mode of the Checkout Session.',
    enumValues: [
      {
        value: 'payment',
        description: 'Accept a one-time USDC payment for goods or services.',
      },
      {
        value: 'setup',
        description:
          "Save a customer's Solana wallet to charge them later, without collecting payment now.",
      },
      {
        value: 'subscription',
        description: 'Use Checkout to set up a recurring USDC subscription.',
      },
    ],
  },
  {
    name: 'payment_intent',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      "The ID of the PaymentIntent for Checkout Sessions in <code>payment</code> mode. You can't confirm or cancel the PaymentIntent for a Checkout Session directly; expire the Checkout Session instead.",
  },
  {
    name: 'payment_method_options',
    type: 'object',
    description:
      'Payment-method-specific configuration for the PaymentIntent or SetupIntent generated by this Session.',
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
              "Indicates that you intend to make future payments with this Session's payment method.",
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
      'The list of payment method types this Checkout Session is allowed to accept.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless currently accepts <code>crypto</code> (USDC on Solana) rather than cards or other fiat rails.',
  },
  {
    name: 'payment_status',
    type: 'enum',
    description:
      "The payment status of the Checkout Session. Use this value to decide when to fulfill your customer's order.",
    enumValues: [
      {
        value: 'no_payment_required',
        description:
          'The Session does not require payment, such as a fully-discounted subscription.',
      },
      { value: 'paid', description: 'Payment for the Session has completed.' },
      {
        value: 'unpaid',
        description: 'Payment for the Session has not yet completed.',
      },
    ],
  },
  {
    name: 'status',
    type: 'enum',
    nullable: true,
    description: 'The status of the Checkout Session.',
    enumValues: [
      {
        value: 'complete',
        description:
          'The checkout was completed. Payment processing may still be in progress.',
      },
      {
        value: 'expired',
        description:
          'The checkout expired before the customer completed payment.',
      },
      {
        value: 'open',
        description:
          'The checkout is still in progress. Customer information is being collected.',
      },
    ],
  },
  {
    name: 'subscription',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      "The ID of the Subscription for Checkout Sessions in <code>subscription</code> mode. You can't confirm or cancel the Subscription for a Checkout Session directly; expire the Checkout Session instead.",
  },
  {
    name: 'success_url',
    type: 'string',
    nullable: true,
    description:
      'The URL the customer is directed to after the payment or subscription creation is successful.',
  },
  {
    name: 'total_details',
    type: 'object',
    nullable: true,
    description: 'Tax and discount details for the computed total amount.',
    expandable: true,
    children: [
      {
        name: 'amount_discount',
        type: 'integer',
        description: 'This is the sum of all the discounts.',
      },
      {
        name: 'amount_shipping',
        type: 'integer',
        nullable: true,
        description: 'This is the sum of all the shipping amounts.',
      },
      {
        name: 'amount_tax',
        type: 'integer',
        description: 'This is the sum of all the tax amounts.',
      },
    ],
  },
  {
    name: 'ui_mode',
    type: 'enum',
    nullable: true,
    description:
      'The UI mode of the Session. Defaults to <code>hosted_page</code>.',
    enumValues: [
      { value: 'elements' },
      { value: 'embedded_page' },
      {
        value: 'hosted_page',
        description:
          '(Default) A full-page hosted Checkout experience at <code>url</code>.',
      },
    ],
  },
  {
    name: 'url',
    type: 'string',
    nullable: true,
    description:
      'The URL to the Checkout Session. Applies to Sessions with <code>ui_mode: hosted_page</code>. Redirect customers to this URL to take them to Checkout. Only present while the session is <code>open</code>.',
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
    name: 'url_slug',
    type: 'string',
    description:
      'Opaque slug used in the hosted checkout URL (<code>/c/{url_slug}</code>). Distinct from <code>id</code> so shareable links do not expose the API object ID.',
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API.",
  },
  {
    name: 'payment_details',
    type: 'object',
    nullable: true,
    description:
      'On-chain payment details recorded when the session is completed.',
    expandable: true,
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API.",
    children: [
      {
        name: 'transaction_signature',
        type: 'string',
        nullable: true,
        description:
          'The Solana transaction signature of the payment. <code>null</code> until the customer confirms payment.',
      },
      {
        name: 'payer_wallet',
        type: 'string',
        nullable: true,
        description: 'The customer wallet address that paid or subscribed.',
      },
    ],
  },
];

const CHECKOUT_SESSION_MORE_ATTRIBUTES: Attribute[] = [
  {
    name: 'adaptive_pricing',
    type: 'object',
    nullable: true,
    description: 'Settings for price localization with Adaptive Pricing.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'If enabled, Adaptive Pricing is available on eligible sessions.',
      },
    ],
  },
  {
    name: 'after_expiration',
    type: 'object',
    nullable: true,
    description:
      'When set, provides configuration for actions to take if this Checkout Session expires.',
    expandable: true,
    children: [
      {
        name: 'recovery',
        type: 'object',
        nullable: true,
        description:
          'Configuration used to recover the Checkout Session on expiry.',
        expandable: true,
        children: [
          {
            name: 'allow_promotion_codes',
            type: 'boolean',
            description:
              'Enables user redeemable promotion codes on the recovered Session. Defaults to false.',
          },
          {
            name: 'enabled',
            type: 'boolean',
            description:
              'If true, a recovery URL is generated to recover this Session if it expires before a transaction completes.',
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            nullable: true,
            description: 'The timestamp at which the recovery URL expires.',
          },
          {
            name: 'url',
            type: 'string',
            nullable: true,
            description:
              'URL that creates a new Checkout Session, a copy of this expired one, when clicked.',
          },
        ],
      },
    ],
  },
  {
    name: 'allow_promotion_codes',
    type: 'boolean',
    nullable: true,
    description: 'Enables user redeemable promotion codes.',
  },
  {
    name: 'automatic_tax',
    type: 'object',
    description:
      'Details on the state of automatic tax for the session, including the status of the latest tax calculation.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Indicates whether automatic tax is enabled for the session.',
      },
      {
        name: 'liability',
        type: 'object',
        nullable: true,
        description:
          'The account liable for tax. If set, the business address and tax registrations used for calculation are loaded from this account.',
        expandable: true,
        children: [
          {
            name: 'account',
            type: 'string',
            nullable: true,
            description:
              'The connected account being referenced when type is account.',
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
          'The status of the most recent automated tax calculation for this session.',
        enumValues: [
          { value: 'complete' },
          { value: 'failed' },
          { value: 'requires_location_inputs' },
        ],
      },
    ],
  },
  {
    name: 'billing_address_collection',
    type: 'enum',
    nullable: true,
    description:
      "Describes whether Checkout should collect the customer's billing address. Defaults to <code>auto</code>.",
    enumValues: [{ value: 'auto' }, { value: 'required' }],
  },
  {
    name: 'branding_settings',
    type: 'object',
    nullable: true,
    description: 'Details on the state of branding settings for the session.',
    expandable: true,
    children: [
      {
        name: 'background_color',
        type: 'string',
        description:
          'A hex color value representing the background color for the Checkout Session.',
      },
      {
        name: 'border_style',
        type: 'enum',
        description: 'The border style for the Checkout Session.',
        enumValues: [
          { value: 'pill' },
          { value: 'rectangular' },
          { value: 'rounded' },
        ],
      },
      {
        name: 'button_color',
        type: 'string',
        description:
          'A hex color value representing the button color for the Checkout Session.',
      },
      {
        name: 'display_name',
        type: 'string',
        description: 'The display name shown on the Checkout Session.',
      },
      {
        name: 'font_family',
        type: 'string',
        description: 'The font family for the Checkout Session.',
      },
      {
        name: 'icon',
        type: 'object',
        nullable: true,
        description:
          'The icon shown on the Checkout Session. You cannot set both a logo and an icon.',
      },
      {
        name: 'logo',
        type: 'object',
        nullable: true,
        description:
          'The logo shown on the Checkout Session. You cannot set both a logo and an icon.',
      },
    ],
  },
  {
    name: 'client_reference_id',
    type: 'string',
    nullable: true,
    description:
      'A unique string to reference the Checkout Session. Can be a customer ID, a cart ID, or similar.',
  },
  {
    name: 'client_secret',
    type: 'string',
    nullable: true,
    description:
      'The client secret of your Checkout Session. Applies to Sessions with <code>ui_mode: embedded_page</code> or <code>ui_mode: elements</code>.',
  },
  {
    name: 'collected_information',
    type: 'object',
    nullable: true,
    description:
      'Information about the customer collected within the Checkout Session.',
    expandable: true,
    children: [
      {
        name: 'business_name',
        type: 'string',
        nullable: true,
        description: "Customer's business name for this Checkout Session.",
      },
      {
        name: 'individual_name',
        type: 'string',
        nullable: true,
        description: "Customer's individual name for this Checkout Session.",
      },
      {
        name: 'shipping_details',
        type: 'object',
        nullable: true,
        description: 'Shipping information for this Checkout Session.',
        expandable: true,
        children: [
          {
            name: 'address',
            type: 'object',
            description: 'Customer address.',
            expandable: true,
            children: ADDRESS_CHILDREN,
          },
          { name: 'name', type: 'string', description: 'Customer name.' },
        ],
      },
    ],
  },
  {
    name: 'consent',
    type: 'object',
    nullable: true,
    description: 'Results of <code>consent_collection</code> for this session.',
    expandable: true,
    children: [
      {
        name: 'promotions',
        type: 'enum',
        nullable: true,
        description:
          'If <code>opt_in</code>, the customer consents to receiving promotional communications from the merchant about this session.',
        enumValues: [{ value: 'opt_in' }, { value: 'opt_out' }],
      },
      {
        name: 'terms_of_service',
        type: 'enum',
        nullable: true,
        description:
          "If <code>accepted</code>, the customer has agreed to the merchant's terms of service.",
        enumValues: [{ value: 'accepted' }],
      },
    ],
  },
  {
    name: 'consent_collection',
    type: 'object',
    nullable: true,
    description:
      'When set, provides configuration for the Checkout Session to gather active consent from customers.',
    expandable: true,
    children: [
      {
        name: 'payment_method_reuse_agreement',
        type: 'object',
        nullable: true,
        description:
          'If set to <code>hidden</code>, hides legal text related to the reuse of a payment method.',
        expandable: true,
        children: [
          {
            name: 'position',
            type: 'enum',
            description:
              'Determines the position and visibility of the payment method reuse agreement in the UI.',
            enumValues: [{ value: 'auto' }, { value: 'hidden' }],
          },
        ],
      },
      {
        name: 'promotions',
        type: 'enum',
        nullable: true,
        description:
          'If set to <code>auto</code>, enables collection of customer consent for promotional communications.',
        enumValues: [{ value: 'auto' }, { value: 'none' }],
      },
      {
        name: 'terms_of_service',
        type: 'enum',
        nullable: true,
        description:
          'If set to <code>required</code>, customers must accept the terms of service before paying.',
        enumValues: [{ value: 'none' }, { value: 'required' }],
      },
    ],
  },
  {
    name: 'currency_conversion',
    type: 'object',
    nullable: true,
    description: 'Currency conversion details for Adaptive Pricing sessions.',
    expandable: true,
    children: [
      {
        name: 'amount_subtotal',
        type: 'integer',
        description:
          'Total of all items in source currency before discounts or taxes are applied.',
      },
      {
        name: 'amount_total',
        type: 'integer',
        description:
          'Total of all items in source currency after discounts and taxes are applied.',
      },
      {
        name: 'fx_rate',
        type: 'string',
        description:
          'Exchange rate used to convert source currency amounts to customer currency amounts.',
      },
      {
        name: 'source_currency',
        type: 'string',
        description:
          'Creation currency of the Checkout Session before localization.',
      },
    ],
  },
  {
    name: 'custom_fields',
    type: 'array of objects',
    description:
      'Collect additional information from your customer using custom fields. Up to 3 fields are supported.',
  },
  {
    name: 'custom_text',
    type: 'object',
    description:
      'Display additional text for your customers using custom text.',
    expandable: true,
    children: [
      {
        name: 'after_submit',
        type: 'object',
        nullable: true,
        description:
          'Custom text displayed after the payment confirmation button.',
      },
      {
        name: 'shipping_address',
        type: 'object',
        nullable: true,
        description:
          'Custom text displayed alongside shipping address collection.',
      },
      {
        name: 'submit',
        type: 'object',
        nullable: true,
        description:
          'Custom text displayed alongside the payment confirmation button.',
      },
      {
        name: 'terms_of_service_acceptance',
        type: 'object',
        nullable: true,
        description:
          'Custom text displayed in place of the default terms of service agreement text.',
      },
    ],
  },
  {
    name: 'customer_account',
    type: 'string',
    nullable: true,
    description: 'The ID of the Account for this Session.',
  },
  {
    name: 'customer_creation',
    type: 'enum',
    nullable: true,
    description:
      'Configures whether a Checkout Session creates a Customer when it completes.',
    enumValues: [
      { value: 'always' },
      {
        value: 'if_required',
        description: '(Default) Only create a Customer when required.',
      },
    ],
  },
  {
    name: 'customer_details',
    type: 'object',
    nullable: true,
    description:
      'The customer details, including tax exempt status and tax IDs. Not present on Sessions in <code>setup</code> mode.',
    expandable: true,
    children: [
      {
        name: 'address',
        type: 'object',
        nullable: true,
        description:
          "The customer's address after a completed Checkout Session.",
        expandable: true,
        children: ADDRESS_CHILDREN,
      },
      {
        name: 'business_name',
        type: 'string',
        nullable: true,
        description:
          "The customer's business name after a completed Checkout Session.",
      },
      {
        name: 'email',
        type: 'string',
        nullable: true,
        description:
          'The email associated with the Customer after a completed Checkout Session.',
      },
      {
        name: 'individual_name',
        type: 'string',
        nullable: true,
        description:
          "The customer's individual name after a completed Checkout Session.",
      },
      {
        name: 'name',
        type: 'string',
        nullable: true,
        description: "The customer's name after a completed Checkout Session.",
      },
      {
        name: 'phone',
        type: 'string',
        nullable: true,
        description:
          "The customer's phone number after a completed Checkout Session.",
      },
      {
        name: 'tax_exempt',
        type: 'enum',
        nullable: true,
        description:
          "The customer's tax exempt status after a completed Checkout Session.",
        enumValues: [
          { value: 'exempt' },
          { value: 'none' },
          { value: 'reverse' },
        ],
      },
      {
        name: 'tax_ids',
        type: 'array of objects',
        nullable: true,
        description:
          "The customer's tax IDs after a completed Checkout Session.",
        expandable: true,
        children: [
          {
            name: 'type',
            type: 'string',
            description: 'The type of the tax ID.',
          },
          {
            name: 'value',
            type: 'string',
            description: 'The value of the tax ID.',
          },
        ],
        enumNote:
          '<strong>Difference from Stripe:</strong> Stripe supports 100+ country-specific tax ID types; Zoneless keeps <code>type</code> as a plain string rather than listing every enum value.',
      },
    ],
  },
  {
    name: 'discounts',
    type: 'array of objects',
    nullable: true,
    description:
      'List of coupons and promotion codes attached to the Checkout Session.',
    expandable: true,
    children: [
      {
        name: 'coupon',
        type: 'string',
        nullable: true,
        description: 'Coupon attached to the Checkout Session.',
      },
      {
        name: 'promotion_code',
        type: 'string',
        nullable: true,
        description: 'Promotion code attached to the Checkout Session.',
      },
    ],
  },
  {
    name: 'excluded_payment_method_types',
    type: 'array of strings',
    nullable: true,
    description:
      'The list of payment method types to exclude from use with this payment.',
  },
  {
    name: 'integration_identifier',
    type: 'string',
    nullable: true,
    description:
      'The integration identifier for this Checkout Session. Multiple sessions can share the same integration identifier.',
  },
  {
    name: 'invoice',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the invoice created by the Checkout Session, if it exists.',
  },
  {
    name: 'invoice_creation',
    type: 'object',
    nullable: true,
    description:
      'Details on the state of invoice creation for the Checkout Session.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Indicates whether invoice creation is enabled for the Checkout Session.',
      },
      {
        name: 'invoice_data',
        type: 'object',
        description:
          'Parameters passed when creating invoices for <code>payment</code> mode Checkout Sessions.',
        expandable: true,
        children: [
          {
            name: 'account_tax_ids',
            type: 'array of strings',
            nullable: true,
            description: 'The account tax IDs associated with the invoice.',
          },
          {
            name: 'custom_fields',
            type: 'array of objects',
            nullable: true,
            description: 'Custom fields displayed on the invoice.',
          },
          {
            name: 'description',
            type: 'string',
            nullable: true,
            description: 'An arbitrary string attached to the object.',
          },
          {
            name: 'footer',
            type: 'string',
            nullable: true,
            description: 'Footer displayed on the invoice.',
          },
          {
            name: 'issuer',
            type: 'object',
            nullable: true,
            description: 'The connected account that issues the invoice.',
          },
          {
            name: 'metadata',
            type: 'object',
            nullable: true,
            description:
              'Set of key-value pairs that you can attach to an object.',
          },
          {
            name: 'rendering_options',
            type: 'object',
            nullable: true,
            description: 'Options for invoice PDF rendering.',
          },
        ],
      },
    ],
  },
  {
    name: 'locale',
    type: 'string',
    nullable: true,
    description:
      'The IETF language tag of the locale Checkout is displayed in.',
  },
  {
    name: 'managed_payments',
    type: 'object',
    nullable: true,
    description:
      'Settings for Managed Payments for this Checkout Session and the resulting PaymentIntents, Invoices, and Subscriptions.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Indicates whether Managed Payments is enabled for this session.',
      },
    ],
  },
  {
    name: 'name_collection',
    type: 'object',
    nullable: true,
    description: 'Details on the state of name collection for the session.',
    expandable: true,
    children: [
      {
        name: 'business',
        type: 'object',
        nullable: true,
        description: "The settings applied for collecting a business's name.",
        expandable: true,
        children: [
          {
            name: 'enabled',
            type: 'boolean',
            description:
              'Indicates whether business name collection is enabled for the session.',
          },
          {
            name: 'optional',
            type: 'boolean',
            description:
              'Whether the customer is required to complete the field. Defaults to false.',
          },
        ],
      },
      {
        name: 'individual',
        type: 'object',
        nullable: true,
        description:
          "The settings applied for collecting an individual's name.",
        expandable: true,
        children: [
          {
            name: 'enabled',
            type: 'boolean',
            description:
              'Indicates whether individual name collection is enabled for the session.',
          },
          {
            name: 'optional',
            type: 'boolean',
            description:
              'Whether the customer is required to complete the field. Defaults to false.',
          },
        ],
      },
    ],
  },
  {
    name: 'optional_items',
    type: 'array of objects',
    nullable: true,
    description: 'The optional items presented to the customer at checkout.',
  },
  {
    name: 'origin_context',
    type: 'enum',
    nullable: true,
    description:
      'Where the user is coming from. This informs the optimizations that are applied to the session.',
    enumValues: [{ value: 'mobile_app' }, { value: 'web' }],
  },
  {
    name: 'payment_link',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'The ID of the Payment Link that created this Session.',
  },
  {
    name: 'payment_method_collection',
    type: 'enum',
    nullable: true,
    description:
      'Configures whether a Checkout Session should collect a payment method. Defaults to <code>always</code>.',
    enumValues: [{ value: 'always' }, { value: 'if_required' }],
  },
  {
    name: 'payment_method_configuration_details',
    type: 'object',
    nullable: true,
    description:
      'Information about the payment method configuration used for this Checkout Session, if using dynamic payment methods.',
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
    name: 'permissions',
    type: 'object',
    nullable: true,
    description:
      'Used to set up permissions for various actions (for example, <code>update</code>) on the Checkout Session object.',
    expandable: true,
    children: [
      {
        name: 'update_shipping_details',
        type: 'enum',
        nullable: true,
        description:
          'Determines which entity is allowed to update the shipping details. Default is <code>client_only</code>.',
        enumValues: [{ value: 'client_only' }, { value: 'server_only' }],
      },
    ],
  },
  {
    name: 'phone_number_collection',
    type: 'object',
    nullable: true,
    description:
      'Details on the state of phone number collection for the session.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Indicates whether phone number collection is enabled for the session.',
      },
    ],
  },
  {
    name: 'presentment_details',
    type: 'object',
    nullable: true,
    description:
      'A hash containing information about the currency presentation to the customer.',
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
    name: 'recovered_from',
    type: 'string',
    nullable: true,
    description:
      'The ID of the original expired Checkout Session that triggered the recovery flow.',
  },
  {
    name: 'redirect_on_completion',
    type: 'enum',
    nullable: true,
    description:
      'Applies to <code>ui_mode: embedded_page</code>. Defaults to <code>always</code>.',
    enumValues: [
      { value: 'always' },
      { value: 'if_required' },
      { value: 'never' },
    ],
  },
  {
    name: 'return_url',
    type: 'string',
    nullable: true,
    description:
      'Applies to Checkout Sessions with <code>ui_mode: embedded_page</code> or <code>ui_mode: elements</code>. The URL to redirect your customer to after they authenticate or cancel their payment.',
  },
  {
    name: 'saved_payment_method_options',
    type: 'object',
    nullable: true,
    description:
      'Controls saved payment method settings for the session. Only available in <code>payment</code> and <code>subscription</code> mode.',
    expandable: true,
    children: [
      {
        name: 'allow_redisplay_filters',
        type: 'array of strings',
        nullable: true,
        description:
          'Filters the saved payment methods presented to a returning customer by their <code>allow_redisplay</code> value.',
        enumValues: [
          { value: 'always' },
          { value: 'limited' },
          { value: 'unspecified' },
        ],
      },
      {
        name: 'payment_method_remove',
        type: 'enum',
        nullable: true,
        description:
          'Enables customers to choose whether to remove their saved payment methods. Disabled by default.',
        enumValues: [{ value: 'disabled' }, { value: 'enabled' }],
      },
      {
        name: 'payment_method_save',
        type: 'enum',
        nullable: true,
        description:
          'Enables customers to choose whether to save their payment method for future use. Disabled by default.',
        enumValues: [{ value: 'disabled' }, { value: 'enabled' }],
      },
    ],
  },
  {
    name: 'setup_intent',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      "The ID of the SetupIntent for Checkout Sessions in <code>setup</code> mode. You can't confirm or cancel the SetupIntent for a Checkout Session directly; expire the Checkout Session instead.",
  },
  {
    name: 'shipping_address_collection',
    type: 'object',
    nullable: true,
    description:
      'When set, provides configuration for Checkout to collect a shipping address from a customer.',
    expandable: true,
    children: [
      {
        name: 'allowed_countries',
        type: 'array of strings',
        description:
          'Two-letter country codes representing which countries Checkout should offer as shipping locations.',
      },
    ],
  },
  {
    name: 'shipping_cost',
    type: 'object',
    nullable: true,
    description:
      'The details of the customer cost of shipping, including the customer chosen shipping rate.',
    expandable: true,
    children: [
      {
        name: 'amount_subtotal',
        type: 'integer',
        description:
          'Total shipping cost before any discounts or taxes are applied.',
      },
      {
        name: 'amount_tax',
        type: 'integer',
        description:
          'Total tax amount applied due to shipping costs. If no tax was applied, defaults to 0.',
      },
      {
        name: 'amount_total',
        type: 'integer',
        description:
          'Total shipping cost after discounts and taxes are applied.',
      },
      {
        name: 'shipping_rate',
        type: 'string',
        nullable: true,
        tooltip: EXPAND_TOOLTIP,
        description: 'The ID of the ShippingRate for this order.',
      },
    ],
  },
  {
    name: 'shipping_options',
    type: 'array of objects',
    description: 'The shipping rate options applied to this Session.',
    expandable: true,
    children: [
      {
        name: 'shipping_amount',
        type: 'integer',
        description:
          'A non-negative integer in the smallest currency unit representing how much to charge.',
      },
      {
        name: 'shipping_rate',
        type: 'string',
        tooltip: EXPAND_TOOLTIP,
        description: 'The shipping rate.',
      },
    ],
  },
  {
    name: 'submit_type',
    type: 'enum',
    nullable: true,
    description:
      'Describes the type of transaction being performed by Checkout, used to customize relevant text on the page.',
    enumValues: [
      { value: 'auto' },
      { value: 'book' },
      { value: 'donate' },
      { value: 'pay' },
      { value: 'subscribe' },
    ],
  },
  {
    name: 'tax_id_collection',
    type: 'object',
    nullable: true,
    description: 'Details on the state of tax ID collection for the session.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Indicates whether tax ID collection is enabled for the session.',
      },
      {
        name: 'required',
        type: 'enum',
        description:
          'Indicates whether a tax ID is required on the payment page.',
        enumValues: [{ value: 'if_supported' }, { value: 'never' }],
      },
    ],
  },
  {
    name: 'wallet_options',
    type: 'object',
    nullable: true,
    description: 'Wallet-specific configuration for this Checkout Session.',
    expandable: true,
    children: [
      {
        name: 'link',
        type: 'object',
        nullable: true,
        description: 'Configuration applied to Link, retained for API parity.',
        expandable: true,
        children: [
          {
            name: 'display',
            type: 'enum',
            description:
              'Describes whether Checkout should display Link. Defaults to <code>auto</code>.',
            enumValues: [{ value: 'auto' }, { value: 'never' }],
          },
        ],
      },
    ],
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless connects Solana wallets directly rather than a Stripe-hosted wallet product. This field is retained for API parity but has no Zoneless equivalent.',
  },
  {
    name: 'merchant',
    type: 'object',
    nullable: true,
    description:
      'Merchant display details for the hosted checkout page, resolved from the platform account that owns the session.',
    expandable: true,
    children: [
      {
        name: 'display_name',
        type: 'string',
        description: "The merchant's display name.",
      },
      {
        name: 'terms_url',
        type: 'string',
        nullable: true,
        description: "The merchant's terms of service URL.",
      },
      {
        name: 'privacy_url',
        type: 'string',
        nullable: true,
        description: "The merchant's privacy policy URL.",
      },
      {
        name: 'icon_url',
        type: 'string',
        nullable: true,
        description: "The merchant's icon URL.",
      },
    ],
    enumNote:
      '<strong>Zoneless extension:</strong> Only populated on the public <code>payment_pages</code> response used to render the hosted checkout page.',
  },
  {
    name: 'merchant_wallet',
    type: 'object',
    nullable: true,
    description:
      'The merchant wallet that receives the payment, used to build the on-chain payment transaction.',
    expandable: true,
    children: [
      {
        name: 'wallet_address',
        type: 'string',
        description: "The merchant's receiving wallet address.",
      },
      {
        name: 'network',
        type: 'string',
        description: 'The network the wallet is on.',
      },
      {
        name: 'currency',
        type: 'string',
        description: 'The currency the wallet receives.',
      },
      {
        name: 'usdc_mint',
        type: 'string',
        description: 'The USDC mint address for the active network.',
      },
    ],
    enumNote:
      '<strong>Zoneless extension:</strong> Only populated on the public <code>payment_pages</code> response used to render the hosted checkout page.',
  },
];

// ============================================
// Overview
// ============================================

export const CHECKOUT_SESSIONS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Checkout Session object',
  description:
    "A Checkout Session represents your customer's session as they pay for one-time purchases or subscriptions through Checkout or Payment Links. Create a new Session each time your customer attempts to pay. Once payment succeeds, the Session references the Customer and either the successful PaymentIntent or an active Subscription. Create a Session on your server and redirect to its <code>url</code> to begin Checkout.",
  stripeDocsUrl: 'https://docs.stripe.com/api/checkout/sessions',
  endpoints: BuildEndpointSummaries(CHECKOUT_SESSIONS_SUBSECTION, [
    { method: 'POST', path: '/v1/checkout/sessions', pageId: 'create' },
    { method: 'POST', path: '/v1/checkout/sessions/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/checkout/sessions/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/checkout/sessions', pageId: 'list' },
    {
      method: 'POST',
      path: '/v1/checkout/sessions/:id/expire',
      pageId: 'expire',
    },
    {
      method: 'GET',
      path: '/v1/checkout/sessions/:id/line_items',
      pageId: 'list-line-items',
    },
  ]),
  events: GetResourceEventAttributes('checkout.session'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: "A Checkout Session powers a hosted payment page where customers pay in USDC. In live mode they connect a Solana wallet. In test mode they approve a simulated wallet. Redirect your customer to the Session's <code>url</code> to begin, and they land back on your <code>success_url</code> once payment completes.",
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: CHECKOUT_SESSION_ATTRIBUTES,
          moreAttributes: CHECKOUT_SESSION_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE CHECKOUT SESSION OBJECT',
          code: CHECKOUT_SESSION_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create
// ============================================

const CREATE_CHECKOUT_SESSION_PARAMETERS: Attribute[] = [
  {
    name: 'mode',
    type: 'enum',
    required: true,
    description: 'The mode of the Checkout Session.',
    enumValues: [
      {
        value: 'payment',
        description: 'Accept a one-time USDC payment for goods or services.',
      },
      {
        value: 'setup',
        description:
          "Save a customer's Solana wallet to charge them later, without collecting payment now.",
      },
      {
        value: 'subscription',
        description: 'Use Checkout to set up a recurring USDC subscription.',
      },
    ],
  },
  {
    name: 'line_items',
    type: 'array of objects',
    required: true,
    requiredText: 'Required in payment and subscription mode',
    description:
      'A list of items the customer is purchasing. Maximum of 100 line items.',
    expandable: true,
    children: CREATE_LINE_ITEM_PARAM_CHILDREN,
  },
  {
    name: 'success_url',
    type: 'string',
    required: true,
    requiredText: 'Required unless ui_mode is embedded_page or elements',
    description:
      'The URL to redirect your customer to after they complete payment successfully.',
  },
  {
    name: 'cancel_url',
    type: 'string',
    description:
      'If set, Checkout displays a back button and customers are directed to this URL if they decide to cancel payment. Not allowed when <code>ui_mode</code> is <code>embedded_page</code> or <code>elements</code>.',
  },
  {
    name: 'customer',
    type: 'string',
    description:
      'ID of an existing Customer to attach to this Session. If not provided, Checkout creates a new Customer, subject to <code>customer_creation</code>.',
  },
  {
    name: 'customer_email',
    type: 'string',
    description:
      "If provided, this value is used to prefill the customer's email at Checkout.",
  },
  {
    name: 'payment_method_types',
    type: 'array of strings',
    description:
      'The list of payment method types this Checkout Session is allowed to accept. Defaults to <code>crypto</code>.',
    enumValues: [
      { value: 'crypto', description: 'USDC wallet payments on Solana.' },
    ],
  },
  {
    name: 'metadata',
    type: 'object',
    description: 'Set of key-value pairs that you can attach to an object.',
  },
  {
    name: 'expires_at',
    type: 'integer',
    description:
      'The timestamp at which the Checkout Session expires. Defaults to 24 hours after Session creation.',
  },
  {
    name: 'payment_intent_data',
    type: 'object',
    description:
      'A subset of parameters passed to PaymentIntent creation for Checkout Sessions in <code>payment</code> mode.',
    expandable: true,
    children: [
      {
        name: 'application_fee_amount',
        type: 'integer',
        description:
          "The amount of the application fee (if any) transferred to the application owner's account.",
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
        name: 'description',
        type: 'string',
        description:
          'An arbitrary string attached to the resulting PaymentIntent.',
      },
      {
        name: 'metadata',
        type: 'object',
        description:
          'Set of key-value pairs attached to the resulting PaymentIntent.',
      },
      {
        name: 'on_behalf_of',
        type: 'string',
        description: 'The connected account for which the funds are intended.',
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
          'Indicates that you intend to make future payments with this payment method.',
        enumValues: [{ value: 'off_session' }, { value: 'on_session' }],
      },
      {
        name: 'shipping',
        type: 'object',
        description: 'Shipping information for the resulting PaymentIntent.',
        expandable: true,
        children: [
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
        ],
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
          'Parameters used to automatically create a Transfer when the payment succeeds.',
        expandable: true,
        children: [
          {
            name: 'destination',
            type: 'string',
            required: true,
            description:
              'The account the payment is attributed to, and where funds are transferred after payment success.',
          },
          {
            name: 'amount',
            type: 'integer',
            description:
              'The amount transferred automatically when the payment succeeds. Defaults to the full amount.',
          },
        ],
      },
      {
        name: 'transfer_group',
        type: 'string',
        description:
          'A string that identifies the resulting payment as part of a group.',
      },
    ],
  },
  {
    name: 'subscription_data',
    type: 'object',
    description:
      'A subset of parameters passed to Subscription creation for Checkout Sessions in <code>subscription</code> mode.',
    expandable: true,
    children: [
      {
        name: 'application_fee_percent',
        type: 'float',
        description:
          'A non-negative decimal between 0 and 100, with at most two decimal places, representing the percentage of the subscription invoice subtotal collected as an application fee.',
      },
      {
        name: 'billing_cycle_anchor',
        type: 'timestamp',
        description:
          'A future timestamp in UTC format for the subscription to start a new billing period.',
      },
      {
        name: 'description',
        type: 'string',
        description:
          "The subscription's description, meant to be displayable to the customer.",
      },
      {
        name: 'invoice_settings',
        type: 'object',
        description:
          'All invoices for this subscription will inherit these settings.',
        expandable: true,
        children: [
          {
            name: 'issuer',
            type: 'object',
            description:
              'The connected account that issues invoices for this subscription.',
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
                  'The connected account being referenced when type is account.',
              },
            ],
          },
        ],
      },
      {
        name: 'metadata',
        type: 'object',
        description:
          'Set of key-value pairs attached to the resulting Subscription.',
      },
      {
        name: 'on_behalf_of',
        type: 'string',
        description:
          "The connected account for which the subscription's payments are intended.",
      },
      {
        name: 'proration_behavior',
        type: 'enum',
        description:
          'Determines how to handle prorations when the subscription items change.',
        enumValues: [{ value: 'create_prorations' }, { value: 'none' }],
      },
      {
        name: 'transfer_data',
        type: 'object',
        description:
          "Parameters used to automatically create a Transfer for each of the subscription's invoices.",
        expandable: true,
        children: [
          {
            name: 'destination',
            type: 'string',
            required: true,
            description:
              "The account where funds from the subscription's invoices are transferred to.",
          },
          {
            name: 'amount_percent',
            type: 'float',
            description:
              'A non-negative decimal between 0 and 100 representing the percentage of the invoice subtotal to transfer.',
          },
        ],
      },
      {
        name: 'trial_end',
        type: 'timestamp',
        description: 'The timestamp at which the trial period ends.',
      },
      {
        name: 'trial_period_days',
        type: 'integer',
        description: 'The number of days the trial period lasts.',
      },
      {
        name: 'trial_settings',
        type: 'object',
        description: 'Settings related to subscription trials.',
        expandable: true,
        children: [
          {
            name: 'end_behavior',
            type: 'object',
            required: true,
            description:
              'Defines how the subscription behaves when the trial ends.',
            expandable: true,
            children: [
              {
                name: 'missing_payment_method',
                type: 'enum',
                required: true,
                description:
                  'Indicates how the subscription should change when the trial ends if the customer did not provide a payment method.',
                enumValues: [
                  { value: 'cancel' },
                  { value: 'create_invoice' },
                  { value: 'pause' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

const CREATE_CHECKOUT_SESSION_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'adaptive_pricing',
    type: 'object',
    description: 'Settings for price localization with Adaptive Pricing.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Set to false to disable Adaptive Pricing. Defaults to true.',
      },
    ],
  },
  {
    name: 'after_expiration',
    type: 'object',
    description:
      'Configuration for actions to take if this Checkout Session expires.',
    expandable: true,
    children: [
      {
        name: 'recovery',
        type: 'object',
        required: true,
        description:
          'Configuration used to recover the Checkout Session on expiry.',
        expandable: true,
        children: [
          {
            name: 'enabled',
            type: 'boolean',
            required: true,
            description:
              'If true, a recovery URL is generated to recover this Session if it expires before a transaction completes.',
          },
          {
            name: 'allow_promotion_codes',
            type: 'boolean',
            description:
              'Enables user redeemable promotion codes on the recovered Session. Defaults to false.',
          },
        ],
      },
    ],
  },
  {
    name: 'allow_promotion_codes',
    type: 'boolean',
    description: 'Enables user redeemable promotion codes.',
  },
  {
    name: 'automatic_tax',
    type: 'object',
    description: 'Settings for automatic tax lookup for this session.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        required: true,
        description: 'Set to true to enable automatic taxes.',
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
              'The connected account being referenced when type is account.',
          },
        ],
      },
    ],
  },
  {
    name: 'billing_address_collection',
    type: 'enum',
    description:
      "Describes whether Checkout should collect the customer's billing address. Defaults to <code>auto</code>.",
    enumValues: [{ value: 'auto' }, { value: 'required' }],
  },
  {
    name: 'branding_settings',
    type: 'object',
    description: 'Settings for branding the Checkout Session.',
    expandable: true,
    children: [
      {
        name: 'background_color',
        type: 'string',
        description: 'A hex color value starting with # for the background.',
      },
      {
        name: 'border_style',
        type: 'enum',
        description: 'The border style for the Checkout Session.',
        enumValues: [
          { value: 'pill' },
          { value: 'rectangular' },
          { value: 'rounded' },
        ],
      },
      {
        name: 'button_color',
        type: 'string',
        description: 'A hex color value starting with # for the button.',
      },
      {
        name: 'display_name',
        type: 'string',
        description: 'The display name shown on the Checkout Session.',
      },
      {
        name: 'font_family',
        type: 'string',
        description: 'The font family for the Checkout Session.',
      },
      {
        name: 'icon',
        type: 'object',
        description:
          'The icon shown on the Checkout Session. You cannot set both a logo and an icon.',
      },
      {
        name: 'logo',
        type: 'object',
        description:
          'The logo shown on the Checkout Session. You cannot set both a logo and an icon.',
      },
    ],
  },
  {
    name: 'client_reference_id',
    type: 'string',
    description:
      'A unique string to reference the Checkout Session. Can be a customer ID, a cart ID, or similar.',
  },
  {
    name: 'consent_collection',
    type: 'object',
    description:
      'Configuration for the Checkout Session to gather active consent from customers.',
    expandable: true,
    children: [
      {
        name: 'payment_method_reuse_agreement',
        type: 'object',
        description:
          'If set to hidden, hides legal text related to the reuse of a payment method.',
        expandable: true,
        children: [
          {
            name: 'position',
            type: 'enum',
            required: true,
            description:
              'Determines the position and visibility of the payment method reuse agreement.',
            enumValues: [{ value: 'auto' }, { value: 'hidden' }],
          },
        ],
      },
      {
        name: 'promotions',
        type: 'enum',
        description:
          'If set to auto, enables collection of customer consent for promotional communications.',
        enumValues: [{ value: 'auto' }, { value: 'none' }],
      },
      {
        name: 'terms_of_service',
        type: 'enum',
        description:
          'If set to required, customers must accept the terms of service before paying.',
        enumValues: [{ value: 'none' }, { value: 'required' }],
      },
    ],
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
    name: 'custom_fields',
    type: 'array of objects',
    description:
      'Collect additional information from your customer using custom fields. Up to 3 fields are supported.',
  },
  {
    name: 'custom_text',
    type: 'object',
    description:
      'Display additional text for your customers using custom text.',
    expandable: true,
    children: [
      {
        name: 'after_submit',
        type: 'object',
        description:
          'Custom text displayed after the payment confirmation button.',
        expandable: true,
        children: [
          {
            name: 'message',
            type: 'string',
            required: true,
            description: 'Text to display, up to 1200 characters.',
          },
        ],
      },
      {
        name: 'shipping_address',
        type: 'object',
        description:
          'Custom text displayed alongside shipping address collection.',
        expandable: true,
        children: [
          {
            name: 'message',
            type: 'string',
            required: true,
            description: 'Text to display, up to 1200 characters.',
          },
        ],
      },
      {
        name: 'submit',
        type: 'object',
        description:
          'Custom text displayed alongside the payment confirmation button.',
        expandable: true,
        children: [
          {
            name: 'message',
            type: 'string',
            required: true,
            description: 'Text to display, up to 1200 characters.',
          },
        ],
      },
      {
        name: 'terms_of_service_acceptance',
        type: 'object',
        description:
          'Custom text displayed in place of the default terms of service agreement text.',
        expandable: true,
        children: [
          {
            name: 'message',
            type: 'string',
            required: true,
            description: 'Text to display, up to 1200 characters.',
          },
        ],
      },
    ],
  },
  {
    name: 'customer_account',
    type: 'string',
    description: 'ID of the Account for this Session.',
  },
  {
    name: 'customer_creation',
    type: 'enum',
    description:
      'Configures whether a Checkout Session creates a Customer when it completes.',
    enumValues: [{ value: 'always' }, { value: 'if_required' }],
  },
  {
    name: 'customer_update',
    type: 'object',
    description:
      'Controls what fields on Customer can be updated by the Checkout Session.',
    expandable: true,
    children: [
      {
        name: 'address',
        type: 'enum',
        description:
          'Describes whether Checkout saves the billing address onto the customer.',
        enumValues: [{ value: 'auto' }, { value: 'never' }],
      },
      {
        name: 'name',
        type: 'enum',
        description:
          'Describes whether Checkout saves the name onto the customer.',
        enumValues: [{ value: 'auto' }, { value: 'never' }],
      },
      {
        name: 'shipping',
        type: 'enum',
        description:
          'Describes whether Checkout saves shipping information onto the customer.',
        enumValues: [{ value: 'auto' }, { value: 'never' }],
      },
    ],
  },
  {
    name: 'discounts',
    type: 'array of objects',
    description:
      'The coupon or promotion code to apply to this Session. Maximum of 1.',
    expandable: true,
    children: [
      {
        name: 'coupon',
        type: 'string',
        description: 'The ID of the coupon to apply to this Session.',
      },
      {
        name: 'promotion_code',
        type: 'string',
        description: 'The ID of a promotion code to apply to this Session.',
      },
    ],
  },
  {
    name: 'excluded_payment_method_types',
    type: 'array of strings',
    description:
      'The list of payment method types to exclude from use with this payment.',
  },
  {
    name: 'integration_identifier',
    type: 'string',
    description:
      'The integration identifier for this Checkout Session. Multiple sessions can share the same integration identifier.',
  },
  {
    name: 'invoice_creation',
    type: 'object',
    description: 'Generate a post-payment Invoice for one-time payments.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        required: true,
        description: 'Set to true to enable invoice creation.',
      },
      {
        name: 'invoice_data',
        type: 'object',
        description:
          'Parameters passed when creating invoices for this Session.',
        expandable: true,
        children: [
          {
            name: 'account_tax_ids',
            type: 'array of strings',
            description: 'The account tax IDs associated with the invoice.',
          },
          {
            name: 'description',
            type: 'string',
            description: 'An arbitrary string attached to the invoice.',
          },
          {
            name: 'footer',
            type: 'string',
            description: 'Footer displayed on the invoice.',
          },
          {
            name: 'metadata',
            type: 'object',
            description: 'Set of key-value pairs attached to the invoice.',
          },
        ],
      },
    ],
  },
  {
    name: 'locale',
    type: 'string',
    description:
      'The IETF language tag of the locale Checkout is displayed in. Defaults to <code>auto</code>.',
  },
  {
    name: 'managed_payments',
    type: 'object',
    description:
      'Settings for Managed Payments for this Checkout Session and resulting PaymentIntents, Invoices, and Subscriptions.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description: 'Set to true to enable Managed Payments.',
      },
    ],
  },
  {
    name: 'name_collection',
    type: 'object',
    description: 'Controls name collection settings for the session.',
    expandable: true,
    children: [
      {
        name: 'business',
        type: 'object',
        description: "Settings for collecting a business's name.",
        expandable: true,
        children: [
          {
            name: 'enabled',
            type: 'boolean',
            required: true,
            description: 'Set to true to collect the business name.',
          },
          {
            name: 'optional',
            type: 'boolean',
            description:
              'Whether the customer is required to complete the field. Defaults to false.',
          },
        ],
      },
      {
        name: 'individual',
        type: 'object',
        description: "Settings for collecting an individual's name.",
        expandable: true,
        children: [
          {
            name: 'enabled',
            type: 'boolean',
            required: true,
            description: 'Set to true to collect the individual name.',
          },
          {
            name: 'optional',
            type: 'boolean',
            description:
              'Whether the customer is required to complete the field. Defaults to false.',
          },
        ],
      },
    ],
  },
  {
    name: 'optional_items',
    type: 'array of objects',
    description:
      'The optional items to present to the customer at checkout. Maximum of 10.',
    expandable: true,
    children: [
      {
        name: 'price',
        type: 'string',
        required: true,
        description: 'The ID of the price object.',
      },
      {
        name: 'quantity',
        type: 'integer',
        required: true,
        description:
          'The initial quantity of the line item created when the item is checked out.',
      },
      {
        name: 'adjustable_quantity',
        type: 'object',
        description:
          'When set, provides configuration for the customer to adjust the quantity of the item.',
        expandable: true,
        children: ADJUSTABLE_QUANTITY_PARAM_CHILDREN,
      },
    ],
  },
  {
    name: 'origin_context',
    type: 'enum',
    description:
      'Where the user is coming from. This informs the optimizations that are applied to the session.',
    enumValues: [{ value: 'mobile_app' }, { value: 'web' }],
  },
  {
    name: 'payment_method_collection',
    type: 'enum',
    description:
      'Configures whether a Checkout Session should collect a payment method. Defaults to <code>always</code>.',
    enumValues: [{ value: 'always' }, { value: 'if_required' }],
  },
  {
    name: 'payment_method_options',
    type: 'object',
    description:
      'Payment-method-specific configuration for the PaymentIntent or SetupIntent generated by this Session.',
    expandable: true,
    children: [
      {
        name: 'crypto',
        type: 'object',
        description:
          'Configuration applied to crypto (USDC wallet) payment attempts.',
        expandable: true,
        children: [
          {
            name: 'setup_future_usage',
            type: 'enum',
            description:
              'Indicates that you intend to make future payments with this payment method.',
            enumValues: [{ value: 'none' }],
          },
        ],
      },
    ],
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless exposes only the <code>crypto</code> options bag for USDC wallet payments.',
  },
  {
    name: 'permissions',
    type: 'object',
    description:
      'Sets up permissions for various actions (for example, <code>update</code>) on the Checkout Session object.',
    expandable: true,
    children: [
      {
        name: 'update_shipping_details',
        type: 'enum',
        description:
          'Determines which entity is allowed to update the shipping details. Default is <code>client_only</code>.',
        enumValues: [{ value: 'client_only' }, { value: 'server_only' }],
      },
    ],
  },
  {
    name: 'phone_number_collection',
    type: 'object',
    description: 'Controls phone number collection settings for the session.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        required: true,
        description: "Set to true to collect the customer's phone number.",
      },
    ],
  },
  {
    name: 'redirect_on_completion',
    type: 'enum',
    description:
      'Applies to <code>ui_mode: embedded_page</code>. Defaults to <code>always</code>.',
    enumValues: [
      { value: 'always' },
      { value: 'if_required' },
      { value: 'never' },
    ],
  },
  {
    name: 'return_url',
    type: 'string',
    description:
      'Applies to Checkout Sessions with <code>ui_mode: embedded_page</code> or <code>ui_mode: elements</code>. The URL to redirect your customer to after they authenticate or cancel their payment.',
  },
  {
    name: 'saved_payment_method_options',
    type: 'object',
    description:
      'Controls saved payment method settings for the session. Only available in <code>payment</code> and <code>subscription</code> mode.',
    expandable: true,
    children: [
      {
        name: 'allow_redisplay_filters',
        type: 'array of strings',
        description:
          'Filters the saved payment methods presented to a returning customer by their <code>allow_redisplay</code> value.',
        enumValues: [
          { value: 'always' },
          { value: 'limited' },
          { value: 'unspecified' },
        ],
      },
      {
        name: 'payment_method_remove',
        type: 'enum',
        description:
          'Enables customers to choose whether to remove their saved payment methods. Disabled by default.',
        enumValues: [{ value: 'disabled' }, { value: 'enabled' }],
      },
      {
        name: 'payment_method_save',
        type: 'enum',
        description:
          'Enables customers to choose whether to save their payment method for future use. Disabled by default.',
        enumValues: [{ value: 'disabled' }, { value: 'enabled' }],
      },
    ],
  },
  {
    name: 'setup_intent_data',
    type: 'object',
    description:
      'A subset of parameters passed to SetupIntent creation for Checkout Sessions in <code>setup</code> mode.',
    expandable: true,
    children: [
      {
        name: 'description',
        type: 'string',
        description:
          'An arbitrary string attached to the resulting SetupIntent.',
      },
      {
        name: 'metadata',
        type: 'object',
        description:
          'Set of key-value pairs attached to the resulting SetupIntent.',
      },
      {
        name: 'on_behalf_of',
        type: 'string',
        description:
          'The connected account for which the SetupIntent is intended.',
      },
    ],
  },
  {
    name: 'shipping_address_collection',
    type: 'object',
    description:
      'Configuration for Checkout to collect a shipping address from a customer.',
    expandable: true,
    children: [
      {
        name: 'allowed_countries',
        type: 'array of strings',
        required: true,
        description:
          'Two-letter country codes representing which countries Checkout should offer as shipping locations.',
      },
    ],
  },
  {
    name: 'shipping_options',
    type: 'array of objects',
    description:
      'The shipping rate options to apply to this Session. Maximum of 5.',
    expandable: true,
    children: SHIPPING_OPTION_PARAM_CHILDREN,
  },
  {
    name: 'submit_type',
    type: 'enum',
    description:
      'Describes the type of transaction being performed by Checkout, used to customize relevant text on the page.',
    enumValues: [
      { value: 'auto' },
      { value: 'book' },
      { value: 'donate' },
      { value: 'pay' },
      { value: 'subscribe' },
    ],
  },
  {
    name: 'tax_id_collection',
    type: 'object',
    description: 'Controls tax ID collection settings for the session.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        required: true,
        description: 'Set to true to collect a tax ID.',
      },
      {
        name: 'required',
        type: 'enum',
        description:
          'Indicates whether a tax ID is required on the payment page.',
        enumValues: [{ value: 'if_supported' }, { value: 'never' }],
      },
    ],
  },
  {
    name: 'ui_mode',
    type: 'enum',
    description:
      'The UI mode of the Session. Defaults to <code>hosted_page</code>.',
    enumValues: [
      { value: 'elements' },
      { value: 'embedded_page' },
      { value: 'hosted_page' },
    ],
  },
  {
    name: 'wallet_options',
    type: 'object',
    description: 'Wallet-specific configuration for this Checkout Session.',
    expandable: true,
    children: [
      {
        name: 'link',
        type: 'object',
        description: 'Configuration for Link, retained for API parity.',
        expandable: true,
        children: [
          {
            name: 'display',
            type: 'enum',
            description:
              'Describes whether Checkout should display Link. Defaults to <code>auto</code>.',
            enumValues: [{ value: 'auto' }, { value: 'never' }],
          },
        ],
      },
    ],
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless connects Solana wallets directly rather than a Stripe-hosted wallet product. This field is retained for API parity but has no Zoneless equivalent.',
  },
];

export const CHECKOUT_SESSIONS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a Checkout Session',
  description: 'Creates a Checkout Session object.',
  endpoints: [{ method: 'POST', path: '/v1/checkout/sessions' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Recommended flow: ',
          text: 'Create a <a href="#prices-object">Price</a> for each item you sell, then reference its ID from <code>line_items</code>. After creating the Session, redirect your customer to its <code>url</code> to begin Checkout.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_CHECKOUT_SESSION_PARAMETERS,
          moreAttributes: CREATE_CHECKOUT_SESSION_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a Checkout Session object.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/checkout/sessions' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/checkout/sessions \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d success_url="https://shop.example.com/order/complete" \\
  -d "line_items[0][price]"=price_z_1RqEsLkdIwHu7ix7Ssho8Cl \\
  -d "line_items[0][quantity]"=2 \\
  -d mode=payment`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const session = await zoneless.checkout.sessions.create({
  success_url: 'https://shop.example.com/order/complete',
  line_items: [
    {
      price: 'price_z_1RqEsLkdIwHu7ix7Ssho8Cl',
      quantity: 2,
    },
  ],
  mode: 'payment',
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: CHECKOUT_SESSION_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Update
// ============================================

const UPDATE_CHECKOUT_SESSION_PARAMETERS: Attribute[] = [
  {
    name: 'collected_information',
    type: 'object',
    description:
      'Information about the customer collected within the Checkout Session.',
    expandable: true,
    children: [
      {
        name: 'shipping_details',
        type: 'object',
        description: 'Shipping information for this Checkout Session.',
        expandable: true,
        children: [
          {
            name: 'address',
            type: 'object',
            required: true,
            description: 'Customer address.',
            expandable: true,
            children: ADDRESS_PARAM_CHILDREN,
          },
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'Customer name.',
          },
        ],
      },
    ],
  },
  {
    name: 'line_items',
    type: 'array of objects',
    description:
      'A list of items the customer is purchasing. To retain an existing line item unchanged, specify only its <code>id</code>. To update one, specify its <code>id</code> along with the fields to change. To add a new line item, omit <code>id</code> and specify <code>price</code> or <code>price_data</code> with a <code>quantity</code>. To remove a line item, omit it from the array entirely. Maximum of 100 line items.',
    expandable: true,
    children: UPDATE_LINE_ITEM_PARAM_CHILDREN,
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'shipping_options',
    type: 'array of objects',
    description:
      'The shipping rate options to apply to this Session. Maximum of 5.',
    expandable: true,
    children: SHIPPING_OPTION_PARAM_CHILDREN,
  },
];

export const CHECKOUT_SESSIONS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a Checkout Session',
  description:
    'Updates a Checkout Session object. You can only update Sessions that are in an <code>open</code> state.',
  endpoints: [{ method: 'POST', path: '/v1/checkout/sessions/:id' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Note: ',
          text: 'A Checkout Session can only be updated while its status is <code>open</code>. Use this to attach order metadata, update shipping details after collection, or adjust line items before the customer pays.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_CHECKOUT_SESSION_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a Checkout Session object.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/checkout/sessions/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/checkout/sessions/cs_z_a8KmQ2vLpR5wT9bHxJcFnW4uY \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[order_id]"=8841`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const session = await zoneless.checkout.sessions.update(
  'cs_z_a8KmQ2vLpR5wT9bHxJcFnW4uY',
  {
    metadata: {
      order_id: '8841',
    },
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: CHECKOUT_SESSION_UPDATE_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Retrieve
// ============================================

export const CHECKOUT_SESSIONS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a Checkout Session',
  description: 'Retrieves a Checkout Session object.',
  endpoints: [{ method: 'GET', path: '/v1/checkout/sessions/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a Checkout Session if a valid identifier was provided.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/checkout/sessions/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/checkout/sessions/cs_z_a8KmQ2vLpR5wT9bHxJcFnW4uY \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const session = await zoneless.checkout.sessions.retrieve(
  'cs_z_a8KmQ2vLpR5wT9bHxJcFnW4uY'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: CHECKOUT_SESSION_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// List
// ============================================

const LIST_CHECKOUT_SESSIONS_PARAMETERS: Attribute[] = [
  {
    name: 'customer',
    type: 'string',
    description:
      'Only return Checkout Sessions for the Customer specified by this customer ID.',
  },
  {
    name: 'status',
    type: 'enum',
    description: 'Only return Checkout Sessions with this status.',
    enumValues: [
      { value: 'complete' },
      { value: 'expired' },
      { value: 'open' },
    ],
  },
  {
    name: 'limit',
    type: 'integer',
    description:
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
  },
];

const LIST_CHECKOUT_SESSIONS_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'created',
    type: 'object',
    description:
      'Only return Checkout Sessions that were created during the given date interval.',
    expandable: true,
    children: TIMESTAMP_RANGE_CHILDREN,
  },
  {
    name: 'customer_account',
    type: 'string',
    description:
      'Only return Checkout Sessions for the Account specified by this ID.',
  },
  {
    name: 'customer_details',
    type: 'object',
    description:
      'Only return Checkout Sessions with the given customer details.',
    expandable: true,
    children: [
      {
        name: 'email',
        type: 'string',
        required: true,
        description: 'Only return Checkout Sessions with this customer email.',
      },
    ],
  },
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>cs_z_bar</code>, your subsequent call can include <code>ending_before=cs_z_bar</code> in order to fetch the previous page of the list.',
  },
  {
    name: 'payment_intent',
    type: 'string',
    description:
      'Only return Checkout Sessions for the PaymentIntent specified by this ID.',
  },
  {
    name: 'payment_link',
    type: 'string',
    description:
      'Only return Checkout Sessions for the Payment Link specified by this ID.',
  },
  {
    name: 'starting_after',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>cs_z_foo</code>, your subsequent call can include <code>starting_after=cs_z_foo</code> in order to fetch the next page of the list.',
  },
  {
    name: 'subscription',
    type: 'string',
    description:
      'Only return Checkout Sessions for the Subscription specified by this ID.',
  },
];

export const CHECKOUT_SESSIONS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all Checkout Sessions',
  description: 'Returns a list of Checkout Sessions.',
  endpoints: [{ method: 'GET', path: '/v1/checkout/sessions' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_CHECKOUT_SESSIONS_PARAMETERS,
          moreAttributes: LIST_CHECKOUT_SESSIONS_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> Checkout Sessions, starting after Checkout Session <code>starting_after</code>. Each entry in the array is a separate <a href="#checkout-sessions-object">Checkout Session</a> object. If no more Checkout Sessions are available, the resulting array is empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/checkout/sessions' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/checkout/sessions \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const sessions = await zoneless.checkout.sessions.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_CHECKOUT_SESSIONS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Expire
// ============================================

export const CHECKOUT_SESSIONS_EXPIRE_PAGE: DocPage = {
  id: 'expire',
  title: 'Expire a Checkout Session',
  description:
    'A Checkout Session can be expired when it is in <code>open</code> status. Once a Session is expired, it can no longer be used to complete a payment and customers can no longer access the Checkout page for it. Expiring a Session has the same effect as it expiring naturally, and any customer that attempts to pay is redirected to a page that says the Session is expired.',
  endpoints: [{ method: 'POST', path: '/v1/checkout/sessions/:id/expire' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'warning',
          title: 'Note: ',
          text: 'Only Checkout Sessions in <code>open</code> status can be expired. Attempting to expire an already-completed or already-expired Session returns an error.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: "Returns a Checkout Session object if the expiration succeeds. Returns an error if the Session has already expired or isn't in an expirable state.",
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'POST',
            path: '/v1/checkout/sessions/:id/expire',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/checkout/sessions/cs_z_b3Ae6ClgOkjygKwrf9B3L6ITtUu/expire \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -X POST`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const session = await zoneless.checkout.sessions.expire(
  'cs_z_b3Ae6ClgOkjygKwrf9B3L6ITtUu'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: CHECKOUT_SESSION_EXPIRE_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// List line items
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

export const CHECKOUT_SESSIONS_LIST_LINE_ITEMS_PAGE: DocPage = {
  id: 'list-line-items',
  title: "Retrieve a Checkout Session's line items",
  description:
    'When retrieving a Checkout Session, there is an option to expand the <code>line_items</code> field. This lets you retrieve the list of line items directly without expanding the whole Session.',
  endpoints: [{ method: 'GET', path: '/v1/checkout/sessions/:id/line_items' }],
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
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> line items for the given Checkout Session, starting after line item <code>starting_after</code>. Each entry in the array is a separate line item object. If no more line items are available, the resulting array is empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'GET',
            path: '/v1/checkout/sessions/:id/line_items',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/checkout/sessions/cs_z_a8KmQ2vLpR5wT9bHxJcFnW4uY/line_items \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const lineItems = await zoneless.checkout.sessions.listLineItems(
  'cs_z_a8KmQ2vLpR5wT9bHxJcFnW4uY'
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

export const CHECKOUT_SESSIONS_PAGES: DocPage[] = [
  CHECKOUT_SESSIONS_OVERVIEW_PAGE,
  CHECKOUT_SESSIONS_CREATE_PAGE,
  CHECKOUT_SESSIONS_UPDATE_PAGE,
  CHECKOUT_SESSIONS_RETRIEVE_PAGE,
  CHECKOUT_SESSIONS_LIST_PAGE,
  CHECKOUT_SESSIONS_EXPIRE_PAGE,
  CHECKOUT_SESSIONS_LIST_LINE_ITEMS_PAGE,
];
