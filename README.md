<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/docs/src/assets/brand/fiatdesk-logo-white.svg">
    <img src="apps/docs/src/assets/brand/fiatdesk-logo-black.svg" alt="FiatDesk" width="320">
  </picture>
</h1>

<h3 align="center">Open-source stablecoin payment processing platform</h3>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License: Apache 2.0"></a>
  <img src="https://img.shields.io/badge/Settlement-USDC%20on%20Ethereum-2775CA.svg" alt="Settlement: USDC on Ethereum">
  <img src="https://img.shields.io/badge/API-Stripe--compatible-635BFF.svg" alt="API: Stripe-compatible">
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#pay-from-another-chain-near-intents">Pay from another chain</a> ·
  <a href="#setup-guide">Setup guide</a> ·
  <a href="apps/docs">Documentation</a> ·
  <a href="#a-familiar-api">API</a>
</p>

<p align="center">
  <img src="docs/screenshots/dashboard-home.webp" alt="FiatDesk dashboard home with gross volume, available balance and overview charts" width="900">
</p>

---

<!-- prettier-ignore -->
> [!NOTE]
> FiatDesk's smart contracts (`PayoutBatch` and `Subscriptions`) have been audited, and FiatDesk is deployable on testnet (Sepolia).

<!-- prettier-ignore -->
> [!NOTE]
> NEAR HACKATHON (Real-World Money track) entry: hosted checkout can be paid from NEAR through NEAR Intents and settles as USDC on Ethereum. See [Pay from another chain](#pay-from-another-chain-near-intents).

FiatDesk is a self-hosted payment processor for stablecoins. Run it for your own business, or as the payments layer of a marketplace: hosted checkout, payment links, recurring billing, connected seller accounts, payouts and webhooks, all settled in USDC on Ethereum.

## Why FiatDesk

- **You run it.** Deploy with Docker on your own servers. Your platform wallet's key never touches the server, so funds stay in your custody.
- **A Stripe-compatible API.** Checkout Sessions, Payment Links, Customers, Subscriptions, Accounts, Transfers and Payouts, with the same object shapes, webhooks and idempotency model.
- **Gas-free checkout for buyers.** Customers sign one USDC authorization (EIP-3009); your relayer submits it and pays the gas.
- **Recurring billing on-chain.** Subscribers approve a capped allowance once, and renewals are collected each period without another signature.
- **Batch payouts.** Pay many sellers in one transaction through the `PayoutBatch` contract, so they share the gas.
- **No percentage fees.** FiatDesk takes no cut. Your only costs are Ethereum gas and your hosting.

## Screenshots

Every screenshot comes from a running FiatDesk instance with demo data. Click one to open it at full resolution (2880×1800).

### Payments

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/screenshots/checkout.webp"><img src="docs/screenshots/checkout.webp" alt="Hosted checkout: Buyers connect a wallet and sign once to pay in USDC. Your relayer pays the gas."></a>
      <br><b>Hosted checkout</b><br>Buyers connect a wallet and sign once to pay in USDC. Your relayer pays the gas.
    </td>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-payment-links.webp"><img src="docs/screenshots/dashboard-payment-links.webp" alt="Payment links: Shareable links that open hosted checkout, with no code."></a>
      <br><b>Payment links</b><br>Shareable links that open hosted checkout, with no code.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-products.webp"><img src="docs/screenshots/dashboard-products.webp" alt="Product catalog: Products with one-time and recurring USDC prices."></a>
      <br><b>Product catalog</b><br>Products with one-time and recurring USDC prices.
    </td>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-transactions.webp"><img src="docs/screenshots/dashboard-transactions.webp" alt="Transactions: Payments, payouts, top-ups and transfers, filterable and exportable."></a>
      <br><b>Transactions</b><br>Payments, payouts, top-ups and transfers, filterable and exportable.
    </td>
  </tr>
</table>

### Billing

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-subscriptions.webp"><img src="docs/screenshots/dashboard-subscriptions.webp" alt="Subscriptions: Monthly and yearly plans renewed on-chain without another signature."></a>
      <br><b>Subscriptions</b><br>Monthly and yearly plans renewed on-chain without another signature.
    </td>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-invoices.webp"><img src="docs/screenshots/dashboard-invoices.webp" alt="Invoices: Invoices created and paid by each billing cycle."></a>
      <br><b>Invoices</b><br>Invoices created and paid by each billing cycle.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-customers.webp"><img src="docs/screenshots/dashboard-customers.webp" alt="Customers: Everyone who has paid you, with their contact details."></a>
      <br><b>Customers</b><br>Everyone who has paid you, with their contact details.
    </td>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-customer-detail.webp"><img src="docs/screenshots/dashboard-customer-detail.webp" alt="Customer detail: A customer's subscriptions, payments and invoices on one page."></a>
      <br><b>Customer detail</b><br>A customer's subscriptions, payments and invoices on one page.
    </td>
  </tr>
</table>

### Marketplaces

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-connected-accounts.webp"><img src="docs/screenshots/dashboard-connected-accounts.webp" alt="Connected accounts: Your sellers and their onboarding status."></a>
      <br><b>Connected accounts</b><br>Your sellers and their onboarding status.
    </td>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-connected-account-detail.webp"><img src="docs/screenshots/dashboard-connected-account-detail.webp" alt="Connected account detail: Balances, transfers, payouts, capabilities and identity checks for one seller."></a>
      <br><b>Connected account detail</b><br>Balances, transfers, payouts, capabilities and identity checks for one seller.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/screenshots/seller-onboarding.webp"><img src="docs/screenshots/seller-onboarding.webp" alt="Seller onboarding: A hosted flow where sellers enter their details and connect a wallet."></a>
      <br><b>Seller onboarding</b><br>A hosted flow where sellers enter their details and connect a wallet.
    </td>
    <td width="50%" valign="top">
      <a href="docs/screenshots/seller-dashboard.webp"><img src="docs/screenshots/seller-dashboard.webp" alt="Seller dashboard: Each seller's own view of their balance, payouts and transfers."></a>
      <br><b>Seller dashboard</b><br>Each seller's own view of their balance, payouts and transfers.
    </td>
  </tr>
</table>

### Platform

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-home.webp"><img src="docs/screenshots/dashboard-home.webp" alt="Home: Today's volume, available balance and trends over time."></a>
      <br><b>Home</b><br>Today's volume, available balance and trends over time.
    </td>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-balances.webp"><img src="docs/screenshots/dashboard-balances.webp" alt="Balances: Your USDC balance, what can be paid out, and every balance movement."></a>
      <br><b>Balances</b><br>Your USDC balance, what can be paid out, and every balance movement.
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-developers.webp"><img src="docs/screenshots/dashboard-developers.webp" alt="Developers: API keys and webhook endpoints."></a>
      <br><b>Developers</b><br>API keys and webhook endpoints.
    </td>
    <td width="50%" valign="top">
      <a href="docs/screenshots/dashboard-settings.webp"><img src="docs/screenshots/dashboard-settings.webp" alt="Settings: Business details, identity verification rules and platform wallets."></a>
      <br><b>Settings</b><br>Business details, identity verification rules and platform wallets.
    </td>
  </tr>
</table>

### Documentation

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="docs/screenshots/docs-quickstart.webp"><img src="docs/screenshots/docs-quickstart.webp" alt="Guides: Quickstarts for payments, marketplaces, self-hosting and webhooks."></a>
      <br><b>Guides</b><br>Quickstarts for payments, marketplaces, self-hosting and webhooks.
    </td>
    <td width="50%" valign="top">
      <a href="docs/screenshots/docs-api-reference.webp"><img src="docs/screenshots/docs-api-reference.webp" alt="API reference: Every endpoint, with parameters, cURL and Node.js examples, and sample responses."></a>
      <br><b>API reference</b><br>Every endpoint, with parameters, cURL and Node.js examples, and sample responses.
    </td>
  </tr>
</table>

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

Everything runs in Docker. Clone the repository with its contract dependencies:

```bash
git clone --recursive https://github.com/fiatdesk/payment-processor.git
cd payment-processor
```

Then pick a mode. Each one is a single command, and the dashboard opens at [localhost](http://localhost). Go to [localhost/setup](http://localhost/setup) to create your platform account and API key.

| Mode                                                  | Command                                                                  | Good for                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [Simulated funds](#simulated-funds-default) (default) | `docker compose up -d`                                                   | Trying the dashboard, API and SDK in two minutes                                  |
| [Local chain](#local-chain)                           | `docker compose -f docker-compose.yml -f docker-compose.anvil.yml up -d` | Real on-chain flows (signing, payout batches, renewals) with no faucet or RPC key |
| [Sepolia](#sepolia)                                   | `docker compose up -d` with Sepolia settings in `.env`                   | Testing on a public testnet                                                       |

All modes share one database, so start from a clean one when you switch: `docker compose down -v` deletes all local data.

### Simulated funds (default)

```bash
docker compose up -d
```

No RPC, keys or ETH needed. Balances are ledger entries with no chain behind them. Credit test USDC from **Balances → Add funds**, or with `POST /v1/test_helpers/treasury/topups`.

### Local chain

```bash
docker compose -f docker-compose.yml -f docker-compose.anvil.yml up -d
docker compose -f docker-compose.yml -f docker-compose.anvil.yml logs chain-setup
```

This adds a local [Anvil](https://getfoundry.sh) chain (chain ID `31337`, RPC `http://localhost:8545`). A one-time container deploys test USDC, `PayoutBatch` and `Subscriptions`, mints 10,000 test USDC to two of Anvil's public test accounts, and the API settles on that chain. The logs print the addresses and keys:

- **Platform wallet** `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`: enter it at `/setup`, and import its key into MetaMask to sign payouts from the dashboard.
- **Buyer wallet** `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`: import its key into MetaMask to pay at checkout.

The first time the dashboard or checkout asks MetaMask to sign, it offers to add the local chain. Top-ups are detected and subscriptions renew automatically. Reset the chain with `docker compose -f docker-compose.yml -f docker-compose.anvil.yml down -v`.

> These are Anvil's public test keys. Anyone can use them, so never send real funds to these addresses.

### Sepolia

Put your Sepolia settings in `.env`, then start as usual:

```bash
SETTLEMENT_RAIL=onchain
ETH_RPC_URL=https://your-sepolia-rpc-url
CHECKOUT_RELAYER_KEY=0x...        # pays checkout gas; holds Sepolia ETH only
SUBSCRIPTION_OPERATOR_KEY=0x...   # collects renewals; holds Sepolia ETH only
PAYOUT_BATCH_ADDRESS=0x...        # your PayoutBatch deployment
SUBSCRIPTIONS_ADDRESS=0x...       # your Subscriptions deployment
```

```bash
docker compose up -d
```

Sepolia USDC is preset. Shared Sepolia deployments of `PayoutBatch` and `Subscriptions` are not published yet, so for now deploy your own (see [Deploy the contracts](#4-deploy-the-contracts)). Get test USDC from the [Circle faucet](https://faucet.circle.com/) and a little Sepolia ETH for the platform wallet, relayer and operator.

## Pay from another chain (NEAR Intents)

Buyers can only pay a FiatDesk checkout if they already hold USDC on Ethereum. The hosted checkout now has a **Pay from another chain** link: the buyer pays in NEAR, the merchant is expected to receive the invoiced USDC on Ethereum, and the same `checkout.session.completed` webhook fires and the same Charge is created. FiatDesk takes no percentage fee, and the platform wallet key still never touches the server.

**NEAR tools used.** The [NEAR Intents 1Click API](https://docs.near-intents.org/) is the swap provider. FiatDesk calls `POST /v0/quote` (swap type `EXACT_OUTPUT`), `GET /v0/status` and `POST /v0/deposit/submit`. It does not call `GET /v0/tokens`; the accepted assets are fixed in `ORIGIN_ASSETS`. The origin asset is NEAR as wNEAR (`nep141:wrap.near`, 24 decimals), and settlement is USDC on Ethereum.

### Run it (simulated, no keys)

Simulated mode returns fake quotes and moves no funds. It needs the simulated settlement rail, which is the default.

1. Do: `git clone --recursive https://github.com/fiatdesk/payment-processor.git && cd payment-processor`. Until this branch is merged, add `--branch feat/near-intents-cross-chain`. See: a `payment-processor` directory with `docker-compose.yml`.
2. Do: `docker compose up -d`. See: the containers start, and [localhost](http://localhost) loads the dashboard sign-in. MongoDB is published on host port 27017, so stop anything else that uses that port first.
3. Do: open [localhost/setup](http://localhost/setup), create the platform account and choose a wallet ("Use an existing wallet" or "Generate"). The API key is shown once. See: the dashboard home.
4. Do: open **Developers** and create a webhook endpoint, if you want to see deliveries. See: the endpoint is listed and you can copy its signing secret.
5. Do: create a Payment Link for a one-time $5.00 product. In the product form, set Pricing to **One-time** (the default is a recurring monthly price, which gives a subscription checkout with no cross-chain link). See: a link URL of the form `/b/<slug>`.
6. Do: open the link, enter an email, and click **Pay from another chain**. The email is required before the panel opens. See: the **Pay from another chain** panel with the banner "Simulated NEAR Intents: no funds move".
7. Do: choose **NEAR**, enter a refund address and click **Get quote**. See: the amount in NEAR, a deposit address with a copy button, a deadline countdown and the status "Waiting for your deposit".
8. Do: click **Simulate deposit**. See: checkout shows "Thanks for your order" and completes in that one call, so no in-between status appears. Refreshing the page while the quote waits for a deposit resumes the panel.
9. Do: in the dashboard, open **Transactions** and the new payment, then its Charge under Related objects. See: a Charge on network `simulated`, "Paid from NEAR", the origin and settlement hashes, an amount of $5.00 and one balance transaction. If you created an endpoint in step 4, its Deliveries list shows one `checkout.session.completed` delivery.

If a quote expires, click **Get a new quote**. If the status looks stuck, click **Check again**. To pay with a wallet instead, click **Pay with USDC instead**.

### Run it live (mainnet)

Live mode moves real money on Ethereum mainnet. 1Click has no testnet, so every swap is a real one: use small amounts. Set this in `.env`, then run `docker compose up -d`:

```bash
LIVEMODE=true
ETH_RPC_URL=https://your-mainnet-rpc-url
NEAR_INTENTS_MODE=live
NEAR_INTENTS_API_KEY=             # optional
```

- `NEAR_INTENTS_MODE`: Cross-chain Checkout through NEAR Intents: `off`, `simulated` (fake quotes, no funds move), or `live` (real swaps on mainnet). Unset means `simulated` on the simulated settlement rail and `off` otherwise. `live` requires `LIVEMODE=true`, and `simulated` requires the simulated rail.
- `NEAR_INTENTS_API_KEY`: Optional NEAR Intents partner key, sent as `X-API-Key`. Quotes without one carry an extra 0.25% fee.
- `NEAR_INTENTS_BASE_URL`: defaults to `https://1click.chaindefuser.com/v0`.

Follow steps 3 to 6 above. The panel banner then reads "Live via NEAR Intents, settles as USDC on Ethereum". Send the quoted NEAR to the deposit address, optionally paste the transaction hash and click **I sent it**. Checkout completes only when 1Click reports `SUCCESS`, which is expected to take 1 to 10 minutes. The other final states are "Refunded" and "Failed".

### Limits

- Mainnet only. Simulated mode is the only way to try it without real funds.
- NEAR is the only origin asset. Adding another 1Click asset is one row in `ORIGIN_ASSETS`.
- Settlement is trusted from the 1Click status. FiatDesk does not re-verify it by RPC.
- The session completes only when the quoted USDC amount still equals the amount due. If the line items change after the quote, the delivery does not complete the session and the buyer gets a new quote.
- Mobile without an injected wallet cannot reach the NEAR link, because it is hidden on the wallet-app handoff screen.
- The simulated steps above were rehearsed from a fresh clone on 2026-11-06 through the browser and API. The webhook delivery in step 9 has not been observed yet, because no endpoint existed during the rehearsal payment. Live mainnet has not been run.
- Live mode has been checked against 1Click only with dry quotes and read-only calls (2026-11-06). Quotes without a key carry the extra 0.25% fee described under `NEAR_INTENTS_API_KEY`; with a partner key the fee is typically 20 bps. Dry quotes also showed a fixed 0.30 USDC withdraw fee, so the buyer pays above the invoice amount in NEAR.

### Where the code is

- `apps/api/src/modules/intents/`: the live and simulated 1Click clients.
- `apps/api/src/modules/CheckoutPayment.ts`: the start, poll and deposit methods.
- `apps/api/src/routes/paymentPages.routes.ts`: `/v1/payment_pages/:urlSlug/cross_chain` routes.
- `apps/web/src/app/features/checkout/`: the checkout panel.
- `apps/docs/src/app/pages/docs/data/accept-payments-from-any-chain.ts`: the docs guide.

## Setup guide

Follow these steps to settle real transactions, on Sepolia first and then on mainnet.

### 1. Choose a mode

| Mode              | Settings                                    | Money                          |
| ----------------- | ------------------------------------------- | ------------------------------ |
| Test, simulated   | defaults                                    | Fake ledger balances, no chain |
| Test, on Sepolia  | `LIVEMODE=false`, `SETTLEMENT_RAIL=onchain` | Sepolia USDC and Sepolia ETH   |
| Test, local Anvil | `docker-compose.anvil.yml` sets everything  | Test USDC it deploys for you   |
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

Set `PAYOUT_BATCH_ADDRESS` and `SUBSCRIPTIONS_ADDRESS` to the logged addresses. The [local chain](#local-chain) mode deploys everything for you.

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

Run the whole flow on Sepolia before deploying `contracts/src/Subscriptions.sol` and `contracts/src/PayoutBatch.sol` to mainnet. As the operator, you carry the money-transmission, AML/KYC and sanctions obligations of your jurisdiction.

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
