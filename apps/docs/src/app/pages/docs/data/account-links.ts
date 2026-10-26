import { DocSubSection, DocPage, Attribute } from './types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const ACCOUNT_LINKS_SUBSECTION: DocSubSection = {
  id: 'account-links',
  title: 'Account Links',
  children: [
    { id: 'object', title: 'The Account Link object' },
    { id: 'create', title: 'Create an account link' },
  ],
};

// ============================================
// Shared Data
// ============================================
const ACCOUNT_LINK_OBJECT_JSON = `{
  "object": "account_link",
  "created": 1704067200,
  "expires_at": 1704070800,
  "url": "https://dashboard.yourdomain.com/onboard?token=al_z_abc123..."
}`;

const ACCOUNT_LINK_ATTRIBUTES: Attribute[] = [
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value. Always <code>account_link</code>.",
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Time at which the object was created. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'expires_at',
    type: 'timestamp',
    description:
      'The timestamp at which this account link will expire. Account links expire after 1 hour.',
  },
  {
    name: 'url',
    type: 'string',
    description:
      'The URL for the account link. Redirect the connected account holder to this URL to take them through the onboarding flow.',
  },
];

// ============================================
// Create Account Link Parameters
// ============================================
const CREATE_ACCOUNT_LINK_PARAMETERS: Attribute[] = [
  {
    name: 'account',
    type: 'string',
    required: true,
    description: 'The identifier of the account to create an account link for.',
  },
  {
    name: 'type',
    type: 'enum',
    required: true,
    description: 'The type of account link the user is requesting.',
    enumValues: [
      {
        value: 'account_onboarding',
        description:
          'Provides a form for inputting outstanding requirements. Send the user to the form in this mode to collect the information you need.',
      },
      {
        value: 'account_update',
        description:
          'Displays the fields that are already populated on the account object, and allows your user to edit previously provided information. Consider framing this as "edit my profile" or "update my verification information".',
      },
    ],
  },
  {
    name: 'refresh_url',
    type: 'string',
    required: true,
    description:
      "The URL the user will be redirected to if the account link is expired, has been previously-visited, or is otherwise invalid. The URL you specify should attempt to generate a new account link with the same parameters used to create the original account link, then redirect the user to the new account link's URL so they can continue with onboarding. If a new account link cannot be generated or the redirect fails you should display a useful error to the user.",
  },
  {
    name: 'return_url',
    type: 'string',
    required: true,
    description:
      'The URL that the user will be redirected to upon leaving or completing the linked flow.',
  },
];

// ============================================
// Pages
// ============================================
export const ACCOUNT_LINKS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Account Link object',
  description:
    'Account Links are the means by which a platform grants a connected account permission to access Zoneless-hosted applications, such as the onboarding flow.',
  stripeDocsUrl: 'https://docs.stripe.com/api/account_links',
  endpoints: BuildEndpointSummaries(ACCOUNT_LINKS_SUBSECTION, [
    { method: 'POST', path: '/v1/account_links', pageId: 'create' },
  ]),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: 'Account links are single-use URLs that expire after 1 hour. When the user visits the URL, they are taken through the Connect Onboarding flow to complete their account setup and connect their Solana wallet.',
        },
        {
          type: 'paragraph',
          text: 'After creating a connected account, create an account link and redirect the user to the <code>url</code> to guide them through onboarding. Once they complete onboarding or leave the flow, they will be redirected to your <code>return_url</code>.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        { type: 'attributes', attributes: ACCOUNT_LINK_ATTRIBUTES },
      ],
      right: [
        {
          type: 'object',
          title: 'THE ACCOUNT LINK OBJECT',
          code: ACCOUNT_LINK_OBJECT_JSON,
        },
      ],
    },
  ],
};

export const ACCOUNT_LINKS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create an account link',
  description:
    'Creates an AccountLink object that includes a single-use Zoneless URL that the platform can redirect their user to in order to take them through the Connect Onboarding flow.',
  endpoints: [{ method: 'POST', path: '/v1/account_links' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Tip: ',
          text: 'Account links are single-use and expire after 1 hour. Always generate a new link when redirecting users to onboarding.',
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: CREATE_ACCOUNT_LINK_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns an <code>AccountLink</code> object if the call succeeds.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/account_links' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/account_links \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d account=acct_z_1Nv0FGQ9RKHgCVdK \\
  --data-urlencode refresh_url="https://example.com/reauth" \\
  --data-urlencode return_url="https://example.com/return" \\
  -d type=account_onboarding`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const accountLink = await zoneless.accountLinks.create({
  account: 'acct_z_1Nv0FGQ9RKHgCVdK',
  refresh_url: 'https://example.com/reauth',
  return_url: 'https://example.com/return',
  type: 'account_onboarding',
});`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: ACCOUNT_LINK_OBJECT_JSON },
      ],
    },
  ],
};

export const ACCOUNT_LINKS_PAGES: DocPage[] = [
  ACCOUNT_LINKS_OVERVIEW_PAGE,
  ACCOUNT_LINKS_CREATE_PAGE,
];
