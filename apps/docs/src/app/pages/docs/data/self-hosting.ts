import { DocPage } from './types';

export const SELF_HOSTING_PAGE: DocPage = {
  id: 'self-hosting',
  title: 'Self-hosting',
  description: 'Run the Zoneless API, dashboard, and database with Docker.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'The steps below start a local instance in test mode with simulated USDC. For a public mainnet instance, follow <a href="/deployment">Deployment</a> after testing locally.',
          html: true,
        },
        {
          type: 'heading',
          level: 2,
          text: 'Prerequisites',
        },
        {
          type: 'list',
          items: [
            {
              text: '<a href="https://git-scm.com/downloads" target="_blank" rel="noopener noreferrer">Git</a>',
              html: true,
            },
            {
              text: '<a href="https://docs.docker.com/get-docker/" target="_blank" rel="noopener noreferrer">Docker</a> with Docker Compose',
              html: true,
            },
          ],
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '1. Run Zoneless with Docker',
        },
        {
          type: 'paragraph',
          text: 'Clone the repository, then build and start the containers.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Start Zoneless',
          tabs: [
            {
              id: 'docker',
              label: 'Docker',
              code: `git clone https://github.com/zonelessdev/zoneless.git
cd zoneless
docker compose up -d --build`,
            },
          ],
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '2. Check the containers',
        },
        {
          type: 'paragraph',
          text: 'Confirm that the containers are running and the API health check succeeds. The first build may take a few minutes.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Verify the installation',
          tabs: [
            {
              id: 'docker',
              label: 'Docker',
              code: `docker compose ps
curl http://localhost/api/health`,
            },
          ],
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '3. Complete the setup wizard',
        },
        {
          type: 'paragraph',
          text: 'Open <a href="http://localhost/setup">localhost/setup</a>. Create your account, generate an API key, and create or connect a Solana wallet.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Save your credentials immediately. ',
          text: 'The API key and wallet secret key are only shown once. Store them in a password manager or secret manager before leaving the page.',
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'One account per instance by default. ',
          text: 'Self-hosted instances use single-tenant mode. Hosting multiple accounts requires different <a href="/environment-variables">tenancy settings</a>.',
          html: true,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '4. Connect to the API',
        },
        {
          type: 'paragraph',
          text: 'Use the API key from setup and <code>http://localhost</code> as the base URL. See <a href="/authentication">Authentication</a> for key handling.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Initialize against your instance',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: `import { Zoneless } from '@zoneless/node';

const apiKey = process.env.ZONELESS_API_KEY;

if (!apiKey) {
  throw new Error('Missing Zoneless API key');
}

const zoneless = new Zoneless(apiKey, 'http://localhost');`,
            },
            {
              id: 'curl',
              label: 'cURL',
              code: `export ZONELESS_API_KEY="sk_test_z_YOUR_API_KEY"

curl http://localhost/v1/balance \\
  -H "x-api-key: $ZONELESS_API_KEY"`,
            },
          ],
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: 'Next steps',
        },
        {
          type: 'list',
          items: [
            {
              text: '<strong><a href="/checkout-api-quickstart">Checkout API quickstart</a>:</strong> Accept a test USDC payment',
              html: true,
            },
            {
              text: '<strong><a href="/api-quickstart">Connect API quickstart</a>:</strong> Create and pay a connected account',
              html: true,
            },
            {
              text: '<strong><a href="/environment-variables">Environment variables</a>:</strong> Configure URLs, MongoDB, settlement, and optional services',
              html: true,
            },
            {
              text: '<strong><a href="/deployment">Deployment</a>:</strong> Run Zoneless on a VPS in production',
              html: true,
            },
            {
              text: '<strong><a href="/local-development">Local Development</a>:</strong> Add test funds and debug your containers',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
