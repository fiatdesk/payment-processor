import { DocPage } from './types';
import { NODE_INIT } from './shared';

const WEBHOOK_EVENT_HANDLER = `import express from 'express';
import { Zoneless } from '@zoneless/node';

const app = express();
const zoneless = new Zoneless(
  process.env.ZONELESS_API_KEY,
  process.env.ZONELESS_API_URL
);
const endpointSecret = process.env.ZONELESS_WEBHOOK_SECRET;

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['zoneless-signature'];
  let event;

  try {
    event = zoneless.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log('Webhook signature verification failed.', err.message);
    return res.sendStatus(400);
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      // Resolve your billing subject from session.client_reference_id.
      // Store session.subscription and grant the paid entitlement.
      break;
    case 'invoice.paid':
      const invoice = event.data.object;
      const subscriptionId =
        invoice.parent?.subscription_details?.subscription;
      // Extend the entitlement using invoice.period_start and period_end.
      break;
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      const itemPeriods = subscription.items.data.map((item) => ({
        item: item.id,
        start: item.current_period_start,
        end: item.current_period_end,
      }));
      // Apply status, cancellation, and item period changes.
      break;
    case 'account.updated':
      const account = event.data.object;
      if (account.payouts_enabled) {
        // The connected account has completed onboarding
      }
      break;
    case 'payout.paid':
      const payout = event.data.object;
      // The payout was sent to the wallet
      break;
    case 'transfer.created':
      const transfer = event.data.object;
      // A transfer was created to a connected account
      break;
    default:
      console.log('Unhandled event type', event.type);
  }

  res.json({ received: true });
});

app.listen(4242, () => console.log('Running on port 4242'));`;

const WEBHOOK_VERIFY_EXAMPLE = `import express from 'express';
import { Zoneless } from '@zoneless/node';

const app = express();
const zoneless = new Zoneless(
  process.env.ZONELESS_API_KEY,
  process.env.ZONELESS_API_URL
);

const endpointSecret = process.env.ZONELESS_WEBHOOK_SECRET;

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['zoneless-signature'];
  let event;

  try {
    event = zoneless.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    res.status(400).send('Webhook Error: ' + err.message);
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'account.updated':
      const account = event.data.object;
      console.log('Account updated:', account.id);
      break;
    default:
      console.log('Unhandled event type', event.type);
  }

  res.json({ received: true });
});`;

export const WEBHOOKS_PAGE: DocPage = {
  id: 'webhooks',
  title: 'Webhooks',
  description:
    'Listen for events from your Zoneless instance so your application can automatically react to payments, subscriptions, account changes, and payouts.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'Zoneless sends webhook events to your application as HTTP POST requests containing a JSON <code>Event</code> object. This lets you respond to asynchronous events such as completed checkout, subscription renewals, account status changes, and payouts without continuously polling the API.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'How it works' },
        {
          type: 'list',
          items: [
            {
              text: 'Register a webhook endpoint URL via the <a href="/platform-dashboard">Platform Dashboard</a> or the <a href="/webhook-endpoints">Webhook Endpoints API</a>.',
              html: true,
            },
            {
              text: 'Zoneless sends a POST request to your URL whenever a subscribed event occurs.',
            },
            {
              text: 'Your handler verifies the signature, processes the event, and returns a <code>2xx</code> response.',
              html: true,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Register an endpoint' },
        {
          type: 'paragraph',
          text: 'Register the public URL that should receive events in the Zoneless dashboard, or create it with the Webhook Endpoints API.',
        },
        {
          type: 'list',
          items: [
            {
              text: 'Open <a href="https://dashboard-test.zoneless.com/account/developers">Developers in the test dashboard</a> or <a href="https://dashboard.zoneless.com/account/developers">Developers in the live dashboard</a>.',
              html: true,
            },
            {
              text: 'Choose <strong>Developers</strong> in the side menu, find <strong>Webhook Endpoints</strong>, and choose <strong>Add endpoint</strong>.',
              html: true,
            },
            {
              text: 'Enter the public endpoint URL and select the events it should receive.',
            },
            {
              text: 'Choose <strong>Create</strong>. Zoneless displays the signing secret once; copy it directly into the server secret manager or local environment.',
              html: true,
            },
          ],
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Create with the API',
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.zoneless.com/v1/webhook_endpoints \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://yoursite.com/webhook",
    "enabled_events": ["checkout.session.completed", "invoice.paid", "customer.subscription.updated"]
  }'`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const webhookEndpoint = await zoneless.webhookEndpoints.create({
  url: 'https://yoursite.com/webhook',
  enabled_events: [
    'checkout.session.completed',
    'invoice.paid',
    'customer.subscription.updated',
  ],
});

// Store webhookEndpoint.secret securely; it is returned only on creation.`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Create a handler' },
        {
          type: 'paragraph',
          text: 'Set up an endpoint that accepts POST requests with a JSON payload. Your handler should:',
        },
        {
          type: 'list',
          items: [
            {
              text: 'Verify the webhook signature using the <code>Zoneless-Signature</code> header.',
              html: true,
            },
            {
              text: 'Handle the event based on its <code>type</code> field.',
              html: true,
            },
            {
              text: 'Record <code>event.id</code>, apply the current resource state idempotently, and return a <code>2xx</code> response.',
              html: true,
            },
          ],
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Keep handlers efficient. ',
          text: "Verify the request, record the event ID, and keep processing within your server's request timeout. If the application already uses background jobs for billing updates, reuse that path.",
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Webhook handler',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: WEBHOOK_EVENT_HANDLER,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Verify signatures' },
        {
          type: 'paragraph',
          text: 'Zoneless signs every webhook event by including a signature in the <code>Zoneless-Signature</code> header. Always verify this signature to confirm the event was sent by your Zoneless instance and not a third party.',
          html: true,
        },
        {
          type: 'paragraph',
          text: "The header contains a timestamp (<code>t</code>) and a signature (<code>v1</code>). The signature is an HMAC-SHA256 hash of <code>{timestamp}.{payload}</code>, using the endpoint's signing secret as the key.",
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Use the raw request body. ',
          text: 'Signature verification requires the raw, unparsed request body. If your framework parses the body automatically, make sure to access the raw version (e.g. <code>express.raw()</code>) or verification will fail.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Verify webhook signature',
          tabs: [
            {
              id: 'node',
              label: 'Node.js',
              code: WEBHOOK_VERIFY_EXAMPLE,
            },
            {
              id: 'curl',
              label: 'cURL',
              code: `# The Zoneless-Signature header format:
# t={timestamp},v1={signature}
#
# To verify manually:
# 1. Extract t and v1 from the header
# 2. Build the signed payload: "{t}.{request_body}"
# 3. Compute HMAC-SHA256 with your endpoint secret
# 4. Compare with v1 using constant-time comparison`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Event types' },
        {
          type: 'paragraph',
          text: 'When registering a webhook endpoint, specify which event types to subscribe to. Use <code>["*"]</code> to receive all events. See <a href="/events/types">Types of events</a> for the full list of available event types.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Delivery and recovery' },
        {
          type: 'paragraph',
          text: 'Return a <code>2xx</code> response after the event is safely recorded. Use <code>event.id</code> as the idempotency key so the same event can be processed safely whenever it is delivered or replayed.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Use the <a href="/events">Events API</a> to inspect event history and retrieve an event when recovering or reconciling application state.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Best practices' },
        {
          type: 'list',
          items: [
            {
              text: "<strong>Handle duplicate events.</strong> Record <code>event.id</code> and make applying the event's current resource state idempotent.",
              html: true,
            },
            {
              text: '<strong>Only subscribe to events you need.</strong> Listening for all events puts unnecessary load on your server.',
              html: true,
            },
            {
              text: '<strong>Process events asynchronously.</strong> Push events onto a queue and process them in the background to handle traffic spikes.',
              html: true,
            },
            {
              text: '<strong>Use HTTPS in production.</strong> Your webhook endpoint must be publicly accessible over HTTPS in live mode.',
              html: true,
            },
            {
              text: '<strong>Verify every request.</strong> Always verify the <code>Zoneless-Signature</code> header to confirm events originate from your Zoneless instance.',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
