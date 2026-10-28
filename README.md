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
git clone https://github.com/fiatdesk/payment-processor.git
cd payment-processor
docker compose up -d
```

Open [localhost/setup](http://localhost/setup) to create your platform account and API key. With no configuration, FiatDesk runs in test mode with simulated funds: no RPC, keys or ETH needed. Credit test USDC from the dashboard, or with `POST /v1/test_helpers/treasury/topups`.

## Setup guide

Follow these steps to settle real transactions, on Sepolia first and then on mainnet.

### 1. Choose a mode

| Mode              | Settings                                    | Money                          |
| ----------------- | ------------------------------------------- | ------------------------------ |
| Test, simulated   | defaults                                    | Fake ledger balances, no chain |
| Test, on Sepolia  | `LIVEMODE=false`, `SETTLEMENT_RAIL=onchain` | Sepolia USDC and Sepolia ETH   |
| Test, local Anvil | as above, plus `ETH_CHAIN_ID=31337`         | `MockUSDC` you deploy yourself |
| Live, on mainnet  | `LIVEMODE=true`                             | Real USDC and ETH              |

Copy [`.env.production.example`](.env.production.example) to `.env.production` (or [`.env.example`](.env.example) to `.env` for local development). Every variable is described there.

### 2. Get an RPC endpoint

Set `ETH_RPC_URL` to a Sepolia or mainnet JSON-RPC URL from your node provider. Separate several URLs with commas: the first is the primary and the rest are fallbacks. A public RPC is fine for Sepolia but not for production.

### 3. Create the keys

FiatDesk uses four Ethereum accounts. Create each one with `cast wallet new` (Foundry), or in a wallet you control:

| Account               | Where its key lives                                                                                                      | Holds                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Platform wallet       | Never on the server: your browser wallet (dashboard), or `WALLET_PRIVATE_KEY` in the Node SDK process that signs payouts | USDC to pay out, ETH for gas   |
| Checkout relayer      | `CHECKOUT_RELAYER_KEY` on the API host                                                                                   | ETH only: it pays checkout gas |
| Subscription operator | `SUBSCRIPTION_OPERATOR_KEY` on the API host                                                                              | ETH only: it collects renewals |
| Deployer              | Your own machine, once (a keystore or hardware wallet)                                                                   | ETH to deploy the contracts    |

The relayer and operator keys can only relay what buyers sign, or pull at most a plan's amount per period to the plan's destination. Keep only gas money on them. Keep the same `SUBSCRIPTION_OPERATOR_KEY` for good: existing plans are owned by it.

### 4. Deploy the contracts

USDC is preset for Sepolia and mainnet. `PayoutBatch` and `Subscriptions` are not deployed for you. Deploy them with Foundry (see [`contracts/README.md`](contracts/README.md)):

```bash
git submodule update --init
cd contracts
forge script script/DeployPayoutBatch.s.sol --rpc-url "$ETH_RPC_URL" --account deployer --broadcast
forge script script/DeploySubscriptions.s.sol --rpc-url "$ETH_RPC_URL" --account deployer --broadcast
```

Set `PAYOUT_BATCH_ADDRESS` and `SUBSCRIPTIONS_ADDRESS` to the logged addresses. On Anvil, also deploy `contracts/test/mocks/MockUSDC.sol` (for example with `forge create`) and set `USDC_ADDRESS`.

### 5. Fund the accounts

- **Sepolia:** get test USDC from the [Circle faucet](https://faucet.circle.com/) (select USDC and Ethereum Sepolia) for the platform wallet and a buyer wallet. Send a little Sepolia ETH to the platform wallet, the relayer and the operator. Never send real funds to a test wallet.
- **Mainnet:** send USDC and ETH to the platform wallet, and ETH to the relayer and the operator. Watch their ETH balances: checkout and renewals stop when a key runs out of gas.

### 6. Start FiatDesk and run setup

```bash
npm run prod
```

Open `/setup` on your `DASHBOARD_URL` and enter the platform wallet's address. That wallet becomes the platform's default wallet. You can add more wallets and switch the default later from **Settings → Wallets**.

### 7. Schedule the background work

These jobs are off by default, because several API instances would each run them:

- **Deposits:** call `POST /v1/topups/check-deposits` when you expect USDC to arrive, or set `TOPUP_MONITOR_ENABLED=true` on a single instance.
- **Subscription billing:** call `POST /v1/billing/run_for_platform` with your platform API key from a scheduler, or set `BILLING_MONITOR_ENABLED=true` on a single instance.

### Before you go live

Get an independent security audit of `contracts/src/Subscriptions.sol` and `contracts/src/PayoutBatch.sol` before deploying them to mainnet, and run the whole flow on Sepolia first. As the operator, you carry the money-transmission, AML/KYC and sanctions obligations of your jurisdiction.

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
