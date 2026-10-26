import { DocPage } from './types';
import { NODE_INIT } from './shared';

export const MIGRATE_FROM_STRIPE_PAGE: DocPage = {
  id: 'migrate-from-stripe',
  title: 'Migrate from Stripe',
  description:
    'Move a Stripe Connect integration to Zoneless and pay sellers in USDC on Solana.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'Zoneless is a drop-in replacement for the Connect side of a Stripe integration. Account creation, Express onboarding, transfers, payouts, and webhooks follow the same API structure, with USDC and Solana wallets in place of fiat and bank accounts.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'You can also use <a href="/checkout-api-quickstart">Zoneless Checkout</a> and the payments APIs, but you do not have to move customer payments. A common setup is to keep collecting payments with Stripe, convert the money you need for seller payouts to USDC, and <a href="/fund-platform-wallet">fund your Zoneless platform wallet</a>.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '1. Install the Zoneless SDK' },
        {
          type: 'paragraph',
          text: 'Install <code>@zoneless/node</code>. Keep the Stripe SDK if you still use it to collect customer payments.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Install',
          tabs: [
            { id: 'npm', label: 'npm', code: 'npm install @zoneless/node' },
            { id: 'yarn', label: 'yarn', code: 'yarn add @zoneless/node' },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '2. Swap the Connect client' },
        {
          type: 'paragraph',
          text: 'Change the import, client name, secret key, and API URL. Your Connect calls keep the same resource names and request shapes.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Use <code>https://api.zoneless.com</code> for Zoneless Cloud, or your own API URL if you self-host. Zoneless IDs use prefixes such as <code>acct_z_</code>, <code>tr_z_</code>, and <code>po_z_</code>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Before and after',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: `// Before
import Stripe from 'stripe';

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

// After
${NODE_INIT}

// The API call stays the same
const account = await zoneless.accounts.create({
  type: 'express',
  country: 'US',
  email: 'seller@example.com',
});`,
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
          text: '3. Rename the connected account context',
        },
        {
          type: 'paragraph',
          text: 'Requests made on behalf of a connected account need one naming change. Replace the <code>Stripe-Account</code> header with <code>Zoneless-Account</code>. In the Node.js SDK, replace <code>stripeAccount</code> with <code>zonelessAccount</code>. See <a href="/connected-accounts">Connected Accounts</a> for both examples.',
          html: true,
        },
        {
          type: 'paragraph',
          text: '<a href="/account-links">Account Links</a> still send sellers through Express onboarding. Instead of adding a bank account or debit card, the seller connects the Solana wallet where they want to receive USDC.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Connected account context',
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.zoneless.com/v1/balance \\
  -H "x-api-key: $ZONELESS_API_KEY" \\
  -H "Zoneless-Account: acct_z_1234..."`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `const balance = await zoneless.balance.retrieve({
  zonelessAccount: 'acct_z_1234...',
});`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '4. Movement of seller funds' },
        {
          type: 'paragraph',
          text: 'Moving money to a seller still uses a transfer followed by a payout:',
        },
        {
          type: 'list',
          items: [
            {
              text: 'Create a <strong><a href="/transfers">transfer</a></strong> to credit the connected account\'s Zoneless balance.',
              html: true,
            },
            {
              text: 'Create a <strong><a href="/payouts">payout</a></strong> on that account to move USDC to the seller\'s wallet.',
              html: true,
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'Creating a payout does not submit a Solana transaction. The payout stays <code>pending</code> until you call <code>payouts.processAll()</code> or <code>payouts.processBatch()</code> (or <code>build</code> and <code>broadcast</code>). That two-step flow is the same in test and live. Simulated test mode does not need a wallet signature; pass the unsigned transaction through to broadcast. The <a href="/payouts">Payouts API reference</a> covers the endpoints.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Keep the signing key on your server. ',
          text: 'Payout processing uses your platform wallet secret key. Store it in a secret manager or environment variable and never send it to the browser.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '5. Check the API differences' },
        {
          type: 'paragraph',
          text: 'Review these changes before moving your integration:',
        },
        { type: 'heading', level: 3, text: 'USDC instead of fiat' },
        {
          type: 'paragraph',
          text: 'Use <code>usdc</code> instead of fiat currency codes such as <code>usd</code>. Amounts use cents, so <code>1000</code> represents 10.00 USDC. If your revenue starts in Stripe or a bank account, follow the <a href="/fund-platform-wallet">platform wallet funding guide</a>. You can use the <a href="/topups">Top-ups API</a> to track deposits.',
          html: true,
        },
        { type: 'heading', level: 3, text: 'Wallets instead of bank accounts' },
        {
          type: 'paragraph',
          text: 'The <code>external_accounts</code> collection contains Solana wallets. Wallet objects use the <code>wa_z_</code> prefix and expose a <code>wallet_address</code> instead of bank routing and account numbers. See <a href="/external-wallets">External Wallets</a>.',
          html: true,
        },
        { type: 'heading', level: 3, text: 'On-chain payout processing' },
        {
          type: 'paragraph',
          text: 'Your platform signs payout transactions and submits them to Solana. A payout remains pending until you process it. See <a href="/payouts">Payouts</a> for the SDK helpers and custom signing endpoints.',
          html: true,
        },
        { type: 'heading', level: 3, text: 'Payout timing' },
        {
          type: 'paragraph',
          text: 'Zoneless payouts default to <code>instant</code>. Once submitted, Solana transactions usually confirm within seconds. Payout statuses and failure fields are documented in the <a href="/payouts">Payout object</a>.',
          html: true,
        },
        { type: 'heading', level: 3, text: 'Webhook signatures' },
        {
          type: 'paragraph',
          text: 'Replace <code>stripe.webhooks</code> with <code>zoneless.webhooks</code>, and read the signature from the <code>Zoneless-Signature</code> header. The raw request body and endpoint signing secret are used in the same way. See <a href="/webhooks">Webhooks</a> for a complete Express handler.',
          html: true,
        },
        { type: 'heading', level: 3, text: 'Cloud or self-hosted' },
        {
          type: 'paragraph',
          text: 'Zoneless Cloud uses <code>https://api.zoneless.com</code>. If you <a href="/self-hosting">self-host Zoneless</a>, use your instance URL when you create the SDK client and when you make direct API requests.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Verify webhook signatures',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: `// Before:
// const event = stripe.webhooks.constructEvent(
//   req.rawBody,
//   req.headers['stripe-signature'],
//   webhookSecret
// );

// After:
const event = zoneless.webhooks.constructEvent(
  req.rawBody,
  req.headers['zoneless-signature'],
  webhookSecret
);`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '6. Test the full seller flow' },
        {
          type: 'paragraph',
          text: 'Before switching production traffic, run through the same path a seller will take:',
        },
        {
          type: 'list',
          items: [
            { text: 'Create a connected account and Account Link.' },
            { text: 'Complete onboarding and connect a Solana wallet.' },
            { text: 'Transfer USDC to the connected account balance.' },
            { text: 'Create and process a payout.' },
            {
              text: 'Confirm that your webhook handler accepts Zoneless events.',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'The <a href="/api-quickstart">API quickstart</a> walks through this flow with working Node.js and cURL examples.',
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
              text: '<strong><a href="/accounts">Accounts</a>:</strong> Create and manage connected accounts',
              html: true,
            },
            {
              text: '<strong><a href="/account-links">Account Links</a>:</strong> Send sellers through hosted onboarding',
              html: true,
            },
            {
              text: '<strong><a href="/transfers">Transfers</a>:</strong> Credit connected account balances',
              html: true,
            },
            {
              text: '<strong><a href="/payouts">Payouts</a>:</strong> Send USDC to seller wallets',
              html: true,
            },
            {
              text: '<strong><a href="/webhooks">Webhooks</a>:</strong> Update your event handling',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
