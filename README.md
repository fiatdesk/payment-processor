<h1 align="center">Zoneless</h1>

<p align="center">
  <strong>Your own open-source payments platform.<br>Accept payments, manage subscriptions, and pay sellers globally in USDC from infrastructure you control. No middlemen and no fees.</strong>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License: Apache 2.0"></a>
</p>

---

Zoneless is an open-source payments stack for stablecoins.

It includes checkout, subscriptions, marketplace accounts, and payouts through a Stripe-compatible API. Use the full platform or add it alongside your current payment setup.

## Features

### Platform dashboard

Manage payments, customers, products, subscriptions, connected accounts, and balances from one place.

### Checkout

Create products and payment links, then let customers pay with USDC through hosted checkout.

### Payments

Manage payments, subscription charges, payouts, refunds, and other balance activity.

### Subscriptions

Manage recurring payments, invoices, and subscription status.

### Seller onboarding

Onboard sellers to your marketplace via a hosted flow where they can enter their details and connect a wallet.

### Identity verification

Set verification rules and review sellers who need an identity check.

### Seller dashboard

Give each seller an Express-style dashboard for viewing earnings, payouts, and account details.

## A familiar API

Zoneless uses familiar resources such as Checkout Sessions, Payment Links, Customers, Products, Subscriptions, Accounts, Transfers, and Payouts. It also follows Stripe's object shapes, webhook patterns, and idempotency model.

If you have worked with Stripe before, the SDK should feel familiar:

```typescript
import { Zoneless } from '@zoneless/node';
const client = new Zoneless('sk_live_z_YOUR_API_KEY', 'https://api.yourdomain.com');

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

## Guides and documentation

The full API reference lives in [`apps/docs`](apps/docs) and is served at http://localhost:4205 with `npx nx serve docs`. These guides are good places to start:

- Accept your first stablecoin payment (`apps/docs`, payment link quickstart)
- Create a Checkout Session with the API (`apps/docs`, checkout API quickstart)
- Onboard a seller and send a payout (`apps/docs`, quickstart)
- Move an existing Stripe Connect payout flow (`apps/docs`, migrate from Stripe)

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
```

## Project structure

```
zoneless/
├── apps/
│   ├── api/              # Express.js API backend
│   ├── web/              # Angular dashboard, checkout and onboarding
│   ├── docs/             # Public product docs and API reference
│   └── cli/              # Cli for humans and agents
├── libs/
│   ├── shared-types/     # Shared TypeScript interfaces
│   └── shared-schemas/   # Shared Zod schemas
├── sdks/
│   └── node/             # @zoneless/node
├── docker-compose.yml    # Full-stack Docker setup
└── nx.json
```

## Fork notice

This is an independent fork of the Zoneless project (Apache-2.0), forked from commit `5febc1a`. The port of settlement from Solana to Ethereum is in progress. See [NOTICE](./NOTICE) for upstream attribution and [CHANGES.md](./CHANGES.md) for a list of changes.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, style guidelines, and the pull request process.

## Security

See [SECURITY.md](./SECURITY.md) to report vulnerabilities.

## License

[Apache License 2.0](./LICENSE)
