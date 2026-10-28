import { DocSubSection, DocPage, Attribute } from './types';
import { GetResourceEventAttributes } from './event-types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const BALANCE_SUBSECTION: DocSubSection = {
  id: 'balance',
  title: 'Balance',
  children: [
    { id: 'object', title: 'The Balance object' },
    { id: 'retrieve', title: 'Retrieve balance' },
    { id: 'details', title: 'Retrieve balance details' },
    {
      id: 'acknowledge-archived-deposit',
      title: 'Acknowledge an archived wallet deposit',
    },
  ],
};

// ============================================
// Shared Data
// ============================================
const BALANCE_OBJECT_JSON = `{
  "object": "balance",
  "available": [
    {
      "amount": 666670,
      "currency": "usdc",
      "source_types": {
        "wallet": 666670
      }
    }
  ],
  "livemode": false,
  "pending": [
    {
      "amount": 61414,
      "currency": "usdc",
      "source_types": {
        "wallet": 61414
      }
    }
  ],
  "platform_account": "acct_fd_Platform123abc"
}`;

// ============================================
// Balance Object Attributes
// ============================================
const BALANCE_ATTRIBUTES: Attribute[] = [
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value.",
  },
  {
    name: 'available',
    type: 'array of objects',
    description:
      'Available funds that you can transfer or pay out. You can find the available balance for each currency in this array.',
    expandable: true,
    children: [
      {
        name: 'amount',
        type: 'integer',
        description:
          'Balance amount in the smallest currency unit. For USDC, this is cents (e.g., 100 = $1 USDC).',
      },
      {
        name: 'currency',
        type: 'string',
        description:
          'Three-letter currency code, in lowercase. For FiatDesk, this is typically <code>usdc</code>.',
        enumNote:
          '<strong>Difference from Stripe:</strong> Uses <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
      },
      {
        name: 'source_types',
        type: 'object',
        nullable: true,
        description:
          'Breakdown of balance by source types. For FiatDesk, funds come from wallet-based USDC transfers.',
        children: [
          {
            name: 'wallet',
            type: 'integer',
            nullable: true,
            description: 'Amount from wallet-based payments (USDC transfers).',
            enumNote:
              "<strong>Difference from Stripe:</strong> FiatDesk uses <code>wallet</code> instead of Stripe's <code>card</code>, <code>bank_account</code>, and <code>fpx</code> source types.",
          },
        ],
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
    name: 'pending',
    type: 'array of objects',
    description:
      "Funds that aren't available in the balance yet. You can find the pending balance for each currency in this array.",
    expandable: true,
    children: [
      {
        name: 'amount',
        type: 'integer',
        description:
          'Balance amount in the smallest currency unit. For USDC, this is cents (e.g., 100 = $1 USDC).',
      },
      {
        name: 'currency',
        type: 'string',
        description:
          'Three-letter currency code, in lowercase. For FiatDesk, this is typically <code>usdc</code>.',
        enumNote:
          '<strong>Difference from Stripe:</strong> Uses <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
      },
      {
        name: 'source_types',
        type: 'object',
        nullable: true,
        description:
          'Breakdown of balance by source types. For FiatDesk, funds come from wallet-based USDC transfers.',
        children: [
          {
            name: 'wallet',
            type: 'integer',
            nullable: true,
            description: 'Amount from wallet-based payments (USDC transfers).',
            enumNote:
              "<strong>Difference from Stripe:</strong> FiatDesk uses <code>wallet</code> instead of Stripe's <code>card</code>, <code>bank_account</code>, and <code>fpx</code> source types.",
          },
        ],
      },
    ],
  },
];

const BALANCE_MORE_ATTRIBUTES: Attribute[] = [
  {
    name: 'platform_account',
    type: 'string',
    description:
      "The platform account that owns this resource. For connected account resources, this is the platform's account ID. For the platform's own resources, this equals the account field (self-referential).",
    enumNote:
      "<strong>FiatDesk extension:</strong> This field is not present in Stripe's API. It enables multi-tenant operation.",
  },
];

// ============================================
// Pages
// ============================================
export const BALANCE_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Balance object',
  description:
    'This is an object representing your FiatDesk balance. You can retrieve it to see the balance currently on your FiatDesk account or a connected account.',
  stripeDocsUrl: 'https://docs.stripe.com/api/balance',
  endpoints: BuildEndpointSummaries(BALANCE_SUBSECTION, [
    { method: 'GET', path: '/v1/balance', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/balance/details', pageId: 'details' },
    {
      method: 'POST',
      path: '/v1/config/archived-deposits/:id/acknowledge',
      pageId: 'acknowledge-archived-deposit',
    },
  ]),
  events: GetResourceEventAttributes('balance'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: "FiatDesk balances are denominated in USDC. The <code>available</code> balance can be paid out to connected accounts' Ethereum wallets immediately, while <code>pending</code> funds are waiting for clearance.",
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: BALANCE_ATTRIBUTES,
          moreAttributes: BALANCE_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE BALANCE OBJECT',
          code: BALANCE_OBJECT_JSON,
        },
      ],
    },
  ],
};

export const BALANCE_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve balance',
  description:
    'Retrieves the current account balance, based on the authentication that was used to make the request.',
  endpoints: [{ method: 'GET', path: '/v1/balance' }],
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'For platforms, you can optionally pass the <code>FiatDesk-Account</code> header to retrieve the balance of a connected account on their behalf.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Balance</code> object for the account that was authenticated in the request, or for the connected account specified via the <code>FiatDesk-Account</code> header.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/balance' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/balance \\
  -H "x-api-key: sk_live_fd_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const balance = await fiatdesk.balance.retrieve();`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: BALANCE_OBJECT_JSON },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 3,
          text: "Retrieving a connected account's balance",
        },
        {
          type: 'paragraph',
          text: 'As a platform, you can retrieve the balance of any connected account by passing the <code>FiatDesk-Account</code> header with the connected account ID.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'On behalf of a connected account',
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/balance \\
  -H "x-api-key: sk_live_fd_YOUR_API_KEY" \\
  -H "FiatDesk-Account: acct_fd_1Nv0FGQ9RKHgCVdK"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const balance = await fiatdesk.balance.retrieve({
  fiatdeskAccount: 'acct_fd_1Nv0FGQ9RKHgCVdK',
});`,
            },
          ],
        },
      ],
    },
  ],
};

// ============================================
// Balance details (FiatDesk extension)
// ============================================
const ARCHIVED_WALLET_DEPOSIT_JSON = `{
  "id": "awd_fd_Q4hT8sLm2VxPn7Rk",
  "object": "archived_wallet_deposit",
  "platform_account": "acct_fd_Platform123abc",
  "wallet_id": "wa_fd_7JkR3mWq9TzLx2Vb",
  "wallet_address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "transaction_hash": "0x5b0e3f1d9c7a2e4b6d8f0a1c3e5b7d9f2a4c6e8b0d1f3a5c7e9b2d4f6a8c0e1b",
  "log_index": 0,
  "amount": 2500,
  "block_number": 21894212,
  "acknowledged": false,
  "created": 1793011200
}`;

const BALANCE_DETAILS_JSON = `{
  "object": "balance_details",
  "wallet_usdc": 1250.5,
  "wallet_native": 0.042,
  "native_currency": "eth",
  "connected_accounts_owed": 84000,
  "platform_available": 41050,
  "platform_pending": 0,
  "wallet_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "archived_wallet_deposits": [
    ${ARCHIVED_WALLET_DEPOSIT_JSON.split('\n').join('\n    ')}
  ]
}`;

const ARCHIVED_WALLET_DEPOSIT_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description: 'Unique identifier for the deposit alert.',
  },
  {
    name: 'object',
    type: 'string',
    description: 'Always <code>archived_wallet_deposit</code>.',
  },
  {
    name: 'wallet_id',
    type: 'string',
    description: 'The external wallet the USDC arrived at.',
  },
  {
    name: 'wallet_address',
    type: 'string',
    description: 'The address of that wallet.',
  },
  {
    name: 'transaction_hash',
    type: 'string',
    description: 'The transaction of the USDC <code>Transfer</code>.',
  },
  {
    name: 'log_index',
    type: 'integer',
    description:
      'The <code>Transfer</code> log within its block. One transaction can carry several transfers.',
  },
  {
    name: 'amount',
    type: 'integer',
    description: 'Amount in cents of USDC (100 = 1 USDC).',
  },
  {
    name: 'block_number',
    type: 'integer',
    description: 'The block that holds the transfer.',
  },
  {
    name: 'acknowledged',
    type: 'boolean',
    description:
      'Whether the alert was dismissed. Only unacknowledged deposits are listed.',
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'When the transfer was detected, measured in seconds since the Unix epoch.',
  },
];

const BALANCE_DETAILS_ATTRIBUTES: Attribute[] = [
  {
    name: 'wallet_usdc',
    type: 'number',
    description:
      'The USDC held by the default platform wallet, in whole USDC (for example <code>1250.5</code>).',
  },
  {
    name: 'wallet_native',
    type: 'number',
    description:
      "The default wallet's balance of the network's native currency, which pays gas for payouts.",
  },
  {
    name: 'native_currency',
    type: 'string',
    description:
      'Currency of <code>wallet_native</code>: <code>eth</code>, or <code>none</code> on the simulated rail.',
  },
  {
    name: 'connected_accounts_owed',
    type: 'integer',
    description:
      'The available and pending balances of all connected accounts together, in cents.',
  },
  {
    name: 'platform_available',
    type: 'integer',
    description: "The platform's own available balance, in cents.",
  },
  {
    name: 'platform_pending',
    type: 'integer',
    description: "The platform's own pending balance, in cents.",
  },
  {
    name: 'wallet_address',
    type: 'string',
    description: 'The default platform wallet, which these balances describe.',
  },
  {
    name: 'archived_wallet_deposits',
    type: 'array of objects',
    description:
      "USDC that arrived at one of the platform's other wallets, not yet acknowledged: an active wallet that is not the default, or a wallet deleted in the last 30 days. It is never added to the balance, because only the default wallet's funds can be paid out. Send it to the default wallet (that transfer is a normal top-up), then acknowledge the alert.",
    expandable: true,
    enumNote:
      "<strong>FiatDesk extension:</strong> This field is not present in Stripe's API.",
    children: ARCHIVED_WALLET_DEPOSIT_ATTRIBUTES,
  },
];

export const BALANCE_DETAILS_PAGE: DocPage = {
  id: 'details',
  title: 'Retrieve balance details',
  description:
    "Retrieves the platform's balance alongside its default wallet's on-chain holdings, what connected accounts are owed, and USDC that arrived at its other wallets.",
  endpoints: [{ method: 'GET', path: '/v1/balance/details' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'FiatDesk extension: ',
          text: "Stripe has no equivalent endpoint. It is available to platforms only, and the dashboard's Home and Balances pages use it.",
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>balance_details</code> object. Returns a <code>400</code> if the platform has no wallet yet.',
          html: true,
        },
        {
          type: 'attributes',
          title: 'The balance details object',
          attributes: BALANCE_DETAILS_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/balance/details' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/balance/details \\
  -H "x-api-key: sk_live_fd_YOUR_API_KEY"`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: BALANCE_DETAILS_JSON },
      ],
    },
  ],
};

export const ACKNOWLEDGE_ARCHIVED_DEPOSIT_PAGE: DocPage = {
  id: 'acknowledge-archived-deposit',
  title: 'Acknowledge an archived wallet deposit',
  description:
    "Dismisses the alert for USDC that arrived at one of the platform's other wallets, once you have sent it to the default wallet.",
  endpoints: [
    {
      method: 'POST',
      path: '/v1/config/archived-deposits/:id/acknowledge',
    },
  ],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'FiatDesk extension: ',
          text: 'Stripe has no equivalent endpoint. It is available to platforms only. Acknowledging only dismisses the alert: the funds count toward the balance once they reach the default wallet and its top-up is detected.',
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the deposit with <code>acknowledged: true</code>. It no longer appears in <code>archived_wallet_deposits</code>. Returns a <code>404</code> for a deposit of another platform.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'POST',
            path: '/v1/config/archived-deposits/:id/acknowledge',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X POST https://api.yourdomain.com/v1/config/archived-deposits/awd_fd_Q4hT8sLm2VxPn7Rk/acknowledge \\
  -H "x-api-key: sk_live_fd_YOUR_API_KEY"`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: ARCHIVED_WALLET_DEPOSIT_JSON.replace(
            '"acknowledged": false',
            '"acknowledged": true'
          ),
        },
      ],
    },
  ],
};

export const BALANCE_PAGES: DocPage[] = [
  BALANCE_OVERVIEW_PAGE,
  BALANCE_RETRIEVE_PAGE,
  BALANCE_DETAILS_PAGE,
  ACKNOWLEDGE_ARCHIVED_DEPOSIT_PAGE,
];
