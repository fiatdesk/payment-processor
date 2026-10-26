import { DocSubSection, DocPage, Attribute } from './types';
import { NODE_INIT, EXPAND_TOOLTIP, BuildEndpointSummaries } from './shared';
import { GetResourceEventAttributes } from './event-types';

export const CHARGES_SUBSECTION: DocSubSection = {
  id: 'charges',
  title: 'Charges',
  children: [
    { id: 'object', title: 'The Charge object' },
    { id: 'create', title: 'Create a charge' },
    { id: 'update', title: 'Update a charge' },
    { id: 'retrieve', title: 'Retrieve a charge' },
    { id: 'list', title: 'List all charges' },
    { id: 'capture', title: 'Capture a charge' },
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

// ============================================
// Shared example objects
// ============================================

const CHARGE_OBJECT_JSON = `{
  "id": "ch_z_3NqR2xLkdIwHu7ix8kP4mQ2a",
  "object": "charge",
  "amount": 2500,
  "amount_captured": 2500,
  "amount_refunded": 0,
  "application": null,
  "application_fee": null,
  "application_fee_amount": null,
  "balance_transaction": "txn_z_3NqR2xLkdIwHu7ix2bR9nT4c",
  "billing_details": {
    "address": {
      "city": null,
      "country": null,
      "line1": null,
      "line2": null,
      "postal_code": null,
      "state": null
    },
    "email": "ava.chen@example.com",
    "name": "Ava Chen",
    "phone": null,
    "tax_id": null
  },
  "calculated_statement_descriptor": null,
  "captured": true,
  "created": 1716234567,
  "currency": "usdc",
  "customer": "cus_z_NffrFeUfNV2Hib",
  "description": "Order #4821",
  "disputed": false,
  "failure_balance_transaction": null,
  "failure_code": null,
  "failure_message": null,
  "fraud_details": {},
  "livemode": false,
  "metadata": {},
  "on_behalf_of": null,
  "outcome": {
    "advice_code": null,
    "network_advice_code": null,
    "network_decline_code": null,
    "network_status": "approved_by_network",
    "reason": null,
    "risk_level": "normal",
    "risk_score": null,
    "rule": null,
    "seller_message": "Payment complete.",
    "type": "authorized"
  },
  "paid": true,
  "payment_intent": "pi_z_3NqR2xLkdIwHu7ix1aK8vL3d",
  "payment_method": "pm_z_1NqR2xLkdIwHu7ixWallet9",
  "payment_method_details": {
    "type": "crypto",
    "crypto": {
      "buyer_address": "8xK2Nv3FpQ7mR9sT1uVwXyZ4aBcDeFgH",
      "fingerprint": null,
      "network": "solana",
      "token_currency": "usdc",
      "transaction_hash": "5xK9mNpQ2rStUvWxYzAbCdEfGhIjKlMnOpQr"
    }
  },
  "presentment_details": null,
  "radar_options": null,
  "receipt_email": "ava.chen@example.com",
  "receipt_number": null,
  "receipt_url": null,
  "refunded": false,
  "refunds": {
    "object": "list",
    "data": [],
    "has_more": false,
    "url": "/v1/charges/ch_z_3NqR2xLkdIwHu7ix8kP4mQ2a/refunds"
  },
  "review": null,
  "shipping": null,
  "source_transfer": null,
  "statement_descriptor": null,
  "statement_descriptor_suffix": null,
  "status": "succeeded",
  "transfer": null,
  "transfer_data": null,
  "transfer_group": null,
  "platform_account": "acct_z_Platform123abc"
}`;

const CHARGE_UPDATE_RESPONSE_JSON = `{
  "id": "ch_z_3NqR2xLkdIwHu7ix8kP4mQ2a",
  "object": "charge",
  "amount": 2500,
  "amount_captured": 2500,
  "amount_refunded": 0,
  "application": null,
  "application_fee": null,
  "application_fee_amount": null,
  "balance_transaction": "txn_z_3NqR2xLkdIwHu7ix2bR9nT4c",
  "billing_details": {
    "address": {
      "city": null,
      "country": null,
      "line1": null,
      "line2": null,
      "postal_code": null,
      "state": null
    },
    "email": "ava.chen@example.com",
    "name": "Ava Chen",
    "phone": null,
    "tax_id": null
  },
  "calculated_statement_descriptor": null,
  "captured": true,
  "created": 1716234567,
  "currency": "usdc",
  "customer": "cus_z_NffrFeUfNV2Hib",
  "description": "Order #4821",
  "disputed": false,
  "failure_balance_transaction": null,
  "failure_code": null,
  "failure_message": null,
  "fraud_details": {},
  "livemode": false,
  "metadata": {
    "shipping": "express"
  },
  "on_behalf_of": null,
  "outcome": {
    "advice_code": null,
    "network_advice_code": null,
    "network_decline_code": null,
    "network_status": "approved_by_network",
    "reason": null,
    "risk_level": "normal",
    "risk_score": null,
    "rule": null,
    "seller_message": "Payment complete.",
    "type": "authorized"
  },
  "paid": true,
  "payment_intent": "pi_z_3NqR2xLkdIwHu7ix1aK8vL3d",
  "payment_method": "pm_z_1NqR2xLkdIwHu7ixWallet9",
  "payment_method_details": {
    "type": "crypto",
    "crypto": {
      "buyer_address": "8xK2Nv3FpQ7mR9sT1uVwXyZ4aBcDeFgH",
      "fingerprint": null,
      "network": "solana",
      "token_currency": "usdc",
      "transaction_hash": "5xK9mNpQ2rStUvWxYzAbCdEfGhIjKlMnOpQr"
    }
  },
  "presentment_details": null,
  "radar_options": null,
  "receipt_email": "ava.chen@example.com",
  "receipt_number": null,
  "receipt_url": null,
  "refunded": false,
  "refunds": {
    "object": "list",
    "data": [],
    "has_more": false,
    "url": "/v1/charges/ch_z_3NqR2xLkdIwHu7ix8kP4mQ2a/refunds"
  },
  "review": null,
  "shipping": null,
  "source_transfer": null,
  "statement_descriptor": null,
  "statement_descriptor_suffix": null,
  "status": "succeeded",
  "transfer": null,
  "transfer_data": null,
  "transfer_group": null,
  "platform_account": "acct_z_Platform123abc"
}`;

const CHARGE_CAPTURE_RESPONSE_JSON = `{
  "id": "ch_z_3NrW8kLkdIwHu7ix4mH2pL9b",
  "object": "charge",
  "amount": 2500,
  "amount_captured": 2500,
  "amount_refunded": 0,
  "application": null,
  "application_fee": null,
  "application_fee_amount": null,
  "balance_transaction": "txn_z_3NrW8kLkdIwHu7ix7cN1qR5e",
  "billing_details": {
    "address": {
      "city": null,
      "country": null,
      "line1": null,
      "line2": null,
      "postal_code": null,
      "state": null
    },
    "email": null,
    "name": null,
    "phone": null,
    "tax_id": null
  },
  "calculated_statement_descriptor": null,
  "captured": true,
  "created": 1716401280,
  "currency": "usdc",
  "customer": null,
  "description": null,
  "disputed": false,
  "failure_balance_transaction": null,
  "failure_code": null,
  "failure_message": null,
  "fraud_details": {},
  "livemode": false,
  "metadata": {},
  "on_behalf_of": null,
  "outcome": {
    "advice_code": null,
    "network_advice_code": null,
    "network_decline_code": null,
    "network_status": "approved_by_network",
    "reason": null,
    "risk_level": "normal",
    "risk_score": null,
    "rule": null,
    "seller_message": "Payment complete.",
    "type": "authorized"
  },
  "paid": true,
  "payment_intent": null,
  "payment_method": "pm_z_1NrW8kLkdIwHu7ixWallet3",
  "payment_method_details": {
    "type": "crypto",
    "crypto": {
      "buyer_address": null,
      "fingerprint": null,
      "network": "solana",
      "token_currency": "usdc",
      "transaction_hash": null
    }
  },
  "presentment_details": null,
  "radar_options": null,
  "receipt_email": null,
  "receipt_number": null,
  "receipt_url": null,
  "refunded": false,
  "refunds": {
    "object": "list",
    "data": [],
    "has_more": false,
    "url": "/v1/charges/ch_z_3NrW8kLkdIwHu7ix4mH2pL9b/refunds"
  },
  "review": null,
  "shipping": null,
  "source_transfer": null,
  "statement_descriptor": null,
  "statement_descriptor_suffix": null,
  "status": "succeeded",
  "transfer": null,
  "transfer_data": null,
  "transfer_group": null,
  "platform_account": "acct_z_Platform123abc"
}`;

const LIST_CHARGES_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/charges",
  "has_more": false,
  "data": [
    {
      "id": "ch_z_3NqR2xLkdIwHu7ix8kP4mQ2a",
      "object": "charge",
      "amount": 2500,
      "amount_captured": 2500,
      "amount_refunded": 0,
      "application": null,
      "application_fee": null,
      "application_fee_amount": null,
      "balance_transaction": "txn_z_3NqR2xLkdIwHu7ix2bR9nT4c",
      "billing_details": {
        "address": {
          "city": null,
          "country": null,
          "line1": null,
          "line2": null,
          "postal_code": null,
          "state": null
        },
        "email": "ava.chen@example.com",
        "name": "Ava Chen",
        "phone": null,
        "tax_id": null
      },
      "calculated_statement_descriptor": null,
      "captured": true,
      "created": 1716234567,
      "currency": "usdc",
      "customer": "cus_z_NffrFeUfNV2Hib",
      "description": "Order #4821",
      "disputed": false,
      "failure_balance_transaction": null,
      "failure_code": null,
      "failure_message": null,
      "fraud_details": {},
      "livemode": false,
      "metadata": {},
      "on_behalf_of": null,
      "outcome": {
        "advice_code": null,
        "network_advice_code": null,
        "network_decline_code": null,
        "network_status": "approved_by_network",
        "reason": null,
        "risk_level": "normal",
        "risk_score": null,
        "rule": null,
        "seller_message": "Payment complete.",
        "type": "authorized"
      },
      "paid": true,
      "payment_intent": "pi_z_3NqR2xLkdIwHu7ix1aK8vL3d",
      "payment_method": "pm_z_1NqR2xLkdIwHu7ixWallet9",
      "payment_method_details": {
        "type": "crypto",
        "crypto": {
          "buyer_address": "8xK2Nv3FpQ7mR9sT1uVwXyZ4aBcDeFgH",
          "fingerprint": null,
          "network": "solana",
          "token_currency": "usdc",
          "transaction_hash": "5xK9mNpQ2rStUvWxYzAbCdEfGhIjKlMnOpQr"
        }
      },
      "presentment_details": null,
      "radar_options": null,
      "receipt_email": "ava.chen@example.com",
      "receipt_number": null,
      "receipt_url": null,
      "refunded": false,
      "refunds": {
        "object": "list",
        "data": [],
        "has_more": false,
        "url": "/v1/charges/ch_z_3NqR2xLkdIwHu7ix8kP4mQ2a/refunds"
      },
      "review": null,
      "shipping": null,
      "source_transfer": null,
      "statement_descriptor": null,
      "statement_descriptor_suffix": null,
      "status": "succeeded",
      "transfer": null,
      "transfer_data": null,
      "transfer_group": null,
      "platform_account": "acct_z_Platform123abc"
    }
  ]
}`;

// ============================================
// Charge object attributes
// ============================================

const CHARGE_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless charge IDs are prefixed with <code>ch_z_</code>.',
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
      'Amount intended to be collected by this payment. A positive integer in the smallest currency unit. For USDC, this is cents (e.g., 100 = $1 USDC). The amount value supports up to eight digits.',
  },
  {
    name: 'amount_captured',
    type: 'integer',
    description:
      'Amount in the smallest currency unit captured (can be less than <code>amount</code> if a partial capture was made).',
  },
  {
    name: 'amount_refunded',
    type: 'integer',
    description:
      'Amount in the smallest currency unit refunded (can be less than <code>amount</code> if a partial refund was issued).',
  },
  {
    name: 'application',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'ID of the Connect application that created the charge.',
  },
  {
    name: 'application_fee',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'The application fee (if any) for the charge.',
  },
  {
    name: 'application_fee_amount',
    type: 'integer',
    nullable: true,
    description:
      'The amount of the application fee (if any) requested for the charge, in the smallest currency unit.',
  },
  {
    name: 'balance_transaction',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the balance transaction that describes the impact of this charge on your account balance (not including refunds or disputes).',
  },
  {
    name: 'billing_details',
    type: 'object',
    description:
      'Billing information associated with the payment method at the time of the transaction.',
    expandable: true,
    children: [
      {
        name: 'address',
        type: 'object',
        nullable: true,
        description: 'Billing address.',
        expandable: true,
        children: ADDRESS_CHILDREN,
      },
      {
        name: 'email',
        type: 'string',
        nullable: true,
        description: 'Email address.',
      },
      {
        name: 'name',
        type: 'string',
        nullable: true,
        description: 'Full name.',
      },
      {
        name: 'phone',
        type: 'string',
        nullable: true,
        description: 'Billing phone number (including extension).',
      },
      {
        name: 'tax_id',
        type: 'string',
        nullable: true,
        description: 'Taxpayer identification number, when provided.',
      },
    ],
  },
  {
    name: 'calculated_statement_descriptor',
    type: 'string',
    nullable: true,
    description:
      'The full statement descriptor after static and dynamic portions are combined. Retained for API compatibility; USDC transfers on Solana do not display bank statement descriptors.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Blockchain payments have no card network statement descriptor. This field is typically <code>null</code>.',
  },
  {
    name: 'captured',
    type: 'boolean',
    description:
      'If the charge was created without capturing, this Boolean represents whether it is still uncaptured or has since been captured.',
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
      'Three-letter currency code, in lowercase. For Zoneless, this is typically <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Uses <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
  },
  {
    name: 'customer',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'ID of the customer this charge is for, if one exists.',
  },
  {
    name: 'description',
    type: 'string',
    nullable: true,
    description:
      'An arbitrary string attached to the object. Often useful for displaying to users.',
  },
  {
    name: 'disputed',
    type: 'boolean',
    description: 'Whether the charge has been disputed.',
  },
  {
    name: 'failure_balance_transaction',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the balance transaction that describes the reversal of the balance on your account due to payment failure.',
  },
  {
    name: 'failure_code',
    type: 'string',
    nullable: true,
    description:
      'Error code explaining the reason for charge failure, if available.',
  },
  {
    name: 'failure_message',
    type: 'string',
    nullable: true,
    description:
      'Message further explaining the reason for charge failure, if available.',
  },
  {
    name: 'fraud_details',
    type: 'object',
    nullable: true,
    description: 'Information on fraud assessments for the charge.',
    expandable: true,
    children: [
      {
        name: 'stripe_report',
        type: 'string',
        nullable: true,
        description:
          'Automated fraud assessment value. If set, the value is <code>fraudulent</code>.',
        enumNote:
          '<strong>Note:</strong> Field name retained for API compatibility. Prefer <code>user_report</code> for your own assessments.',
      },
      {
        name: 'user_report',
        type: 'string',
        nullable: true,
        description:
          'Assessment reported by you. Possible values are <code>safe</code> and <code>fraudulent</code>.',
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
    description:
      'Set of key-value pairs that you can attach to an object. Useful for storing additional information in a structured format.',
  },
  {
    name: 'on_behalf_of',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The connected account (if any) the charge was made on behalf of without triggering an automatic transfer.',
  },
  {
    name: 'outcome',
    type: 'object',
    nullable: true,
    description: 'Details about whether the payment was accepted, and why.',
    expandable: true,
    children: [
      {
        name: 'advice_code',
        type: 'enum',
        nullable: true,
        description:
          'A more detailed explanation of how to proceed after a declined payment.',
        enumValues: [
          { value: 'confirm_card_data' },
          { value: 'do_not_try_again' },
          { value: 'try_again_later' },
        ],
      },
      {
        name: 'network_advice_code',
        type: 'string',
        nullable: true,
        description:
          'For declined charges, a code indicating advice returned by the network.',
      },
      {
        name: 'network_decline_code',
        type: 'string',
        nullable: true,
        description:
          'For declined charges, a code indicating why the charge failed.',
      },
      {
        name: 'network_status',
        type: 'string',
        nullable: true,
        description:
          'Possible values are <code>approved_by_network</code>, <code>declined_by_network</code>, <code>not_sent_to_network</code>, and <code>reversed_after_approval</code>.',
      },
      {
        name: 'reason',
        type: 'string',
        nullable: true,
        description:
          "A more detailed explanation of the outcome's <code>type</code>.",
      },
      {
        name: 'risk_level',
        type: 'string',
        nullable: true,
        description:
          'Risk evaluation for the payment. Possible values are <code>normal</code>, <code>elevated</code>, <code>highest</code>, <code>not_assessed</code>, or <code>unknown</code>.',
      },
      {
        name: 'risk_score',
        type: 'integer',
        nullable: true,
        description: 'Numeric risk score between 0 and 100, when available.',
      },
      {
        name: 'rule',
        type: 'string',
        nullable: true,
        tooltip: EXPAND_TOOLTIP,
        description:
          'The ID of the risk rule that matched the payment, if applicable.',
      },
      {
        name: 'seller_message',
        type: 'string',
        nullable: true,
        description:
          'A human-readable description of the outcome, intended for you (the recipient of the payment), not your customer.',
      },
      {
        name: 'type',
        type: 'enum',
        description: 'Outcome type for the charge.',
        enumValues: [
          { value: 'authorized' },
          { value: 'manual_review' },
          { value: 'issuer_declined' },
          { value: 'blocked' },
          { value: 'invalid' },
        ],
      },
    ],
  },
  {
    name: 'paid',
    type: 'boolean',
    description:
      '<code>true</code> if the charge succeeded, or was successfully authorized for later capture.',
  },
  {
    name: 'payment_intent',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the PaymentIntent associated with this charge, if one exists.',
  },
  {
    name: 'payment_method',
    type: 'string',
    nullable: true,
    description: 'ID of the payment method used in this charge.',
  },
  {
    name: 'payment_method_details',
    type: 'object',
    nullable: true,
    description:
      'Details about the payment method at the time of the transaction.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless charges typically use <code>type: "crypto"</code> with USDC wallet details. Other payment method hashes may appear for API compatibility but are not used for settlement.',
    expandable: true,
    children: [
      {
        name: 'type',
        type: 'string',
        description:
          'The type of transaction-specific details. For Zoneless, this is typically <code>crypto</code>. An additional hash is included with a name matching this value.',
      },
      {
        name: 'crypto',
        type: 'object',
        nullable: true,
        description:
          'Snapshot of the crypto payment method used for this charge.',
        expandable: true,
        children: [
          {
            name: 'buyer_address',
            type: 'string',
            nullable: true,
            description: 'The wallet address of the customer.',
          },
          {
            name: 'fingerprint',
            type: 'string',
            nullable: true,
            description:
              'A unique fingerprint of the crypto wallet used for this payment.',
          },
          {
            name: 'network',
            type: 'enum',
            nullable: true,
            description:
              'The blockchain network that the transaction was sent on.',
            enumValues: [
              {
                value: 'solana',
                description: 'Solana (primary network for Zoneless).',
              },
              { value: 'base' },
              { value: 'ethereum' },
              { value: 'polygon' },
              { value: 'sui' },
              { value: 'tempo' },
            ],
            enumNote:
              '<strong>Difference from Stripe:</strong> Zoneless settles on Solana. Other networks are accepted for schema compatibility.',
          },
          {
            name: 'token_currency',
            type: 'enum',
            nullable: true,
            description:
              'The token currency that the transaction was sent with.',
            enumValues: [
              {
                value: 'usdc',
                description: 'USDC (primary currency for Zoneless).',
              },
              { value: 'usdt' },
              { value: 'usdg' },
              { value: 'usdp' },
              { value: 'usdsui' },
              { value: 'phantom_cash' },
            ],
          },
          {
            name: 'transaction_hash',
            type: 'string',
            nullable: true,
            description:
              'The blockchain transaction hash of the crypto payment.',
          },
        ],
      },
    ],
  },
  {
    name: 'presentment_details',
    type: 'object',
    nullable: true,
    description:
      'Information about the currency presentation to the customer, including the displayed currency and amount used for conversion.',
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
    name: 'radar_options',
    type: 'object',
    nullable: true,
    description: 'Options used for fraud/risk assessment, when provided.',
    expandable: true,
    children: [
      {
        name: 'session',
        type: 'string',
        nullable: true,
        description:
          'A session snapshot of browser and device details used for risk assessment.',
      },
    ],
  },
  {
    name: 'receipt_email',
    type: 'string',
    nullable: true,
    description:
      'The email address that the receipt for this charge was sent to.',
  },
  {
    name: 'receipt_number',
    type: 'string',
    nullable: true,
    description:
      'The transaction number that appears on email receipts sent for this charge. This attribute is <code>null</code> until a receipt has been sent.',
  },
  {
    name: 'receipt_url',
    type: 'string',
    nullable: true,
    description: 'URL to view the receipt for this charge, when available.',
  },
  {
    name: 'refunded',
    type: 'boolean',
    description:
      'Whether the charge has been fully refunded. If the charge is only partially refunded, this attribute remains <code>false</code>.',
  },
  {
    name: 'refunds',
    type: 'object',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'A list of refunds that have been applied to the charge.',
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
        description: 'Details about each refund.',
        expandable: true,
        children: [
          {
            name: 'id',
            type: 'string',
            description: 'Unique identifier for the refund.',
          },
          {
            name: 'object',
            type: 'string',
            description:
              "String representing the object's type. Always <code>refund</code>.",
          },
          {
            name: 'amount',
            type: 'integer',
            description: 'Amount refunded, in the smallest currency unit.',
          },
          {
            name: 'balance_transaction',
            type: 'string',
            nullable: true,
            tooltip: EXPAND_TOOLTIP,
            description:
              'Balance transaction that describes the impact on your account balance.',
          },
          {
            name: 'charge',
            type: 'string',
            nullable: true,
            tooltip: EXPAND_TOOLTIP,
            description: "ID of the charge that's refunded.",
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
              'Three-letter currency code, in lowercase. Typically <code>usdc</code>.',
          },
          {
            name: 'description',
            type: 'string',
            nullable: true,
            description: 'An arbitrary string attached to the refund.',
          },
          {
            name: 'destination_details',
            type: 'object',
            nullable: true,
            description: 'Transaction-specific details for the refund.',
            expandable: true,
            children: [
              {
                name: 'type',
                type: 'string',
                description:
                  'The type of refund destination details. For Zoneless, this is typically <code>crypto</code>.',
              },
              {
                name: 'crypto',
                type: 'object',
                nullable: true,
                description: 'Crypto-specific refund details.',
                expandable: true,
                children: [
                  {
                    name: 'reference',
                    type: 'string',
                    nullable: true,
                    description:
                      'The blockchain transaction hash of the refund.',
                  },
                ],
              },
            ],
          },
          {
            name: 'failure_balance_transaction',
            type: 'string',
            nullable: true,
            tooltip: EXPAND_TOOLTIP,
            description:
              'After the refund fails, this balance transaction describes the adjustment that reverses the initial balance transaction.',
          },
          {
            name: 'failure_reason',
            type: 'string',
            nullable: true,
            description:
              'Reason for the refund failure, when available (for example, <code>insufficient_funds</code> or <code>declined</code>).',
          },
          {
            name: 'instructions_email',
            type: 'string',
            nullable: true,
            description:
              'Email address for refund instructions when native refund support is unavailable.',
          },
          {
            name: 'metadata',
            type: 'object',
            nullable: true,
            description: 'Set of key-value pairs attached to the refund.',
          },
          {
            name: 'payment_intent',
            type: 'string',
            nullable: true,
            tooltip: EXPAND_TOOLTIP,
            description: "ID of the PaymentIntent that's refunded.",
          },
          {
            name: 'pending_reason',
            type: 'enum',
            nullable: true,
            description: 'Reason the refund is pending.',
            enumValues: [
              { value: 'processing' },
              { value: 'insufficient_funds' },
              { value: 'charge_pending' },
            ],
          },
          {
            name: 'reason',
            type: 'enum',
            nullable: true,
            description: 'Reason for the refund.',
            enumValues: [
              { value: 'duplicate' },
              { value: 'fraudulent' },
              { value: 'requested_by_customer' },
              { value: 'expired_uncaptured_charge' },
            ],
          },
          {
            name: 'receipt_number',
            type: 'string',
            nullable: true,
            description:
              'Transaction number that appears on email receipts for this refund.',
          },
          {
            name: 'status',
            type: 'enum',
            nullable: true,
            description: 'Status of the refund.',
            enumValues: [
              { value: 'pending' },
              { value: 'requires_action' },
              { value: 'succeeded' },
              { value: 'failed' },
              { value: 'canceled' },
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
    name: 'review',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description: 'ID of the review associated with this charge, if one exists.',
  },
  {
    name: 'shipping',
    type: 'object',
    nullable: true,
    description: 'Shipping information for the charge.',
    expandable: true,
    children: SHIPPING_OBJECT_CHILDREN,
  },
  {
    name: 'source_transfer',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'The transfer ID which created this charge. Only present if the charge came from another Zoneless account.',
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    nullable: true,
    description:
      'Text that appears as the statement descriptor for non-card charges. Retained for API compatibility; Solana USDC transfers do not display bank statement descriptors.',
  },
  {
    name: 'statement_descriptor_suffix',
    type: 'string',
    nullable: true,
    description:
      'Suffix concatenated with the account statement descriptor prefix. Retained for API compatibility.',
  },
  {
    name: 'status',
    type: 'enum',
    description: 'The status of the payment.',
    enumValues: [
      { value: 'succeeded', description: 'The charge succeeded.' },
      {
        value: 'pending',
        description:
          'The charge is authorized but not yet captured, or still processing.',
      },
      { value: 'failed', description: 'The charge failed.' },
    ],
  },
  {
    name: 'transfer',
    type: 'string',
    nullable: true,
    tooltip: EXPAND_TOOLTIP,
    description:
      'ID of the transfer to the destination account (only applicable if the charge was created using destination / transfer data).',
  },
  {
    name: 'transfer_data',
    type: 'object',
    nullable: true,
    description:
      'An optional dictionary including the account to automatically transfer to as part of a destination charge.',
    expandable: true,
    children: [
      {
        name: 'amount',
        type: 'integer',
        nullable: true,
        description:
          'The amount transferred to the destination account, if specified. By default, the entire charge amount is transferred.',
      },
      {
        name: 'destination',
        type: 'string',
        tooltip: EXPAND_TOOLTIP,
        description:
          'ID of an existing connected account to transfer funds to.',
      },
    ],
  },
  {
    name: 'transfer_group',
    type: 'string',
    nullable: true,
    description:
      'A string that identifies this transaction as part of a group.',
  },
];

const CHARGE_MORE_ATTRIBUTES: Attribute[] = [
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

export const CHARGES_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Charge object',
  description:
    'The Charge object represents a single attempt to move money into your Zoneless account. PaymentIntent confirmation is the most common way to create Charges. Some legacy payment flows create Charges directly, which is not recommended for new integrations.',
  stripeDocsUrl: 'https://docs.stripe.com/api/charges',
  endpoints: BuildEndpointSummaries(CHARGES_SUBSECTION, [
    { method: 'POST', path: '/v1/charges', pageId: 'create' },
    { method: 'POST', path: '/v1/charges/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/charges/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/charges', pageId: 'list' },
    { method: 'POST', path: '/v1/charges/:id/capture', pageId: 'capture' },
  ]),
  events: GetResourceEventAttributes('charge'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: 'Charges track a payment attempt settled in USDC. Prefer creating PaymentIntents and confirming them—confirmation creates the Charge used to record the wallet payment.',
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: CHARGE_ATTRIBUTES,
          moreAttributes: CHARGE_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE CHARGE OBJECT',
          code: CHARGE_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create
// ============================================

const CREATE_CHARGE_PARAMETERS: Attribute[] = [
  {
    name: 'amount',
    type: 'integer',
    required: true,
    description:
      'Amount intended to be collected by this payment. A positive integer in the smallest currency unit. For USDC, this is cents (e.g., 100 = $1 USDC). Supports up to eight digits.',
  },
  {
    name: 'currency',
    type: 'string',
    required: true,
    description:
      'Three-letter currency code, in lowercase. For Zoneless, use <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Use <code>usdc</code> instead of fiat currencies.',
  },
  {
    name: 'customer',
    type: 'string',
    description:
      'The ID of an existing customer that will be charged in this request.',
  },
  {
    name: 'description',
    type: 'string',
    description:
      'An arbitrary string which you can attach to a Charge object. It is displayed in the dashboard alongside the charge.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'source',
    type: 'string',
    description:
      'A payment source to be charged, such as a payment method or wallet ID. For new integrations, prefer PaymentIntents with <code>payment_method</code>.',
  },
];

const CREATE_CHARGE_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'application_fee_amount',
    type: 'integer',
    description:
      "A fee in the smallest currency unit that will be applied to the charge and transferred to the application owner's account. The request must be made on behalf of a connected account.",
  },
  {
    name: 'capture',
    type: 'boolean',
    description:
      'Whether to immediately capture the charge. Defaults to <code>true</code>. When <code>false</code>, the charge issues an authorization and must be <a href="#charges-capture">captured</a> later. Uncaptured charges expire after a set number of days (7 by default).',
  },
  {
    name: 'on_behalf_of',
    type: 'string',
    description:
      'The connected account ID for which these funds are intended. Use this to set the business of record without triggering an automatic transfer.',
  },
  {
    name: 'radar_options',
    type: 'object',
    description: 'Options to configure risk assessment.',
    expandable: true,
    children: [
      {
        name: 'session',
        type: 'string',
        description:
          'A session snapshot of browser and device details used for risk assessment.',
      },
    ],
  },
  {
    name: 'receipt_email',
    type: 'string',
    description:
      "The email address to which this charge's receipt will be sent. The receipt is not sent until the charge is paid. Receipts are not sent for test mode charges.",
  },
  {
    name: 'shipping',
    type: 'object',
    description:
      'Shipping information for the charge. Helps prevent fraud on charges for physical goods.',
    expandable: true,
    children: SHIPPING_PARAM_CHILDREN,
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    description:
      'Text that appears as the statement descriptor. Limited to 22 characters. Retained for API compatibility; blockchain transfers do not display bank statement descriptors.',
  },
  {
    name: 'statement_descriptor_suffix',
    type: 'string',
    description:
      'Suffix concatenated with the account statement descriptor prefix. Retained for API compatibility.',
  },
  {
    name: 'transfer_data',
    type: 'object',
    description:
      'An optional dictionary including the account to automatically transfer to as part of a destination charge.',
    expandable: true,
    children: [
      {
        name: 'destination',
        type: 'string',
        required: true,
        description: 'ID of an existing connected account.',
      },
      {
        name: 'amount',
        type: 'integer',
        description:
          'The amount transferred to the destination account, if specified. By default, the entire charge amount is transferred.',
      },
      {
        name: 'description',
        type: 'string',
        description: 'An arbitrary string attached to the transfer.',
      },
    ],
  },
  {
    name: 'transfer_group',
    type: 'string',
    description:
      'A string that identifies this transaction as part of a group.',
  },
];

export const CHARGES_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a charge',
  description:
    'This method is no longer recommended—use the Payment Intents API to initiate a new payment instead. Confirmation of the PaymentIntent creates the Charge object used to request payment.',
  endpoints: [{ method: 'POST', path: '/v1/charges' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'warning',
          title: 'Prefer Payment Intents: ',
          text: 'Creating Charges directly is retained for API compatibility. For new integrations, create and confirm a PaymentIntent so wallet authorization and on-chain settlement are handled correctly.',
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_CHARGE_PARAMETERS,
          moreAttributes: CREATE_CHARGE_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the charge object if the charge succeeded. This call raises an error if something goes wrong—for example, an invalid source or insufficient available balance.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/charges' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/charges \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d amount=2500 \\
  -d currency=usdc \\
  -d source=pm_z_1NqR2xLkdIwHu7ixWallet9 \\
  -d customer=cus_z_NffrFeUfNV2Hib \\
  -d description="Order #4821"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const charge = await zoneless.charges.create({
  amount: 2500,
  currency: 'usdc',
  source: 'pm_z_1NqR2xLkdIwHu7ixWallet9',
  customer: 'cus_z_NffrFeUfNV2Hib',
  description: 'Order #4821',
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: CHARGE_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Update
// ============================================

const UPDATE_CHARGE_PARAMETERS: Attribute[] = [
  {
    name: 'customer',
    type: 'string',
    description:
      'The ID of an existing customer that will be associated with this request. This field may only be updated if there is no existing associated customer with this charge.',
  },
  {
    name: 'description',
    type: 'string',
    description:
      'An arbitrary string which you can attach to a charge object. It is displayed in the dashboard alongside the charge.',
  },
  {
    name: 'fraud_details',
    type: 'object',
    description:
      'A set of key-value pairs you can attach to a charge giving information about its riskiness. If you believe a charge is fraudulent, include a <code>user_report</code> key with a value of <code>fraudulent</code>. If you believe a charge is safe, include a <code>user_report</code> key with a value of <code>safe</code>.',
    expandable: true,
    children: [
      {
        name: 'user_report',
        type: 'string',
        required: true,
        description: 'Either <code>safe</code> or <code>fraudulent</code>.',
        enumValues: [{ value: 'safe' }, { value: 'fraudulent' }],
      },
    ],
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'receipt_email',
    type: 'string',
    description:
      'The email address that the receipt for this charge will be sent to. If this field is updated, a new email receipt is sent to the updated address.',
  },
  {
    name: 'shipping',
    type: 'object',
    description:
      'Shipping information for the charge. Helps prevent fraud on charges for physical goods.',
    expandable: true,
    children: SHIPPING_PARAM_CHILDREN,
  },
  {
    name: 'transfer_group',
    type: 'string',
    description:
      'A string that identifies this transaction as part of a group. <code>transfer_group</code> may only be provided if it has not already been set.',
  },
];

export const CHARGES_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a charge',
  description:
    'Updates the specified charge by setting the values of the parameters passed. Any parameters not provided will be left unchanged.',
  endpoints: [{ method: 'POST', path: '/v1/charges/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_CHARGE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the charge object if the update succeeded. This call raises an error if update parameters are invalid.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/charges/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/charges/ch_z_3NqR2xLkdIwHu7ix8kP4mQ2a \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[shipping]"=express`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const charge = await zoneless.charges.update(
  'ch_z_3NqR2xLkdIwHu7ix8kP4mQ2a',
  {
    metadata: {
      shipping: 'express',
    },
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: CHARGE_UPDATE_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Retrieve
// ============================================

export const CHARGES_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a charge',
  description:
    'Retrieves the details of a charge that has previously been created. Supply the unique charge ID that was returned from your previous request, and Zoneless will return the corresponding charge information. The same information is returned when creating or refunding the charge.',
  endpoints: [{ method: 'GET', path: '/v1/charges/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a charge if a valid identifier was provided, and raises an error otherwise.',
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/charges/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/charges/ch_z_3NqR2xLkdIwHu7ix8kP4mQ2a \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const charge = await zoneless.charges.retrieve(
  'ch_z_3NqR2xLkdIwHu7ix8kP4mQ2a'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: CHARGE_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// List
// ============================================

const LIST_CHARGES_PARAMETERS: Attribute[] = [
  {
    name: 'customer',
    type: 'string',
    description:
      'Only return charges for the customer specified by this customer ID.',
  },
  {
    name: 'payment_intent',
    type: 'string',
    description:
      'Only return charges that were created by the PaymentIntent specified by this PaymentIntent ID.',
  },
  {
    name: 'transfer_group',
    type: 'string',
    description: 'Only return charges for this transfer group, limited to 100.',
  },
];

const LIST_CHARGES_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'created',
    type: 'object',
    description:
      'Only return charges that were created during the given date interval.',
    expandable: true,
    children: TIMESTAMP_RANGE_CHILDREN,
  },
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>ch_z_bar</code>, your subsequent call can include <code>ending_before=ch_z_bar</code> in order to fetch the previous page of the list.',
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
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>ch_z_foo</code>, your subsequent call can include <code>starting_after=ch_z_foo</code> in order to fetch the next page of the list.',
  },
];

export const CHARGES_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all charges',
  description:
    "Returns a list of charges you've previously created. The charges are returned in sorted order, with the most recent charges appearing first.",
  endpoints: [{ method: 'GET', path: '/v1/charges' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_CHARGES_PARAMETERS,
          moreAttributes: LIST_CHARGES_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> charges, starting after charge <code>starting_after</code>. Each entry in the array is a separate <a href="#charges-object">Charge</a> object. If no more charges are available, the resulting array will be empty. If you provide a non-existent customer ID, this call raises an error.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/charges' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/charges \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const charges = await zoneless.charges.list({
  limit: 3,
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: LIST_CHARGES_RESPONSE_JSON },
      ],
    },
  ],
};

// ============================================
// Capture
// ============================================

const CAPTURE_CHARGE_PARAMETERS: Attribute[] = [
  {
    name: 'amount',
    type: 'integer',
    description:
      'The amount to capture, which must be less than or equal to the original amount.',
  },
  {
    name: 'application_fee_amount',
    type: 'integer',
    description:
      'An application fee amount to add on to this charge, which must be less than or equal to the capture amount.',
  },
  {
    name: 'receipt_email',
    type: 'string',
    description:
      "The email address to send this charge's receipt to. This overrides the previously specified email address for this charge, if one was set. Receipts are not sent in test mode.",
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    description:
      'Text that appears as the statement descriptor. Limited to 22 characters. Retained for API compatibility.',
  },
  {
    name: 'statement_descriptor_suffix',
    type: 'string',
    description:
      'Suffix concatenated with the account statement descriptor prefix. Retained for API compatibility.',
  },
  {
    name: 'transfer_data',
    type: 'object',
    description:
      'An optional dictionary including the account to automatically transfer to as part of a destination charge.',
    expandable: true,
    children: [
      {
        name: 'amount',
        type: 'integer',
        description:
          'The amount transferred to the destination account, if specified. By default, the entire charge amount is transferred.',
      },
    ],
  },
  {
    name: 'transfer_group',
    type: 'string',
    description:
      'A string that identifies this transaction as part of a group. <code>transfer_group</code> may only be provided if it has not already been set.',
  },
];

export const CHARGES_CAPTURE_PAGE: DocPage = {
  id: 'capture',
  title: 'Capture a charge',
  description:
    "Capture the payment of an existing, uncaptured charge that was created with the capture option set to false. Uncaptured payments expire a set number of days after they are created (7 by default), after which they are marked as refunded and capture attempts will fail. Don't use this method to capture a PaymentIntent-initiated charge—use Capture a PaymentIntent instead.",
  endpoints: [{ method: 'POST', path: '/v1/charges/:id/capture' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Note: ',
          text: 'For PaymentIntent-initiated charges, capture via the PaymentIntent API rather than this endpoint.',
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CAPTURE_CHARGE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the charge object, with an updated <code>captured</code> property (set to <code>true</code>). Capturing a charge succeeds unless the charge is already refunded, expired, captured, or an invalid capture amount is specified, in which case this method raises an error.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/charges/:id/capture' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/charges/ch_z_3NrW8kLkdIwHu7ix4mH2pL9b/capture \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -X POST`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const charge = await zoneless.charges.capture(
  'ch_z_3NrW8kLkdIwHu7ix4mH2pL9b'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: CHARGE_CAPTURE_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const CHARGES_PAGES: DocPage[] = [
  CHARGES_OVERVIEW_PAGE,
  CHARGES_CREATE_PAGE,
  CHARGES_UPDATE_PAGE,
  CHARGES_RETRIEVE_PAGE,
  CHARGES_LIST_PAGE,
  CHARGES_CAPTURE_PAGE,
];
