import { DocSubSection, DocPage, Attribute } from './types';
import { GetResourceEventAttributes } from './event-types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const ACCOUNTS_SUBSECTION: DocSubSection = {
  id: 'accounts',
  title: 'Accounts',
  children: [
    { id: 'object', title: 'The Account object' },
    { id: 'create', title: 'Create an account' },
    { id: 'update', title: 'Update an account' },
    { id: 'retrieve', title: 'Retrieve account' },
    { id: 'list', title: 'List all connected accounts' },
    { id: 'delete', title: 'Delete an account' },
    { id: 'reject', title: 'Reject an account' },
  ],
};

// ============================================
// Shared Data
// ============================================
const ACCOUNT_OBJECT_JSON = `{
  "id": "acct_z_1Nv0FGQ9RKHgCVdK",
  "object": "account",
  "business_profile": {
    "mcc": null,
    "name": null,
    "product_description": null,
    "support_email": null,
    "support_phone": null,
    "support_url": null,
    "url": null
  },
  "business_type": "individual",
  "capabilities": {
    "transfers": "pending",
    "usdc_payouts": "pending"
  },
  "charges_enabled": false,
  "controller": {
    "fees": {
      "payer": "application_express"
    },
    "is_controller": true,
    "losses": {
      "payments": "application"
    },
    "requirement_collection": "zoneless",
    "zoneless_dashboard": {
      "type": "express"
    },
    "type": "application"
  },
  "country": "US",
  "created": 1704067200,
  "default_currency": "usdc",
  "details_submitted": false,
  "email": "seller@example.com",
  "external_accounts": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/accounts/acct_z_1Nv0.../external_accounts"
  },
  "future_requirements": {
    "alternatives": [],
    "current_deadline": null,
    "currently_due": [],
    "disabled_reason": null,
    "errors": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
  "individual": {
    "id": "person_z_1Nv0FGQ9RKHgCVdK",
    "object": "person",
    "account": "acct_z_1Nv0FGQ9RKHgCVdK",
    "address": null,
    "created": 1704067200,
    "dob": null,
    "email": "seller@example.com",
    "first_name": null,
    "future_requirements": null,
    "id_number_provided": false,
    "last_name": null,
    "metadata": {},
    "phone": null,
    "relationship": {
      "representative": true
    },
    "requirements": null,
    "ssn_last_4_provided": false,
    "verification": {
      "additional_document": null,
      "details": null,
      "details_code": null,
      "document": {
        "back": null,
        "details": null,
        "details_code": null,
        "front": null
      },
      "status": "unverified"
    }
  },
  "login_links": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/accounts/acct_z_1Nv0.../login_links"
  },
  "metadata": {},
  "payouts_enabled": false,
  "platform_account": "acct_z_Platform123abc",
  "requirements": {
    "alternatives": [],
    "current_deadline": null,
    "currently_due": [
      "business_profile.mcc",
      "business_profile.url",
      "external_account",
      "individual.first_name",
      "individual.last_name",
      "tos_acceptance.date",
      "tos_acceptance.ip"
    ],
    "disabled_reason": "requirements.past_due",
    "errors": [],
    "eventually_due": [
      "business_profile.mcc",
      "business_profile.url",
      "external_account",
      "individual.first_name",
      "individual.last_name",
      "tos_acceptance.date",
      "tos_acceptance.ip"
    ],
    "past_due": [],
    "pending_verification": []
  },
  "settings": {
    "branding": {
      "icon": null,
      "logo": null,
      "primary_color": null,
      "secondary_color": null
    },
    "dashboard": {
      "display_name": null,
      "timezone": "Etc/UTC"
    },
    "payouts": {
      "debit_negative_balances": true,
      "schedule": {
        "delay_days": 2,
        "interval": "daily"
      },
      "statement_descriptor": null
    }
  },
  "tos_acceptance": {
    "date": null,
    "ip": null,
    "service_agreement": null,
    "user_agent": null
  },
  "type": "express"
}`;

const ACCOUNT_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless account IDs are prefixed with <code>acct_z_</code>.',
  },
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value.",
  },
  {
    name: 'business_profile',
    type: 'object',
    nullable: true,
    description: 'Business information about the account.',
    expandable: true,
    children: [
      {
        name: 'mcc',
        type: 'string',
        nullable: true,
        description:
          'The merchant category code for the account. MCCs classify businesses by type. This field is optional for USDC payout platforms but available for record-keeping or compliance purposes.',
      },
      {
        name: 'name',
        type: 'string',
        nullable: true,
        description: 'The customer-facing business name.',
      },
      {
        name: 'product_description',
        type: 'string',
        nullable: true,
        description:
          "Internal-only description of the product sold or service provided by the business. Useful for the platform's own risk assessment and record-keeping.",
      },
      {
        name: 'support_email',
        type: 'string',
        nullable: true,
        description:
          'A publicly available email address for sending support issues to.',
      },
      {
        name: 'support_phone',
        type: 'string',
        nullable: true,
        description:
          'A publicly available phone number to call with support issues.',
      },
      {
        name: 'support_url',
        type: 'string',
        nullable: true,
        description:
          'A publicly available website for handling support issues.',
      },
      {
        name: 'url',
        type: 'string',
        nullable: true,
        description: "The business's publicly available website.",
      },
    ],
  },
  {
    name: 'business_type',
    type: 'enum',
    nullable: true,
    description:
      'The business type. Most connected accounts are <code>individual</code>.',
    enumValues: [
      {
        value: 'individual',
        description: 'A person selling goods or services.',
      },
      { value: 'company', description: 'A registered business entity.' },
    ],
  },
  {
    name: 'capabilities',
    type: 'object',
    nullable: true,
    description:
      'A hash containing the set of capabilities that was requested for this account and their associated states. Keys are names of capabilities. Values may be <code>active</code>, <code>inactive</code>, or <code>pending</code>.',
    enumNote:
      "<strong>Difference from Stripe:</strong> Zoneless has two capabilities: <code>transfers</code> and <code>usdc_payouts</code>. Stripe's payment method capabilities (card_payments, etc.) are not applicable since Zoneless uses USDC on Solana.",
    expandable: true,
    children: [
      {
        name: 'transfers',
        type: 'enum',
        nullable: true,
        description:
          'The status of the transfers capability, or whether your platform can transfer funds to the account.',
        enumValues: ['active', 'inactive', 'pending'],
      },
      {
        name: 'usdc_payouts',
        type: 'enum',
        nullable: true,
        description:
          'The status of the USDC payouts capability, or whether the account can receive USDC payouts to their Solana wallet.',
        enumValues: ['active', 'inactive', 'pending'],
      },
    ],
  },
  {
    name: 'charges_enabled',
    type: 'boolean',
    description:
      'Whether the account can receive charges/payments. Defaults to <code>false</code> until the account completes onboarding.',
    enumNote:
      '<strong>Difference from Stripe:</strong> In Stripe, this indicates whether the account can process card payments. In Zoneless, this field is retained for API compatibility but is less relevant since Zoneless handles USDC payouts rather than card processing.',
  },
  {
    name: 'controller',
    type: 'object',
    nullable: true,
    description:
      'Configuration for who manages the account. For Express accounts, this is automatically configured.',
    expandable: true,
    children: [
      {
        name: 'is_controller',
        type: 'boolean',
        nullable: true,
        description:
          '<code>true</code> if your platform controls this account.',
      },
      {
        name: 'requirement_collection',
        type: 'enum',
        nullable: true,
        description: 'Who collects onboarding requirements.',
        enumValues: [
          {
            value: 'zoneless',
            description:
              'Requirements are collected via the Zoneless Express dashboard (recommended).',
          },
          {
            value: 'application',
            description: 'Your platform collects requirements via its own UI.',
          },
        ],
      },
      {
        name: 'zoneless_dashboard',
        type: 'object',
        nullable: true,
        description: 'Dashboard access configuration.',
        children: [
          {
            name: 'type',
            type: 'enum',
            description: 'The dashboard this account has access to.',
            enumValues: [
              {
                value: 'express',
                description:
                  'The Express Dashboard (recommended for most accounts).',
              },
              {
                value: 'none',
                description:
                  'No Zoneless dashboard. Platform provides its own UI.',
              },
            ],
          },
        ],
      },
      {
        name: 'type',
        type: 'enum',
        description: 'The controller type.',
        enumValues: [
          {
            value: 'application',
            description: 'Your platform controls the account.',
          },
        ],
      },
    ],
  },
  {
    name: 'country',
    type: 'string',
    description: "The account's country.",
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Time at which the account was connected. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'default_currency',
    type: 'string',
    description:
      'The default currency for the account. For Zoneless accounts, this is always <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Always <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
  },
  {
    name: 'details_submitted',
    type: 'boolean',
    description:
      'Whether account details have been submitted. Accounts with Zoneless Dashboard access, which includes Express accounts, cannot receive payouts before this is true. Accounts where this is false should be directed to an onboarding flow to finish submitting account details.',
  },
  {
    name: 'email',
    type: 'string',
    nullable: true,
    description:
      "An email address associated with the account. It's not used for authentication. This field is available for the platform to use for communication purposes.",
  },
  {
    name: 'external_accounts',
    type: 'object',
    description:
      'External accounts (Solana wallets) currently attached to this account. External accounts are only returned for requests where <code>controller[is_controller]</code> is true.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Contains Solana wallet addresses instead of bank accounts and debit cards. These wallets receive USDC payouts.',
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
        description:
          'The list contains all external wallets that have been attached to the Zoneless account. These are Solana wallet addresses that can receive USDC payouts.',
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
        description:
          'The total number of external accounts attached to the account.',
      },
      {
        name: 'url',
        type: 'string',
        description: 'The URL where this list can be accessed.',
      },
    ],
  },
  {
    name: 'future_requirements',
    type: 'object',
    nullable: true,
    description:
      'Details about the upcoming new requirements for the account, including what information needs to be collected, verified, or reviewed, and by when.',
    expandable: true,
    children: [
      {
        name: 'alternatives',
        type: 'array of objects',
        nullable: true,
        description:
          'Fields that are due and can be resolved by providing the corresponding alternative fields instead.',
      },
      {
        name: 'current_deadline',
        type: 'timestamp',
        nullable: true,
        description:
          'Date on which <code>future_requirements</code> becomes the main <code>requirements</code> hash and <code>future_requirements</code> becomes empty.',
      },
      {
        name: 'currently_due',
        type: 'array of strings',
        nullable: true,
        description:
          'Fields that need to be resolved to keep the account enabled.',
      },
      {
        name: 'disabled_reason',
        type: 'enum',
        nullable: true,
        description:
          'This is typed as an enum for consistency with <code>requirements.disabled_reason</code>.',
      },
      {
        name: 'errors',
        type: 'array of objects',
        nullable: true,
        description:
          'Details about validation and verification failures for <code>due</code> requirements that must be resolved.',
      },
      {
        name: 'eventually_due',
        type: 'array of strings',
        nullable: true,
        description: 'Fields you must collect when all thresholds are reached.',
      },
      {
        name: 'past_due',
        type: 'array of strings',
        nullable: true,
        description:
          "Fields that haven't been resolved by <code>requirements.current_deadline</code>.",
      },
      {
        name: 'pending_verification',
        type: 'array of strings',
        nullable: true,
        description:
          'Fields that are being reviewed, or might become required depending on the results of a review.',
      },
    ],
  },
  {
    name: 'individual',
    type: 'object',
    nullable: true,
    description:
      'Information about the person represented by the account. This property is null unless <code>business_type</code> is set to <code>individual</code>. After you create an Account Link to start Zoneless Onboarding, only a subset of this property is returned for accounts where <code>controller.requirement_collection</code> is <code>zoneless</code>, which includes Express accounts.',
    expandable: true,
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
        description: 'The account the individual is associated with.',
      },
      {
        name: 'email',
        type: 'string',
        nullable: true,
        description: "The individual's email address.",
      },
      {
        name: 'first_name',
        type: 'string',
        nullable: true,
        description: "The individual's first name.",
      },
      {
        name: 'last_name',
        type: 'string',
        nullable: true,
        description: "The individual's last name.",
      },
      {
        name: 'phone',
        type: 'string',
        nullable: true,
        description: "The individual's phone number.",
      },
      {
        name: 'dob',
        type: 'object',
        nullable: true,
        description: "The individual's date of birth.",
        children: [
          {
            name: 'day',
            type: 'integer',
            nullable: true,
            description: 'The day of birth, between 1 and 31.',
          },
          {
            name: 'month',
            type: 'integer',
            nullable: true,
            description: 'The month of birth, between 1 and 12.',
          },
          {
            name: 'year',
            type: 'integer',
            nullable: true,
            description: 'The four-digit year of birth.',
          },
        ],
      },
      {
        name: 'address',
        type: 'object',
        nullable: true,
        description: "The individual's primary address.",
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
            description: 'Address line 1.',
          },
          {
            name: 'line2',
            type: 'string',
            nullable: true,
            description: 'Address line 2.',
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
            description: 'State, county, province, or region.',
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
        name: 'metadata',
        type: 'object',
        description: 'Set of key-value pairs that you can attach to an object.',
      },
    ],
  },
  {
    name: 'login_links',
    type: 'object',
    description:
      'Login links for accessing the Express dashboard. Only returned for Express accounts when <code>controller.is_controller</code> is true.',
    enumNote:
      "<strong>Difference from Stripe:</strong> This is included in the account response for convenience. In Stripe's API, login links must be created separately.",
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
        description: 'The list of login link objects.',
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
        description: 'The total number of login links.',
      },
      {
        name: 'url',
        type: 'string',
        description: 'The URL where this list can be accessed.',
      },
    ],
  },
  {
    name: 'metadata',
    type: 'object',
    nullable: true,
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'payouts_enabled',
    type: 'boolean',
    description: 'Whether the funds in this account can be paid out.',
  },
  {
    name: 'platform_account',
    type: 'string',
    description:
      "The platform account that owns this account. For connected accounts, this is the platform's account ID. For platform accounts, this is self-referential (equals the account's own <code>id</code>).",
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It enables multi-tenant operation where multiple platforms can each have their own connected accounts.",
  },
  {
    name: 'requirements',
    type: 'object',
    nullable: true,
    description:
      'Details about the requirements for the account, including what information needs to be collected, verified, or reviewed, and by when. After a requirement is collected, verified, or reviewed, it is considered resolved. Most requirements can be addressed programmatically, however, some must be completed through a form or challenge using the Zoneless Interface.',
    expandable: true,
    children: [
      {
        name: 'alternatives',
        type: 'array of objects',
        nullable: true,
        description:
          'Fields that are due and can be resolved by providing the corresponding alternative fields instead. Many alternatives can list the same <code>original_fields_due</code>, and any of these alternatives can serve as a pathway for attempting to resolve the fields again.',
        children: [
          {
            name: 'alternative_fields_due',
            type: 'array of strings',
            description:
              'Fields that can be provided to resolve all fields in <code>original_fields_due</code>.',
          },
          {
            name: 'original_fields_due',
            type: 'array of strings',
            description:
              'Fields that are due and can be resolved by providing all fields in <code>alternative_fields_due</code>.',
          },
        ],
      },
      {
        name: 'current_deadline',
        type: 'timestamp',
        nullable: true,
        description:
          'Date by which the fields in <code>currently_due</code> must be collected to keep the account enabled. These fields may disable the account sooner if the next threshold is reached before they are collected.',
      },
      {
        name: 'currently_due',
        type: 'array of strings',
        nullable: true,
        description:
          'Fields that need to be resolved to keep the account enabled. If not resolved by <code>current_deadline</code>, these fields will appear in <code>past_due</code> as well, and the account is disabled.',
      },
      {
        name: 'disabled_reason',
        type: 'string',
        nullable: true,
        description:
          'If the account is disabled, this describes why (e.g., <code>requirements.past_due</code>, <code>rejected.fraud</code>).',
      },
      {
        name: 'errors',
        type: 'array of objects',
        nullable: true,
        description:
          'Details about validation failures that need to be resolved.',
        children: [
          {
            name: 'code',
            type: 'string',
            description:
              'The error code (e.g., <code>information_missing</code>, <code>invalid_value_other</code>).',
          },
          {
            name: 'reason',
            type: 'string',
            description: 'A human-readable description of the error.',
          },
          {
            name: 'requirement',
            type: 'string',
            description: 'The field that needs to be fixed.',
          },
        ],
      },
      {
        name: 'eventually_due',
        type: 'array of strings',
        nullable: true,
        description:
          'Fields you must collect when all thresholds are reached. As they become required, they appear in <code>currently_due</code> as well, and <code>current_deadline</code> becomes set.',
      },
      {
        name: 'past_due',
        type: 'array of strings',
        nullable: true,
        description:
          "Fields that haven't been resolved by <code>current_deadline</code>. These fields need to be resolved to enable the account.",
      },
      {
        name: 'pending_verification',
        type: 'array of strings',
        nullable: true,
        description:
          'Fields that are being reviewed, or might become required depending on the results of a review. If the review fails, these fields can move to <code>eventually_due</code>, <code>currently_due</code>, <code>past_due</code> or <code>alternatives</code>.',
      },
    ],
  },
];

const ACCOUNT_MORE_ATTRIBUTES: Attribute[] = [
  {
    name: 'settings',
    type: 'object',
    nullable: true,
    description:
      'Options for customizing how the account functions within Zoneless.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless settings are simpler since they focus on USDC payouts rather than card payments, invoices, and other Stripe-specific features.',
    children: [
      {
        name: 'branding',
        type: 'object',
        description:
          "Settings used to apply the account's branding to the dashboard and other Zoneless surfaces.",
        children: [
          {
            name: 'icon',
            type: 'string',
            nullable: true,
            description:
              'An icon for the account. Must be square and at least 128px x 128px.',
          },
          {
            name: 'logo',
            type: 'string',
            nullable: true,
            description:
              'A logo for the account that will be used in the dashboard.',
          },
          {
            name: 'primary_color',
            type: 'string',
            nullable: true,
            description:
              'A CSS hex color value representing the primary branding color for this account.',
          },
          {
            name: 'secondary_color',
            type: 'string',
            nullable: true,
            description:
              'A CSS hex color value representing the secondary branding color for this account.',
          },
        ],
      },
      {
        name: 'dashboard',
        type: 'object',
        description:
          'Settings used to configure the account within the Zoneless dashboard.',
        children: [
          {
            name: 'display_name',
            type: 'string',
            nullable: true,
            description:
              'The display name for this account. This is used on the Zoneless Dashboard to differentiate between accounts.',
          },
          {
            name: 'timezone',
            type: 'string',
            nullable: true,
            description:
              'The timezone used in the Zoneless Dashboard for this account. A list of possible time zone values is maintained at the IANA Time Zone Database.',
          },
        ],
      },
      {
        name: 'payouts',
        type: 'object',
        description: "Settings specific to the account's payouts.",
        children: [
          {
            name: 'debit_negative_balances',
            type: 'boolean',
            description:
              'A Boolean indicating whether Zoneless should deduct future payouts to recover negative balances. The default value is <code>false</code> when <code>controller.requirement_collection</code> is <code>application</code>, which includes Custom accounts, otherwise <code>true</code>.',
            enumNote:
              '<strong>Difference from Stripe:</strong> Unlike bank accounts, Zoneless cannot directly debit a connected Solana wallet. Instead, negative balances are recovered by deducting from future payout amounts.',
          },
          {
            name: 'schedule',
            type: 'object',
            description:
              'Details on when funds from transfers are available, and when they are paid out to an external wallet.',
            children: [
              {
                name: 'delay_days',
                type: 'integer',
                description:
                  'The number of days funds are held before being paid out.',
              },
              {
                name: 'interval',
                type: 'enum',
                description: 'How frequently funds will be paid out.',
                enumValues: [
                  {
                    value: 'manual',
                    description: 'Payouts only created via API call.',
                  },
                  'daily',
                  'weekly',
                  'monthly',
                ],
              },
              {
                name: 'monthly_anchor',
                type: 'integer',
                nullable: true,
                description:
                  'The day of the month funds will be paid out. Only shown if <code>interval</code> is monthly. Payouts scheduled between the 29th and 31st of the month are sent on the last day of shorter months.',
              },
              {
                name: 'weekly_anchor',
                type: 'enum',
                nullable: true,
                description:
                  'The day of the week funds will be paid out. Only shown if <code>interval</code> is weekly.',
                enumValues: [
                  'monday',
                  'tuesday',
                  'wednesday',
                  'thursday',
                  'friday',
                  'saturday',
                  'sunday',
                ],
              },
            ],
          },
          {
            name: 'statement_descriptor',
            type: 'string',
            nullable: true,
            description:
              'An internal label for payouts from this account. This is stored for reference purposes but does not appear on blockchain transactions.',
            enumNote:
              '<strong>Difference from Stripe:</strong> Unlike bank transfers, Solana USDC transactions do not display statement descriptors. This field is retained for API compatibility and internal record-keeping.',
          },
        ],
      },
      {
        name: 'terms_url',
        type: 'string',
        nullable: true,
        description:
          "URL to the platform's Terms of Service page. Only present on platform accounts.",
        enumNote:
          "<strong>Zoneless extension:</strong> This field is not present in Stripe's API.",
      },
      {
        name: 'privacy_url',
        type: 'string',
        nullable: true,
        description:
          "URL to the platform's Privacy Policy page. Only present on platform accounts.",
        enumNote:
          "<strong>Zoneless extension:</strong> This field is not present in Stripe's API.",
      },
    ],
  },
  {
    name: 'tos_acceptance',
    type: 'object',
    nullable: true,
    description:
      'Details on the acceptance of the Zoneless Services Agreement by the account representative.',
    children: [
      {
        name: 'date',
        type: 'timestamp',
        nullable: true,
        description:
          'The Unix timestamp marking when the account representative accepted their service agreement.',
      },
      {
        name: 'ip',
        type: 'string',
        nullable: true,
        description:
          'The IP address from which the account representative accepted their service agreement.',
      },
      {
        name: 'service_agreement',
        type: 'enum',
        nullable: true,
        description: "The user's service agreement type.",
        enumValues: [
          {
            value: 'full',
            description: 'The full Zoneless services agreement.',
          },
          {
            value: 'recipient',
            description: 'A limited agreement for recipient-only accounts.',
          },
        ],
      },
      {
        name: 'user_agent',
        type: 'string',
        nullable: true,
        description:
          'The user agent of the browser from which the account representative accepted their service agreement.',
      },
    ],
  },
  {
    name: 'type',
    type: 'enum',
    description:
      'The Zoneless account type. For most platforms, <code>express</code> is recommended.',
    enumValues: [
      {
        value: 'express',
        description:
          'Zoneless-hosted onboarding and dashboard. Recommended for most platforms.',
      },
      {
        value: 'custom',
        description:
          'Platform handles onboarding, Zoneless handles payouts. For advanced use cases.',
      },
    ],
  },
];

// ============================================
// Pages
// ============================================
export const ACCOUNTS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Account object',
  description:
    'This is an object representing a Zoneless account. You can retrieve it to see properties on the account like its current requirements or if the account is enabled to receive transfers and USDC payouts to their Solana wallet.',
  stripeDocsUrl: 'https://docs.stripe.com/api/accounts',
  endpoints: BuildEndpointSummaries(ACCOUNTS_SUBSECTION, [
    { method: 'POST', path: '/v1/accounts', pageId: 'create' },
    { method: 'POST', path: '/v1/accounts/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/accounts/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/accounts', pageId: 'list' },
    { method: 'DELETE', path: '/v1/accounts/:id', pageId: 'delete' },
    { method: 'POST', path: '/v1/accounts/:id/reject', pageId: 'reject' },
  ]),
  events: GetResourceEventAttributes('account'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: 'Zoneless accounts receive USDC payouts to their Solana wallet. Create an account for each seller/recipient on your platform, then send them payouts.',
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: ACCOUNT_ATTRIBUTES,
          moreAttributes: ACCOUNT_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE ACCOUNT OBJECT',
          code: ACCOUNT_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create Account Parameters (alphabetical order matching Stripe)
// ============================================
const CREATE_ACCOUNT_PARAMETERS: Attribute[] = [
  {
    name: 'business_profile',
    type: 'object',
    description: 'Business information about the account.',
    expandable: true,
    children: [
      {
        name: 'mcc',
        type: 'string',
        description:
          'The merchant category code for the account. MCCs classify businesses by type. This field is optional for USDC payout platforms but available for record-keeping or compliance purposes.',
      },
      {
        name: 'name',
        type: 'string',
        description: 'The customer-facing business name.',
      },
      {
        name: 'product_description',
        type: 'string',
        description:
          "Internal-only description of the product sold by, or service provided by, the business. Useful for the platform's own risk assessment and record-keeping.",
      },
      {
        name: 'support_email',
        type: 'string',
        description:
          'A publicly available email address for sending support issues to.',
      },
      {
        name: 'support_phone',
        type: 'string',
        description:
          'A publicly available phone number to call with support issues.',
      },
      {
        name: 'support_url',
        type: 'string',
        description:
          'A publicly available website for handling support issues.',
      },
      {
        name: 'url',
        type: 'string',
        description: "The business's publicly available website.",
      },
    ],
  },
  {
    name: 'business_type',
    type: 'enum',
    description:
      'The business type. Most connected accounts are <code>individual</code>.',
    enumValues: [
      {
        value: 'individual',
        description: 'A person selling goods or services.',
      },
      { value: 'company', description: 'A registered business entity.' },
    ],
  },
  {
    name: 'capabilities',
    type: 'object',
    description:
      'The capabilities requested for this account and their status. Capabilities become <code>active</code> after the account completes onboarding.',
    expandable: true,
    children: [
      {
        name: 'transfers',
        type: 'object',
        description:
          'The transfers capability allows your platform to send transfers to this account.',
        children: [
          {
            name: 'requested',
            type: 'boolean',
            description:
              'Passing <code>true</code> requests the capability for the account, if it is not already requested. A requested capability may not immediately become active. Any requirements to activate the capability are returned in the <code>requirements</code> arrays.',
          },
        ],
      },
      {
        name: 'usdc_payouts',
        type: 'object',
        description:
          'The USDC payouts capability allows the account to receive USDC payouts to their Solana wallet.',
        enumNote:
          "<strong>Zoneless-specific:</strong> This replaces Stripe's various payment method capabilities.",
        children: [
          {
            name: 'requested',
            type: 'boolean',
            description:
              'Passing <code>true</code> requests the capability for the account, if it is not already requested. A requested capability may not immediately become active. Any requirements to activate the capability are returned in the <code>requirements</code> arrays.',
          },
        ],
      },
    ],
  },
  {
    name: 'controller',
    type: 'object',
    description:
      'Configuration for account control. For most Express accounts, you can omit this—sensible defaults are applied.',
    expandable: true,
    children: [
      {
        name: 'losses',
        type: 'object',
        description: 'Negative balance liability configuration.',
        children: [
          {
            name: 'payments',
            type: 'enum',
            description:
              'Who is liable for negative balances. Defaults to <code>application</code> (your platform).',
            enumValues: [
              {
                value: 'application',
                description:
                  'Your platform is liable for negative balances (recommended).',
              },
            ],
          },
        ],
      },
      {
        name: 'zoneless_dashboard',
        type: 'object',
        description: 'Dashboard access configuration.',
        children: [
          {
            name: 'type',
            type: 'enum',
            description:
              'Dashboard access level. Defaults to <code>express</code>.',
            enumValues: [
              {
                value: 'express',
                description: 'The Express Dashboard (recommended).',
              },
              {
                value: 'none',
                description: 'No dashboard. Platform provides its own UI.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'country',
    type: 'string',
    description:
      "The country in which the account holder resides, or in which the business is legally established. This should be an ISO 3166-1 alpha-2 country code. For example, if you are in the United States and the business for which you're creating an account is legally represented in Canada, you would use <code>CA</code> as the country for the account being created.",
  },
  {
    name: 'default_currency',
    type: 'string',
    description:
      'Three-letter ISO currency code representing the default currency for the account. For Zoneless accounts, this is typically <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Defaults to <code>usdc</code> instead of fiat currency codes.',
  },
  {
    name: 'email',
    type: 'string',
    description:
      'The email address of the account holder. This is only to make the account easier to identify to you. The platform controls all communication with connected accounts.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
];

const CREATE_ACCOUNT_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'settings',
    type: 'object',
    description:
      'Options for customizing how the account functions within Zoneless.',
    expandable: true,
    children: [
      {
        name: 'branding',
        type: 'object',
        description:
          "Settings used to apply the account's branding to the dashboard and other Zoneless surfaces.",
        children: [
          {
            name: 'icon',
            type: 'string',
            description:
              'An icon for the account. Must be square and at least 128px x 128px.',
          },
          {
            name: 'logo',
            type: 'string',
            description:
              'A logo for the account that will be used in the dashboard.',
          },
          {
            name: 'primary_color',
            type: 'string',
            description:
              'A CSS hex color value representing the primary branding color for this account (e.g., <code>#663399</code>).',
          },
          {
            name: 'secondary_color',
            type: 'string',
            description:
              'A CSS hex color value representing the secondary branding color for this account.',
          },
        ],
      },
      {
        name: 'dashboard',
        type: 'object',
        description:
          'Settings used to configure the account within the Zoneless dashboard.',
        children: [
          {
            name: 'display_name',
            type: 'string',
            description:
              'The display name for this account. This is used on the Zoneless Dashboard to differentiate between accounts.',
          },
          {
            name: 'timezone',
            type: 'string',
            description:
              'The timezone used in the Zoneless Dashboard for this account. A list of possible time zone values is maintained at the IANA Time Zone Database.',
          },
        ],
      },
      {
        name: 'payouts',
        type: 'object',
        description: "Settings specific to the account's payouts.",
        children: [
          {
            name: 'debit_negative_balances',
            type: 'boolean',
            description:
              'A Boolean indicating whether Zoneless should deduct future payouts to recover negative balances.',
            enumNote:
              '<strong>Difference from Stripe:</strong> Unlike bank accounts, Zoneless cannot directly debit a connected Solana wallet. Instead, negative balances are recovered by deducting from future payout amounts.',
          },
          {
            name: 'schedule',
            type: 'object',
            description:
              'Details on when funds from transfers are available, and when they are paid out to an external wallet.',
            children: [
              {
                name: 'delay_days',
                type: 'string | integer',
                description:
                  'The number of days funds are held before being paid out. May also be set to <code>minimum</code>, representing the lowest available value for the account country. Default is <code>minimum</code>.',
              },
              {
                name: 'interval',
                type: 'string',
                description:
                  'How frequently available funds are paid out. One of: <code>daily</code>, <code>manual</code>, <code>weekly</code>, or <code>monthly</code>. Default is <code>daily</code>.',
              },
              {
                name: 'monthly_anchor',
                type: 'integer',
                description:
                  'The day of the month when available funds are paid out, specified as a number between 1–31. Required and applicable only if <code>interval</code> is <code>monthly</code>.',
              },
              {
                name: 'weekly_anchor',
                type: 'string',
                description:
                  'The day of the week when available funds are paid out, specified as <code>monday</code>, <code>tuesday</code>, etc. Required and applicable only if <code>interval</code> is <code>weekly</code>.',
              },
            ],
          },
          {
            name: 'statement_descriptor',
            type: 'string',
            description:
              'An internal label for payouts from this account. This is stored for reference purposes but does not appear on blockchain transactions.',
            enumNote:
              '<strong>Difference from Stripe:</strong> Unlike bank transfers, Solana USDC transactions do not display statement descriptors. This field is retained for API compatibility and internal record-keeping.',
          },
        ],
      },
      {
        name: 'terms_url',
        type: 'string',
        nullable: true,
        description:
          "URL to the platform's Terms of Service page. Only applicable for platform accounts.",
        enumNote:
          "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It is used to display the platform's terms during connected account onboarding.",
      },
      {
        name: 'privacy_url',
        type: 'string',
        nullable: true,
        description:
          "URL to the platform's Privacy Policy page. Only applicable for platform accounts.",
        enumNote:
          "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It is used to display the platform's privacy policy during connected account onboarding.",
      },
    ],
  },
  {
    name: 'tos_acceptance',
    type: 'object',
    description:
      "Details on the account's acceptance of the Zoneless Services Agreement. This property can only be updated for accounts where <code>controller.requirement_collection</code> is <code>application</code>, which includes Custom accounts. This property defaults to a <code>full</code> service agreement when empty.",
    children: [
      {
        name: 'date',
        type: 'timestamp',
        description:
          'The Unix timestamp marking when the account representative accepted their service agreement. Required if <code>ip</code> or <code>user_agent</code> is provided.',
      },
      {
        name: 'ip',
        type: 'string',
        description:
          'The IP address from which the account representative accepted their service agreement. Required if <code>date</code> or <code>user_agent</code> is provided.',
      },
      {
        name: 'service_agreement',
        type: 'enum',
        description: "The user's service agreement type.",
        enumValues: [
          {
            value: 'full',
            description: 'The full Zoneless services agreement.',
          },
          {
            value: 'recipient',
            description: 'A limited agreement for recipient-only accounts.',
          },
        ],
      },
      {
        name: 'user_agent',
        type: 'string',
        description:
          'The user agent of the browser from which the account representative accepted their service agreement.',
      },
    ],
  },
  {
    name: 'type',
    type: 'enum',
    description:
      'The type of Zoneless account to create. Defaults to <code>express</code> if not specified.',
    enumValues: [
      {
        value: 'express',
        description:
          'Zoneless-hosted onboarding and dashboard. Recommended for most platforms.',
      },
      {
        value: 'custom',
        description:
          'Platform handles onboarding, Zoneless handles payouts. For advanced use cases.',
      },
    ],
  },
];

export const ACCOUNTS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create an account',
  description:
    "With Zoneless, you can create accounts for your users. To do this, you'll first need to register your platform.",
  endpoints: [{ method: 'POST', path: '/v1/accounts' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Quick start: ',
          text: 'For most use cases, you only need to provide <code>country</code> and <code>email</code>. Zoneless will handle the rest via the onboarding flow.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_ACCOUNT_PARAMETERS,
          moreAttributes: CREATE_ACCOUNT_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns an <code>Account</code> object if the call succeeds.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/accounts' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/accounts \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d country=US \\
  --data-urlencode email="tom.jones@example.com" \\
  -d "controller[losses][payments]"=application \\
  -d "controller[zoneless_dashboard][type]"=express`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const account = await zoneless.accounts.create({
  country: 'US',
  email: 'tom.jones@example.com',
  controller: {
    losses: { payments: 'application' },
    zoneless_dashboard: { type: 'express' },
  },
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: ACCOUNT_OBJECT_JSON },
      ],
    },
  ],
};

export const ACCOUNTS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve account',
  description: 'Retrieves the details of an account.',
  endpoints: [{ method: 'GET', path: '/v1/accounts/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns an <code>Account</code> object if the call succeeds. If the account ID does not exist, this call raises an error.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/accounts/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/accounts/acct_z_1Nv0FGQ9RKHgCVdK \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const account = await zoneless.accounts.retrieve('acct_z_1Nv0FGQ9RKHgCVdK');`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: ACCOUNT_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Update Account Parameters (alphabetical order matching Stripe)
// ============================================
const UPDATE_ACCOUNT_PARAMETERS: Attribute[] = [
  {
    name: 'business_profile',
    type: 'object',
    description: 'Business information about the account.',
    expandable: true,
    children: [
      {
        name: 'mcc',
        type: 'string',
        description:
          'The merchant category code for the account. MCCs classify businesses by type (max 4 characters). This field is optional for USDC payout platforms but available for record-keeping or compliance purposes.',
      },
      {
        name: 'name',
        type: 'string',
        description: 'The customer-facing business name.',
      },
      {
        name: 'product_description',
        type: 'string',
        description:
          "Internal-only description of the product sold by, or service provided by, the business. Useful for the platform's own risk assessment and record-keeping.",
      },
      {
        name: 'support_email',
        type: 'string',
        description:
          'A publicly available email address for sending support issues to.',
      },
      {
        name: 'support_phone',
        type: 'string',
        description:
          'A publicly available phone number to call with support issues.',
      },
      {
        name: 'support_url',
        type: 'string',
        description:
          'A publicly available website for handling support issues.',
      },
      {
        name: 'url',
        type: 'string',
        description: "The business's publicly available website.",
      },
    ],
  },
  {
    name: 'business_type',
    type: 'enum',
    description:
      'The business type. Most connected accounts are <code>individual</code>.',
    enumValues: [
      {
        value: 'individual',
        description: 'A person selling goods or services.',
      },
      { value: 'company', description: 'A registered business entity.' },
    ],
  },
  {
    name: 'capabilities',
    type: 'object',
    description:
      'The capabilities requested for this account and their status. Capabilities become <code>active</code> after the account completes onboarding.',
    expandable: true,
    children: [
      {
        name: 'transfers',
        type: 'object',
        description:
          'The transfers capability allows your platform to send transfers to this account.',
        children: [
          {
            name: 'requested',
            type: 'boolean',
            description:
              'Passing <code>true</code> requests the capability for the account, if it is not already requested. A requested capability may not immediately become active. Any requirements to activate the capability are returned in the <code>requirements</code> arrays.',
          },
        ],
      },
      {
        name: 'usdc_payouts',
        type: 'object',
        description:
          'The USDC payouts capability allows the account to receive USDC payouts to their Solana wallet.',
        enumNote:
          "<strong>Zoneless-specific:</strong> This replaces Stripe's various payment method capabilities.",
        children: [
          {
            name: 'requested',
            type: 'boolean',
            description:
              'Passing <code>true</code> requests the capability for the account, if it is not already requested. A requested capability may not immediately become active. Any requirements to activate the capability are returned in the <code>requirements</code> arrays.',
          },
        ],
      },
    ],
  },
  {
    name: 'default_currency',
    type: 'string',
    description:
      'Three-letter ISO currency code representing the default currency for the account. For Zoneless accounts, this is typically <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Defaults to <code>usdc</code> instead of fiat currency codes.',
  },
  {
    name: 'email',
    type: 'string',
    description:
      'The email address of the account holder. This is only to make the account easier to identify to you. The platform controls all communication with connected accounts.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
];

const UPDATE_ACCOUNT_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'settings',
    type: 'object',
    description:
      'Options for customizing how the account functions within Zoneless.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless settings are simpler since they focus on USDC payouts rather than card payments, invoices, and other Stripe-specific features.',
    expandable: true,
    children: [
      {
        name: 'branding',
        type: 'object',
        description:
          "Settings used to apply the account's branding to the dashboard and other Zoneless surfaces.",
        children: [
          {
            name: 'icon',
            type: 'string',
            nullable: true,
            description:
              'An icon for the account. Must be square and at least 128px x 128px.',
          },
          {
            name: 'logo',
            type: 'string',
            nullable: true,
            description:
              'A logo for the account that will be used in the dashboard.',
          },
          {
            name: 'primary_color',
            type: 'string',
            nullable: true,
            description:
              'A CSS hex color value representing the primary branding color for this account (e.g., <code>#663399</code>).',
          },
          {
            name: 'secondary_color',
            type: 'string',
            nullable: true,
            description:
              'A CSS hex color value representing the secondary branding color for this account.',
          },
        ],
      },
      {
        name: 'dashboard',
        type: 'object',
        description:
          'Settings used to configure the account within the Zoneless dashboard.',
        children: [
          {
            name: 'display_name',
            type: 'string',
            nullable: true,
            description:
              'The display name for this account. This is used on the Zoneless Dashboard to differentiate between accounts.',
          },
          {
            name: 'timezone',
            type: 'string',
            nullable: true,
            description:
              'The timezone used in the Zoneless Dashboard for this account. A list of possible time zone values is maintained at the IANA Time Zone Database.',
          },
        ],
      },
      {
        name: 'payouts',
        type: 'object',
        description: "Settings specific to the account's payouts.",
        children: [
          {
            name: 'debit_negative_balances',
            type: 'boolean',
            description:
              'A Boolean indicating whether Zoneless should deduct future payouts to recover negative balances. The default value is <code>false</code> when <code>controller.requirement_collection</code> is <code>application</code>, which includes Custom accounts, otherwise <code>true</code>.',
            enumNote:
              '<strong>Difference from Stripe:</strong> Unlike bank accounts, Zoneless cannot directly debit a connected Solana wallet. Instead, negative balances are recovered by deducting from future payout amounts.',
          },
          {
            name: 'schedule',
            type: 'object',
            description:
              'Details on when funds from transfers are available, and when they are paid out to an external wallet.',
            children: [
              {
                name: 'delay_days',
                type: 'string | integer',
                description:
                  'The number of days funds are held before being paid out. May also be set to <code>minimum</code>, representing the lowest available value for the account country. Default is <code>minimum</code>.',
              },
              {
                name: 'interval',
                type: 'enum',
                description:
                  'How frequently available funds are paid out. One of: <code>daily</code>, <code>manual</code>, <code>weekly</code>, or <code>monthly</code>. Default is <code>daily</code>.',
                enumValues: ['daily', 'manual', 'weekly', 'monthly'],
              },
              {
                name: 'monthly_anchor',
                type: 'integer',
                nullable: true,
                description:
                  'The day of the month when available funds are paid out, specified as a number between 1–31. Payouts scheduled between the 29th and 31st of the month are sent on the last day of shorter months. Required and applicable only if <code>interval</code> is <code>monthly</code>.',
              },
              {
                name: 'weekly_anchor',
                type: 'enum',
                nullable: true,
                description:
                  'The day of the week when available funds are paid out, specified as <code>monday</code>, <code>tuesday</code>, etc. Required and applicable only if <code>interval</code> is <code>weekly</code>.',
                enumValues: [
                  'monday',
                  'tuesday',
                  'wednesday',
                  'thursday',
                  'friday',
                  'saturday',
                  'sunday',
                ],
              },
            ],
          },
          {
            name: 'statement_descriptor',
            type: 'string',
            nullable: true,
            description:
              'An internal label for payouts from this account. This is stored for reference purposes but does not appear on blockchain transactions.',
            enumNote:
              '<strong>Difference from Stripe:</strong> Unlike bank transfers, Solana USDC transactions do not display statement descriptors. This field is retained for API compatibility and internal record-keeping.',
          },
        ],
      },
      {
        name: 'terms_url',
        type: 'string',
        nullable: true,
        description:
          "URL to the platform's Terms of Service page. Only applicable for platform accounts.",
        enumNote:
          "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It is used to display the platform's terms during connected account onboarding.",
      },
      {
        name: 'privacy_url',
        type: 'string',
        nullable: true,
        description:
          "URL to the platform's Privacy Policy page. Only applicable for platform accounts.",
        enumNote:
          "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It is used to display the platform's privacy policy during connected account onboarding.",
      },
    ],
  },
  {
    name: 'tos_acceptance',
    type: 'object',
    description:
      "Details on the account's acceptance of the Zoneless Services Agreement. This property can only be updated for accounts where <code>controller.requirement_collection</code> is <code>application</code>, which includes Custom accounts. This property defaults to a <code>full</code> service agreement when empty.",
    children: [
      {
        name: 'date',
        type: 'timestamp',
        description:
          'The Unix timestamp marking when the account representative accepted their service agreement. Required if <code>ip</code> or <code>user_agent</code> is provided.',
      },
      {
        name: 'ip',
        type: 'string',
        description:
          'The IP address from which the account representative accepted their service agreement. Required if <code>date</code> or <code>user_agent</code> is provided.',
      },
      {
        name: 'service_agreement',
        type: 'enum',
        description: "The user's service agreement type.",
        enumValues: [
          {
            value: 'full',
            description: 'The full Zoneless services agreement.',
          },
          {
            value: 'recipient',
            description: 'A limited agreement for recipient-only accounts.',
          },
        ],
      },
      {
        name: 'user_agent',
        type: 'string',
        description:
          'The user agent of the browser from which the account representative accepted their service agreement.',
      },
    ],
  },
];

const ACCOUNT_UPDATE_RESPONSE_JSON = `{
  "id": "acct_z_1Nv0FGQ9RKHgCVdK",
  "object": "account",
  "business_profile": {
    "mcc": null,
    "name": null,
    "product_description": null,
    "support_email": null,
    "support_phone": null,
    "support_url": null,
    "url": null
  },
  "business_type": "individual",
  "capabilities": {
    "transfers": "pending",
    "usdc_payouts": "pending"
  },
  "charges_enabled": false,
  "controller": {
    "fees": {
      "payer": "application_express"
    },
    "is_controller": true,
    "losses": {
      "payments": "application"
    },
    "requirement_collection": "zoneless",
    "zoneless_dashboard": {
      "type": "express"
    },
    "type": "application"
  },
  "country": "US",
  "created": 1704067200,
  "default_currency": "usdc",
  "details_submitted": false,
  "email": "seller@example.com",
  "external_accounts": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/accounts/acct_z_1Nv0.../external_accounts"
  },
  "future_requirements": {
    "alternatives": [],
    "current_deadline": null,
    "currently_due": [],
    "disabled_reason": null,
    "errors": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
  "individual": {
    "id": "person_z_1Nv0FGQ9RKHgCVdK",
    "object": "person",
    "account": "acct_z_1Nv0FGQ9RKHgCVdK",
    "address": null,
    "created": 1704067200,
    "dob": null,
    "email": "seller@example.com",
    "first_name": null,
    "future_requirements": null,
    "id_number_provided": false,
    "last_name": null,
    "metadata": {},
    "phone": null,
    "relationship": {
      "representative": true
    },
    "requirements": null,
    "ssn_last_4_provided": false,
    "verification": {
      "additional_document": null,
      "details": null,
      "details_code": null,
      "document": {
        "back": null,
        "details": null,
        "details_code": null,
        "front": null
      },
      "status": "unverified"
    }
  },
  "login_links": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/accounts/acct_z_1Nv0.../login_links"
  },
  "metadata": {
    "order_id": "6735"
  },
  "payouts_enabled": false,
  "platform_account": "acct_z_Platform123abc",
  "requirements": {
    "alternatives": [],
    "current_deadline": null,
    "currently_due": [
      "business_profile.mcc",
      "business_profile.url",
      "external_account",
      "individual.first_name",
      "individual.last_name",
      "tos_acceptance.date",
      "tos_acceptance.ip"
    ],
    "disabled_reason": "requirements.past_due",
    "errors": [],
    "eventually_due": [
      "business_profile.mcc",
      "business_profile.url",
      "external_account",
      "individual.first_name",
      "individual.last_name",
      "tos_acceptance.date",
      "tos_acceptance.ip"
    ],
    "past_due": [],
    "pending_verification": []
  },
  "settings": {
    "branding": {
      "icon": null,
      "logo": null,
      "primary_color": null,
      "secondary_color": null
    },
    "dashboard": {
      "display_name": null,
      "timezone": "Etc/UTC"
    },
    "payouts": {
      "debit_negative_balances": true,
      "schedule": {
        "delay_days": 2,
        "interval": "daily"
      },
      "statement_descriptor": null
    }
  },
  "tos_acceptance": {
    "date": null,
    "ip": null,
    "service_agreement": null,
    "user_agent": null
  },
  "type": "express"
}`;

export const ACCOUNTS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update an account',
  description:
    'Updates a connected account by setting the values of the parameters passed. Any parameters not provided are left unchanged.',
  endpoints: [{ method: 'POST', path: '/v1/accounts/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_ACCOUNT_PARAMETERS,
          moreAttributes: UPDATE_ACCOUNT_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns an <code>Account</code> object if the call succeeds. If the account ID does not exist or another issue occurs, this call raises an error. Some validations will not raise an error but will instead populate the <code>requirements.errors</code> array.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/accounts/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/accounts/acct_z_1Nv0FGQ9RKHgCVdK \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[order_id]"=6735`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const account = await zoneless.accounts.update(
  'acct_z_1Nv0FGQ9RKHgCVdK',
  {
    metadata: {
      order_id: '6735',
    },
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: ACCOUNT_UPDATE_RESPONSE_JSON,
        },
      ],
    },
  ],
};

const ACCOUNT_DELETE_RESPONSE_JSON = `{
  "id": "acct_z_1Nv0FGQ9RKHgCVdK",
  "object": "account",
  "deleted": true
}`;

export const ACCOUNTS_DELETE_PAGE: DocPage = {
  id: 'delete',
  title: 'Delete an account',
  description: 'With Zoneless, you can delete accounts you manage.',
  endpoints: [{ method: 'DELETE', path: '/v1/accounts/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns an object with a <code>deleted</code> parameter if the call succeeds. If the account ID does not exist, this call raises an error.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'DELETE', path: '/v1/accounts/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X DELETE https://api.yourdomain.com/v1/accounts/acct_z_1Nv0FGQ9RKHgCVdK \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const deleted = await zoneless.accounts.del('acct_z_1Nv0FGQ9RKHgCVdK');`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: ACCOUNT_DELETE_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// List Accounts Parameters
// ============================================
const LIST_ACCOUNTS_PARAMETERS: Attribute[] = [
  {
    name: 'created',
    type: 'object',
    description:
      'Only return connected accounts that were created during the given date interval.',
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
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>acct_z_bar</code>, your subsequent call can include <code>ending_before=acct_z_bar</code> in order to fetch the previous page of the list.',
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
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>acct_z_foo</code>, your subsequent call can include <code>starting_after=acct_z_foo</code> in order to fetch the next page of the list.',
  },
];

const LIST_ACCOUNTS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/accounts",
  "has_more": false,
  "data": [
    {
      "id": "acct_z_1Nv0FGQ9RKHgCVdK",
      "object": "account",
      "business_profile": {
        "mcc": null,
        "name": null,
        "product_description": null,
        "support_email": null,
        "support_phone": null,
        "support_url": null,
        "url": null
      },
      "business_type": "individual",
      "capabilities": {
        "transfers": "pending",
        "usdc_payouts": "pending"
      },
      "charges_enabled": false,
      "controller": {
        "fees": {
          "payer": "application_express"
        },
        "is_controller": true,
        "losses": {
          "payments": "application"
        },
        "requirement_collection": "zoneless",
        "zoneless_dashboard": {
          "type": "express"
        },
        "type": "application"
      },
      "country": "US",
      "created": 1704067200,
      "default_currency": "usdc",
      "details_submitted": false,
      "email": "seller@example.com",
      "future_requirements": {
        "alternatives": [],
        "current_deadline": null,
        "currently_due": [],
        "disabled_reason": null,
        "errors": [],
        "eventually_due": [],
        "past_due": [],
        "pending_verification": []
      },
      "metadata": {},
      "payouts_enabled": false,
      "platform_account": "acct_z_Platform123abc",
      "requirements": {
        "alternatives": [],
        "current_deadline": null,
        "currently_due": [
          "business_profile.mcc",
          "business_profile.url",
          "external_account",
          "individual.first_name",
          "individual.last_name",
          "tos_acceptance.date",
          "tos_acceptance.ip"
        ],
        "disabled_reason": "requirements.past_due",
        "errors": [],
        "eventually_due": [
          "business_profile.mcc",
          "business_profile.url",
          "external_account",
          "individual.first_name",
          "individual.last_name",
          "tos_acceptance.date",
          "tos_acceptance.ip"
        ],
        "past_due": [],
        "pending_verification": []
      },
      "settings": {
        "branding": {
          "icon": null,
          "logo": null,
          "primary_color": null,
          "secondary_color": null
        },
        "dashboard": {
          "display_name": null,
          "timezone": "Etc/UTC"
        },
        "payouts": {
          "debit_negative_balances": true,
          "schedule": {
            "delay_days": 2,
            "interval": "daily"
          },
          "statement_descriptor": null
        }
      },
      "tos_acceptance": {
        "date": null,
        "ip": null,
        "service_agreement": null,
        "user_agent": null
      },
      "type": "express"
    }
  ]
}`;

export const ACCOUNTS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all connected accounts',
  description:
    'Returns a list of accounts connected to your platform via Zoneless. This endpoint requires a platform API key.',
  endpoints: [{ method: 'GET', path: '/v1/accounts' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No required parameters.' },
        {
          type: 'attributes',
          attributes: [],
          moreAttributes: LIST_ACCOUNTS_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> accounts, starting after account <code>starting_after</code>. Each entry in the array is a separate <a href="#accounts-object">Account</a> object. If no more accounts are available, the resulting array is empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/accounts' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/accounts \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const accounts = await zoneless.accounts.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_ACCOUNTS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Reject Account
// ============================================
const REJECT_ACCOUNT_PARAMETERS: Attribute[] = [
  {
    name: 'reason',
    type: 'enum',
    required: true,
    description:
      'The reason for rejecting the account. This will be stored in <code>requirements.disabled_reason</code> as <code>rejected.{reason}</code>.',
    enumValues: [
      {
        value: 'fraud',
        description: 'The account was rejected due to suspected fraud.',
      },
      {
        value: 'terms_of_service',
        description: 'The account violated the terms of service.',
      },
      {
        value: 'other',
        description: 'The account was rejected for another reason.',
      },
    ],
  },
];

const ACCOUNT_REJECT_RESPONSE_JSON = `{
  "id": "acct_z_1Nv0FGQ9RKHgCVdK",
  "object": "account",
  "business_profile": {
    "mcc": null,
    "name": null,
    "product_description": null,
    "support_email": null,
    "support_phone": null,
    "support_url": null,
    "url": null
  },
  "business_type": "individual",
  "capabilities": {
    "transfers": "inactive",
    "usdc_payouts": "inactive"
  },
  "charges_enabled": false,
  "controller": {
    "fees": {
      "payer": "application_express"
    },
    "is_controller": true,
    "losses": {
      "payments": "application"
    },
    "requirement_collection": "zoneless",
    "zoneless_dashboard": {
      "type": "express"
    },
    "type": "application"
  },
  "country": "US",
  "created": 1704067200,
  "default_currency": "usdc",
  "details_submitted": true,
  "email": "seller@example.com",
  "external_accounts": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/accounts/acct_z_1Nv0.../external_accounts"
  },
  "future_requirements": {
    "alternatives": [],
    "current_deadline": null,
    "currently_due": [],
    "disabled_reason": null,
    "errors": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
  "individual": {
    "id": "person_z_1Nv0FGQ9RKHgCVdK",
    "object": "person",
    "account": "acct_z_1Nv0FGQ9RKHgCVdK",
    "address": null,
    "created": 1704067200,
    "dob": null,
    "email": "seller@example.com",
    "first_name": "Tom",
    "future_requirements": null,
    "id_number_provided": false,
    "last_name": "Jones",
    "metadata": {},
    "phone": null,
    "relationship": {
      "representative": true
    },
    "requirements": null,
    "ssn_last_4_provided": false,
    "verification": {
      "additional_document": null,
      "details": null,
      "details_code": null,
      "document": {
        "back": null,
        "details": null,
        "details_code": null,
        "front": null
      },
      "status": "unverified"
    }
  },
  "login_links": {
    "object": "list",
    "data": [],
    "has_more": false,
    "total_count": 0,
    "url": "/v1/accounts/acct_z_1Nv0.../login_links"
  },
  "metadata": {},
  "payouts_enabled": false,
  "platform_account": "acct_z_Platform123abc",
  "requirements": {
    "alternatives": [],
    "current_deadline": null,
    "currently_due": [],
    "disabled_reason": "rejected.fraud",
    "errors": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
  "settings": {
    "branding": {
      "icon": null,
      "logo": null,
      "primary_color": null,
      "secondary_color": null
    },
    "dashboard": {
      "display_name": null,
      "timezone": "Etc/UTC"
    },
    "payouts": {
      "debit_negative_balances": true,
      "schedule": {
        "delay_days": 2,
        "interval": "daily"
      },
      "statement_descriptor": null
    }
  },
  "tos_acceptance": {
    "date": 1704067200,
    "ip": "192.168.1.1",
    "service_agreement": "full",
    "user_agent": "Mozilla/5.0"
  },
  "type": "express"
}`;

export const ACCOUNTS_REJECT_PAGE: DocPage = {
  id: 'reject',
  title: 'Reject an account',
  description:
    'With Zoneless, you can reject accounts that you have flagged as suspicious. Only accounts where your platform is liable for negative account balances, which includes Custom and Express accounts, can be rejected. Accounts can only be rejected after all balances are zero.',
  endpoints: [{ method: 'POST', path: '/v1/accounts/:id/reject' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: REJECT_ACCOUNT_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns an <code>Account</code> object with <code>payouts_enabled</code> and <code>charges_enabled</code> set to <code>false</code> on success. The <code>requirements.disabled_reason</code> will be set to <code>rejected.{reason}</code> (e.g., <code>rejected.fraud</code>). If the account ID does not exist, this call raises an error.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/accounts/:id/reject' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/accounts/acct_z_1Nv0FGQ9RKHgCVdK/reject \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d reason=fraud`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const account = await zoneless.accounts.reject(
  'acct_z_1Nv0FGQ9RKHgCVdK',
  {
    reason: 'fraud',
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: ACCOUNT_REJECT_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const ACCOUNTS_PAGES: DocPage[] = [
  ACCOUNTS_OVERVIEW_PAGE,
  ACCOUNTS_CREATE_PAGE,
  ACCOUNTS_UPDATE_PAGE,
  ACCOUNTS_RETRIEVE_PAGE,
  ACCOUNTS_LIST_PAGE,
  ACCOUNTS_DELETE_PAGE,
  ACCOUNTS_REJECT_PAGE,
];
