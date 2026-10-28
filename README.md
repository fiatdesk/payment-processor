<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/docs/src/assets/brand/fiatdesk-logo-white.svg">
    <img src="apps/docs/src/assets/brand/fiatdesk-logo-black.svg" alt="FiatDesk" width="320">
  </picture>
</h1>

<p align="center">Stablecoin settlement for high-risk businesses.</p>

<p align="center">
  <strong>Your own open-source payments platform.<br>Accept payments, manage subscriptions, and pay sellers globally in USDC on Ethereum from infrastructure you control. No platform fees. You pay Ethereum network gas.</strong>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License: Apache 2.0"></a>
</p>

---

FiatDesk is an open-source payments stack for stablecoins.

It includes checkout, subscriptions, marketplace accounts, and payouts through a Stripe-compatible API. Use the full platform or add it alongside your current payment setup.

## Features

### Platform dashboard

Manage payments, customers, products, subscriptions, connected accounts, and balances from one place.

### Checkout

Create products and payment links, then let customers pay with USDC on Ethereum through hosted checkout. Customers sign a message and pay no gas; your relayer pays it.

### Payments

Manage payments, subscription charges, payouts, refunds, and other balance activity.

### Subscriptions

Manage recurring payments, invoices, and subscription status. Customers authorize a bounded USDC allowance once; renewals are collected on Ethereum without further signing.

### Seller onboarding

Onboard sellers to your marketplace via a hosted flow where they can enter their details and connect an Ethereum wallet to receive USDC.

### Identity verification

Set verification rules and review sellers who need an identity check.

### Seller dashboard

Give each seller an Express-style dashboard for viewing earnings, payouts, and account details.

## A familiar API

FiatDesk uses familiar resources such as Checkout Sessions, Payment Links, Customers, Products, Subscriptions, Accounts, Transfers, and Payouts. It also follows Stripe's object shapes, webhook patterns, and idempotency model.

If you have worked with Stripe before, the SDK should feel familiar:

```typescript
import { FiatDesk } from '@fiatdesk/node';
const client = new FiatDesk('sk_live_fd_YOUR_API_KEY', 'https://api.yourdomain.com');

const session = await client.checkout.sessions.create({
  success_url: 'https://yoursite.com/success',
  cancel_url: 'https://yoursite.com/cancel',
  line_items: [
    {
      price_data: {
        currency: 'usdc',
        unit_amount: 1000,
        product_data: { name: 'My first product' },
      },
      quantity: 1,
    },
  ],
  mode: 'payment',
});
```

The API covers checkout, subscriptions, and marketplace payouts. See the [API reference](apps/docs) for the full list of resources and endpoints.

## Quick start

```bash
git clone https://github.com/OWNER/REPO.git
cd REPO
docker compose up -d
```

Open [localhost/setup](http://localhost/setup) to create your platform account and API key.

See the self-hosting guide in [`apps/docs`](apps/docs) (served at http://localhost:4205) for configuration, credentials, and deployment options.

## Costs

FiatDesk charges no platform fee and takes no percentage cut. You pay Ethereum network gas for each on-chain transaction, typically a few cents to a few dollars depending on network load. Batching payouts shares part of that cost. See the gas and fees guide in [`apps/docs`](apps/docs) for estimates.

## Guides and documentation

The full API reference lives in [`apps/docs`](apps/docs) and is served at http://localhost:4205 with `npx nx serve docs`. These guides are good places to start:

- Accept your first stablecoin payment (`apps/docs`, payment link quickstart)
- Create a Checkout Session with the API (`apps/docs`, checkout API quickstart)
- Onboard a seller and send a payout (`apps/docs`, quickstart)
- Move an existing Stripe Connect payout flow (`apps/docs`, migrate from Stripe)
- Understand what Ethereum gas costs and who pays it (`apps/docs`, gas and fees)

## Local development

```bash
npm install
docker compose up -d        # MongoDB
npx nx serve api            # API on :3333
npx nx serve web            # Dashboard on :4203
npx nx serve docs           # Docs on :4205
```

Or run everything at once:

```bash
npm run dev
```

### Running tests

```bash
npx nx test api
npx nx test web
npx nx test docs
npx nx test node-sdk
npx nx run contracts:test   # Solidity unit, fuzz and invariant tests (Foundry)
npx nx run api:test-anvil   # API integration tests against a local Anvil chain
```

## Project structure

```
fiatdesk/
├── apps/
│   ├── api/              # Express.js API backend
│   ├── web/              # Angular dashboard, checkout and onboarding
│   ├── docs/             # Public product docs and API reference
│   └── cli/              # Cli for humans and agents
├── contracts/            # Solidity: PayoutBatch and Subscriptions (Foundry)
├── libs/
│   ├── shared-types/     # Shared TypeScript interfaces
│   └── shared-schemas/   # Shared Zod schemas
├── sdks/
│   └── node/             # @fiatdesk/node
├── docker-compose.yml    # Full-stack Docker setup
└── nx.json
```

## Fork notice

This is an independent fork of the Zoneless project (Apache-2.0), forked from commit `5febc1a`. Settlement runs on Ethereum with USDC. See [NOTICE](./NOTICE) for upstream attribution and [CHANGES.md](./CHANGES.md) for a list of changes.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, style guidelines, and the pull request process.

## Security

See [SECURITY.md](./SECURITY.md) to report vulnerabilities.

## License

[Apache License 2.0](./LICENSE)
