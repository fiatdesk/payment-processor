import { DocSubSection, DocPage, Attribute } from './types';
import { GetResourceEventAttributes } from './event-types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const IDENTITY_VERIFICATION_SESSIONS_SUBSECTION: DocSubSection = {
  id: 'identity-verification-sessions',
  title: 'Verification Sessions',
  children: [
    { id: 'object', title: 'The VerificationSession object' },
    { id: 'create', title: 'Create a VerificationSession' },
    { id: 'update', title: 'Update a VerificationSession' },
    { id: 'retrieve', title: 'Retrieve a VerificationSession' },
    { id: 'list', title: 'List VerificationSessions' },
    { id: 'cancel', title: 'Cancel a VerificationSession' },
    { id: 'redact', title: 'Redact a VerificationSession' },
  ],
};

// ============================================
// Shared Data
// ============================================
const VERIFICATION_SESSION_OBJECT_JSON = `{
  "id": "vs_z_7Kd2mQxT4Rb9LpVn",
  "object": "identity.verification_session",
  "client_secret": "vs_z_7Kd2mQxT4Rb9LpVn_token_5fJ2qL",
  "created": 1784572800,
  "last_error": null,
  "last_verification_report": null,
  "livemode": false,
  "metadata": {},
  "options": null,
  "provided_details": null,
  "redaction": null,
  "status": "requires_input",
  "type": "document",
  "url": "https://verify.didit.me/session/9f2c7a1d4e6b",
  "related_account": "acct_z_1Nv0FGQ9RKHgCVdK",
  "related_person": "person_z_1Nv0FGQ9RKHgCVdK",
  "platform_account": "acct_z_Platform123abc",
  "provider": "didit",
  "provider_session_id": "3f8a1c92-7b64-4d0e-9a51-2c7e5b8d1046"
}`;

const DOCUMENT_OPTION_ATTRIBUTES: Attribute[] = [
  {
    name: 'allowed_types',
    type: 'array of enums',
    nullable: true,
    description:
      'The document types the seller may present. Defaults to all supported types.',
    enumValues: ['driving_license', 'id_card', 'passport'],
  },
  {
    name: 'require_live_capture',
    type: 'boolean',
    nullable: true,
    description:
      'Whether the seller must capture the document with a camera instead of uploading a file.',
  },
  {
    name: 'require_matching_selfie',
    type: 'boolean',
    nullable: true,
    description:
      'Whether the seller must take a selfie that matches the photo on the document.',
  },
];

const DETAILS_ATTRIBUTES: Attribute[] = [
  {
    name: 'email',
    type: 'string',
    nullable: true,
    description:
      'Email address the seller can be reached at. The provider emails the seller here when the flow needs attention.',
  },
  {
    name: 'phone',
    type: 'string',
    nullable: true,
    description:
      'Phone number the seller can be reached at. Must be 32 characters or fewer.',
  },
];

const VERIFICATION_SESSION_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless verification session IDs are prefixed with <code>vs_z_</code>.',
  },
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value. Always <code>identity.verification_session</code>.",
  },
  {
    name: 'client_secret',
    type: 'string',
    nullable: true,
    description:
      'A short-lived secret that lets your client open the verification flow without your secret key. Zoneless returns the provider session token, or <code>null</code> once the session is canceled or redacted.',
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Time at which the object was created. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'last_error',
    type: 'object',
    nullable: true,
    description: 'The most recent error that occurred during the verification.',
    children: [
      {
        name: 'code',
        type: 'string',
        nullable: true,
        description:
          'A short machine-readable string giving the reason for the error.',
      },
      {
        name: 'reason',
        type: 'string',
        nullable: true,
        description:
          'A human-readable message giving the reason for the error. These messages can be shown to the seller.',
      },
    ],
  },
  {
    name: 'last_verification_report',
    type: 'string',
    nullable: true,
    description:
      'ID of the most recent verification report. Zoneless returns <code>null</code>: the outcome of the check is reported through <code>status</code> and the session webhook events.',
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
    name: 'options',
    type: 'object',
    nullable: true,
    description: 'A set of options for the verification session.',
    children: [
      {
        name: 'document',
        type: 'object',
        description: 'Options for a document verification session.',
        children: DOCUMENT_OPTION_ATTRIBUTES,
      },
    ],
  },
  {
    name: 'platform_account',
    type: 'string',
    description:
      '<strong>Zoneless extension:</strong> The platform account that owns this session.',
  },
  {
    name: 'provided_details',
    type: 'object',
    nullable: true,
    description:
      'Details about the seller that the provider already has, so the seller is not asked for them again.',
    children: DETAILS_ATTRIBUTES,
  },
  {
    name: 'provider',
    type: 'enum',
    description:
      '<strong>Zoneless extension:</strong> The identity provider that fulfils this session.',
    enumValues: [
      {
        value: 'didit',
        description: 'The session is fulfilled by Didit.',
      },
    ],
  },
  {
    name: 'provider_session_id',
    type: 'string',
    description:
      "<strong>Zoneless extension:</strong> The provider's own ID for this session. Use it to match a session against the provider's dashboard or webhook payloads.",
  },
  {
    name: 'redaction',
    type: 'object',
    nullable: true,
    description:
      'Redaction status of the session. Zoneless sets <code>redacted</code> as soon as the request succeeds, and never reports a redaction in progress.',
    children: [
      {
        name: 'status',
        type: 'enum',
        description: 'Whether the session has been redacted.',
        enumValues: [
          {
            value: 'redacted',
            description: 'The session has been redacted.',
          },
        ],
      },
    ],
  },
  {
    name: 'related_account',
    type: 'string',
    description:
      '<strong>Zoneless extension:</strong> The connected account this session verifies.',
  },
  {
    name: 'related_person',
    type: 'string',
    description:
      "<strong>Zoneless extension:</strong> The person on the connected account this session verifies. Defaults to the account's individual.",
  },
  {
    name: 'status',
    type: 'enum',
    description:
      'The status of the verification session. Zoneless never sets <code>requires_action</code>.',
    enumValues: [
      {
        value: 'requires_input',
        description:
          'The verification has not been completed. Either the seller has not yet finished the flow, or the provider asked for another attempt.',
      },
      {
        value: 'processing',
        description:
          'The provider is reviewing the submitted documents or the seller is midway through the flow.',
      },
      {
        value: 'verified',
        description:
          'The verification check passed and the seller is verified.',
      },
      {
        value: 'canceled',
        description: 'The session was canceled and can no longer be used.',
      },
    ],
  },
  {
    name: 'type',
    type: 'enum',
    description:
      'The type of verification check. Defaults to <code>document</code>. The check the seller completes follows the workflow configured for your platform, which is the KYB workflow when the account is a business and a KYB workflow is set.',
    enumValues: [
      {
        value: 'document',
        description:
          'The seller presents a government-issued document such as a passport or driving license.',
      },
      {
        value: 'id_number',
        description: 'The seller is verified against an ID number.',
      },
      {
        value: 'address',
        description: 'The seller is verified against an address.',
      },
      {
        value: 'verification_flow',
        description: 'The checks are picked by the provider workflow.',
      },
    ],
  },
  {
    name: 'url',
    type: 'string',
    nullable: true,
    description:
      'The URL for the hosted verification flow. Redirect the seller to this URL to start the check. Zoneless returns <code>null</code> once the session is canceled or redacted.',
  },
];

// ============================================
// Create Verification Session Parameters
// ============================================
const CREATE_VERIFICATION_SESSION_PARAMETERS: Attribute[] = [
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'options',
    type: 'object',
    description: 'A set of options for the verification session.',
    children: [
      {
        name: 'document',
        type: 'object',
        description: 'Options for a document verification session.',
        children: DOCUMENT_OPTION_ATTRIBUTES,
      },
    ],
  },
  {
    name: 'provided_details',
    type: 'object',
    description:
      'Details about the seller, so the provider does not ask for them again.',
    children: DETAILS_ATTRIBUTES,
  },
  {
    name: 'related_account',
    type: 'string',
    required: true,
    description:
      '<strong>Zoneless extension:</strong> The connected account to verify. A platform can verify any account it owns; a connected account can only verify itself.',
  },
  {
    name: 'related_person',
    type: 'string',
    description:
      "<strong>Zoneless extension:</strong> The person on the account to verify. Defaults to the account's individual.",
  },
  {
    name: 'return_url',
    type: 'string',
    description:
      'The URL the seller is redirected to when they finish or leave the verification flow. Must be a valid URL.',
  },
  {
    name: 'type',
    type: 'enum',
    description:
      'The type of verification check. Defaults to <code>document</code>.',
    enumValues: [
      { value: 'document', description: 'A government-issued document.' },
      { value: 'id_number', description: 'An ID number.' },
      { value: 'address', description: 'An address.' },
      { value: 'verification_flow', description: 'The provider workflow.' },
    ],
  },
];

const CREATE_VERIFICATION_SESSION_RESPONSE_JSON =
  VERIFICATION_SESSION_OBJECT_JSON;

// ============================================
// Update Verification Session Parameters
// ============================================
const UPDATE_VERIFICATION_SESSION_PARAMETERS: Attribute[] = [
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This merges into the metadata already on the session.',
  },
  {
    name: 'options',
    type: 'object',
    description: 'A set of updated options for the verification session.',
    children: [
      {
        name: 'document',
        type: 'object',
        description: 'Options for a document verification session.',
        children: DOCUMENT_OPTION_ATTRIBUTES,
      },
    ],
  },
  {
    name: 'provided_details',
    type: 'object',
    description: 'Updated details about the seller.',
    children: DETAILS_ATTRIBUTES,
  },
];

const UPDATE_VERIFICATION_SESSION_RESPONSE_JSON = `{
  "id": "vs_z_7Kd2mQxT4Rb9LpVn",
  "object": "identity.verification_session",
  "client_secret": "vs_z_7Kd2mQxT4Rb9LpVn_token_5fJ2qL",
  "created": 1784572800,
  "last_error": null,
  "last_verification_report": null,
  "livemode": false,
  "metadata": {
    "order_id": "6735"
  },
  "options": null,
  "provided_details": null,
  "redaction": null,
  "status": "requires_input",
  "type": "document",
  "url": "https://verify.didit.me/session/9f2c7a1d4e6b",
  "related_account": "acct_z_1Nv0FGQ9RKHgCVdK",
  "related_person": "person_z_1Nv0FGQ9RKHgCVdK",
  "platform_account": "acct_z_Platform123abc",
  "provider": "didit",
  "provider_session_id": "3f8a1c92-7b64-4d0e-9a51-2c7e5b8d1046"
}`;

// ============================================
// List Verification Sessions Parameters
// ============================================
const LIST_VERIFICATION_SESSION_PARAMETERS: Attribute[] = [
  {
    name: 'created',
    type: 'object',
    description:
      'Only return sessions that were created during the given date interval.',
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
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>vs_z_bar</code>, your subsequent call can include <code>ending_before=vs_z_bar</code> in order to fetch the previous page of the list.',
  },
  {
    name: 'limit',
    type: 'integer',
    description:
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
  },
  {
    name: 'related_account',
    type: 'string',
    description:
      '<strong>Zoneless extension:</strong> Only return sessions that verify this connected account.',
  },
  {
    name: 'starting_after',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>vs_z_foo</code>, your subsequent call can include <code>starting_after=vs_z_foo</code> in order to fetch the next page of the list.',
  },
  {
    name: 'status',
    type: 'enum',
    description: 'Only return sessions with the given status.',
    enumValues: [
      { value: 'requires_input' },
      { value: 'processing' },
      { value: 'verified' },
      { value: 'canceled' },
    ],
  },
];

const LIST_VERIFICATION_SESSION_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/identity/verification_sessions",
  "has_more": false,
  "data": [
    {
      "id": "vs_z_7Kd2mQxT4Rb9LpVn",
      "object": "identity.verification_session",
      "client_secret": "vs_z_7Kd2mQxT4Rb9LpVn_token_5fJ2qL",
      "created": 1784572800,
      "last_error": null,
      "last_verification_report": null,
      "livemode": false,
      "metadata": {},
      "options": null,
      "provided_details": null,
      "redaction": null,
      "status": "requires_input",
      "type": "document",
      "url": "https://verify.didit.me/session/9f2c7a1d4e6b",
      "related_account": "acct_z_1Nv0FGQ9RKHgCVdK",
      "related_person": "person_z_1Nv0FGQ9RKHgCVdK",
      "platform_account": "acct_z_Platform123abc",
      "provider": "didit",
      "provider_session_id": "3f8a1c92-7b64-4d0e-9a51-2c7e5b8d1046"
    }
  ]
}`;

// ============================================
// Cancel and Redact Responses
// ============================================
const CANCEL_VERIFICATION_SESSION_RESPONSE_JSON = `{
  "id": "vs_z_7Kd2mQxT4Rb9LpVn",
  "object": "identity.verification_session",
  "client_secret": null,
  "created": 1784572800,
  "last_error": null,
  "last_verification_report": null,
  "livemode": false,
  "metadata": {},
  "options": null,
  "provided_details": null,
  "redaction": null,
  "status": "canceled",
  "type": "document",
  "url": null,
  "related_account": "acct_z_1Nv0FGQ9RKHgCVdK",
  "related_person": "person_z_1Nv0FGQ9RKHgCVdK",
  "platform_account": "acct_z_Platform123abc",
  "provider": "didit",
  "provider_session_id": "3f8a1c92-7b64-4d0e-9a51-2c7e5b8d1046"
}`;

const REDACT_VERIFICATION_SESSION_RESPONSE_JSON = `{
  "id": "vs_z_7Kd2mQxT4Rb9LpVn",
  "object": "identity.verification_session",
  "client_secret": null,
  "created": 1784572800,
  "last_error": null,
  "last_verification_report": null,
  "livemode": false,
  "metadata": {},
  "options": null,
  "provided_details": null,
  "redaction": {
    "status": "redacted"
  },
  "status": "verified",
  "type": "document",
  "url": null,
  "related_account": "acct_z_1Nv0FGQ9RKHgCVdK",
  "related_person": "person_z_1Nv0FGQ9RKHgCVdK",
  "platform_account": "acct_z_Platform123abc",
  "provider": "didit",
  "provider_session_id": "3f8a1c92-7b64-4d0e-9a51-2c7e5b8d1046"
}`;

// ============================================
// Pages
// ============================================
export const IDENTITY_VERIFICATION_SESSIONS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The VerificationSession object',
  description:
    'A VerificationSession guides a connected account through an identity check and reports the result. It records the type of verification and the provider-hosted link the seller completes the check on.',
  stripeDocsUrl:
    'https://docs.stripe.com/api/identity/verification_sessions/object',
  endpoints: BuildEndpointSummaries(IDENTITY_VERIFICATION_SESSIONS_SUBSECTION, [
    {
      method: 'POST',
      path: '/v1/identity/verification_sessions',
      pageId: 'create',
    },
    {
      method: 'POST',
      path: '/v1/identity/verification_sessions/:id',
      pageId: 'update',
    },
    {
      method: 'GET',
      path: '/v1/identity/verification_sessions/:id',
      pageId: 'retrieve',
    },
    {
      method: 'GET',
      path: '/v1/identity/verification_sessions',
      pageId: 'list',
    },
    {
      method: 'POST',
      path: '/v1/identity/verification_sessions/:id/cancel',
      pageId: 'cancel',
    },
    {
      method: 'POST',
      path: '/v1/identity/verification_sessions/:id/redact',
      pageId: 'redact',
    },
  ]),
  events: GetResourceEventAttributes('identity.verification_session'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: 'A session moves between <code>requires_input</code>, <code>processing</code>, <code>verified</code> and <code>canceled</code>. Create one, redirect the seller to its <code>url</code>, then follow the result through the session webhook events rather than polling.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Zoneless runs the check through <a href="/identity-verification">the identity provider configured for your platform</a>. The session holds the provider session ID and a link the seller completes the check on, and reports the outcome back on <code>status</code>.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        { type: 'attributes', attributes: VERIFICATION_SESSION_ATTRIBUTES },
      ],
      right: [
        {
          type: 'object',
          title: 'THE VERIFICATIONSESSION OBJECT',
          code: VERIFICATION_SESSION_OBJECT_JSON,
        },
      ],
    },
  ],
};

export const IDENTITY_VERIFICATION_SESSIONS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a VerificationSession',
  description:
    'Creates a VerificationSession object. Send the seller to the returned url to start the check.',
  stripeDocsUrl:
    'https://docs.stripe.com/api/identity/verification_sessions/create',
  endpoints: [{ method: 'POST', path: '/v1/identity/verification_sessions' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'warning',
          title: 'Provider credentials: ',
          text: 'Zoneless starts the check with the API key and workflow ID saved in your platform identity settings. Without them the request is rejected.',
        },
        {
          type: 'paragraph',
          text: 'Platforms create sessions for their connected accounts. A connected account can create a session for itself only, and must pass its own ID as <code>related_account</code>.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_VERIFICATION_SESSION_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>VerificationSession</code> object with the status the provider reports for the new session, typically <code>requires_input</code>. Raises <a href="/errors">an error</a> if the account is not owned by your platform or identity verification is not configured.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'POST',
            path: '/v1/identity/verification_sessions',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/identity/verification_sessions \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d type=document \\
  -d related_account=acct_z_1Nv0FGQ9RKHgCVdK \\
  --data-urlencode return_url="https://example.com/identity/return"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const session = await zoneless.identity.verificationSessions.create({
  type: 'document',
  related_account: 'acct_z_1Nv0FGQ9RKHgCVdK',
  return_url: 'https://example.com/identity/return',
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: CREATE_VERIFICATION_SESSION_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const IDENTITY_VERIFICATION_SESSIONS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a VerificationSession',
  description:
    'Updates a VerificationSession object. Only sessions with the requires_input status can be updated.',
  stripeDocsUrl:
    'https://docs.stripe.com/api/identity/verification_sessions/update',
  endpoints: [
    { method: 'POST', path: '/v1/identity/verification_sessions/:id' },
  ],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'When updates are allowed: ',
          text: 'A session can only be updated while its status is <code>requires_input</code>. Metadata is merged into the values already on the session.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'The session <code>type</code> cannot be changed once it is created, and a request with no parameters is rejected.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_VERIFICATION_SESSION_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the updated <code>VerificationSession</code> object.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'POST',
            path: '/v1/identity/verification_sessions/:id',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/identity/verification_sessions/vs_z_7Kd2mQxT4Rb9LpVn \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[order_id]"=6735`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const session = await zoneless.identity.verificationSessions.update(
  'vs_z_7Kd2mQxT4Rb9LpVn',
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
          code: UPDATE_VERIFICATION_SESSION_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const IDENTITY_VERIFICATION_SESSIONS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a VerificationSession',
  description: 'Retrieves a VerificationSession object.',
  stripeDocsUrl:
    'https://docs.stripe.com/api/identity/verification_sessions/retrieve',
  endpoints: [
    { method: 'GET', path: '/v1/identity/verification_sessions/:id' },
  ],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>VerificationSession</code> object for a session your platform owns. Raises <a href="/errors">an error</a> if the session does not exist.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'GET',
            path: '/v1/identity/verification_sessions/:id',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/identity/verification_sessions/vs_z_7Kd2mQxT4Rb9LpVn \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const session = await zoneless.identity.verificationSessions.retrieve(
  'vs_z_7Kd2mQxT4Rb9LpVn'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: VERIFICATION_SESSION_OBJECT_JSON,
        },
      ],
    },
  ],
};

export const IDENTITY_VERIFICATION_SESSIONS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List VerificationSessions',
  description:
    'Returns a list of VerificationSessions your platform created. The sessions are returned sorted by creation date, with the most recent appearing first.',
  stripeDocsUrl:
    'https://docs.stripe.com/api/identity/verification_sessions/list',
  endpoints: [{ method: 'GET', path: '/v1/identity/verification_sessions' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Platform only: ',
          text: 'Listing sessions requires your secret key. Connected accounts can create a session for themselves but cannot list sessions.',
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: LIST_VERIFICATION_SESSION_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> verification sessions, starting after session <code>starting_after</code>. Each entry in the array is a separate <code>VerificationSession</code> object. If no more sessions are available, the resulting array is empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'GET',
            path: '/v1/identity/verification_sessions',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/identity/verification_sessions \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3 \\
  -d status=verified`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const sessions = await zoneless.identity.verificationSessions.list({
  limit: 3,
  status: 'verified',
});`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: LIST_VERIFICATION_SESSION_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const IDENTITY_VERIFICATION_SESSIONS_CANCEL_PAGE: DocPage = {
  id: 'cancel',
  title: 'Cancel a VerificationSession',
  description:
    'Cancels a VerificationSession. The seller can no longer use the session URL to complete the check.',
  stripeDocsUrl:
    'https://docs.stripe.com/api/identity/verification_sessions/cancel',
  endpoints: [
    { method: 'POST', path: '/v1/identity/verification_sessions/:id/cancel' },
  ],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'warning',
          title: 'Not allowed after completion: ',
          text: 'Sessions that are already <code>canceled</code> or <code>verified</code> cannot be canceled.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the <code>VerificationSession</code> object with <code>status</code> set to <code>canceled</code>. The <code>url</code> and <code>client_secret</code> are cleared, and the person on the account goes back to unverified so a new session can be created.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'POST',
            path: '/v1/identity/verification_sessions/:id/cancel',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X POST https://api.yourdomain.com/v1/identity/verification_sessions/vs_z_7Kd2mQxT4Rb9LpVn/cancel \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const session = await zoneless.identity.verificationSessions.cancel(
  'vs_z_7Kd2mQxT4Rb9LpVn'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: CANCEL_VERIFICATION_SESSION_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const IDENTITY_VERIFICATION_SESSIONS_REDACT_PAGE: DocPage = {
  id: 'redact',
  title: 'Redact a VerificationSession',
  description:
    'Redacts a VerificationSession. The session is kept for reporting but its link, client secret, details and metadata are removed.',
  stripeDocsUrl:
    'https://docs.stripe.com/api/identity/verification_sessions/redact',
  endpoints: [
    { method: 'POST', path: '/v1/identity/verification_sessions/:id/redact' },
  ],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'warning',
          title: 'Redaction is irreversible: ',
          text: 'The session cannot be used again once it is redacted. Redact sessions when you no longer need the check, for example after your retention period ends.',
        },
        {
          type: 'paragraph',
          text: 'Zoneless marks the session <code>redacted</code> as soon as the request succeeds, rather than reporting a redaction in progress.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the redacted <code>VerificationSession</code> object with empty <code>metadata</code>, a <code>null</code> <code>url</code>, <code>client_secret</code> and <code>provided_details</code>, and <code>redaction.status</code> set to <code>redacted</code>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: {
            method: 'POST',
            path: '/v1/identity/verification_sessions/:id/redact',
          },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X POST https://api.yourdomain.com/v1/identity/verification_sessions/vs_z_7Kd2mQxT4Rb9LpVn/redact \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const session = await zoneless.identity.verificationSessions.redact(
  'vs_z_7Kd2mQxT4Rb9LpVn'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: REDACT_VERIFICATION_SESSION_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const IDENTITY_VERIFICATION_SESSIONS_PAGES: DocPage[] = [
  IDENTITY_VERIFICATION_SESSIONS_OVERVIEW_PAGE,
  IDENTITY_VERIFICATION_SESSIONS_CREATE_PAGE,
  IDENTITY_VERIFICATION_SESSIONS_UPDATE_PAGE,
  IDENTITY_VERIFICATION_SESSIONS_RETRIEVE_PAGE,
  IDENTITY_VERIFICATION_SESSIONS_LIST_PAGE,
  IDENTITY_VERIFICATION_SESSIONS_CANCEL_PAGE,
  IDENTITY_VERIFICATION_SESSIONS_REDACT_PAGE,
];
