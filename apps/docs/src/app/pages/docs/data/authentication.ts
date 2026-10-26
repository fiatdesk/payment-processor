import { DocPage } from './types';

export const AUTHENTICATION_PAGE: DocPage = {
  id: 'authentication',
  title: 'Authentication',
  description: 'Authenticate Zoneless API requests with a secret API key.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'Every API request must include a secret API key. Live keys start with <code>sk_live_z_</code> and test keys start with <code>sk_test_z_</code>.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Keep secret keys on your server. ',
          text: 'Do not put an API key in browser code, mobile apps, public repositories, or messages. Load it from an environment variable or secret manager.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Choose an environment' },
        {
          type: 'paragraph',
          text: 'Zoneless Cloud has separate live and test environments. Use a key with the matching API URL.',
        },
        {
          type: 'list',
          items: [
            {
              text: '<strong>Live:</strong> <code>https://api.zoneless.com</code> with an <code>sk_live_z_</code> key. Live mode uses Solana mainnet and real USDC.',
              html: true,
            },
            {
              text: '<strong>Test:</strong> <code>https://api-test.zoneless.com</code> with an <code>sk_test_z_</code> key. Test mode uses simulated USDC, so you can try payments without a wallet or faucet.',
              html: true,
            },
          ],
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Keys cannot be used across environments. ',
          text: 'A live key will not work with the test API, and a test key will not work with the live API.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Environment variables',
          tabs: [
            {
              id: 'live',
              label: 'Live',
              code: `ZONELESS_API_KEY=sk_live_z_YOUR_API_KEY
ZONELESS_API_URL=https://api.zoneless.com`,
            },
            {
              id: 'test',
              label: 'Test',
              code: `ZONELESS_API_KEY=sk_test_z_YOUR_API_KEY
ZONELESS_API_URL=https://api-test.zoneless.com`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Get an API key' },
        {
          type: 'heading',
          level: 3,
          text: 'Zoneless Cloud',
        },
        {
          type: 'paragraph',
          text: 'Your first live key is shown when you create your account. To create or revoke a key later, open <strong>Developers</strong> in the <a href="/platform-dashboard">Platform Dashboard</a>. Switch between live and test mode before managing keys.',
          html: true,
        },
        {
          type: 'heading',
          level: 3,
          text: 'Self-hosted Zoneless',
        },
        {
          type: 'paragraph',
          text: 'The <a href="/self-hosting">setup wizard</a> creates your first platform API key. Your API URL is the address of your instance, such as <code>http://localhost</code> during local development or <code>https://api.yourdomain.com</code> in production.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Authenticate a request' },
        {
          type: 'paragraph',
          text: 'Send your secret key in the <code>x-api-key</code> header with every direct API request.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'The example reads the key from an environment variable, which keeps it out of shell history and source code.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Authenticated request',
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `export ZONELESS_API_KEY="sk_live_z_YOUR_API_KEY"

curl https://api.zoneless.com/v1/balance \\
  -H "x-api-key: $ZONELESS_API_KEY"`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Use the Node.js SDK' },
        {
          type: 'paragraph',
          text: 'Pass the API key and base URL when you create the client. The SDK adds the authentication header to each request.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Keep client initialization in server-side code. Do not import a client containing your secret key into an Angular or other browser bundle.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Initialize the client',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: `import { Zoneless } from '@zoneless/node';

const apiKey = process.env.ZONELESS_API_KEY;
const apiUrl = process.env.ZONELESS_API_URL;

if (!apiKey || !apiUrl) {
  throw new Error('Missing Zoneless configuration');
}

const zoneless = new Zoneless(apiKey, apiUrl);

const balance = await zoneless.balance.retrieve();`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Rotate or revoke a key' },
        {
          type: 'paragraph',
          text: 'Create a replacement key before revoking the old one. Update the secret in your application, deploy the change, confirm that requests succeed, then revoke the old key.',
        },
        {
          type: 'paragraph',
          text: 'If a key is exposed, revoke it immediately and replace it anywhere it was used. Check logs and recent activity for requests you do not recognize.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Authentication errors' },
        {
          type: 'paragraph',
          text: 'A request without a valid key returns an authentication error. Check that:',
        },
        {
          type: 'list',
          items: [
            {
              text: 'The <code>x-api-key</code> header is present.',
              html: true,
            },
            {
              text: 'The key has not been revoked or copied with extra spaces.',
            },
            { text: 'The key prefix matches the live or test API URL.' },
            {
              text: 'Your self-hosted instance URL points to the API, not the dashboard.',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'See <a href="/errors">Errors</a> for response formats and other API error types.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Next steps' },
        {
          type: 'list',
          items: [
            {
              text: '<strong><a href="/api-quickstart">API quickstart</a>:</strong> Make your first Connect API requests',
              html: true,
            },
            {
              text: '<strong><a href="/checkout-api-quickstart">Checkout API quickstart</a>:</strong> Accept a USDC payment',
              html: true,
            },
            {
              text: '<strong><a href="/webhooks">Webhooks</a>:</strong> Verify signed events sent to your server',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
