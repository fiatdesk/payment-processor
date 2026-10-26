import { DocPage } from './types';

export const PLATFORM_DASHBOARD_PAGE: DocPage = {
  id: 'platform-dashboard',
  title: 'Platform Dashboard',
  description:
    'Manage connected accounts, seller balances, payouts, and developer settings from one dashboard.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'The Platform Dashboard is the workspace for the people who run your marketplace. Use it to onboard sellers, move USDC to their balances, send payouts, and monitor account activity. Its layout follows the Stripe Dashboard, so the main workflows should feel familiar.',
        },
        {
          type: 'paragraph',
          text: 'This is separate from the Express Dashboard used by connected accounts. Sellers only see their own balance, payouts, and account details.',
        },
        {
          type: 'paragraph',
          text: 'On Zoneless Cloud, sign in to your <a href="https://zoneless.com/dashboard">Zoneless account</a> and click <strong>Open Zoneless Dashboard</strong>. If you self-host, use the dashboard URL for your own instance.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/transfers.webp',
          alt: 'Transfers in the Zoneless Platform Dashboard',
          caption:
            'View transfers between your platform and connected accounts.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Manage connected accounts' },
        {
          type: 'paragraph',
          text: 'Open <strong>Connected accounts</strong> to find a seller, check their onboarding status, view their balance, or open their account page.',
          html: true,
        },
        {
          type: 'list',
          items: [
            {
              text: 'Create connected accounts for sellers and service providers.',
            },
            {
              text: 'Copy an <a href="/account-links">Account Link</a> to send a seller through Express onboarding.',
              html: true,
            },
            {
              text: 'Check whether identity details and a payout wallet have been added.',
            },
            {
              text: 'Review balances, transfers, and payouts for an individual account.',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'For a complete walkthrough, follow the <a href="/quickstart">dashboard quickstart</a>.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Fund accounts and pay sellers' },
        {
          type: 'paragraph',
          text: 'Seller payouts come from your platform wallet. The dashboard shows its USDC balance and the connected account balances recorded by Zoneless.',
        },
        {
          type: 'list',
          items: [
            {
              text: '<strong><a href="/fund-platform-wallet">Add funds</a>:</strong> Buy USDC and send it to your platform wallet.',
              html: true,
            },
            {
              text: '<strong><a href="/transfers">Transfer funds</a>:</strong> Credit a connected account\'s Zoneless balance.',
              html: true,
            },
            {
              text: '<strong><a href="/payouts">Create a payout</a>:</strong> Send USDC from that balance to the seller\'s Solana wallet.',
              html: true,
            },
          ],
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Check payout details before sending. ',
          text: 'On-chain transfers cannot be reversed. Confirm the seller, amount, and wallet before processing a payout.',
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-8.webp',
          alt: 'Add funds to a connected account',
          caption: 'Create a transfer from the connected account page.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Give sellers dashboard access' },
        {
          type: 'paragraph',
          text: 'Connected accounts use the Express Dashboard, not the Platform Dashboard. They can view their balance and payouts, update account details, and manage their payout wallet without seeing platform-wide data.',
        },
        {
          type: 'paragraph',
          text: 'Create a <a href="/login-links">Login Link</a> when a seller needs access. Login Links are single-use and expire after five minutes, so generate a new one for each session.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Account Links and Login Links serve different purposes. ',
          text: 'Use an <a href="/account-links">Account Link</a> for onboarding or required account updates. Use a <a href="/login-links">Login Link</a> to open the seller\'s Express Dashboard.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect.webp',
          alt: 'Connected account Express Dashboard',
          caption:
            'The Express Dashboard only shows data for the connected account.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Developer settings' },
        {
          type: 'paragraph',
          text: 'Open <strong>Developers</strong> to manage the parts of your integration that run outside the dashboard.',
          html: true,
        },
        {
          type: 'list',
          items: [
            {
              text: '<strong><a href="/authentication">API keys</a>:</strong> Create and revoke keys for server-side API requests.',
              html: true,
            },
            {
              text: '<strong><a href="/webhooks">Webhooks</a>:</strong> Register endpoints and choose which events they receive.',
              html: true,
            },
            {
              text: '<strong><a href="/events">Events</a>:</strong> Review activity and inspect event payloads while debugging.',
              html: true,
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'Zoneless Cloud has separate live and test environments. Live mode uses Solana mainnet and real USDC. Test mode uses simulated USDC, so you can test checkout, payouts, and subscriptions without a wallet or faucet.',
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/webhooks-connect.webp',
          alt: 'Webhook settings in the Zoneless Platform Dashboard',
          caption:
            'Configure webhook endpoints and inspect developer activity.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Payments and billing' },
        {
          type: 'paragraph',
          text: 'The dashboard also includes Checkout, Payment Links, customers, products, subscriptions, and invoices. These are available if you want to collect USDC with Zoneless, but they are not required to use connected accounts and payouts.',
        },
        {
          type: 'paragraph',
          text: 'You can keep collecting customer payments with Stripe and use Zoneless only for seller onboarding and USDC payouts. See <a href="/migrate-from-stripe">Migrate from Stripe</a> for that setup.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Self-hosted dashboard access' },
        {
          type: 'paragraph',
          text: 'The <a href="/self-hosting">setup wizard</a> creates your platform and signs you in to the dashboard. If the session expires, open the platform login route on your instance and enter your platform API key.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Keep your API key safe. ',
          text: 'On a self-hosted instance, the platform API key can also open the dashboard. Store it as a secret and never put it in client-side code or version control.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Platform login URL',
          tabs: [
            {
              id: 'url',
              label: 'URL',
              code: `https://yourdomain.com/platform-login`,
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
              text: '<strong><a href="/quickstart">Dashboard quickstart</a>:</strong> Onboard and pay your first seller',
              html: true,
            },
            {
              text: '<strong><a href="/api-quickstart">API quickstart</a>:</strong> Build the same flow with Node.js or cURL',
              html: true,
            },
            {
              text: '<strong><a href="/identity-verification">Identity verification</a>:</strong> Add KYC checks before payouts',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
