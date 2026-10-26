import { DocSubSection, DocPage, Attribute } from './types';
import { NODE_INIT, EXPAND_TOOLTIP, BuildEndpointSummaries } from './shared';
import { GetResourceEventAttributes } from './event-types';

export const PAYMENT_LINKS_SUBSECTION: DocSubSection = {
  id: 'payment-links',
  title: 'Payment Links',
  children: [
    { id: 'object', title: 'The Payment Link object' },
    { id: 'create', title: 'Create a payment link' },
    { id: 'update', title: 'Update a payment link' },
    { id: 'retrieve', title: 'Retrieve a payment link' },
    { id: 'list-line-items', title: "Retrieve a payment link's line items" },
    { id: 'list', title: 'List all payment links' },
  ],
};

// ============================================
// Shared helpers
// ============================================

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
      'The maximum quantity the customer can purchase. Defaults to 99. You can specify a value up to 999999.',
  },
  {
    name: 'minimum',
    type: 'integer',
    description:
      "The minimum quantity the customer can purchase. Defaults to 0. If there is only one item in the cart, that item's quantity cannot go down to 0.",
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
        description: 'Specifies billing frequency.',
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
      'A non-negative integer in the smallest currency unit representing how much to charge.',
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
    name: 'quantity',
    type: 'integer',
    required: true,
    description: 'The quantity of the line item being purchased.',
  },
  {
    name: 'adjustable_quantity',
    type: 'object',
    description:
      "When set, provides configuration for this item's quantity to be adjusted by the customer during checkout.",
    expandable: true,
    children: ADJUSTABLE_QUANTITY_PARAM_CHILDREN,
  },
  {
    name: 'price',
    type: 'string',
    requiredText: 'Required unless price_data is provided',
    description:
      'The ID of the Price object. One of <code>price</code> or <code>price_data</code> is required.',
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
];

const UPDATE_LINE_ITEM_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    required: true,
    description: 'The ID of an existing line item on the payment link.',
  },
  {
    name: 'adjustable_quantity',
    type: 'object',
    description:
      "When set, provides configuration for this item's quantity to be adjusted by the customer during checkout.",
    expandable: true,
    children: ADJUSTABLE_QUANTITY_PARAM_CHILDREN,
  },
  {
    name: 'quantity',
    type: 'integer',
    description: 'The quantity of the line item being purchased.',
  },
];

const OPTIONAL_ITEM_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'price',
    type: 'string',
    required: true,
    description: 'The ID of the Price object.',
  },
  {
    name: 'quantity',
    type: 'integer',
    required: true,
    description:
      'The initial quantity of the line item created when a customer chooses to add this optional item.',
  },
  {
    name: 'adjustable_quantity',
    type: 'object',
    description:
      'When set, provides configuration for the customer to adjust the quantity of the optional item.',
    expandable: true,
    children: ADJUSTABLE_QUANTITY_PARAM_CHILDREN,
  },
];

const CUSTOM_FIELD_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'key',
    type: 'string',
    required: true,
    description:
      'String of your choice that your integration can use to reconcile this field. Must be unique to this field, alphanumeric, and up to 200 characters.',
  },
  {
    name: 'label',
    type: 'object',
    required: true,
    description: 'The label for the field, displayed to the customer.',
    expandable: true,
    children: [
      {
        name: 'custom',
        type: 'string',
        required: true,
        description:
          'Custom text for the label, displayed to the customer. Up to 50 characters.',
      },
      {
        name: 'type',
        type: 'enum',
        required: true,
        description: 'The type of the label.',
        enumValues: [
          { value: 'custom', description: 'Set a custom label for the field.' },
        ],
      },
    ],
  },
  {
    name: 'type',
    type: 'enum',
    required: true,
    description: 'The type of the field.',
    enumValues: [
      {
        value: 'dropdown',
        description: 'Provide a list of options for your customer to select.',
      },
      {
        value: 'numeric',
        description: 'Collect a numbers-only field from your customer.',
      },
      {
        value: 'text',
        description: 'Collect a string field from your customer.',
      },
    ],
  },
  {
    name: 'dropdown',
    type: 'object',
    description: 'Configuration for <code>type=dropdown</code> fields.',
    expandable: true,
    children: [
      {
        name: 'options',
        type: 'array of objects',
        required: true,
        description:
          'The options available for the customer to select. Up to 200 options allowed.',
        expandable: true,
        children: [
          {
            name: 'label',
            type: 'string',
            required: true,
            description:
              'The label for the option, displayed to the customer. Up to 100 characters.',
          },
          {
            name: 'value',
            type: 'string',
            required: true,
            description:
              'The value for this option, used by your integration. Must be unique, alphanumeric, and up to 100 characters.',
          },
        ],
      },
      {
        name: 'default_value',
        type: 'string',
        description:
          'The value that pre-fills the field on the payment page. Must match a <code>value</code> in the <code>options</code> array.',
      },
    ],
  },
  {
    name: 'numeric',
    type: 'object',
    description: 'Configuration for <code>type=numeric</code> fields.',
    expandable: true,
    children: [
      {
        name: 'default_value',
        type: 'string',
        description: 'The value that pre-fills the field on the payment page.',
      },
      {
        name: 'maximum_length',
        type: 'integer',
        description:
          "The maximum character length constraint for the customer's input.",
      },
      {
        name: 'minimum_length',
        type: 'integer',
        description:
          "The minimum character length requirement for the customer's input.",
      },
    ],
  },
  {
    name: 'optional',
    type: 'boolean',
    description:
      'Whether the customer is required to complete the field before completing checkout. Defaults to <code>false</code>.',
  },
  {
    name: 'text',
    type: 'object',
    description: 'Configuration for <code>type=text</code> fields.',
    expandable: true,
    children: [
      {
        name: 'default_value',
        type: 'string',
        description: 'The value that pre-fills the field on the payment page.',
      },
      {
        name: 'maximum_length',
        type: 'integer',
        description:
          "The maximum character length constraint for the customer's input.",
      },
      {
        name: 'minimum_length',
        type: 'integer',
        description:
          "The minimum character length requirement for the customer's input.",
      },
    ],
  },
];

const CUSTOM_TEXT_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'after_submit',
    type: 'object',
    description: 'Custom text displayed after the payment confirmation button.',
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
    description: 'Custom text displayed alongside shipping address collection.',
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
];

const AFTER_COMPLETION_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'type',
    type: 'enum',
    required: true,
    description: 'The specified behavior after the purchase is complete.',
    enumValues: [
      {
        value: 'hosted_confirmation',
        description:
          'Displays a message on the hosted surface after the purchase is complete.',
      },
      {
        value: 'redirect',
        description:
          'Redirects the customer to the specified <code>url</code> after the purchase is complete.',
      },
    ],
  },
  {
    name: 'hosted_confirmation',
    type: 'object',
    description: 'Configuration when <code>type=hosted_confirmation</code>.',
    expandable: true,
    children: [
      {
        name: 'custom_message',
        type: 'string',
        description:
          'A custom message to display to the customer after the purchase is complete. Up to 500 characters.',
      },
    ],
  },
  {
    name: 'redirect',
    type: 'object',
    description: 'Configuration when <code>type=redirect</code>.',
    expandable: true,
    children: [
      {
        name: 'url',
        type: 'string',
        required: true,
        description:
          'The URL the customer will be redirected to after the purchase is complete. You can embed <code>{CHECKOUT_SESSION_ID}</code> into the URL to include the ID of the completed Checkout Session.',
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
      "Set to <code>true</code> to calculate tax automatically using the customer's location.",
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
        requiredText: 'Required only if type is account',
        description:
          'The connected account being referenced when <code>type</code> is <code>account</code>.',
      },
    ],
  },
];

const INVOICE_CREATION_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'enabled',
    type: 'boolean',
    required: true,
    description: 'Whether invoice creation is enabled.',
  },
  {
    name: 'invoice_data',
    type: 'object',
    description:
      'Configuration for the invoice. Default invoice values are used if unspecified.',
    expandable: true,
    children: [
      {
        name: 'account_tax_ids',
        type: 'array of strings',
        description: 'The account tax IDs associated with the invoice.',
      },
      {
        name: 'custom_fields',
        type: 'array of objects',
        description:
          'A list of up to 4 custom fields to display on the invoice.',
        expandable: true,
        children: [
          {
            name: 'name',
            type: 'string',
            required: true,
            description: 'The name of the custom field. Up to 40 characters.',
          },
          {
            name: 'value',
            type: 'string',
            required: true,
            description: 'The value of the custom field. Up to 140 characters.',
          },
        ],
      },
      {
        name: 'description',
        type: 'string',
        description:
          'An arbitrary string attached to the object. Often useful for displaying to users.',
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
            requiredText: 'Required only if type is account',
            description:
              'The connected account being referenced when <code>type</code> is <code>account</code>.',
          },
        ],
      },
      {
        name: 'metadata',
        type: 'object',
        description: 'Set of key-value pairs that you can attach to an object.',
      },
      {
        name: 'rendering_options',
        type: 'object',
        description: 'Options for invoice PDF rendering.',
        expandable: true,
        children: [
          {
            name: 'amount_tax_display',
            type: 'enum',
            description:
              'How line-item prices and amounts are displayed with respect to tax on invoice PDFs.',
            enumValues: [
              { value: 'exclude_tax' },
              { value: 'include_inclusive_tax' },
            ],
          },
          {
            name: 'template',
            type: 'string',
            description:
              'ID of the invoice rendering template to use for this invoice.',
          },
        ],
      },
    ],
  },
];

const NAME_COLLECTION_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'business',
    type: 'object',
    description:
      "Controls settings applied for collecting the customer's business name.",
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        required: true,
        description:
          'Enable business name collection on the payment link. Defaults to <code>false</code>.',
      },
      {
        name: 'optional',
        type: 'boolean',
        description:
          'Whether the customer is required to provide their business name before checking out. Defaults to <code>false</code>.',
      },
    ],
  },
  {
    name: 'individual',
    type: 'object',
    description:
      "Controls settings applied for collecting the customer's individual name.",
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        required: true,
        description:
          'Enable individual name collection on the payment link. Defaults to <code>false</code>.',
      },
      {
        name: 'optional',
        type: 'boolean',
        description:
          'Whether the customer is required to provide their full name before checking out. Defaults to <code>false</code>.',
      },
    ],
  },
];

const CREATE_PAYMENT_INTENT_DATA_PARAM_CHILDREN: Attribute[] = [
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
      'An arbitrary string attached to the object. Often useful for displaying to users.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that will set metadata on Payment Intents generated from this payment link.',
  },
  {
    name: 'setup_future_usage',
    type: 'enum',
    description:
      'Indicates that you intend to make future payments with the payment method collected during checkout.',
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
    name: 'transfer_group',
    type: 'string',
    description:
      'A string that identifies the resulting payment as part of a group.',
  },
];

const UPDATE_PAYMENT_INTENT_DATA_PARAM_CHILDREN: Attribute[] = [
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
      'Set of key-value pairs that will set metadata on Payment Intents generated from this payment link.',
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
    name: 'transfer_group',
    type: 'string',
    description:
      'A string that identifies the resulting payment as part of a group.',
  },
];

const CREATE_SUBSCRIPTION_DATA_PARAM_CHILDREN: Attribute[] = [
  {
    name: 'description',
    type: 'string',
    description:
      "The subscription's description, meant to be displayable to the customer. Up to 500 characters.",
  },
  {
    name: 'invoice_settings',
    type: 'object',
    description: 'All invoices will be billed using the specified settings.',
    expandable: true,
    children: [
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
            requiredText: 'Required only if type is account',
            description:
              'The connected account being referenced when <code>type</code> is <code>account</code>.',
          },
        ],
      },
    ],
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that will set metadata on Subscriptions generated from this payment link.',
  },
  {
    name: 'trial_period_days',
    type: 'integer',
    description:
      'Integer representing the number of trial period days before the customer is charged for the first time. Must be at least 1.',
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
          'Defines how the subscription should behave when the free trial ends.',
        expandable: true,
        children: [
          {
            name: 'missing_payment_method',
            type: 'enum',
            required: true,
            description:
              'Indicates how the subscription should change when the trial ends if the user did not provide a payment method.',
            enumValues: [
              {
                value: 'cancel',
                description:
                  'Cancel the subscription if a payment method is not attached when the trial ends.',
              },
              {
                value: 'create_invoice',
                description:
                  'Create an invoice when the trial ends, even if the user did not set up a payment method.',
              },
              {
                value: 'pause',
                description:
                  'Pause the subscription if a payment method is not attached when the trial ends.',
              },
            ],
          },
        ],
      },
    ],
  },
];

const UPDATE_SUBSCRIPTION_DATA_PARAM_CHILDREN: Attribute[] =
  CREATE_SUBSCRIPTION_DATA_PARAM_CHILDREN.filter(
    (attribute) => attribute.name !== 'description'
  );

const PAYMENT_METHOD_OPTIONS_PARAM_CHILDREN: Attribute[] = [
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
  {
    name: 'card',
    type: 'object',
    description:
      'Configuration for <code>card</code> payment methods, retained for API parity.',
    expandable: true,
    children: [
      {
        name: 'restrictions',
        type: 'object',
        description: 'Restrictions to apply to the card payment method.',
        expandable: true,
        children: [
          {
            name: 'brands_blocked',
            type: 'array of enums',
            description: 'The card brands to block.',
            enumValues: [
              { value: 'american_express' },
              { value: 'discover_global_network' },
              { value: 'mastercard' },
              { value: 'visa' },
            ],
          },
        ],
      },
    ],
  },
];

// ============================================
// Shared example objects
// ============================================

const PAYMENT_LINK_OBJECT_JSON = `{
  "id": "plink_z_7nQ2wKpR9xVmHc4bYtLsJ8fA",
  "object": "payment_link",
  "active": true,
  "created": 1725123600,
  "after_completion": {
    "hosted_confirmation": {
      "custom_message": null
    },
    "redirect": null,
    "type": "hosted_confirmation"
  },
  "allow_promotion_codes": false,
  "application": null,
  "application_fee_amount": null,
  "application_fee_percent": null,
  "automatic_tax": {
    "enabled": false,
    "liability": null
  },
  "billing_address_collection": "auto",
  "consent_collection": null,
  "currency": "usdc",
  "custom_fields": [],
  "custom_text": {
    "after_submit": null,
    "shipping_address": null,
    "submit": null,
    "terms_of_service_acceptance": null
  },
  "customer_creation": "if_required",
  "inactive_message": null,
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
  "managed_payments": null,
  "metadata": {},
  "name_collection": null,
  "on_behalf_of": null,
  "optional_items": null,
  "payment_intent_data": null,
  "payment_method_collection": "always",
  "payment_method_options": null,
  "payment_method_types": [
    "crypto"
  ],
  "phone_number_collection": {
    "enabled": false
  },
  "restrictions": null,
  "shipping_address_collection": null,
  "shipping_options": [],
  "submit_type": "auto",
  "subscription_data": null,
  "tax_id_collection": {
    "enabled": false
  },
  "transfer_data": null,
  "url": "https://pay.yourdomain.com/b/n4k8m2p7q1",
  "url_slug": "n4k8m2p7q1",
  "platform_account": "acct_z_Platform123abc"
}`;

const PAYMENT_LINK_UPDATE_RESPONSE_JSON = `{
  "id": "plink_z_7nQ2wKpR9xVmHc4bYtLsJ8fA",
  "object": "payment_link",
  "active": true,
  "created": 1725123600,
  "after_completion": {
    "hosted_confirmation": {
      "custom_message": null
    },
    "redirect": null,
    "type": "hosted_confirmation"
  },
  "allow_promotion_codes": false,
  "application": null,
  "application_fee_amount": null,
  "application_fee_percent": null,
  "automatic_tax": {
    "enabled": false,
    "liability": null
  },
  "billing_address_collection": "auto",
  "consent_collection": null,
  "currency": "usdc",
  "custom_fields": [],
  "custom_text": {
    "after_submit": null,
    "shipping_address": null,
    "submit": null,
    "terms_of_service_acceptance": null
  },
  "customer_creation": "if_required",
  "inactive_message": null,
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
  "managed_payments": null,
  "metadata": {
    "order_id": "8492"
  },
  "name_collection": null,
  "on_behalf_of": null,
  "optional_items": null,
  "payment_intent_data": null,
  "payment_method_collection": "always",
  "payment_method_options": null,
  "payment_method_types": [
    "crypto"
  ],
  "phone_number_collection": {
    "enabled": false
  },
  "restrictions": null,
  "shipping_address_collection": null,
  "shipping_options": [],
  "submit_type": "auto",
  "subscription_data": null,
  "tax_id_collection": {
    "enabled": false
  },
  "transfer_data": null,
  "url": "https://pay.yourdomain.com/b/n4k8m2p7q1",
  "url_slug": "n4k8m2p7q1",
  "platform_account": "acct_z_Platform123abc"
}`;

const LIST_PAYMENT_LINKS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/payment_links",
  "has_more": false,
  "data": [
${PAYMENT_LINK_OBJECT_JSON.split('\n')
  .map((line) => (line ? `    ${line}` : line))
  .join('\n')}
  ]
}`;

const LIST_LINE_ITEMS_RESPONSE_JSON = `{
  "object": "list",
  "data": [
    {
      "id": "li_z_8mKpQ2vRxWnJc4bYt",
      "object": "item",
      "amount_discount": 0,
      "amount_subtotal": 2500,
      "amount_tax": 0,
      "amount_total": 2500,
      "currency": "usdc",
      "description": "Studio Hoodie",
      "price": {
        "id": "price_z_4HsWnJc8mKpQ2vRx",
        "object": "price",
        "active": true,
        "billing_scheme": "per_unit",
        "created": 1725037200,
        "currency": "usdc",
        "custom_unit_amount": null,
        "livemode": false,
        "lookup_key": null,
        "metadata": {},
        "nickname": null,
        "product": "prod_z_2vRxWnJc8mKpQ4Hs",
        "recurring": null,
        "tax_behavior": "unspecified",
        "tiers_mode": null,
        "transform_quantity": null,
        "type": "one_time",
        "unit_amount": 2500,
        "unit_amount_decimal": "2500"
      },
      "quantity": 1
    }
  ],
  "has_more": false,
  "url": "/v1/payment_links/plink_z_7nQ2wKpR9xVmHc4bYtLsJ8fA/line_items"
}`;

// ============================================
// Payment Link object attributes
// ============================================

const PAYMENT_LINK_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless Payment Link IDs are prefixed with <code>plink_z_</code>.',
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
      "Whether the payment link's <code>url</code> is active. If <code>false</code>, customers visiting the URL see a page saying that the link has been deactivated.",
  },
  {
    name: 'after_completion',
    type: 'object',
    description: 'Behavior after the purchase is complete.',
    expandable: true,
    children: [
      {
        name: 'hosted_confirmation',
        type: 'object',
        nullable: true,
        description:
          'Configuration when <code>type=hosted_confirmation</code>.',
        expandable: true,
        children: [
          {
            name: 'custom_message',
            type: 'string',
            nullable: true,
            description:
              'The custom message displayed to the customer after the purchase is complete.',
          },
        ],
      },
      {
        name: 'redirect',
        type: 'object',
        nullable: true,
        description: 'Configuration when <code>type=redirect</code>.',
        expandable: true,
        children: [
          {
            name: 'url',
            type: 'string',
            description:
              'The URL the customer is redirected to after the purchase is complete.',
          },
        ],
      },
      {
        name: 'type',
        type: 'enum',
        description: 'The specified behavior after the purchase is complete.',
        enumValues: [
          {
            value: 'hosted_confirmation',
            description:
              'Displays a message on the hosted surface after the purchase is complete.',
          },
          {
            value: 'redirect',
            description:
              'Redirects the customer to the specified <code>url</code> after the purchase is complete.',
          },
        ],
      },
    ],
  },
  {
    name: 'allow_promotion_codes',
    type: 'boolean',
    description: 'Whether user redeemable promotion codes are enabled.',
  },
  {
    name: 'currency',
    type: 'string',
    description:
      'Three-letter ISO currency code, in lowercase. For Zoneless, this is <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless settles in USDC on Solana rather than fiat currencies.',
  },
  {
    name: 'line_items',
    type: 'object',
    nullable: true,
    description:
      'The line items representing what is being sold. Expand this field with the <code>expand</code> request parameter, or retrieve them with the line items endpoint.',
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
    description:
      'Set of key-value pairs that you can attach to an object. Useful for storing additional information in a structured format.',
  },
  {
    name: 'payment_method_types',
    type: 'array of strings',
    nullable: true,
    description:
      'The list of payment method types that customers can use. When <code>null</code>, relevant payment methods enabled in your payment method settings are shown dynamically.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless currently accepts <code>crypto</code> (USDC on Solana) rather than cards or other fiat rails.',
  },
  {
    name: 'url',
    type: 'string',
    description: 'The public URL that can be shared with customers.',
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
      'Opaque slug used in the public payment link URL (<code>/b/{url_slug}</code>). Distinct from <code>id</code> so shareable links do not expose the API object ID.',
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API.",
  },
];

const PAYMENT_LINK_MORE_ATTRIBUTES: Attribute[] = [
  {
    name: 'application',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The ID of the Connect application that created the Payment Link.',
  },
  {
    name: 'application_fee_amount',
    type: 'integer',
    nullable: true,
    description:
      "The amount of the application fee (if any) that will be requested to be applied to the payment and transferred to the application owner's account.",
  },
  {
    name: 'application_fee_percent',
    type: 'float',
    nullable: true,
    description:
      "The percentage of the subscription invoice total that will be transferred to the application owner's account.",
  },
  {
    name: 'automatic_tax',
    type: 'object',
    description: 'Configuration details for automatic tax collection.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          "If <code>true</code>, tax is calculated automatically using the customer's location.",
      },
      {
        name: 'liability',
        type: 'object',
        nullable: true,
        description: "The account that's liable for tax.",
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
    name: 'billing_address_collection',
    type: 'enum',
    description:
      "Configuration for collecting the customer's billing address. Defaults to <code>auto</code>.",
    enumValues: [
      {
        value: 'auto',
        description:
          'Checkout only collects the billing address when necessary.',
      },
      {
        value: 'required',
        description: "Checkout always collects the customer's billing address.",
      },
    ],
  },
  {
    name: 'consent_collection',
    type: 'object',
    nullable: true,
    description:
      'When set, provides configuration to gather active consent from customers.',
    expandable: true,
    children: [
      {
        name: 'payment_method_reuse_agreement',
        type: 'object',
        nullable: true,
        description:
          'Settings related to the payment method reuse text shown in the Checkout UI.',
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
          'If set to <code>required</code>, customers must accept the terms of service before paying. If set to <code>none</code>, no checkbox is shown.',
        enumValues: [{ value: 'none' }, { value: 'required' }],
      },
    ],
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Time at which the object was created. Measured in seconds since the Unix epoch.',
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present on Stripe's Payment Link object. It is used for list pagination and consistency with other resources.",
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
    name: 'customer_creation',
    type: 'enum',
    description: 'Configuration for Customer creation during checkout.',
    enumValues: [
      {
        value: 'always',
        description:
          'The Checkout Session always creates a Customer when confirmation is attempted.',
      },
      {
        value: 'if_required',
        description:
          '(Default) The Checkout Session only creates a Customer if one is required for confirmation.',
      },
    ],
  },
  {
    name: 'inactive_message',
    type: 'string',
    nullable: true,
    description:
      'The custom message displayed to a customer when a payment link is no longer active.',
  },
  {
    name: 'invoice_creation',
    type: 'object',
    nullable: true,
    description:
      'Configuration for creating an invoice for payment-mode payment links.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description: 'Enable creating an invoice on successful payment.',
      },
      {
        name: 'invoice_data',
        type: 'object',
        nullable: true,
        description:
          'Configuration for the invoice. Default invoice values are used if unspecified.',
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
    name: 'managed_payments',
    type: 'object',
    nullable: true,
    description:
      'Settings for Managed Payments for this Payment Link and resulting Checkout Sessions, Payment Intents, Invoices, and Subscriptions.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Indicates whether Managed Payments is enabled for this transaction.',
      },
    ],
  },
  {
    name: 'name_collection',
    type: 'object',
    nullable: true,
    description:
      'Details on the state of name collection for the payment link.',
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
              'Indicates whether business name collection is enabled.',
          },
          {
            name: 'optional',
            type: 'boolean',
            description:
              'Whether the customer is required to complete the field before checking out. Defaults to <code>false</code>.',
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
              'Indicates whether individual name collection is enabled.',
          },
          {
            name: 'optional',
            type: 'boolean',
            description:
              'Whether the customer is required to complete the field before checking out. Defaults to <code>false</code>.',
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
    description: 'The account on behalf of which to charge.',
  },
  {
    name: 'optional_items',
    type: 'array of objects',
    nullable: true,
    description: 'The optional items presented to the customer at checkout.',
  },
  {
    name: 'payment_intent_data',
    type: 'object',
    nullable: true,
    description: 'Parameters passed to PaymentIntent creation during checkout.',
    expandable: true,
    children: [
      {
        name: 'capture_method',
        type: 'enum',
        nullable: true,
        description:
          "Indicates when funds will be captured from the customer's account.",
        enumValues: [
          { value: 'automatic' },
          { value: 'automatic_async' },
          { value: 'manual' },
        ],
      },
      {
        name: 'description',
        type: 'string',
        nullable: true,
        description: 'An arbitrary string attached to the object.',
      },
      {
        name: 'metadata',
        type: 'object',
        description:
          'Set of key-value pairs that will set metadata on Payment Intents generated from this payment link.',
      },
      {
        name: 'setup_future_usage',
        type: 'enum',
        nullable: true,
        description:
          'Indicates that you intend to make future payments with the payment method collected during checkout.',
        enumValues: [{ value: 'off_session' }, { value: 'on_session' }],
      },
      {
        name: 'statement_descriptor',
        type: 'string',
        nullable: true,
        description:
          'Text retained for API compatibility as a statement descriptor.',
      },
      {
        name: 'statement_descriptor_suffix',
        type: 'string',
        nullable: true,
        description:
          'Suffix retained for API compatibility with statement descriptors.',
      },
      {
        name: 'transfer_group',
        type: 'string',
        nullable: true,
        description:
          'A string that identifies the resulting payment as part of a group.',
      },
    ],
  },
  {
    name: 'payment_method_collection',
    type: 'enum',
    description:
      'Configuration for collecting a payment method during checkout. Defaults to <code>always</code>.',
    enumValues: [
      {
        value: 'always',
        description: 'The Checkout Session always collects a PaymentMethod.',
      },
      {
        value: 'if_required',
        description:
          'The Checkout Session only collects a PaymentMethod if there is an amount due.',
      },
    ],
  },
  {
    name: 'payment_method_options',
    type: 'object',
    nullable: true,
    description: 'Payment-method-specific configuration.',
    expandable: true,
    children: [
      {
        name: 'card',
        type: 'object',
        nullable: true,
        description:
          'Configuration for <code>card</code> payment methods, retained for API parity.',
        expandable: true,
        children: [
          {
            name: 'restrictions',
            type: 'object',
            nullable: true,
            description: 'Restrictions to apply to the card payment method.',
            expandable: true,
            children: [
              {
                name: 'brands_blocked',
                type: 'array of enums',
                description: 'The card brands to block.',
                enumValues: [
                  { value: 'american_express' },
                  { value: 'discover_global_network' },
                  { value: 'mastercard' },
                  { value: 'visa' },
                ],
              },
            ],
          },
        ],
      },
    ],
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless settles USDC wallet payments. Card option bags are retained for API parity and have no effect on crypto checkout.',
  },
  {
    name: 'phone_number_collection',
    type: 'object',
    description: 'Controls phone number collection settings during checkout.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'If <code>true</code>, a phone number is collected during checkout.',
      },
    ],
  },
  {
    name: 'restrictions',
    type: 'object',
    nullable: true,
    description: 'Settings that restrict the usage of a payment link.',
    expandable: true,
    children: [
      {
        name: 'completed_sessions',
        type: 'object',
        description:
          'Configuration for the <code>completed_sessions</code> restriction type.',
        expandable: true,
        children: [
          {
            name: 'count',
            type: 'integer',
            description:
              'The current number of checkout sessions that have been completed on the payment link toward the restriction limit.',
          },
          {
            name: 'limit',
            type: 'integer',
            description:
              'The maximum number of checkout sessions that can be completed for this restriction.',
          },
        ],
      },
    ],
  },
  {
    name: 'shipping_address_collection',
    type: 'object',
    nullable: true,
    description:
      "Configuration for collecting the customer's shipping address.",
    expandable: true,
    children: [
      {
        name: 'allowed_countries',
        type: 'array of strings',
        description:
          'Two-letter ISO country codes representing which countries Checkout should offer as shipping locations.',
      },
    ],
  },
  {
    name: 'shipping_options',
    type: 'array of objects',
    description:
      'The shipping rate options applied to sessions created by this payment link.',
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
        description:
          'The ID of the Shipping Rate to use for this shipping option.',
      },
    ],
  },
  {
    name: 'submit_type',
    type: 'enum',
    description:
      'Indicates the type of transaction being performed, which customizes relevant text on the page such as the submit button.',
    enumValues: [
      {
        value: 'auto',
        description:
          'Default value. <code>pay</code> is used in all scenarios.',
      },
      { value: 'book', description: 'Recommended when offering bookings.' },
      { value: 'donate', description: 'Recommended when accepting donations.' },
      { value: 'pay', description: 'Submit button uses a buy-style label.' },
      {
        value: 'subscribe',
        description: 'Submit button uses a subscribe-style label.',
      },
    ],
  },
  {
    name: 'subscription_data',
    type: 'object',
    nullable: true,
    description:
      'When creating a subscription, the specified configuration data is used. There must be at least one line item with a recurring price to use <code>subscription_data</code>.',
    expandable: true,
    children: [
      {
        name: 'description',
        type: 'string',
        nullable: true,
        description:
          "The subscription's description, meant to be displayable to the customer.",
      },
      {
        name: 'invoice_settings',
        type: 'object',
        description: 'All invoices are billed using the specified settings.',
        expandable: true,
        children: [
          {
            name: 'issuer',
            type: 'object',
            description: 'The connected account that issues the invoice.',
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
        name: 'metadata',
        type: 'object',
        description:
          'Set of key-value pairs that will set metadata on Subscriptions generated from this payment link.',
      },
      {
        name: 'trial_period_days',
        type: 'integer',
        nullable: true,
        description:
          'Integer representing the number of trial period days before the customer is charged for the first time.',
      },
      {
        name: 'trial_settings',
        type: 'object',
        nullable: true,
        description: 'Settings related to subscription trials.',
        expandable: true,
        children: [
          {
            name: 'end_behavior',
            type: 'object',
            description:
              'Defines how the subscription should behave when the free trial ends.',
            expandable: true,
            children: [
              {
                name: 'missing_payment_method',
                type: 'enum',
                description:
                  'Indicates how the subscription should change when the trial ends if the user did not provide a payment method.',
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
  {
    name: 'tax_id_collection',
    type: 'object',
    description:
      'Details on the state of tax ID collection for the payment link.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Indicates whether tax ID collection is enabled for the session.',
      },
    ],
  },
  {
    name: 'transfer_data',
    type: 'object',
    nullable: true,
    description:
      'The account (if any) the payments are attributed to for tax reporting, and where funds from each payment are transferred.',
    expandable: true,
    children: [
      {
        name: 'amount',
        type: 'integer',
        nullable: true,
        description:
          'The amount in the smallest currency unit that will be transferred to the destination account. By default, the entire amount is transferred.',
      },
      {
        name: 'destination',
        type: 'string',
        tooltip: EXPAND_TOOLTIP,
        description: 'The connected account receiving the transfer.',
      },
    ],
  },
];

// ============================================
// Overview
// ============================================

export const PAYMENT_LINKS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Payment Link object',
  description:
    'A payment link is a shareable URL that takes your customers to a hosted payment page. A payment link can be shared and used multiple times. When a customer opens a payment link, Zoneless creates a new <a href="#checkout-sessions-object">Checkout Session</a> to render the payment page. Use <a href="#checkout-sessions-object-events">Checkout Session events</a> such as <code>checkout.session.completed</code> to track payments made through payment links.',
  stripeDocsUrl: 'https://docs.stripe.com/api/payment-link',
  endpoints: BuildEndpointSummaries(PAYMENT_LINKS_SUBSECTION, [
    { method: 'POST', path: '/v1/payment_links', pageId: 'create' },
    { method: 'POST', path: '/v1/payment_links/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/payment_links/:id', pageId: 'retrieve' },
    {
      method: 'GET',
      path: '/v1/payment_links/:id/line_items',
      pageId: 'list-line-items',
    },
    { method: 'GET', path: '/v1/payment_links', pageId: 'list' },
  ]),
  events: GetResourceEventAttributes('payment_link'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: 'Share a Payment Link URL with customers so they can pay in USDC through a hosted Checkout page. Each visit creates a new Checkout Session — listen for session events to fulfill orders.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: PAYMENT_LINK_ATTRIBUTES,
          moreAttributes: PAYMENT_LINK_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE PAYMENT LINK OBJECT',
          code: PAYMENT_LINK_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create
// ============================================

const CREATE_PAYMENT_LINK_PARAMETERS: Attribute[] = [
  {
    name: 'line_items',
    type: 'array of objects',
    required: true,
    description:
      'The line items representing what is being sold. Up to 20 line items are supported.',
    expandable: true,
    children: CREATE_LINE_ITEM_PARAM_CHILDREN,
  },
  {
    name: 'after_completion',
    type: 'object',
    description: 'Behavior after the purchase is complete.',
    expandable: true,
    children: AFTER_COMPLETION_PARAM_CHILDREN,
  },
  {
    name: 'allow_promotion_codes',
    type: 'boolean',
    description: 'Enables user redeemable promotion codes.',
  },
  {
    name: 'currency',
    type: 'string',
    description:
      "Three-letter currency code, in lowercase. Must be supported by each line item's price. Defaults to <code>usdc</code>.",
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless currently accepts only <code>usdc</code>.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. Metadata associated with this Payment Link is automatically copied to Checkout Sessions created by this payment link.',
  },
  {
    name: 'payment_method_types',
    type: 'array of strings',
    description:
      'The list of payment method types that customers can use. Defaults to your payment method settings when omitted.',
    enumValues: [
      { value: 'crypto', description: 'USDC wallet payments on Solana.' },
    ],
  },
];

const CREATE_PAYMENT_LINK_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'application_fee_amount',
    type: 'integer',
    description:
      "The amount of the application fee (if any) that will be requested to be applied to the payment and transferred to the application owner's account. Can only be applied when there are no line items with recurring prices.",
  },
  {
    name: 'application_fee_percent',
    type: 'float',
    description:
      "A non-negative decimal between 0 and 100, with at most two decimal places. This represents the percentage of the subscription invoice total that will be transferred to the application owner's account. There must be at least 1 line item with a recurring price to use this field.",
  },
  {
    name: 'automatic_tax',
    type: 'object',
    description: 'Configuration for automatic tax collection.',
    expandable: true,
    children: AUTOMATIC_TAX_PARAM_CHILDREN,
  },
  {
    name: 'billing_address_collection',
    type: 'enum',
    description:
      "Configuration for collecting the customer's billing address. Defaults to <code>auto</code>.",
    enumValues: [{ value: 'auto' }, { value: 'required' }],
  },
  {
    name: 'consent_collection',
    type: 'object',
    description: 'Configure fields to gather active consent from customers.',
    expandable: true,
    children: [
      {
        name: 'payment_method_reuse_agreement',
        type: 'object',
        description:
          'Determines the display of payment method reuse agreement text in the UI.',
        expandable: true,
        children: [
          {
            name: 'position',
            type: 'enum',
            required: true,
            description:
              'Determines the position and visibility of the payment method reuse agreement in the UI.',
            enumValues: [{ value: 'auto' }, { value: 'hidden' }],
          },
        ],
      },
      {
        name: 'promotions',
        type: 'enum',
        description:
          'If set to <code>auto</code>, enables collection of customer consent for promotional communications.',
        enumValues: [{ value: 'auto' }, { value: 'none' }],
      },
      {
        name: 'terms_of_service',
        type: 'enum',
        description:
          'If set to <code>required</code>, customers must accept the terms of service before paying.',
        enumValues: [{ value: 'none' }, { value: 'required' }],
      },
    ],
  },
  {
    name: 'custom_fields',
    type: 'array of objects',
    description:
      'Collect additional information from your customer using custom fields. Up to 3 fields are supported.',
    expandable: true,
    children: CUSTOM_FIELD_PARAM_CHILDREN,
  },
  {
    name: 'custom_text',
    type: 'object',
    description:
      'Display additional text for your customers using custom text.',
    expandable: true,
    children: CUSTOM_TEXT_PARAM_CHILDREN,
  },
  {
    name: 'customer_creation',
    type: 'enum',
    description:
      'Configures whether Checkout Sessions created by this payment link create a Customer.',
    enumValues: [{ value: 'always' }, { value: 'if_required' }],
  },
  {
    name: 'inactive_message',
    type: 'string',
    description:
      'The custom message displayed to a customer when a payment link is no longer active. Up to 500 characters.',
  },
  {
    name: 'invoice_creation',
    type: 'object',
    description: 'Generate a post-purchase Invoice for one-time payments.',
    expandable: true,
    children: INVOICE_CREATION_PARAM_CHILDREN,
  },
  {
    name: 'managed_payments',
    type: 'object',
    description:
      'Settings for Managed Payments for this Payment Link and resulting Checkout Sessions, Payment Intents, Invoices, and Subscriptions.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        description:
          'Set to <code>true</code> to enable Managed Payments for this payment link.',
      },
    ],
  },
  {
    name: 'name_collection',
    type: 'object',
    description:
      "Controls settings applied for collecting the customer's name.",
    expandable: true,
    children: NAME_COLLECTION_PARAM_CHILDREN,
  },
  {
    name: 'on_behalf_of',
    type: 'string',
    description: 'The account on behalf of which to charge.',
  },
  {
    name: 'optional_items',
    type: 'array of objects',
    description:
      'A list of optional items the customer can add to their order at checkout. Maximum of 10 optional items, and a maximum of 20 combined line items and optional items.',
    expandable: true,
    children: OPTIONAL_ITEM_PARAM_CHILDREN,
  },
  {
    name: 'payment_intent_data',
    type: 'object',
    description:
      'A subset of parameters passed to PaymentIntent creation for Checkout Sessions in <code>payment</code> mode.',
    expandable: true,
    children: CREATE_PAYMENT_INTENT_DATA_PARAM_CHILDREN,
  },
  {
    name: 'payment_method_collection',
    type: 'enum',
    description:
      'Specify whether Checkout should collect a payment method. When set to <code>if_required</code>, Checkout does not collect a payment method when the total due is 0. Can only be set in subscription mode. Defaults to <code>always</code>.',
    enumValues: [{ value: 'always' }, { value: 'if_required' }],
  },
  {
    name: 'payment_method_options',
    type: 'object',
    description: 'Payment-method-specific configuration.',
    expandable: true,
    children: PAYMENT_METHOD_OPTIONS_PARAM_CHILDREN,
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless exposes <code>crypto</code> for USDC wallet payments. The <code>card</code> bag is retained for API parity.',
  },
  {
    name: 'phone_number_collection',
    type: 'object',
    description: 'Controls phone number collection settings during checkout.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        required: true,
        description:
          'Set to <code>true</code> to enable phone number collection.',
      },
    ],
  },
  {
    name: 'restrictions',
    type: 'object',
    description: 'Settings that restrict the usage of a payment link.',
    expandable: true,
    children: [
      {
        name: 'completed_sessions',
        type: 'object',
        required: true,
        description:
          'Configuration for the <code>completed_sessions</code> restriction type.',
        expandable: true,
        children: [
          {
            name: 'limit',
            type: 'integer',
            required: true,
            description:
              'The maximum number of checkout sessions that can be completed for this restriction.',
          },
        ],
      },
    ],
  },
  {
    name: 'shipping_address_collection',
    type: 'object',
    description:
      "Configuration for collecting the customer's shipping address.",
    expandable: true,
    children: [
      {
        name: 'allowed_countries',
        type: 'array of strings',
        required: true,
        description:
          'Two-letter ISO country codes representing which countries Checkout should offer as shipping locations.',
      },
    ],
  },
  {
    name: 'shipping_options',
    type: 'array of objects',
    description:
      'The shipping rate options to apply to Checkout Sessions created by this payment link.',
    expandable: true,
    children: [
      {
        name: 'shipping_rate',
        type: 'string',
        description:
          'The ID of the Shipping Rate to use for this shipping option.',
      },
    ],
  },
  {
    name: 'submit_type',
    type: 'enum',
    description:
      'Describes the type of transaction being performed in order to customize relevant text on the page, such as the submit button.',
    enumValues: [
      { value: 'auto' },
      { value: 'book' },
      { value: 'donate' },
      { value: 'pay' },
      { value: 'subscribe' },
    ],
  },
  {
    name: 'subscription_data',
    type: 'object',
    description:
      'When creating a subscription, the specified configuration data is used. There must be at least one line item with a recurring price to use <code>subscription_data</code>.',
    expandable: true,
    children: CREATE_SUBSCRIPTION_DATA_PARAM_CHILDREN,
  },
  {
    name: 'tax_id_collection',
    type: 'object',
    description: 'Controls tax ID collection during checkout.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        required: true,
        description:
          'Enable tax ID collection during checkout. Defaults to <code>false</code>.',
      },
      {
        name: 'required',
        type: 'enum',
        description:
          'Describes whether a tax ID is required during checkout. Defaults to <code>never</code>.',
        enumValues: [{ value: 'if_supported' }, { value: 'never' }],
      },
    ],
  },
  {
    name: 'transfer_data',
    type: 'object',
    description:
      'The account (if any) the payments are attributed to for tax reporting, and where funds from each payment are transferred.',
    expandable: true,
    children: [
      {
        name: 'destination',
        type: 'string',
        required: true,
        description:
          'If specified, successful charges are attributed to the destination account for tax reporting, and funds are transferred to that account.',
      },
      {
        name: 'amount',
        type: 'integer',
        description:
          'The amount that will be transferred automatically when a charge succeeds.',
      },
    ],
  },
];

export const PAYMENT_LINKS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a payment link',
  description: 'Creates a payment link.',
  stripeDocsUrl: 'https://docs.stripe.com/api/payment-link/create',
  endpoints: [{ method: 'POST', path: '/v1/payment_links' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Recommended flow: ',
          text: 'Create a <a href="#prices-object">Price</a> for each item you sell, then reference its ID from <code>line_items</code>. Share the returned <code>url</code> with customers to begin checkout.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_PAYMENT_LINK_PARAMETERS,
          moreAttributes: CREATE_PAYMENT_LINK_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the payment link.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/payment_links' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/payment_links \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "line_items[0][price]"=price_z_4HsWnJc8mKpQ2vRx \\
  -d "line_items[0][quantity]"=1`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const paymentLink = await zoneless.paymentLinks.create({
  line_items: [
    {
      price: 'price_z_4HsWnJc8mKpQ2vRx',
      quantity: 1,
    },
  ],
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: PAYMENT_LINK_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Update
// ============================================

const UPDATE_PAYMENT_LINK_PARAMETERS: Attribute[] = [
  {
    name: 'active',
    type: 'boolean',
    description:
      "Whether the payment link's <code>url</code> is active. If <code>false</code>, customers visiting the URL see a page saying that the link has been deactivated.",
  },
  {
    name: 'after_completion',
    type: 'object',
    description: 'Behavior after the purchase is complete.',
    expandable: true,
    children: AFTER_COMPLETION_PARAM_CHILDREN,
  },
  {
    name: 'allow_promotion_codes',
    type: 'boolean',
    description: 'Enables user redeemable promotion codes.',
  },
  {
    name: 'line_items',
    type: 'array of objects',
    description:
      'The line items representing what is being sold. To update an existing line item, specify its <code>id</code> along with the fields to change. New line items cannot be added via update. Up to 20 line items are supported.',
    expandable: true,
    children: UPDATE_LINE_ITEM_PARAM_CHILDREN,
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. Metadata associated with this Payment Link is automatically copied to Checkout Sessions created by this payment link.',
  },
];

const UPDATE_PAYMENT_LINK_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'automatic_tax',
    type: 'object',
    description: 'Configuration for automatic tax collection.',
    expandable: true,
    children: AUTOMATIC_TAX_PARAM_CHILDREN,
  },
  {
    name: 'billing_address_collection',
    type: 'enum',
    description:
      "Configuration for collecting the customer's billing address. Defaults to <code>auto</code>.",
    enumValues: [{ value: 'auto' }, { value: 'required' }],
  },
  {
    name: 'custom_fields',
    type: 'array of objects',
    description:
      'Collect additional information from your customer using custom fields. Up to 3 fields are supported.',
    expandable: true,
    children: CUSTOM_FIELD_PARAM_CHILDREN,
  },
  {
    name: 'custom_text',
    type: 'object',
    description:
      'Display additional text for your customers using custom text.',
    expandable: true,
    children: CUSTOM_TEXT_PARAM_CHILDREN,
  },
  {
    name: 'customer_creation',
    type: 'enum',
    description:
      'Configures whether Checkout Sessions created by this payment link create a Customer.',
    enumValues: [{ value: 'always' }, { value: 'if_required' }],
  },
  {
    name: 'inactive_message',
    type: 'string',
    description:
      'The custom message displayed to a customer when a payment link is no longer active. Up to 500 characters.',
  },
  {
    name: 'invoice_creation',
    type: 'object',
    description: 'Generate a post-purchase Invoice for one-time payments.',
    expandable: true,
    children: INVOICE_CREATION_PARAM_CHILDREN,
  },
  {
    name: 'name_collection',
    type: 'object',
    description:
      "Controls settings applied for collecting the customer's name.",
    expandable: true,
    children: NAME_COLLECTION_PARAM_CHILDREN,
  },
  {
    name: 'optional_items',
    type: 'array of objects',
    description:
      'A list of optional items the customer can add to their order at checkout. Maximum of 10 optional items, and a maximum of 20 combined line items and optional items.',
    expandable: true,
    children: OPTIONAL_ITEM_PARAM_CHILDREN,
  },
  {
    name: 'payment_intent_data',
    type: 'object',
    description:
      'A subset of parameters passed to PaymentIntent creation for Checkout Sessions in <code>payment</code> mode.',
    expandable: true,
    children: UPDATE_PAYMENT_INTENT_DATA_PARAM_CHILDREN,
  },
  {
    name: 'payment_method_collection',
    type: 'enum',
    description:
      'Specify whether Checkout should collect a payment method. When set to <code>if_required</code>, Checkout does not collect a payment method when the total due is 0. Can only be set in subscription mode. Defaults to <code>always</code>.',
    enumValues: [{ value: 'always' }, { value: 'if_required' }],
  },
  {
    name: 'payment_method_options',
    type: 'object',
    description: 'Payment-method-specific configuration.',
    expandable: true,
    children: PAYMENT_METHOD_OPTIONS_PARAM_CHILDREN,
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless exposes <code>crypto</code> for USDC wallet payments. The <code>card</code> bag is retained for API parity.',
  },
  {
    name: 'payment_method_types',
    type: 'array of strings',
    description:
      'The list of payment method types that customers can use. Pass an empty array to enable dynamic payment methods from your payment method settings.',
    enumValues: [
      { value: 'crypto', description: 'USDC wallet payments on Solana.' },
    ],
  },
  {
    name: 'phone_number_collection',
    type: 'object',
    description: 'Controls phone number collection settings during checkout.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        required: true,
        description:
          'Set to <code>true</code> to enable phone number collection.',
      },
    ],
  },
  {
    name: 'restrictions',
    type: 'object',
    description: 'Settings that restrict the usage of a payment link.',
    expandable: true,
    children: [
      {
        name: 'completed_sessions',
        type: 'object',
        required: true,
        description:
          'Configuration for the <code>completed_sessions</code> restriction type.',
        expandable: true,
        children: [
          {
            name: 'limit',
            type: 'integer',
            required: true,
            description:
              'The maximum number of checkout sessions that can be completed for this restriction.',
          },
        ],
      },
    ],
  },
  {
    name: 'shipping_address_collection',
    type: 'object',
    description:
      "Configuration for collecting the customer's shipping address.",
    expandable: true,
    children: [
      {
        name: 'allowed_countries',
        type: 'array of strings',
        required: true,
        description:
          'Two-letter ISO country codes representing which countries Checkout should offer as shipping locations.',
      },
    ],
  },
  {
    name: 'submit_type',
    type: 'enum',
    description:
      'Describes the type of transaction being performed in order to customize relevant text on the page, such as the submit button.',
    enumValues: [
      { value: 'auto' },
      { value: 'book' },
      { value: 'donate' },
      { value: 'pay' },
      { value: 'subscribe' },
    ],
  },
  {
    name: 'subscription_data',
    type: 'object',
    description:
      'When creating a subscription, the specified configuration data is used. There must be at least one line item with a recurring price to use <code>subscription_data</code>.',
    expandable: true,
    children: UPDATE_SUBSCRIPTION_DATA_PARAM_CHILDREN,
  },
  {
    name: 'tax_id_collection',
    type: 'object',
    description: 'Controls tax ID collection during checkout.',
    expandable: true,
    children: [
      {
        name: 'enabled',
        type: 'boolean',
        required: true,
        description:
          'Enable tax ID collection during checkout. Defaults to <code>false</code>.',
      },
      {
        name: 'required',
        type: 'enum',
        description:
          'Describes whether a tax ID is required during checkout. Defaults to <code>never</code>.',
        enumValues: [{ value: 'if_supported' }, { value: 'never' }],
      },
    ],
  },
];

export const PAYMENT_LINKS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a payment link',
  description: 'Updates a payment link.',
  stripeDocsUrl: 'https://docs.stripe.com/api/payment-link/update',
  endpoints: [{ method: 'POST', path: '/v1/payment_links/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_PAYMENT_LINK_PARAMETERS,
          moreAttributes: UPDATE_PAYMENT_LINK_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the updated payment link.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/payment_links/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/payment_links/plink_z_7nQ2wKpR9xVmHc4bYtLsJ8fA \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[order_id]"=8492`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const paymentLink = await zoneless.paymentLinks.update(
  'plink_z_7nQ2wKpR9xVmHc4bYtLsJ8fA',
  {
    metadata: {
      order_id: '8492',
    },
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: PAYMENT_LINK_UPDATE_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Retrieve
// ============================================

export const PAYMENT_LINKS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a payment link',
  description: 'Retrieve a payment link.',
  stripeDocsUrl: 'https://docs.stripe.com/api/payment-link/retrieve',
  endpoints: [{ method: 'GET', path: '/v1/payment_links/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'paragraph',
          text: 'No parameters.',
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the payment link.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/payment_links/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/payment_links/plink_z_7nQ2wKpR9xVmHc4bYtLsJ8fA \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const paymentLink = await zoneless.paymentLinks.retrieve(
  'plink_z_7nQ2wKpR9xVmHc4bYtLsJ8fA'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: PAYMENT_LINK_OBJECT_JSON },
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

export const PAYMENT_LINKS_LIST_LINE_ITEMS_PAGE: DocPage = {
  id: 'list-line-items',
  title: "Retrieve a payment link's line items",
  description:
    'When retrieving a payment link, there is an includable <code>line_items</code> property containing the first handful of those items. There is also a URL where you can retrieve the full (paginated) list of line items.',
  stripeDocsUrl: 'https://docs.stripe.com/api/payment-link/retrieve-line-items',
  endpoints: [{ method: 'GET', path: '/v1/payment_links/:id/line_items' }],
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
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> payment link line items, starting after line item <code>starting_after</code>. Each entry in the array is a separate line item object. If no more line items are available, the resulting array is empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/payment_links/:id/line_items' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/payment_links/plink_z_7nQ2wKpR9xVmHc4bYtLsJ8fA/line_items \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const lineItems = await zoneless.paymentLinks.listLineItems(
  'plink_z_7nQ2wKpR9xVmHc4bYtLsJ8fA'
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
// List
// ============================================

const LIST_PAYMENT_LINKS_PARAMETERS: Attribute[] = [
  {
    name: 'active',
    type: 'boolean',
    description:
      'Only return payment links that are active or inactive (for example, pass <code>false</code> to list all inactive payment links).',
  },
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

export const PAYMENT_LINKS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all payment links',
  description: 'Returns a list of your payment links.',
  stripeDocsUrl: 'https://docs.stripe.com/api/payment-link/list',
  endpoints: [{ method: 'GET', path: '/v1/payment_links' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_PAYMENT_LINKS_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> payment links, starting after payment link <code>starting_after</code>. Each entry in the array is a separate payment link object. If no more payment links are available, the resulting array is empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/payment_links' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/payment_links \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const paymentLinks = await zoneless.paymentLinks.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_PAYMENT_LINKS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const PAYMENT_LINKS_PAGES: DocPage[] = [
  PAYMENT_LINKS_OVERVIEW_PAGE,
  PAYMENT_LINKS_CREATE_PAGE,
  PAYMENT_LINKS_UPDATE_PAGE,
  PAYMENT_LINKS_RETRIEVE_PAGE,
  PAYMENT_LINKS_LIST_LINE_ITEMS_PAGE,
  PAYMENT_LINKS_LIST_PAGE,
];
