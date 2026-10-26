import { DocSubSection, DocPage, Attribute } from './types';
import { NODE_INIT, BuildEndpointSummaries } from './shared';

export const BILLING_SUBSECTION: DocSubSection = {
  id: 'billing',
  title: 'Billing Helpers',
  children: [
    { id: 'object', title: 'The Billing run object' },
    { id: 'run_for_platform', title: 'Run billing for your platform' },
    { id: 'monitor-status', title: 'Retrieve monitor status' },
  ],
};

// ============================================
// Shared Data
// ============================================
const BILLING_RUN_OBJECT_JSON = `{
  "object": "billing.run",
  "processed": 12,
  "succeeded": 10,
  "failed": 1,
  "skipped": 1,
  "errors": [
    {
      "subscription": "sub_z_1NGQwV2eZvKYlo2CjrVqXzAb",
      "error": "Insufficient USDC allowance for subscription delegation"
    }
  ]
}`;

const BILLING_MONITOR_STATUS_JSON = `{
  "running": false,
  "enabled": false,
  "poll_interval_ms": 60000,
  "platform_account": "acct_z_Platform123abc"
}`;

// ============================================
// Billing Run Object Attributes
// ============================================
const BILLING_RUN_ATTRIBUTES: Attribute[] = [
  {
    name: 'object',
    type: 'string',
    description:
      "String representing the object's type. Always <code>billing.run</code>.",
  },
  {
    name: 'processed',
    type: 'integer',
    description:
      'Total number of subscriptions considered in this pass (succeeded, failed, and skipped).',
  },
  {
    name: 'succeeded',
    type: 'integer',
    description:
      'Subscriptions that were successfully invoiced and collected in this pass.',
  },
  {
    name: 'failed',
    type: 'integer',
    description:
      'Subscriptions that failed during processing. See <code>errors</code> for details.',
  },
  {
    name: 'skipped',
    type: 'integer',
    description:
      'Subscriptions skipped in this pass (for example, already claimed by another runner or not due).',
  },
  {
    name: 'errors',
    type: 'array of objects',
    description: 'Per-subscription failure details from this pass.',
    expandable: true,
    children: [
      {
        name: 'subscription',
        type: 'string',
        description: 'ID of the subscription that failed.',
      },
      {
        name: 'error',
        type: 'string',
        description: 'Human-readable error message.',
      },
    ],
  },
];

const BILLING_MONITOR_STATUS_ATTRIBUTES: Attribute[] = [
  {
    name: 'running',
    type: 'boolean',
    description:
      'Whether the in-process billing monitor loop is active on this API instance.',
  },
  {
    name: 'enabled',
    type: 'boolean',
    description:
      'Whether <code>BILLING_MONITOR_ENABLED</code> is set to <code>true</code> on this API instance.',
  },
  {
    name: 'poll_interval_ms',
    type: 'integer',
    description:
      'Configured poll interval in milliseconds, from <code>BILLING_POLL_INTERVAL_MS</code>. Defaults to <code>60000</code>.',
  },
  {
    name: 'platform_account',
    type: 'string',
    description: 'The platform account ID the request was authenticated as.',
  },
];

// ============================================
// Pages
// ============================================
export const BILLING_OVERVIEW_PAGE: DocPage = {
  id: 'object',
  title: 'The Billing run object',
  description:
    'Billing helpers process due subscription renewals and invoice retries for your platform. Recurring USDC collection is not a shared Stripe-like backend job you ignore — on Zoneless Cloud the operator runs billing on a schedule; self-hosters trigger it themselves (or enable the optional in-process monitor).',
  endpoints: BuildEndpointSummaries(BILLING_SUBSECTION, [
    {
      method: 'POST',
      path: '/v1/billing/run_for_platform',
      pageId: 'run_for_platform',
    },
    {
      method: 'GET',
      path: '/v1/billing/monitor/status',
      pageId: 'monitor-status',
    },
  ]),
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Zoneless extension: ',
          text: "These endpoints are specific to Zoneless and are not available in Stripe's API. They exist so platforms can collect recurring subscription payments in USDC on Solana.",
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'How billing works: ',
          text: '<strong>Self-host:</strong> call <a href="#run_for_platform"><code>run_for_platform</code></a> on a schedule with your platform API key (Cloud Scheduler, cron, or your host\'s job runner). For single-instance setups you can instead enable <code>BILLING_MONITOR_ENABLED</code>. <strong>Zoneless Cloud:</strong> the operator triggers <code>POST /v1/billing/run</code> with <code>x-operator-key</code> — you do not need to cron this yourself. Each run finds due subscriptions, creates cycle invoices, and collects via Solana subscription delegation.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Automatic collection only runs for subscriptions that have a <code>subscription_delegation_pda</code>, use <code>collection_method=charge_automatically</code>, are not paused, and are in <code>active</code>, <code>past_due</code>, or (after trial end) <code>trialing</code>.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Attributes' },
        {
          type: 'attributes',
          attributes: BILLING_RUN_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'object',
          title: 'THE BILLING RUN OBJECT',
          code: BILLING_RUN_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Run billing for platform
// ============================================
const RUN_FOR_PLATFORM_PARAMETERS: Attribute[] = [
  {
    name: 'batch_size',
    type: 'integer',
    description:
      'Maximum number of subscriptions to process in this pass. Defaults to <code>25</code> when omitted.',
  },
];

export const BILLING_RUN_FOR_PLATFORM_PAGE: DocPage = {
  id: 'run_for_platform',
  title: 'Run billing for your platform',
  description:
    'Runs one billing pass for the authenticated platform: retries open subscription invoices that are due for another attempt, then creates and collects cycle invoices for subscriptions whose current period has ended.',
  endpoints: [{ method: 'POST', path: '/v1/billing/run_for_platform' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'info',
          title: 'Recommended: ',
          text: 'Schedule this endpoint from your host (for example Cloud Scheduler or cron). Prefer this over the in-process monitor when you run multiple API instances.',
        },
        {
          type: 'paragraph',
          text: 'Each subscription is claimed with a short <code>billing_lock_until</code> window so overlapping runners do not create duplicate cycle invoices. Failed automatic payments move the subscription toward <code>past_due</code> / <code>unpaid</code> after repeated attempts.',
          html: true,
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        {
          type: 'attributes',
          attributes: RUN_FOR_PLATFORM_PARAMETERS,
        },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns a <code>billing.run</code> object summarizing how many subscriptions were processed, succeeded, failed, or skipped.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'POST', path: '/v1/billing/run_for_platform' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/billing/run_for_platform \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -d batch_size=25`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const result = await zoneless.billing.runForPlatform({
  batch_size: 25,
});

console.log(\`Processed \${result.processed}, succeeded \${result.succeeded}\`);
for (const err of result.errors) {
  console.log(\`\${err.subscription}: \${err.error}\`);
}`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: BILLING_RUN_OBJECT_JSON,
        },
      ],
    },
  ],
};

// ============================================
// Retrieve monitor status
// ============================================
export const BILLING_MONITOR_STATUS_PAGE: DocPage = {
  id: 'monitor-status',
  title: 'Retrieve monitor status',
  description:
    'Returns whether the optional in-process billing monitor is enabled and running on this API instance, along with its poll interval.',
  endpoints: [{ method: 'GET', path: '/v1/billing/monitor/status' }],
  sections: [
    {
      left: [
        {
          type: 'callout',
          variant: 'warning',
          title: 'Single-instance only: ',
          text: 'The in-process monitor is disabled by default. Enable it only for local development or a single API instance. For Cloud Run and other multi-instance deployments, schedule <a href="#run_for_platform"><code>run_for_platform</code></a> instead.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'When enabled, the API starts a loop that periodically runs the same billing pass as <code>run_for_platform</code> (across all platforms on that instance). Configure with:',
          html: true,
        },
        {
          type: 'list',
          items: [
            {
              text: '<code>BILLING_MONITOR_ENABLED=true</code> — must be exactly <code>true</code> to enable',
              html: true,
            },
            {
              text: '<code>BILLING_POLL_INTERVAL_MS=60000</code> — poll interval in milliseconds (default <code>60000</code>)',
              html: true,
            },
          ],
        },
        { type: 'heading', level: 2, text: 'Parameters' },
        { type: 'paragraph', text: 'No parameters.' },
        { type: 'heading', level: 2, text: 'Returns' },
        {
          type: 'paragraph',
          text: 'Returns the billing monitor status for this API instance.',
        },
        { type: 'heading', level: 3, text: 'Response attributes' },
        {
          type: 'attributes',
          attributes: BILLING_MONITOR_STATUS_ATTRIBUTES,
        },
      ],
      right: [
        {
          type: 'code',
          endpoint: { method: 'GET', path: '/v1/billing/monitor/status' },
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/billing/monitor/status \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY"`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const status = await zoneless.billing.monitorStatus();

console.log(\`enabled=\${status.enabled} running=\${status.running}\`);
console.log(\`interval=\${status.poll_interval_ms}ms\`);`,
            },
          ],
        },
        {
          type: 'object',
          title: 'RESPONSE',
          code: BILLING_MONITOR_STATUS_JSON,
        },
      ],
    },
  ],
};

export const BILLING_PAGES: DocPage[] = [
  BILLING_OVERVIEW_PAGE,
  BILLING_RUN_FOR_PLATFORM_PAGE,
  BILLING_MONITOR_STATUS_PAGE,
];
