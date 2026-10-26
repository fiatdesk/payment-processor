import { DocSubSection, DocPage, Attribute } from './types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';
import { GetEventTypesListAttributes } from './event-types';

export const EVENTS_SUBSECTION: DocSubSection = {
  id: 'events',
  title: 'Events',
  children: [
    { id: 'object', title: 'The Event object' },
    { id: 'retrieve', title: 'Retrieve an event' },
    { id: 'list', title: 'List all events' },
    { id: 'types', title: 'Types of events' },
  ],
};

// ============================================
// Shared Data
// ============================================
const EVENT_OBJECT_JSON = `{
  "id": "evt_z_1Nv0FGQ9RKHgCVdK",
  "object": "event",
  "account": "acct_z_1Nv0FGQ9RKHgCVdK",
  "api_version": null,
  "context": null,
  "created": 1704067200,
  "data": {
    "object": {
      "id": "acct_z_1Nv0FGQ9RKHgCVdK",
      "object": "account",
      "business_profile": {
        "mcc": null,
        "name": "Acme Corp",
        "product_description": null,
        "support_email": null,
        "support_phone": null,
        "support_url": null,
        "url": "https://acme.com"
      },
      "business_type": "individual",
      "capabilities": {
        "transfers": "active",
        "usdc_payouts": "active"
      },
      "charges_enabled": true,
      "country": "US",
      "created": 1704067200,
      "default_currency": "usdc",
      "details_submitted": true,
      "email": "seller@example.com",
      "payouts_enabled": true,
      "type": "express"
    },
    "previous_attributes": null
  },
  "livemode": true,
  "pending_webhooks": 1,
  "platform_account": "acct_z_Platform123abc",
  "request": {
    "id": "req_z_abc123",
    "idempotency_key": null
  },
  "type": "account.updated"
}`;

const EVENT_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless event IDs are prefixed with <code>evt_z_</code>.',
  },
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value. Always <code>event</code>.",
  },
  {
    name: 'account',
    type: 'string',
    nullable: true,
    description: 'The connected account that originates the event.',
  },
  {
    name: 'api_version',
    type: 'string',
    nullable: true,
    description:
      'The API version used to render <code>data</code> when the event was created.',
  },
  {
    name: 'context',
    type: 'string',
    nullable: true,
    description:
      'Authentication context needed to fetch the event or related object.',
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Time at which the object was created. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'data',
    type: 'object',
    description: 'Object containing data associated with the event.',
    expandable: true,
    children: [
      {
        name: 'object',
        type: 'object',
        description:
          'Object containing the API resource relevant to the event. For example, an <code>account.updated</code> event contains a full <a href="#accounts-object">Account object</a>.',
      },
      {
        name: 'previous_attributes',
        type: 'object',
        nullable: true,
        description:
          'Object containing the names of the updated attributes and their values prior to the event. Only included in events of type <code>*.updated</code>. If an array attribute has any updated elements, this object contains the entire array.',
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
    name: 'pending_webhooks',
    type: 'integer',
    description:
      "Number of webhooks that haven't been successfully delivered (for example, to return a 2xx response) to the URLs you specify.",
  },
  {
    name: 'request',
    type: 'object',
    nullable: true,
    description: 'Information on the API request that triggers the event.',
    expandable: true,
    children: [
      {
        name: 'id',
        type: 'string',
        nullable: true,
        description:
          'ID of the API request that caused the event. If null, the event was automatic (e.g., a scheduled payout).',
      },
      {
        name: 'idempotency_key',
        type: 'string',
        nullable: true,
        description:
          'The idempotency key transmitted during the request, if any.',
      },
    ],
  },
  {
    name: 'type',
    type: 'string',
    description:
      'Description of the event (for example, <code>account.updated</code> or <code>payout.paid</code>).',
  },
];

const EVENT_MORE_ATTRIBUTES: Attribute[] = [
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
export const EVENTS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Event object',
  description:
    'Events allow you to track and react to activity in your Zoneless integration. When the state of another API resource changes, Zoneless creates an Event object that contains all the relevant information associated with that action, including the affected API resource.',
  stripeDocsUrl: 'https://docs.stripe.com/api/events',
  endpoints: BuildEndpointSummaries(EVENTS_SUBSECTION, [
    { method: 'GET', path: '/v1/events/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/events', pageId: 'list' },
  ]),
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'For example, a successful payout triggers a <code>payout.paid</code> event, which contains the <a href="#payouts-object">Payout</a> in the event\'s data property. Some actions trigger multiple events. For example, when an account is created, it triggers an <code>account.created</code> event.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Configure a <a href="#webhook-endpoints-object">webhook endpoint</a> in your platform to listen for events that represent actions your integration needs to respond to. You can also retrieve individual events or a list of events from the API.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Event retention: ',
          text: 'You can access events through the Retrieve Event API for 30 days.',
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: EVENT_ATTRIBUTES,
          moreAttributes: EVENT_MORE_ATTRIBUTES,
        },
      ],
      right: [
        { type: 'object', title: 'THE EVENT OBJECT', code: EVENT_OBJECT_JSON },
      ],
    },
  ],
};

// ============================================
// Retrieve Event
// ============================================
const RETRIEVE_EVENT_RESPONSE_JSON = `{
  "id": "evt_z_1Nv0FGQ9RKHgCVdK",
  "object": "event",
  "account": "acct_z_1Nv0FGQ9RKHgCVdK",
  "api_version": null,
  "context": null,
  "created": 1704067200,
  "data": {
    "object": {
      "id": "acct_z_1Nv0FGQ9RKHgCVdK",
      "object": "account",
      "business_profile": {
        "mcc": null,
        "name": "Acme Corp",
        "product_description": null,
        "support_email": null,
        "support_phone": null,
        "support_url": null,
        "url": "https://acme.com"
      },
      "business_type": "individual",
      "capabilities": {
        "transfers": "active",
        "usdc_payouts": "active"
      },
      "charges_enabled": true,
      "country": "US",
      "created": 1704067200,
      "default_currency": "usdc",
      "details_submitted": true,
      "email": "seller@example.com",
      "payouts_enabled": true,
      "type": "express"
    },
    "previous_attributes": null
  },
  "livemode": true,
  "pending_webhooks": 1,
  "platform_account": "acct_z_Platform123abc",
  "request": {
    "id": "req_z_abc123",
    "idempotency_key": null
  },
  "type": "account.updated"
}`;

export const EVENTS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve an event',
  description:
    'Retrieves the details of an event if it was created in the last 30 days. Supply the unique identifier of the event, which you might have received in a webhook.',
  endpoints: [{ method: 'GET', path: '/v1/events/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns an <code>Event</code> object if a valid identifier was provided. All events share a common structure. The only property that will differ is the <code>data</code> property.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'In each case, the <code>data</code> dictionary will have an attribute called <code>object</code> and its value will be the same as retrieving the same object directly from the API. For example, an <code>account.created</code> event will have the same information as retrieving the relevant account would.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'In cases where the attributes of an object have changed, <code>data</code> will also contain a dictionary called <code>previous_attributes</code> containing the changes.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/events/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/events/evt_z_1Nv0FGQ9RKHgCVdK \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const event = await zoneless.events.retrieve('evt_z_1Nv0FGQ9RKHgCVdK');`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: RETRIEVE_EVENT_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// List Events
// ============================================
const LIST_EVENTS_PARAMETERS: Attribute[] = [
  {
    name: 'created',
    type: 'object',
    description:
      'Only return events that were created during the given date interval.',
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
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>evt_z_bar</code>, your subsequent call can include <code>ending_before=evt_z_bar</code> in order to fetch the previous page of the list.',
  },
  {
    name: 'limit',
    type: 'integer',
    description:
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
  },
  {
    name: 'related_object',
    type: 'string',
    description:
      'Only return the events for this object, for example <code>related_object=pi_z_7shF2nVcbQrLm4Xd</code> to list the events of one payment intent. Events match when their <code>data.object.id</code> is this ID. <strong>Zoneless extension:</strong> Stripe does not document this parameter for v1 events.',
  },
  {
    name: 'starting_after',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>evt_z_foo</code>, your subsequent call can include <code>starting_after=evt_z_foo</code> in order to fetch the next page of the list.',
  },
  {
    name: 'type',
    type: 'string',
    description:
      'A string containing a specific event name, or group of events using <code>*</code> as a wildcard. The list will be filtered to include only events with a matching event property. For example, <code>account.*</code> will return all account events.',
  },
  {
    name: 'types',
    type: 'array of strings',
    description:
      'An array of up to 20 strings containing specific event names. The list will be filtered to include only events with a matching event property. You may pass either <code>type</code> or <code>types</code>, but not both.',
  },
];

const LIST_EVENTS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/events",
  "has_more": false,
  "data": [
    {
      "id": "evt_z_1Nv0FGQ9RKHgCVdK",
      "object": "event",
      "account": "acct_z_1Nv0FGQ9RKHgCVdK",
      "api_version": null,
      "context": null,
      "created": 1704067200,
      "data": {
        "object": {
          "id": "acct_z_1Nv0FGQ9RKHgCVdK",
          "object": "account",
          "business_type": "individual",
          "capabilities": {
            "transfers": "active",
            "usdc_payouts": "active"
          },
          "charges_enabled": true,
          "country": "US",
          "created": 1704067200,
          "default_currency": "usdc",
          "details_submitted": true,
          "email": "seller@example.com",
          "payouts_enabled": true,
          "type": "express"
        },
        "previous_attributes": null
      },
      "livemode": true,
      "pending_webhooks": 0,
      "platform_account": "acct_z_Platform123abc",
      "request": {
        "id": "req_z_abc123",
        "idempotency_key": null
      },
      "type": "account.created"
    }
  ]
}`;

export const EVENTS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all events',
  description:
    'List events, going back up to 30 days. Platforms receive events for themselves and all their connected accounts.',
  endpoints: [{ method: 'GET', path: '/v1/events' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No required parameters.' },
        {
          type: 'attributes',
          attributes: [],
          moreAttributes: LIST_EVENTS_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> events, starting after event <code>starting_after</code>. Each entry in the array is a separate <a href="#events-object">Event</a> object. If no more events are available, the resulting array is empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/events' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/events \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const events = await zoneless.events.list({
  limit: 3,
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: LIST_EVENTS_RESPONSE_JSON },
      ],
    },
  ],
};

// ============================================
// Types of Events
// ============================================
export const EVENTS_TYPES_PAGE: DocPage = {
  id: 'types',
  title: 'Types of events',
  description:
    'This is a list of all the event types currently supported by Zoneless. Events use the resource.event naming convention.',
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Event types' },
        {
          type: 'attributes',
          title: 'Event types',
          attributes: GetEventTypesListAttributes(),
        },
      ],
    },
  ],
};

export const EVENTS_PAGES: DocPage[] = [
  EVENTS_OVERVIEW_PAGE,
  EVENTS_RETRIEVE_PAGE,
  EVENTS_LIST_PAGE,
  EVENTS_TYPES_PAGE,
];
