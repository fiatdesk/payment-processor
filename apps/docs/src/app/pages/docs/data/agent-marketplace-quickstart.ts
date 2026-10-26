import { DocPage } from './types';

export const AGENT_MARKETPLACE_QUICKSTART_PAGE: DocPage = {
  id: 'agent-marketplace-quickstart',
  title: 'Agent Marketplace Quickstart',
  description:
    'Give a coding agent a secure, additive path for adding optional Zoneless USDC seller payouts to an existing marketplace.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'This is the stable bootstrap document for a coding agent. The agent must preserve checkout and every existing payout method, work in test mode, and stop at the human authorization and production secret boundaries.',
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Collecting payments from customers instead?',
          text: 'Use the <a href="/agent-payments-quickstart">Agent Payments Quickstart</a> when the goal is USDC subscriptions or checkout rather than paying sellers out.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Assume no crypto knowledge',
          text: 'Explain every human action in plain language. USDC is a digital dollar; Solana is the network carrying it; SOL pays the small network fee in live mode; a public wallet address is safe to share, while its secret key authorizes spending and must remain private. Test mode uses fake USDC, so they can send a test payout without a wallet, a faucet, or the live Solana network. Always distinguish test funds from real funds.',
          html: true,
        },
        {
          type: 'heading',
          level: 2,
          text: '1. Start secure setup',
        },
        {
          type: 'paragraph',
          text: 'From the marketplace repository, infer a clear platform name and run the command below. The Node.js CLI is only the secure bootstrap tool; it does not require the marketplace backend itself to use Node.js.',
        },
        {
          type: 'paragraph',
          text: 'If setup reports that local profiles already exist for a different platform, retry with <code>--new-platform</code>. Reuse profiles that already belong to this marketplace.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Terminal',
          tabs: [
            {
              id: 'shell',
              label: 'Shell',
              code: `npx @zoneless/cli@latest agent setup \\
  --platform-name "<marketplace name>" \\
  --skill marketplace \\
  --json`,
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
          text: '2. Pause for human authorization',
        },
        {
          type: 'paragraph',
          text: 'Show the activation URL and code returned by the CLI, then wait for the human to review and approve the request. Never approve it for them. Setup provisions test and live profiles while keeping API credentials and wallet secrets out of the prompt and source tree.',
        },
        {
          type: 'paragraph',
          text: 'The CLI binds this repository to the provisioned profiles in <code>.zoneless/project.json</code> and selects test by default. Build and verify with <code>https://api-test.zoneless.com</code>; keep mode environment-driven and leave live promotion to the human handoff.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Setup validates stored keys before reuse. If it reports <code>credentials_invalid</code>, run <code>zoneless auth reconnect --json</code> and show the new authorization prompt to the human. For local testing, run <code>zoneless env sync --include-wallet --json</code>; it finds an unambiguous env file, preserves unrelated values, and writes the bound test credentials without displaying them. Use <code>--target</code> only when the project has multiple env files.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Do not handle secrets.',
          text: 'Never request, read, print, export, transmit, or commit an API key, wallet private key, seed phrase, or secret-manager value.',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '3. Read the installed marketplace skill',
        },
        {
          type: 'paragraph',
          text: 'After approval, parse the successful JSON response and read the file at <code>skill_path</code> before changing application code. The CLI installs the versioned <code>zoneless-marketplace</code> skill locally and returns its exact path, so this flow does not depend on automatic skill discovery.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Follow that skill as the implementation and safety contract. Start with the <a href="/api-quickstart">API Quickstart</a>, use <a href="https://docs.zoneless.com/llms.txt">llms.txt</a> as an index, and read other resource pages only when implementing that resource or when blocked. Do not fetch the entire documentation set upfront.',
          html: true,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '4. Classify the money flow before editing',
        },
        {
          type: 'paragraph',
          text: 'Inspect checkout separately from payouts. Determine whether the marketplace accrues seller earnings for a later payout (including Stripe separate charges and transfers), pays sellers during checkout using destination charges, direct charges, or split payments, or is a small/file-backed app with no withdrawal infrastructure.',
        },
        {
          type: 'paragraph',
          text: 'Preserve every existing provider. If sellers are paid during checkout, keep that path unchanged for existing providers; for a Zoneless seller, collect on the platform and accrue that sale once for a later Zoneless payout. For a small app, use its existing storage and process model rather than adding queues, locks, authentication, or production infrastructure.',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '5. Choose the native integration path',
        },
        {
          type: 'list',
          items: [
            {
              text: '<strong>JavaScript or TypeScript backend:</strong> centralize one server-side <code>@zoneless/node</code> client. Use <code>payouts.processAll()</code> or <code>processBatch()</code> for platform-wide pending payouts, or the SDK&rsquo;s <code>build</code>, <code>sign</code>, and <code>broadcast</code> methods when processing explicit payout IDs.',
              html: true,
            },
            {
              text: "<strong>Python, Ruby, Go, or another runtime:</strong> use the project's existing HTTP client to build a small centralized adapter for the canonical REST API. Do not add Node.js as an application runtime dependency.",
              html: true,
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'Keep API keys and transaction signing server-side and use <code>https://api-test.zoneless.com</code> during integration. The Node SDK already handles Solana transaction building and signing: do not add Solana packages or application configuration for mint, cluster, RPC, token accounts, or platform account IDs. Non-Node runtimes use the documented build and broadcast endpoints with a maintained signer for that language.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Match the existing payout trigger: use <code>processAll()</code> for a scheduled worker that owns every pending Zoneless payout, <code>processBatch()</code> for one bounded platform batch, and explicit <code>build</code>/<code>sign</code>/<code>broadcast</code> for a seller claim or admin-selected payout ID. Do not add both a claim route and a scheduler unless the marketplace already supports both.',
          html: true,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '6. Add Zoneless without replacing anything',
        },
        {
          type: 'list',
          items: [
            {
              text: 'Add <code>zoneless</code> as a separate opt-in payout method and store a dedicated <code>zonelessAccountId</code>.',
              html: true,
            },
            {
              text: 'Create and persist an Express connected account, then use a hosted Account Link for seller onboarding.',
              html: true,
            },
            {
              text: 'Treat <code>payouts_enabled</code> or a verified <code>account.updated</code> webhook as onboarding completion.',
              html: true,
            },
            {
              text: 'Pin each sale or earning to one provider. If the existing checkout pays sellers immediately, leave that behavior unchanged for existing providers and omit the destination transfer only for Zoneless sellers. Never pay one sale through both checkout and Zoneless.',
              html: true,
            },
            {
              text: "Transfer the seller's accrued earnings to their connected-account balance, then create the payout with <code>zonelessAccount</code> or the <code>Zoneless-Account</code> header. Do not use <code>destination</code> for the connected account ID.",
              html: true,
            },
            {
              text: 'Reuse the existing ledger, storage, jobs, idempotency conventions, webhook route, and UI styles. Keep the implementation proportional to the application and do not refactor unrelated code.',
              html: true,
            },
            {
              text: 'If a broadcast response is lost, retrieve the payout status before retrying. Never create a replacement transfer or payout; reconcile a paid result, or rebroadcast the same retained signed transaction when the payout remains pending and that transaction is available.',
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
          text: '7. Verify in test mode',
        },
        {
          type: 'paragraph',
          text: 'Add focused tests that prove the existing checkout and payout path is unchanged, seller opt-in works, one sale cannot be paid through two providers, connected-account context and stable idempotency keys are used, and no secrets reach browser code or fixtures. For destination charges, test that Stripe sellers still use them and Zoneless sellers do not.',
        },
        {
          type: 'paragraph',
          text: "Run the project's formatter, focused tests, linter, type checker, and build. Use mocks or test credentials only. Do not create live-mode application data, fund a wallet, submit a transaction, broadcast a payout, or switch production traffic.",
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '8. Hand production setup back to the human',
        },
        {
          type: 'paragraph',
          text: 'Report changed files, migrations, deployment commands, required environment-variable names, test-mode onboarding steps, tests run, and anything still unverified. Tell the human where to configure the API key and webhook secret without requesting either value.',
        },
        {
          type: 'paragraph',
          text: 'Before an end-to-end test payout, tell the human to add test USDC from the dashboard <strong>Balance</strong> page (<strong>Add test USDC</strong>) or with <code>POST /v1/test_helpers/treasury/topups</code>. Create the payout, then process it with the same <code>processAll</code> / build and broadcast path as live. Simulated settlement does not need a wallet, faucet, or Devnet: broadcast the unsigned dummy transaction. Do not assume create returns <code>paid</code>. Self-hosters who set <code>SETTLEMENT_RAIL=onchain</code> should follow <a href="/local-development">Local Development</a> instead.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Explain the live promotion explicitly: configure the separately provisioned live API key and <code>https://api.zoneless.com</code> in the deployment secret manager, configure the live webhook secret, fund the live platform wallet, and complete one supervised payout before enabling live traffic.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'The human must run the wallet backup command themselves in an interactive terminal, place the backup\'s <code>secretKeyBase58</code> value directly in the production secret manager as <code>SOLANA_SECRET_KEY</code>, and securely delete the temporary export. They must then follow <a href="/fund-platform-wallet">Fund your platform wallet</a> to add enough USDC for seller payouts and a small amount of SOL for Solana network fees, configure live webhooks, and approve a supervised end-to-end payout.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Production remains a human decision.',
          text: 'Do not claim the integration is production-ready until secret provisioning, wallet funding, live webhook setup, and a supervised payout are complete.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Human-only command',
          tabs: [
            {
              id: 'shell',
              label: 'Shell',
              code: 'npx @zoneless/cli@latest wallet backup --output <secure-path>',
            },
          ],
        },
      ],
    },
  ],
};
