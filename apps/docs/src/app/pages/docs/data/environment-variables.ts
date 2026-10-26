import { DocPage } from './types';

export const ENVIRONMENT_VARIABLES_PAGE: DocPage = {
  id: 'environment-variables',
  title: 'Environment variables',
  description:
    'Configure URLs, settlement, tenancy, and optional services for a self-hosted instance.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'Local Docker Compose works without an environment file. To change the defaults, copy <code>.env.example</code>. For a public instance, start with <code>.env.production.example</code>.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Do not commit secrets. ',
          text: 'Keep production environment files out of version control. Store secret values in your deployment platform or a secret manager.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Core settings',
        },
        {
          type: 'list',
          items: [
            {
              text: '<code>DASHBOARD_URL</code>: Public dashboard URL. Required in production. Local Docker derives it from <code>DASHBOARD_PORT</code> when omitted.',
              html: true,
            },
            {
              text: '<code>DASHBOARD_PORT</code>: Host port used by the Docker dashboard.',
              html: true,
            },
            {
              text: '<code>API_PORT</code>: Port used by the API. Docker Compose sets this by default.',
              html: true,
            },
            {
              text: '<code>MONGODB_URI</code>: MongoDB connection string. Leave empty to use the MongoDB container included with Compose.',
              html: true,
            },
            {
              text: '<code>APP_SECRET</code>: Signs sessions and encrypts stored values. Set it in production and keep the same value across restarts and replicas.',
              html: true,
            },
            {
              text: '<code>ZONELESS_TELEMETRY</code>: Set to <code>0</code> to disable anonymous usage reporting. Reporting is off by default unless enabled during setup.',
              html: true,
            },
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Network and settlement',
        },
        {
          type: 'list',
          items: [
            {
              text: '<code>LIVEMODE</code>: Set to <code>false</code> (default) for test mode or <code>true</code> for Solana mainnet and real USDC.',
              html: true,
            },
            {
              text: '<code>SETTLEMENT_RAIL</code>: How test mode settles money. Defaults to <code>simulated</code> (fake USDC, no blockchain). Set to <code>onchain</code> to use Solana Devnet. Invalid when <code>LIVEMODE=true</code>.',
              html: true,
            },
            {
              text: '<code>SOLANA_RPC_URL</code>: Solana RPC endpoint. Required for live mode and for <code>SETTLEMENT_RAIL=onchain</code>. When omitted, Zoneless uses the public endpoint for the selected network. Use a dedicated RPC provider in production.',
              html: true,
            },
            {
              text: '<code>SUBSCRIPTION_OPERATOR_KEY</code>: Base58 secret key that owns on-chain subscription plans. Required for recurring prices.',
              html: true,
            },
            {
              text: '<code>TRANSACTION_FEE_PAYER_KEY</code>: Optional Base58 key used to pay Checkout network fees and rent. When omitted, the customer pays through their wallet.',
              html: true,
            },
          ],
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Use separate test and live instances. ',
          text: 'Do not switch an existing database between test and live, or between simulated and on-chain settlement. Run one instance for each.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Checkout and Payment Links',
        },
        {
          type: 'list',
          items: [
            {
              text: '<code>CHECKOUT_URL</code>: Optional Checkout origin, such as <code>https://checkout.yourdomain.com</code>. When omitted, Checkout uses <code>DASHBOARD_URL/c/:id</code>.',
              html: true,
            },
            {
              text: '<code>PAYMENT_LINK_URL</code>: Optional Payment Links origin. When omitted, Zoneless uses <code>CHECKOUT_URL</code> or <code>DASHBOARD_URL/b/:id</code>.',
              html: true,
            },
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Tenancy and operator mode',
        },
        {
          type: 'list',
          items: [
            {
              text: '<code>SINGLE_TENANT</code>: Defaults to <code>true</code>. Set to <code>false</code> to allow more than one account on the instance.',
              html: true,
            },
            {
              text: '<code>OPERATOR_API_KEY</code>: Enables operator mode. This disables public setup and provisions accounts through <code>/v1/operator</code>. Operator mode ignores <code>SINGLE_TENANT</code>. Generate the key with <code>openssl rand -hex 32</code>.',
              html: true,
            },
          ],
        },
        {
          type: 'heading',
          level: 2,
          text: 'Subscription billing',
        },
        {
          type: 'paragraph',
          text: 'Self-hosted recurring billing needs a scheduled job. Use the HTTP billing endpoint in production.',
        },
        {
          type: 'list',
          items: [
            {
              text: '<code>POST /v1/billing/run_for_platform</code>: Call on a schedule with your API key. See <a href="/billing">Billing Helpers</a>.',
              html: true,
            },
            {
              text: '<code>BILLING_MONITOR_ENABLED</code>: Enables the built-in poller. Use only for local or single-instance deployments.',
              html: true,
            },
            {
              text: '<code>BILLING_POLL_INTERVAL_MS</code>: Poll interval in milliseconds. Defaults to <code>60000</code>.',
              html: true,
            },
          ],
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Using Zoneless Cloud? ',
          text: 'You do not need these settings. Use the Zoneless dashboard and <code>https://api.zoneless.com</code>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Local configuration',
          tabs: [
            {
              id: 'local',
              label: 'Local',
              code: `cp .env.example .env`,
            },
          ],
        },
        {
          type: 'code',
          title: 'Production essentials',
          tabs: [
            {
              id: 'production',
              label: '.env.production',
              code: `DASHBOARD_URL=https://dashboard.yourdomain.com
APP_SECRET=your_generated_secret
LIVEMODE=true
SINGLE_TENANT=true`,
            },
            {
              id: 'secret',
              label: 'Generate secret',
              code: `openssl rand -hex 64`,
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
              text: '<strong><a href="/self-hosting">Self-hosting</a>:</strong> Start a local instance',
              html: true,
            },
            {
              text: '<strong><a href="/deployment">Deployment</a>:</strong> Configure a production server',
              html: true,
            },
            {
              text: '<strong><a href="/local-development">Local Development</a>:</strong> Test and debug Docker',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
