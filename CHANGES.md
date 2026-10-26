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
