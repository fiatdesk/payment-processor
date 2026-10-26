import { DocSubSection, DocPage, Attribute } from './types';
import { GetResourceEventAttributes } from './event-types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const BALANCE_SUBSECTION: DocSubSection = {
  id: 'balance',
  title: 'Balance',
  children: [
    { id: 'object', title: 'The Balance object' },
    { id: 'retrieve', title: 'Retrieve balance' },
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
  "platform_account": "acct_z_Platform123abc"
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
          'Three-letter currency code, in lowercase. For Zoneless, this is typically <code>usdc</code>.',
        enumNote:
          '<strong>Difference from Stripe:</strong> Uses <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
      },
      {
        name: 'source_types',
        type: 'object',
        nullable: true,
        description:
          'Breakdown of balance by source types. For Zoneless, funds come from wallet-based USDC transfers.',
        children: [
          {
            name: 'wallet',
            type: 'integer',
            nullable: true,
            description: 'Amount from wallet-based payments (USDC transfers).',
            enumNote:
              "<strong>Difference from Stripe:</strong> Zoneless uses <code>wallet</code> instead of Stripe's <code>card</code>, <code>bank_account</code>, and <code>fpx</code> source types.",
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
          'Three-letter currency code, in lowercase. For Zoneless, this is typically <code>usdc</code>.',
        enumNote:
          '<strong>Difference from Stripe:</strong> Uses <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
      },
      {
        name: 'source_types',
        type: 'object',
        nullable: true,
        description:
          'Breakdown of balance by source types. For Zoneless, funds come from wallet-based USDC transfers.',
        children: [
          {
            name: 'wallet',
            type: 'integer',
            nullable: true,
            description: 'Amount from wallet-based payments (USDC transfers).',
            enumNote:
              "<strong>Difference from Stripe:</strong> Zoneless uses <code>wallet</code> instead of Stripe's <code>card</code>, <code>bank_account</code>, and <code>fpx</code> source types.",
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
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It enables multi-tenant operation.",
  },
];

// ============================================
// Pages
// ============================================
export const BALANCE_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Balance object',
  description:
    'This is an object representing your Zoneless balance. You can retrieve it to see the balance currently on your Zoneless account or a connected account.',
  stripeDocsUrl: 'https://docs.stripe.com/api/balance',
  endpoints: BuildEndpointSummaries(BALANCE_SUBSECTION, [
    { method: 'GET', path: '/v1/balance', pageId: 'retrieve' },
  ]),
  events: GetResourceEventAttributes('balance'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: "Zoneless balances are denominated in USDC. The <code>available</code> balance can be paid out to connected accounts' Solana wallets immediately, while <code>pending</code> funds are waiting for clearance.",
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
          text: 'For platforms, you can optionally pass the <code>Zoneless-Account</code> header to retrieve the balance of a connected account on their behalf.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Balance</code> object for the account that was authenticated in the request, or for the connected account specified via the <code>Zoneless-Account</code> header.',
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
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const balance = await zoneless.balance.retrieve();`,
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
          text: 'As a platform, you can retrieve the balance of any connected account by passing the <code>Zoneless-Account</code> header with the connected account ID.',
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
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -H "Zoneless-Account: acct_z_1Nv0FGQ9RKHgCVdK"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const balance = await zoneless.balance.retrieve({
  zonelessAccount: 'acct_z_1Nv0FGQ9RKHgCVdK',
});`,
            },
          ],
        },
      ],
    },
  ],
};

export const BALANCE_PAGES: DocPage[] = [
  BALANCE_OVERVIEW_PAGE,
  BALANCE_RETRIEVE_PAGE,
];
