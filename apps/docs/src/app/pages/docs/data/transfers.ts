import { DocSubSection, DocPage, Attribute } from './types';
import { GetResourceEventAttributes } from './event-types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const TRANSFERS_SUBSECTION: DocSubSection = {
  id: 'transfers',
  title: 'Transfers',
  children: [
    { id: 'object', title: 'The Transfer object' },
    { id: 'create', title: 'Create a transfer' },
    { id: 'update', title: 'Update a transfer' },
    { id: 'retrieve', title: 'Retrieve a transfer' },
    { id: 'list', title: 'List all transfers' },
  ],
};

// ============================================
// Shared Data
// ============================================
const TRANSFER_OBJECT_JSON = `{
  "id": "tr_z_1MiN3gLkdIwHu7ixNCZvFdgA",
  "object": "transfer",
  "amount": 40000,
  "amount_reversed": 0,
  "balance_transaction": "txn_z_1MiN3gLkdIwHu7ixxapQrznl",
  "created": 1678043844,
  "currency": "usdc",
  "description": null,
  "destination": "acct_z_1MTfjCQ9PRzxEwkZ",
  "destination_payment": "py_z_1MiN3gQ9PRzxEwkZWTPGNq9o",
  "livemode": false,
  "metadata": {},
  "platform_account": "acct_z_Platform123abc",
  "reversals": {
    "object": "list",
    "data": [],
    "has_more": false,
    "url": "/v1/transfers/tr_z_1MiN3gLkdIwHu7ixNCZvFdgA/reversals"
  },
  "reversed": false,
  "source_transaction": null,
  "source_type": "wallet",
  "transfer_group": "ORDER_95"
}`;

const TRANSFER_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless transfer IDs are prefixed with <code>tr_z_</code>.',
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
    description: 'Amount in cents to be transferred.',
  },
  {
    name: 'amount_reversed',
    type: 'integer',
    description:
      'Amount in cents reversed (can be less than the amount attribute on the transfer if a partial reversal was issued).',
  },
  {
    name: 'balance_transaction',
    type: 'string',
    nullable: true,
    description:
      'Balance transaction that describes the impact of this transfer on your account balance.',
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Time that this record of the transfer was first created. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'currency',
    type: 'string',
    description:
      'Three-letter ISO currency code, in lowercase. For Zoneless, this is typically <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless uses <code>usdc</code> instead of fiat currencies like <code>usd</code>. The amount is still specified in cents (1/100 of a USDC).',
  },
  {
    name: 'description',
    type: 'string',
    nullable: true,
    description:
      'An arbitrary string attached to the object. Often useful for displaying to users.',
  },
  {
    name: 'destination',
    type: 'string',
    description: 'ID of the connected account the transfer was sent to.',
  },
  {
    name: 'destination_payment',
    type: 'string',
    nullable: true,
    description:
      'The ID of the payment that the destination account received for the transfer.',
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
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'reversals',
    type: 'object',
    description: 'A list of reversals that have been applied to the transfer.',
    enumNote:
      '<strong>Note:</strong> Transfer reversals are not currently implemented in Zoneless. This field is included for API compatibility.',
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
        description: 'Details about each reversal.',
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
    name: 'reversed',
    type: 'boolean',
    description:
      'Whether the transfer has been fully reversed. If the transfer is only partially reversed, this attribute will still be <code>false</code>.',
  },
  {
    name: 'source_transaction',
    type: 'string',
    nullable: true,
    description:
      'ID of the charge that was used to fund the transfer. If null, the transfer was funded from the available balance.',
  },
  {
    name: 'source_type',
    type: 'enum',
    description: 'The source balance this transfer came from.',
    enumValues: [
      {
        value: 'wallet',
        description:
          "Funds from the platform's USDC wallet balance. This is the only functional source type in Zoneless.",
      },
    ],
    enumNote:
      '<strong>Difference from Stripe:</strong> Stripe supports <code>card</code>, <code>bank_account</code>, and <code>fpx</code> source types. Zoneless only uses <code>wallet</code> for USDC transfers. The other values are accepted by the API for migration compatibility but should not be used.',
  },
  {
    name: 'transfer_group',
    type: 'string',
    nullable: true,
    description:
      'A string that identifies this transaction as part of a group. Useful for grouping transfers related to the same order or transaction.',
  },
];

const TRANSFER_MORE_ATTRIBUTES: Attribute[] = [
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
export const TRANSFERS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Transfer object',
  description:
    'A Transfer object is created when you move funds between Zoneless accounts as part of Connect. Transfers allow platforms to send funds to their connected accounts.',
  stripeDocsUrl: 'https://docs.stripe.com/api/transfers',
  endpoints: BuildEndpointSummaries(TRANSFERS_SUBSECTION, [
    { method: 'POST', path: '/v1/transfers', pageId: 'create' },
    { method: 'POST', path: '/v1/transfers/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/transfers/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/transfers', pageId: 'list' },
  ]),
  events: GetResourceEventAttributes('transfer'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: "Transfers move USDC from your platform's balance to a connected account's balance. The connected account can then receive payouts to their Solana wallet.",
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: TRANSFER_ATTRIBUTES,
          moreAttributes: TRANSFER_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE TRANSFER OBJECT',
          code: TRANSFER_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create Transfer Parameters
// ============================================
const CREATE_TRANSFER_PARAMETERS: Attribute[] = [
  {
    name: 'amount',
    type: 'integer',
    required: true,
    description:
      'A positive integer in cents representing how much to transfer.',
  },
  {
    name: 'currency',
    type: 'string',
    required: true,
    description:
      'Three-letter ISO code for currency in lowercase. For Zoneless, use <code>usdc</code>.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Use <code>usdc</code> instead of fiat currencies.',
  },
  {
    name: 'destination',
    type: 'string',
    required: true,
    description:
      'The ID of a connected Zoneless account. The destination account must belong to your platform.',
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
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them.',
  },
];

const CREATE_TRANSFER_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'source_transaction',
    type: 'string',
    description:
      'You can use this parameter to transfer funds from a charge before they are added to your available balance. A pending balance will transfer immediately but the funds will not become available until the original charge becomes available.',
  },
  {
    name: 'source_type',
    type: 'enum',
    description:
      'The source balance to use for this transfer. Defaults to <code>wallet</code> for Zoneless.',
    enumValues: [
      {
        value: 'wallet',
        description: "Use the platform's USDC wallet balance (default).",
      },
    ],
    enumNote:
      '<strong>Difference from Stripe:</strong> Stripe supports <code>card</code>, <code>bank_account</code>, and <code>fpx</code>. Zoneless only uses <code>wallet</code>. The other values are accepted for migration compatibility but should not be used.',
  },
  {
    name: 'transfer_group',
    type: 'string',
    description:
      'A string that identifies this transaction as part of a group. Useful for tracking transfers related to the same order.',
  },
];

export const TRANSFERS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a transfer',
  description:
    'To send funds from your platform account to a connected account, create a new transfer. Your platform balance must have sufficient funds to cover the transfer amount, or you\'ll receive an "Insufficient Funds" error.',
  endpoints: [{ method: 'POST', path: '/v1/transfers' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Before you start: ',
          text: 'Ensure your platform has sufficient USDC balance. You can check your balance using the <a href="#balance-retrieve">Balance API</a>.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_TRANSFER_PARAMETERS,
          moreAttributes: CREATE_TRANSFER_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Transfer</code> object if there were no initial errors with the transfer creation (e.g., insufficient funds).',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/transfers' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/transfers \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d amount=40000 \\
  -d currency=usdc \\
  -d destination=acct_z_1MTfjCQ9PRzxEwkZ \\
  -d transfer_group=ORDER_95`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const transfer = await zoneless.transfers.create({
  amount: 40000,
  currency: 'usdc',
  destination: 'acct_z_1MTfjCQ9PRzxEwkZ',
  transfer_group: 'ORDER_95',
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: TRANSFER_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Update Transfer Parameters
// ============================================
const UPDATE_TRANSFER_PARAMETERS: Attribute[] = [
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
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
];

const TRANSFER_UPDATE_RESPONSE_JSON = `{
  "id": "tr_z_1MiN3gLkdIwHu7ixNCZvFdgA",
  "object": "transfer",
  "amount": 40000,
  "amount_reversed": 0,
  "balance_transaction": "txn_z_1MiN3gLkdIwHu7ixxapQrznl",
  "created": 1678043844,
  "currency": "usdc",
  "description": null,
  "destination": "acct_z_1MTfjCQ9PRzxEwkZ",
  "destination_payment": "py_z_1MiN3gQ9PRzxEwkZWTPGNq9o",
  "livemode": false,
  "metadata": {
    "order_id": "6735"
  },
  "platform_account": "acct_z_Platform123abc",
  "reversals": {
    "object": "list",
    "data": [],
    "has_more": false,
    "url": "/v1/transfers/tr_z_1MiN3gLkdIwHu7ixNCZvFdgA/reversals"
  },
  "reversed": false,
  "source_transaction": null,
  "source_type": "wallet",
  "transfer_group": "ORDER_95"
}`;

export const TRANSFERS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a transfer',
  description:
    'Updates the specified transfer by setting the values of the parameters passed. Any parameters not provided will be left unchanged.',
  endpoints: [{ method: 'POST', path: '/v1/transfers/:id' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Note: ',
          text: 'Only <code>description</code> and <code>metadata</code> can be updated after a transfer is created.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_TRANSFER_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the <code>Transfer</code> object if the update succeeded. This call will raise an error if update parameters are invalid.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/transfers/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/transfers/tr_z_1MiN3gLkdIwHu7ixNCZvFdgA \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[order_id]"=6735`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const transfer = await zoneless.transfers.update(
  'tr_z_1MiN3gLkdIwHu7ixNCZvFdgA',
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
          code: TRANSFER_UPDATE_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Retrieve Transfer
// ============================================
export const TRANSFERS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a transfer',
  description:
    'Retrieves the details of an existing transfer. Supply the unique transfer ID from either a transfer creation request or the transfer list, and Zoneless will return the corresponding transfer information.',
  endpoints: [{ method: 'GET', path: '/v1/transfers/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Transfer</code> object if a valid identifier was provided, and raises an error otherwise.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/transfers/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/transfers/tr_z_1MiN3gLkdIwHu7ixNCZvFdgA \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const transfer = await zoneless.transfers.retrieve(
  'tr_z_1MiN3gLkdIwHu7ixNCZvFdgA'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: TRANSFER_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// List Transfers Parameters
// ============================================
const LIST_TRANSFERS_PARAMETERS: Attribute[] = [
  {
    name: 'destination',
    type: 'string',
    description:
      'Only return transfers for the destination specified by this account ID.',
  },
  {
    name: 'transfer_group',
    type: 'string',
    description: 'Only return transfers with the specified transfer group.',
  },
];

const LIST_TRANSFERS_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'created',
    type: 'object',
    description:
      'Only return transfers that were created during the given date interval.',
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
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>tr_z_bar</code>, your subsequent call can include <code>ending_before=tr_z_bar</code> in order to fetch the previous page of the list.',
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
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>tr_z_foo</code>, your subsequent call can include <code>starting_after=tr_z_foo</code> in order to fetch the next page of the list.',
  },
];

const LIST_TRANSFERS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/transfers",
  "has_more": false,
  "data": [
    {
      "id": "tr_z_1MiN3gLkdIwHu7ixNCZvFdgA",
      "object": "transfer",
      "amount": 40000,
      "amount_reversed": 0,
      "balance_transaction": "txn_z_1MiN3gLkdIwHu7ixxapQrznl",
      "created": 1678043844,
      "currency": "usdc",
      "description": null,
      "destination": "acct_z_1MTfjCQ9PRzxEwkZ",
      "destination_payment": "py_z_1MiN3gQ9PRzxEwkZWTPGNq9o",
      "livemode": false,
      "metadata": {},
      "platform_account": "acct_z_Platform123abc",
      "reversals": {
        "object": "list",
        "data": [],
        "has_more": false,
        "url": "/v1/transfers/tr_z_1MiN3gLkdIwHu7ixNCZvFdgA/reversals"
      },
      "reversed": false,
      "source_transaction": null,
      "source_type": "wallet",
      "transfer_group": "ORDER_95"
    }
  ]
}`;

export const TRANSFERS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all transfers',
  description:
    'Returns a list of existing transfers sent to connected accounts. The transfers are returned in sorted order, with the most recently created transfers appearing first.',
  endpoints: [{ method: 'GET', path: '/v1/transfers' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_TRANSFERS_PARAMETERS,
          moreAttributes: LIST_TRANSFERS_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> transfers, starting after transfer <code>starting_after</code>. Each entry in the array is a separate <a href="#transfers-object">Transfer</a> object. If no more transfers are available, the resulting array will be empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/transfers' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/transfers \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const transfers = await zoneless.transfers.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_TRANSFERS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const TRANSFERS_PAGES: DocPage[] = [
  TRANSFERS_OVERVIEW_PAGE,
  TRANSFERS_CREATE_PAGE,
  TRANSFERS_UPDATE_PAGE,
  TRANSFERS_RETRIEVE_PAGE,
  TRANSFERS_LIST_PAGE,
];
