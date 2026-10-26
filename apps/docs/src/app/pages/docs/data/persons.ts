import { DocSubSection, DocPage, Attribute } from './types';
import { GetResourceEventAttributes } from './event-types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const PERSONS_SUBSECTION: DocSubSection = {
  id: 'persons',
  title: 'Persons',
  children: [
    { id: 'object', title: 'The Person object' },
    { id: 'create', title: 'Create a person' },
    { id: 'update', title: 'Update a person' },
    { id: 'retrieve', title: 'Retrieve a person' },
    { id: 'list', title: 'List all persons' },
    { id: 'delete', title: 'Delete a person' },
  ],
};

// ============================================
// Shared Data
// ============================================
const PERSON_OBJECT_JSON = `{
  "id": "person_z_1Nv0FGQ9RKHgCVdK",
  "object": "person",
  "account": "acct_z_1Nv0FGQ9RKHgCVdK",
  "address": {
    "city": "San Francisco",
    "country": "US",
    "line1": "123 Market St",
    "line2": "Suite 400",
    "postal_code": "94105",
    "state": "CA"
  },
  "created": 1704067200,
  "dob": {
    "day": 15,
    "month": 6,
    "year": 1990
  },
  "email": "tom.jones@example.com",
  "first_name": "Tom",
  "future_requirements": {
    "alternatives": [],
    "currently_due": [],
    "errors": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
  "id_number_provided": false,
  "last_name": "Jones",
  "metadata": {},
  "phone": "+14155551234",
  "platform_account": "acct_z_Platform123abc",
  "relationship": {
    "authorizer": null,
    "director": false,
    "executive": false,
    "legal_guardian": null,
    "owner": true,
    "percent_ownership": 100,
    "representative": true,
    "title": "CEO"
  },
  "requirements": {
    "alternatives": [],
    "currently_due": [],
    "errors": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
  "ssn_last_4_provided": true,
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
}`;

const PERSON_ATTRIBUTES: Attribute[] = [
  {
    name: 'id',
    type: 'string',
    description:
      'Unique identifier for the object. Zoneless person IDs are prefixed with <code>person_z_</code>.',
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
    description: 'The account the person is associated with.',
  },
  {
    name: 'address',
    type: 'object',
    nullable: true,
    description: "The person's address.",
    expandable: true,
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
        description:
          'Two-letter country code (<a href="https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2">ISO 3166-1 alpha-2</a>).',
      },
      {
        name: 'line1',
        type: 'string',
        nullable: true,
        description:
          'Address line 1, such as the street, PO Box, or company name.',
      },
      {
        name: 'line2',
        type: 'string',
        nullable: true,
        description:
          'Address line 2, such as the apartment, suite, unit, or building.',
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
        description:
          'State, county, province, or region (<a href="https://en.wikipedia.org/wiki/ISO_3166-2">ISO 3166-2</a>).',
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
    name: 'dob',
    type: 'object',
    nullable: true,
    description: "The person's date of birth.",
    expandable: true,
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
    name: 'email',
    type: 'string',
    nullable: true,
    description: "The person's email address.",
  },
  {
    name: 'first_name',
    type: 'string',
    nullable: true,
    description: "The person's first name.",
  },
  {
    name: 'future_requirements',
    type: 'object',
    nullable: true,
    description:
      'Information about the upcoming new requirements for this person, including what information needs to be collected, and by when.',
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
        name: 'currently_due',
        type: 'array of strings',
        description:
          "Fields that need to be resolved to keep the person's account enabled.",
      },
      {
        name: 'errors',
        type: 'array of objects',
        description:
          'Details about validation and verification failures for <code>due</code> requirements that must be resolved.',
      },
      {
        name: 'eventually_due',
        type: 'array of strings',
        description: 'Fields you must collect when all thresholds are reached.',
      },
      {
        name: 'past_due',
        type: 'array of strings',
        description:
          "Fields that haven't been resolved by the account's <code>requirements.current_deadline</code>.",
      },
      {
        name: 'pending_verification',
        type: 'array of strings',
        description:
          'Fields that are being reviewed, or might become required depending on the results of a review.',
      },
    ],
  },
  {
    name: 'id_number_provided',
    type: 'boolean',
    description:
      "Whether the person's <code>id_number</code> was provided. True if the full ID number was provided (e.g., a social security number in the U.S.).",
  },
  {
    name: 'last_name',
    type: 'string',
    nullable: true,
    description: "The person's last name.",
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'phone',
    type: 'string',
    nullable: true,
    description: "The person's phone number.",
  },
  {
    name: 'relationship',
    type: 'object',
    description: "Describes the person's relationship to the account.",
    expandable: true,
    children: [
      {
        name: 'authorizer',
        type: 'boolean',
        nullable: true,
        description:
          "Whether the person is the authorizer of the account's representative.",
      },
      {
        name: 'director',
        type: 'boolean',
        nullable: true,
        description:
          "Whether the person is a director of the account's legal entity. Directors are typically members of the governing board of the company.",
      },
      {
        name: 'executive',
        type: 'boolean',
        nullable: true,
        description:
          'Whether the person has significant responsibility to control, manage, or direct the organization.',
      },
      {
        name: 'legal_guardian',
        type: 'boolean',
        nullable: true,
        description:
          "Whether the person is the legal guardian of the account's representative.",
      },
      {
        name: 'owner',
        type: 'boolean',
        nullable: true,
        description:
          "Whether the person is an owner of the account's legal entity.",
      },
      {
        name: 'percent_ownership',
        type: 'float',
        nullable: true,
        description:
          "The percent owned by the person of the account's legal entity.",
      },
      {
        name: 'representative',
        type: 'boolean',
        nullable: true,
        description:
          'Whether the person is authorized as the primary representative of the account. There can only be one representative at any given time.',
      },
      {
        name: 'title',
        type: 'string',
        nullable: true,
        description: "The person's title (e.g., CEO, Support Engineer).",
      },
    ],
  },
  {
    name: 'requirements',
    type: 'object',
    nullable: true,
    description:
      'Information about the requirements for this person, including what information needs to be collected, and by when.',
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
        name: 'currently_due',
        type: 'array of strings',
        description:
          "Fields that need to be resolved to keep the person's account enabled.",
      },
      {
        name: 'errors',
        type: 'array of objects',
        description:
          'Details about validation and verification failures for <code>due</code> requirements that must be resolved.',
      },
      {
        name: 'eventually_due',
        type: 'array of strings',
        description: 'Fields you must collect when all thresholds are reached.',
      },
      {
        name: 'past_due',
        type: 'array of strings',
        description:
          "Fields that haven't been resolved by <code>current_deadline</code>. These fields need to be resolved to enable the person's account.",
      },
      {
        name: 'pending_verification',
        type: 'array of strings',
        description:
          'Fields that are being reviewed, or might become required depending on the results of a review.',
      },
    ],
  },
  {
    name: 'ssn_last_4_provided',
    type: 'boolean',
    description:
      "Whether the last four digits of the person's Social Security number have been provided (U.S. only).",
  },
  {
    name: 'verification',
    type: 'object',
    description: "The person's verification status.",
    expandable: true,
    children: [
      {
        name: 'additional_document',
        type: 'object',
        nullable: true,
        description:
          'A document showing address, either a passport, local ID card, or utility bill from a well-known utility company.',
        children: [
          {
            name: 'back',
            type: 'string',
            nullable: true,
            description:
              'The back of an ID returned by a file upload with a <code>purpose</code> value of <code>identity_document</code>.',
          },
          {
            name: 'details',
            type: 'string',
            nullable: true,
            description:
              'A user-displayable string describing the verification state of this document.',
          },
          {
            name: 'details_code',
            type: 'string',
            nullable: true,
            description:
              'A machine-readable code specifying the verification state for this document.',
          },
          {
            name: 'front',
            type: 'string',
            nullable: true,
            description:
              'The front of an ID returned by a file upload with a <code>purpose</code> value of <code>identity_document</code>.',
          },
        ],
      },
      {
        name: 'details',
        type: 'string',
        nullable: true,
        description:
          'A user-displayable string describing the verification state for the person.',
      },
      {
        name: 'details_code',
        type: 'string',
        nullable: true,
        description:
          'A machine-readable code specifying the verification state for the person.',
      },
      {
        name: 'document',
        type: 'object',
        description:
          'An identifying document for the person, either a passport or local ID card.',
        children: [
          {
            name: 'back',
            type: 'string',
            nullable: true,
            description:
              'The back of an ID returned by a file upload with a <code>purpose</code> value of <code>identity_document</code>.',
          },
          {
            name: 'details',
            type: 'string',
            nullable: true,
            description:
              'A user-displayable string describing the verification state of this document.',
          },
          {
            name: 'details_code',
            type: 'string',
            nullable: true,
            description:
              'A machine-readable code specifying the verification state for this document.',
          },
          {
            name: 'front',
            type: 'string',
            nullable: true,
            description:
              'The front of an ID returned by a file upload with a <code>purpose</code> value of <code>identity_document</code>.',
          },
        ],
      },
      {
        name: 'status',
        type: 'enum',
        description: 'The state of verification for the person.',
        enumValues: [
          {
            value: 'unverified',
            description: 'Verification has not been attempted.',
          },
          { value: 'pending', description: 'Verification is in progress.' },
          { value: 'verified', description: 'Verification was successful.' },
        ],
      },
    ],
  },
];

const PERSON_MORE_ATTRIBUTES: Attribute[] = [
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
export const PERSONS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Person object',
  description:
    "This is an object representing a person associated with a Zoneless account. Persons are used to collect information about individuals associated with the account's legal entity, such as owners, directors, executives, and representatives.",
  stripeDocsUrl: 'https://docs.stripe.com/api/persons',
  endpoints: BuildEndpointSummaries(PERSONS_SUBSECTION, [
    { method: 'POST', path: '/v1/accounts/:id/persons', pageId: 'create' },
    { method: 'POST', path: '/v1/accounts/:id/persons/:id', pageId: 'update' },
    { method: 'GET', path: '/v1/accounts/:id/persons/:id', pageId: 'retrieve' },
    { method: 'GET', path: '/v1/accounts/:id/persons', pageId: 'list' },
    {
      method: 'DELETE',
      path: '/v1/accounts/:id/persons/:id',
      pageId: 'delete',
    },
  ]),
  events: GetResourceEventAttributes('person'),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Simplified for MVP: ',
          text: "Zoneless Persons are a streamlined version of Stripe's Person object. Japan-specific fields (address_kana, address_kanji, name_kana, name_kanji) and other rarely-used fields (maiden_name, nationality, political_exposure, registered_address, gender, full_name_aliases) have been removed to simplify the API.",
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: PERSON_ATTRIBUTES,
          moreAttributes: PERSON_MORE_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE PERSON OBJECT',
          code: PERSON_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Create Person Parameters
// ============================================
const CREATE_PERSON_PARAMETERS: Attribute[] = [
  {
    name: 'address',
    type: 'object',
    description: "The person's address.",
    expandable: true,
    children: [
      {
        name: 'city',
        type: 'string',
        description:
          'City, district, suburb, town, or village. Maximum 100 characters.',
      },
      {
        name: 'country',
        type: 'string',
        description:
          'Two-letter country code (<a href="https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2">ISO 3166-1 alpha-2</a>).',
      },
      {
        name: 'line1',
        type: 'string',
        description:
          'Address line 1, such as the street, PO Box, or company name. Maximum 200 characters.',
      },
      {
        name: 'line2',
        type: 'string',
        description:
          'Address line 2, such as the apartment, suite, unit, or building. Maximum 200 characters.',
      },
      {
        name: 'postal_code',
        type: 'string',
        description: 'ZIP or postal code.',
      },
      {
        name: 'state',
        type: 'string',
        description:
          'State, county, province, or region (<a href="https://en.wikipedia.org/wiki/ISO_3166-2">ISO 3166-2</a>).',
      },
    ],
  },
  {
    name: 'dob',
    type: 'object',
    description: "The person's date of birth.",
    expandable: true,
    children: [
      {
        name: 'day',
        type: 'integer',
        required: true,
        description: 'The day of birth, between 1 and 31.',
      },
      {
        name: 'month',
        type: 'integer',
        required: true,
        description: 'The month of birth, between 1 and 12.',
      },
      {
        name: 'year',
        type: 'integer',
        required: true,
        description: 'The four-digit year of birth.',
      },
    ],
  },
  {
    name: 'email',
    type: 'string',
    description: "The person's email address. Maximum 800 characters.",
  },
  {
    name: 'first_name',
    type: 'string',
    description: "The person's first name. Maximum 100 characters.",
  },
  {
    name: 'id_number',
    type: 'string',
    description:
      "The person's ID number, as appropriate for their country. For example, a social security number in the U.S., social insurance number in Canada, etc. The value is not stored; only a flag indicating it was provided is set.",
  },
  {
    name: 'last_name',
    type: 'string',
    description: "The person's last name. Maximum 100 characters.",
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
  },
  {
    name: 'phone',
    type: 'string',
    description: "The person's phone number.",
  },
  {
    name: 'relationship',
    type: 'object',
    description:
      "The relationship that this person has with the account's legal entity.",
    expandable: true,
    children: [
      {
        name: 'authorizer',
        type: 'boolean',
        description:
          "Whether the person is the authorizer of the account's representative.",
      },
      {
        name: 'director',
        type: 'boolean',
        description:
          "Whether the person is a director of the account's legal entity.",
      },
      {
        name: 'executive',
        type: 'boolean',
        description:
          'Whether the person has significant responsibility to control, manage, or direct the organization.',
      },
      {
        name: 'legal_guardian',
        type: 'boolean',
        description:
          "Whether the person is the legal guardian of the account's representative.",
      },
      {
        name: 'owner',
        type: 'boolean',
        description:
          "Whether the person is an owner of the account's legal entity.",
      },
      {
        name: 'percent_ownership',
        type: 'float',
        description:
          "The percent owned by the person of the account's legal entity.",
      },
      {
        name: 'representative',
        type: 'boolean',
        description:
          'Whether the person is authorized as the primary representative of the account. There can only be one representative at any given time.',
      },
      {
        name: 'title',
        type: 'string',
        description:
          "The person's title (e.g., CEO, Support Engineer). Maximum 100 characters.",
      },
    ],
  },
  {
    name: 'ssn_last_4',
    type: 'string',
    description:
      "The last four digits of the person's Social Security number (U.S. only). Must be exactly 4 digits. The value is not stored; only a flag indicating it was provided is set.",
  },
  {
    name: 'verification',
    type: 'object',
    description: "The person's verification documents.",
    expandable: true,
    children: [
      {
        name: 'additional_document',
        type: 'object',
        description:
          'A document showing address, either a passport, local ID card, or utility bill.',
        children: [
          {
            name: 'back',
            type: 'string',
            description:
              'The back of an ID returned by a file upload with a <code>purpose</code> value of <code>identity_document</code>. Maximum 500 characters.',
          },
          {
            name: 'front',
            type: 'string',
            description:
              'The front of an ID returned by a file upload with a <code>purpose</code> value of <code>identity_document</code>. Maximum 500 characters.',
          },
        ],
      },
      {
        name: 'document',
        type: 'object',
        description:
          'An identifying document, either a passport or local ID card.',
        children: [
          {
            name: 'back',
            type: 'string',
            description:
              'The back of an ID returned by a file upload with a <code>purpose</code> value of <code>identity_document</code>. Maximum 500 characters.',
          },
          {
            name: 'front',
            type: 'string',
            description:
              'The front of an ID returned by a file upload with a <code>purpose</code> value of <code>identity_document</code>. Maximum 500 characters.',
          },
        ],
      },
    ],
  },
];

const CREATE_PERSON_RESPONSE_JSON = `{
  "id": "person_z_1Nv0FGQ9RKHgCVdK",
  "object": "person",
  "account": "acct_z_1032D82eZvKYlo2C",
  "address": null,
  "created": 1684518375,
  "dob": {
    "day": null,
    "month": null,
    "year": null
  },
  "email": null,
  "first_name": "John",
  "future_requirements": {
    "alternatives": [],
    "currently_due": [],
    "errors": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
  "id_number_provided": false,
  "last_name": "Doe",
  "metadata": {},
  "phone": null,
  "platform_account": "acct_z_Platform123abc",
  "relationship": {
    "authorizer": null,
    "director": false,
    "executive": false,
    "legal_guardian": null,
    "owner": false,
    "percent_ownership": null,
    "representative": false,
    "title": null
  },
  "requirements": {
    "alternatives": [],
    "currently_due": [],
    "errors": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
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
}`;

export const PERSONS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a person',
  description:
    'Creates a new person associated with an account. You can create persons to represent owners, directors, executives, or representatives of a business.',
  endpoints: [{ method: 'POST', path: '/v1/accounts/:id/persons' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'All fields optional: ',
          text: 'All parameters are optional when creating a person. You can create a minimal person and update it later with additional information.',
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_PERSON_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Person</code> object if the call succeeds.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/accounts/:id/persons' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/accounts/acct_z_1032D82eZvKYlo2C/persons \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d first_name=John \\
  -d last_name=Doe`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const person = await zoneless.accounts.createPerson(
  'acct_z_1032D82eZvKYlo2C',
  {
    first_name: 'John',
    last_name: 'Doe',
  }
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: CREATE_PERSON_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Update Person Parameters
// ============================================
const UPDATE_PERSON_PARAMETERS: Attribute[] = [
  {
    name: 'address',
    type: 'object',
    description: "The person's address.",
    expandable: true,
    children: [
      {
        name: 'city',
        type: 'string',
        description:
          'City, district, suburb, town, or village. Maximum 100 characters.',
      },
      {
        name: 'country',
        type: 'string',
        description:
          'Two-letter country code (<a href="https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2">ISO 3166-1 alpha-2</a>).',
      },
      {
        name: 'line1',
        type: 'string',
        description:
          'Address line 1, such as the street, PO Box, or company name. Maximum 200 characters.',
      },
      {
        name: 'line2',
        type: 'string',
        description:
          'Address line 2, such as the apartment, suite, unit, or building. Maximum 200 characters.',
      },
      {
        name: 'postal_code',
        type: 'string',
        description: 'ZIP or postal code.',
      },
      {
        name: 'state',
        type: 'string',
        description:
          'State, county, province, or region (<a href="https://en.wikipedia.org/wiki/ISO_3166-2">ISO 3166-2</a>).',
      },
    ],
  },
  {
    name: 'dob',
    type: 'object',
    description: "The person's date of birth.",
    expandable: true,
    children: [
      {
        name: 'day',
        type: 'integer',
        required: true,
        description: 'The day of birth, between 1 and 31.',
      },
      {
        name: 'month',
        type: 'integer',
        required: true,
        description: 'The month of birth, between 1 and 12.',
      },
      {
        name: 'year',
        type: 'integer',
        required: true,
        description: 'The four-digit year of birth.',
      },
    ],
  },
  {
    name: 'email',
    type: 'string',
    description: "The person's email address. Maximum 800 characters.",
  },
  {
    name: 'first_name',
    type: 'string',
    description: "The person's first name. Maximum 100 characters.",
  },
  {
    name: 'id_number',
    type: 'string',
    description:
      "The person's ID number, as appropriate for their country. For example, a social security number in the U.S., social insurance number in Canada, etc. The value is not stored; only a flag indicating it was provided is set.",
  },
  {
    name: 'last_name',
    type: 'string',
    description: "The person's last name. Maximum 100 characters.",
  },
  {
    name: 'metadata',
    type: 'object',
    description:
      'Set of key-value pairs that you can attach to an object. Individual keys can be unset by posting an empty value to them. All keys can be unset by posting an empty value to <code>metadata</code>.',
  },
  {
    name: 'phone',
    type: 'string',
    description: "The person's phone number.",
  },
  {
    name: 'relationship',
    type: 'object',
    description:
      "The relationship that this person has with the account's legal entity.",
    expandable: true,
    children: [
      {
        name: 'authorizer',
        type: 'boolean',
        description:
          "Whether the person is the authorizer of the account's representative.",
      },
      {
        name: 'director',
        type: 'boolean',
        description:
          "Whether the person is a director of the account's legal entity.",
      },
      {
        name: 'executive',
        type: 'boolean',
        description:
          'Whether the person has significant responsibility to control, manage, or direct the organization.',
      },
      {
        name: 'legal_guardian',
        type: 'boolean',
        description:
          "Whether the person is the legal guardian of the account's representative.",
      },
      {
        name: 'owner',
        type: 'boolean',
        description:
          "Whether the person is an owner of the account's legal entity.",
      },
      {
        name: 'percent_ownership',
        type: 'float',
        description:
          "The percent owned by the person of the account's legal entity.",
      },
      {
        name: 'representative',
        type: 'boolean',
        description:
          'Whether the person is authorized as the primary representative of the account. There can only be one representative at any given time.',
      },
      {
        name: 'title',
        type: 'string',
        description:
          "The person's title (e.g., CEO, Support Engineer). Maximum 100 characters.",
      },
    ],
  },
  {
    name: 'ssn_last_4',
    type: 'string',
    description:
      "The last four digits of the person's Social Security number (U.S. only). Must be exactly 4 digits. The value is not stored; only a flag indicating it was provided is set.",
  },
  {
    name: 'verification',
    type: 'object',
    description: "The person's verification documents.",
    expandable: true,
    children: [
      {
        name: 'additional_document',
        type: 'object',
        description:
          'A document showing address, either a passport, local ID card, or utility bill.',
        children: [
          {
            name: 'back',
            type: 'string',
            description:
              'The back of an ID returned by a file upload with a <code>purpose</code> value of <code>identity_document</code>. Maximum 500 characters.',
          },
          {
            name: 'front',
            type: 'string',
            description:
              'The front of an ID returned by a file upload with a <code>purpose</code> value of <code>identity_document</code>. Maximum 500 characters.',
          },
        ],
      },
      {
        name: 'document',
        type: 'object',
        description:
          'An identifying document, either a passport or local ID card.',
        children: [
          {
            name: 'back',
            type: 'string',
            description:
              'The back of an ID returned by a file upload with a <code>purpose</code> value of <code>identity_document</code>. Maximum 500 characters.',
          },
          {
            name: 'front',
            type: 'string',
            description:
              'The front of an ID returned by a file upload with a <code>purpose</code> value of <code>identity_document</code>. Maximum 500 characters.',
          },
        ],
      },
    ],
  },
];

const UPDATE_PERSON_RESPONSE_JSON = `{
  "id": "person_z_1MqjB62eZvKYlo2CaeEJzKVR",
  "object": "person",
  "account": "acct_z_1032D82eZvKYlo2C",
  "address": null,
  "created": 1680035496,
  "dob": {
    "day": null,
    "month": null,
    "year": null
  },
  "email": null,
  "first_name": "Jane",
  "future_requirements": {
    "alternatives": [],
    "currently_due": [],
    "errors": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
  "id_number_provided": false,
  "last_name": "Diaz",
  "metadata": {
    "order_id": "6735"
  },
  "phone": null,
  "platform_account": "acct_z_Platform123abc",
  "relationship": {
    "authorizer": null,
    "director": false,
    "executive": false,
    "legal_guardian": null,
    "owner": false,
    "percent_ownership": null,
    "representative": false,
    "title": null
  },
  "requirements": {
    "alternatives": [],
    "currently_due": [],
    "errors": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
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
}`;

export const PERSONS_UPDATE_PAGE: DocPage = {
  id: 'update',
  title: 'Update a person',
  description:
    'Updates an existing person. Any parameters not provided are left unchanged.',
  endpoints: [{ method: 'POST', path: '/v1/accounts/:id/persons/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: UPDATE_PERSON_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Person</code> object if the call succeeds.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/accounts/:id/persons/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/accounts/acct_z_1032D82eZvKYlo2C/persons/person_z_1MqjB62eZvKYlo2CaeEJzKVR \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d "metadata[order_id]"=6735`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const person = await zoneless.accounts.updatePerson(
  'acct_z_1032D82eZvKYlo2C',
  'person_z_1MqjB62eZvKYlo2CaeEJzKVR',
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
          code: UPDATE_PERSON_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Retrieve Person
// ============================================
const RETRIEVE_PERSON_RESPONSE_JSON = `{
  "id": "person_z_1N9XNb2eZvKYlo2CjPX7xF6F",
  "object": "person",
  "account": "acct_z_1032D82eZvKYlo2C",
  "address": null,
  "created": 1684518375,
  "dob": {
    "day": null,
    "month": null,
    "year": null
  },
  "email": null,
  "first_name": null,
  "future_requirements": {
    "alternatives": [],
    "currently_due": [],
    "errors": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
  "id_number_provided": false,
  "last_name": null,
  "metadata": {},
  "phone": null,
  "platform_account": "acct_z_Platform123abc",
  "relationship": {
    "authorizer": null,
    "director": false,
    "executive": false,
    "legal_guardian": null,
    "owner": false,
    "percent_ownership": null,
    "representative": false,
    "title": null
  },
  "requirements": {
    "alternatives": [],
    "currently_due": [],
    "errors": [],
    "eventually_due": [],
    "past_due": [],
    "pending_verification": []
  },
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
}`;

export const PERSONS_RETRIEVE_PAGE: DocPage = {
  id: 'retrieve',
  title: 'Retrieve a person',
  description: 'Retrieves an existing person.',
  endpoints: [{ method: 'GET', path: '/v1/accounts/:id/persons/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>Person</code> object if the call succeeds. If the person ID does not exist or does not belong to the account, this call raises an error.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/accounts/:id/persons/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/accounts/acct_z_1032D82eZvKYlo2C/persons/person_z_1MqjB62eZvKYlo2CaeEJzKVR \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const person = await zoneless.accounts.retrievePerson(
  'acct_z_1032D82eZvKYlo2C',
  'person_z_1MqjB62eZvKYlo2CaeEJzKVR'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: RETRIEVE_PERSON_RESPONSE_JSON,
        },
      ],
    },
  ],
};

// ============================================
// List Persons Parameters
// ============================================
const LIST_PERSONS_PARAMETERS: Attribute[] = [
  {
    name: 'ending_before',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>ending_before</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, starting with <code>person_z_bar</code>, your subsequent call can include <code>ending_before=person_z_bar</code> in order to fetch the previous page of the list.',
  },
  {
    name: 'limit',
    type: 'integer',
    description:
      'A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10.',
  },
  {
    name: 'relationship',
    type: 'object',
    description:
      "Filters on the list of people returned based on the person's relationship to the account's company.",
    expandable: true,
    children: [
      {
        name: 'authorizer',
        type: 'boolean',
        description:
          "A filter on the list of people returned based on whether these people are authorizers of the account's representative.",
      },
      {
        name: 'director',
        type: 'boolean',
        description:
          "A filter on the list of people returned based on whether these people are directors of the account's company.",
      },
      {
        name: 'executive',
        type: 'boolean',
        description:
          "A filter on the list of people returned based on whether these people are executives of the account's company.",
      },
      {
        name: 'legal_guardian',
        type: 'boolean',
        description:
          "A filter on the list of people returned based on whether these people are legal guardians of the account's representative.",
      },
      {
        name: 'owner',
        type: 'boolean',
        description:
          "A filter on the list of people returned based on whether these people are owners of the account's company.",
      },
      {
        name: 'representative',
        type: 'boolean',
        description:
          "A filter on the list of people returned based on whether these people are the representative of the account's company.",
      },
    ],
  },
  {
    name: 'starting_after',
    type: 'string',
    description:
      'A cursor for use in pagination. <code>starting_after</code> is an object ID that defines your place in the list. For instance, if you make a list request and receive 100 objects, ending with <code>person_z_foo</code>, your subsequent call can include <code>starting_after=person_z_foo</code> in order to fetch the next page of the list.',
  },
];

const LIST_PERSONS_RESPONSE_JSON = `{
  "object": "list",
  "url": "/v1/accounts/acct_z_1032D82eZvKYlo2C/persons",
  "has_more": false,
  "data": [
    {
      "id": "person_z_1MqjB62eZvKYlo2CaeEJzKVR",
      "object": "person",
      "account": "acct_z_1032D82eZvKYlo2C",
      "address": null,
      "created": 1680035496,
      "dob": {
        "day": null,
        "month": null,
        "year": null
      },
      "email": null,
      "first_name": "Jane",
      "future_requirements": {
        "alternatives": [],
        "currently_due": [],
        "errors": [],
        "eventually_due": [],
        "past_due": [],
        "pending_verification": []
      },
      "id_number_provided": false,
      "last_name": "Diaz",
      "metadata": {},
      "phone": null,
      "platform_account": "acct_z_Platform123abc",
      "relationship": {
        "authorizer": null,
        "director": false,
        "executive": false,
        "legal_guardian": null,
        "owner": false,
        "percent_ownership": null,
        "representative": false,
        "title": null
      },
      "requirements": {
        "alternatives": [],
        "currently_due": [],
        "errors": [],
        "eventually_due": [],
        "past_due": [],
        "pending_verification": []
      },
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
    }
  ]
}`;

export const PERSONS_LIST_PAGE: DocPage = {
  id: 'list',
  title: 'List all persons',
  description:
    "Returns a list of people associated with the account's legal entity. The people are returned sorted by creation date, with the most recent people appearing first.",
  endpoints: [{ method: 'GET', path: '/v1/accounts/:id/persons' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No required parameters.' },
        {
          type: 'attributes',
          attributes: [],
          moreAttributes: LIST_PERSONS_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'A dictionary with a <code>data</code> property that contains an array of up to <code>limit</code> people, starting after person <code>starting_after</code>. Each entry in the array is a separate <a href="#persons-object">Person</a> object. If no more people are available, the resulting array will be empty.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/accounts/:id/persons' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -G https://api.yourdomain.com/v1/accounts/acct_z_1032D82eZvKYlo2C/persons \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d limit=3`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const persons = await zoneless.accounts.listPersons(
  'acct_z_1032D82eZvKYlo2C',
  {
    limit: 3,
  }
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: LIST_PERSONS_RESPONSE_JSON },
      ],
    },
  ],
};

// ============================================
// Delete Person
// ============================================
const DELETE_PERSON_RESPONSE_JSON = `{
  "id": "person_z_1MqjB62eZvKYlo2CaeEJzKVR",
  "object": "person",
  "deleted": true
}`;

export const PERSONS_DELETE_PAGE: DocPage = {
  id: 'delete',
  title: 'Delete a person',
  description:
    "Deletes an existing person's relationship to the account's legal entity.",
  endpoints: [{ method: 'DELETE', path: '/v1/accounts/:id/persons/:id' }],
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the deleted <code>Person</code> object with a <code>deleted</code> property set to <code>true</code>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'DELETE', path: '/v1/accounts/:id/persons/:id' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X DELETE https://api.yourdomain.com/v1/accounts/acct_z_1032D82eZvKYlo2C/persons/person_z_1MqjB62eZvKYlo2CaeEJzKVR \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const deleted = await zoneless.accounts.deletePerson(
  'acct_z_1032D82eZvKYlo2C',
  'person_z_1MqjB62eZvKYlo2CaeEJzKVR'
);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: DELETE_PERSON_RESPONSE_JSON,
        },
      ],
    },
  ],
};

export const PERSONS_PAGES: DocPage[] = [
  PERSONS_OVERVIEW_PAGE,
  PERSONS_CREATE_PAGE,
  PERSONS_UPDATE_PAGE,
  PERSONS_RETRIEVE_PAGE,
  PERSONS_LIST_PAGE,
  PERSONS_DELETE_PAGE,
];
