import { DocPage } from './types';
import { NODE_INIT } from './shared';

export const CHECKOUT_API_QUICKSTART_PAGE: DocPage = {
  id: 'checkout-api-quickstart',
  title: 'API Quickstart',
  description:
    'Accept USDC payments from your app with Checkout and the Zoneless Node.js SDK. This guide uses Zoneless Cloud in live mode.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'Prefer no code? Use the <a href="/payment-link-quickstart">Payment Links quickstart</a>. Self-hosting? Complete the <a href="/self-hosting">Self-hosting</a> guide first, then continue from <strong>Install the SDK</strong> using your instance URL instead of <code>https://api.zoneless.com</code>.',
          html: true,
        },
        {
          type: 'heading',
          level: 2,
          text: '1. Get your API key',
        },
        {
          type: 'paragraph',
          text: 'Sign up at <a href="https://zoneless.com">zoneless.com</a> (or use an existing account) and copy your live secret key from the dashboard. It starts with <code>sk_live_z_</code>. Keep it server-side only; never expose it in client-side code or commit it to version control.',
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
          text: 'Create a Zoneless client with your live secret key and the cloud API base URL.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Initialize client',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: NODE_INIT,
            },
            {
              id: 'curl',
              label: 'cURL',
              code: `# Set your API key as an environment variable
export ZONELESS_API_KEY="sk_live_z_YOUR_API_KEY"

# Include in requests via the x-api-key header
curl https://api.zoneless.com/v1/balance \\
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
          text: '4. Create a Checkout Session',
        },
        {
          type: 'paragraph',
          text: 'Create a Checkout Session in <code>payment</code> mode. Use <code>price_data</code> to define the product and amount inline, without creating a Product or Price first. Then redirect your customer to the session URL.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Create Checkout Session',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const session = await zoneless.checkout.sessions.create({
  success_url: 'https://yoursite.com/success',
  cancel_url: 'https://yoursite.com/cancel',
  line_items: [
    {
      price_data: {
        currency: 'usdc',
        unit_amount: 1000, // $10.00
        product_data: {
          name: 'My first product',
        },
      },
      quantity: 1,
    },
  ],
  mode: 'payment',
});

// Redirect the customer to session.url
console.log(session.url);`,
            },
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.zoneless.com/v1/checkout/sessions \\
  -H "x-api-key: $ZONELESS_API_KEY" \\
  -d success_url="https://yoursite.com/success" \\
  -d cancel_url="https://yoursite.com/cancel" \\
  -d "line_items[0][price_data][currency]"=usdc \\
  -d "line_items[0][price_data][unit_amount]"=1000 \\
  -d "line_items[0][price_data][product_data][name]"="My first product" \\
  -d "line_items[0][quantity]"=1 \\
  -d mode=payment`,
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
          text: '5. Collect payment',
        },
        {
          type: 'paragraph',
          text: 'Redirect your customer to <code>session.url</code>. They complete Checkout with their Solana wallet and pay in USDC. Settlement typically confirms in seconds. See <a href="/checkout-sessions">Checkout Sessions</a> for the full API.',
          html: true,
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
              text: '<strong><a href="/webhooks">Webhooks</a>:</strong> Listen for <code>checkout.session.completed</code> and fulfill the order',
              html: true,
            },
            {
              text: '<strong><a href="/payment-links">Payment Links</a>:</strong> Create shareable links via the API or dashboard',
              html: true,
            },
            {
              text: '<strong><a href="/subscriptions">Subscriptions</a>:</strong> Recurring USDC billing with invoices',
              html: true,
            },
            {
              text: '<strong><a href="/api-quickstart">API quickstart</a>:</strong> Onboard sellers and pay them out with Connect',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
