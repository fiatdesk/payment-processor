import { DocSubSection, DocPage, Attribute } from './types';
import { GetResourceEventAttributes } from './event-types';
import { NODE_INIT, EXPAND_TOOLTIP, BuildEndpointSummaries } from './shared';
import {
  SUBSCRIPTION_OBJECT_ATTRIBUTES,
  SUBSCRIPTION_MORE_ATTRIBUTES,
} from './subscriptions';

export const CUSTOMERS_SUBSECTION: DocSubSection = {
  id: 'customers',
  title: 'Customers',
  children: [
    { id: 'object', title: 'The Customer object' },
    { id: 'create', title: 'Create a customer' },
    { id: 'update', title: 'Update a customer' },
    { id: 'retrieve', title: 'Retrieve a customer' },
    { id: 'list', title: 'List all customers' },
    { id: 'delete', title: 'Delete a customer' },
  ],
};

// ============================================
// Shared Data
// ============================================
const CUSTOMER_OBJECT_JSON = `{
  "id": "cus_z_NffrFeUfNV2Hib",
  "object": "customer",
  "address": null,
  "balance": 0,
  "created": 1778894772,
  "currency": null,
  "default_source": null,
  "delinquent": false,
  "description": null,
  "email": "tomjones@example.com",
  "invoice_prefix": "024A99CD",
  "invoice_settings": {
    "custom_fields": null,
    "default_payment_method": null,
    "footer": null,
    "rendering_options": null
  },
  "livemode": false,
  "metadata": {},
  "name": "Tom Jones",
  "next_invoice_sequence": 1,
  "phone": null,
  "preferred_locales": [],
  "shipping": null,
  "tax_exempt": "none",
  "test_clock": null,
  "platform_account": "acct_z_Platform123abc"
}`;

const CUSTOMER_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless customer IDs are prefixed with <code>cus_z_</code>.',
  },
  {
    name: 'address',
    type: 'object',
    nullable: true,
    description: "The customer's address.",
    expandable: true,
    children: [
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
        description:
          'Address line 1, such as the street, PO Box, or company name.',
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
    ],
  },
  {
    name: 'balance',
    type: 'number',
    description:
      "The current balance, if any, that's stored on the customer in their default currency. If negative, the customer has credit to apply to their next invoice. If positive, the customer has an amount owed that's added to their next invoice. The balance only considers amounts that Zoneless hasn't successfully applied to any invoice. It doesn't reflect unpaid invoices. This balance is only taken into account after invoices finalize. For multi-currency balances, see <code>invoice_credit_balance</code>.",
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
      'Three-letter ISO code for the currency the customer can be charged in for recurring billing purposes.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless only settles in <code>usdc</code>, so this field is either <code>null</code> or <code>usdc</code>.',
  },
  {
    name: 'default_source',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the default payment source for the customer. If you use payment methods created through the PaymentMethods API, see the <code>invoice_settings.default_payment_method</code> field instead.',
    enumNote:
      "<strong>Difference from Stripe:</strong> Stripe's default source is a bank account or card ID. Zoneless's default source is a linked Solana wallet ID (<code>src_z_</code> prefix).",
  },
  {
    name: 'delinquent',
    type: 'boolean',
    nullable: true,
    description:
      "Tracks the most recent state change on any invoice belonging to the customer. Paying an invoice or marking it uncollectible via the API sets this field to <code>false</code>. An automatic payment failure or passing the invoice's <code>due_date</code> sets this field to <code>true</code>.",
  },
  {
    name: 'description',
    type: 'string',
    nullable: true,
    description:
      'An arbitrary string attached to the object. Often useful for displaying to users.',
  },
  {
    name: 'discount',
    type: 'object',
    nullable: true,
    description:
      'Describes the current discount active on the customer, if there is one.',
    expandable: true,
    children: [
      {
        name: 'id',
        type: 'string',
        description:
          "The ID of the discount object. Discounts can't be fetched by ID. Use <code>expand[]=discounts</code> in API calls to expand discount IDs in an array.",
      },
      {
        name: 'object',
        type: 'string',
        description:
          "String representing the object's type. Objects of the same type share the same value.",
      },
      {
        name: 'checkout_session',
        type: 'string',
        nullable: true,
        description:
          'The Checkout session that this coupon is applied to, if it is applied to a particular session in payment mode. Not present for subscription mode.',
      },
      {
        name: 'customer',
        type: 'string',
        nullable: true,
        tooltip: EXPAND_TOOLTIP,
        description: 'The ID of the customer associated with this discount.',
      },
      {
        name: 'customer_account',
        type: 'string',
        nullable: true,
        description:
          'The ID of the account representing the customer associated with this discount.',
      },
      {
        name: 'end',
        type: 'timestamp',
        nullable: true,
        description:
          'If the coupon has a duration of <code>repeating</code>, the date that this discount will end. If the coupon has a duration of <code>once</code> or <code>forever</code>, this attribute is <code>null</code>.',
      },
      {
        name: 'invoice',
        type: 'string',
        nullable: true,
        description:
          "The invoice that the discount's coupon was applied to, if it was applied directly to a particular invoice.",
      },
      {
        name: 'invoice_item',
        type: 'string',
        nullable: true,
        description:
          "The invoice item ID that the discount's coupon was applied to, if it was applied directly to a particular invoice item or invoice line item.",
      },
      {
        name: 'promotion_code',
        type: 'string',
        nullable: true,
        tooltip: EXPAND_TOOLTIP,
        description: 'The promotion code applied to create this discount.',
      },
      {
        name: 'source',
        type: 'object',
        description: 'The source of the discount.',
        expandable: true,
        children: [
          {
            name: 'coupon',
            type: 'string',
            nullable: true,
            tooltip: EXPAND_TOOLTIP,
            description:
              'The coupon that was redeemed to create this discount.',
          },
          {
            name: 'type',
            type: 'enum',
            description: 'The source type of the discount.',
            enumValues: [
              { value: 'coupon', description: 'Coupon source type.' },
            ],
          },
        ],
      },
      {
        name: 'start',
        type: 'timestamp',
        description: 'Date that the coupon was applied.',
      },
      {
        name: 'subscription',
        type: 'string',
        nullable: true,
        description:
          'The subscription that this coupon is applied to, if it is applied to a particular subscription.',
      },
      {
        name: 'subscription_item',
        type: 'string',
        nullable: true,
        description:
          'The subscription item that this coupon is applied to, if it is applied to a particular subscription item.',
      },
    ],
  },
  {
    name: 'email',
    type: 'string',
    nullable: true,
    description: "The customer's email address.",
  },
  {
    name: 'invoice_prefix',
    type: 'string',
    nullable: true,
    description:
      'The prefix for the customer used to generate unique invoice numbers.',
  },
  {
    name: 'invoice_settings',
    type: 'object',
    description: "The customer's default invoice settings.",
    expandable: true,
    children: [
      {
        name: 'custom_fields',
        type: 'array of objects',
        nullable: true,
        description:
          'Default custom fields to be displayed on invoices for this customer.',
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
        name: 'default_payment_method',
        type: 'string',
        nullable: true,
        tooltip: EXPAND_TOOLTIP,
        description:
          "ID of a payment method that's attached to the customer, to be used as the customer's default payment method for subscriptions and invoices.",
      },
      {
        name: 'footer',
        type: 'string',
        nullable: true,
        description:
          'Default footer to be displayed on invoices for this customer.',
      },
      {
        name: 'rendering_options',
        type: 'object',
        nullable: true,
        description:
          'Default options for invoice PDF rendering for this customer.',
        children: [
          {
            name: 'amount_tax_display',
            type: 'string',
            nullable: true,
            description:
              'How line-item prices and amounts are displayed with respect to tax on invoice PDFs.',
          },
          {
            name: 'template',
            type: 'string',
            nullable: true,
            description:
              "ID of the invoice rendering template to be used for this customer's invoices. If set, the template is used on all invoices for this customer unless a template is set directly on the invoice.",
          },
        ],
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
    name: 'name',
    type: 'string',
    nullable: true,
    description: "The customer's full name or business name.",
  },
  {
    name: 'next_invoice_sequence',
    type: 'number',
    nullable: true,
    description:
      "The suffix of the customer's next invoice number (for example, 0001). When the account uses account level sequencing, this parameter is ignored in API requests and the field is omitted in API responses.",
  },
  {
    name: 'phone',
    type: 'string',
    nullable: true,
    description: "The customer's phone number.",
  },
  {
    name: 'preferred_locales',
    type: 'array of strings',
    nullable: true,
    description:
      "The customer's preferred locales (languages), ordered by preference.",
  },
  {
    name: 'shipping',
    type: 'object',
    nullable: true,
    description:
      'Mailing and shipping address for the customer. Appears on invoices emailed to this customer.',
    expandable: true,
    children: [
      {
        name: 'address',
        type: 'object',
        description: 'Customer shipping address.',
        children: [
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
            description:
              'Address line 1, such as the street, PO Box, or company name.',
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
        ],
      },
      {
        name: 'name',
        type: 'string',
        nullable: true,
        description: 'Customer name.',
      },
      {
        name: 'phone',
        type: 'string',
        nullable: true,
        description: 'Customer phone (including extension).',
      },
    ],
  },
  {
    name: 'sources',
    type: 'object',
    nullable: true,
    description: "The customer's payment sources, if any.",
    expandable: true,
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless customers pay from linked Solana wallets rather than bank accounts, so each item in <code>sources.data</code> represents a wallet rather than a bank account. See <a href="/external-wallets">External Wallets</a> for the equivalent object sellers use to receive USDC payouts.',
    children: [
      {
        name: 'object',
        type: 'string',
        description:
          "String representing the object's type. Objects of the same type share the same value. Always has the value <code>list</code>.",
      },
      {
        name: 'data',
        type: 'array of objects',
        description: 'Details about each object.',
        children: [
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
            name: 'account',
            type: 'string',
            nullable: true,
            tooltip: EXPAND_TOOLTIP,
            description:
              'The account this wallet belongs to. Only applicable on Accounts (not customers).',
          },
          {
            name: 'account_holder_name',
            type: 'string',
            nullable: true,
            description:
              'The name of the person or business that owns the wallet.',
          },
          {
            name: 'account_holder_type',
            type: 'enum',
            nullable: true,
            description: 'The type of entity that holds the wallet.',
            enumValues: [
              {
                value: 'individual',
                description: 'A person who owns the wallet.',
              },
              {
                value: 'company',
                description: 'A business entity that owns the wallet.',
              },
            ],
          },
          {
            name: 'account_type',
            type: 'string',
            nullable: true,
            description: 'The Solana account type.',
            enumNote:
              "<strong>Zoneless extension:</strong> Equivalent to Stripe's bank account <code>account_type</code>.",
          },
          {
            name: 'available_payout_methods',
            type: 'array of enums',
            nullable: true,
            description:
              'A set of available payout methods for this wallet. Only values from this set should be passed as the <code>method</code> when creating a payout.',
            enumValues: [
              {
                value: 'instant',
                description: 'Immediate transfer to the wallet.',
              },
              { value: 'standard', description: 'Standard transfer timing.' },
            ],
          },
          {
            name: 'bank_name',
            type: 'string',
            nullable: true,
            description:
              'Name of the wallet provider associated with the address (e.g., <code>PHANTOM</code>).',
            enumNote:
              "<strong>Zoneless extension:</strong> Equivalent to Stripe's <code>bank_name</code>.",
          },
          {
            name: 'country',
            type: 'string',
            description:
              "Two-letter ISO code representing the country the wallet's owner is located in.",
          },
          {
            name: 'currency',
            type: 'enum',
            description:
              'Three-letter ISO code for the currency paid out to the wallet.',
            enumValues: [{ value: 'usdc' }],
          },
          {
            name: 'customer',
            type: 'string',
            nullable: true,
            tooltip: EXPAND_TOOLTIP,
            description:
              'The ID of the customer that the wallet is associated with.',
          },
          {
            name: 'fingerprint',
            type: 'string',
            nullable: true,
            description:
              'Uniquely identifies this particular wallet. You can use this attribute to check whether two wallets are the same.',
          },
          {
            name: 'last4',
            type: 'string',
            description:
              "The last four characters of the wallet's public address.",
          },
          {
            name: 'metadata',
            type: 'object',
            nullable: true,
            description:
              'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
          },
          {
            name: 'routing_number',
            type: 'string',
            nullable: true,
            description:
              'Not applicable to Solana wallets; retained for Stripe API parity.',
            enumNote:
              '<strong>Zoneless extension:</strong> Always <code>null</code>. Solana wallets have no equivalent of a routing number.',
          },
          {
            name: 'status',
            type: 'enum',
            description:
              "A wallet that hasn't had any activity or validation performed is <code>new</code>. If Zoneless can determine that the wallet exists, its status is <code>validated</code>. If customer wallet ownership verification succeeds, the status is <code>verified</code>. If a payout sent to this wallet fails, we set the status to <code>errored</code> and stop sending scheduled payouts until the wallet details are updated.",
            enumValues: [
              { value: 'new' },
              { value: 'validated' },
              { value: 'verified' },
              { value: 'verification_failed' },
              { value: 'tokenized_account_number_deactivated' },
              { value: 'errored' },
            ],
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
    name: 'subscriptions',
    type: 'object',
    nullable: true,
    description: "The customer's current subscriptions, if any.",
    expandable: true,
    children: [
      {
        name: 'object',
        type: 'string',
        description:
          "String representing the object's type. Objects of the same type share the same value. Always has the value <code>list</code>.",
      },
      {
        name: 'data',
        type: 'array of objects',
        description: 'Details about each object.',
        children: [
          ...SUBSCRIPTION_OBJECT_ATTRIBUTES,
          ...SUBSCRIPTION_MORE_ATTRIBUTES,
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
    name: 'tax_exempt',
    type: 'enum',
    nullable: true,
    description:
      'Describes the customer\'s tax exemption status, which is <code>none</code>, <code>exempt</code>, or <code>reverse</code>. When set to <code>reverse</code>, invoice and receipt PDFs include the text "Reverse charge".',
    enumValues: [{ value: 'exempt' }, { value: 'none' }, { value: 'reverse' }],
  },
  {
    name: 'tax_ids',
    type: 'object',
    nullable: true,
    description: "The customer's tax IDs.",
    expandable: true,
    children: [
      {
        name: 'object',
        type: 'string',
        description:
          "String representing the object's type. Objects of the same type share the same value. Always has the value <code>list</code>.",
      },
      {
        name: 'data',
        type: 'array of objects',
        description: 'Details about each object.',
        children: [
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
            name: 'country',
            type: 'string',
            nullable: true,
            description:
              'Two-letter ISO code representing the country of the tax ID.',
          },
          {
            name: 'created',
            type: 'timestamp',
            description:
              'Time at which the object was created. Measured in seconds since the Unix epoch.',
          },
          {
            name: 'customer',
            type: 'string',
            nullable: true,
            tooltip: EXPAND_TOOLTIP,
            description: 'ID of the customer.',
          },
          {
            name: 'customer_account',
            type: 'string',
            nullable: true,
            description: 'ID of the Account representing the customer.',
          },
          {
            name: 'livemode',
            type: 'boolean',
            description:
              'If the object exists in live mode, the value is <code>true</code>. If the object exists in test mode, the value is <code>false</code>.',
          },
          {
            name: 'owner',
            type: 'object',
            nullable: true,
            description: 'The account or customer the tax ID belongs to.',
            children: [
              {
                name: 'account',
                type: 'string',
                nullable: true,
                tooltip: EXPAND_TOOLTIP,
                description:
                  'The account being referenced when <code>type</code> is <code>account</code>.',
              },
              {
                name: 'application',
                type: 'string',
                nullable: true,
                tooltip: EXPAND_TOOLTIP,
                description:
                  'The Connect Application being referenced when <code>type</code> is <code>application</code>.',
              },
              {
                name: 'customer',
                type: 'string',
                nullable: true,
                tooltip: EXPAND_TOOLTIP,
                description:
                  'The customer being referenced when <code>type</code> is <code>customer</code>.',
              },
              {
                name: 'customer_account',
                type: 'string',
                nullable: true,
                description:
                  'The Account representing the customer being referenced when <code>type</code> is <code>customer</code>.',
              },
              {
                name: 'type',
                type: 'enum',
                description: 'Type of owner referenced.',
                enumValues: [
                  {
                    value: 'account',
                    description: 'Indicates an account is being referenced.',
                  },
                  {
                    value: 'application',
                    description:
                      'Indicates an application is being referenced.',
                  },
                  {
                    value: 'customer',
                    description: 'Indicates a customer is being referenced.',
                  },
                  {
                    value: 'self',
                    description:
                      'Indicates that the account being referenced is the account making the API request.',
                  },
                ],
              },
            ],
          },
          {
            name: 'type',
            type: 'string',
            description:
              'Type of the tax ID, e.g. <code>us_ein</code>, <code>eu_vat</code>, <code>gb_vat</code>, <code>jp_trn</code>.',
            enumNote:
              '<strong>Difference from Stripe:</strong> Stripe supports 100+ country-specific values. Zoneless keeps this as a plain string for maintainability.',
          },
          {
            name: 'value',
            type: 'string',
            description: 'Value of the tax ID.',
          },
          {
            name: 'verification',
            type: 'object',
            nullable: true,
            description: 'Tax ID verification information.',
            children: [
              {
                name: 'status',
                type: 'enum',
                description: 'Verification status.',
                enumValues: [
                  { value: 'pending' },
                  { value: 'unavailable' },
                  { value: 'unverified' },
                  { value: 'verified' },
                ],
              },
              {
                name: 'verified_address',
                type: 'string',
                nullable: true,
                description: 'Verified address.',
              },
              {
                name: 'verified_name',
                type: 'string',
                nullable: true,
                description: 'Verified name.',
              },
            ],
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
    name: 'test_clock',
    type: 'string',
    nullable: true,
    description: 'ID of the test clock that this customer belongs to.',
  },
];

const CUSTOMER_MORE_ATTRIBUTES: Attribute[] = [
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value.",
  },
  {
    name: 'business_name',
    type: 'string',
    nullable: true,
    description:
      "The customer's business name. The maximum length is 150 characters.",
  },
  {
    name: 'cash_balance',
    type: 'object',
    nullable: true,
    description:
      'The current funds being held on behalf of the customer. You can apply these funds towards payment intents when the source is <code>cash_balance</code>. The <code>settings.reconciliation_mode</code> field describes whether these funds apply to those payment intents manually or automatically.',
    expandable: true,
    enumNote:
      "<strong>Difference from Stripe:</strong> Stripe's cash balance can hold any supported fiat currency. Zoneless cash balances are always denominated in USDC.",
    children: [
      {
        name: 'object',
        type: 'string',
        description:
          "String representing the object's type. Objects of the same type share the same value.",
      },
      {
        name: 'available',
        type: 'object',
        nullable: true,
        description:
          'A hash of all cash balances available to this customer, keyed by three-letter currency code. You cannot delete a customer with any cash balances, even if the balance is 0. Amounts are represented in the smallest currency unit.',
      },
      {
        name: 'customer',
        type: 'string',
        description:
          'The ID of the customer whose cash balance this object represents.',
      },
      {
        name: 'customer_account',
        type: 'string',
        nullable: true,
        description:
          'The ID of an Account representing a customer whose cash balance this object represents.',
      },
      {
        name: 'livemode',
        type: 'boolean',
        description:
          'If the object exists in live mode, the value is <code>true</code>. If the object exists in test mode, the value is <code>false</code>.',
      },
      {
        name: 'settings',
        type: 'object',
        description: 'A hash of settings for this cash balance.',
        children: [
          {
            name: 'reconciliation_mode',
            type: 'enum',
            description:
              'The configuration for how funds that land in the customer cash balance are reconciled.',
            enumValues: [{ value: 'automatic' }, { value: 'manual' }],
          },
          {
            name: 'using_merchant_default',
            type: 'boolean',
            description:
              "A flag to indicate if the reconciliation mode returned is the platform's default or is specific to this customer's cash balance.",
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
      'The ID of an Account representing a customer. You can use this ID with any v1 API that accepts a <code>customer_account</code> parameter.',
  },
  {
    name: 'individual_name',
    type: 'string',
    nullable: true,
    description:
      "The customer's individual name. The maximum length is 150 characters.",
  },
  {
    name: 'invoice_credit_balance',
    type: 'object',
    description:
      "The current multi-currency balances, if any, that are stored on the customer, keyed by three-letter currency code. If positive in a currency, the customer has a credit to apply to their next invoice denominated in that currency. If negative, the customer has an amount owed that's added to their next invoice denominated in that currency. These balances don't apply to unpaid invoices — they solely track amounts that Zoneless hasn't successfully applied to any invoice.",
  },
  {
    name: 'livemode',
    type: 'boolean',
    description:
      'If the object exists in live mode, the value is <code>true</code>. If the object exists in test mode, the value is <code>false</code>.',
  },
  {
    name: 'tax',
    type: 'object',
    description: 'Tax details for the customer.',
    expandable: true,
    children: [
      {
        name: 'automatic_tax',
        type: 'enum',
        description:
          'Surfaces if automatic tax computation is possible given the current customer location information.',
        enumValues: [
          {
            value: 'failed',
            description:
              "There was an error determining the customer's location. Retrieve the customer to try again.",
          },
          {
            value: 'not_collecting',
            description:
              "The customer is located in a country or state where you're not registered to collect tax.",
          },
          {
            value: 'supported',
            description:
              "The customer is located in a country or state where you're collecting tax.",
          },
          {
            value: 'unrecognized_location',
            description: "The customer's location couldn't be determined.",
          },
        ],
      },
      {
        name: 'ip_address',
        type: 'string',
        nullable: true,
        description:
          'A recent IP address of the customer used for tax reporting and tax location inference.',
      },
      {
        name: 'location',
        type: 'object',
        nullable: true,
        description: 'The identified tax location of the customer.',
        children: [
          {
            name: 'country',
            type: 'string',
            nullable: true,
            description: 'The identified tax country of the customer.',
          },
          {
            name: 'source',
            type: 'string',
            nullable: true,
            description:
              "The data source used to infer the customer's location.",
          },
          {
            name: 'state',
            type: 'string',
            nullable: true,
            description:
              'The identified tax state, county, province, or region of the customer.',
          },
        ],
      },
      {
        name: 'provider',
        type: 'enum',
        description:
          'The tax calculation provider used for location resolution.',
        enumValues: [{ value: 'zoneless' }],
        enumNote:
          "<strong>Difference from Stripe:</strong> Stripe supports third-party tax providers. Zoneless doesn't, so this is always <code>zoneless</code>.",
      },
    ],
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
export const CUSTOMERS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Customer object',
  description:
    'This object represents a customer of your business. Use it to create recurring subscriptions, save wallet and contact information, and track USDC payments that belong to the same customer.',
  stripeDocsUrl: 'https://docs.stripe.com/api/customers/object',
  endpoints: BuildEndpointSummaries(CUSTOMERS_SUBSECTION, [
    { method: 'POST', path: '/v1/customers', pageId: 'create' },
    { method: 'POST', path: '/v1/customers/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/customers/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/customers', pageId: 'list' },
    { method: 'DELETE', path: '/v1/customers/:id', pageId: 'delete' },
  ]),
  events: GetResourceEventAttributes('customer'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: 'A customer\'s <code>sources</code> are linked Solana wallets used to pay your platform, not bank accounts. This is distinct from <a href="/external-wallets">External Wallets</a>, which sellers use to receive USDC payouts.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: CUSTOMER_ATTRIBUTES,
          moreAttributes: CUSTOMER_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE CUSTOMER OBJECT',
          code: CUSTOMER_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create Customer Parameters
// ============================================
const CREATE_CUSTOMER_PARAMETERS: Attribute[] = [
  {
    name: 'address',
    type: 'object',
    description:
      "The customer's address. Recommended if you plan to calculate tax for this customer.",
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
        description:
          'A freeform text field for the country. However, in order to activate some tax features, the format should be a two-letter country code (ISO 3166-1 alpha-2).',
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
    name: 'balance',
    type: 'integer',
    description:
      "An integer amount in the smallest currency unit that represents the customer's current balance, which affects the customer's future invoices. A negative amount represents a credit that decreases the amount due on an invoice; a positive amount increases the amount due on an invoice. For USDC, this is cents (e.g., 100 = $1 USDC).",
  },
  {
    name: 'description',
    type: 'string',
    description:
      "An arbitrary string that you can attach to a customer object. It's displayed alongside the customer in the dashboard.",
  },
  {
    name: 'email',
    type: 'string',
    description:
      "Customer's email address. It's displayed alongside the customer in your dashboard and can be useful for searching and tracking. The maximum length is 512 characters.",
  },
  {
    name: 'invoice_prefix',
    type: 'string',
    description:
      'The prefix for the customer used to generate unique invoice numbers. Must be 3–12 uppercase letters or numbers.',
  },
  {
    name: 'invoice_settings',
    type: 'object',
    description: 'Default invoice settings for this customer.',
    expandable: true,
    children: [
      {
        name: 'custom_fields',
        type: 'array of objects',
        description:
          'The list of up to 4 default custom fields to be displayed on invoices for this customer.',
        children: [
          {
            name: 'name',
            type: 'string',
            required: true,
            description:
              'The name of the custom field. The maximum length is 40 characters.',
          },
          {
            name: 'value',
            type: 'string',
            required: true,
            description:
              'The value of the custom field. The maximum length is 140 characters.',
          },
        ],
      },
      {
        name: 'default_payment_method',
        type: 'string',
        description:
          "ID of a payment method that's attached to the customer, to be used as the customer's default payment method for subscriptions and invoices.",
      },
      {
        name: 'footer',
        type: 'string',
        description:
          'Default footer to be displayed on invoices for this customer.',
      },
      {
        name: 'rendering_options',
        type: 'object',
        description:
          'Default options for invoice PDF rendering for this customer.',
        children: [
          {
            name: 'amount_tax_display',
            type: 'enum',
            description:
              'How line-item prices and amounts are displayed with respect to tax on invoice PDFs.',
            enumValues: [
              {
                value: 'exclude_tax',
                description:
                  'Exclude all tax (inclusive and exclusive alike) from invoice PDF amounts.',
              },
              {
                value: 'include_inclusive_tax',
                description:
                  'Include inclusive tax (and exclude exclusive tax) in invoice PDF amounts.',
              },
            ],
          },
          {
            name: 'template',
            type: 'string',
            description:
              'ID of the invoice rendering template to use for future invoices.',
          },
        ],
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
    name: 'name',
    type: 'string',
    description:
      "The customer's full name or business name. The maximum length is 256 characters.",
  },
  {
    name: 'next_invoice_sequence',
    type: 'integer',
    description:
      "The sequence to be used on the customer's next invoice. Defaults to 1.",
  },
  {
    name: 'payment_method',
    type: 'string',
    description: 'The ID of the payment method to attach to the customer.',
  },
  {
    name: 'phone',
    type: 'string',
    description:
      "The customer's phone number. The maximum length is 20 characters.",
  },
  {
    name: 'preferred_locales',
    type: 'array of strings',
    description: "Customer's preferred languages, ordered by preference.",
  },
  {
    name: 'shipping',
    type: 'object',
    description:
      "The customer's shipping information. Appears on invoices emailed to this customer.",
    expandable: true,
    children: [
      {
        name: 'address',
        type: 'object',
        required: true,
        description: 'Customer shipping address.',
        children: [
          {
            name: 'city',
            type: 'string',
            description: 'City, district, suburb, town, or village.',
          },
          {
            name: 'country',
            type: 'string',
            description:
              'A freeform text field for the country. However, in order to activate some tax features, the format should be a two-letter country code (ISO 3166-1 alpha-2).',
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
        description: 'Customer name.',
      },
      {
        name: 'phone',
        type: 'string',
        description: 'Customer phone (including extension).',
      },
    ],
  },
  {
    name: 'tax_exempt',
    type: 'enum',
    description:
      "The customer's tax exemption. One of <code>none</code>, <code>exempt</code>, or <code>reverse</code>.",
    enumValues: [{ value: 'exempt' }, { value: 'none' }, { value: 'reverse' }],
  },
];

const CREATE_CUSTOMER_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'business_name',
    type: 'string',
    description:
      "The customer's business name. The maximum length is 150 characters.",
  },
  {
    name: 'cash_balance',
    type: 'object',
    description:
      'Balance information and default balance settings for this customer.',
    expandable: true,
    children: [
      {
        name: 'settings',
        type: 'object',
        description:
          "Settings controlling the behavior of the customer's cash balance, such as reconciliation of funds received.",
        children: [
          {
            name: 'reconciliation_mode',
            type: 'enum',
            description:
              'Controls how funds transferred by the customer are applied to payment intents and invoices.',
            enumValues: [
              { value: 'automatic' },
              { value: 'manual' },
              { value: 'merchant_default' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'individual_name',
    type: 'string',
    description:
      "The customer's full name. The maximum length is 150 characters.",
  },
  {
    name: 'source',
    type: 'string',
    description:
      'When using payment sources created via the Token or Sources APIs, passing <code>source</code> creates a new source object, makes it the new customer default source, and deletes the old customer default if one exists. If you want to add additional sources instead of replacing the existing default, use the <a href="/external-wallets">External Wallets API</a> instead.',
  },
  {
    name: 'tax',
    type: 'object',
    description: 'Tax details about the customer.',
    expandable: true,
    children: [
      {
        name: 'ip_address',
        type: 'string',
        description:
          'A recent IP address of the customer used for tax reporting and tax location inference. Zoneless recommends updating the IP address when a new payment method is attached or the <code>address</code> field on the customer is updated.',
      },
      {
        name: 'validate_location',
        type: 'enum',
        description:
          'A flag that indicates when Zoneless should validate the customer tax location. Defaults to <code>deferred</code>.',
        enumValues: [
          {
            value: 'deferred',
            description:
              "Defer the validation of the customer's tax location until needed, such as when calculating taxes on an invoice. Default.",
          },
          {
            value: 'immediately',
            description:
              "Validate the customer's tax location immediately. An error is returned and the customer isn't created if the tax location is invalid. Recommended if calculating taxes.",
          },
        ],
      },
    ],
  },
  {
    name: 'tax_id_data',
    type: 'array of objects',
    description: "The customer's tax IDs.",
    expandable: true,
    children: [
      {
        name: 'type',
        type: 'string',
        required: true,
        description:
          'Type of the tax ID, e.g. <code>us_ein</code>, <code>eu_vat</code>, <code>gb_vat</code>, <code>jp_trn</code>.',
        enumNote:
          '<strong>Difference from Stripe:</strong> Stripe supports 100+ country-specific values. Zoneless keeps this as a free-form string for maintainability.',
      },
      {
        name: 'value',
        type: 'string',
        required: true,
        description: 'Value of the tax ID.',
      },
    ],
  },
  {
    name: 'test_clock',
    type: 'string',
    description: 'ID of the test clock to attach to the customer.',
  },
];

export const CUSTOMERS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a customer',
  description: 'Creates a new customer object.',
  stripeDocsUrl: 'https://docs.stripe.com/api/customers/create',
  endpoints: [{ method: 'POST', path: '/v1/customers' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_CUSTOMER_PARAMETERS,
          moreAttributes: CREATE_CUSTOMER_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the <code>Customer</code> object after successful customer creation. Raises <a href="/errors">an error</a> if create parameters are invalid (for example, specifying an invalid source).',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/customers' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/customers \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d name="Tom Jones" \\
  -d email=tomjones@example.com`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const customer = await zoneless.customers.create({
  name: 'Tom Jones',
  email: 'tomjones@example.com',
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: CUSTOMER_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Update Customer Parameters
// ============================================
const UPDATE_CUSTOMER_PARAMETERS: Attribute[] = [
  {
    name: 'address',
    type: 'object',
    description:
      "The customer's address. Recommended if you plan to calculate tax for this customer.",
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
        description:
          'A freeform text field for the country. However, in order to activate some tax features, the format should be a two-letter country code (ISO 3166-1 alpha-2).',
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
    name: 'balance',
    type: 'integer',
    description:
      "An integer amount in the smallest currency unit that represents the customer's current balance, which affects the customer's future invoices. A negative amount represents a credit that decreases the amount due on an invoice; a positive amount increases the amount due on an invoice.",
  },
  {
    name: 'default_source',
    type: 'string',
    description:
      "If you're using payment methods created via the PaymentMethods API, see the <code>invoice_settings.default_payment_method</code> parameter instead.<br/><br/>Provide the ID of a payment source already attached to this customer to make it this customer's default payment source.<br/><br/>If you want to add a new payment source and make it the default, see the <code>source</code> property. The maximum length is 500 characters.",
  },
  {
    name: 'description',
    type: 'string',
    description:
      "An arbitrary string that you can attach to a customer object. It's displayed alongside the customer in the dashboard.",
  },
  {
    name: 'email',
    type: 'string',
    description:
      "Customer's email address. It's displayed alongside the customer in your dashboard and can be useful for searching and tracking. The maximum length is 512 characters.",
  },
  {
    name: 'invoice_prefix',
    type: 'string',
    description:
      'The prefix for the customer used to generate unique invoice numbers. Must be 3–12 uppercase letters or numbers.',
  },
  {
    name: 'invoice_settings',
    type: 'object',
    description: 'Default invoice settings for this customer.',
    expandable: true,
    children: [
      {
        name: 'custom_fields',
        type: 'array of objects',
        description:
          'The list of up to 4 default custom fields to be displayed on invoices for this customer. When updating, pass an empty string to remove previously-defined fields.',
        children: [
          {
            name: 'name',
            type: 'string',
            required: true,
            description:
              'The name of the custom field. The maximum length is 40 characters.',
          },
          {
            name: 'value',
            type: 'string',
            required: true,
            description:
              'The value of the custom field. The maximum length is 140 characters.',
          },
        ],
      },
      {
        name: 'default_payment_method',
        type: 'string',
        description:
          "ID of a payment method that's attached to the customer, to be used as the customer's default payment method for subscriptions and invoices.",
      },
      {
        name: 'footer',
        type: 'string',
        description:
          'Default footer to be displayed on invoices for this customer.',
      },
      {
        name: 'rendering_options',
        type: 'object',
        description:
          'Default options for invoice PDF rendering for this customer.',
        children: [
          {
            name: 'amount_tax_display',
            type: 'enum',
            description:
              'How line-item prices and amounts are displayed with respect to tax on invoice PDFs.',
            enumValues: [
              {
                value: 'exclude_tax',
                description:
                  'Exclude all tax (inclusive and exclusive alike) from invoice PDF amounts.',
              },
              {
                value: 'include_inclusive_tax',
                description:
                  'Include inclusive tax (and exclude exclusive tax) in invoice PDF amounts.',
              },
            ],
          },
          {
            name: 'template',
            type: 'string',
            description:
              'ID of the invoice rendering template to use for future invoices.',
          },
        ],
      },
    ],
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'name',
    type: 'string',
    description:
      "The customer's full name or business name. The maximum length is 256 characters.",
  },
  {
    name: 'next_invoice_sequence',
    type: 'integer',
    description:
      "The sequence to be used on the customer's next invoice. Defaults to 1.",
  },
  {
    name: 'phone',
    type: 'string',
    description:
      "The customer's phone number. The maximum length is 20 characters.",
  },
  {
    name: 'preferred_locales',
    type: 'array of strings',
    description: "Customer's preferred languages, ordered by preference.",
  },
  {
    name: 'shipping',
    type: 'object',
    description:
      "The customer's shipping information. Appears on invoices emailed to this customer.",
    expandable: true,
    children: [
      {
        name: 'address',
        type: 'object',
        required: true,
        description: 'Customer shipping address.',
        children: [
          {
            name: 'city',
            type: 'string',
            description: 'City, district, suburb, town, or village.',
          },
          {
            name: 'country',
            type: 'string',
            description:
              'A freeform text field for the country. However, in order to activate some tax features, the format should be a two-letter country code (ISO 3166-1 alpha-2).',
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
        description: 'Customer name.',
      },
      {
        name: 'phone',
        type: 'string',
        description: 'Customer phone (including extension).',
      },
    ],
  },
  {
    name: 'tax_exempt',
    type: 'enum',
    description:
      "The customer's tax exemption. One of <code>none</code>, <code>exempt</code>, or <code>reverse</code>.",
    enumValues: [{ value: 'exempt' }, { value: 'none' }, { value: 'reverse' }],
  },
];

const UPDATE_CUSTOMER_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'business_name',
    type: 'string',
    description:
      "The customer's business name. The maximum length is 150 characters.",
  },
  {
    name: 'cash_balance',
    type: 'object',
    description:
      'Balance information and default balance settings for this customer.',
    expandable: true,
    children: [
      {
        name: 'settings',
        type: 'object',
        description:
          "Settings controlling the behavior of the customer's cash balance, such as reconciliation of funds received.",
        children: [
          {
            name: 'reconciliation_mode',
            type: 'enum',
            description:
              'Controls how funds transferred by the customer are applied to payment intents and invoices.',
            enumValues: [
              { value: 'automatic' },
              { value: 'manual' },
              { value: 'merchant_default' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'individual_name',
    type: 'string',
    description:
      "The customer's full name. The maximum length is 150 characters.",
  },
  {
    name: 'source',
    type: 'string',
    description:
      'When using payment sources created via the Token or Sources APIs, passing <code>source</code> creates a new source object, makes it the new customer default source, and deletes the old customer default if one exists. If you want to add additional sources instead of replacing the existing default, use the <a href="/external-wallets">External Wallets API</a> instead.',
  },
  {
    name: 'tax',
    type: 'object',
    description: 'Tax details about the customer.',
    expandable: true,
    children: [
      {
        name: 'ip_address',
        type: 'string',
        description:
          'A recent IP address of the customer used for tax reporting and tax location inference. Zoneless recommends updating the IP address when a new payment method is attached or the <code>address</code> field on the customer is updated. We recommend against updating this field more frequently since it could result in unexpected tax location/reporting outcomes.',
      },
      {
        name: 'validate_location',
        type: 'enum',
        description:
          'A flag that indicates when Zoneless should validate the customer tax location. Defaults to <code>auto</code>.',
        enumValues: [
          {
            value: 'auto',
            description:
              "Validate the customer's tax location immediately if it has automatic tax enabled subscriptions. Recommended. Default.",
          },
          {
            value: 'deferred',
            description:
              "Defer the validation of the customer's tax location until needed, such as when calculating taxes on an invoice. Deprecated.",
          },
          {
            value: 'immediately',
            description:
              "Validate the customer's tax location immediately. An error is returned and the customer isn't updated if the tax location is invalid.",
          },
        ],
      },
    ],
  },
];

const UPDATE_CUSTOMER_RESPONSE_JSON = `{
  "id": "cus_z_NffrFeUfNV2Hib",
  "object": "customer",
  "address": null,
  "balance": 0,
  "created": 1778894772,
  "currency": null,
  "default_source": null,
  "delinquent": false,
  "description": null,
  "email": "tomjones@example.com",
  "invoice_prefix": "024A99CD",
  "invoice_settings": {
    "custom_fields": null,
    "default_payment_method": null,
    "footer": null,
    "rendering_options": null
  },
  "livemode": false,
  "metadata": {
    "order_id": "6735"
  },
  "name": "Tom Jones",
  "next_invoice_sequence": 1,
  "phone": null,
  "preferred_locales": [],
  "shipping": null,
  "tax_exempt": "none",
  "test_clock": null,
  "platform_account": "acct_z_Platform123abc"
}`;

export const CUSTOMERS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a customer',
  description:
    'Updates the specified customer by setting the values of the parameters passed. Any parameters not provided are left unchanged.',
  stripeDocsUrl: 'https://docs.stripe.com/api/customers/update',
  endpoints: [{ method: 'POST', path: '/v1/customers/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_CUSTOMER_PARAMETERS,
          moreAttributes: UPDATE_CUSTOMER_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the <code>Customer</code> object if the update succeeded. Raises <a href="/errors">an error</a> if update parameters are invalid (for example, specifying an invalid source).',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/customers/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/customers/cus_z_NffrFeUfNV2Hib \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[order_id]"=6735`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const customer = await zoneless.customers.update('cus_z_NffrFeUfNV2Hib', {
  metadata: {
    order_id: '6735',
  },
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: UPDATE_CUSTOMER_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Retrieve Customer
// ============================================
export const CUSTOMERS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a customer',
  description: 'Retrieves a Customer object.',
  stripeDocsUrl: 'https://docs.stripe.com/api/customers/retrieve',
  endpoints: [{ method: 'GET', path: '/v1/customers/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: "Returns the <code>Customer</code> object for a valid identifier. If it's for a deleted customer, a subset of the customer's information is returned, including a <code>deleted</code> property that's set to <code>true</code>.",
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/customers/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/customers/cus_z_NffrFeUfNV2Hib \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const customer = await zoneless.customers.retrieve('cus_z_NffrFeUfNV2Hib');`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: CUSTOMER_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// List Customers Parameters
// ============================================
const LIST_CUSTOMERS_PARAMETERS: Attribute[] = [
  {
    name: 'email',
    type: 'string',
    description:
      "A case-sensitive filter on the list based on the customer's <code>email</code> field. The value must be a string. The maximum length is 512 characters.",
  },
  {
    name: 'test_clock',
    type: 'string',
    description:
      "Provides a list of customers that are associated with the specified test clock. The response won't include customers with test clocks if this parameter isn't set.",
  },
];

const LIST_CUSTOMERS_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'created',
    type: 'object',
    description:
      'Only return customers that were created during the given date interval.',
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
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>cus_z_bar</code>, your subsequent call can include <code>ending_before=cus_z_bar</code> in order to fetch the previous page of the list.',
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
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>cus_z_foo</code>, your subsequent call can include <code>starting_after=cus_z_foo</code> in order to fetch the next page of the list.',
  },
];

const LIST_CUSTOMERS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/customers",
  "has_more": false,
  "data": [
    {
      "id": "cus_z_NffrFeUfNV2Hib",
      "object": "customer",
      "address": null,
      "balance": 0,
      "created": 1778894772,
      "currency": null,
      "default_source": null,
      "delinquent": false,
      "description": null,
      "email": "tomjones@example.com",
      "invoice_prefix": "024A99CD",
      "invoice_settings": {
        "custom_fields": null,
        "default_payment_method": null,
        "footer": null,
        "rendering_options": null
      },
      "livemode": false,
      "metadata": {},
      "name": "Tom Jones",
      "next_invoice_sequence": 1,
      "phone": null,
      "preferred_locales": [],
      "shipping": null,
      "tax_exempt": "none",
      "test_clock": null,
      "platform_account": "acct_z_Platform123abc"
    }
  ]
}`;

export const CUSTOMERS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all customers',
  description:
    'Returns a list of your customers. The customers are returned sorted by creation date, with the most recent customers appearing first.',
  endpoints: [{ method: 'GET', path: '/v1/customers' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_CUSTOMERS_PARAMETERS,
          moreAttributes: LIST_CUSTOMERS_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> customers, starting after customer <code>starting_after</code>. Passing an optional <code>email</code> results in filtering to customers with only that exact email address. Each entry in the array is a separate customer object. If no more customers are available, the resulting array is empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/customers' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/customers \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const customers = await zoneless.customers.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_CUSTOMERS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Delete Customer
// ============================================
const DELETE_CUSTOMER_RESPONSE_JSON = `{
  "id": "cus_z_NffrFeUfNV2Hib",
  "object": "customer",
  "deleted": true
}`;

export const CUSTOMERS_DELETE_PAGE: DocPage = {
  id: 'delete',
  title: 'Delete a customer',
  description:
    'Permanently deletes a customer. It cannot be undone. Also immediately cancels any active subscriptions on the customer.',
  endpoints: [{ method: 'DELETE', path: '/v1/customers/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns an object with a <code>deleted</code> parameter on success. If the customer ID does not exist, this call raises <a href="/errors">an error</a>.<br/><br/>Unlike other objects, deleted customers can still be retrieved through the API in order to be able to track their history. Deleting customers removes all wallet details and prevents any further operations to be performed (such as adding a new subscription).',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'DELETE', path: '/v1/customers/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X DELETE https://api.yourdomain.com/v1/customers/cus_z_NffrFeUfNV2Hib \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const deleted = await zoneless.customers.del('cus_z_NffrFeUfNV2Hib');`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: DELETE_CUSTOMER_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const CUSTOMERS_PAGES: DocPage[] = [
  CUSTOMERS_OVERVIEW_PAGE,
  CUSTOMERS_CREATE_PAGE,
  CUSTOMERS_UPDATE_PAGE,
  CUSTOMERS_RETRIEVE_PAGE,
  CUSTOMERS_LIST_PAGE,
  CUSTOMERS_DELETE_PAGE,
];
