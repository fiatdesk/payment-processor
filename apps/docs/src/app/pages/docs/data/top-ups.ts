import { DocSubSection, DocPage, Attribute } from './types';
import { GetResourceEventAttributes } from './event-types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const TOPUPS_SUBSECTION: DocSubSection = {
  id: 'topups',
  title: 'Top-ups',
  children: [
    { id: 'object', title: 'The Top-up object' },
    { id: 'create', title: 'Create a top-up' },
    { id: 'update', title: 'Update a top-up' },
    { id: 'retrieve', title: 'Retrieve a top-up' },
    { id: 'list', title: 'List all top-ups' },
    { id: 'cancel', title: 'Cancel a top-up' },
    { id: 'check-deposits', title: 'Check for deposits' },
  ],
};

// ============================================
// Shared Data
// ============================================
const TOPUP_OBJECT_JSON = `{
  "id": "tu_z_1NG6yj2eZvKYlo2C1FOBiHya",
  "object": "topup",
  "amount": 200000,
  "balance_transaction": "txn_z_1NG6yjLkdIwHu7ixNCZvFdgB",
  "created": 1704067200,
  "currency": "usdc",
  "description": "Deposit from 8xK2Nv3F...",
  "expected_availability_date": 1704067200,
  "failure_code": null,
  "failure_message": null,
  "livemode": false,
  "metadata": {
    "blockchain_tx": "5xK9...abc123",
    "network": "solana",
    "sender_address": "8xK2Nv3F..."
  },
  "platform_account": "acct_z_Platform123abc",
  "source": {
    "id": "src_z_1NG6yjLkdIwHu7ixNCZvFdgC",
    "object": "source",
    "type": "crypto_deposit",
    "metadata": {}
  },
  "statement_descriptor": null,
  "status": "succeeded",
  "transfer_group": null,
  "account": "acct_z_Platform123abc",
  "arrival_date": 1704067200
}`;

const TOPUP_PENDING_JSON = `{
  "id": "tu_z_1NG6yj2eZvKYlo2C1FOBiHya",
  "object": "topup",
  "amount": 200000,
  "balance_transaction": null,
  "created": 1704067200,
  "currency": "usdc",
  "description": "Platform balance top-up",
  "expected_availability_date": 1704067200,
  "failure_code": null,
  "failure_message": null,
  "livemode": false,
  "metadata": {},
  "platform_account": "acct_z_Platform123abc",
  "source": null,
  "statement_descriptor": null,
  "status": "pending",
  "transfer_group": null,
  "account": "acct_z_Platform123abc",
  "arrival_date": null
}`;

// ============================================
// Top-up Object Attributes
// ============================================
const TOPUP_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless top-up IDs are prefixed with <code>tu_z_</code>.',
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
      'Amount transferred in the smallest currency unit. For USDC, this is cents (e.g., 100 = $1 USDC).',
  },
  {
    name: 'balance_transaction',
    type: 'string',
    nullable: true,
    description:
      'ID of the balance transaction that describes the impact of this top-up on your account balance. May not be specified depending on status of top-up.',
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
    name: 'description',
    type: 'string',
    nullable: true,
    description:
      'An arbitrary string attached to the object. Often useful for displaying to users.',
  },
  {
    name: 'expected_availability_date',
    type: 'timestamp',
    nullable: true,
    description:
      'Date the funds are expected to arrive in your Zoneless account. May not be specified depending on status of top-up.',
    enumNote:
      '<strong>Difference from Stripe:</strong> USDC deposits on Solana are typically available immediately after blockchain confirmation, unlike traditional bank transfers.',
  },
  {
    name: 'failure_code',
    type: 'string',
    nullable: true,
    description:
      'Error code explaining reason for top-up failure if available.',
  },
  {
    name: 'failure_message',
    type: 'string',
    nullable: true,
    description:
      'Message to user further explaining reason for top-up failure if available.',
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
      'Set of key-value pairs that you can attach to an object. For blockchain deposits, this automatically includes <code>blockchain_tx</code>, <code>network</code>, and <code>sender_address</code>.',
  },
  {
    name: 'source',
    type: 'object',
    nullable: true,
    description: 'Information about the funding source for this top-up.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Zoneless uses a simplified source object with type <code>crypto_deposit</code> for blockchain deposits.',
    expandable: true,
    children: [
      {
        name: 'id',
        type: 'string',
        description: 'Unique identifier for the source.',
      },
      {
        name: 'object',
        type: 'string',
        description:
          "String representing the object's type. Always <code>source</code>.",
      },
      {
        name: 'type',
        type: 'string',
        description:
          'The type of source. For Zoneless, this is <code>crypto_deposit</code>.',
      },
      {
        name: 'metadata',
        type: 'object',
        nullable: true,
        description: 'Additional metadata about the source.',
      },
    ],
  },
  {
    name: 'statement_descriptor',
    type: 'string',
    nullable: true,
    description:
      'Extra information about a top-up. Limited to 15 ASCII characters.',
    enumNote:
      '<strong>Difference from Stripe:</strong> Unlike bank transfers, Solana USDC transactions do not display statement descriptors. This field is retained for API compatibility.',
  },
  {
    name: 'status',
    type: 'enum',
    description: 'The status of the top-up.',
    enumValues: [
      {
        value: 'canceled',
        description: 'The top-up was canceled before funds arrived.',
      },
      { value: 'failed', description: 'The top-up failed to process.' },
      {
        value: 'pending',
        description: 'The top-up is waiting for funds to arrive.',
      },
      { value: 'reversed', description: 'The top-up was reversed.' },
      {
        value: 'succeeded',
        description: 'Funds have arrived and are available.',
      },
    ],
  },
  {
    name: 'transfer_group',
    type: 'string',
    nullable: true,
    description: 'A string that identifies this top-up as part of a group.',
  },
];

const TOPUP_MORE_ATTRIBUTES: Attribute[] = [
  {
    name: 'account',
    type: 'string',
    description: 'The platform account this top-up belongs to.',
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API. It identifies which platform account the funds were deposited to.",
  },
  {
    name: 'arrival_date',
    type: 'timestamp',
    nullable: true,
    description:
      'Unix timestamp in seconds when funds actually arrived. <code>null</code> if the top-up is still pending.',
    enumNote:
      "<strong>Zoneless extension:</strong> This field is not present in Stripe's API.",
  },
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
export const TOPUPS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Top-up object',
  description:
    "To top up your Zoneless balance in live mode, send USDC to your platform's Solana wallet. Once the funds are detected, a top-up object is created and your balance is increased. In test mode, add simulated USDC from the dashboard instead. You can retrieve individual top-ups, as well as list all top-ups. Top-ups are identified by a unique, random ID.",
  stripeDocsUrl: 'https://docs.stripe.com/api/topups',
  endpoints: BuildEndpointSummaries(TOPUPS_SUBSECTION, [
    { method: 'POST', path: '/v1/topups', pageId: 'create' },
    { method: 'POST', path: '/v1/topups/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/topups/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/topups', pageId: 'list' },
    { method: 'POST', path: '/v1/topups/:id/cancel', pageId: 'cancel' },
    {
      method: 'POST',
      path: '/v1/topups/check-deposits',
      pageId: 'check-deposits',
    },
  ]),
  events: GetResourceEventAttributes('topup'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'How top-ups work: ',
          text: 'In live mode, send USDC to the platform\'s Solana wallet, then call the <a href="#topups-check-deposits">check-deposits endpoint</a> to detect the transfer. In test mode, add simulated USDC from the dashboard (<strong>Add test USDC</strong>) or with <code>POST /v1/test_helpers/treasury/topups</code>.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: TOPUP_ATTRIBUTES,
          moreAttributes: TOPUP_MORE_ATTRIBUTES,
        },
      ],
      right: [
        { type: 'object', title: 'THE TOP-UP OBJECT', code: TOPUP_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Create Top-up Parameters
// ============================================
const CREATE_TOPUP_PARAMETERS: Attribute[] = [
  {
    name: 'amount',
    type: 'integer',
    required: true,
    description:
      'A positive integer representing how much to transfer in the smallest currency unit. For USDC, this is cents (e.g., 100 = $1 USDC).',
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

const CREATE_TOPUP_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'statement_descriptor',
    type: 'string',
    description:
      'Extra information about a top-up. Limited to 15 ASCII characters.',
    enumNote:
      '<strong>Note:</strong> This field is retained for API compatibility but is not displayed on blockchain transactions.',
  },
  {
    name: 'transfer_group',
    type: 'string',
    description: 'A string that identifies this top-up as part of a group.',
  },
];

export const TOPUPS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a top-up',
  description:
    'Creates a new top-up record in pending status. In practice, most top-ups are created automatically when the check-deposits endpoint detects incoming USDC transfers to your platform wallet.',
  endpoints: [{ method: 'POST', path: '/v1/topups' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Typical flow: ',
          text: 'While you can create top-ups manually via this endpoint, most platforms use the <a href="#topups-check-deposits">check-deposits</a> endpoint which automatically creates top-ups when USDC deposits are detected on the blockchain.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_TOPUP_PARAMETERS,
          moreAttributes: CREATE_TOPUP_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Top-up</code> object if the call succeeds.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/topups' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/topups \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d amount=200000 \\
  -d currency=usdc \\
  -d description="Platform balance top-up"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const topup = await zoneless.topups.create({
  amount: 200000,
  currency: 'usdc',
  description: 'Platform balance top-up',
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: TOPUP_PENDING_JSON },
      ],
    },
  ],
};

// ============================================
// Update Top-up Parameters
// ============================================
const UPDATE_TOPUP_PARAMETERS: Attribute[] = [
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

const TOPUP_UPDATE_RESPONSE_JSON = `{
  "id": "tu_z_1NG6yj2eZvKYlo2C1FOBiHya",
  "object": "topup",
  "amount": 200000,
  "balance_transaction": "txn_z_1NG6yjLkdIwHu7ixNCZvFdgB",
  "created": 1704067200,
  "currency": "usdc",
  "description": "Q1 2024 operating funds",
  "expected_availability_date": 1704067200,
  "failure_code": null,
  "failure_message": null,
  "livemode": false,
  "metadata": {
    "blockchain_tx": "5xK9...abc123",
    "network": "solana",
    "sender_address": "8xK2Nv3F...",
    "order_id": "6735"
  },
  "platform_account": "acct_z_Platform123abc",
  "source": {
    "id": "src_z_1NG6yjLkdIwHu7ixNCZvFdgC",
    "object": "source",
    "type": "crypto_deposit",
    "metadata": {}
  },
  "statement_descriptor": null,
  "status": "succeeded",
  "transfer_group": null,
  "account": "acct_z_Platform123abc",
  "arrival_date": 1704067200
}`;

export const TOPUPS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a top-up',
  description:
    'Updates the metadata of a top-up. Other top-up details are not editable by design.',
  endpoints: [{ method: 'POST', path: '/v1/topups/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_TOPUP_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the updated <code>Top-up</code> object if the call succeeds. If the top-up ID does not exist, this call raises an error.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/topups/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/topups/tu_z_1NG6yj2eZvKYlo2C1FOBiHya \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d description="Q1 2024 operating funds" \\
  -d "metadata[order_id]"=6735`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const topup = await zoneless.topups.update(
  'tu_z_1NG6yj2eZvKYlo2C1FOBiHya',
  {
    description: 'Q1 2024 operating funds',
    metadata: {
      order_id: '6735',
    },
  }
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: TOPUP_UPDATE_RESPONSE_JSON },
      ],
    },
  ],
};

// ============================================
// Retrieve Top-up
// ============================================
export const TOPUPS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a top-up',
  description:
    'Retrieves the details of a top-up that has previously been created. Supply the unique top-up ID that was returned from your previous request, and Zoneless will return the corresponding top-up information.',
  endpoints: [{ method: 'GET', path: '/v1/topups/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Top-up</code> object if a valid identifier was provided, and raises an error otherwise.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/topups/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/topups/tu_z_1NG6yj2eZvKYlo2C1FOBiHya \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const topup = await zoneless.topups.retrieve(
  'tu_z_1NG6yj2eZvKYlo2C1FOBiHya'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: TOPUP_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// List Top-ups Parameters
// ============================================
const LIST_TOPUPS_PARAMETERS: Attribute[] = [
  {
    name: 'status',
    type: 'enum',
    description: 'Only return top-ups that have the given status.',
    enumValues: ['canceled', 'failed', 'pending', 'reversed', 'succeeded'],
  },
];

const LIST_TOPUPS_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'amount',
    type: 'object',
    description:
      'A filter on the list based on the <code>amount</code> field. The value can be an integer or a dictionary with filter options.',
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
    name: 'created',
    type: 'object',
    description:
      'A filter on the list based on the <code>created</code> field. The value can be an integer Unix timestamp or a dictionary with filter options.',
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
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>tu_z_bar</code>, your subsequent call can include <code>ending_before=tu_z_bar</code> in order to fetch the previous page of the list.',
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
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>tu_z_foo</code>, your subsequent call can include <code>starting_after=tu_z_foo</code> in order to fetch the next page of the list.',
  },
];

const LIST_TOPUPS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/topups",
  "has_more": false,
  "data": [
    {
      "id": "tu_z_1NG6yj2eZvKYlo2C1FOBiHya",
      "object": "topup",
      "amount": 200000,
      "balance_transaction": "txn_z_1NG6yjLkdIwHu7ixNCZvFdgB",
      "created": 1704067200,
      "currency": "usdc",
      "description": "Deposit from 8xK2Nv3F...",
      "expected_availability_date": 1704067200,
      "failure_code": null,
      "failure_message": null,
      "livemode": false,
      "metadata": {
        "blockchain_tx": "5xK9...abc123",
        "network": "solana",
        "sender_address": "8xK2Nv3F..."
      },
      "platform_account": "acct_z_Platform123abc",
      "source": {
        "id": "src_z_1NG6yjLkdIwHu7ixNCZvFdgC",
        "object": "source",
        "type": "crypto_deposit",
        "metadata": {}
      },
      "statement_descriptor": null,
      "status": "succeeded",
      "transfer_group": null,
      "account": "acct_z_Platform123abc",
      "arrival_date": 1704067200
    }
  ]
}`;

export const TOPUPS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all top-ups',
  description:
    'Returns a list of top-ups. The top-ups are returned in sorted order, with the most recently created top-ups appearing first.',
  endpoints: [{ method: 'GET', path: '/v1/topups' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_TOPUPS_PARAMETERS,
          moreAttributes: LIST_TOPUPS_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> top-ups. If no more top-ups are available, the resulting array will be empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/topups' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/topups \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const topups = await zoneless.topups.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_TOPUPS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Cancel Top-up
// ============================================
const TOPUP_CANCELED_RESPONSE_JSON = `{
  "id": "tu_z_1NG6yj2eZvKYlo2C1FOBiHya",
  "object": "topup",
  "amount": 200000,
  "balance_transaction": null,
  "created": 1704067200,
  "currency": "usdc",
  "description": "Platform balance top-up",
  "expected_availability_date": 1704067200,
  "failure_code": null,
  "failure_message": null,
  "livemode": false,
  "metadata": {},
  "platform_account": "acct_z_Platform123abc",
  "source": null,
  "statement_descriptor": null,
  "status": "canceled",
  "transfer_group": null,
  "account": "acct_z_Platform123abc",
  "arrival_date": null
}`;

export const TOPUPS_CANCEL_PAGE: DocPage = {
  id: 'cancel',
  title: 'Cancel a top-up',
  description: 'Cancels a top-up. Only pending top-ups can be canceled.',
  endpoints: [{ method: 'POST', path: '/v1/topups/:id/cancel' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'warning',
          title: 'Note: ',
          text: 'Only top-ups with status <code>pending</code> can be canceled. Once a top-up has succeeded (funds have arrived), it cannot be canceled.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: "Returns the canceled <code>Top-up</code> object. If the top-up is already canceled or can't be canceled, an error is returned.",
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/topups/:id/cancel' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X POST https://api.yourdomain.com/v1/topups/tu_z_1NG6yj2eZvKYlo2C1FOBiHya/cancel \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const topup = await zoneless.topups.cancel(
  'tu_z_1NG6yj2eZvKYlo2C1FOBiHya'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: TOPUP_CANCELED_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Check Deposits (Zoneless Extension)
// ============================================
const CHECK_DEPOSITS_RESPONSE_JSON = `{
  "object": "check_deposits_result",
  "processed": 1,
  "errors": 0,
  "topups": [
    {
      "id": "tu_z_1NG6yj2eZvKYlo2C1FOBiHya",
      "object": "topup",
      "amount": 200000,
      "balance_transaction": "txn_z_1NG6yjLkdIwHu7ixNCZvFdgB",
      "created": 1704067200,
      "currency": "usdc",
      "description": "Deposit from 8xK2Nv3F...",
      "expected_availability_date": 1704067200,
      "failure_code": null,
      "failure_message": null,
      "livemode": false,
      "metadata": {
        "blockchain_tx": "5xK9...abc123",
        "network": "solana",
        "sender_address": "8xK2Nv3F...",
        "explorer_url": "https://explorer.solana.com/tx/5xK9...abc123"
      },
      "platform_account": "acct_z_Platform123abc",
      "source": {
        "id": "src_z_1NG6yjLkdIwHu7ixNCZvFdgC",
        "object": "source",
        "type": "crypto_deposit",
        "metadata": {}
      },
      "statement_descriptor": null,
      "status": "succeeded",
      "transfer_group": null,
      "account": "acct_z_Platform123abc",
      "arrival_date": 1704067200
    }
  ],
  "message": "Processed 1 new deposits"
}`;

export const TOPUPS_CHECK_DEPOSITS_PAGE: DocPage = {
  id: 'check-deposits',
  title: 'Check for deposits',
  description:
    'Checks the Solana blockchain for new incoming USDC deposits to your platform wallet. This endpoint queries the blockchain for recent USDC transfers and automatically creates top-up records for any new deposits found.',
  endpoints: [{ method: 'POST', path: '/v1/topups/check-deposits' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Zoneless extension: ',
          text: "This endpoint is specific to Zoneless and is not available in Stripe's API. It enables automatic detection of USDC deposits to your platform wallet.",
        },
        {
          type: 'paragraph',
          text: 'This is the recommended way to detect live deposits after a user sends funds. The endpoint checks for new USDC transfers to your platform wallet and creates top-up records with status <code>succeeded</code> for any confirmed transactions. Simulated test mode does not watch the blockchain; use <strong>Add test USDC</strong> on the dashboard, or <code>POST /v1/test_helpers/treasury/topups</code>, instead.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a result object containing the number of deposits processed, any errors encountered, and an array of newly created <code>Top-up</code> objects.',
          html: true,
        },
        { type: 'heading', level: 3, text: 'Response attributes' },
        {
          type: 'attributes',
          attributes: [
            {
              name: 'object',
              type: 'string',
              description:
                "String representing the object's type. Always <code>check_deposits_result</code>.",
            },
            {
              name: 'processed',
              type: 'integer',
              description: 'Number of new deposits successfully processed.',
            },
            {
              name: 'errors',
              type: 'integer',
              description: 'Number of errors encountered during processing.',
            },
            {
              name: 'topups',
              type: 'array of objects',
              description:
                'Array of newly created <code>Top-up</code> objects for the detected deposits.',
            },
            {
              name: 'message',
              type: 'string',
              description: 'A human-readable message describing the result.',
            },
          ],
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/topups/check-deposits' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X POST https://api.yourdomain.com/v1/topups/check-deposits \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const result = await zoneless.topups.checkDeposits();

console.log(\`Processed \${result.processed} deposits\`);
for (const topup of result.topups) {
  console.log(\`New top-up: \${topup.id} - \${topup.amount} USDC\`);
}`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: CHECK_DEPOSITS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const TOPUPS_PAGES: DocPage[] = [
  TOPUPS_OVERVIEW_PAGE,
  TOPUPS_CREATE_PAGE,
  TOPUPS_UPDATE_PAGE,
  TOPUPS_RETRIEVE_PAGE,
  TOPUPS_LIST_PAGE,
  TOPUPS_CANCEL_PAGE,
  TOPUPS_CHECK_DEPOSITS_PAGE,
];
