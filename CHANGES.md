# Changes

This project is a fork of Zoneless (https://github.com/zonelessdev/zoneless),
Copyright 2026 Zoneless Ltd., licensed under the Apache License, Version 2.0.
It was forked from commit `5febc1a` (156 commits) on 2026-10-27.

Section 4(b) of the Apache License requires that modified files carry prominent
notices stating that they were changed. This file lists every modified, added,
or deleted path, grouped by the task of the Ethereum port that touched it.
Files that are substantively rewritten or new also carry the header
`// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.`

## How this list is maintained

Run `git diff --name-status 5febc1a..HEAD` to regenerate the full list. Each
task appends its own section below.

## Task 1: Fork notices, dead Anchor program, repository metadata

Added:

- `NOTICE`
- `CHANGES.md`

Deleted:

- `apps/programs/` (unreferenced Anchor program)

Modified:

- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `package.json`
- `sdks/node/package.json`
- `sdks/node/project.json`
- `apps/cli/package.json`
- `apps/cli/project.json`
- `.github/ISSUE_TEMPLATE/config.yml`

## Task 2: Remove the telemetry phone-home

Removed opt-in anonymous usage telemetry and its upstream ingest endpoint.

Deleted:

- `apps/api/src/modules/Telemetry.ts`
- `apps/api/src/modules/TelemetryMonitor.ts`
- `apps/api/src/routes/telemetry.routes.ts`
- `libs/shared-types/src/lib/Telemetry.ts`
- `apps/web/src/app/data/services/telemetry.service.ts`
- `TELEMETRY.md`

Modified:

- `apps/api/src/routes/index.ts`
- `apps/api/src/main.ts`
- `apps/api/src/modules/Database.ts`
- `apps/api/src/modules/Setup.ts`
- `libs/shared-types/src/lib/index.ts`
- `libs/shared-types/src/lib/Config.ts`
- `libs/shared-types/src/lib/Operator.ts`
- `apps/web/src/app/data/services/index.ts`
- `apps/web/src/app/features/account/settings/settings.component.{html,scss,ts}`
- `apps/web/src/app/features/setup/setup.component.{html,scss,ts}`
- `.env.example`
- `.env.production.example`
- `AGENTS.md`
- `apps/docs/src/app/pages/docs/data/environment-variables.ts`
- `CHANGES.md`

## Task 3: Remove hardcoded upstream hosts

Replaced every upstream host and URL with placeholders (`api.yourdomain.com`, `pay.yourdomain.com`, `example.com`, `OWNER/REPO`) or self-hosted relative paths. Names and brands are unchanged until Task 17.

Behaviour changes:

- CLI: `agent setup` no longer has a default authorization or approval endpoint. `--auth-url` / `ZONELESS_AUTH_URL` and `--activation-url` / `ZONELESS_ACTIVATION_URL` are required; missing values fail with `auth_url_required` (exit code `invalidInput`).
- CLI: `webhook sync` derives the dashboard URL from the profile API URL (`api.` / `api-test.` hosts only), otherwise prints a generic "open your dashboard" line.
- Web: `GetDiditWebhookUrl` became `BuildDiditWebhookUrl(apiBaseUrl)`.
- Docs app: `DOCS_SITE_URL` (default `http://localhost:4205`) sets the site URL used by `generate-agent-docs`; the GitHub star fetch is skipped while the repo is the `OWNER/REPO` placeholder; the `twitter:site` meta tag and the upstream KYC blog link were removed.

Modified:

```
.agents/skills/zoneless-marketplace/SKILL.md
.agents/skills/zoneless-payments/SKILL.md
.env.example
README.md
apps/api/src/main.ts
apps/cli/README.md
apps/cli/src/app/AgentSetup.spec.ts
apps/cli/src/app/AgentSetup.ts
apps/cli/src/app/Cli.spec.ts
apps/cli/src/app/Cli.ts
apps/cli/src/app/EnvSync.spec.ts
apps/cli/src/app/WebhookSync.spec.ts
apps/cli/src/app/WebhookSync.ts
apps/docs/scripts/generate-agent-docs.test.ts
apps/docs/scripts/generate-agent-docs.ts
apps/docs/src/app/components/agent-prompt-cta/agent-marketplace-prompt.ts
apps/docs/src/app/components/agent-prompt-cta/agent-payments-prompt.ts
apps/docs/src/app/pages/docs/data/agent-marketplace-quickstart.ts
apps/docs/src/app/pages/docs/data/agent-payments-quickstart.ts
apps/docs/src/app/pages/docs/data/api-quickstart.ts
apps/docs/src/app/pages/docs/data/authentication.ts
apps/docs/src/app/pages/docs/data/build-a-marketplace.ts
apps/docs/src/app/pages/docs/data/deployment.ts
apps/docs/src/app/pages/docs/data/environment-variables.ts
apps/docs/src/app/pages/docs/data/errors.ts
apps/docs/src/app/pages/docs/data/fund-platform-wallet.ts
apps/docs/src/app/pages/docs/data/identity-verification.ts
apps/docs/src/app/pages/docs/data/marketplace-quickstart.ts
apps/docs/src/app/pages/docs/data/migrate-from-stripe.ts
apps/docs/src/app/pages/docs/data/platform-dashboard.ts
apps/docs/src/app/pages/docs/data/quickstart.ts
apps/docs/src/app/pages/docs/data/self-hosting.ts
apps/docs/src/app/pages/docs/data/shared.ts
apps/docs/src/app/pages/docs/data/webhooks.ts
apps/docs/src/app/pages/docs/docs.html
apps/docs/src/app/pages/docs/docs.ts
apps/docs/src/app/services/github.ts
apps/docs/src/app/services/meta.ts
apps/web/src/app/core/services/wallet.service.spec.ts
apps/web/src/app/features/account/products/views/price-detail/price-detail.component.html
apps/web/src/app/features/onboard/onboard.component.html
apps/web/src/app/shared/forms/identity-settings-form/didit-webhook-url.spec.ts
apps/web/src/app/shared/forms/identity-settings-form/didit-webhook-url.ts
apps/web/src/app/shared/forms/identity-settings-form/identity-settings-form.component.ts
libs/shared-schemas/src/lib/BillingSchema.ts
libs/shared-schemas/src/lib/EventSchema.ts
libs/shared-schemas/src/lib/TopUpSchema.ts
libs/shared-types/src/lib/Config.ts
sdks/node/README.md
sdks/node/src/resources/*.ts
```
