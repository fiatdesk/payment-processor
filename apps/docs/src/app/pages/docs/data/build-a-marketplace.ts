import { DocPage } from './types';

export const API_QUICKSTART_PAGE: DocPage = {
  id: 'api-quickstart',
  title: 'Payouts API Quickstart',
  description:
    'Create a connected account, onboard a seller, and send their first USDC payout.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'This guide uses the Zoneless Node.js SDK and Zoneless Cloud in live mode. Prefer the dashboard? Follow the <a href="/quickstart">dashboard quickstart</a>. If you self-host, complete <a href="/self-hosting">Self-hosting</a> first and replace the cloud API URL with your instance URL.',
          html: true,
        },
        {
          type: 'heading',
          level: 2,
          text: '1. Get your API key',
        },
        {
          type: 'paragraph',
          text: 'Create a <a href="https://zoneless.com/login?view=signup">Zoneless account</a>, then copy your live secret key from the dashboard. It starts with <code>sk_live_z_</code>. Store it in an environment variable and only use it in server-side code. See <a href="/authentication">Authentication</a> for test mode and self-hosted keys.',
          html: true,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '2. Install the SDK',
        },
        {
          type: 'paragraph',
          text: 'Install the Zoneless Node.js SDK using your preferred package manager.',
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
        {
          type: 'heading',
          level: 2,
          text: '3. Initialize the client',
        },
        {
          type: 'paragraph',
          text: 'Create one Zoneless client and reuse it for the requests below.',
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

const zoneless = new Zoneless(apiKey, apiUrl);`,
            },
            {
              id: 'curl',
              label: 'cURL',
              code: `export ZONELESS_API_KEY="sk_live_z_YOUR_API_KEY"
export ZONELESS_API_URL="https://api.zoneless.com"`,
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
          text: '4. Create a connected account',
        },
        {
          type: 'paragraph',
          text: 'Create an Express connected account for the seller. Save the account ID in your database so you can use it for onboarding, transfers, payouts, and later API requests.',
        },
        {
          type: 'paragraph',
          text: 'This example requests the <code>transfers</code> capability because the account will receive funds from your platform.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Create account',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: `const account = await zoneless.accounts.create({
  type: 'express',
  country: 'US',
  email: 'seller@example.com',
  capabilities: {
    transfers: { requested: true },
  },
});

console.log(account.id); // acct_z_1234...`,
            },
            {
              id: 'curl',
              label: 'cURL',
              code: `curl "$ZONELESS_API_URL/v1/accounts" \\
  -H "x-api-key: $ZONELESS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "express",
    "country": "US",
    "email": "seller@example.com",
    "capabilities": {
      "transfers": { "requested": true }
    }
  }'`,
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
          text: '5. Create an onboarding link',
        },
        {
          type: 'paragraph',
          text: 'Create an <a href="/account-links">Account Link</a> and redirect the seller to its <code>url</code>. They will add their details and connect the Solana wallet where they want to receive payouts.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Account Links expire after one hour. ',
          text: 'If the link expires or the seller returns to your refresh URL, create a new link for the same connected account.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Create account link',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: `const accountLink = await zoneless.accountLinks.create({
  account: account.id,
  refresh_url: 'https://yoursite.com/reauth',
  return_url: 'https://yoursite.com/return',
  type: 'account_onboarding',
});

// Redirect the seller to accountLink.url
console.log(accountLink.url);`,
            },
            {
              id: 'curl',
              label: 'cURL',
              code: `curl "$ZONELESS_API_URL/v1/account_links" \\
  -H "x-api-key: $ZONELESS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "account": "acct_z_1234...",
    "refresh_url": "https://yoursite.com/reauth",
    "return_url": "https://yoursite.com/return",
    "type": "account_onboarding"
  }'`,
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
          text: '6. Wait for onboarding to finish',
        },
        {
          type: 'paragraph',
          text: 'Do not create a payout as soon as the seller reaches your return URL. Retrieve the account and check that <code>payouts_enabled</code> is <code>true</code>. In production, listen for <a href="/webhooks"><code>account.updated</code> webhooks</a> instead of polling.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'If you require identity verification before a seller can be paid, add the checks in the <a href="/identity-verification">Identity Verification guide</a> before continuing.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Check account status',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: `const onboardedAccount = await zoneless.accounts.retrieve(
  account.id
);

if (!onboardedAccount.payouts_enabled) {
  throw new Error('Seller has not finished onboarding');
}`,
            },
            {
              id: 'curl',
              label: 'cURL',
              code: `curl "$ZONELESS_API_URL/v1/accounts/acct_z_1234..." \\
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
          text: '7. Fund your platform wallet',
        },
        {
          type: 'paragraph',
          text: 'Your platform wallet must hold enough USDC to cover the transfer and payout. If it is empty, follow <a href="/fund-platform-wallet">Fund your platform wallet</a> before continuing.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Amounts are in cents. ',
          text: 'An amount of <code>1</code> is 0.01 USDC, <code>100</code> is 1.00 USDC, and <code>1000</code> is 10.00 USDC.',
          html: true,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '8. Create a transfer',
        },
        {
          type: 'paragraph',
          text: 'Create a <a href="/transfers">transfer</a> to credit the connected account\'s Zoneless balance. This updates the balances recorded by Zoneless, but it does not send USDC to the seller\'s wallet yet.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Create transfer',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: `const transfer = await zoneless.transfers.create({
  amount: 1, // $0.01
  currency: 'usdc',
  destination: account.id,
  description: 'Payment for services',
});

console.log(transfer.id); // tr_z_1234...`,
            },
            {
              id: 'curl',
              label: 'cURL',
              code: `curl "$ZONELESS_API_URL/v1/transfers" \\
  -H "x-api-key: $ZONELESS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 1,
    "currency": "usdc",
    "destination": "acct_z_1234...",
    "description": "Payment for services"
  }'`,
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
          text: '9. Create a payout',
        },
        {
          type: 'paragraph',
          text: 'Create a <a href="/payouts">payout</a> on behalf of the connected account. The <code>zonelessAccount</code> option is the SDK equivalent of the <code>Zoneless-Account</code> request header.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'The connected account balance must cover the payout. Creating it reserves the funds and leaves the payout in <code>pending</code> status.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Create payout',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: `const payout = await zoneless.payouts.create({
  amount: 1, // $0.01
  currency: 'usdc',
}, {
  zonelessAccount: account.id,
});

console.log(payout.id); // po_z_1234...`,
            },
            {
              id: 'curl',
              label: 'cURL',
              code: `curl "$ZONELESS_API_URL/v1/payouts" \\
  -H "x-api-key: $ZONELESS_API_KEY" \\
  -H "Zoneless-Account: acct_z_1234..." \\
  -d amount=1 \\
  -d currency=usdc`,
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
          text: '10. Process the payout',
        },
        {
          type: 'paragraph',
          text: "Creating a payout does not submit a Solana transaction. Call <code>processAll()</code> to build, sign, and broadcast your pending payouts. Once the transaction confirms, the USDC is sent from your platform wallet to each seller's wallet.",
          html: true,
        },
        {
          type: 'paragraph',
          text: '<code>processAll()</code> processes every pending payout for the platform. Use <code>processBatch()</code> if you want to process one batch at a time. See <a href="/payouts">Payouts</a> for both helpers and the lower-level signing flow.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Keep the wallet secret key on your server. ',
          text: 'The secret key signs transactions that move USDC from your platform wallet. Store it in an environment variable or secret manager and never send it to the browser.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Process all payouts',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: `const solanaSecretKey = process.env.SOLANA_SECRET_KEY;

if (!solanaSecretKey) {
  throw new Error('Missing Solana secret key');
}

await zoneless.payouts.processAll(solanaSecretKey);`,
            },
            {
              id: 'curl',
              label: 'cURL',
              code: `# Step 1: Build the unsigned transaction
curl "$ZONELESS_API_URL/v1/payouts/build" \\
  -H "x-api-key: $ZONELESS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "payouts": ["po_z_1234..."]
  }'
# Returns an unsigned_transaction to sign locally

# Step 2: Sign the unsigned_transaction locally
# using your Solana wallet secret key (e.g. with
# @solana/web3.js, solana CLI, or any Ed25519 signer)

# Step 3: Broadcast the signed transaction
curl "$ZONELESS_API_URL/v1/payouts/broadcast" \\
  -H "x-api-key: $ZONELESS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "signed_transaction": "<base64-signed-tx>",
    "payouts": ["po_z_1234..."],
    "blockhash": "<blockhash-from-build>",
    "last_valid_block_height": 158436852
  }'`,
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
              text: '<strong><a href="/webhooks">Webhooks</a>:</strong> Handle <code>account.updated</code>, <code>transfer.created</code>, and <code>payout.paid</code>',
              html: true,
            },
            {
              text: '<strong><a href="/idempotent-requests">Idempotent requests</a>:</strong> Prevent duplicate transfers and payouts when retrying requests',
              html: true,
            },
            {
              text: '<strong><a href="/login-links">Login Links</a>:</strong> Give sellers access to the Express Dashboard',
              html: true,
            },
            {
              text: '<strong><a href="/connected-accounts">Connected Accounts</a>:</strong> Make requests on behalf of a seller',
              html: true,
            },
            {
              text: '<strong><a href="/accounts">Accounts</a>, <a href="/transfers">Transfers</a>, and <a href="/payouts">Payouts</a>:</strong> Read the full API reference',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
