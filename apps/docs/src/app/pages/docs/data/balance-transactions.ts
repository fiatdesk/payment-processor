import { DocSubSection, DocPage, Attribute } from './types';
import { GetResourceEventAttributes } from './event-types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const BALANCE_TRANSACTIONS_SUBSECTION: DocSubSection = {
  id: 'balance-transactions',
  title: 'Balance Transactions',
  children: [
    { id: 'object', title: 'The Balance Transaction object' },
    { id: 'retrieve', title: 'Retrieve a balance transaction' },
    { id: 'list', title: 'List all balance transactions' },
  ],
};

// ============================================
// Shared Data
// ============================================
const BALANCE_TRANSACTION_OBJECT_JSON = `{
  "id": "txn_z_1MiN3gLkdIwHu7ixxapQrznl",
  "object": "balance_transaction",
  "amount": -40000,
  "available_on": 1678043844,
  "balance_type": "payments",
  "created": 1678043844,
  "currency": "usdc",
  "description": null,
  "fee": 0,
  "fee_details": [],
  "net": -40000,
  "platform_account": "acct_z_Platform123abc",
  "reporting_category": "transfer",
  "source": "tr_z_1MiN3gLkdIwHu7ixNCZvFdgA",
  "status": "available",
  "type": "transfer"
}`;

// ============================================
// Balance Transaction Object Attributes
// ============================================
const BALANCE_TRANSACTION_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless balance transaction IDs are prefixed with <code>txn_z_</code>.',
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
      'Gross amount of this transaction (in cents). A positive value represents funds received, and a negative value represents funds sent to another party.',
  },
  {
    name: 'available_on',
    type: 'timestamp',
    description:
      "The date that the transaction's net funds become available in the Zoneless balance.",
  },
  {
    name: 'balance_type',
    type: 'enum',
    description:
      'The balance that this transaction impacts. For most Zoneless transactions, this is <code>payments</code>.',
    enumValues: [
      {
        value: 'payments',
        description: 'Balance Transactions that affect your Payments balance.',
      },
    ],
    enumNote:
      "<strong>Difference from Stripe:</strong> Zoneless only uses the <code>payments</code> balance type. Stripe's <code>issuing</code> and <code>refund_and_dispute_prefunding</code> types are not applicable.",
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
      'Currency code, in lowercase. For Zoneless, this is <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Always <code>usdc</code> instead of fiat currency codes like <code>usd</code>.',
  },
  {
    name: 'description',
    type: 'string',
    nullable: true,
    description:
      'An arbitrary string attached to the object. Often useful for displaying to users.',
  },
  {
    name: 'fee',
    type: 'integer',
    description:
      'Fees (in cents) paid for this transaction. Represented as a positive integer when assessed.',
  },
  {
    name: 'fee_details',
    type: 'array of objects',
    description:
      'Detailed breakdown of fees (in cents) paid for this transaction.',
    expandable: true,
    children: [
      {
        name: 'amount',
        type: 'integer',
        description: 'Amount of the fee, in cents.',
      },
      {
        name: 'application',
        type: 'string',
        nullable: true,
        description: 'ID of the platform application that earned the fee.',
      },
      {
        name: 'currency',
        type: 'string',
        description:
          'Currency code, in lowercase. For Zoneless, this is <code>usdc</code>.',
      },
      {
        name: 'description',
        type: 'string',
        nullable: true,
        description:
          'An arbitrary string attached to the object. Often useful for displaying to users.',
      },
      {
        name: 'type',
        type: 'string',
        description:
          'Type of the fee: <code>application_fee</code>, <code>payment_method_passthrough_fee</code>, <code>platform_fee</code>, or <code>tax</code>.',
      },
    ],
  },
  {
    name: 'net',
    type: 'integer',
    description:
      'Net impact to your Zoneless balance (in cents). A positive value represents incrementing a balance, and a negative value decrementing a balance. You can calculate the net impact of a transaction on a balance by <code>amount</code> - <code>fee</code>.',
  },
  {
    name: 'reporting_category',
    type: 'string',
    description:
      'A category that helps you understand balance transactions from an accounting perspective. Common values include <code>transfer</code>, <code>payout</code>, and <code>topup</code>.',
  },
  {
    name: 'source',
    type: 'string',
    nullable: true,
    description:
      'The ID of the object that this transaction relates to (e.g., a Transfer, Payout, or TopUp).',
  },
  {
    name: 'status',
    type: 'enum',
    description: "The transaction's net funds status in the Zoneless balance.",
    enumValues: [
      { value: 'available', description: 'Funds are available for use.' },
      { value: 'pending', description: 'Funds are not yet available.' },
    ],
  },
  {
    name: 'type',
    type: 'enum',
    description:
      'Transaction type. The most common types for Zoneless are <code>transfer</code>, <code>payout</code>, and <code>topup</code>.',
    enumValues: [
      { value: 'transfer', description: 'Funds transferred to an account.' },
      { value: 'transfer_cancel', description: 'A transfer was canceled.' },
      { value: 'transfer_failure', description: 'A transfer failed.' },
      { value: 'transfer_refund', description: 'A transfer was refunded.' },
      { value: 'payout', description: 'Funds paid out to an external wallet.' },
      { value: 'payout_cancel', description: 'A payout was canceled.' },
      { value: 'payout_failure', description: 'A payout failed.' },
      { value: 'topup', description: 'Funds added to the balance.' },
      { value: 'topup_reversal', description: 'A topup was reversed.' },
      { value: 'application_fee', description: 'Platform fee collected.' },
      {
        value: 'application_fee_refund',
        description: 'Platform fee refunded.',
      },
      { value: 'adjustment', description: 'Manual balance adjustment.' },
    ],
    enumNote:
      "<strong>Difference from Stripe:</strong> Zoneless supports a focused subset of transaction types relevant to USDC payouts. Stripe's issuing, climate, and other product-specific types are not included.",
  },
];

const BALANCE_TRANSACTION_MORE_ATTRIBUTES: Attribute[] = [
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
export const BALANCE_TRANSACTIONS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Balance Transaction object',
  description:
    'Balance transactions represent funds moving through your Zoneless account. Zoneless creates them for every type of transaction that enters or leaves your Zoneless account balance.',
  stripeDocsUrl: 'https://docs.stripe.com/api/balance_transactions',
  endpoints: BuildEndpointSummaries(BALANCE_TRANSACTIONS_SUBSECTION, [
    { method: 'GET', path: '/v1/balance_transactions/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/balance_transactions', pageId: 'list' },
  ]),
  events: GetResourceEventAttributes('balance_transaction'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: 'Balance transactions provide an audit trail of all funds movement. Every transfer, payout, and topup creates a corresponding balance transaction, making it easy to reconcile your USDC balances.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: BALANCE_TRANSACTION_ATTRIBUTES,
          moreAttributes: BALANCE_TRANSACTION_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE BALANCE TRANSACTION OBJECT',
          code: BALANCE_TRANSACTION_OBJECT_JSON,
        },
      ],
    },
  ],
};

export const BALANCE_TRANSACTIONS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a balance transaction',
  description: 'Retrieves the balance transaction with the given ID.',
  endpoints: [{ method: 'GET', path: '/v1/balance_transactions/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a balance transaction if a valid balance transaction ID was provided. Raises an error otherwise.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/balance_transactions/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/balance_transactions/txn_z_1MiN3gLkdIwHu7ixxapQrznl \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const balanceTransaction = await zoneless.balanceTransactions.retrieve(
  'txn_z_1MiN3gLkdIwHu7ixxapQrznl'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: BALANCE_TRANSACTION_OBJECT_JSON,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 3,
          text: "Retrieving a connected account's balance transaction",
        },
        {
          type: 'paragraph',
          text: 'As a platform, you can retrieve balance transactions for any of your connected accounts. The platform must have created the connected account.',
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
              code: `curl https://api.yourdomain.com/v1/balance_transactions/txn_z_1MiN3gLkdIwHu7ixxapQrznl \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -H "Zoneless-Account: acct_z_1Nv0FGQ9RKHgCVdK"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const balanceTransaction = await zoneless.balanceTransactions.retrieve(
  'txn_z_1MiN3gLkdIwHu7ixxapQrznl',
  {
    zonelessAccount: 'acct_z_1Nv0FGQ9RKHgCVdK',
  }
);`,
            },
          ],
        },
      ],
    },
  ],
};

// ============================================
// List Balance Transactions Parameters
// ============================================
const LIST_BALANCE_TRANSACTIONS_PARAMETERS: Attribute[] = [
  {
    name: 'created',
    type: 'object',
    description:
      'Only return transactions that were created during the given date interval.',
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
    name: 'currency',
    type: 'string',
    description:
      'Only return transactions in a certain currency. For Zoneless, use <code>usdc</code>.',
  },
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>txn_z_bar</code>, your subsequent call can include <code>ending_before=txn_z_bar</code> in order to fetch the previous page of the list.',
  },
  {
    name: 'limit',
    type: 'integer',
    description:
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
  },
  {
    name: 'payout',
    type: 'string',
    description:
      'Only returns transactions that were paid out on the specified payout ID.',
  },
  {
    name: 'source',
    type: 'string',
    description:
      'Only returns transactions associated with the given source object (e.g., a Transfer or Payout ID).',
  },
  {
    name: 'starting_after',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>txn_z_foo</code>, your subsequent call can include <code>starting_after=txn_z_foo</code> in order to fetch the next page of the list.',
  },
  {
    name: 'type',
    type: 'string',
    description:
      'Only returns transactions of the given type. One of: <code>adjustment</code>, <code>application_fee</code>, <code>application_fee_refund</code>, <code>payout</code>, <code>payout_cancel</code>, <code>payout_failure</code>, <code>topup</code>, <code>topup_reversal</code>, <code>transfer</code>, <code>transfer_cancel</code>, <code>transfer_failure</code>, or <code>transfer_refund</code>.',
  },
];

const LIST_BALANCE_TRANSACTIONS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/balance_transactions",
  "has_more": false,
  "data": [
    {
      "id": "txn_z_1MiN3gLkdIwHu7ixxapQrznl",
      "object": "balance_transaction",
      "amount": -40000,
      "available_on": 1678043844,
      "balance_type": "payments",
      "created": 1678043844,
      "currency": "usdc",
      "description": null,
      "fee": 0,
      "fee_details": [],
      "net": -40000,
      "platform_account": "acct_z_Platform123abc",
      "reporting_category": "transfer",
      "source": "tr_z_1MiN3gLkdIwHu7ixNCZvFdgA",
      "status": "available",
      "type": "transfer"
    }
  ]
}`;

export const BALANCE_TRANSACTIONS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all balance transactions',
  description:
    'Returns a list of transactions that have contributed to the Zoneless account balance (e.g., transfers, payouts, topups). The transactions are returned in sorted order, with the most recent transactions appearing first.',
  endpoints: [{ method: 'GET', path: '/v1/balance_transactions' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No required parameters.' },
        {
          type: 'attributes',
          attributes: [],
          moreAttributes: LIST_BALANCE_TRANSACTIONS_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> transactions, starting after transaction <code>starting_after</code>. Each entry in the array is a separate balance transaction object. If no more transactions are available, the resulting array will be empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/balance_transactions' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/balance_transactions \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const balanceTransactions = await zoneless.balanceTransactions.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_BALANCE_TRANSACTIONS_RESPONSE_JSON,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 3, text: 'Filtering by type' },
        {
          type: 'paragraph',
          text: 'You can filter balance transactions by type to see only specific kinds of transactions, such as all transfers or all payouts.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Filter by transaction type',
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/balance_transactions \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d type=transfer \\
  -d limit=10`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const transfers = await zoneless.balanceTransactions.list({
  type: 'transfer',
  limit: 10,
});`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 3, text: 'Filtering by date range' },
        {
          type: 'paragraph',
          text: 'Use the <code>created</code> parameter to filter transactions by their creation date. This is useful for generating reports or reconciling balances for a specific time period.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Filter by date range',
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/balance_transactions \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "created[gte]"=1609459200 \\
  -d "created[lt]"=1612137600`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const transactions = await zoneless.balanceTransactions.list({
  created: {
    gte: 1704067200, // Jan 1, 2024
    lt: 1706745600,  // Feb 1, 2024
  },
});`,
            },
          ],
        },
      ],
    },
  ],
};

export const BALANCE_TRANSACTIONS_PAGES: DocPage[] = [
  BALANCE_TRANSACTIONS_OVERVIEW_PAGE,
  BALANCE_TRANSACTIONS_RETRIEVE_PAGE,
  BALANCE_TRANSACTIONS_LIST_PAGE,
];
