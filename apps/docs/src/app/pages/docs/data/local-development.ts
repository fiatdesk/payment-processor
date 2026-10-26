import { DocPage } from './types';

export const LOCAL_DEVELOPMENT_PAGE: DocPage = {
  id: 'local-development',
  title: 'Local Development',
  description: 'Test and debug a local Zoneless instance running in Docker.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'Start with the <a href="/self-hosting">Self-hosting guide</a>. The default Docker setup runs in test mode with simulated USDC.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Local URLs' },
        {
          type: 'list',
          items: [
            {
              text: '<strong>Dashboard:</strong> <a href="http://localhost">http://localhost</a>',
              html: true,
            },
            {
              text: '<strong>Setup:</strong> <a href="http://localhost/setup">http://localhost/setup</a>',
              html: true,
            },
            {
              text: '<strong>API health:</strong> <a href="http://localhost/api/health">http://localhost/api/health</a>',
              html: true,
            },
            {
              text: '<strong>Mongo Express:</strong> <a href="http://localhost:8082">http://localhost:8082</a>',
              html: true,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Test funds' },
        {
          type: 'paragraph',
          text: 'Test mode (<code>LIVEMODE=false</code>, the default) uses simulated USDC. Checkout shows a test wallet you can approve or decline. Payouts stay pending until processed; the dashboard runs build and broadcast for you without a signer. No Solana wallet, faucet, or network is required.',
          html: true,
        },
        { type: 'heading', level: 3, text: 'Adding test USDC' },
        {
          type: 'list',
          items: [
            {
              text: 'Open <strong>Balance</strong> in the dashboard and click <strong>Add funds</strong>.',
              html: true,
            },
            {
              text: 'Enter an amount and click <strong>Add test USDC</strong>.',
              html: true,
            },
            {
              text: 'The funds are credited to your ledger immediately.',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'You can also credit the ledger with <code>POST /v1/test_helpers/treasury/topups</code> using your platform API key.',
          html: true,
        },
        {
          type: 'heading',
          level: 3,
          text: 'Optional: test on-chain with Solana Devnet',
        },
        {
          type: 'paragraph',
          text: 'To exercise real Devnet transactions instead of simulated funds, set <code>LIVEMODE=false</code> and <code>SETTLEMENT_RAIL=onchain</code>. Then add test SOL from the <a href="https://faucet.solana.com/" target="_blank" rel="noopener noreferrer">Solana faucet</a> and test USDC from the <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer">Circle faucet</a> (select <strong>USDC</strong> and <strong>Solana Devnet</strong>). Do not send real SOL or USDC to a Devnet wallet.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'For live mode, follow <a href="/fund-platform-wallet">Fund your platform wallet</a>.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Keep test and live separate. ',
          text: 'Run separate instances and databases for test and live. Do not switch an existing instance between simulated settlement, on-chain test, and mainnet.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Viewing the database' },
        {
          type: 'paragraph',
          text: 'The local Docker setup includes <a href="https://github.com/mongo-express/mongo-express" target="_blank" rel="noopener noreferrer">Mongo Express</a> for viewing MongoDB data.',
          html: true,
        },
        {
          type: 'list',
          items: [
            {
              text: 'Open <a href="http://localhost:8082">localhost:8082</a> in your browser.',
              html: true,
            },
            {
              text: 'Log in with username <code>admin</code> and password <code>admin123</code>.',
              html: true,
            },
            {
              text: 'Browse collections to inspect objects created through the API.',
            },
          ],
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Local only. ',
          text: 'Do not expose Mongo Express or its default credentials on a public server.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Webhooks with Docker' },
        {
          type: 'paragraph',
          text: 'A container cannot reach a webhook handler on your computer through <code>localhost</code>. Use <code>host.docker.internal</code> instead.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'See <a href="/webhooks">Webhooks</a> for endpoint setup and signature verification.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Webhook URL in Docker',
          tabs: [
            {
              id: 'example',
              label: 'Example',
              code: `# Instead of this:
http://localhost:4242/webhook

# Use this when running inside Docker:
http://host.docker.internal:4242/webhook`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Following API logs' },
        {
          type: 'paragraph',
          text: 'Follow the API container logs while testing requests.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Tail API logs',
          tabs: [
            {
              id: 'bash',
              label: 'Terminal',
              code: 'docker logs --follow zoneless-api',
            },
          ],
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
              text: '<strong><a href="/environment-variables">Environment variables</a>:</strong> Change local defaults',
              html: true,
            },
            {
              text: '<strong><a href="/deployment">Deployment</a>:</strong> Run Zoneless on a server',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
