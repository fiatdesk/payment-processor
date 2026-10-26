import { DocSubSection, DocPage, Attribute } from './types';
import { GetResourceEventAttributes } from './event-types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const EXTERNAL_WALLETS_SUBSECTION: DocSubSection = {
  id: 'external-wallets',
  title: 'External Wallets',
  children: [
    { id: 'object', title: 'The External Wallet object' },
    { id: 'create', title: 'Create an external wallet' },
    { id: 'update', title: 'Update an external wallet' },
    { id: 'retrieve', title: 'Retrieve an external wallet' },
    { id: 'list', title: 'List all external wallets' },
    { id: 'delete', title: 'Delete an external wallet' },
  ],
};

// ============================================
// Shared Data
// ============================================
const EXTERNAL_WALLET_OBJECT_JSON = `{
  "id": "wa_z_1Nv0FGQ9RKHgCVdK",
  "object": "wallet",
  "account": "acct_z_1Nv0FGQ9RKHgCVdK",
  "account_holder_name": "Tom Jones",
  "account_holder_type": "individual",
  "available_payout_methods": [
    "standard",
    "instant"
  ],
  "country": "US",
  "created": 1704067200,
  "currency": "usdc",
  "customer": null,
  "default_for_currency": true,
  "fingerprint": null,
  "future_requirements": null,
  "last4": "9dKq",
  "metadata": {},
  "network": "solana",
  "platform_account": "acct_z_Platform123abc",
  "requirements": null,
  "status": "new",
  "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsD"
}`;

const EXTERNAL_WALLET_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless external wallet IDs are prefixed with <code>wa_z_</code>.',
  },
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value. Always <code>wallet</code>.",
    enumNote:
      '<strong>Difference from Stripe:</strong> Stripe returns <code>bank_account</code>. Zoneless returns <code>wallet</code> for Solana wallets.',
  },
  {
    name: 'account',
    type: 'string',
    nullable: true,
    description: 'The Zoneless account this wallet belongs to.',
  },
  {
    name: 'account_holder_name',
    type: 'string',
    nullable: true,
    description: 'The name of the person or business that owns the wallet.',
  },
  {
    name: 'account_holder_type',
    type: 'enum',
    nullable: true,
    description: 'The type of entity that holds the wallet.',
    enumValues: [
      { value: 'individual', description: 'A person who owns the wallet.' },
      {
        value: 'company',
        description: 'A business entity that owns the wallet.',
      },
    ],
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
        description: 'Immediate transfer to the wallet. Default for Solana.',
      },
      { value: 'standard', description: 'Standard transfer timing.' },
    ],
    enumNote:
      '<strong>Difference from Stripe:</strong> Solana transactions are inherently fast, so <code>instant</code> is always available.',
  },
  {
    name: 'country',
    type: 'string',
    description:
      'Two-letter ISO code representing the country of the wallet holder.',
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
      'Three-letter currency code representing the currency for payouts. For Zoneless, this is typically <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Stripe uses ISO currency codes like <code>usd</code>. Zoneless uses <code>usdc</code> for USDC stablecoin.',
  },
  {
    name: 'customer',
    type: 'string',
    nullable: true,
    description:
      'The ID of the customer that the wallet is associated with, if applicable.',
  },
  {
    name: 'default_for_currency',
    type: 'boolean',
    nullable: true,
    description:
      'Whether this wallet is the default external account for its currency. When creating a payout without specifying a destination, the default wallet is used.',
  },
  {
    name: 'fingerprint',
    type: 'string',
    nullable: true,
    description:
      'Uniquely identifies this particular wallet. You can use this attribute to check whether two wallets are the same.',
  },
  {
    name: 'future_requirements',
    type: 'object',
    nullable: true,
    description: 'Information about upcoming new requirements for the wallet.',
    expandable: true,
    children: [
      {
        name: 'currently_due',
        type: 'array of strings',
        nullable: true,
        description:
          'Fields that need to be resolved to keep the wallet enabled.',
      },
      {
        name: 'errors',
        type: 'array of objects',
        nullable: true,
        description: 'Details about validation and verification failures.',
      },
      {
        name: 'past_due',
        type: 'array of strings',
        nullable: true,
        description: "Fields that haven't been resolved by the deadline.",
      },
      {
        name: 'pending_verification',
        type: 'array of strings',
        nullable: true,
        description: 'Fields that are being reviewed.',
      },
    ],
  },
  {
    name: 'last4',
    type: 'string',
    description: 'The last four characters of the wallet address.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Stripe shows last 4 digits of bank account. Zoneless shows last 4 characters of the Solana wallet address.',
  },
  {
    name: 'metadata',
    type: 'object',
    nullable: true,
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'network',
    type: 'string',
    description:
      'The blockchain network this wallet is on. Currently always <code>solana</code>.',
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It identifies the blockchain network.",
  },
  {
    name: 'requirements',
    type: 'object',
    nullable: true,
    description:
      'Information about the requirements for the wallet, including what information needs to be collected.',
    expandable: true,
    children: [
      {
        name: 'currently_due',
        type: 'array of strings',
        nullable: true,
        description:
          'Fields that need to be resolved to keep the wallet enabled.',
      },
      {
        name: 'errors',
        type: 'array of objects',
        nullable: true,
        description: 'Details about validation and verification failures.',
        children: [
          { name: 'code', type: 'string', description: 'The error code.' },
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
        name: 'past_due',
        type: 'array of strings',
        nullable: true,
        description: "Fields that haven't been resolved by the deadline.",
      },
      {
        name: 'pending_verification',
        type: 'array of strings',
        nullable: true,
        description: 'Fields that are being reviewed.',
      },
    ],
  },
  {
    name: 'status',
    type: 'enum',
    description: 'The status of the wallet.',
    enumValues: [
      {
        value: 'new',
        description:
          'The wallet has been added but no payouts have been sent yet.',
      },
      {
        value: 'validated',
        description:
          'The wallet address has been validated as a valid Solana address.',
      },
      { value: 'verified', description: 'The wallet has been fully verified.' },
      {
        value: 'verification_failed',
        description:
          'Verification failed. Check <code>requirements.errors</code> for details.',
      },
      {
        value: 'errored',
        description:
          'A payout to this wallet failed. Check recent payouts for details.',
      },
      {
        value: 'archived',
        description:
          'The wallet has been archived and is no longer eligible for payouts.',
      },
    ],
    enumNote:
      "<strong>Difference from Stripe:</strong> Stripe has additional statuses like <code>tokenized_account_number_deactivated</code> which don't apply to crypto wallets.",
  },
  {
    name: 'wallet_address',
    type: 'string',
    description: 'The full Solana wallet address where USDC payouts are sent.',
    enumNote:
      "<strong>Zoneless extension:</strong> This replaces Stripe's <code>account_number</code> and <code>routing_number</code>. Solana addresses are typically 32-44 characters.",
  },
];

const EXTERNAL_WALLET_MORE_ATTRIBUTES: Attribute[] = [
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
// Pages
// ============================================
export const EXTERNAL_WALLETS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The External Wallet object',
  description:
    'External wallets are Solana wallet addresses associated with a connected account for receiving USDC payouts. They are the crypto equivalent of bank accounts in traditional payment systems.',
  stripeDocsUrl: 'https://docs.stripe.com/api/external_accounts',
  endpoints: BuildEndpointSummaries(EXTERNAL_WALLETS_SUBSECTION, [
    {
      method: 'POST',
      path: '/v1/accounts/:id/external_accounts',
      pageId: 'create',
    },
    {
      method: 'POST',
      path: '/v1/accounts/:id/external_accounts/:id',
      pageId: 'update',
    },
    {
      method: 'GET',
      path: '/v1/accounts/:id/external_accounts/:id',
      pageId: 'retrieve',
    },
    {
      method: 'GET',
      path: '/v1/accounts/:id/external_accounts',
      pageId: 'list',
    },
    {
      method: 'DELETE',
      path: '/v1/accounts/:id/external_accounts/:id',
      pageId: 'delete',
    },
  ]),
  events: GetResourceEventAttributes('external_account'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: 'External wallets in Zoneless replace bank accounts in Stripe. Instead of routing numbers and account numbers, you provide a Solana wallet address to receive USDC payouts.',
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: EXTERNAL_WALLET_ATTRIBUTES,
          moreAttributes: EXTERNAL_WALLET_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE EXTERNAL WALLET OBJECT',
          code: EXTERNAL_WALLET_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create External Wallet Parameters
// ============================================
const CREATE_EXTERNAL_WALLET_PARAMETERS: Attribute[] = [
  {
    name: 'wallet_address',
    type: 'string',
    required: true,
    description:
      'The Solana wallet address where USDC payouts will be sent. This must be a valid Solana address (typically 32-44 characters).',
    enumNote:
      "<strong>Difference from Stripe:</strong> Replaces Stripe's <code>external_account</code> object with bank account details. Zoneless only requires the wallet address.",
  },
  {
    name: 'account_holder_name',
    type: 'string',
    description: 'The name of the person or business that owns the wallet.',
  },
  {
    name: 'account_holder_type',
    type: 'enum',
    description: 'The type of entity that holds the wallet.',
    enumValues: [
      { value: 'individual', description: 'A person who owns the wallet.' },
      {
        value: 'company',
        description: 'A business entity that owns the wallet.',
      },
    ],
  },
  {
    name: 'currency',
    type: 'string',
    description: 'Three-letter currency code. Defaults to <code>usdc</code>.',
  },
  {
    name: 'default_for_currency',
    type: 'boolean',
    description:
      'When set to <code>true</code>, or if this is the first external account added in this currency, this wallet becomes the default for that currency.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'network',
    type: 'string',
    description: 'The blockchain network. Defaults to <code>solana</code>.',
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API.",
  },
];

const CREATE_EXTERNAL_WALLET_RESPONSE_JSON = `{
  "id": "wa_z_1Nv0FGQ9RKHgCVdK",
  "object": "wallet",
  "account": "acct_z_1Nv0FGQ9RKHgCVdK",
  "account_holder_name": null,
  "account_holder_type": null,
  "available_payout_methods": [
    "standard",
    "instant"
  ],
  "country": null,
  "created": 1704067200,
  "currency": "usdc",
  "customer": null,
  "default_for_currency": true,
  "fingerprint": null,
  "future_requirements": null,
  "last4": "9dKq",
  "metadata": {},
  "network": "solana",
  "platform_account": "acct_z_Platform123abc",
  "requirements": null,
  "status": "new",
  "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsD"
}`;

export const EXTERNAL_WALLETS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create an external wallet',
  description:
    'Creates a new external wallet for a connected account. The wallet address is screened against sanctions lists before being added.',
  endpoints: [{ method: 'POST', path: '/v1/accounts/:id/external_accounts' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Quick start: ',
          text: "Only <code>wallet_address</code> is required. The wallet becomes the default for USDC payouts if it's the first one added.",
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_EXTERNAL_WALLET_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the <code>External Wallet</code> object if the wallet was created successfully. Returns an error if the wallet address is invalid, already in use, or on a sanctions list.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'POST',
            path: '/v1/accounts/:id/external_accounts',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/accounts/acct_z_1Nv0FGQ9RKHgCVdK/external_accounts \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d wallet_address=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsD`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const externalWallet = await zoneless.accounts.createExternalAccount(
  'acct_z_1Nv0FGQ9RKHgCVdK',
  {
    wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsD',
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: CREATE_EXTERNAL_WALLET_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Update External Wallet Parameters
// ============================================
const UPDATE_EXTERNAL_WALLET_PARAMETERS: Attribute[] = [
  {
    name: 'account_holder_name',
    type: 'string',
    description: 'The name of the person or business that owns the wallet.',
  },
  {
    name: 'account_holder_type',
    type: 'enum',
    description: 'The type of entity that holds the wallet.',
    enumValues: [
      { value: 'individual', description: 'A person who owns the wallet.' },
      {
        value: 'company',
        description: 'A business entity that owns the wallet.',
      },
    ],
  },
  {
    name: 'default_for_currency',
    type: 'boolean',
    description:
      'When set to <code>true</code>, this becomes the default external wallet for its currency.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
];

const UPDATE_EXTERNAL_WALLET_RESPONSE_JSON = `{
  "id": "wa_z_1Nv0FGQ9RKHgCVdK",
  "object": "wallet",
  "account": "acct_z_1Nv0FGQ9RKHgCVdK",
  "account_holder_name": "Tom Jones",
  "account_holder_type": "individual",
  "available_payout_methods": [
    "standard",
    "instant"
  ],
  "country": null,
  "created": 1704067200,
  "currency": "usdc",
  "customer": null,
  "default_for_currency": true,
  "fingerprint": null,
  "future_requirements": null,
  "last4": "9dKq",
  "metadata": {
    "order_id": "6735"
  },
  "network": "solana",
  "platform_account": "acct_z_Platform123abc",
  "requirements": null,
  "status": "new",
  "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsD"
}`;

export const EXTERNAL_WALLETS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update an external wallet',
  description:
    'Updates the metadata, account holder name, account holder type, and default status of an external wallet. The wallet address cannot be changed—delete and create a new wallet instead.',
  endpoints: [
    { method: 'POST', path: '/v1/accounts/:id/external_accounts/:id' },
  ],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_EXTERNAL_WALLET_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the updated <code>External Wallet</code> object if the call succeeds.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'POST',
            path: '/v1/accounts/:id/external_accounts/:id',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/accounts/acct_z_1Nv0FGQ9RKHgCVdK/external_accounts/wa_z_1Nv0FGQ9RKHgCVdK \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d account_holder_name="Tom Jones" \\
  -d "metadata[order_id]"=6735`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const externalWallet = await zoneless.accounts.updateExternalAccount(
  'acct_z_1Nv0FGQ9RKHgCVdK',
  'wa_z_1Nv0FGQ9RKHgCVdK',
  {
    account_holder_name: 'Tom Jones',
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
          code: UPDATE_EXTERNAL_WALLET_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Retrieve External Wallet
// ============================================
export const EXTERNAL_WALLETS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve an external wallet',
  description:
    'Retrieves the details of an existing external wallet. Supply the unique wallet ID and the account ID it belongs to.',
  endpoints: [
    { method: 'GET', path: '/v1/accounts/:id/external_accounts/:id' },
  ],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: "Returns the <code>External Wallet</code> object if a valid identifier was provided. Raises an error if the wallet doesn't exist or doesn't belong to the specified account.",
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'GET',
            path: '/v1/accounts/:id/external_accounts/:id',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/accounts/acct_z_1Nv0FGQ9RKHgCVdK/external_accounts/wa_z_1Nv0FGQ9RKHgCVdK \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const externalWallet = await zoneless.accounts.retrieveExternalAccount(
  'acct_z_1Nv0FGQ9RKHgCVdK',
  'wa_z_1Nv0FGQ9RKHgCVdK'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: EXTERNAL_WALLET_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// List External Wallets Parameters
// ============================================
const LIST_EXTERNAL_WALLETS_PARAMETERS: Attribute[] = [
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>wa_z_bar</code>, your subsequent call can include <code>ending_before=wa_z_bar</code> in order to fetch the previous page of the list.',
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
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>wa_z_foo</code>, your subsequent call can include <code>starting_after=wa_z_foo</code> in order to fetch the next page of the list.',
  },
];

const LIST_EXTERNAL_WALLETS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/accounts/acct_z_1Nv0FGQ9RKHgCVdK/external_accounts",
  "has_more": false,
  "data": [
    {
      "id": "wa_z_1Nv0FGQ9RKHgCVdK",
      "object": "wallet",
      "account": "acct_z_1Nv0FGQ9RKHgCVdK",
      "account_holder_name": "Tom Jones",
      "account_holder_type": "individual",
      "available_payout_methods": [
        "standard",
        "instant"
      ],
      "country": "US",
      "created": 1704067200,
      "currency": "usdc",
      "customer": null,
      "default_for_currency": true,
      "fingerprint": null,
      "future_requirements": null,
      "last4": "9dKq",
      "metadata": {},
      "network": "solana",
      "platform_account": "acct_z_Platform123abc",
      "requirements": null,
      "status": "new",
      "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsD"
    }
  ]
}`;

export const EXTERNAL_WALLETS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all external wallets',
  description:
    'Returns a list of external wallets for a given connected account. The wallets are returned in sorted order, with the most recently created wallets appearing first.',
  endpoints: [{ method: 'GET', path: '/v1/accounts/:id/external_accounts' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_EXTERNAL_WALLETS_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> external wallets. If no wallets are available, the resulting array is empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'GET',
            path: '/v1/accounts/:id/external_accounts',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/accounts/acct_z_1Nv0FGQ9RKHgCVdK/external_accounts \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const externalWallets = await zoneless.accounts.listExternalAccounts(
  'acct_z_1Nv0FGQ9RKHgCVdK',
  {
    limit: 3,
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_EXTERNAL_WALLETS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Delete External Wallet
// ============================================
const DELETE_EXTERNAL_WALLET_RESPONSE_JSON = `{
  "id": "wa_z_1Nv0FGQ9RKHgCVdK",
  "object": "wallet",
  "deleted": true
}`;

export const EXTERNAL_WALLETS_DELETE_PAGE: DocPage = {
  id: 'delete',
  title: 'Delete an external wallet',
  description:
    'Deletes an external wallet from a connected account. Once deleted, the wallet can no longer receive payouts.',
  endpoints: [
    { method: 'DELETE', path: '/v1/accounts/:id/external_accounts/:id' },
  ],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'warning',
          title: 'Default wallet restrictions: ',
          text: "You cannot delete a wallet if it's the default for its currency and it's the only wallet for that currency. Add another wallet and set it as default first.",
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: "Returns an object with a <code>deleted</code> parameter if the deletion succeeds. Returns an error if the wallet doesn't exist or cannot be deleted.",
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'DELETE',
            path: '/v1/accounts/:id/external_accounts/:id',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X DELETE https://api.yourdomain.com/v1/accounts/acct_z_1Nv0FGQ9RKHgCVdK/external_accounts/wa_z_1Nv0FGQ9RKHgCVdK \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const deleted = await zoneless.accounts.deleteExternalAccount(
  'acct_z_1Nv0FGQ9RKHgCVdK',
  'wa_z_1Nv0FGQ9RKHgCVdK'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: DELETE_EXTERNAL_WALLET_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const EXTERNAL_WALLETS_PAGES: DocPage[] = [
  EXTERNAL_WALLETS_OVERVIEW_PAGE,
  EXTERNAL_WALLETS_CREATE_PAGE,
  EXTERNAL_WALLETS_UPDATE_PAGE,
  EXTERNAL_WALLETS_RETRIEVE_PAGE,
  EXTERNAL_WALLETS_LIST_PAGE,
  EXTERNAL_WALLETS_DELETE_PAGE,
];
