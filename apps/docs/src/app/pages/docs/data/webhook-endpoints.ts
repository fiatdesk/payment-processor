import { DocSubSection, DocPage, Attribute } from './types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const WEBHOOK_ENDPOINTS_SUBSECTION: DocSubSection = {
  id: 'webhook-endpoints',
  title: 'Webhook Endpoints',
  children: [
    { id: 'object', title: 'The Webhook Endpoint object' },
    { id: 'create', title: 'Create a webhook endpoint' },
    { id: 'update', title: 'Update a webhook endpoint' },
    { id: 'retrieve', title: 'Retrieve a webhook endpoint' },
    { id: 'list', title: 'List all webhook endpoints' },
    { id: 'delete', title: 'Delete a webhook endpoint' },
  ],
};

// ============================================
// Shared Data
// ============================================
const WEBHOOK_ENDPOINT_OBJECT_JSON = `{
  "id": "we_z_1Mr5jULkdIwHu7ix",
  "object": "webhook_endpoint",
  "api_version": null,
  "application": null,
  "created": 1704067200,
  "description": "Webhook for payout notifications",
  "enabled_events": [
    "payout.paid",
    "payout.failed"
  ],
  "livemode": true,
  "metadata": {},
  "platform_account": "acct_z_Platform123abc",
  "secret": "whsec_z_wRNftLajMZNeslQOP6vEPm4iVx5NlZ6z",
  "status": "enabled",
  "url": "https://example.com/my/webhook/endpoint"
}`;

const WEBHOOK_ENDPOINT_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless webhook endpoint IDs are prefixed with <code>we_z_</code>.',
  },
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value. Always <code>webhook_endpoint</code>.",
  },
  {
    name: 'api_version',
    type: 'string',
    nullable: true,
    description:
      'The API version events are rendered as for this webhook endpoint.',
  },
  {
    name: 'application',
    type: 'string',
    nullable: true,
    description:
      'The ID of the associated Connect application. Currently always <code>null</code> as OAuth applications are not yet supported.',
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Time at which the object was created. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'description',
    type: 'string',
    nullable: true,
    description: 'An optional description of what the webhook is used for.',
  },
  {
    name: 'enabled_events',
    type: 'array of strings',
    description:
      "The list of events to enable for this endpoint. <code>['*']</code> indicates that all events are enabled.",
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
    name: 'secret',
    type: 'string',
    description:
      'The endpoint\'s secret, used to generate webhook signatures. <strong>Only returned at creation.</strong> See <a href="/webhooks">Webhooks</a> for information on verifying webhook signatures.',
  },
  {
    name: 'status',
    type: 'enum',
    description: 'The status of the webhook.',
    enumValues: [
      {
        value: 'enabled',
        description: 'The webhook endpoint is active and will receive events.',
      },
      {
        value: 'disabled',
        description:
          'The webhook endpoint is disabled and will not receive events.',
      },
    ],
  },
  {
    name: 'url',
    type: 'string',
    description:
      'The URL of the webhook endpoint. Must use HTTPS in production.',
  },
];

const WEBHOOK_ENDPOINT_MORE_ATTRIBUTES: Attribute[] = [
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
// Enabled Events - Zoneless-specific event types
// ============================================
const ENABLED_EVENTS_ENUM_VALUES = [
  { value: '*', description: 'Subscribe to all events.' },
  {
    value: 'account.created',
    description: 'Occurs whenever a connected account is created.',
  },
  {
    value: 'account.updated',
    description: 'Occurs whenever an account status or property has changed.',
  },
  {
    value: 'balance.available',
    description:
      'Occurs whenever your platform balance or a connected account balance has been updated (e.g., when a transfer is created or a payout is processed).',
  },
  {
    value: 'balance_transaction.created',
    description:
      'Occurs whenever a new balance transaction is created (transfers, payouts, top-ups, etc.).',
  },
  {
    value: 'external_account.created',
    description:
      'Occurs whenever an external wallet is created (a Solana wallet address added to receive USDC payouts).',
  },
  {
    value: 'external_account.updated',
    description: 'Occurs whenever an external wallet is updated.',
  },
  {
    value: 'external_account.deleted',
    description: 'Occurs whenever an external wallet is deleted.',
  },
  {
    value: 'payout.created',
    description: 'Occurs whenever a payout is created.',
  },
  {
    value: 'payout.updated',
    description: 'Occurs whenever a payout is updated.',
  },
  {
    value: 'payout.paid',
    description:
      "Occurs whenever a payout is expected to be available in the destination wallet. The USDC has been sent on-chain to the connected account's Solana wallet.",
  },
  {
    value: 'payout.failed',
    description:
      "Occurs whenever a payout attempt fails. This can happen if the destination wallet is invalid or if there's an on-chain error.",
  },
  {
    value: 'payout.canceled',
    description: 'Occurs whenever a payout is canceled.',
  },
  {
    value: 'person.created',
    description:
      'Occurs whenever a person associated with an account is created.',
  },
  {
    value: 'person.updated',
    description:
      'Occurs whenever a person associated with an account is updated.',
  },
  {
    value: 'person.deleted',
    description:
      'Occurs whenever a person associated with an account is deleted.',
  },
  {
    value: 'price.created',
    description: 'Occurs whenever a price is created.',
  },
  {
    value: 'price.updated',
    description: 'Occurs whenever a price is updated.',
  },
  {
    value: 'price.deleted',
    description: 'Occurs whenever a price is deleted.',
  },
  {
    value: 'product.created',
    description: 'Occurs whenever a product is created.',
  },
  {
    value: 'product.updated',
    description: 'Occurs whenever a product is updated.',
  },
  {
    value: 'product.deleted',
    description: 'Occurs whenever a product is deleted.',
  },
  {
    value: 'topup.created',
    description:
      'Occurs whenever a top-up is created. Top-ups add USDC to your platform balance.',
  },
  {
    value: 'topup.succeeded',
    description:
      'Occurs whenever a top-up succeeds and the USDC is available in your platform balance.',
  },
  { value: 'topup.failed', description: 'Occurs whenever a top-up fails.' },
  {
    value: 'topup.canceled',
    description: 'Occurs whenever a top-up is canceled.',
  },
  {
    value: 'topup.reversed',
    description: 'Occurs whenever a top-up is reversed.',
  },
  {
    value: 'transfer.created',
    description:
      "Occurs whenever a transfer is created. Transfers move funds from your platform balance to a connected account's balance.",
  },
  {
    value: 'transfer.updated',
    description:
      "Occurs whenever a transfer's description or metadata is updated.",
  },
  {
    value: 'api_key.created',
    description: 'Occurs whenever a new API key is created for the platform.',
  },
  {
    value: 'api_key.updated',
    description:
      'Occurs whenever an API key is updated (e.g., name changed or rolled).',
  },
  {
    value: 'api_key.deleted',
    description: 'Occurs whenever an API key is deleted.',
  },
];

// ============================================
// Pages
// ============================================
export const WEBHOOK_ENDPOINTS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Webhook Endpoint object',
  description:
    'You can configure webhook endpoints via the API to be notified about events that happen in your Zoneless platform. When an event occurs (such as a payout completing or an account being updated), Zoneless sends a POST request to your configured URL with the event data.',
  stripeDocsUrl: 'https://docs.stripe.com/api/webhook_endpoints',
  endpoints: BuildEndpointSummaries(WEBHOOK_ENDPOINTS_SUBSECTION, [
    { method: 'POST', path: '/v1/webhook_endpoints', pageId: 'create' },
    { method: 'POST', path: '/v1/webhook_endpoints/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/webhook_endpoints/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/webhook_endpoints', pageId: 'list' },
    { method: 'DELETE', path: '/v1/webhook_endpoints/:id', pageId: 'delete' },
  ]),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: 'Webhook endpoints allow your platform to receive real-time notifications about events. When an event occurs (like a payout completing), Zoneless sends a signed POST request to your endpoint URL.',
        },
        {
          type: 'paragraph',
          text: 'Each webhook endpoint can subscribe to specific event types, or use <code>[\'*\']</code> to receive all events. The webhook payload contains the full <a href="#events-object">Event object</a> including the affected resource.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Delivery status',
          text: 'A delivery that does not receive a <code>2xx</code> response is recorded as failed. Use <code>event.id</code> for idempotent processing and the Events API when reconciling application state.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: WEBHOOK_ENDPOINT_ATTRIBUTES,
          moreAttributes: WEBHOOK_ENDPOINT_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE WEBHOOK ENDPOINT OBJECT',
          code: WEBHOOK_ENDPOINT_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create Webhook Endpoint
// ============================================
const CREATE_WEBHOOK_ENDPOINT_PARAMETERS: Attribute[] = [
  {
    name: 'enabled_events',
    type: 'array of enums',
    required: true,
    description:
      "The list of events to enable for this endpoint. You may specify <code>['*']</code> to enable all events.",
    enumValues: ENABLED_EVENTS_ENUM_VALUES,
  },
  {
    name: 'url',
    type: 'string',
    required: true,
    description:
      'The URL of the webhook endpoint. Must use HTTPS in production (HTTP is allowed in test mode for local development).',
  },
];

const CREATE_WEBHOOK_ENDPOINT_MORE_PARAMETERS: Attribute[] = [
  {
    name: 'description',
    type: 'string',
    description:
      'An optional description of what the webhook is used for. Maximum 500 characters.',
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
];

const CREATE_WEBHOOK_ENDPOINT_RESPONSE_JSON = `{
  "id": "we_z_1Mr5jULkdIwHu7ix",
  "object": "webhook_endpoint",
  "api_version": null,
  "application": null,
  "created": 1704067200,
  "description": null,
  "enabled_events": [
    "payout.paid",
    "payout.failed"
  ],
  "livemode": true,
  "metadata": {},
  "platform_account": "acct_z_Platform123abc",
  "secret": "whsec_z_wRNftLajMZNeslQOP6vEPm4iVx5NlZ6z",
  "status": "enabled",
  "url": "https://example.com/my/webhook/endpoint"
}`;

export const WEBHOOK_ENDPOINTS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a webhook endpoint',
  description:
    'A webhook endpoint must have a url and a list of enabled_events. When events matching those types occur in your platform, Zoneless will send a POST request to the specified URL.',
  endpoints: [{ method: 'POST', path: '/v1/webhook_endpoints' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Save your secret: ',
          text: "The <code>secret</code> field is only returned when the webhook endpoint is created. Store it securely—you'll need it to verify webhook signatures.",
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_WEBHOOK_ENDPOINT_PARAMETERS,
          moreAttributes: CREATE_WEBHOOK_ENDPOINT_MORE_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the webhook endpoint object with the <code>secret</code> field populated.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/webhook_endpoints' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/webhook_endpoints \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "enabled_events[]"="payout.paid" \\
  -d "enabled_events[]"="payout.failed" \\
  --data-urlencode url="https://example.com/my/webhook/endpoint"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const webhookEndpoint = await zoneless.webhookEndpoints.create({
  enabled_events: ['payout.paid', 'payout.failed'],
  url: 'https://example.com/my/webhook/endpoint',
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: CREATE_WEBHOOK_ENDPOINT_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Update Webhook Endpoint
// ============================================
const UPDATE_WEBHOOK_ENDPOINT_PARAMETERS: Attribute[] = [
  {
    name: 'description',
    type: 'string',
    description: 'An optional description of what the webhook is used for.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    description: 'Disable the webhook endpoint if set to <code>true</code>.',
  },
  {
    name: 'enabled_events',
    type: 'array of enums',
    description:
      "The list of events to enable for this endpoint. You may specify <code>['*']</code> to enable all events.",
    enumValues: ENABLED_EVENTS_ENUM_VALUES,
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'url',
    type: 'string',
    description: 'The URL of the webhook endpoint.',
  },
];

const UPDATE_WEBHOOK_ENDPOINT_RESPONSE_JSON = `{
  "id": "we_z_1Mr5jULkdIwHu7ix",
  "object": "webhook_endpoint",
  "api_version": null,
  "application": null,
  "created": 1704067200,
  "description": "Updated webhook for all payout events",
  "enabled_events": [
    "payout.paid",
    "payout.failed",
    "payout.created"
  ],
  "livemode": true,
  "metadata": {},
  "platform_account": "acct_z_Platform123abc",
  "status": "enabled",
  "url": "https://example.com/new_endpoint"
}`;

export const WEBHOOK_ENDPOINTS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a webhook endpoint',
  description:
    'Updates the webhook endpoint. You may edit the url, the list of enabled_events, and the status of your endpoint.',
  endpoints: [{ method: 'POST', path: '/v1/webhook_endpoints/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'paragraph',
          text: 'At least one parameter must be provided.',
        },
        {
          type: 'attributes',
          attributes: UPDATE_WEBHOOK_ENDPOINT_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the updated webhook endpoint object if successful. Otherwise, this call raises an error.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/webhook_endpoints/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/webhook_endpoints/we_z_1Mr5jULkdIwHu7ix \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "enabled_events[]"="payout.paid" \\
  -d "enabled_events[]"="payout.failed" \\
  -d "enabled_events[]"="payout.created" \\
  --data-urlencode url="https://example.com/new_endpoint"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const webhookEndpoint = await zoneless.webhookEndpoints.update(
  'we_z_1Mr5jULkdIwHu7ix',
  {
    enabled_events: ['payout.paid', 'payout.failed', 'payout.created'],
    url: 'https://example.com/new_endpoint',
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: UPDATE_WEBHOOK_ENDPOINT_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Retrieve Webhook Endpoint
// ============================================
const RETRIEVE_WEBHOOK_ENDPOINT_RESPONSE_JSON = `{
  "id": "we_z_1Mr5jULkdIwHu7ix",
  "object": "webhook_endpoint",
  "api_version": null,
  "application": null,
  "created": 1704067200,
  "description": "Webhook for payout notifications",
  "enabled_events": [
    "payout.paid",
    "payout.failed"
  ],
  "livemode": true,
  "metadata": {},
  "platform_account": "acct_z_Platform123abc",
  "status": "enabled",
  "url": "https://example.com/my/webhook/endpoint"
}`;

export const WEBHOOK_ENDPOINTS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a webhook endpoint',
  description: 'Retrieves the webhook endpoint with the given ID.',
  endpoints: [{ method: 'GET', path: '/v1/webhook_endpoints/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a webhook endpoint if a valid webhook endpoint ID was provided. Raises an error otherwise.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Note: ',
          text: 'The <code>secret</code> field is not returned when retrieving a webhook endpoint. It is only returned once at creation time.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/webhook_endpoints/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/webhook_endpoints/we_z_1Mr5jULkdIwHu7ix \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const webhookEndpoint = await zoneless.webhookEndpoints.retrieve(
  'we_z_1Mr5jULkdIwHu7ix'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: RETRIEVE_WEBHOOK_ENDPOINT_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// List Webhook Endpoints
// ============================================
const LIST_WEBHOOK_ENDPOINTS_PARAMETERS: Attribute[] = [
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>we_z_bar</code>, your subsequent call can include <code>ending_before=we_z_bar</code> in order to fetch the previous page of the list.',
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
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>we_z_foo</code>, your subsequent call can include <code>starting_after=we_z_foo</code> in order to fetch the next page of the list.',
  },
];

const LIST_WEBHOOK_ENDPOINTS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/webhook_endpoints",
  "has_more": false,
  "data": [
    {
      "id": "we_z_1Mr5jULkdIwHu7ix",
      "object": "webhook_endpoint",
      "api_version": null,
      "application": null,
      "created": 1704067200,
      "description": "Webhook for payout notifications",
      "enabled_events": [
        "payout.paid",
        "payout.failed"
      ],
      "livemode": true,
      "metadata": {},
      "platform_account": "acct_z_Platform123abc",
      "status": "enabled",
      "url": "https://example.com/my/webhook/endpoint"
    }
  ]
}`;

export const WEBHOOK_ENDPOINTS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all webhook endpoints',
  description: 'Returns a list of your webhook endpoints.',
  endpoints: [{ method: 'GET', path: '/v1/webhook_endpoints' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No required parameters.' },
        {
          type: 'attributes',
          attributes: [],
          moreAttributes: LIST_WEBHOOK_ENDPOINTS_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> webhook endpoints, starting after webhook endpoint <code>starting_after</code>. Each entry in the array is a separate <a href="#webhook-endpoints-object">Webhook Endpoint</a> object. If no more webhook endpoints are available, the resulting array is empty. This request should never raise an error.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/webhook_endpoints' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/webhook_endpoints \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const webhookEndpoints = await zoneless.webhookEndpoints.list({
  limit: 3,
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_WEBHOOK_ENDPOINTS_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Delete Webhook Endpoint
// ============================================
const DELETE_WEBHOOK_ENDPOINT_RESPONSE_JSON = `{
  "id": "we_z_1Mr5jULkdIwHu7ix",
  "object": "webhook_endpoint",
  "deleted": true
}`;

export const WEBHOOK_ENDPOINTS_DELETE_PAGE: DocPage = {
  id: 'delete',
  title: 'Delete a webhook endpoint',
  description:
    'Deletes a webhook endpoint. Once deleted, the endpoint will no longer receive any events.',
  endpoints: [{ method: 'DELETE', path: '/v1/webhook_endpoints/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: "An object with the deleted webhook endpoint's ID. Otherwise, this call raises an error, such as if the webhook endpoint has already been deleted.",
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'DELETE', path: '/v1/webhook_endpoints/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X DELETE https://api.yourdomain.com/v1/webhook_endpoints/we_z_1Mr5jULkdIwHu7ix \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const deleted = await zoneless.webhookEndpoints.del(
  'we_z_1Mr5jULkdIwHu7ix'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: DELETE_WEBHOOK_ENDPOINT_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const WEBHOOK_ENDPOINTS_PAGES: DocPage[] = [
  WEBHOOK_ENDPOINTS_OVERVIEW_PAGE,
  WEBHOOK_ENDPOINTS_CREATE_PAGE,
  WEBHOOK_ENDPOINTS_UPDATE_PAGE,
  WEBHOOK_ENDPOINTS_RETRIEVE_PAGE,
  WEBHOOK_ENDPOINTS_LIST_PAGE,
  WEBHOOK_ENDPOINTS_DELETE_PAGE,
];
