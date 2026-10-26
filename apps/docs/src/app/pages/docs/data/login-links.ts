import { DocSubSection, DocPage, Attribute } from './types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const LOGIN_LINKS_SUBSECTION: DocSubSection = {
  id: 'login-links',
  title: 'Login Links',
  children: [
    { id: 'object', title: 'The Login Link object' },
    { id: 'create', title: 'Create a login link' },
  ],
};

// ============================================
// Shared Data
// ============================================
const LOGIN_LINK_OBJECT_JSON = `{
  "object": "login_link",
  "created": 1704067200,
  "url": "https://dashboard.yourdomain.com/login?token=ll_z_abc123..."
}`;

const LOGIN_LINK_ATTRIBUTES: Attribute[] = [
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Objects of the same type share the same value. Always <code>login_link</code>.",
  },
  {
    name: 'created',
    type: 'timestamp',
    description:
      'Time at which the object was created. Measured in seconds since the Unix epoch.',
  },
  {
    name: 'url',
    type: 'string',
    description:
      'The URL for the login link. Redirect the connected account holder to this URL to take them directly to the Express Dashboard.',
  },
];

// ============================================
// Pages
// ============================================
export const LOGIN_LINKS_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Login Link object',
  description:
    'Login Links are single-use URLs that take an Express account directly to the login page for their Zoneless dashboard. A Login Link differs from an Account Link in that it takes the user directly to their Express dashboard rather than through an onboarding flow.',
  stripeDocsUrl: 'https://docs.stripe.com/api/account/login_link',
  endpoints: BuildEndpointSummaries(LOGIN_LINKS_SUBSECTION, [
    { method: 'POST', path: '/v1/accounts/:id/login_links', pageId: 'create' },
  ]),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Key concept: ',
          text: 'Login links are for returning users who have already completed onboarding. For new accounts that need to complete onboarding, use <a href="/account-links/object">Account Links</a> instead.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'You can only create login links for Express accounts that are connected to your platform. The connected account must have already completed onboarding and have access to the Express Dashboard.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        { type: 'attributes', attributes: LOGIN_LINK_ATTRIBUTES },
      ],
      right: [
        {
          type: 'object',
          title: 'THE LOGIN LINK OBJECT',
          code: LOGIN_LINK_OBJECT_JSON,
        },
      ],
    },
  ],
};

export const LOGIN_LINKS_CREATE_PAGE: DocPage = {
  id: 'create',
  title: 'Create a login link',
  description:
    'Creates a login link for a connected account to access the Express Dashboard.',
  endpoints: [{ method: 'POST', path: '/v1/accounts/:id/login_links' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'warning',
          title: 'Important: ',
          text: 'Login links are single-use and expire after 5 minutes. Always generate a new link when redirecting users to the dashboard.',
        },
        {
          type: 'paragraph',
          text: 'You can only create login links for accounts that use the Express Dashboard and are connected to your platform.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>LoginLink</code> object if the call succeeds.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/accounts/:id/login_links' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl -X POST https://api.yourdomain.com/v1/accounts/acct_z_1Nv0FGQ9RKHgCVdK/login_links \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const loginLink = await zoneless.accounts.createLoginLink(
  'acct_z_1Nv0FGQ9RKHgCVdK'
);`,
            },
          ],
        },
        { type: 'object', title: 'RESPONSE', code: LOGIN_LINK_OBJECT_JSON },
      ],
    },
  ],
};

export const LOGIN_LINKS_PAGES: DocPage[] = [
  LOGIN_LINKS_OVERVIEW_PAGE,
  LOGIN_LINKS_CREATE_PAGE,
];
