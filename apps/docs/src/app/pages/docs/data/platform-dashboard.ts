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
          text: 'On FiatDesk Cloud, sign in to your <a href="https://pay.yourdomain.com">FiatDesk account</a> and click <strong>Open FiatDesk Dashboard</strong>. If you self-host, use the dashboard URL for your own instance.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Find your way around' },
        {
          type: 'paragraph',
          text: 'The sidebar groups the dashboard into these areas:',
        },
        {
          type: 'list',
          items: [
            {
              text: "<strong>Home:</strong> Today's volume, an overview chart and recent activity.",
              html: true,
            },
            {
              text: '<strong>Balances:</strong> Your platform balance, what connected accounts are owed, and transfers, payouts and top-ups.',
              html: true,
            },
            {
              text: '<strong>Connected accounts:</strong> Your sellers, their onboarding status and their balances.',
              html: true,
            },
            {
              text: '<strong>Payments, Payment Links, Customers, Products, Subscriptions and Invoices:</strong> Collecting USDC with FiatDesk.',
              html: true,
            },
            {
              text: '<strong>Developers:</strong> API keys, webhooks and events.',
              html: true,
            },
            {
              text: '<strong>Settings:</strong> Business details, identity verification and your platform wallets.',
              html: true,
            },
          ],
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
          text: 'Seller payouts come from your default platform wallet. The dashboard shows its USDC balance and the connected account balances recorded by FiatDesk.',
        },
        {
          type: 'list',
          items: [
            {
              text: '<strong><a href="/fund-platform-wallet">Add funds</a>:</strong> Buy USDC and send it to your platform wallet.',
              html: true,
            },
            {
              text: '<strong><a href="/transfers">Transfer funds</a>:</strong> Credit a connected account\'s FiatDesk balance.',
              html: true,
            },
            {
              text: '<strong><a href="/payouts">Create a payout</a>:</strong> Send USDC from that balance to the seller\'s Ethereum wallet.',
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
        { type: 'heading', level: 3, text: 'Fund a connected account' },
        {
          type: 'list',
          items: [
            {
              text: '1. Open <strong>Connected accounts</strong> and select the seller.',
              html: true,
            },
            {
              text: '2. Choose <strong>Add funds</strong> and enter the amount in USDC.',
              html: true,
            },
            {
              text: "3. Confirm. The amount moves from your platform balance to the seller's balance, ready for a payout.",
            },
          ],
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
        {
          type: 'paragraph',
          text: "The Express Dashboard only shows the connected account's own data: its balance, its payouts, its account details and its payout wallet.",
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
          text: 'FiatDesk Cloud has separate live and test environments. Live mode uses Ethereum mainnet and real USDC. Test mode uses simulated USDC, so you can test checkout, payouts, and subscriptions without a wallet or faucet.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Wallets' },
        {
          type: 'paragraph',
          text: "Open <strong>Settings → Wallets</strong> to manage your platform's Ethereum wallets. You can keep up to 5. One of them is the <strong>default</strong>, marked with a Default badge: it receives checkout payments, subscription charges and top-ups, and it signs payouts. Only USDC in the default wallet counts toward your balance.",
          html: true,
        },
        {
          type: 'list',
          items: [
            {
              text: '<strong>Add wallet:</strong> Enter an Ethereum address and tick <strong>Make this the default</strong> to switch to it at once.',
              html: true,
            },
            {
              text: "<strong>Set as default:</strong> On another wallet's row. A confirmation lists what moves (checkouts, top-ups, payouts and subscription plans) and how many plans are updated on-chain.",
              html: true,
            },
            {
              text: '<strong>Remove:</strong> On any wallet but the default, after a confirmation. Set another wallet as the default first to remove the current one.',
              html: true,
            },
            {
              text: 'Each address can be copied. A wallet whose plans are still moving shows "Updating N plans on-chain".',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'If USDC arrives at a wallet that is not the default, Home and Balances show a banner: "USDC arrived at your previous wallet 0x…. Send it to your current wallet 0x… to make it available for payouts." Send the funds to the default wallet, then press <strong>I\'ve moved it</strong> to dismiss the banner.',
          html: true,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: 'Changing your platform wallet',
        },
        {
          type: 'paragraph',
          text: 'Setting another wallet as the default moves everything the default does:',
        },
        {
          type: 'list',
          items: [
            {
              text: 'New checkouts pay the new wallet. A customer who prepared a payment before the change is asked to approve it again; a payment already submitted to the old wallet still completes.',
            },
            {
              text: 'Top-ups are counted on the new wallet only.',
            },
            {
              text: 'Payouts are signed from the new wallet. The change waits while a payout batch of the old wallet is built or broadcast.',
            },
            {
              text: "Subscription plans move on-chain: FiatDesk sends each plan's destination change without waiting, and charges of a plan pause until its change confirms, so no renewal pays the old wallet.",
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'FiatDesk keeps watching your other wallets: active ones that are not the default, and removed ones for 30 days. USDC sent to them raises the banner above and is never added to your balance. See <a href="/self-hosting">Self-hosting</a> for what the API does on a switch.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Payments and billing' },
        {
          type: 'paragraph',
          text: 'The dashboard also includes Checkout, Payment Links, customers, products, subscriptions, and invoices. These are available if you want to collect USDC with FiatDesk, but they are not required to use connected accounts and payouts.',
        },
        {
          type: 'paragraph',
          text: 'You can keep collecting customer payments with Stripe and use FiatDesk only for seller onboarding and USDC payouts. See <a href="/migrate-from-stripe">Migrate from Stripe</a> for that setup.',
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
