# Contributing to FiatDesk

Thanks for wanting to help. FiatDesk is an open-source payments platform you can self-host on your own infrastructure. Imagine an open-source Stripe that you own.

The goal is to stay open source through the whole stack: the payment rail, the blockchain, the stablecoins, and the software that sits on top.

We only take on external dependencies where something cannot reasonably be open sourced today. Card networks are the usual example: accepting a Visa or Mastercard payment is not something we can currently do with an open stack, so that kind of integration stays optional and at the edges.

If you have a question, open a GitHub issue. Product docs, API reference, and self-hosting live in this repo under [`apps/docs`](apps/docs) (served at http://localhost:4205).

This project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

For larger changes, open an issue first and agree on the approach before writing code.

Then:

1. Set up the repo locally (below).
2. Make a small, focused change with tests.
3. Open a pull request.

Please do not open one huge pull request of untested, AI-generated code. Small, scoped PRs with a clear goal are much easier to review and much more likely to land.

## Design thesis

The API should match Stripe.

If you are unsure how a resource, field, webhook, or object should look, check the [Stripe docs](https://docs.stripe.com/api) and follow that structure: field names, object shapes, emitted events, and behaviour. FiatDesk uses USDC on Ethereum instead of cards and bank accounts, but the programming model should feel like Stripe. See the API reference and migration guide in [`apps/docs`](apps/docs) for how that mapping works in this project.

## Other ways to contribute

You do not need to write code to help. Useful contributions include bug reports, docs fixes, and reproductions.

- **Bugs.** Search existing issues first. Include steps to reproduce, expected vs actual behaviour, and environment details (OS, Node version, browser).
- **Features.** Feature requests live in the issues tab. Open one before building something large.

## Development setup

You need Node.js 20 (see `.nvmrc`), npm, and Docker (for MongoDB).

```bash
git clone https://github.com/YOUR_USERNAME/payment-processor.git
cd payment-processor
npm install
docker compose up -d        # MongoDB
npx nx serve api            # API on :3333
npx nx serve web            # Dashboard on :4203
npx nx serve docs           # Docs on :4205
```

Or run the API and dashboard together:

```bash
npm run dev
```

To run the full Docker stack instead (API, dashboard, and database behind one local URL), follow the self-hosting and local development guides in [`apps/docs`](apps/docs).

Test mode uses simulated funds by default (`SETTLEMENT_RAIL=simulated`). To exercise Ethereum Sepolia, set `LIVEMODE=false`, `SETTLEMENT_RAIL=onchain` and `ETH_RPC_URL`. The default test suites never contact a public network: Solidity tests run with `npx nx run contracts:test` (Foundry), and API integration tests run against a local Anvil chain with `npx nx run api:test-anvil`. See [`contracts/README.md`](contracts/README.md).

### Tests, lint, and formatting

```bash
npx nx test api
npx nx test web
npx nx test docs
npx nx test node-sdk
npx nx lint api --fix
npx nx lint web --fix
npx nx lint docs --fix
npx nx lint node-sdk --fix
npm run format
```

CI also runs `npm run format:check` and `npx nx run-many --target=test --all`. Run those locally before you open a PR.

## Pull requests

1. Branch from `main`. Name the branch whatever describes the change (`fix-payout-status`, `account-link-return-url`, and so on). A `feature/` prefix is not required.
2. Keep the change small and focused on one goal.
3. Add tests for the behaviour you changed. If the change affects a public API, dashboard flow, or self-hosting step, update the matching page in [`apps/docs`](apps/docs). Keep [`sdks/node`](sdks/node) in the same PR when you change API types or request schemas.
4. Follow the existing structure, naming, and formatting. Reuse styles from the styles folder rather than introducing new ones. Remove code that your change makes unused.
5. Use comments only where the code cannot say it clearly.
6. Fill out the PR template so reviewers know what changed and how you tested it.

### PR checklist

- [ ] Tests pass (`npx nx run-many --target=test --all`)
- [ ] Linting passes (`npx nx run-many --target=lint --all`)
- [ ] Formatting passes (`npm run format:check`)
- [ ] No merge conflicts with `main`

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](./LICENSE).

## Brand assets

The FiatDesk logo files are in [`apps/web/src/assets/brand`](apps/web/src/assets/brand) and [`apps/docs/src/assets/brand`](apps/docs/src/assets/brand). Both folders hold the same files:

- `fiatdesk-logo-black.svg` and `fiatdesk-logo-white.svg`: the lockup (icon and wordmark). Use black on light backgrounds and white on dark ones.
- `fiatdesk-icon-black.svg` and `fiatdesk-icon-white.svg`: the square icon.
- `fiatdesk-mark-black.svg` and `fiatdesk-mark-white.svg`: the mark on its own.
- `fiatdesk-og.png`: the 1200×630 social preview, the black lockup on white.

The favicons are in `apps/web/src/assets/favicon` and `apps/docs/src/assets/favicon` (the black set, the default), with the white set in each `favicon/dark` folder for dark-mode browsers. `apps/web/public/favicon.ico` is the black ICO.

Use the files as they are. Do not redraw, stretch, recolour, outline or rotate the logo, add shadows or other effects, round the icon's corners, or place it on a busy background.

- **Minimum size:** the lockup 120 px wide on screen, the icon 16 px. Below 48 px, use the pixel-hinted favicon PNG and ICO files rather than scaling down a large image.
- **Clear space:** at least 1X on every side, where X is the thickness of the icon's crown (about 16.6% of the icon's side). The lockup files already include it.
- **Colour:** the logo is only ever `#000000` or `#FFFFFF`. Approved pairings are black on white, white on black, black on Grey 100 and white on Ink 900.

The colour tokens are in `apps/web/src/app/styles/base.scss` and `apps/docs/src/app/styles/base.scss`:

| Token       | Value     | Use                                    |
| ----------- | --------- | -------------------------------------- |
| `$black`    | `#000000` | Logo, primary buttons, links, accents  |
| `$white`    | `#FFFFFF` | Logo on dark surfaces, page background |
| `$ink-900`  | `#1A1A1A` | Body text, dark surfaces               |
| `$grey-600` | `#6B6B6B` | Secondary text                         |
| `$grey-300` | `#D4D4D4` | Dividers and borders                   |
| `$grey-100` | `#F5F5F5` | Surfaces                               |

The docs dark theme uses the `--doc-accent` CSS variable, which is black in the light theme and white in the dark one. Status colours (success, warning, error) are fine in the product UI but never in the logo.

The typeface is [Be Vietnam Pro](https://fonts.google.com/specimen/Be+Vietnam+Pro) (SIL Open Font License 1.1), loaded from Google Fonts. Use 600 for headlines and key numbers, 500 for buttons and labels, 400 for body text, and 300 only for large display text. Headlines are sentence case. Amounts use tabular figures (`font-variant-numeric: tabular-nums`). Code and monospace fonts are unchanged.

## Style

- TypeScript for all new code
- PascalCase for function names: `GetAccount()`, `ValidateUser()`
- camelCase for variables: `accountId`, `userName`
- Prefer `const` over `let`, avoid `var`
- Use `async`/`await` over raw promises
- Standalone Angular components with signals for state
- Zod for API request validation
- Do not add a new dependency unless the work cannot be done with what is already in the repo

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <subject>
```

A scope is optional. Use one when it helps (`feat: add payout failure webhook`), not as a required `(api)` / `(web)` prefix.

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Examples:

```
feat: emit payout.failed webhook on on-chain error
fix: validate wallet address on paste
docs: clarify test-mode settlement defaults
```

## Working with coding agents

If you use Cursor, Claude Code, or a similar agent, this repo has an [AGENTS.md](./AGENTS.md). Coding tools pick that file up automatically.

The agent still needs a small, reviewable change with tests. A large generated diff is not a shortcut around the pull request process.

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](./SECURITY.md).
