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

## Task 4: `Settlement` interface and chain-neutral types

`Settlement` is now an explicit interface (`apps/api/src/modules/chains/Settlement.ts`) with chain-neutral types in `apps/api/src/modules/chains/types.ts`. `Solana` and `SimulatedSettlement` implement it, every module reaches the chain through `GetSettlement()`, the module-level `ExplorerUrl` helper or `chains/types`, and module fields are named `settlement`. Solana is still the on-chain rail.

Internal renames: `GetSOLBalance` → `GetNativeBalance`, `GetPlanOwnerPublicKey` → `GetPlanOwnerAddress`, `FindExistingSubscriptionDelegation` → `FindExistingSubscription`, `GetUSDCMintAddress` → private (exposed as `Describe().token_address`), `SolanaExplorerUrl` → `ExplorerUrl`. Builders return `estimated_fee` / `fee_currency` / `chain_id` / `nonce` / `to` with the blockhash data under an optional `solana` sub-object; broadcasts return `transaction_hash`; `IncomingDeposit` carries `transactionHash`, `logIndex` and `blockNumber`.

Public API field names are unchanged until Task 5: `CheckoutPayment` and `Payout` map the chain-neutral results back onto `estimated_fee_lamports`, `blockhash`, `last_valid_block_height`, `min_context_slot` and `signature`.

Behaviour changes (simulated rail only; the on-chain rail returns the same values as before):

- Paid payouts record `metadata.gas_fee_currency: 'none'` instead of `'sol'` (`metadata.network` was already `'simulated'`).
- `GET /v1/config/deposit-info` returns `network: 'simulated'` instead of `'solana'`; `DepositInfo.network` is now typed `string`.

Added:

- `apps/api/src/modules/chains/types.ts`
- `apps/api/src/__tests__/mocks/Settlement.ts`

Modified:

```
CHANGES.md
apps/api/src/__tests__/CheckoutPayment.spec.ts
apps/api/src/__tests__/Invoice.spec.ts
apps/api/src/__tests__/Payout.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/mocks/Solana.ts
apps/api/src/modules/Balance.ts
apps/api/src/modules/CheckoutPayment.ts
apps/api/src/modules/Invoice.ts
apps/api/src/modules/Payout.ts
apps/api/src/modules/Price.ts
apps/api/src/modules/TopUp.ts
apps/api/src/modules/TopUpMonitor.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/modules/chains/Solana.ts
apps/api/src/routes/config.routes.ts
libs/shared-types/src/lib/Config.ts
```

## Task 5: Chain-neutral public API field names

Every externally visible Solana-shaped field is renamed once, while Solana still produces the values, across the API, shared types and schemas, web, Node SDK and docs. The legacy mappings added in Task 4 are gone: the API exposes the rail's chain-neutral fields directly.

| Before                                                                                                                                        | After                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `PayoutBatchBuildResponse.estimated_fee_lamports`, `.blockhash`, `.last_valid_block_height`                                                   | `.estimated_fee` (string, atomic units), `.fee_currency`, `.chain_id`, `.nonce`, `.to`, `.transaction_type`, `.batch_id`                        |
| `PayoutBatchBroadcastResponse.signature`, `ProcessPendingResult.signature`                                                                    | `.transaction_hash`; the `status` type gains `'pending'` (no rail returns it yet; broadcast still reports anything short of `paid` as `failed`) |
| `BroadcastPayoutsBatchSchema.blockhash`, `.last_valid_block_height`                                                                           | removed                                                                                                                                         |
| Checkout prepare response `estimated_fee_lamports`, `blockhash`, `last_valid_block_height`, `min_context_slot`, `subscription_delegation_pda` | `estimated_fee`, `fee_currency`, `chain_id`, `nonce`, `to`, optional rail-specific sub-object, `subscription_onchain_id`                        |
| Checkout confirm body `signature`, `subscription_delegation_pda`                                                                              | `transaction_hash`, `subscription_onchain_id`                                                                                                   |
| `CheckoutSession.payment_details.transaction_signature`                                                                                       | `.transaction_hash` (Mongo field path too; `GetCheckoutSessionByTransactionHash`)                                                               |
| `CheckoutSession.merchant_wallet.usdc_mint`                                                                                                   | `.token_address`                                                                                                                                |
| `Price.subscription_plan_pda`                                                                                                                 | `.subscription_plan_id`                                                                                                                         |
| `Subscription.subscription_delegation_pda`                                                                                                    | `.subscription_onchain_id` (`SetSubscriptionOnchainId`)                                                                                         |
| `SetupRequest/SetupResponse.solana_public_key`                                                                                                | `.wallet_address`                                                                                                                               |
| `BalanceDetails.wallet_sol`                                                                                                                   | `.wallet_native` + `.native_currency`                                                                                                           |

There is no migration: databases created by upstream Zoneless, or by this fork before this change, are incompatible (stored `payment_details.transaction_signature`, `subscription_plan_pda` and `subscription_delegation_pda` values are no longer read).

The simulated rail no longer attaches placeholder blockhash data to its unsigned transactions; the broadcast schema that needed it dropped those fields.

Added:

- `apps/api/src/__tests__/SetupModule.spec.ts`
- `sdks/node/src/__tests__/Payouts.spec.ts`

Modified:

```
CHANGES.md
apps/api/src/__tests__/Balance.spec.ts
apps/api/src/__tests__/CheckoutPayment.spec.ts
apps/api/src/__tests__/CheckoutSession.spec.ts
apps/api/src/__tests__/Invoice.spec.ts
apps/api/src/__tests__/PaymentLink.spec.ts
apps/api/src/__tests__/Payout.spec.ts
apps/api/src/__tests__/Price.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/Subscription.spec.ts
apps/api/src/__tests__/SubscriptionBilling.spec.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/modules/Balance.ts
apps/api/src/modules/CheckoutPayment.ts
apps/api/src/modules/CheckoutSession.ts
apps/api/src/modules/Invoice.ts
apps/api/src/modules/Payout.ts
apps/api/src/modules/Price.ts
apps/api/src/modules/Setup.ts
apps/api/src/modules/Subscription.ts
apps/api/src/modules/SubscriptionBilling.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/routes/paymentPages.routes.ts
apps/api/src/routes/payouts.routes.ts
apps/api/src/routes/setup.routes.ts
apps/docs/src/app/pages/docs/data/billing.ts
apps/docs/src/app/pages/docs/data/build-a-marketplace.ts
apps/docs/src/app/pages/docs/data/checkout-sessions.ts
apps/docs/src/app/pages/docs/data/payouts.ts
apps/docs/src/app/pages/docs/data/prices.ts
apps/docs/src/app/pages/docs/data/subscriptions.ts
apps/web/src/app/data/services/checkout-session.service.ts
apps/web/src/app/features/account/balance/components/balance-detail/balance-detail.component.html
apps/web/src/app/features/account/balance/components/balance-detail/balance-detail.component.ts
apps/web/src/app/features/account/connected-accounts/services/connected-account-actions.service.ts
apps/web/src/app/features/checkout/checkout.component.spec.ts
apps/web/src/app/features/checkout/checkout.component.ts
apps/web/src/app/features/setup/setup.component.html
apps/web/src/app/features/setup/setup.component.ts
libs/shared-schemas/src/lib/CheckoutSessionSchema.ts
libs/shared-schemas/src/lib/PayoutSchema.ts
libs/shared-schemas/src/lib/PriceSchema.ts
libs/shared-types/src/lib/Balance.ts
libs/shared-types/src/lib/Charge.ts
libs/shared-types/src/lib/CheckoutSession.ts
libs/shared-types/src/lib/Config.ts
libs/shared-types/src/lib/Customer.ts
libs/shared-types/src/lib/Invoice.ts
libs/shared-types/src/lib/InvoicePayment.ts
libs/shared-types/src/lib/Payout.ts
libs/shared-types/src/lib/Price.ts
libs/shared-types/src/lib/Subscription.ts
sdks/node/src/generated/Inputs.ts
sdks/node/src/resources/Payouts.ts
```

## Task 6: Swap the rail to Ethereum (viem)

The Solana rail is gone. `GetSettlement()` returns the new `Ethereum` class (`apps/api/src/modules/chains/Ethereum.ts`) when `SETTLEMENT_RAIL=onchain`, and the simulated rail is unchanged apart from address formats. Wallet addresses everywhere are Ethereum addresses: any value that passes viem `isAddress` (all-lowercase or correctly EIP-55 checksummed) is accepted and stored checksummed via `getAddress`. Private keys are `0x` + 64 hex.

Dependencies: removed `@solana/kit`, `@solana/kit-plugin-rpc`, `@solana/kit-plugin-signer`, `@solana/spl-token`, `@solana/subscriptions`, `@solana/web3.js`, `@solana-mobile/mobile-wallet-adapter-protocol`, `bs58`, `@types/bs58` and `@wallet-standard/app`; added `viem` to the root, Node SDK and CLI manifests. Resolved version: **viem 2.57.11**.

What the `Ethereum` rail does today:

- `Describe()` (`network: 'ethereum'`, `native_currency: 'eth'`, chain id, USDC address), `ExplorerUrl()` (Etherscan / Sepolia Etherscan, empty on Anvil), `CheckWalletExists()` (`isAddress`), `GetNativeBalance()` and `GetUSDCBalance()` (`balanceOf / 1e6`, after checking `decimals() == 6` once).
- Every money flow (payout build/broadcast, checkout, subscriptions, deposits) rejects with a 501 `not_supported` error: `<method> is not available on this settlement rail yet`. Later tasks implement them.
- Chain selection lives in `chains/Chain.ts`: mainnet (`1`) in live mode, Sepolia (`11155111`) in test mode, Anvil (`31337`) via `ETH_CHAIN_ID` (refused when `LIVEMODE=true`). Contract addresses come from `chains/contracts.ts` with env overrides. The public client uses a viem `fallback` transport over `ETH_RPC_URL`. `GetSettlement()` now memoises the rail; `ResetChainClientsForTests()` clears the chain config, clients and that memo.

Behaviour changes:

- Environment: `SOLANA_RPC_URL` → `ETH_RPC_URL` (comma-separated, first is primary); `TRANSACTION_FEE_PAYER_KEY` → `CHECKOUT_RELAYER_KEY`; new `ETH_CHAIN_ID`, `ETH_CONFIRMATIONS` (default 2), `USDC_ADDRESS`, `PAYOUT_BATCH_ADDRESS`, `SUBSCRIPTIONS_ADDRESS`, `SANCTIONS_ORACLE_ADDRESS`, `CHECKOUT_CONFIRM_TIMEOUT_MS` (documented; read from Task 11). `CHECKOUT_RELAYER_KEY` and `SUBSCRIPTION_OPERATOR_KEY` must match `/^0x[0-9a-fA-F]{64}$/`, and the API refuses to start otherwise.
- API: `external_account.wallet_address`, `POST /v1/setup` `wallet_address` and checkout `payer_wallet` must be Ethereum addresses and are stored checksummed. External wallets, charges, top-ups and ledger entries record the rail's `network` (`ethereum`, or `simulated` on the simulated rail) instead of `solana`. Checkout prepare returns `relayed` instead of `fee_sponsored`; the two-step `init_authority` subscription checkout and `subscription_step` are gone. The simulated test wallet is `0x1111111111111111111111111111111111111111`.
- Renamed public field (plan-author decision A1): `PayInvoice` `settlement_signature` → `settlement_transaction_hash` (SDK `PayInvoiceInput` regenerated). The error text now names `settlement_transaction_hash`. No format check yet.
- `ChargePaymentMethodDetailsCrypto.network` drops `solana` and gains `simulated`; `token_currency` drops `phantom_cash`.
- Web: `SolanaWalletService` → `WalletService` (EIP-6963 discovery with a `window.ethereum` fallback, `Connect`, `EnsureChain`, `SignTypedData`, `SendTransaction`, local-key helpers). The setup wizard generates a secp256k1 key in the browser. On-chain checkout and dashboard payout signing show an error until Tasks 9 and 12. Mobile handoff links go to MetaMask and Coinbase Wallet. The add-funds panel points to the Circle faucet only.
- SDK: `payouts.sign(unsignedTransaction, privateKey)` is now async and signs an EIP-1559 transaction with viem; `processBatch`/`processAll` take a `0x` private key.
- CLI: `agent setup` generates a secp256k1 wallet and sends `walletAddress`. `wallet backup` writes `{ address, privateKey, version: 3 }`, and `env sync --include-wallet` writes `WALLET_PRIVATE_KEY`.
- Build: `apps/api` now compiles with `strictNullChecks` (viem's types require it). The few existing nullability errors were fixed with type-level changes; the only runtime difference is that `ProductModule.CreateProduct` with `default_price_data` but no price module now throws a clear `PriceModule not configured` error instead of a `TypeError`.
- Tests: the Jest `moduleNameMapper` / diagnostics exclusion for the Solana module is gone, and so are the `estimated_fee_lamports` absence assertions (ruling R10).

Added:

```
apps/api/src/__tests__/AppConfig.spec.ts
apps/api/src/modules/chains/Chain.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
apps/api/src/modules/chains/abi/Usdc.ts
apps/api/src/modules/chains/contracts.ts
apps/web/src/app/core/services/wallet-viem.ts
apps/web/src/app/utils/validation/ethereum.ts
apps/web/src/assets/images/logos/ethereum.svg
libs/shared-schemas/src/lib/AddressSchema.ts
```

Deleted:

```
apps/api/src/__tests__/mocks/Solana.ts
apps/api/src/modules/chains/Solana.spec.ts
apps/api/src/modules/chains/Solana.ts
apps/web/src/app/utils/validation/solana.ts
apps/web/src/assets/icons/phantom-wallet.svg
apps/web/src/assets/images/logos/solana.svg
```

Modified:

```
.env.example
.env.production.example
AGENTS.md
CHANGES.md
CONTRIBUTING.md
apps/api/jest.config.ts
apps/api/src/__tests__/Account.spec.ts
apps/api/src/__tests__/Balance.spec.ts
apps/api/src/__tests__/Charge.spec.ts
apps/api/src/__tests__/CheckoutPayment.spec.ts
apps/api/src/__tests__/Customer.spec.ts
apps/api/src/__tests__/ExternalWallet.spec.ts
apps/api/src/__tests__/IdentityVerificationSession.spec.ts
apps/api/src/__tests__/Invoice.spec.ts
apps/api/src/__tests__/Payout.spec.ts
apps/api/src/__tests__/Price.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/SetupModule.spec.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/main.ts
apps/api/src/modules/AppConfig.ts
apps/api/src/modules/BillingMonitor.ts
apps/api/src/modules/Charge.ts
apps/api/src/modules/CheckoutPayment.ts
apps/api/src/modules/Customer.ts
apps/api/src/modules/ExternalWallet.ts
apps/api/src/modules/Invoice.ts
apps/api/src/modules/PaymentIntent.ts
apps/api/src/modules/Payout.ts
apps/api/src/modules/Product.ts
apps/api/src/modules/SanctionsScreening.ts
apps/api/src/modules/Setup.ts
apps/api/src/modules/Subscription.ts
apps/api/src/modules/SubscriptionBilling.ts
apps/api/src/modules/TopUp.ts
apps/api/src/modules/TopUpMonitor.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/modules/chains/types.ts
apps/api/src/routes/balance.routes.ts
apps/api/src/routes/paymentPages.routes.ts
apps/api/src/routes/setup.routes.ts
apps/api/src/routes/topups.routes.ts
apps/api/src/utils/RecurringInterval.ts
apps/api/tsconfig.json
apps/cli/README.md
apps/cli/package.json
apps/cli/src/app/AgentSetup.spec.ts
apps/cli/src/app/AgentSetup.ts
apps/cli/src/app/Cli.ts
apps/cli/src/app/EnvSync.spec.ts
apps/cli/src/app/EnvSync.ts
apps/cli/src/app/Wallet.spec.ts
apps/cli/src/app/Wallet.ts
apps/docs/src/app/pages/docs/data/charges.ts
apps/docs/src/app/pages/docs/data/environment-variables.ts
apps/docs/src/app/pages/docs/data/invoices.ts
apps/docs/src/app/pages/docs/data/local-development.ts
apps/docs/src/app/pages/docs/data/self-hosting.ts
apps/web/src/app/core/services/wallet.service.spec.ts
apps/web/src/app/core/services/wallet.service.ts
apps/web/src/app/data/services/checkout-session.service.ts
apps/web/src/app/data/services/external-wallet.service.ts
apps/web/src/app/data/services/setup.service.ts
apps/web/src/app/features/account/balance/components/add-funds-panel/add-funds-panel.component.html
apps/web/src/app/features/account/balance/components/add-funds-panel/add-funds-panel.component.ts
apps/web/src/app/features/account/balance/components/balance-detail/balance-detail.component.html
apps/web/src/app/features/account/balance/components/balance-detail/balance-detail.component.ts
apps/web/src/app/features/account/components/transaction-list/components/payout-detail/payout-detail.component.ts
apps/web/src/app/features/account/components/transaction-list/components/topup-detail/topup-detail.component.ts
apps/web/src/app/features/account/connected-accounts/components/payout-modal/payout-modal.component.html
apps/web/src/app/features/account/connected-accounts/components/payout-modal/payout-modal.component.ts
apps/web/src/app/features/account/connected-accounts/services/connected-account-actions.service.ts
apps/web/src/app/features/account/connected-accounts/util/connected-account-display.ts
apps/web/src/app/features/account/payment-intents/views/payment-intent-detail/payment-intent-detail.component.html
apps/web/src/app/features/account/payment-intents/views/payment-intent-detail/payment-intent-detail.component.ts
apps/web/src/app/features/account/payment-links/components/payment-link-preview/payment-link-preview.component.html
apps/web/src/app/features/checkout/checkout.component.html
apps/web/src/app/features/checkout/checkout.component.spec.ts
apps/web/src/app/features/checkout/checkout.component.ts
apps/web/src/app/features/checkout/util/mobile-wallet.spec.ts
apps/web/src/app/features/checkout/util/mobile-wallet.ts
apps/web/src/app/features/setup/setup.component.html
apps/web/src/app/features/setup/setup.component.ts
apps/web/src/app/shared/forms/external-wallet-form/external-wallet-form.component.html
apps/web/src/app/shared/forms/external-wallet-form/external-wallet-form.component.ts
apps/web/src/app/shared/ui/wallet-guide/wallet-guide.component.html
apps/web/src/app/shared/ui/wallet-guide/wallet-guide.component.scss
apps/web/src/app/utils/constants/test-data.ts
apps/web/src/app/utils/validation/index.ts
docker-compose.yml
libs/shared-schemas/src/lib/CheckoutSessionSchema.ts
libs/shared-schemas/src/lib/ExternalWalletSchema.ts
libs/shared-schemas/src/lib/InvoiceSchema.ts
libs/shared-schemas/src/lib/index.ts
libs/shared-types/src/lib/Charge.ts
libs/shared-types/src/lib/CheckoutSession.ts
libs/shared-types/src/lib/Config.ts
libs/shared-types/src/lib/Customer.ts
libs/shared-types/src/lib/ExternalWallet.ts
libs/shared-types/src/lib/Price.ts
libs/shared-types/src/lib/Subscription.ts
package-lock.json
package.json
sdks/node/README.md
sdks/node/package.json
sdks/node/src/__tests__/Payouts.spec.ts
sdks/node/src/generated/Inputs.ts
sdks/node/src/resources/ExternalAccounts.ts
sdks/node/src/resources/Payouts.ts
sdks/node/tsup.config.ts
```

## Task 7: Foundry contracts project, `PayoutBatch`, `MockUSDC` and the Anvil test lane

The repo now has a Foundry project in `contracts/` (Nx project `contracts`, targets `build` = `forge build` and `test` = `forge test -vv`; `solc 0.8.28`, EVM `cancun`, optimizer 200 runs). Dependencies are git submodules pinned to `forge-std` v1.9.4 and `openzeppelin-contracts` v5.1.0 (`contracts/foundry.lock` records the tags).

- `PayoutBatch.disperse(token, recipients, amounts, batchId)` moves the caller's own tokens to up to 200 recipients in one all-or-nothing transaction (`SafeERC20.safeTransferFrom`) and emits `BatchPaid(payer, token, batchId, count, total)`. It rejects empty, mismatched or oversized batches, zero recipients and zero amounts. No owner, no state, no ETH handling. Nothing deploys it yet.
- `MockUSDC` (test only, `contracts/test/mocks/`) mimics Circle's FiatTokenV2 on Anvil: name `USD Coin`, symbol `USDC`, 6 decimals, EIP-712 domain version `2`, EIP-2612 `permit`, EIP-3009 `transferWithAuthorization` / `receiveWithAuthorization` / `authorizationState` with `AuthorizationUsed`, and open `mint` / `blacklist` hooks with FiatTokenV2's revert strings (`Blacklistable: account is blacklisted`). It implements `permit` itself on `ERC20` + `EIP712` + `Nonces` because OpenZeppelin's `ERC20Permit` fixes the domain version to `1`. Its NatSpec lists the known gaps against FiatTokenV2_2, and `MockUSDC.anvil.spec.ts` pins the behaviour with viem-signed permits and authorizations.
- `npx nx run api:test-anvil` (depends on `contracts:build`, never cached, fails when no spec runs) runs `apps/api/src/__tests__/anvil/*.anvil.spec.ts` with `apps/api/jest.anvil.config.ts`. The harness starts `anvil` on a free port, deploys `MockUSDC` and `PayoutBatch` with Anvil account #0, mints 1,000,000 USDC to the platform (#1) and buyer (#2) wallets and points the chain env at it. Importing the harness sets a 120 s Jest timeout. The default `api:test` ignores `*.anvil.spec.ts`, so unit tests never need Foundry.
- `ResetChainClientsForTests()` now also calls the new `ReloadRailSettingsForTests()` (`AppConfig.ts`), which re-reads `LIVEMODE` and `SETTLEMENT_RAIL` into the memoised app config (keeping its app secret). A spec that read the config before switching the env to a chain therefore gets that chain's rail, and `StartAnvil()` throws if the API still resolves the simulated rail.
- `PAYOUT_BATCH_ABI` (`apps/api/src/modules/chains/abi/PayoutBatch.ts`) is the contract ABI; a harness test fails if it drifts from the forge artifact.
- `apps/api/tsconfig.spec.json` targets `es2020`, so specs can use bigint literals.
- CI installs Foundry (`foundry-rs/foundry-toolchain@v1`, pinned to `v1.5.1`) and checks out submodules in the `test` and `build` jobs, and the `test` job also runs `api:test-anvil`. `.nxignore` keeps the OpenZeppelin submodule's own `package.json` files out of the Nx project graph.

Added:

```
.gitmodules
.nxignore
apps/api/jest.anvil.config.ts
apps/api/src/__tests__/anvil/Anvil.ts
apps/api/src/__tests__/anvil/Artifacts.ts
apps/api/src/__tests__/anvil/Harness.anvil.spec.ts
apps/api/src/__tests__/anvil/MockUSDC.anvil.spec.ts
apps/api/src/modules/chains/abi/PayoutBatch.ts
contracts/README.md
contracts/foundry.lock
contracts/foundry.toml
contracts/lib/forge-std (submodule, v1.9.4)
contracts/lib/openzeppelin-contracts (submodule, v5.1.0)
contracts/project.json
contracts/remappings.txt
contracts/script/DeployPayoutBatch.s.sol
contracts/src/PayoutBatch.sol
contracts/test/PayoutBatch.t.sol
contracts/test/mocks/MockUSDC.sol
```

Modified:

```
.github/workflows/ci.yml
.gitignore
.prettierignore
CHANGES.md
apps/api/jest.config.ts
apps/api/project.json
apps/api/src/__tests__/AppConfig.spec.ts
apps/api/src/modules/AppConfig.ts
apps/api/src/modules/chains/Chain.ts
apps/api/tsconfig.spec.json
eslint.config.mjs
```

## Task 8: Payouts on Ethereum (build, broadcast, reconcile)

Batch payouts now settle on Ethereum through the `PayoutBatch` contract. The money rule: a payout is refunded only after a final reverted receipt, or once reconcile proves its batch's nonce went to another transaction **and** no `BatchPaid` log for its batch id exists. Every other uncertainty (timeouts, RPC or log-range errors, a hash not yet visible) leaves the state untouched.

- **Build** (`POST /v1/payouts/build`, up to 100 payouts) returns an unsigned EIP-1559 transaction:
  - The new fields are `payout_batch`, `replaced_payout_batch`, `gas_limit`, `max_fee_per_gas` and `max_priority_fee_per_gas`.
  - Fees: `gas_limit` is `estimateGas` × 1.2, and `max_fee_per_gas` is 2 × base fee + priority fee.
  - If the wallet's allowance to PayoutBatch is below the total, build returns `transaction_type: 'approval'` (`approve(PayoutBatch, MaxUint256)`) with `payouts: []`.
  - Before building it rejects, with a 400 that lists the offenders: invalid addresses, recipients the USDC issuer blacklisted (`account_frozen`), sanctioned recipients (`sanctioned_address`), and a wallet balance below the total (`insufficient_funds`).
- **Nonce lock.** The new internal `PayoutBatches` collection (`pob_z_…`) records each built transaction. A unique partial index on `{chain_id, wallet_address}` covering `status ∈ {built, broadcast}` allows one outstanding batch per wallet, on every rail (`chain_id` and `nonce` are null on the simulated rail).
  - Two concurrent builds cannot share a nonce: the second insert hits a duplicate key (11000), which maps to `409 payout_batch_in_progress`.
  - `replace: true` re-prices the outstanding batch in place: same payouts, nonce and `batch_id`, fees ≥ 1.125×, earlier hashes kept.
  - It can also supersede a batch that was only built with a different set; the old batch becomes `replaced`.
  - A batch broadcast from a wallet (`transaction_hash`) is refused with `400 use_wallet_speed_up`.
  - `CancelPayout` refuses payouts held by an outstanding batch.
- **Tenant scoping.** The nonce lock stays global per `{chain_id, wallet_address}`, because nonces are per wallet. Only the build-time lock check reads across platforms.
  - Another platform's outstanding batch on a shared wallet blocks a build with a generic `409 payout_batch_in_progress`, and `replace: true` never re-prices or supersedes it.
  - Broadcast, reconcile and every batch transition load and update only the caller's own batches: `platform_account` is part of each lookup and of the transition filter.
  - Errors never name another platform's payout or batch ids.
- **Broadcast** takes `signed_transaction` or `transaction_hash` (exactly one), plus the batch's payout ids (`[]` for the approval). The response gains `transaction_type`.
  - A signed transaction must match the built one (signer, chain id, nonce, `to`, calldata) before anything changes.
  - The batch (`broadcast` + hash) and its payouts (`in_transit`) are then saved in one transaction **before** `eth_sendRawTransaction`. If the node rejects the transaction, both are restored.
  - A hash must come from the platform wallet with the built `to` and calldata. The wallet's actual nonce is recorded. If the hash is not visible within 60 s, broadcast returns `409 transaction_not_found`.
  - Posting the same hash again returns the current state. A matching speed-up hash at the same nonce is appended to `transaction_hashes`; anything else is `409 payout_batch_mismatch`.
  - Broadcast waits up to 60 s for `ETH_CONFIRMATIONS`:
    - `status: 1` with the matching `BatchPaid` log → `paid`.
    - `status: 0` → `failed` with a refund. The revert reason is replayed: `Blacklistable: account is blacklisted` maps to `account_frozen`, anything else to `blockchain_error`.
    - Timeout → `pending`, with payouts still `in_transit` and no refund.
- **Reconcile** (`POST /v1/payouts/reconcile`, `ReconcilePayoutBatches`) runs at the start of build and broadcast and on demand. It reads the nonce at `latest - ETH_CONFIRMATIONS` before checking receipts. For built and broadcast batches:
  - A confirmed own receipt settles the batch.
  - Otherwise, once the nonce is consumed, a `BatchPaid(payer, USDC, batchId)` log from `PayoutBatch` in `build_block .. latest - ETH_CONFIRMATIONS` with the same count and total → `paid`. This covers wallet speed-ups and clients that never called broadcast.
  - With no such log → `replaced`. Broadcast payouts become `failed` and are refunded; a built batch's payouts stay `pending`; approvals have no payout effect.
- **Ethereum rail** (`Ethereum.ts`):
  - New methods: `BuildBatchPayoutTransaction`, `BuildApprovalTransaction`, `MatchPayoutTransaction`, `BroadcastSignedTransaction`, `WaitForReceipt`, `GetTransactionStatus`, `FindBatchPayment`, `GetAccountNonce` (pending or confirmed) and `IsBlacklisted`.
  - The allowance and balance checks and `isBlacklisted` go through one multicall. It runs deployless where the chain has no Multicall3 (Anvil).
  - The simulated rail implements the same interface.
- **Pure helpers** in `chains/PayoutEncoding.ts`: `ComputeBatchId`, `EncodeDisperseCall`, `ParsePayoutReceipt` and `MapRevertToFailureCode`.
- **Sanctions** (§4.8): `CheckWalletAddresses` adds the chain's Chainalysis oracle (`isSanctioned`, through multicall) to the static list. It is skipped on the simulated rail, and RPC failures log a warning without blocking. Payout build screens every recipient.
- **Startup (A2):** `BuildConfigFromEnv` resolves the chain env on the on-chain rail, so `ETH_CHAIN_ID` in live mode or a bad `ETH_CONFIRMATIONS` fails at boot.
- **Test address (A3):** `Ethereum.spec` rejects an all-uppercase address (correction C2).
- **Schemas, types and SDK:**
  - `BuildPayoutsBatchSchema` adds `replace` and allows up to 100 payouts.
  - `BroadcastPayoutsBatchSchema` makes `signed_transaction` and `transaction_hash` optional (exactly one required), and `payouts` allows 0–100.
  - New `PayoutBatch` and `ReconcileResponse` types.
  - SDK: `payouts.reconcile()`. Signing changes land in Task 9.
- **Docs:** build, broadcast and reconcile pages, including the residual wallet-broadcast nonce risk.
- **Tests:**
  - New Anvil spec, `Payouts.anvil.spec.ts`: approval → payout with exact recipient balances, a blacklisted build → 400, a revert after build → `account_frozen` with a refund, a wallet-sent hash, and reconcile `replaced` and `BatchPaid` paths.
  - The in-memory `MemoryDatabase` test helper backs the payout state-machine specs.

Added:

```
apps/api/src/__tests__/PayoutBatchStore.spec.ts
apps/api/src/__tests__/PayoutEncoding.spec.ts
apps/api/src/__tests__/SanctionsScreening.spec.ts
apps/api/src/__tests__/anvil/Payouts.anvil.spec.ts
apps/api/src/__tests__/mocks/MemoryDatabase.ts
apps/api/src/modules/PayoutBatchStore.ts
apps/api/src/modules/chains/PayoutEncoding.ts
```

Modified:

```
CHANGES.md
apps/api/src/__tests__/AppConfig.spec.ts
apps/api/src/__tests__/Payout.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/modules/AppConfig.ts
apps/api/src/modules/Database.ts
apps/api/src/modules/Payout.ts
apps/api/src/modules/SanctionsScreening.ts
apps/api/src/modules/chains/Chain.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/modules/chains/types.ts
apps/api/src/routes/payouts.routes.ts
apps/docs/src/app/pages/docs/data/payouts.ts
libs/shared-schemas/src/lib/PayoutSchema.ts
libs/shared-types/src/lib/Payout.ts
sdks/node/src/__tests__/Payouts.spec.ts
sdks/node/src/generated/Inputs.ts
sdks/node/src/resources/Payouts.ts
```

### Task 8 fix round 1: replay protection and settlement hardening

- **`PayoutBatch` replay protection (addendum A5).** This supersedes "no state" above.
  - `disperse` records `paid[msg.sender][batchId]` before the transfer loop. A revert in the loop rolls the flag back.
  - It rejects a repeated batch id with `BatchAlreadyPaid()` and the zero id with `ZeroBatchId()`.
  - The public `paid(address,bytes32)` getter is the on-chain record. A batch id (the hash of its payout ids) can therefore be paid once per platform wallet.
  - There are six new forge tests, including the retry fuzz test `testFuzzNoDoubleSpendAcrossRetries`. `testFuzzDisperse` now uses non-zero batch ids.
  - `PAYOUT_BATCH_ABI` is regenerated from the artifact.
- **Build** reads `paid(wallet, batchId)` in the same multicall as the balance and allowance, and refuses with `400 payout_batch_already_paid`.
- **Receipts.** A revert that decodes to `BatchAlreadyPaid` is never a failure and never refunds. The batch settles `paid` once `paid()` is true, attributed to the transaction its `BatchPaid` log names; otherwise it stays pending.
- **Reconcile.**
  - It reads the confirmed block (`latest - ETH_CONFIRMATIONS`) once and passes that block explicitly to the nonce read, the receipt depth check, `paid()` and the log search.
  - `paid()` is the verdict. Logs only locate the paying hash, and a paid batch whose log cannot be found stays untouched.
  - A log search that ends before the build block throws, which leaves the batch untouched.
  - New rail methods: `GetConfirmedBlockNumber` and `IsBatchPaid`. `GetTransactionStatus` and `FindBatchPayment` take the block, and `GetAccountNonce(address, blockNumber)` replaces the earlier pending/confirmed tag.
- **Supersede.**
  - `replace: true` refuses to replace a built batch that has a tracked transaction hash with other payouts: `409 payout_batch_in_flight`, reconcile first.
  - Reconcile walks a batch's `replaces` chain and settles any superseded batch the chain shows paid, so its payouts are neither refunded nor rebuilt.
  - The docs warn to replace only batches that were never sent.
- **Payout claims.** Payouts gain `payout_batch`, documented on the payout object.
  - Build claims each payout with a conditional update (`pending` and unclaimed → claimed) inside the transaction that creates or supersedes the batch. It fails if any claim misses.
  - Cancel is a conditional update on `pending` and unclaimed, and refunds only when that update matched. A racing build or a second cancel can therefore never cause a double refund.
  - Moving payouts in and out of transit, refunds and releases all require the batch's own claim.
- **Hash-mode nonce binding.** Once a batch tracks any transaction hash, another hash must use the same nonce.
- **Address comparisons.** `FindBatchPayment` compares addresses case-insensitively, and the per-chain table addresses in `contracts.ts` are checksummed when the chain config loads.
- **Resend.** Re-posting the same `signed_transaction` for a broadcast batch sends it again (a node answers "already known"). This rescues payouts left in transit by a crash between persist and send.
- **Tests:** unit tests for every settlement gate on the Ethereum rail (mocked RPC), the build/cancel and cancel/cancel races, the superseded-then-mined scenario, single-block reconcile, and Anvil replay of a paid batch (`BatchAlreadyPaid`, nothing paid twice) plus the `payout_batch_already_paid` build refusal.

Modified in fix round 1:

```
CHANGES.md
apps/api/src/__tests__/Payout.spec.ts
apps/api/src/__tests__/PayoutBatchStore.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/anvil/Payouts.anvil.spec.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/modules/Payout.ts
apps/api/src/modules/PayoutBatchStore.ts
apps/api/src/modules/chains/Chain.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/modules/chains/abi/PayoutBatch.ts
apps/api/src/routes/payouts.routes.ts
apps/docs/src/app/pages/docs/data/payouts.ts
contracts/README.md
contracts/src/PayoutBatch.sol
contracts/test/PayoutBatch.t.sol
libs/shared-types/src/lib/Payout.ts
```

### Task 8 fix round 2: on-chain batch expiry (addendum A6)

- **`PayoutBatch.disperse` takes a `deadline`.** `disperse(token, recipients, amounts, batchId, deadline)` reverts `BatchExpired()` first when `block.timestamp > deadline`; a call at exactly the deadline passes, and an expired call leaves `paid` false.
  - There are two new forge tests. Existing tests pass a far-future deadline.
  - The ABI is regenerated, and `EncodeDisperseCall` takes `deadline`.
- **Deadline window.** It is the new `PAYOUT_BUILD_DEADLINE_SECONDS` (integer, 120..86400, default 1800), validated at boot. It is documented in `.env.example`, `.env.production.example`, `docker-compose.yml` and the environment-variables docs page.
  - Build accepts `deadline_seconds` (120..86400). The Ethereum rail sets the deadline from the latest block's timestamp.
  - Build returns `deadline` and `release_after` (deadline + `ETH_CONFIRMATIONS` × 12 s, informational). The batch stores `deadlines[]`, one per signed copy; a same-set re-price appends a fresh deadline.
- **Expiry proof.** The block at `latest - ETH_CONFIRMATIONS` has a timestamp past `max(deadlines)`, and `paid(wallet, batchId)` is false at that same block. Only the expiry proof, or `paid()` being true, ends a batch's hold on its payouts.
  - Reconcile releases a built batch (→ `replaced`, payouts back to `pending`) and refunds a broadcast batch (→ `replaced`) only on the expiry proof. It no longer releases because a nonce was consumed.
  - A final non-`BatchAlreadyPaid` revert sets the batch to the new `reverted` status. Its payouts stay `in_transit` with the failure recorded, and are refunded (batch → `failed`) only once expired. `reverted` batches hold payouts but not the nonce lock; the unique index is unchanged.
  - Cancel reconciles first and refuses a payout an outstanding batch holds.
  - Superseding with a different payout set is refused while the batch can still execute (`409 payout_batch_in_flight`).
  - The immediate paths are `paid()` true → paid (with a null hash when no log is found), and a same-set re-price. Approvals have no deadline and reconcile as before.
  - The simulated rail stores the deadline but never waits (`WaitsForExpiry()` is false).
- **Rail interface.** `GetConfirmedBlock()` (number and timestamp, read once) replaces `GetConfirmedBlockNumber()`, and `WaitsForExpiry()` is new.
- **Revert replay.** A replay that fails without an execution revert (an RPC or transport error) now throws, so the receipt is left unsettled instead of becoming a failure.
- **Other review findings.**
  - `transaction_not_found` keeps the reported hash in a new `reported_hashes[]`. Supersede refuses while it is set, and reconcile checks it.
  - A reconciled receipt counts as paid only when `paid()` agrees.
  - Settling a batch moves it from its own status, so a stale copy cannot move it.
  - Cancel and build refuse payouts held by a `replaced` batch that has no deadline.
  - If a batch turns out paid after one of its payouts was refunded, an error-level "Double payment detected" alert is logged.
  - The docs give the A6 sentence, and "paid once" now says it applies to an identical payout set.

Modified in fix round 2:

```
.env.example
.env.production.example
CHANGES.md
apps/api/src/__tests__/AppConfig.spec.ts
apps/api/src/__tests__/Payout.spec.ts
apps/api/src/__tests__/PayoutBatchStore.spec.ts
apps/api/src/__tests__/PayoutEncoding.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/anvil/Payouts.anvil.spec.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/modules/AppConfig.ts
apps/api/src/modules/Payout.ts
apps/api/src/modules/PayoutBatchStore.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
apps/api/src/modules/chains/PayoutEncoding.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/modules/chains/abi/PayoutBatch.ts
apps/api/src/modules/chains/types.ts
apps/api/src/routes/payouts.routes.ts
apps/docs/src/app/pages/docs/data/environment-variables.ts
apps/docs/src/app/pages/docs/data/payouts.ts
contracts/README.md
contracts/src/PayoutBatch.sol
contracts/test/PayoutBatch.t.sol
docker-compose.yml
libs/shared-schemas/src/lib/PayoutSchema.ts
libs/shared-types/src/lib/Payout.ts
sdks/node/src/generated/Inputs.ts
```

### Task 8 fix round 3: reconcile robustness

- **Unreadable receipts no longer block reconcile.** Reconcile reads every tracked or reported hash through `ReadTransactionStatus`, which logs and skips an unreadable receipt. A replay a pruned node cannot serve (`missing trie node`) or an out-of-gas replay therefore never stops the `paid()` verdict or the expiry proof: a reverted batch is still refunded once expired, and a hash-mode batch still frees the wallet lock.
- **`BatchAlreadyPaid` uses the confirmed block.** A `BatchAlreadyPaid` revert reads `paid()` (and the log) at the confirmed block — reconcile's, or a fresh one at broadcast — never at the receipt's old block.
- **Refunds and releases are atomic.** Ending a batch without payment moves the batch (from its own status) and refunds or releases every payout in one DB transaction, emitting `payout.failed` after the commit. A crash or a failed write mid-way rolls everything back for the next reconcile, which completes the refunds exactly once (`FailPayout` replaces `MarkPayoutFailed`).
- **Releases are pinned to their deadlines.** The release's compare-and-set also requires the `deadlines` the batch was judged expired on, so a same-set re-price that added a deadline since makes it a no-op.
- **Paid payouts drop stale failures.** A payout marked `paid` clears any `failure_code`/`failure_message` recorded while its batch was `reverted`.
- **New specs:**
  - an unreadable receipt, still released and refunded after expiry;
  - a hash-mode batch freeing its lock;
  - a refund interrupted midway, completed once;
  - a re-price racing a release;
  - simulated-rail recovery of a batch a crash left in `broadcast`, by broadcasting it again.
- **Dev databases.** Dev databases created before commit `5111a46` should drop the `PayoutBatches` collection: batches recorded before deadlines existed hold their payouts permanently (they could still be mined).

Modified in fix round 3:

```
CHANGES.md
apps/api/src/__tests__/Payout.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/mocks/MemoryDatabase.ts
apps/api/src/modules/Payout.ts
apps/api/src/modules/PayoutBatchStore.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
```

## Task 9: SDK and dashboard payout signing

The Node SDK and the dashboard now drive the Ethereum payout API from Task 8. Both check a built transaction before signing it. Neither sends a transaction a second time: after an unclear outcome, the only next step is reconcile.

- **SDK `sign(build, privateKey, { expectedSigner? })`** replaces `sign(unsignedTransaction, privateKey)`. This is a breaking change.
  - Before signing, it checks that the transaction calls `build.to` ("Unsigned transaction does not target the expected contract") on `build.chain_id`.
  - With `expectedSigner`, it also checks that the key belongs to that wallet.
  - `'sim_tx'` still passes through unsigned.
- **SDK `ensureAllowance(privateKey, params, options?)`**:
  - It builds. If build returns the one-time `approval`, it signs that, broadcasts it with `payouts: []`, and builds once more.
  - It returns `{ build, approval }`. `build` is `null` while the approval is `pending` or `failed`.
  - The new shared type is `EnsureAllowanceResult`.
- **SDK `processBatch(privateKey, { limit, replace, expectedSigner, requestOptions })`**:
  - It takes up to 100 payouts (default 100, was 10).
  - It handles the approval through `ensureAllowance`.
  - `replace: true` re-prices the wallet's outstanding batch with the same payouts. It is sent on the first build only. A different set still waits for the batch to be paid or to expire, which the API enforces.
  - `ProcessPendingResult` gains `transaction_type`. A stopped approval returns `status: 'pending'` (or `failed`) with `transaction_type: 'approval'`.
- **SDK `processAll`** stops at the first result that is not `paid` and returns the results so far, including that one, with `has_more: true`. The caller then reconciles and resumes.
- **SDK request options.** The multi-request helpers drop `idempotencyKey` from their request options. The API keys idempotency by key alone, so one key would replay the first response.
- **SDK errors.** Build and broadcast raise `ZonelessPayoutBatchError` for the payout batch codes. Its `code` comes from the API's `error.type`, which is also kept. The codes are:

  - `payout_batch_in_progress`, `payout_batch_in_flight`, `payout_batch_already_paid`, `payout_batch_mismatch`;
  - `transaction_not_found`, `use_wallet_speed_up`;
  - `account_frozen`, `sanctioned_address`, `insufficient_funds`, `blockchain_error`.

  The class and `PAYOUT_BATCH_ERROR_CODES` are exported. The README gains a payouts section covering the private key, the allowance step, gas, pending results and same-set `replace`.

- **Public config.**
  - `PublicConfig` gains `network`, `chain_id` and `explorer_url_base`. They come from the rail's `Describe()` and the chain explorer table, through `PublicRailConfig()`. The base is empty on Anvil and on the simulated rail.
  - The web's duplicate `EtherscanUrl`, which linked Anvil to Sepolia, is removed. `ConfigService.GetExplorerUrl()` replaces it in the payment intent and balance views.
- **Wallet.** `WalletService.SendTransaction({ from, to, data, value?, chainId })`:

  - Right before sending, it re-reads the active account (`eth_accounts`) and checks `getChainId()`.
  - It then passes a chain object, so viem checks the chain once more.
  - A wrong account or chain throws `WalletNotReadyError`, and nothing is sent.

  `EnsureChain`:

  - After `wallet_addEthereumChain`, it switches again if the wallet did not, then verifies the chain.
  - `IsUnrecognizedChainError` also matches MetaMask Mobile's `-32603` with `data.originalError.code === 4902`.

  New helpers: `ReadBuiltTransaction` (checked target and calldata) and `IsUserRejectedError`.

- **Dashboard payout modal.** The on-chain flow takes two clicks:
  1. "Review payout" creates the payout and builds it with `deadline_seconds: 300`, so a build that is never signed releases its payout within minutes.
  2. "Sign and pay out" signs and broadcasts.
- **Approval.** An approval build adds an "Approve USDC" step first, and the payout is then built for its own confirmation.
- **Wallet path.** `EnsureChain(config.chain_id)` → `SendTransaction` → broadcast `{ transaction_hash }`.
- **Private-key path.**
  - It runs `SignTransactionWithPrivateKey` → broadcast `{ signed_transaction }`.
  - The pasted key stays in the browser, is never stored, and is cleared after each signature.
- **Review step.** It shows:

  - `estimated_fee` in ETH (6 decimals), the fee per recipient, and the gas price in gwei;
  - the line "Network gas is paid in ETH from the platform wallet; see the gas guide.";
  - "Sign before HH:MM";
  - and on close, the notice that the payout stays reserved until `release_after`.

  Closing at that point never cancels the payout, because its batch holds it.

- **Fee display.** Open decision 16 is resolved as ETH-only display; a Chainlink-backed USD estimate is a follow-up after Task 18 verifies the Chainlink ETH/USD feed addresses. The fee rows leave a slot for that USD line.
  - Follow-up: Chainlink ETH/USD feed addresses to be verified in Task 18.
  - The gas guide is plain text until Task 16 adds the gas page.
- **Unclear outcomes.** Each leads to the submitted step, whose only action is Reconcile:
  - A `pending` broadcast, or a broadcast error such as `transaction_not_found` or a timeout, shows "Submitted, waiting for confirmations.".
  - A wallet error after the prompt shows "The wallet did not confirm whether it sent the transaction…". This excludes a user rejection and a `WalletNotReadyError` (wrong account or chain, nothing sent): those keep the review step, so the user can sign the same build again.
  - Reconcile then reads the payout. It closes on `paid`, reports `failed`, and returns to details, for a fresh build, once the batch released the payout.
- **Batch conflicts.** `payout_batch_in_progress` on build offers Reconcile and "Replace outstanding batch" (`replace: true`). `payout_batch_in_flight` and `payout_batch_already_paid` offer Reconcile.
- **Simulated rail.** It keeps its one-click flow (`sim_tx`).
- **Web plumbing.**
  - `ApiService` keeps the API error `type` on thrown errors (`GetApiErrorType`).
  - `PayoutService` gains `Reconcile()` and `GetPayout()`.
  - The broadcast timeout is 150 s. The API can wait 60 s for a wallet hash to appear plus 60 s for confirmations.
- **Docs.** The payouts page's SDK snippets use `sign(build, key)`, `process.env.WALLET_PRIVATE_KEY`, 100-payout batches, and the approval, pending and reconcile behaviour of the helpers.

Added:

```
apps/web/src/app/features/account/connected-accounts/components/payout-modal/payout-modal.component.spec.ts
apps/web/src/app/features/account/connected-accounts/services/connected-account-actions.service.spec.ts
apps/web/src/app/features/account/connected-accounts/util/payout-fee.spec.ts
apps/web/src/app/features/account/connected-accounts/util/payout-fee.ts
```

Modified:

```
CHANGES.md
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/routes/config.routes.ts
apps/docs/src/app/pages/docs/data/payouts.ts
apps/web/src/app/core/services/api.service.ts
apps/web/src/app/core/services/wallet.service.spec.ts
apps/web/src/app/core/services/wallet.service.ts
apps/web/src/app/data/services/config.service.ts
apps/web/src/app/data/services/payout.service.ts
apps/web/src/app/features/account/balance/components/balance-detail/balance-detail.component.ts
apps/web/src/app/features/account/connected-accounts/components/payout-modal/payout-modal.component.html
apps/web/src/app/features/account/connected-accounts/components/payout-modal/payout-modal.component.scss
apps/web/src/app/features/account/connected-accounts/components/payout-modal/payout-modal.component.ts
apps/web/src/app/features/account/connected-accounts/services/connected-account-actions.service.ts
apps/web/src/app/features/account/payment-intents/views/payment-intent-detail/payment-intent-detail.component.ts
apps/web/src/app/utils/validation/ethereum.ts
libs/shared-types/src/lib/Config.ts
libs/shared-types/src/lib/Payout.ts
sdks/node/README.md
sdks/node/src/HttpClient.ts
sdks/node/src/__tests__/Payouts.spec.ts
sdks/node/src/index.ts
sdks/node/src/resources/Payouts.ts
```

### Task 9 fix round 1: broadcast timeouts and recovery coverage

- **SDK broadcast timeouts.**
  - Requests take a per-request `timeout` (`RequestExtraOptions.timeout`). `HttpClient.GetTimeout()` exposes the client default.
  - `payouts.broadcast()` waits at least 90 s for a signed transaction and 150 s for a transaction hash, or the client `timeout` if that is longer. An explicit `options.timeout` overrides both.
  - The API can wait 60 s for confirmations, plus 60 s for a hash to appear. The SDK's 30 s default used to abort first, with a raw `TimeoutError` instead of a `pending` result.
  - A broadcast that still gets no answer throws `ZonelessPayoutBatchError` with `code: 'broadcast_timeout'` (`statusCode: 0`), telling the caller to `reconcile()` and not sign again. Nothing is retried.
  - The client-level `timeout` is documented in the README and the `ZonelessConfig` JSDoc.
- **SDK `processAll`.** When a later batch throws, the error carries `results` (`ProcessAllError`): the batches processed before it.
- **Wallet.** viem's own chain check (`ChainMismatchError`, raised before the request) now surfaces as `WalletNotReadyError`, because nothing was sent. `SignedTransactionHash()` hashes a signed transaction locally.
- **Dashboard.** The private-key path shows the signed transaction's `keccak256` hash before the broadcast, so the operator can look it up on the explorer if the broadcast fails.
- **Specs.** New specs cover the recovery branches:
  - reconcile after a pending broadcast: released → details, failed, not settled;
  - a pending approval still holding the wallet;
  - the closed signing window;
  - `WalletNotReadyError` keeping the review step;
  - the local hash.
- **Docs.** The build snippet signs the approval in its branch and the payout after the rebuild.
- **This changelog.** Task 9's notes no longer cite internal addendum labels, and they now describe the wallet-error notice and the return to details correctly.

Modified in fix round 1:

```
CHANGES.md
apps/docs/src/app/pages/docs/data/payouts.ts
apps/web/src/app/core/services/wallet-viem.ts
apps/web/src/app/core/services/wallet.service.spec.ts
apps/web/src/app/core/services/wallet.service.ts
apps/web/src/app/features/account/connected-accounts/services/connected-account-actions.service.spec.ts
apps/web/src/app/features/account/connected-accounts/services/connected-account-actions.service.ts
sdks/node/README.md
sdks/node/src/HttpClient.ts
sdks/node/src/__tests__/HttpClient.spec.ts
sdks/node/src/__tests__/Payouts.spec.ts
sdks/node/src/index.ts
sdks/node/src/resources/Payouts.ts
```

## Task 10: Top-ups from USDC `Transfer` logs

The platform balance is credited when USDC arrives at the platform wallet on Ethereum. The money rule is that each USDC `Transfer` log credits exactly once. The dedupe key is the log's transaction hash **and** log index, so a transaction that pays the wallet twice creates two top-ups.

- **Scanning** (`TopUpMonitor`):
  - The poller (`TOPUP_MONITOR_ENABLED`, still off by default) and `POST /v1/topups/check-deposits` run the same scan.
  - Each scan reads the chain head once. It then walks the blocks after the wallet's cursor up to `latest - ETH_CONFIRMATIONS`, in chunks of at most 2,000 blocks and at most 10 chunks per call. No chunk ever ends past that one confirmed block.
  - A wallet's first scan starts at `latest - 1000`. A wallet further behind catches up over later calls, and the `check-deposits` message says which blocks remain.
  - The cursor moves past a chunk only after every deposit in it is credited, or was already credited. A deposit that fails to credit leaves the cursor before its chunk, so the next scan retries it.
  - A head or log-range error throws without moving the cursor past the failed range.
  - Transfers worth less than one cent are skipped. Amounts are truncated to whole cents.
  - The simulated rail scans nothing.
- **Cursor:** the new internal `ChainCursors` collection (`ChainCursorStore`, no public endpoint) holds `{ id: wallet id, chain_id, last_scanned_block, updated }`.
  - A cursor recorded on another chain is ignored, so switching chains starts a fresh first scan.
  - Reads go through `Database.Query`, which throws on a failed read. `Database.Get` would return null instead, and a first scan run from that null would jump the cursor past unscanned blocks.
- **Dedupe:**
  - `TopUp.metadata` gains `log_index` (a string).
  - `IsDepositProcessed(transactionHash, logIndex)` and `GetProcessedDepositKeys(transactionHashes)` replace the signature-only checks.
  - A unique partial index on `TopUps {metadata.blockchain_tx, metadata.log_index}` backs the code check. It is global, like the code check. A credit that races another scan hits a duplicate key (11000), which counts as "already processed".
  - `IsSignatureProcessed`, `GetProcessedSignatures` and the unused `GetTopUpBySignature` are removed.
  - The API now refuses `metadata.blockchain_tx` and `metadata.log_index` on `POST /v1/topups` and `POST /v1/topups/:id` (400 `invalid_request_error`). Erasing the key would let a log credit twice, and claiming one would block a real deposit.
- **Ethereum rail:**
  - `GetLatestBlockNumber()`, and a cached `GetBlockTimestamp(blockNumber)` that holds 256 entries.
  - `GetIncomingDeposits(address, { fromBlock, toBlock })` runs `getLogs` for USDC `Transfer(to = wallet)` with `strict: true`. It drops logs from another contract or recipient and removed logs, lowercases transaction hashes, returns senders in EIP-55 form and computes `amountCents = value / 10_000n`.
  - `GetConfirmedBlock` reuses `GetLatestBlockNumber`.
  - The `Settlement` interface takes the new signature. The simulated rail returns `0n` and `[]`.
- **Simulated deposits** come from `SIMULATED_TEST_WALLET` instead of the old placeholder sender.
- **Routes:** `check-deposits` no longer passes a `limit`, and the request body is ignored. `Balance.ts` already reported `wallet_native` from `GetNativeBalance`, so it is unchanged.
- **Dashboard:** the add-funds panel adds a confirmations note ("a couple of block confirmations, usually within a few minutes"), and the waiting copy names Ethereum.
- **Docs:**
  - `top-ups.ts`: Ethereum samples with `log_index` and `explorer_url`, the reserved metadata keys, and how `check-deposits` scans (confirmations, cursor, 20,000 blocks per call, one top-up per log).
  - `balance.ts`: payouts go to Ethereum wallets.
  - `fund-platform-wallet.ts` is rewritten: buy USDC, withdraw on the Ethereum network (not Base, Polygon, Arbitrum or Optimism), keep ETH for gas, and confirmations take minutes, with a Sepolia faucet note for test mode. The two exchange screenshots that showed the old network selected (`top-up-2.webp`, `top-up-3.webp`) are no longer referenced. The files stay in place.
- **Tests:**
  - `TopUp.spec.ts` (two logs of one transaction → two top-ups; duplicate key credits once; reserved keys; index declaration).
  - `TopUpMonitor.spec.ts` (first-scan window, `latest - confirmations`, 2,000-block chunks, 10-chunk cap, one head read, re-scan dedupe, duplicate-key race, failures never skip a deposit).
  - `ChainCursorStore.spec.ts`.
  - Ethereum mocked-RPC deposit specs.
  - The Anvil spec `TopUps.anvil.spec.ts`: a buyer's `PayoutBatch.disperse` pays the platform twice in one transaction, `GetIncomingDeposits` returns two logs with distinct `logIndex`, both are credited, the cursor is persisted, and the next scan finds nothing.
  - `MemoryDatabase` gains opt-in unique indexes.

Added:

```
apps/api/src/__tests__/ChainCursorStore.spec.ts
apps/api/src/__tests__/TopUp.spec.ts
apps/api/src/__tests__/TopUpMonitor.spec.ts
apps/api/src/__tests__/anvil/TopUps.anvil.spec.ts
apps/api/src/modules/ChainCursorStore.ts
```

Modified:

```
CHANGES.md
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/mocks/MemoryDatabase.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/modules/Database.ts
apps/api/src/modules/TopUp.ts
apps/api/src/modules/TopUpMonitor.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/routes/topups.routes.ts
apps/docs/src/app/pages/docs/data/balance.ts
apps/docs/src/app/pages/docs/data/fund-platform-wallet.ts
apps/docs/src/app/pages/docs/data/top-ups.ts
apps/web/src/app/features/account/balance/components/add-funds-panel/add-funds-panel.component.html
libs/shared-types/src/lib/TopUp.ts
```

## Task 11: Checkout payments via relayed EIP-3009 authorizations

Hosted checkout now settles on Ethereum. The buyer signs one EIP-712 `TransferWithAuthorization` and needs no ETH. The API relays it from `CHECKOUT_RELAYER_KEY` and pays the gas. The money rule is that a session completes only on a transfer its own authorization made: USDC must emit `AuthorizationUsed(payer, keccak256(session.id))` immediately followed by the `Transfer(payer → merchant wallet, value ≥ amount due)` of the same call. A plain transfer of the right amount, an authorization with another nonce, or the session's authorization paying another address is rejected.

- **Pure helpers** (`chains/CheckoutAuthorization.ts`):
  - `SessionNonce(id) = keccak256(utf8(id))`.
  - `BuildTransferAuthorization` builds `to = merchant`, `value = amount_total × 10_000`, `validAfter = 0`, `validBefore = expires_at`.
  - `BuildTransferAuthorizationTypedData` returns JSON-safe typed data. `types` includes `EIP712Domain`, so `eth_signTypedData_v4` hashes the same domain as viem. `value` is a decimal string.
  - `SplitSignature` takes 65-byte signatures with a recovery byte of 27/28 or 0/1, and answers anything else with a 400.
  - `VerifyCheckoutReceipt` pairs each `AuthorizationUsed` log with the `Transfer` log right after it, from the USDC contract only.
- **Ethereum rail:**
  - `GetUsdcDomain()` reads `name()` once; the version is `"2"`.
  - `BuildCheckoutPaymentAuthorization` returns the typed data, the authorization and an informational relay fee: 100,000 gas × (2 × base fee + priority fee).
  - `RelayCheckoutAuthorization`:
    - It never relays an authorization that `authorizationState` already shows as used; it returns the recorded hash, or null, without sending.
    - It reuses a recorded relay the node still knows.
    - It simulates the call (`estimateGas`) before signing, so an invalid, expired, blacklisted or unfunded authorization is a 400 and nothing is sent.
    - The relay transaction is signed locally, and `onSigned(hash)` runs before `sendRawTransaction`.
    - "already known", or a hash the node knows after an error, counts as sent. "nonce too low" or "replacement transaction underpriced" re-signs at the next pending nonce (3 attempts). Any other error is a 400 `blockchain_error`.
    - Relayer nonces: sends for one relayer are serialised in-process (`utils/KeyedLock.ts`) and read the `pending` nonce. A nonce taken by another process is re-signed.
  - `VerifyCheckoutPayment(hash | null, expected, { timeoutMs })`:
    - It polls until the receipt is `ETH_CONFIRMATIONS` below the head, then reads everything at the confirmed block.
    - When the transaction does not pay, it checks `authorizationState` at that block. If the authorization was used, the transaction found by its `AuthorizationUsed` log decides. The search runs newest blocks first, in 2,000-block chunks back to just before the session's creation, at most 50 chunks. This covers a front-run, or a reverted second relay.
    - A timeout or RPC error returns `pending`, never `failed`.
    - The rail uses its own polling loop, not viem's `waitForTransactionReceipt`. viem's block poller leaves an uncancellable 4 s timer behind.
  - On-chain checkout without `CHECKOUT_RELAYER_KEY` is a 501 `not_supported` at prepare and at relay.
- **Simulated rail:** `method: 'simulated'` with nothing to sign. Relay and verify accept the `sim_sig:` references.
- **Settlement interface:** `BuildCheckoutPaymentAuthorization`, `RelayCheckoutAuthorization` and the new `VerifyCheckoutPayment` signature replace `BuildCheckoutPaymentTransaction` and `ValidateAndBroadcastCheckoutTransaction`. `CheckoutPaymentVerification` now has `status` (`verified` / `failed` / `pending`) and `transaction_hash`.
- **Checkout flow** (`CheckoutPayment.ts`):
  - **Prepare:**
    - It returns `method`, `typed_data`, `authorization`, `estimated_fee`, `fee_currency`, `chain_id` and `relayed: true` on-chain (`false` simulated and for subscriptions).
    - It stores `payment_details.relayed`.
    - While a relay is recorded, it returns the same authorization to sign again, leaves the PaymentIntent alone, and refuses another wallet with a 409 `payment_pending`.
  - **Confirm** (`{ signature }` or `{ transaction_hash }`):
    - The API rebuilds the authorization from the session and the payer recorded at prepare.
    - Before the relay is sent, the API records its hash (`SetPaymentTransactionHash`, a compare-and-set, so two confirms cannot both relay) and marks the PaymentIntent `processing`.
    - It waits up to `CHECKOUT_CONFIRM_TIMEOUT_MS` (new `GetCheckoutConfirmTimeoutMs()`, 1,000–300,000 ms, default 90,000, checked at boot).
    - While the payment confirms, the response is a 409 `payment_pending` whose body carries `code: 'payment_pending'` and `transaction_hash`. A retry with that hash verifies without relaying again.
    - A send the network refused clears the recorded hash and returns the PaymentIntent to `requires_payment_method` (`payment_intent.payment_failed`).
    - A failure before anything was signed leaves both untouched.
    - A final verification failure creates the failed Charge and clears the recorded hash, so a new signature can be relayed.
    - A recorded payment may finish confirming after `expires_at`, because USDC already refused it after that time. No new relay starts after expiry.
  - **Replay protection:** a transaction that paid another session is rejected before and after verification, and nothing is completed.
  - **Typed errors:** typed `AppError`s (for example 501 `not_supported`) propagate unwrapped, including from the first-period subscription collect.
  - **Concurrency:** confirms of one session run one at a time in-process. `CompleteCheckoutSession` is now conditional on `status: open`, so concurrent confirms complete and credit the ledger once.
- **Schemas and types:**
  - The new `ConfirmCheckoutPaymentSchema` (`signature`: `0x` + 130 hex; `transaction_hash`: `0x` + 64 hex; both also accept the simulated `sim_sig:` references; never both) is validated on `POST /v1/payment_pages/:urlSlug/confirm`.
  - Hashes are lowercased.
  - `CheckoutPaymentTransaction`, `CheckoutTransferAuthorization` and `Eip712TypedData` are now in `@zoneless/shared-types`. The web service switches to them in Task 12.
  - `payment_details.relayed` is added.
- **Errors:** `AppError` takes optional `details`, which `ErrorHandler` merges into the error body. Details cannot replace `message` or `type`.
- **`Charge.ts`:** it already read `network` from `Describe()` (since Task 6), so it is unchanged.
- **Docs:** the Checkout Session, PaymentIntent, Payment Link and Charge pages describe the flow: sign an authorization, no ETH needed, the API pays the gas, and `processing` lasts until the payment confirms. `payment_details.relayed` is documented. The Charge samples use an Ethereum network, address and hash. These four pages no longer mention Solana.
- **Tests:**
  - `CheckoutAuthorization.spec.ts`: the nonce, the typed data and its JSON round trip, signature splitting, and receipt verification including both Review Focus 3 cases.
  - `CheckoutPayment.spec.ts`, against `MemoryDatabase`:
    - The hash is recorded and the PaymentIntent is processing at send time and while waiting.
    - `payment_pending` on a timeout.
    - A retry by hash does not relay again.
    - Replay rejection (A1), before and after verification.
    - A3: untouched state on a pre-send failure, and 501 propagated unwrapped from the relay and from the collect.
    - A refused send is reverted.
    - A different hash is refused.
    - A failed verification clears the relay.
    - A front-run hash completes the session.
    - Expiry handling.
    - Overlapping confirms pay once.
    - A cross-process claim conflict.
    - Re-prepare during a relay.
    - The simulated rail end to end.
  - Ethereum mocked-RPC specs:
    - The hash is recorded before the send.
    - A used authorization is not relayed; a known relay is reused.
    - A simulated revert is a 400.
    - "already known", nonce re-sign, refused send.
    - Concurrent relays get distinct nonces.
    - Confirmed-depth waiting, pending on a timeout or RPC error.
    - The log search finds a front-run and searches newest first.
  - `CheckoutSessionSchema.spec.ts` (shared-schemas), `ErrorHandler.spec.ts`, `KeyedLock.spec.ts`, the AppConfig timeout specs, and the `CompleteCheckoutSession` / `SetPaymentTransactionHash` specs.
  - `MemoryDatabase` gains `FindCustom`.
  - The Anvil spec `Checkout.anvil.spec.ts`, on a real chain:
    - The buyer signs the API's typed data with viem, the relayer relays it, and verification returns the buyer as payer.
    - A second relay of the same authorization is not sent by the rail. Submitted directly, it reverts on the used nonce, and verifying it resolves to the first.
    - A tampered `to` fails verification.
    - A signature over another recipient is refused before sending.
    - A front-run is found by its log.
    - The module end to end: `payment_pending`, a mined block, then a retry by hash completes and credits the ledger.

Added:

```
apps/api/src/__tests__/CheckoutAuthorization.spec.ts
apps/api/src/__tests__/ErrorHandler.spec.ts
apps/api/src/__tests__/KeyedLock.spec.ts
apps/api/src/__tests__/anvil/Checkout.anvil.spec.ts
apps/api/src/modules/chains/CheckoutAuthorization.ts
apps/api/src/utils/KeyedLock.ts
libs/shared-schemas/src/lib/CheckoutSessionSchema.spec.ts
```

Modified:

```
CHANGES.md
apps/api/src/__tests__/AppConfig.spec.ts
apps/api/src/__tests__/CheckoutPayment.spec.ts
apps/api/src/__tests__/CheckoutSession.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/mocks/MemoryDatabase.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/middleware/ErrorHandler.ts
apps/api/src/modules/AppConfig.ts
apps/api/src/modules/CheckoutPayment.ts
apps/api/src/modules/CheckoutSession.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/modules/chains/types.ts
apps/api/src/routes/paymentPages.routes.ts
apps/api/src/utils/AppError.ts
apps/docs/src/app/pages/docs/data/charges.ts
apps/docs/src/app/pages/docs/data/checkout-sessions.ts
apps/docs/src/app/pages/docs/data/payment-intents.ts
apps/docs/src/app/pages/docs/data/payment-links.ts
libs/shared-schemas/src/lib/CheckoutSessionSchema.ts
libs/shared-types/src/lib/CheckoutSession.ts
```

### Task 11 fix round 1: one record per payment, no provider text, recoverable retries

- **No provider text in client errors** (SEC-1):
  - Node and RPC failures on the checkout relay are a 502 "The payment network is unavailable; try again".
  - A refused relay is a 400 "The network did not accept the payment".
  - A revert that does not decode is "The USDC authorization cannot be relayed". A decoded contract reason, such as `FiatTokenV2: …` or an ABI error name, is still shown.
  - The payout broadcast, payout gas estimate and payout receipt failure message follow the same rule.
  - The node's text goes to the server log only. `DecodeRevert` keeps it in an internal `detail`, which also feeds the `account_frozen` mapping.
  - A refused relay stores the fixed message in `last_payment_error`.
- **One record per verified payment:**
  - Every confirm that verified the payment (one per API process) races for one claim on the session (`ClaimPaymentSettlement`: `payment_details.settling_since` and `settling_transaction`) before any side effect.
  - Only the winner creates the Charge, emits `charge.succeeded` and `payment_intent.succeeded`, completes the session and credits the ledger.
  - The others wait, polling up to 10 s, and return the same completed session, or a 409 `payment_pending` while the winner is still working.
  - A claim older than 60 s, left by a confirm that crashed, is taken over, and that confirm's succeeded Charge is reused. A winner that fails releases the claim.
- **Prepare cannot clobber a relay:**
  - The prepare write (`RecordPreparedPayment`) only applies while no payment transaction is recorded. The first prepare writes `payment_details` whole; later ones set only `payer_wallet`, `relayed` and `merchant_wallet`.
  - A prepare that loses this condition answers the in-flight 409.
- **No second payment from another wallet:**
  - Before relaying, the rail searches `AuthorizationUsed` logs by the indexed session nonce only (any authorizer), from just before the session's creation up to `latest`.
  - A transaction found there that pays the recorded merchant ≥ the amount due is returned, and nothing is sent. Uses of the nonce that paid someone else are ignored, so a third party cannot block the session.
  - The module records a payment found this way as the session's transaction.
- **Retries:**
  - `VerifyCheckoutPayment` answers `not_found` at once when the node does not know the hash and the authorization is unused at `latest`. It no longer long-polls.
  - On a `{ transaction_hash }` retry, a recorded relay then gets a 409 `payment_resubmit_required` (send the signature again), and a hash no relay recorded gets a 400 without failing the PaymentIntent or creating a Charge.
  - A foreign hash that fails verification is also a plain 400.
  - The route documents that a 409 may carry `transaction_hash: null` and that retrying with `{ signature }` is always safe.
- **Verification catch-all:** only viem errors (node or transport) become `pending`. Anything else is logged at error level and rethrown as a 500.
- **Merchant wallet:**
  - The authorization's `to` is recorded at prepare as `payment_details.merchant_wallet` (documented on the Checkout Session page).
  - Confirm rebuilds and verifies against it. Sessions prepared before this field existed use the current default wallet.
- **Shared helpers:** `TRANSACTION_HASH_PATTERN`, `IsTransactionHash` and `SameAddress` live in `@zoneless/shared-types` (`ChainValues.ts`). The rail, the checkout module, the confirm and payout schemas and the test double all use them.
- **Accuracy:**
  - `estimated_fee` is documented as an upper bound, and `PreparedAuthorization.fee_currency` is `'eth' | 'none'`.
  - The `CHECKOUT_CONFIRM_TIMEOUT_MS` ceiling comment now names the reverse proxy as the practical limit.
  - `.env.example`, `.env.production.example` and the environment-variables docs say a proxy must allow the wait plus a margin.
- **Comment only:** a refused relay creates no failed Charge (nothing reached the chain), unlike a failed verification.
- **Tests:**
  - Module:
    - Provider text is never stored on the PaymentIntent.
    - Two processes verifying one payment record one Charge and one of each event, and both succeed.
    - A crashed claim is taken over with its Charge reused.
    - A held claim answers `payment_pending` (fake timers).
    - The claim loop stops when the session closes.
    - Prepare is refused once a relay is recorded mid-prepare.
    - A found payment is recorded and completes.
    - Verification uses the recorded merchant wallet.
    - `payment_resubmit_required`, the fail-fast 400s, and no side effects for a foreign hash.
  - Rail:
    - The any-wallet search sends nothing for a paying use and still relays past a non-paying one.
    - A used authorization returns its payment.
    - "replacement transaction underpriced" re-signs; the 3-attempt cap; an unknown-to-node pending hash is reused on an RPC error.
    - Provider text is kept out of every client error (node read, gas estimate, undecodable revert, refused send, payout broadcast, payout receipt).
    - `not_found`, the search when the node does not know the hash, and the rethrow of non-node errors.
  - `VerifyCheckoutReceipt` fails closed on removed logs and on a Transfer before its `AuthorizationUsed`.
  - `CheckoutSession` filter shapes for the new compare-and-sets.
  - Anvil: wallet A's payment lands while the API recorded it as refused; wallet B (no USDC) then confirms, nothing is sent, and the session completes on A's payment.

Added:

```
libs/shared-types/src/lib/ChainValues.ts
```

Modified:

```
.env.example
.env.production.example
CHANGES.md
apps/api/src/__tests__/CheckoutAuthorization.spec.ts
apps/api/src/__tests__/CheckoutPayment.spec.ts
apps/api/src/__tests__/CheckoutSession.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/anvil/Checkout.anvil.spec.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/modules/AppConfig.ts
apps/api/src/modules/CheckoutPayment.ts
apps/api/src/modules/CheckoutSession.ts
apps/api/src/modules/chains/CheckoutAuthorization.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
apps/api/src/modules/chains/types.ts
apps/api/src/routes/paymentPages.routes.ts
apps/docs/src/app/pages/docs/data/checkout-sessions.ts
apps/docs/src/app/pages/docs/data/environment-variables.ts
libs/shared-schemas/src/lib/CheckoutSessionSchema.ts
libs/shared-schemas/src/lib/PayoutSchema.ts
libs/shared-types/src/lib/CheckoutSession.ts
libs/shared-types/src/lib/index.ts
```

## Task 12: Hosted checkout signs with browser wallets

Hosted checkout now pays on Ethereum from the customer's browser wallet. The customer connects, the wallet switches to the platform's chain, and the customer signs the prepared EIP-3009 authorization with `eth_signTypedData_v4`. The API relays it and pays the gas (Task 11). The simulated rail still uses the test wallet dialog and `sim_sig:` references.

- **Pay flow** (`checkout.component.ts`):
  - `Connect` (or the already connected account), then `EnsureChain(chain_id from /v1/config)`, then prepare.
  - The prepared payment must be an `eip3009_transfer` whose typed data is for that chain. Then `SignTypedData(prepared.typed_data)` and confirm `{ signature }`.
  - `already_subscribed` still confirms without signing. Other subscription sessions say "This checkout cannot be paid from a wallet on this network yet." until Task 15.
- **Confirm retries** (addendum A3):
  - A `payment_pending` 409, a `payment_resubmit_required` 409, a network error, a request timeout or a gateway 504 sends confirm again with the same `{ signature }`, every 4 s for up to 5 minutes. The signature stays in memory until the payment completes or fails.
  - A 409 may carry `transaction_hash: null`. A hash, once reported, is shown with an explorer link (`ConfigService.GetExplorerUrl`), or as text on a chain without an explorer.
  - After 5 minutes the page says "Your payment is still confirming. Keep this page open, then check again." The signature and hash are kept, and the button reads "Check payment status". Pressing it confirms with the held signature, without preparing or signing again.
  - Other errors are shown as is (400s carry generic messages) and drop the held signature. That includes 5xx answers other than a 504.
  - A wallet rejection (4001) reads "The request was rejected in your wallet." Other viem errors show their `shortMessage`.
  - Polling stops when the component is destroyed.
- **Another payment is confirming** (a prepare answered by `payment_pending`). The API answers prepare this way for any wallet other than the recorded payer. The same wallet in another tab is not refused: it prepares and signs again.
  - The page shows "A payment for this checkout is already being confirmed" and follows that payment with confirm `{ transaction_hash }`, using the hash from the 409.
  - A completed session ends the wait. A defensive branch, for an open session with no recorded hash, ends it with "The other payment for this checkout did not go through. You can pay now."
  - `payment_resubmit_required` there (no signature is held) stops with "The payment was not sent to the network. Press Pay to sign it again." Pay then prepares and signs.
- **Confirm request** (`checkout-session.service.ts`):
  - `ConfirmPayment(urlSlug, { signature } | { transaction_hash } | { already_subscribed, subscription_onchain_id })` uses a 120 s request timeout. The API waits up to `CHECKOUT_CONFIRM_TIMEOUT_MS` (90 s by default) before answering.
  - `CheckoutPaymentTransaction` comes from `@zoneless/shared-types`; the web-local copy is deleted.
  - `ReadConfirmRetry(error)` says whether and why a confirm can be retried.
- **API errors** (`api.service.ts`): `ApiError.details` holds every field of the error body, so checkout can read `transaction_hash` from a 409.
- **Wallet discovery** (addendum A1, `wallet.service.ts`):
  - `discoveryComplete` turns true when an EIP-6963 wallet announces itself, or after the 300 ms `window.ethereum` window. Until then checkout keeps its page loader up and shows neither the mobile wallet handoff nor the wallet guide.
  - A late EIP-6963 announcement replaces the `window.ethereum` fallback while no account is connected. The first announced wallet still wins over later ones.
  - Announcements are validated: the provider needs `request()`, `uuid` and `name` must be non-empty strings, and `icon` and `rdns` must be strings. An icon that is not a `data:image/` URI is dropped.
  - `EnsureChain` already re-checks the chain after adding Sepolia and detects MetaMask Mobile's wrapped 4902 (Task 9), so it is unchanged.
- **Mobile deep links** (`mobile-wallet.ts`, sources in the file header):
  - MetaMask moves to `https://link.metamask.io/dapp/{URL without scheme}`, the format MetaMask's docs give now. The `metamask.app.link` host in the plan no longer appears in them.
  - Coinbase Wallet stays `https://go.cb-w.com/dapp?cb_url={percent-encoded URL}`. Its doc page now redirects to the Coinbase Wallet overview, so the format was confirmed from the indexed copy of that page.
- **Copy:**
  - The method label stays "Paying with USDC on Ethereum". The help text says to "sign once" and that no ETH is needed for gas.
  - The wallet guide's checkout step is "Add USDC, then pay".
  - The two-step subscription copy ("First-time wallets approve twice") was already removed in Task 6.
  - The payment link quickstart describes the Ethereum wallet flow.
- **Tests:**
  - Checkout component, with the real `WalletService` and a fake EIP-1193 wallet announced over EIP-6963:
    - The pay button sends `eth_signTypedData_v4` with the prepared typed data and confirms with `{ signature }`. The wallet switches chain before prepare.
    - Typed data for another chain is not signed. A wallet rejection and a 400 are shown without a retry.
    - Confirm retries: `payment_pending` with the same signature until success (explorer link shown), a null-hash 409, `payment_resubmit_required` re-sent automatically, a network error and a 504, and the 5-minute stop followed by a check with the held signature.
    - Another wallet's payment: followed by hash to completion, the hash read from the session when the 409 has none, and `payment_resubmit_required` with no held signature asking to sign again.
    - Simulated mode still opens the test wallet and confirms with a `sim_sig:` reference without touching the wallet. Wallet discovery is awaited before the handoff and setup screens.
  - Checkout session service, through the real `ApiService` with a stubbed `fetch`: the confirm body, the request not timing out before 120 s, and a 409's code and hash reaching `ReadConfirmRetry`.
  - Wallet discovery: EIP-6963 wins over `window.ethereum`, a late announcement replaces the fallback but not a connected one, `discoveryComplete` timing, and malformed announcements ignored.
  - Addendum A2: the C2 address rule (lowercase accepted; all-uppercase and a bad checksum rejected with the checksum message; `NormalizeEthereumAddress`) and the external wallet form's `GetFormData()` normalisation.
- **Simulated-rail smoke** (ruling R4): with Mongo from `docker compose up mongodb -d` and the API on `SETTLEMENT_RAIL=simulated`, a payment link opened over curl, then prepared and confirmed with the exact bodies the web sends, completes the session (`payment_status: paid`). A repeat confirm returns the same completed session.

Added:

```
apps/web/src/app/data/services/checkout-session.service.spec.ts
apps/web/src/app/shared/forms/external-wallet-form/external-wallet-form.component.spec.ts
apps/web/src/app/utils/validation/ethereum.spec.ts
```

Modified:

```
CHANGES.md
apps/docs/src/app/pages/docs/data/quickstart.ts
apps/web/src/app/core/services/api.service.ts
apps/web/src/app/core/services/wallet.service.spec.ts
apps/web/src/app/core/services/wallet.service.ts
apps/web/src/app/data/services/checkout-session.service.ts
apps/web/src/app/features/checkout/checkout.component.html
apps/web/src/app/features/checkout/checkout.component.scss
apps/web/src/app/features/checkout/checkout.component.spec.ts
apps/web/src/app/features/checkout/checkout.component.ts
apps/web/src/app/features/checkout/util/mobile-wallet.spec.ts
apps/web/src/app/features/checkout/util/mobile-wallet.ts
apps/web/src/app/shared/ui/wallet-guide/wallet-guide.component.html
```

### Task 12 fix round 1: retry gateway errors, no dead-end re-sign, resume on load

- **Gateway 502 and 503** are retried with the held signature, like a 504 or no answer, so a proxy reset during the long-poll no longer drops a payment that may already be relayed. The API's own 502 ("The payment network is unavailable; try again") is retried the same way. A 500 still drops the signature.
- **Who must sign again.** The page reads the public session's `payment_details.payer_wallet` when prepare answers `payment_pending`, and when a confirm by hash answers `payment_resubmit_required` with no signature held.
  - If it is the connected wallet, the page prepares, signs and confirms at once. This covers a prepare that raced the same wallet's relay in another tab.
  - Another wallet follows the payment by hash. The notice is "A payment for this checkout is already being confirmed. It was started from 0xABCD…1234, and only that wallet can finish it."
  - If the network then lost that payment, the page says which wallet must sign it again and that another wallet can't pay this checkout until it expires. Pay is turned off instead of looping.
  - With no wallet connected (after a reload), the page asks that wallet to press Pay and sign again.
- **Resume on load.** An open payment-mode session with a recorded `payment_details.transaction_hash` starts in the confirming state. It is confirmed by `{ transaction_hash }` and polled as for `payment_pending`, so a reload or a new tab finishes the payment without signing again. "Check payment status" after the 5-minute stop also confirms by the known hash.
- **Explorer links** are built only from `0x` + 64-hex hashes (`IsTransactionHash`). Anything else is shown as text.
- **Confirm timeout coupling.** `CHECKOUT_CONFIRM_TIMEOUT_MS` is capped at 110000 (was 300000), below the web's 120 s confirm request timeout. The env-var docs and both `.env` examples say so.
- **"Already being confirmed" at confirm time.** The two 409s for a concurrent confirm ("Another confirmation is recording…" and "…relaying…") carry `reason: 'another_confirmation'`. The page then shows "A payment for this checkout is already being confirmed".
- **Wallet discovery.** Once a `Connect()` has started, a late EIP-6963 announcement no longer replaces the `window.ethereum` fallback. It is held and used at `Disconnect()` or the next `Connect()`.
- **Before the wallet prompt**, the authorization must pay this checkout: `from` is the connected wallet, `to` is `merchant_wallet_address`, and `value` is `amount_total × 10 000`. A mismatch shows "This payment request is out of date. Reload the page and try again." and nothing is signed.
- **Structure.** The confirm and poll loop, the held signature, the confirming state, `StillConfirmingError`, `SignatureRequiredError` and the authorization check live in `features/checkout/util/checkout-payment.ts`, with their own spec. Defensive branches are commented as such.
- **Tests:**
  - Component:
    - 502 and 503 retry with the held signature, and a 500 drops it.
    - Polling stops on destroy.
    - A reported hash survives a later null-hash 409.
    - The confirm-time "already being confirmed" copy, and a malformed hash shown as text.
    - The stale-request guards.
    - The other-wallet flows, mirroring the real API: prepare always answers 409 for that wallet, follow to completion, and the lost payment that names the payer and turns Pay off.
    - The same-wallet race.
    - Resume on load, by hash, and its re-sign prompt.
  - Wallet:
    - A late announcement during a pending `Connect()` is not swapped in, and is used at the next `Connect()` and at `Disconnect()`.
    - Non-string `icon` and `rdns` are rejected.
  - API: the `reason` detail is present on the two concurrent-confirm 409s and absent on a plain `payment_pending`, and the 110000 ms bound.

Added in fix round 1:

```
apps/web/src/app/features/checkout/util/checkout-payment.spec.ts
apps/web/src/app/features/checkout/util/checkout-payment.ts
```

Modified in fix round 1:

```
.env.example
.env.production.example
CHANGES.md
apps/api/src/__tests__/AppConfig.spec.ts
apps/api/src/__tests__/CheckoutPayment.spec.ts
apps/api/src/modules/AppConfig.ts
apps/api/src/modules/CheckoutPayment.ts
apps/api/src/routes/paymentPages.routes.ts
apps/docs/src/app/pages/docs/data/environment-variables.ts
apps/web/src/app/core/services/wallet.service.spec.ts
apps/web/src/app/core/services/wallet.service.ts
apps/web/src/app/data/services/checkout-session.service.spec.ts
apps/web/src/app/data/services/checkout-session.service.ts
apps/web/src/app/features/checkout/checkout.component.html
apps/web/src/app/features/checkout/checkout.component.spec.ts
apps/web/src/app/features/checkout/checkout.component.ts
```

## Task 13: `Subscriptions` contract for allowance-based recurring pulls

`contracts/src/Subscriptions.sol` replaces the `@solana/subscriptions` program. It is a plan registry plus pulls from each subscriber's bounded USDC allowance, at most the plan amount once per billing period. The API does not use it yet; Task 14 wires plans, subscribes and charges to it. These notes describe the contract after fix round 1.

- **Plans:**
  - `createPlan(planId, token, amount, periodSeconds, destination, puller)` stores a plan under `planKey = keccak256(abi.encode(msg.sender, planId))`.
  - The period must be greater than 0 and at most 10 years (`MAX_PERIOD_SECONDS`), else `InvalidPeriod`. A zero amount is `InvalidAmount`.
  - A plan's token, amount and period never change, and a plan key cannot be registered twice (`PlanExists`).
  - The owner can call `setPlanDestination`, `setPlanPuller` and `deactivatePlan`. Deactivation is permanent and only blocks new subscribes; existing subscriptions keep billing.
  - Zero token, destination or puller addresses are refused (`ZeroAddress`).
  - Only standard ERC-20 tokens are supported, not fee-on-transfer ones.
- **Subscribing:**
  - `subscribe(planKey)`: the caller subscribes itself, pays the gas and uses up its own nonce.
  - `subscribeWithAuthorization(planKey, subscriber, terms, deadline, sig)` is relayed:
    - `sig` signs the EIP-712 type `Subscribe(bytes32 planKey,address subscriber,address token,uint256 amount,uint64 periodSeconds,uint256 nonce,uint256 deadline)`, so the wallet shows the terms.
    - The domain is name `Subscriptions`, version `1`.
    - `terms` is the struct `(token, amount, periodSeconds)` and must equal the plan's (`TermsMismatch`).
    - The nonce is `nonces(subscriber)` and is used up by the call, and the deadline is inclusive.
    - Signatures go through OpenZeppelin `SignatureChecker`: ECDSA for externally owned accounts, EIP-1271 for contract wallets.
  - `subscribeWithPermit(…)` applies the subscriber's EIP-2612 `permit` on the plan's token, then subscribes the same way. If that permit fails but the allowance it grants is already in place (someone submitted it first), the subscribe goes on; otherwise the token's revert reason is re-thrown.
  - `subId = keccak256(abi.encode(planKey, subscriber))`.
  - The first period is due at subscribe time. An `Active` or `Paused` subscription cannot subscribe again (`AlreadySubscribed`). A `Canceled` one can, which starts a fresh schedule.
- **Charging:**
  - Only the plan's puller may call `charge(subId, amount)`.
  - Checks run in this order:
    1. `Unauthorized`;
    2. `NotActive`;
    3. `InvalidAmount` / `AmountExceedsPlan` (`0 < amount <= plan.amount`);
    4. `NotDueYet` (`block.timestamp >= nextChargeAt`).
  - Only `NotDueYet` means the current period was already collected.
  - Billing periods follow a fixed grid from the subscribe time. A charge moves `nextChargeAt` to the first grid point after it, then calls `safeTransferFrom(subscriber, destination, amount)`. A period the puller missed is skipped, never collected later.
- **Pause, resume, cancel:**
  - The subscriber or the plan owner can pause and cancel. `pause` needs `Active` and records who paused (`PausedBy`).
  - `resume` needs `Paused` (`NotPaused`). It is open to the owner for any pause, but to the subscriber only for their own (`Unauthorized`).
  - Neither pause nor resume moves `nextChargeAt`. An unpaid current period is due at once on resume, and periods that passed entirely while paused are skipped.
  - `cancel` needs `Active` or `Paused`, clears `PausedBy` and uses up the subscriber's nonce, so no `Subscribe` signature handed out earlier can bring the subscription back.
- **Events and errors:**
  - Events: `PlanCreated`, `Subscribed`, `Charged`, `Canceled`, `Paused` and `Resumed` as in plan §4.6, plus `PlanDestinationSet`, `PlanPullerSet` and `PlanDeactivated`, so destination and puller changes can be monitored.
  - Errors: those of §4.6 plus `PlanExists`, `NotPaused`, `ZeroAddress` and `TermsMismatch`.
- **Governance:** no owner, no pause switch, non-upgradeable, never holds tokens or ETH. It is built on OpenZeppelin `EIP712`, `Nonces`, `SignatureChecker`, `SafeERC20` and `IERC20Permit` (used directly, so there is no local interface file).
- **README:** `contracts/README.md` documents:

  - the ids, the signing domain and type, and the check order;
  - the billing grid and the pause rules;
  - the expected bounded allowance (`amount × max(12, ceil(365 days / period))`) and its exposure limit;
  - how revoking the allowance stops pulls;
  - what a USDC blacklisting does.

  An external audit is required before any mainnet deployment.

- `script/DeploySubscriptions.s.sol` deploys it with the signer given on the command line, like `DeployPayoutBatch.s.sol`.
- `SUBSCRIPTIONS_ABI` (`apps/api/src/modules/chains/abi/Subscriptions.ts`) is the contract ABI. A harness test fails if it drifts from the forge artifact.
- **Anvil harness:** `StartAnvil()` now also deploys `Subscriptions` with account #0. It sets `SUBSCRIPTIONS_ADDRESS`, and `AnvilContext.addresses.subscriptions` is always an address. `Harness.anvil.spec.ts` checks the deployment, its EIP-712 domain and `SUBSCRIBE_TYPEHASH`, the ABI sync and the chain config's `subscriptions` address.
- **Tests:** `contracts/test/Subscriptions.t.sol` has 71 unit and fuzz tests and 4 invariants. They cover:
  - plan creation, key derivation, validation and owner-only changes;
  - subscribe and nonce retirement on subscribe and cancel;
  - the relayed authorization: deadline, wrong signer, malformed and high-s signatures, terms binding, plan and deadline binding, EIP-1271 wallets, and the allowance bound on a phished signature;
  - the permit path: relayed, front-run permit, bad permit, rollback on a bad `Subscribe` signature, mismatched terms, a zero-value permit;
  - the charge schedule: due at once, `NotDueYet`, grid steps for on-time and late charges, skipped periods, check order, amount limits, puller only, revoked allowance, blacklisted subscriber and destination;
  - cancel, and pause/resume with `PausedBy`;
  - `testFuzzChargeSchedule(uint64 period, uint8 cycles)`;
  - a handler-based invariant suite. Its handler covers charges, pauses and resumes by either party, cancels, all three subscribe paths, destination rotation and time jumps. The invariants:
    - charges stay within the billing periods that elapsed while active;
    - every call matches an independent model of the subscription;
    - the destinations receive exactly what was charged;
    - only the puller charges.

Added:

```
apps/api/src/modules/chains/abi/Subscriptions.ts
contracts/script/DeploySubscriptions.s.sol
contracts/src/Subscriptions.sol
contracts/test/Subscriptions.t.sol
```

Modified:

```
CHANGES.md
apps/api/src/__tests__/anvil/Anvil.ts
apps/api/src/__tests__/anvil/Harness.anvil.spec.ts
contracts/README.md
```

### Task 13 fix round 1: signing, schedule and pause rules

Review and planner rulings (Q8, Q9) applied to `Subscriptions.sol`:

- **Nonces.** `subscribe()` uses up the caller's nonce and `cancel` the subscriber's. A cancelled subscription can no longer be brought back by an unused `Subscribe` signature, whether it was handed out before a direct subscribe or published by a reverted relay.
- **Charge schedule.** A late charge moves `nextChargeAt` to the first point after now on the original grid (`dueAt + ((now - dueAt) / period + 1) * period`), not one period on. A puller can collect at most one charge per billing period, so `NotDueYet` reliably means "this period was already collected".
- **Resume.** It no longer moves `nextChargeAt` (it used to set `now + period`), so pausing and resuming cannot defer or skip a charge.
- **Terms in the signature.**
  - `SUBSCRIBE_TYPEHASH` is now over `Subscribe(bytes32 planKey,address subscriber,address token,uint256 amount,uint64 periodSeconds,uint256 nonce,uint256 deadline)`.
  - `subscribeWithAuthorization` and `subscribeWithPermit` take the terms as a `Terms` calldata struct, checked against the plan (`TermsMismatch`). Twelve separate `subscribeWithPermit` arguments exceed what legacy codegen can decode, and switching the whole project to `via_ir` was not wanted.
- **Pause ownership.** `Sub` gains `pausedBy` (`PausedBy { None, Subscriber, Owner }`), returned by `subscriptions(subId)`. Only the owner can lift an owner pause.
- **Contract wallets.** Signature checks use `SignatureChecker.isValidSignatureNow` (EIP-1271).
- **Docs.** README and NatSpec now cover:
  - the charge check order;
  - the pause rules;
  - the bounded-allowance expectation and the phishing exposure bound;
  - that fee-on-transfer tokens are unsupported;
  - a USDC blacklist runbook.
- **Tests.** The reviewer's proofs of concept are now regression tests, along with the planner's Q8/Q9 tests and EIP-1271 accept/reject cases. The invariant handler now models the whole subscription.

Added in fix round 1:

```
contracts/test/mocks/Mock1271Wallet.sol
```

Modified in fix round 1:

```
CHANGES.md
apps/api/src/__tests__/anvil/Harness.anvil.spec.ts
apps/api/src/modules/chains/abi/Subscriptions.ts
contracts/README.md
contracts/src/Subscriptions.sol
contracts/test/Subscriptions.t.sol
```

## Task 14: Subscriptions on the `Subscriptions` contract

The API now runs recurring prices, hosted subscription checkout and the billing runner on `Subscriptions.sol`. The simulated rail keeps every flow working without a chain.

- **Pure helpers** (`chains/SubscriptionAuthorization.ts`):
  - `PlanIdFromPriceId(priceId)` is `keccak256` of the UTF-8 price id.
  - `PlanKeyFor` and `SubscriptionIdFor` are `keccak256(abi.encode(...))`, as in the contract.
  - `BuildPermitTypedData` builds the USDC EIP-2612 `Permit`. `BuildSubscribeTypedData` builds the contract's `Subscribe` (domain `Subscriptions`/`1`, with the plan's token, amount and period).
  - `PermitValue` is `amount × max(12, ceil(365 days / periodSeconds))`. Permits are never unlimited.
  - `SubscribeDeadline` is `min(session.expires_at, now + 1800)`.
  - `FindSubscribedEvent` checks a receipt.
- **Plans:**
  - Creating a recurring price sends `createPlan` from `SUBSCRIPTION_OPERATOR_KEY`. That key owns the plan and is its puller; the platform wallet is its destination.
  - The period is the interval in hours × 3600 seconds.
  - `subscription_plan_id` stores the plan key.
  - A plan already on-chain with the same terms (a retry) is returned without sending; one with other terms is refused.
- **Checkout prepare (subscription mode):**
  - The response has `subscription: { plan_id, needs_permit, permit_typed_data, subscribe_typed_data, deadline, already_subscribed, subscription_onchain_id }`. `already_subscribed` and `subscription_onchain_id` are also kept at the top level for the current web checkout.
  - The Subscribe nonce is read just before the typed data is built.
  - `needs_permit` is true while the wallet's USDC allowance to the Subscriptions contract is below the permit value.
  - `relayed` is true on-chain. The old unsigned subscribe transaction (`BuildSubscribeTransaction`, `unsigned_transaction`, `nonce`, `to`) is gone.
- **Checkout confirm (subscription mode):**
  - Takes `{ subscribe_signature, permit_signature?, deadline }`, or on retry `{ transaction_hash }`.
  - The relay works like checkout payments. `CHECKOUT_RELAYER_KEY` sends `subscribeWithPermit` or `subscribeWithAuthorization` with the plan's terms read from the chain. The hash is recorded on the session (compare-and-set) before sending, and is cleared when the network refuses it or verification fails.
  - Sends share one in-process lock per sending address, so the relayer and the operator never race themselves even when they are the same key.
  - The call is simulated first.
    - A stale or expired signature is a 409 `subscription_authorization_stale`: prepare again and sign again. This covers a nonce used by another subscribe, or by any cancel of the subscriber.
    - A permit the token refuses is the same 409.
    - Another subscribe that landed first sends nothing.
    - With no permit, an allowance below the first payment is a 400.
  - A subscribe still confirming is a 409 `payment_pending` with its hash. An unknown recorded hash is a 409 `payment_resubmit_required`.
  - Verification passes on the receipt's `Subscribed` log, or on the subscription existing at the confirmed block. When another transaction created it, the session records `onchain:<subId>`.
  - Side effects (first-period collect, customer, Subscription) wait for the same single settlement claim as payments.
  - An on-chain subscription that another live Subscription already bills is refused (on-chain only).
  - `already_subscribed` now reads the subscription from the chain and refuses a client-sent id that is not the wallet's.
  - A first-period collect that fails without a typed error returns a fixed 400; provider text stays in the log.
  - A first period that an earlier, crashed attempt already collected is recorded as paid.
- **Collect** (`charge(subId, amount)` from the operator key):
  - `subscriptions(subId).status` is read first. `Paused` fails with `paused_on_chain`; `Canceled` or unknown is a billing failure.
  - A charge revert maps as follows:
    - `NotDueYet` gives `alreadyCollected: true` (nothing is sent);
    - `NotActive` gives `paused_on_chain`;
    - a transfer the token refuses gives a 402 `collection_failed_allowance` when the allowance is below the amount, else `insufficient_funds`;
    - anything else is an error with the decoded name only.
  - The charge waits up to 60 s for `ETH_CONFIRMATIONS`.
- **Invoices:**
  - The collect error is stored in `metadata.last_payment_error_code`:
    - `period_already_collected`: the error says to wait for the next billing period, and no retry is used up;
    - `paused_on_chain`: no retry is used up, and no `invoice.payment_failed` or failed PaymentIntent;
    - `collection_failed_allowance`: a normal failed attempt (the subscription goes `past_due`) plus a new `subscription.allowance_exhausted` event with the Subscription.
  - The `Invoice.ts` collect comment describes the anchored skip.
- **Billing runner:**
  - A subscription is charged at most once per run.
  - Invoices of cycles that ended before the run are created and voided, not collected, before the current cycle is charged. A run voids up to 12 per subscription; later runs void the rest first. `SubscriptionModule.NextCycleEnd` and `SkipMissedCycle` support this.
  - `paused_on_chain` sets `pause_collection` and the new `paused_on_chain` flag.
  - Each later run reads the chain status. Once the subscription is active again, the runner lifts its own pause and collects in the same run. A pause the merchant set is never lifted.
- **Cancel:** canceling a Subscription with a `subscription_onchain_id` (immediately or at period end) also sends `cancel(subId)` from the operator key. This is best effort and logged.
- **Docs:** cover the plan key and the operator key's gas (labelled estimates from the forge gas report), the bounded permit, revoking the allowance, the on-chain cancel, missed-cycle voiding, on-chain pauses, the new error codes and the new event.
- **Tests:**
  - Pure-helper spec, including the typed-data digest against the contract's typehash and domain.
  - Module specs for prepare, confirm, invoices, the billing runner, cancel, prices and the simulated rail.
  - Mocked-RPC specs for error mapping and provider text.
  - An Anvil suite: plan, then permit and subscribe relay, then verify, then charge, then `alreadyCollected`, then the next period after `evm_increaseTime`. It also covers a subscribe without a permit, a pause and resume, a cancel that makes a signature stale, and an exhausted allowance.

Added:

```
apps/api/src/__tests__/SubscriptionAuthorization.spec.ts
apps/api/src/__tests__/anvil/Subscriptions.anvil.spec.ts
apps/api/src/modules/chains/SubscriptionAuthorization.ts
```

Modified:

```
CHANGES.md
apps/api/src/__tests__/CheckoutPayment.spec.ts
apps/api/src/__tests__/Invoice.spec.ts
apps/api/src/__tests__/Price.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/Subscription.spec.ts
apps/api/src/__tests__/SubscriptionBilling.spec.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/modules/BillingMonitor.ts
apps/api/src/modules/CheckoutPayment.ts
apps/api/src/modules/Invoice.ts
apps/api/src/modules/Price.ts
apps/api/src/modules/Subscription.ts
apps/api/src/modules/SubscriptionBilling.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/modules/chains/types.ts
apps/api/src/routes/paymentPages.routes.ts
apps/docs/src/app/pages/docs/data/billing.ts
apps/docs/src/app/pages/docs/data/environment-variables.ts
apps/docs/src/app/pages/docs/data/event-types.ts
apps/docs/src/app/pages/docs/data/invoices.ts
apps/docs/src/app/pages/docs/data/prices.ts
apps/docs/src/app/pages/docs/data/subscriptions.ts
libs/shared-schemas/src/lib/CheckoutSessionSchema.spec.ts
libs/shared-schemas/src/lib/CheckoutSessionSchema.ts
libs/shared-types/src/lib/CheckoutSession.ts
libs/shared-types/src/lib/Event.ts
libs/shared-types/src/lib/Subscription.ts
```

### Task 14 fix round 1: one charge per period, recorded before it is sent, on the chain's schedule

Review findings and planner ruling Q10, applied to billing:

- **Charges are recorded before they are sent (C1, Q10 #7).**
  - `CollectSubscriptionPayment` takes `onSigned`. The invoice records the hash, compare-and-set, on its cycle claim and on the PaymentIntent (new `pending_charge_hash`; the PaymentIntent turns `processing`) before the network sees it.
  - A receipt timeout or a send with no clear answer is `pending`: the invoice stays `open` with `charge_pending`. No attempt is counted, and there is no `invoice.payment_failed` and no `past_due`.
  - Every run settles recorded hashes first (`ReconcileSubscriptionCharge`):
    - a confirmed receipt with `Charged(subId, amount)` is paid;
    - a reverted one clears the hash; only a decline (allowance, balance, blacklist) counts as an attempt, anything else waits;
    - no receipt and the nonce taken: cleared, then charged again;
    - no receipt and the nonce unused: pending. After 10 minutes it is re-priced at the same nonce under the operator's `sender:` lock, with the new hash recorded first.
  - The checkout's first-period collect works the same way, with the session as the claim's owner.
  - `onchain:<subId>` is never written as a settlement reference.
- **One collector per period (C2, Q10 #6).**
  - New `SubscriptionCycleClaims` collection, keyed `${subId}:${dueAt}`, insert-only and indexed in `Database.ts`.
  - Checkout claims the period before it collects. An "already collected" answer counts as paid only with that session's recorded hash and a verified `Charged` log; otherwise it is a 409 `period_already_collected`.
  - `Subscriptions.subscription_onchain_id` has a unique partial index over live statuses, so one live Subscription bills each on-chain subscription. The id is set at insert.
  - A Subscription canceled here keeps `cancel_pending_on_chain` (with `cancel_pending_transaction_hash`) until the chain reads it canceled. Billing runs send the cancel again, and checkout refuses that on-chain subscription until then.
  - `MemoryDatabase` honours unique and partial indexes, insert-only `AddID`, `$or`, `$inc`, range operators, `Delete` and query cursors.
- **Waits cannot starve due subscriptions (C3).** Paused invoices have no `next_payment_attempt`, and waits are scheduled at their own time. The due pass is paginated, and turns that only wait do not count toward `batch_size`.
- **Periods follow the chain's grid (I1, Q10 #3).**
  - Before any charge (renewal or retry), the runner reads `nextChargeAt`. It voids open invoices whose `period_start` is before the due grid point (up to 12 a run), then pays or creates the invoice for that point.
  - After `Charged`, the period is `[nextChargeAt - period, nextChargeAt]`.
  - `NotDueYet` is a wait with `next_payment_attempt = nextChargeAt`. With no recorded hash, the `Charged` logs since `period_start` decide: paid, or voided as `cycle_missed`.
  - A checkout's first period starts at the on-chain due time.
- **An on-chain cancel is final (I2, Q10 #1).** The runner cancels the Subscription with `cancellation_details { reason: 'cancellation_requested', comment: 'canceled_on_chain' }`. It voids the open invoices, releases the billing claim, and emits `customer.subscription.deleted` and `invoice.voided`, with no dunning. The same applies while the subscription is paused, and running it again changes nothing.
- **Permit sizing (I3, Q10 #2).** The permit is the current allowance plus this plan's `PermitValue`. `needs_permit` is true while the allowance is below this plan's value plus that of the wallet's other live on-chain subscriptions. The contracts README and the subscriptions docs state the exposure bound verbatim.
- **Amounts a plan cannot collect (Q10 #4, M9).**
  - These cases get a 400 `invalid_request_error` with `details.code = onchain_plan_amount_exceeded`: subscription create and update, subscription item create, update and delete, and invoice item create.
  - At collect time, the same applies when `amount_due` exceeds the price's `unit_amount`.
  - Checkout creates the Subscription with `quantity: 1` and refuses other quantities.
- **Event and codes (Q10 #5, M2).**
  - `customer.subscription.allowance_exhausted` (an extension) replaces `subscription.allowance_exhausted`. It is emitted only for the invoice's own platform (M5).
  - Declines set the PaymentIntent's `last_payment_error.code`.
- **Minor fixes:**
  - M1: setting `pause_collection` clears `paused_on_chain`.
  - M3: older documents read with defaults for `paused_on_chain`, `cancel_pending_on_chain` and `cancel_pending_transaction_hash`.
  - M4: a plan mismatch is a 409 `onchain_plan_mismatch` with fixed text. It is a wait, not a decline.
  - M6: `DELETE /v1/subscriptions/:id` sends the on-chain cancel and records its hash without waiting.
  - M8:
    - the subscription chain code moved to `chains/EthereumSubscriptions.ts`;
    - the transaction helpers moved to `chains/EthereumTransactions.ts`;
    - payment and subscription checkouts share one compare-and-set relay recorder.
  - M10: the expiry check also runs on the `transaction_hash` subscription confirm path.
- **Confirmations.** Plan and charge waits still count the receipt's own block as the first of `ETH_CONFIRMATIONS`, and reconcile now counts the same way. Subscribe verification still reads at `latest - ETH_CONFIRMATIONS`, like checkout.
- **Docs:**
  - billing: the grid, voiding, pending charges, terminal cancel, pending cancels, and waits not counted;
  - invoices: declines vs waits and every code;
  - subscriptions: the new fields, the amount limits, the exposure bound and the non-blocking cancel;
  - prices: the amount limits;
  - PaymentIntents: `pending_charge_hash` and the decline codes;
  - event types: the renamed event;
  - contracts README: permit sizing and the exposure bound.
- **Tests:**
  - Unit: reconcile outcomes, claims and the unique index, waits vs declines, the C3 starvation case (batch-size + 1 paused subscriptions, one due), the realistic N4 resume, voiding, on-chain cancel, permit sizing, the amount guards, and the mocked-RPC charge, reconcile, re-price and cancel paths.
  - Anvil, through the API's billing runner, invoices and subscriptions on MemoryDatabase:
    - a decline, then a late charge across two periods that voids the skipped invoice;
    - a pause across a due time with `evm_increaseTime`, collected on resume;
    - cancel from the API, confirmed by the runner, then resubscribe with the same on-chain id (a second live one is refused);
    - an on-chain cancel reconciled, voiding the open invoice;
    - a receipt timeout (automine off) left pending, then settled by its hash.

Added in fix round 1:

```
apps/api/src/modules/SubscriptionCycleClaims.ts
apps/api/src/modules/chains/EthereumSubscriptions.ts
apps/api/src/modules/chains/EthereumTransactions.ts
```

Modified in fix round 1:

```
CHANGES.md
apps/api/src/__tests__/CheckoutPayment.spec.ts
apps/api/src/__tests__/Invoice.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/Subscription.spec.ts
apps/api/src/__tests__/SubscriptionBilling.spec.ts
apps/api/src/__tests__/anvil/Subscriptions.anvil.spec.ts
apps/api/src/__tests__/mocks/MemoryDatabase.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/modules/CheckoutPayment.ts
apps/api/src/modules/CheckoutSession.ts
apps/api/src/modules/Database.ts
apps/api/src/modules/Invoice.ts
apps/api/src/modules/InvoiceItem.ts
apps/api/src/modules/PaymentIntent.ts
apps/api/src/modules/Subscription.ts
apps/api/src/modules/SubscriptionBilling.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/modules/chains/SubscriptionAuthorization.ts
apps/api/src/modules/chains/types.ts
apps/api/src/utils/RecurringInterval.ts
apps/docs/src/app/pages/docs/data/billing.ts
apps/docs/src/app/pages/docs/data/event-types.ts
apps/docs/src/app/pages/docs/data/invoices.ts
apps/docs/src/app/pages/docs/data/payment-intents.ts
apps/docs/src/app/pages/docs/data/prices.ts
apps/docs/src/app/pages/docs/data/subscriptions.ts
contracts/README.md
libs/shared-types/src/lib/Event.ts
libs/shared-types/src/lib/PaymentIntent.ts
libs/shared-types/src/lib/Subscription.ts
```

### Task 14 fix round 2: dunning, every charge hash, simulated ids, claims on real MongoDB, trial-anchored grid

The re-review of fix round 1 and planner ruling Q11a, in two commits: the contract first, then the API.

- **Trials anchor the on-chain grid (Q11a, contract commit).**
  - `Subscriptions.sol` takes a signed `firstChargeAt`:
    - `subscribe(planKey, firstChargeAt)`;
    - `subscribeWithAuthorization(…, terms, firstChargeAt, deadline, sig)`;
    - `subscribeWithPermit(…, terms, firstChargeAt, permitValue, …)`.
  - `0` means now; anything else must be from now to `MAX_FIRST_CHARGE_DELAY` (365 days) ahead, else `InvalidFirstCharge`. `nextChargeAt` starts there, so the contract refuses a charge during a trial (`NotDueYet`).
  - `SUBSCRIBE_TYPEHASH` is over `Subscribe(bytes32 planKey,address subscriber,address token,uint256 amount,uint64 periodSeconds,uint64 firstChargeAt,uint256 nonce,uint256 deadline)`.
  - No stack-too-deep in the contract, so `via_ir` stays off. Tests call `subscribeWithPermit` through a `PermitSubscribe` struct helper.
  - 8 new forge tests, covering before, at, past, over a year, `0`, an altered value, the permit and direct paths, and a fuzz. `SUBSCRIPTIONS_ABI`, the harness typehash check and the README follow.
- **Trials in the API (Q11a).**
  - Prepare: `BuildSubscribeAuthorization(…, { trialSeconds })` signs `firstChargeAt = chainNow + trial`, or `0` without a trial. It appears in the typed data and as `subscription.first_charge_at`, and is kept on the session (`payment_details.first_charge_at`) for the relay.
  - Finalize with a trial collects nothing and sets `trial_end` to the chain's first charge time. The period runs from now to `trial_end`, and no cycle invoice is created yet. A chain start later than the trial allows is a 400.
  - At the trial end, the runner pays the invoice with `period_start == trial_end`, and the period follows the `Charged` event.
  - A trial can last at most 365 days.
- **N1: the dunning schedule is back.**
  - On the due path, an invoice whose `next_payment_attempt` is in the future is a wait: left alone, and not counted.
  - The pending-charge reconcile is exempt. `chain_unavailable` and `charge_refused` waits follow the same rule.
  - Declines retry at 1, 3 and 5 days, then the invoice is `uncollectible` and the subscription `unpaid`.
- **N2: simulated subscriptions get one id per checkout session** (`sim_sub_${planKey}_${wallet}_${sessionId}`), so the unique index holds on every rail.
  - If `EnsureCollections` cannot build that index because of duplicates, startup stops with a fixed message (`DUPLICATE_ONCHAIN_SUBSCRIPTIONS_MESSAGE`) that names the collection and field and says to dedupe. The driver error is only logged.
- **N3 and item 1: every charge hash is reconciled, by Q10 #7's table.**
  - A cycle claim keeps `charge_hashes` (append-only, with `charge_nonce`). The PaymentIntent mirrors them in `charge_hashes`. All are written compare-and-set before each send, the original and every re-priced replacement.
  - Reconcile checks all of them:
    - any confirmed `Charged` among them is paid;
    - one mined without collecting is the attempt's outcome;
    - no receipt and the nonce unused is pending, even when the node does not know them;
    - `dropped` only once the nonce is consumed.
  - A re-price the network refuses stays pending.
  - Before an invoice whose claim ever sent a charge is voided (`cycle_missed`) or refused (`period_already_collected`), the bounded `Charged`-log search since its period start runs. A match that no other cycle recorded pays and credits it.
  - The checkout's first-period collect follows the same rules, so its own landed charge completes it.
- **Item 6: cycle claims on real MongoDB.**
  - With mongoose 9, `new model({ id }).save()` (`Database.AddID`) drops `id`, because the flexible schema's `id` virtual shadows it. Claims lost their key, the unique index never applied, and the claim's compare-and-set never matched, so paid checkout answered `another_confirmation` forever.
  - Claims are now written as every collection's writes are, through `Database.Set`: an upsert by `id` with `$setOnInsert`, which inserts once and returns the stored claim.
  - `AddID` was dead upstream code and broken under mongoose 9, so it is removed. `MemoryDatabase` gained `$setOnInsert`.
  - The other new fields (`charge_hashes`, `pending_charge_hash`, `cancel_pending_*`) and the partial unique index were checked on a real MongoDB 7.
- **Minor fixes:**
  - m2: pending on-chain cancels are read oldest first and page by page, not capped at the batch size.
    - A cancel still unmined after 10 minutes is re-priced (`cancel_pending_sent_at`).
    - One that reverted, or lost its nonce, is sent again while the chain reads the subscription active.
    - `Canceled`/`None` goes through `CancelFromChain`.
  - m3: `CancelFromChain` emits only `customer.subscription.deleted`.
  - m4: the paid period comes from the `Charged` event's `nextChargeAt`, kept on the cycle claim (`paid_period`), with no re-read.
  - m5: a merchant or on-chain un-pause re-arms open invoices at `max(now, their schedule)`. The schedule is kept on the cycle claim over the pause.
  - m6: the session's `payment_details.pending_charge_hash` is cleared once reconciled, and documented.
  - m7: a lost PaymentIntent compare-and-set re-reads it and follows the claim.
  - m8: a subscription id is never reported as `transaction_hash`.
  - OOS2: the first-period collect waits only for what is left of `CHECKOUT_CONFIRM_TIMEOUT_MS`.
- **Docs:**
  - billing: the dunning rule, every hash, the log search, cancels and the trial grid;
  - subscriptions: trials, `cancel_pending_sent_at` and cancel follow-up;
  - checkout sessions: `payment_details.first_charge_at` and `pending_charge_hash`;
  - PaymentIntents: `charge_hashes`;
  - prices: trials on-chain.
- **Tests:**
  - Unit:
    - two runs inside a dunning window, then 1/3/5-day retries to `unpaid`, on the real modules;
    - two simulated checkouts to one price on the real index;
    - the startup message;
    - all hashes, the nonce rule and the log search;
    - the trial typed data, prepare, relay and finalize;
    - the trial-end runner path from the real post-subscribe state;
    - cancels paging and re-pricing;
    - the PaymentIntent compare-and-set;
    - the claim spec, with an opt-in real-MongoDB case (`MONGODB_TEST_URI`).
  - Anvil:
    - a 7-day trial on a 30-day plan;
    - a re-priced charge whose original is the one mined, paid once and credited.

Added in fix round 2:

```
apps/api/src/__tests__/Database.spec.ts
apps/api/src/__tests__/SubscriptionCycleClaims.spec.ts
```

Modified in fix round 2:

```
CHANGES.md
apps/api/src/__tests__/CheckoutPayment.spec.ts
apps/api/src/__tests__/Invoice.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/Subscription.spec.ts
apps/api/src/__tests__/SubscriptionAuthorization.spec.ts
apps/api/src/__tests__/SubscriptionBilling.spec.ts
apps/api/src/__tests__/anvil/Harness.anvil.spec.ts
apps/api/src/__tests__/anvil/Subscriptions.anvil.spec.ts
apps/api/src/__tests__/mocks/MemoryDatabase.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/main.ts
apps/api/src/modules/CheckoutPayment.ts
apps/api/src/modules/CheckoutSession.ts
apps/api/src/modules/Database.ts
apps/api/src/modules/Invoice.ts
apps/api/src/modules/PaymentIntent.ts
apps/api/src/modules/Subscription.ts
apps/api/src/modules/SubscriptionBilling.ts
apps/api/src/modules/SubscriptionCycleClaims.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
apps/api/src/modules/chains/EthereumSubscriptions.ts
apps/api/src/modules/chains/EthereumTransactions.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/modules/chains/SubscriptionAuthorization.ts
apps/api/src/modules/chains/abi/Subscriptions.ts
apps/api/src/modules/chains/types.ts
apps/docs/src/app/pages/docs/data/billing.ts
apps/docs/src/app/pages/docs/data/checkout-sessions.ts
apps/docs/src/app/pages/docs/data/payment-intents.ts
apps/docs/src/app/pages/docs/data/prices.ts
apps/docs/src/app/pages/docs/data/subscriptions.ts
contracts/README.md
contracts/src/Subscriptions.sol
contracts/test/Subscriptions.t.sol
libs/shared-types/src/lib/CheckoutSession.ts
libs/shared-types/src/lib/PaymentIntent.ts
libs/shared-types/src/lib/Subscription.ts
```

## Task 15: Subscription checkout and dashboard (web)

Hosted checkout now starts on-chain subscriptions from the customer's browser wallet. A first-time wallet signs the USDC permit and then the `Subscribe` message; a wallet whose allowance already covers the plan signs only the `Subscribe`. One confirm carries both signatures and the prepared `deadline`, and the API relays them in one transaction (Task 14). The dashboard shows the on-chain subscription and its on-chain states.

- **Subscribe flow** (`features/checkout/util/checkout-subscription.ts`, addendum A2):
  - `CheckoutSubscriber` signs with `eth_signTypedData_v4`: the permit first when `subscription.needs_permit`, then `subscription.subscribe_typed_data`. It confirms `{ permit_signature?, subscribe_signature, deadline }` through the Task 12 confirmer, so `payment_pending`, gateway errors and the 5-minute stop behave as for payments, and every retry sends the same signatures.
  - Before the wallet is asked, the messages must match this checkout:
    - both are for the configured chain;
    - the `Subscribe` is from the connected wallet, for `subscription.plan_id`, in the session's USDC (`merchant_wallet.token_address`), for the price's `unit_amount × 10 000` and period (a month is 30 days, as the API creates plans), with the prepared `deadline`;
    - the permit is from the connected wallet, lets the Subscriptions contract (the `Subscribe` domain's `verifyingContract`) spend that USDC, has the same deadline, and sets at least the allowance the plan adds.
  - A mismatch shows "This subscription request is out of date. Reload the page and try again." and nothing is signed. A message for another chain shows its own network message.
  - `already_subscribed` still confirms `{ already_subscribed, subscription_onchain_id }` without signing.
  - `checkout.component.ts` does not grow (987 lines, was 988). The error text and the "who must sign again" reading moved to `checkout-payment.ts` as pure functions.
- **What the customer is shown** (addenda A1 and A3), while the wallet signs:
  - the amount, period and token from the `Subscribe` message, e.g. "10.00 USDC every month" and "USDC (0x1c7D…7238)";
  - with a permit, the allowance the plan adds (`amount × max(12, ceil(365 days / period))`, e.g. "130.00 USDC (13 charges)" for a month) and the total allowance the permit sets (its `value`, which includes the wallet's current allowance);
  - without a permit, that the existing allowance already covers the subscription;
  - "First charge on <date>" from `message.firstChargeAt` when present and non-zero (a trial), otherwise "First charge today". The Task 14 fix round adds `firstChargeAt`; this is built against fixtures of that shape.
  - The help text says "First-time wallets approve twice. No ETH is needed for gas."
- **Fixed error text** (never the API's words):
  - 409 `period_already_collected` at confirm;
  - 400 `onchain_plan_amount_exceeded` at prepare (quantity above 1);
  - 409 `subscription_authorization_stale`, which drops the signatures so Subscribe prepares and signs again;
  - 400 `onchain_plan_amount_exceeded` from dashboard subscription create and update. `SubscriptionService` replaces the message, and keeps the status, type and `code`.
  - `GetApiErrorCode()` (`api.service.ts`) reads an error's `code`, falling back to its type.
- **Wallet account changes** (addendum A2, `wallet.service.ts`):
  - After `Connect()`, the provider's `accountsChanged` event updates `account()`. An empty or malformed account clears it. Events before `Connect()` or after `Disconnect()` are ignored.
  - The listener moves with the wallet when a late EIP-6963 announcement replaces the `window.ethereum` fallback.
  - Checkout clears `blockedByWallet` (and the stale error) when the account switches to the recorded payer that must sign again. The `blockedByWallet` side effect left `SignatureRequiredMessage`: `HandlePaymentError` sets it from `ReadSignatureRequired()`.
- **Dashboard subscriptions:**
  - The detail page shows `subscription_onchain_id` (copyable) with a "Subscriber wallet on explorer" link to the subscriber's wallet (`default_payment_method`), where its USDC charges and allowance show. The on-chain id is a contract key, which an explorer has no page for.
  - On-chain states show as chips next to the status, each with an explanation:
    - "Cancel pending on-chain" (`cancel_pending_on_chain`), with `cancel_pending_transaction_hash` linked on the explorer;
    - "Allowance exhausted" (the latest invoice is open and its last collection failed with `collection_failed_allowance`, the condition behind `customer.subscription.allowance_exhausted`), explained as "Renewal authorization exhausted";
    - "Paused on-chain" (`paused_on_chain`).
  - The list's status column shows the most pressing on-chain state first. Both views expand `latest_invoice`.
  - The cancel dialog says canceling also cancels on the Subscriptions contract, and that the customer can also stop every pull by canceling on-chain or revoking their USDC allowance.
  - The webhook event list labels `customer.subscription.allowance_exhausted`. Without the label the production web build failed to type-check at Task 14's tip.
- **Dashboard prices:** a recurring price's Pricing table shows its on-chain plan (`subscription_plan_id`, copyable), or "Not created yet".
- **Docs** (`subscriptions.ts`): a "Subscribing in hosted checkout" callout on the subscription object page describes the customer-facing flow.
- **Tests:**
  - Checkout component, with the real `WalletService` and a fake EIP-1193 wallet:
    - two `eth_signTypedData_v4` calls (permit, then `Subscribe`) when `needs_permit`, one otherwise, and one confirm carrying both signatures and the `deadline`;
    - the terms shown while signing, a trial's first charge date from `firstChargeAt`, and `firstChargeAt: 0` as today;
    - the mismatch guards, a rejected permit, a pending subscribe retried with the same signatures, the three fixed error texts, `already_subscribed`, and Pay turning back on after `accountsChanged` to the payer.
  - Confirmer: held subscribe signatures are re-sent on retry.
  - Wallet: `accountsChanged` handling and the listener move.
  - Dashboard: on-chain display helpers, the subscription detail page (on-chain id, explorer links, chips and notices), the cancel dialog copy, the price detail plan id, and the subscription service's fixed error text.
- **Simulated-rail run** (ruling R4, API on `SETTLEMENT_RAIL=simulated` with a throwaway Mongo database). The web's bodies are used: prepare `{ payer_wallet, email }`, then confirm `{ transaction_hash: "sim_sig:…" }`.
  - A trial price completes. The repeat confirm is idempotent, and the dashboard fields the web reads are present.
  - A quantity-2 update answers `code: onchain_plan_amount_exceeded`.
  - A non-trial price does not complete: see the Task 15 report. On MongoDB, the first-period collect answers 409 `another_confirmation` on the first confirm, because the cycle claim is stored without its `id` (an API issue, outside this task).

Added:

```
apps/web/src/app/data/services/subscription.service.spec.ts
apps/web/src/app/features/account/products/views/price-detail/price-detail.component.spec.ts
apps/web/src/app/features/account/subscriptions/components/subscription-cancel-modal/subscription-cancel-modal.component.spec.ts
apps/web/src/app/features/account/subscriptions/util/subscription-display.spec.ts
apps/web/src/app/features/account/subscriptions/views/subscription-detail/subscription-detail.component.spec.ts
apps/web/src/app/features/checkout/util/checkout-subscription.ts
```

Modified:

```
CHANGES.md
apps/docs/src/app/pages/docs/data/subscriptions.ts
apps/web/src/app/core/services/api.service.ts
apps/web/src/app/core/services/wallet.service.spec.ts
apps/web/src/app/core/services/wallet.service.ts
apps/web/src/app/data/services/checkout-session.service.ts
apps/web/src/app/data/services/subscription.service.ts
apps/web/src/app/data/services/webhook-endpoint.service.ts
apps/web/src/app/features/account/products/views/price-detail/price-detail.component.html
apps/web/src/app/features/account/products/views/price-detail/price-detail.component.ts
apps/web/src/app/features/account/subscriptions/components/subscription-cancel-modal/subscription-cancel-modal.component.html
apps/web/src/app/features/account/subscriptions/components/subscription-cancel-modal/subscription-cancel-modal.component.scss
apps/web/src/app/features/account/subscriptions/util/subscription-display.ts
apps/web/src/app/features/account/subscriptions/views/subscription-detail/subscription-detail.component.html
apps/web/src/app/features/account/subscriptions/views/subscription-detail/subscription-detail.component.scss
apps/web/src/app/features/account/subscriptions/views/subscription-detail/subscription-detail.component.ts
apps/web/src/app/features/account/subscriptions/views/subscription-list/subscription-list.component.ts
apps/web/src/app/features/checkout/checkout.component.html
apps/web/src/app/features/checkout/checkout.component.scss
apps/web/src/app/features/checkout/checkout.component.spec.ts
apps/web/src/app/features/checkout/checkout.component.ts
apps/web/src/app/features/checkout/util/checkout-payment.spec.ts
apps/web/src/app/features/checkout/util/checkout-payment.ts
apps/web/src/app/shared/ui/status-chip/status-chip.component.ts
```

### Task 15 fix round 1: resume subscription confirms on reload and show what a trial charges today

- **A trial charges nothing today.** For a price with `recurring.trial_period_days` above 0, the order summary shows the trial ("7-day free trial", US$0.00), then the first charge with its amount, and "Total due today" of US$0.00.
  - The first charge date comes from the signed `firstChargeAt` once prepared, e.g. "First charge on 3 Nov 2026". Before that it is estimated from the trial length, e.g. "First charge around 3 Nov 2026 (estimated)".
  - Without a trial, "Total due today" is still `amount_total`. The public session carries no `subscription_data`, so the price's trial is the only input.
- **Resume on load for subscriptions.** An open subscription session with a recorded `payment_details.transaction_hash` is confirmed by `{ transaction_hash }` on load and polled like a payment, so a reload asks for no signatures. This holds even past `expires_at`, which the API allows for a recorded relay. On `payment_resubmit_required`, the payer presses Subscribe and signs the permit and the `Subscribe` again.
- **Plan check.** The `Subscribe`'s `planKey` and the prepare's `plan_id` must both equal the checkout price's `subscription_plan_id`.
- **An account switch stops signing.** Before each signature (the permit, the `Subscribe`, and a payment's authorization), the connected account must still be the wallet that was prepared. Otherwise: "Your wallet switched accounts. Press Subscribe to start again." (or "Press Pay").
- **Existing on-chain subscription:** the `{ already_subscribed, subscription_onchain_id }` confirm is held and retried until it settles, like a signed one. It may collect the first period, so it can be pending or hit a gateway timeout.
- **Subscription wording.** The confirm and poll messages, "Check subscription status", "Confirming subscription", and the sign-again and wallet-blocked messages say "subscription" and "Subscribe" in subscription mode. Payment wording is unchanged.
- **`firstChargeAt` is checked before signing:**
  - without a trial, it must be absent or 0;
  - with a trial, an integer after now and at most `trial_period_days` days plus one hour away.
  - Anything else, including a non-numeric value, is "out of date" and is not signed.
- **Structure:**
  - `USDC_UNITS_PER_CENT` and `ShortHash` are shared from `checkout-payment.ts`.
  - The button labels moved to `checkout-format.ts`.
  - The terms box now uses the existing payment-method box classes, so `checkout.component.scss` is back to its size before Task 15.
  - `checkout.component.ts` is 987 lines.
- **Removed:** a leftover `console.log` of the price in `price-detail.component.ts`.
- **Tests:**
  - Component: the trial summary in all three cases; resume by hash with no signatures (past expiry); resubmit asking for both signatures; the plan check; an account switch on both the subscription and the payment path; the existing-subscription confirm retried after `payment_pending` and a 504; subscription wording; and the `firstChargeAt` window.
  - New `checkout-subscription.spec.ts` for the pure functions:
    - permit periods (weekly 53, monthly 13, yearly 12);
    - period labels, including "2 weeks" and "3 months";
    - 6-decimal amounts and thousands separators;
    - the trial summary.

Added in fix round 1:

```
apps/web/src/app/features/checkout/util/checkout-subscription.spec.ts
```

Modified in fix round 1:

```
CHANGES.md
apps/web/src/app/features/account/products/views/price-detail/price-detail.component.spec.ts
apps/web/src/app/features/account/products/views/price-detail/price-detail.component.ts
apps/web/src/app/features/checkout/checkout.component.html
apps/web/src/app/features/checkout/checkout.component.scss
apps/web/src/app/features/checkout/checkout.component.spec.ts
apps/web/src/app/features/checkout/checkout.component.ts
apps/web/src/app/features/checkout/util/checkout-format.ts
apps/web/src/app/features/checkout/util/checkout-payment.ts
apps/web/src/app/features/checkout/util/checkout-subscription.ts
```

### Task 15: alignment with the final subscriptions API (Task 14)

- The final `Subscribe` typed data always signs `firstChargeAt`, after `periodSeconds` and as a string: "0" without a trial, the latest block time plus the trial otherwise. This is the field the web already reads and checks, so no web code changed.
- The checkout specs' fixtures now use the final shapes: `firstChargeAt` in every `Subscribe`, and the new required `subscription.first_charge_at` (0, or null for an existing on-chain subscription). A separate fixture keeps the older shape without the field.
- The web reads none of the other new fields (`payment_details.first_charge_at`, `PaymentIntent.charge_hashes`, `Subscription.cancel_pending_sent_at`).
- On the simulated rail with MongoDB, a subscription checkout without a trial now completes end to end with the web's bodies, now that Task 14 fixed the claim `id`.

Modified:

```
CHANGES.md
apps/web/src/app/features/checkout/checkout.component.spec.ts
```

### Task 16: docs, copy and agent-skill sweep

- Removed every remaining Solana mention (network names, wallet and address samples, explorer links, gas currency, signer instructions, secret-key variables) from the docs pages, the docs agent-doc generator and its test, the README, the setup page and the two agent skills. Sample addresses are EIP-55 (`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`, `last4` `79C8`); sample transaction hashes are `0x` plus 64 hex; payout `metadata.network` is `ethereum` and `gas_fee_currency` is `eth`.
- Product copy now says what is true: no platform fee or percentage cut, and the operator pays Ethereum gas. The "No middlemen and no fees" tagline is gone. Checkout buyers sign and pay no gas; the relayer pays.
- Agent skills use `WALLET_PRIVATE_KEY` (`0x` plus 64 hex) and describe batches of up to 100 payouts, with the gas note.
- New docs page "Gas and fees" (`gas-and-fees.ts`, linked from the Marketplaces guides): who pays for each operation, estimates at 1, 5 and 20 gwei with ETH at a $3,000 placeholder, how to read `estimated_fee`, batching and minimum-payout guidance. Every figure is labelled an estimate. Contract gas was measured with `forge test --gas-report` against MockUSDC and rounded up for the real USDC proxy. `createPlan` measured about 180 k gas, higher than the earlier 120 k estimate, so the page uses the measured figure.
- Subscription docs: a trial shows a total due today of 0 and anchors the first charge at `trial_end` (the signed `firstChargeAt`); reloading checkout resumes a recorded relay; an on-chain cancel is terminal; there is no hosted page for renewing the authorization (the subscriber raises the allowance from their own wallet or subscribes again).
- `contracts/README.md`: EIP-7702-delegated accounts are checked only via EIP-1271, and the allowance-exhausted, cancel and trial behaviour matches what the API does.
- The dashboard payout dialog shows the fee in ETH only. A dollar estimate and a warning when the fee exceeds 10 percent of the payout wait for a verified ETH/USD feed, so the docs do not promise them.
- The chain id stays configurable (`ETH_CHAIN_ID`), so the design does not rule out other EVM networks.

Modified: the docs data pages under `apps/docs/src/app/pages/docs/data/` (accounts, account-links, agent-marketplace-quickstart, agent-payments-quickstart, api-quickstart, authentication, billing, build-a-marketplace, customers, deployment, event-types, external-wallets, guides, index, local-development, marketplace-quickstart, migrate-from-stripe, payouts, platform-dashboard, subscriptions, transfers, webhook-endpoints), `docs-catalog.ts`, `apps/docs/scripts/generate-agent-docs.ts` and its test, `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `contracts/README.md`, `apps/web/src/app/features/setup/setup.component.html` and the two `.agents/skills` files. Added: `apps/docs/src/app/pages/docs/data/gas-and-fees.ts`.

### Task 17: brand tokens and the rebrand script

- **`BRAND`** (`libs/shared-types/src/lib/Brand.ts`, exported from `@zoneless/shared-types`) holds the brand tokens in one place: `productName`, `packageScope`, `idInfix`, `connectedAccountHeader`, `envPrefix` and `cliBin`. The values are still `Zoneless`, `@zoneless`, `z`, `zoneless-account`, `ZONELESS` and `zoneless`.
- **IDs:**
  - `GenerateId(prefix)` now inserts `BRAND.idInfix`, so `GenerateId('po')` returns `po_z_…`.
  - The 43 call sites in `apps/api/src/modules` dropped their `_z` suffix (`GenerateId('po_z')` became `GenerateId('po')`, and API keys use `GenerateId('sk_live' | 'sk_test', 99)`). Generated IDs are unchanged.
  - `GenerateToken(prefix)` is the same generator without the infix. It serves values that are not object IDs, and their format is unchanged: client secrets (`pi_z_…_secret_…`), request IDs (`req_…`) and simulated deposit hashes (`sim_dep_…`).
  - The auth exchange route recognises account-link and login-link tokens by `al_${BRAND.idInfix}_` and `ll_${BRAND.idInfix}_`. Before, it matched the literal `_z_`.
- **Connected-account header:** the name comes from `BRAND.connectedAccountHeader` in the API middleware (`OptionalConnectedAccount`'s default, and the payout-create route's `RequireConnectedAccountOwnership`), the Node SDK (`HttpClient`, `balanceTransactions`) and the dashboard's `ApiService`. The SDK and dashboard now send it in lowercase (`zoneless-account`). HTTP header names are case-insensitive, so nothing else changes.
- **Webhook signature header:** a dispatcher test pins the header name to `` `${BRAND.productName}-Signature` `` and checks it is the only header besides `Content-Type`.
- **Test helpers:** `DeterministicId` inserts the infix like `GenerateId`, and the new `DeterministicToken` mirrors `GenerateToken`. The mocks of the three modules that call `GenerateToken` provide it.
- **`scripts/rebrand.sh [--dry-run] <name> <Name> <infix>`:**
  - It reads the current tokens from `BRAND`, rewrites `BRAND` to the new ones, and rewrites matching strings in the tracked text files of `apps/`, `libs/`, `sdks/`, `docker/`, `docker-compose.yml`, `.env*.example`, the root Markdown files, `.github/`, `.agents/`, `scripts/`, `contracts/` (except `contracts/lib/` and Solidity sources), the root `package.json` and `tsconfig*.json`. It renames the `.agents/skills/<name>-*` directories.
  - Patterns, most specific first: the package scope (also in `\/`-escaped regexes); the connected-account header; `<Name>-Account`; `<Name>-Signature` and `<name>-signature`; `<Name>PayoutBatchError`; the `<NAME>_` env prefix; the remaining upper-case, display and lower-case name; and the `_<infix>` ID infix after a lowercase prefix (`acct_z_…`, `/^vs_z/`).
  - It keeps:
    - the per-file attribution header line;
    - upstream attribution (`github.com/zonelessdev` links, "Zoneless Ltd", "fork of the Zoneless project");
    - Angular's own `provideZonelessChangeDetection`, `setupZonelessTestEnv` and `jest-preset-angular/setup-env/zoneless`;
    - the HKDF salt `zoneless-v1`, because renaming it would change every key derived from `APP_SECRET`;
    - references to binary assets named after the old brand. It lists those assets for replacement by hand.
  - It never touches `LICENSE`, `NOTICE`, `CHANGES.md`, `docs/plans/`, the root `package-lock.json`, `contracts/lib/` or Solidity sources. It warns if a Solidity file names the old brand, because an EIP-712 domain change alters signed digests.
  - `--dry-run` prints the hit count of each pattern and writes nothing. A second run with the same arguments changes nothing. After a real run it prints the follow-ups: `npm install`, the test suite, `npm run format` and a diff review.
- **`scripts/rebrand.spec.sh`:** a bash self-test. It builds a fixture repository in a temp directory and checks four things there:
  - argument validation;
  - the dry-run counts, and that nothing is written;
  - the rewritten files, including that the attribution header and Angular APIs are kept and that the protected files are untouched;
  - that a second run is a no-op.

Added:

```
apps/api/src/__tests__/IdGenerator.spec.ts
libs/shared-types/src/lib/Brand.ts
scripts/rebrand.sh
scripts/rebrand.spec.sh
```

Modified:

```
CHANGES.md
apps/api/src/__tests__/CheckoutSession.spec.ts
apps/api/src/__tests__/PaymentIntent.spec.ts
apps/api/src/__tests__/Setup.ts
apps/api/src/__tests__/TopUp.spec.ts
apps/api/src/__tests__/WebhookDelivery.spec.ts
apps/api/src/middleware/Authorization.ts
apps/api/src/middleware/RequestContext.ts
apps/api/src/modules/Account.ts
apps/api/src/modules/AccountLink.ts
apps/api/src/modules/ApiKey.ts
apps/api/src/modules/Balance.ts
apps/api/src/modules/BalanceTransaction.ts
apps/api/src/modules/Charge.ts
apps/api/src/modules/CheckoutSession.ts
apps/api/src/modules/Customer.ts
apps/api/src/modules/Event.ts
apps/api/src/modules/ExternalWallet.ts
apps/api/src/modules/IdentityVerificationSession.ts
apps/api/src/modules/Invoice.ts
apps/api/src/modules/InvoiceItem.ts
apps/api/src/modules/LoginLink.ts
apps/api/src/modules/PaymentIntent.ts
apps/api/src/modules/PaymentLink.ts
apps/api/src/modules/Payout.ts
apps/api/src/modules/PayoutBatchStore.ts
apps/api/src/modules/Person.ts
apps/api/src/modules/Price.ts
apps/api/src/modules/Product.ts
apps/api/src/modules/Subscription.ts
apps/api/src/modules/TopUp.ts
apps/api/src/modules/Transfer.ts
apps/api/src/modules/WebhookDelivery.ts
apps/api/src/modules/WebhookEndpoint.ts
apps/api/src/routes/balance.routes.ts
apps/api/src/routes/balanceTransactions.routes.ts
apps/api/src/routes/exchange.routes.ts
apps/api/src/routes/payouts.routes.ts
apps/api/src/routes/transfers.routes.ts
apps/api/src/utils/IdGenerator.ts
apps/web/src/app/core/services/api.service.ts
libs/shared-types/src/lib/index.ts
sdks/node/src/HttpClient.ts
sdks/node/src/__tests__/HttpClient.spec.ts
sdks/node/src/resources/BalanceTransactions.ts
```

### Task 17: rebrand to FiatDesk

- **How:** `bash scripts/rebrand.sh fiatdesk FiatDesk fd` on the previous commit, then `npm install` and Prettier with the `npm run format` globs (leaving out the untracked local `.superpowers/` and `.claude/` folders). Running those three steps on the previous commit reproduces this commit, except for the hand edits listed below.
- **Script counts:** 6 `BRAND` fields; package scope 419 hits in 289 files; `Zoneless-Account` 26; `Zoneless-Signature` 12; `ZonelessPayoutBatchError` 19; `zoneless-signature` 3; `ZONELESS_` env prefix 142; other upper case 7; `Zoneless` 845 in 152 files; `zoneless` 469 in 131 files; ID infix 2,354 in 107 files; 2 renamed paths. It kept 76 attribution header lines and 13 upstream references.
- **`BRAND`** is now `{ productName: 'FiatDesk', packageScope: '@fiatdesk', idInfix: 'fd', connectedAccountHeader: 'fiatdesk-account', envPrefix: 'FIATDESK', cliBin: 'fiatdesk' }`.
- **What users see:**
  - Packages are `@fiatdesk/node`, `@fiatdesk/cli`, `@fiatdesk/shared-types`, `@fiatdesk/shared-schemas` and the root `@fiatdesk/source`. The CLI bin is `fiatdesk`.
  - Object IDs and keys use the `fd` infix: `po_fd_…`, `acct_fd_…`, `sk_live_fd_…`, `sk_test_fd_…`, `whsec_fd_…`, `al_fd_…`, `ll_fd_…`. Client secrets look like `pi_fd_…_secret_…`. Existing IDs are not migrated, because this fork has no deployed database.
  - Request headers: `FiatDesk-Account` for connected accounts (the SDK and dashboard send `fiatdesk-account`). The webhook signature header is `FiatDesk-Signature`, which receivers read as `req.headers['fiatdesk-signature']`.
  - API values: `controller.fiatdesk_dashboard`; `'fiatdesk'` in `controller.requirement_collection`, `controller.losses.payments` and automatic-tax `provider`. The `@zoneless_extension` doc tags became `@fiatdesk_extension`.
  - SDK: the `FiatDesk` class, `FiatDeskApiError`, `FiatDeskPayoutBatchError`, `FiatDeskConfig` and the `fiatdeskAccount` request option.
  - Integration env vars: `FIATDESK_API_KEY`, `FIATDESK_API_URL`, `FIATDESK_WEBHOOK_SECRET`, `FIATDESK_AUTH_URL`, `FIATDESK_ACTIVATION_URL`, `FIATDESK_AUTH_POLL_INTERVAL_MS` and `FIATDESK_PROFILE`. The API server's own variables had no brand prefix and are unchanged.
  - CLI: the config directory `fiatdesk`, the project file `.fiatdesk/project.json`, the keychain service `fiatdesk-cli`, the user agent `fiatdesk-cli/experimental` and the webhook metadata keys `fiatdesk_cli_managed` and `fiatdesk_workspace_id`.
  - Agent skills are now `.agents/skills/fiatdesk-marketplace` and `.agents/skills/fiatdesk-payments`.
  - Docker: the containers are `fiatdesk-mongodb`, `fiatdesk-mongo-express`, `fiatdesk-api` and `fiatdesk-web`, on the `fiatdesk-network` network. The default MongoDB database is `fiatdesk`.
  - Docs browser-storage keys: `fiatdesk-theme` and `fiatdesk_sdk_preference`.
- **Hand edits beyond the script:**
  - `NOTICE`: the product line is now `FiatDesk`, the copyright line `Copyright 2026 FiatDesk`, and the last sentence "Modified by the FiatDesk maintainers". The upstream Zoneless attribution is unchanged.
  - The API's setup banner reads "FiatDesk platform created". The script's upper-case rule had produced "FIATDESK PLATFORM CREATED", which the brand guidelines rule out.
  - This section.
- **Kept on purpose** (these are the remaining `zoneless` mentions outside `LICENSE`, `NOTICE`, `CHANGES.md`, `docs/plans/`, `package-lock.json` and `contracts/lib/`):
  - the per-file attribution header lines;
  - the README's fork attribution;
  - Angular's `provideZonelessChangeDetection`, `setupZonelessTestEnv` and `jest-preset-angular/setup-env/zoneless`;
  - the HKDF salt `zoneless-v1`;
  - the upstream logo `zoneless-white-50h.png` and its one reference. Task 17b replaces upstream visual assets.
  - the protection list in `scripts/rebrand.sh` and the Zoneless fixture in `scripts/rebrand.spec.sh`.
- `LICENSE` is unchanged.
- **Not in this task:** renaming the GitHub repository (the `OWNER/REPO` placeholders stay), publishing to npm, and visual assets (logos, favicons, fonts, colours), which are Task 17b.

Renamed:

```
.agents/skills/zoneless-marketplace/SKILL.md -> .agents/skills/fiatdesk-marketplace/SKILL.md
.agents/skills/zoneless-payments/SKILL.md -> .agents/skills/fiatdesk-payments/SKILL.md
```

Modified:

```
.env.example
.env.production.example
.github/ISSUE_TEMPLATE/bug_report.md
.github/ISSUE_TEMPLATE/feature_request.md
AGENTS.md
CHANGES.md
CONTRIBUTING.md
NOTICE
README.md
SECURITY.md
apps/api/Dockerfile
apps/api/src/__tests__/Account.spec.ts
apps/api/src/__tests__/AccountLink.spec.ts
apps/api/src/__tests__/Balance.spec.ts
apps/api/src/__tests__/BalanceTransaction.spec.ts
apps/api/src/__tests__/ChainCursorStore.spec.ts
apps/api/src/__tests__/Charge.spec.ts
apps/api/src/__tests__/CheckoutAuthorization.spec.ts
apps/api/src/__tests__/CheckoutPayment.spec.ts
apps/api/src/__tests__/CheckoutSession.spec.ts
apps/api/src/__tests__/Customer.spec.ts
apps/api/src/__tests__/ErrorHandler.spec.ts
apps/api/src/__tests__/Event.spec.ts
apps/api/src/__tests__/ExternalWallet.spec.ts
apps/api/src/__tests__/IdGenerator.spec.ts
apps/api/src/__tests__/IdentityLite.spec.ts
apps/api/src/__tests__/IdentityVerificationSession.spec.ts
apps/api/src/__tests__/Invoice.spec.ts
apps/api/src/__tests__/InvoiceItem.spec.ts
apps/api/src/__tests__/LoginLink.spec.ts
apps/api/src/__tests__/PaymentIntent.spec.ts
apps/api/src/__tests__/PaymentLink.spec.ts
apps/api/src/__tests__/Payout.spec.ts
apps/api/src/__tests__/PayoutBatchStore.spec.ts
apps/api/src/__tests__/PayoutEncoding.spec.ts
apps/api/src/__tests__/Person.spec.ts
apps/api/src/__tests__/PlatformAccess.spec.ts
apps/api/src/__tests__/Price.spec.ts
apps/api/src/__tests__/Product.spec.ts
apps/api/src/__tests__/Settlement.spec.ts
apps/api/src/__tests__/Setup.ts
apps/api/src/__tests__/SetupModule.spec.ts
apps/api/src/__tests__/Subscription.spec.ts
apps/api/src/__tests__/SubscriptionAuthorization.spec.ts
apps/api/src/__tests__/SubscriptionBilling.spec.ts
apps/api/src/__tests__/SubscriptionCycleClaims.spec.ts
apps/api/src/__tests__/SubscriptionItem.spec.ts
apps/api/src/__tests__/TopUp.spec.ts
apps/api/src/__tests__/TopUpMonitor.spec.ts
apps/api/src/__tests__/Transfer.spec.ts
apps/api/src/__tests__/WebhookDelivery.spec.ts
apps/api/src/__tests__/WebhookEndpoint.spec.ts
apps/api/src/__tests__/anvil/Checkout.anvil.spec.ts
apps/api/src/__tests__/anvil/Payouts.anvil.spec.ts
apps/api/src/__tests__/anvil/Subscriptions.anvil.spec.ts
apps/api/src/__tests__/anvil/TopUps.anvil.spec.ts
apps/api/src/__tests__/mocks/MemoryDatabase.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/main.ts
apps/api/src/middleware/Authorization.ts
apps/api/src/middleware/IdempotencyMiddleware.ts
apps/api/src/modules/Account.ts
apps/api/src/modules/AccountLink.ts
apps/api/src/modules/ApiKey.ts
apps/api/src/modules/AppConfig.ts
apps/api/src/modules/Balance.ts
apps/api/src/modules/BalanceTransaction.ts
apps/api/src/modules/ChainCursorStore.ts
apps/api/src/modules/Charge.ts
apps/api/src/modules/CheckoutPayment.ts
apps/api/src/modules/CheckoutSession.ts
apps/api/src/modules/Customer.ts
apps/api/src/modules/Database.ts
apps/api/src/modules/Event.ts
apps/api/src/modules/EventService.ts
apps/api/src/modules/ExternalWallet.ts
apps/api/src/modules/IdentityVerificationSession.ts
apps/api/src/modules/Invoice.ts
apps/api/src/modules/InvoiceItem.ts
apps/api/src/modules/LoginLink.ts
apps/api/src/modules/OperatorStats.ts
apps/api/src/modules/PaymentIntent.ts
apps/api/src/modules/PaymentLink.ts
apps/api/src/modules/Payout.ts
apps/api/src/modules/PayoutBatchStore.ts
apps/api/src/modules/Person.ts
apps/api/src/modules/PlatformAccess.ts
apps/api/src/modules/Price.ts
apps/api/src/modules/Product.ts
apps/api/src/modules/Reporting.ts
apps/api/src/modules/ReportingBuckets.ts
apps/api/src/modules/Setup.ts
apps/api/src/modules/Subscription.ts
apps/api/src/modules/SubscriptionBilling.ts
apps/api/src/modules/TopUp.ts
apps/api/src/modules/TopUpMonitor.ts
apps/api/src/modules/Transfer.ts
apps/api/src/modules/Usage.ts
apps/api/src/modules/WebhookDelivery.ts
apps/api/src/modules/WebhookDeliveryWorker.ts
apps/api/src/modules/WebhookDispatcher.ts
apps/api/src/modules/WebhookEndpoint.ts
apps/api/src/modules/WebhookVerify.ts
apps/api/src/modules/chains/CheckoutAuthorization.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
apps/api/src/modules/chains/EthereumSubscriptions.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/modules/chains/SubscriptionAuthorization.ts
apps/api/src/modules/chains/types.ts
apps/api/src/modules/identity/DiditProvider.ts
apps/api/src/modules/identity/IdentityLite.ts
apps/api/src/modules/identity/IdentitySettingsCrypto.ts
apps/api/src/modules/identity/IdentityVerificationProvider.ts
apps/api/src/modules/identity/ResolveIdentityProvider.ts
apps/api/src/routes/accountLinks.routes.ts
apps/api/src/routes/accounts.routes.ts
apps/api/src/routes/apiKeys.routes.ts
apps/api/src/routes/balance.routes.ts
apps/api/src/routes/balanceTransactions.routes.ts
apps/api/src/routes/charges.routes.ts
apps/api/src/routes/checkoutSessions.routes.ts
apps/api/src/routes/config.routes.ts
apps/api/src/routes/customers.routes.ts
apps/api/src/routes/exchange.routes.ts
apps/api/src/routes/externalAccounts.routes.ts
apps/api/src/routes/identityVerificationSessions.routes.ts
apps/api/src/routes/invoiceItems.routes.ts
apps/api/src/routes/invoices.routes.ts
apps/api/src/routes/loginLinks.routes.ts
apps/api/src/routes/operator.routes.ts
apps/api/src/routes/paymentIntents.routes.ts
apps/api/src/routes/paymentLinks.routes.ts
apps/api/src/routes/paymentPages.routes.ts
apps/api/src/routes/payouts.routes.ts
apps/api/src/routes/persons.routes.ts
apps/api/src/routes/prices.routes.ts
apps/api/src/routes/products.routes.ts
apps/api/src/routes/setup.routes.ts
apps/api/src/routes/subscriptionItems.routes.ts
apps/api/src/routes/subscriptions.routes.ts
apps/api/src/routes/topups.routes.ts
apps/api/src/routes/transfers.routes.ts
apps/api/src/routes/webhookEndpoints.routes.ts
apps/api/src/utils/AfterCompletion.ts
apps/api/src/utils/IdGenerator.ts
apps/api/src/utils/ListHelper.ts
apps/api/src/utils/RecurringInterval.ts
apps/api/src/utils/Timestamp.ts
apps/cli/README.md
apps/cli/package.json
apps/cli/project.json
apps/cli/src/app/AgentSetup.ts
apps/cli/src/app/Arguments.ts
apps/cli/src/app/Cli.spec.ts
apps/cli/src/app/Cli.ts
apps/cli/src/app/Client.ts
apps/cli/src/app/Commands.ts
apps/cli/src/app/EnvSync.spec.ts
apps/cli/src/app/EnvSync.ts
apps/cli/src/app/ProfileStore.spec.ts
apps/cli/src/app/ProfileStore.ts
apps/cli/src/app/ProjectStore.spec.ts
apps/cli/src/app/ProjectStore.ts
apps/cli/src/app/SecretStore.ts
apps/cli/src/app/SkillInstaller.spec.ts
apps/cli/src/app/SkillInstaller.ts
apps/cli/src/app/Types.ts
apps/cli/src/app/WebhookSync.spec.ts
apps/cli/src/app/WebhookSync.ts
apps/cli/src/main.ts
apps/docs/scripts/generate-agent-docs.test.ts
apps/docs/scripts/generate-agent-docs.ts
apps/docs/src/app/components/agent-prompt-cta/agent-marketplace-prompt.ts
apps/docs/src/app/components/agent-prompt-cta/agent-payments-prompt.ts
apps/docs/src/app/components/agent-prompt-cta/agent-prompt-cta.html
apps/docs/src/app/components/agent-prompt-cta/agent-prompt-cta.ts
apps/docs/src/app/pages/docs/data/account-links.ts
apps/docs/src/app/pages/docs/data/accounts.ts
apps/docs/src/app/pages/docs/data/agent-marketplace-quickstart.ts
apps/docs/src/app/pages/docs/data/agent-payments-quickstart.ts
apps/docs/src/app/pages/docs/data/api-quickstart.ts
apps/docs/src/app/pages/docs/data/authentication.ts
apps/docs/src/app/pages/docs/data/balance-transactions.ts
apps/docs/src/app/pages/docs/data/balance.ts
apps/docs/src/app/pages/docs/data/billing.ts
apps/docs/src/app/pages/docs/data/build-a-marketplace.ts
apps/docs/src/app/pages/docs/data/charges.ts
apps/docs/src/app/pages/docs/data/checkout-sessions.ts
apps/docs/src/app/pages/docs/data/connected-accounts.ts
apps/docs/src/app/pages/docs/data/customers.ts
apps/docs/src/app/pages/docs/data/deployment.ts
apps/docs/src/app/pages/docs/data/environment-variables.ts
apps/docs/src/app/pages/docs/data/errors.ts
apps/docs/src/app/pages/docs/data/event-types.ts
apps/docs/src/app/pages/docs/data/events.ts
apps/docs/src/app/pages/docs/data/expanding-responses.ts
apps/docs/src/app/pages/docs/data/external-wallets.ts
apps/docs/src/app/pages/docs/data/fund-platform-wallet.ts
apps/docs/src/app/pages/docs/data/gas-and-fees.ts
apps/docs/src/app/pages/docs/data/idempotent-requests.ts
apps/docs/src/app/pages/docs/data/identity-verification-sessions.ts
apps/docs/src/app/pages/docs/data/identity-verification.ts
apps/docs/src/app/pages/docs/data/invoice-items.ts
apps/docs/src/app/pages/docs/data/invoices.ts
apps/docs/src/app/pages/docs/data/local-development.ts
apps/docs/src/app/pages/docs/data/login-links.ts
apps/docs/src/app/pages/docs/data/marketplace-quickstart.ts
apps/docs/src/app/pages/docs/data/migrate-from-stripe.ts
apps/docs/src/app/pages/docs/data/pagination.ts
apps/docs/src/app/pages/docs/data/payment-intents.ts
apps/docs/src/app/pages/docs/data/payment-links.ts
apps/docs/src/app/pages/docs/data/payouts.ts
apps/docs/src/app/pages/docs/data/persons.ts
apps/docs/src/app/pages/docs/data/platform-dashboard.ts
apps/docs/src/app/pages/docs/data/prices.ts
apps/docs/src/app/pages/docs/data/products.ts
apps/docs/src/app/pages/docs/data/quickstart.ts
apps/docs/src/app/pages/docs/data/self-hosting.ts
apps/docs/src/app/pages/docs/data/shared.ts
apps/docs/src/app/pages/docs/data/subscription-items.ts
apps/docs/src/app/pages/docs/data/subscriptions.ts
apps/docs/src/app/pages/docs/data/top-ups.ts
apps/docs/src/app/pages/docs/data/transfers.ts
apps/docs/src/app/pages/docs/data/webhook-endpoints.ts
apps/docs/src/app/pages/docs/data/webhooks.ts
apps/docs/src/app/pages/docs/docs.html
apps/docs/src/app/pages/docs/docs.ts
apps/docs/src/app/services/meta.ts
apps/docs/src/app/services/sdk-preference.ts
apps/docs/src/app/services/theme.ts
apps/docs/src/assets/favicon/site.webmanifest
apps/docs/src/index.html
apps/web/src/app/core/services/api.service.ts
apps/web/src/app/core/services/auth.service.ts
apps/web/src/app/core/services/meta.service.ts
apps/web/src/app/data/services/account-link.service.ts
apps/web/src/app/data/services/account.service.ts
apps/web/src/app/data/services/api-key.service.ts
apps/web/src/app/data/services/balance.service.ts
apps/web/src/app/data/services/charge.service.ts
apps/web/src/app/data/services/checkout-session.service.ts
apps/web/src/app/data/services/config.service.ts
apps/web/src/app/data/services/customer.service.ts
apps/web/src/app/data/services/external-wallet.service.ts
apps/web/src/app/data/services/identity.service.ts
apps/web/src/app/data/services/invoice.service.ts
apps/web/src/app/data/services/payment-intent.service.ts
apps/web/src/app/data/services/payment-link.service.ts
apps/web/src/app/data/services/payout.service.ts
apps/web/src/app/data/services/person.service.ts
apps/web/src/app/data/services/price.service.ts
apps/web/src/app/data/services/product.service.ts
apps/web/src/app/data/services/reporting.service.ts
apps/web/src/app/data/services/setup.service.ts
apps/web/src/app/data/services/subscription.service.spec.ts
apps/web/src/app/data/services/subscription.service.ts
apps/web/src/app/data/services/topup.service.ts
apps/web/src/app/data/services/transaction.service.ts
apps/web/src/app/data/services/transfer.service.ts
apps/web/src/app/data/services/webhook-endpoint.service.ts
apps/web/src/app/features/account/balance/components/add-funds-panel/add-funds-panel.component.ts
apps/web/src/app/features/account/balance/components/balance-detail/balance-detail.component.ts
apps/web/src/app/features/account/balance/services/balance-actions.service.ts
apps/web/src/app/features/account/components/connected-account-detail/connected-account-detail.component.ts
apps/web/src/app/features/account/components/events-list/events-list.component.ts
apps/web/src/app/features/account/components/transaction-list/components/payout-detail/payout-detail.component.ts
apps/web/src/app/features/account/components/transaction-list/components/topup-detail/topup-detail.component.ts
apps/web/src/app/features/account/components/transaction-list/components/transfer-detail/transfer-detail.component.ts
apps/web/src/app/features/account/components/transaction-list/transaction-list.component.html
apps/web/src/app/features/account/components/transaction-list/transaction-list.component.ts
apps/web/src/app/features/account/connected-accounts/components/connected-account-actions-host/connected-account-actions-host.component.ts
apps/web/src/app/features/account/connected-accounts/components/create-connected-account-host/create-connected-account-host.component.html
apps/web/src/app/features/account/connected-accounts/components/payout-modal/payout-modal.component.html
apps/web/src/app/features/account/connected-accounts/components/payout-modal/payout-modal.component.spec.ts
apps/web/src/app/features/account/connected-accounts/components/reject-account-modal/reject-account-modal.component.html
apps/web/src/app/features/account/connected-accounts/services/connected-account-actions.service.spec.ts
apps/web/src/app/features/account/connected-accounts/services/connected-account-actions.service.ts
apps/web/src/app/features/account/connected-accounts/util/connected-account-display.ts
apps/web/src/app/features/account/connected-accounts/util/identity-requirements.ts
apps/web/src/app/features/account/connected-accounts/views/connected-account-detail/connected-account-detail.component.html
apps/web/src/app/features/account/connected-accounts/views/connected-account-detail/connected-account-detail.component.ts
apps/web/src/app/features/account/connected-accounts/views/connected-accounts-list/connected-accounts-list.component.ts
apps/web/src/app/features/account/customers/components/customer-form/customer-form.component.ts
apps/web/src/app/features/account/customers/services/customer-actions.service.ts
apps/web/src/app/features/account/customers/views/customer-detail/customer-detail.component.ts
apps/web/src/app/features/account/customers/views/customer-list/customer-list.component.ts
apps/web/src/app/features/account/dashboard/full-home/full-home.component.ts
apps/web/src/app/features/account/developers/components/api-key-form/api-key-form.component.ts
apps/web/src/app/features/account/developers/components/webhook-endpoint-form/webhook-endpoint-form.component.ts
apps/web/src/app/features/account/developers/developers.component.ts
apps/web/src/app/features/account/invoices/services/invoice-actions.service.ts
apps/web/src/app/features/account/invoices/util/invoice-display.ts
apps/web/src/app/features/account/invoices/views/invoice-detail/invoice-detail.component.ts
apps/web/src/app/features/account/invoices/views/invoice-list/invoice-list.component.ts
apps/web/src/app/features/account/payment-intents/services/payment-intent-actions.service.ts
apps/web/src/app/features/account/payment-intents/util/transaction-export.spec.ts
apps/web/src/app/features/account/payment-intents/util/transaction-export.ts
apps/web/src/app/features/account/payment-intents/views/payment-intent-detail/payment-intent-detail.component.ts
apps/web/src/app/features/account/payment-intents/views/payment-intent-list/payment-intent-list.component.ts
apps/web/src/app/features/account/payment-links/components/payment-link-form/payment-link-form.component.html
apps/web/src/app/features/account/payment-links/components/payment-link-form/payment-link-form.component.ts
apps/web/src/app/features/account/payment-links/components/payment-link-preview/payment-link-preview.component.html
apps/web/src/app/features/account/payment-links/services/payment-link-actions.service.ts
apps/web/src/app/features/account/payment-links/util/payment-link-display.ts
apps/web/src/app/features/account/payment-links/views/payment-link-detail/payment-link-detail.component.ts
apps/web/src/app/features/account/payment-links/views/payment-link-list/payment-link-list.component.ts
apps/web/src/app/features/account/products/components/price-form/price-form.component.ts
apps/web/src/app/features/account/products/components/product-form/product-form.component.ts
apps/web/src/app/features/account/products/services/price-actions.service.ts
apps/web/src/app/features/account/products/services/product-actions.service.ts
apps/web/src/app/features/account/products/util/price-display.ts
apps/web/src/app/features/account/products/views/price-detail/price-detail.component.spec.ts
apps/web/src/app/features/account/products/views/price-detail/price-detail.component.ts
apps/web/src/app/features/account/products/views/product-catalogue/product-catalogue.component.ts
apps/web/src/app/features/account/products/views/product-detail/product-detail.component.ts
apps/web/src/app/features/account/settings/settings.component.ts
apps/web/src/app/features/account/shells/express-shell/express-account-alerts.ts
apps/web/src/app/features/account/shells/full-shell/dashboard-search/dashboard-search.component.ts
apps/web/src/app/features/account/subscriptions/components/subscription-cancel-modal/subscription-cancel-modal.component.spec.ts
apps/web/src/app/features/account/subscriptions/components/subscription-cancel-modal/subscription-cancel-modal.component.ts
apps/web/src/app/features/account/subscriptions/services/subscription-actions.service.ts
apps/web/src/app/features/account/subscriptions/util/subscription-display.spec.ts
apps/web/src/app/features/account/subscriptions/util/subscription-display.ts
apps/web/src/app/features/account/subscriptions/views/subscription-detail/subscription-detail.component.spec.ts
apps/web/src/app/features/account/subscriptions/views/subscription-detail/subscription-detail.component.ts
apps/web/src/app/features/account/subscriptions/views/subscription-list/subscription-list.component.ts
apps/web/src/app/features/checkout/checkout.component.html
apps/web/src/app/features/checkout/checkout.component.spec.ts
apps/web/src/app/features/checkout/checkout.component.ts
apps/web/src/app/features/checkout/util/checkout-collection.ts
apps/web/src/app/features/checkout/util/checkout-completion.ts
apps/web/src/app/features/checkout/util/checkout-format.ts
apps/web/src/app/features/checkout/util/checkout-payment.spec.ts
apps/web/src/app/features/checkout/util/checkout-payment.ts
apps/web/src/app/features/checkout/util/checkout-subscription.spec.ts
apps/web/src/app/features/checkout/util/checkout-subscription.ts
apps/web/src/app/features/onboard/onboard.component.html
apps/web/src/app/features/onboard/onboard.component.scss
apps/web/src/app/features/onboard/onboard.component.ts
apps/web/src/app/features/platform-login/platform-login.component.html
apps/web/src/app/features/setup/setup.component.html
apps/web/src/app/features/setup/setup.component.ts
apps/web/src/app/shared/forms/account-type-form/account-type-form.component.ts
apps/web/src/app/shared/forms/business-profile-form/business-profile-form.component.ts
apps/web/src/app/shared/forms/external-wallet-form/external-wallet-form.component.ts
apps/web/src/app/shared/forms/identity-settings-form/identity-settings-form.component.html
apps/web/src/app/shared/forms/identity-settings-form/identity-settings-form.component.ts
apps/web/src/app/shared/forms/person-form/person-form.component.ts
apps/web/src/app/shared/ui/date-range-picker/date-range-picker.component.ts
apps/web/src/app/shared/ui/line-chart/line-chart.component.ts
apps/web/src/app/shared/ui/metric-chart-card/metric-chart-card.component.ts
apps/web/src/app/shared/ui/paginated-list/paginated-list.component.ts
apps/web/src/app/utils/account-type.ts
apps/web/src/assets/favicon/site.webmanifest
apps/web/src/index.html
contracts/README.md
docker-compose.yml
libs/shared-schemas/package-lock.json
libs/shared-schemas/package.json
libs/shared-schemas/src/lib/AccountSchema.ts
libs/shared-schemas/src/lib/BillingSchema.ts
libs/shared-schemas/src/lib/CheckoutSessionSchema.spec.ts
libs/shared-schemas/src/lib/CheckoutSessionSchema.ts
libs/shared-schemas/src/lib/IdentityThresholdRules.ts
libs/shared-schemas/src/lib/IdentityVerificationSessionSchema.ts
libs/shared-schemas/src/lib/InvoiceSchema.ts
libs/shared-schemas/src/lib/PaymentIntentSchema.ts
libs/shared-schemas/src/lib/PaymentLinkSchema.ts
libs/shared-schemas/src/lib/PayoutSchema.ts
libs/shared-schemas/src/lib/PriceSchema.ts
libs/shared-schemas/src/lib/ProductSchema.ts
libs/shared-schemas/src/lib/SubscriptionItemSchema.ts
libs/shared-schemas/src/lib/SubscriptionSchema.ts
libs/shared-schemas/src/lib/WebhookEndpointSchema.ts
libs/shared-types/package.json
libs/shared-types/src/lib/Account.ts
libs/shared-types/src/lib/AccountLink.ts
libs/shared-types/src/lib/ApiKey.ts
libs/shared-types/src/lib/AuthenticatedUser.ts
libs/shared-types/src/lib/Balance.ts
libs/shared-types/src/lib/BalanceTransaction.ts
libs/shared-types/src/lib/Billing.ts
libs/shared-types/src/lib/Brand.ts
libs/shared-types/src/lib/Charge.ts
libs/shared-types/src/lib/CheckoutSession.ts
libs/shared-types/src/lib/Customer.ts
libs/shared-types/src/lib/Event.ts
libs/shared-types/src/lib/ExternalWallet.ts
libs/shared-types/src/lib/IdentityVerificationSession.ts
libs/shared-types/src/lib/Invoice.ts
libs/shared-types/src/lib/InvoiceItem.ts
libs/shared-types/src/lib/InvoiceLineItem.ts
libs/shared-types/src/lib/InvoicePayment.ts
libs/shared-types/src/lib/LoginLink.ts
libs/shared-types/src/lib/Operator.ts
libs/shared-types/src/lib/PaymentIntent.ts
libs/shared-types/src/lib/PaymentLink.ts
libs/shared-types/src/lib/Payout.ts
libs/shared-types/src/lib/Person.ts
libs/shared-types/src/lib/Price.ts
libs/shared-types/src/lib/Product.ts
libs/shared-types/src/lib/Reporting.ts
libs/shared-types/src/lib/Subscription.ts
libs/shared-types/src/lib/SubscriptionItem.ts
libs/shared-types/src/lib/TopUp.ts
libs/shared-types/src/lib/Transfer.ts
libs/shared-types/src/lib/WebhookDelivery.ts
libs/shared-types/src/lib/WebhookEndpoint.ts
package-lock.json
package.json
scripts/kill-all.sh
sdks/node/README.md
sdks/node/package.json
sdks/node/scripts/assert-bundled-dts.mjs
sdks/node/scripts/generate-inputs.ts
sdks/node/src/HttpClient.ts
sdks/node/src/__tests__/Events.spec.ts
sdks/node/src/__tests__/HttpClient.spec.ts
sdks/node/src/__tests__/IdentityVerificationSessions.spec.ts
sdks/node/src/__tests__/Payouts.spec.ts
sdks/node/src/__tests__/index.spec.ts
sdks/node/src/generated/Inputs.ts
sdks/node/src/index.ts
sdks/node/src/resources/AccountLinks.ts
sdks/node/src/resources/Accounts.ts
sdks/node/src/resources/Balance.ts
sdks/node/src/resources/BalanceTransactions.ts
sdks/node/src/resources/Billing.ts
sdks/node/src/resources/Charges.ts
sdks/node/src/resources/CheckoutSessions.ts
sdks/node/src/resources/Customers.ts
sdks/node/src/resources/Events.ts
sdks/node/src/resources/ExternalAccounts.ts
sdks/node/src/resources/IdentityVerificationSessions.ts
sdks/node/src/resources/InvoiceItems.ts
sdks/node/src/resources/Invoices.ts
sdks/node/src/resources/LoginLinks.ts
sdks/node/src/resources/PaymentIntents.ts
sdks/node/src/resources/PaymentLinks.ts
sdks/node/src/resources/Payouts.ts
sdks/node/src/resources/Persons.ts
sdks/node/src/resources/Prices.ts
sdks/node/src/resources/Products.ts
sdks/node/src/resources/SubscriptionItems.ts
sdks/node/src/resources/Subscriptions.ts
sdks/node/src/resources/TopUps.ts
sdks/node/src/resources/Transfers.ts
sdks/node/src/resources/WebhookEndpoints.ts
sdks/node/src/resources/Webhooks.ts
sdks/node/tsup.config.ts
tsconfig.base.json
```

### Task 17b: FiatDesk visual identity

- **Logos.** The FiatDesk lockup, icon and mark SVGs (black and white) are copied unchanged from the brand package into `apps/web/src/assets/brand/` and `apps/docs/src/assets/brand/`. They replace the upstream logos:
  - the docs top bar and mobile sidebar show the lockup, black in the light theme and white in the dark theme, at 32 px high (about 129 px wide);
  - the platform login header shows the black lockup;
  - the setup welcome screens show the black icon;
  - the onboarding "Powered by" footer shows the white lockup at 120 px wide on the black panel.
- **Platform logo.** `app-platform-logo` still shows the operator's own logo, or its initials when the operator has set only a name. When the operator has set neither, it shows the FiatDesk icon (white on dark surfaces), with square corners.
- **Favicons.** Each app's favicon folder holds the brand package's black set, including `favicon-48x48.png` and `favicon.svg`, and `favicon/dark/` holds the white set. `index.html` links the ICO, the SVG (with a `prefers-color-scheme: dark` variant), the Apple touch icon and the manifest, following the package's `head-snippet.html`. The manifests use `#000000`. The package's `favicon.svg` leaves its background `<rect>` without a size, so browsers draw only the arch. The supplied icon SVG is the same artwork with the square drawn, so `favicon.svg` is a copy of it.
- **Type.** Both apps load Be Vietnam Pro 300 to 600 from Google Fonts. `$title-font` and `$text-font` are `'Be Vietnam Pro', system-ui, sans-serif`, headlines use 600 with a line-height of 1.1, buttons and form labels use 500, and the dashboard sets `font-variant-numeric: tabular-nums` on `body` so amounts line up. The Instrument Sans files are removed. Monospace fonts are unchanged.
- **Colour.** Both `base.scss` files define the palette (`$black`, `$white`, `$ink-900`, `$grey-600`, `$grey-300`, `$grey-100`). The brand accent and primary buttons are black, body text is Ink 900, surfaces are Grey 100, borders are Grey 300, and hover surfaces are a neutral step between them. The docs dark theme uses black and Ink 900 surfaces, and a `--doc-accent` variable that flips between black and white. Other blue identity hues (chart line, search highlight, filter chevron, copy tooltip, input focus ring, scrollbars, setup and login backgrounds) are now neutral. Status colours, test-mode colours, HTTP method colours and code syntax colours are unchanged. In running text, dashboard links are underlined because the palette has no link hue.
- **Meta.** Both `index.html` files have the title `FiatDesk`, a description with the tagline "Stablecoin settlement for high-risk businesses.", and an `og:image` that points to `assets/brand/fiatdesk-og.png`. That image is the supplied 1920 px black lockup PNG, scaled to 840 px and centred on a white 1200×630 canvas. The docs `MetaService` call uses the same values.
- **Docs.** The upstream screenshots are removed from the quickstart, marketplace quickstart, identity verification and fund-your-platform-wallet pages. The step text already describes each screen. The four screenshots that the Platform Dashboard page still uses are kept for now. The README shows the lockup and the tagline, and `CONTRIBUTING.md` has a "Brand assets" section.
- **Tests.** New specs cover both `index.html` heads and manifests, the platform-logo fallback, the login lockup, and the docs header lockup in both themes.

Added:

```
apps/docs/src/assets/brand/ (fiatdesk-{logo,icon,mark}-{black,white}.svg, fiatdesk-og.png)
apps/docs/src/assets/favicon/dark/ (the white favicon set: 16, 32, 48, 180, 192 and 512 px PNGs, favicon.ico, favicon.svg)
apps/docs/src/assets/favicon/favicon-48x48.png
apps/docs/src/assets/favicon/favicon.svg
apps/docs/src/index.spec.ts
apps/web/src/app/features/platform-login/platform-login.component.spec.ts
apps/web/src/app/shared/ui/platform-logo/platform-logo.component.spec.ts
apps/web/src/assets/brand/ (the same seven files as the docs brand folder)
apps/web/src/assets/favicon/dark/ (the same eight files as the docs dark favicon folder)
apps/web/src/assets/favicon/favicon-48x48.png
apps/web/src/assets/favicon/favicon.svg
apps/web/src/index.spec.ts
```

Modified:

```
CHANGES.md
CONTRIBUTING.md
README.md
apps/docs/src/app/pages/docs/data/fund-platform-wallet.ts
apps/docs/src/app/pages/docs/data/identity-verification.ts
apps/docs/src/app/pages/docs/data/marketplace-quickstart.ts
apps/docs/src/app/pages/docs/data/quickstart.ts
apps/docs/src/app/pages/docs/docs.html
apps/docs/src/app/pages/docs/docs.scss
apps/docs/src/app/pages/docs/docs.spec.ts
apps/docs/src/app/pages/docs/docs.ts
apps/docs/src/app/styles/base.scss
apps/docs/src/assets/favicon/ (android-chrome-192x192.png, android-chrome-512x512.png, apple-touch-icon.png, favicon-16x16.png, favicon-32x32.png, favicon.ico, site.webmanifest)
apps/docs/src/index.html
apps/docs/src/styles.scss
apps/web/public/favicon.ico
apps/web/src/app/features/account/payment-links/components/payment-link-form/payment-link-form.component.scss
apps/web/src/app/features/account/shells/full-shell/dashboard-search/dashboard-search.component.scss
apps/web/src/app/features/onboard/onboard.component.html
apps/web/src/app/features/onboard/onboard.component.scss
apps/web/src/app/features/platform-login/platform-login.component.html
apps/web/src/app/features/platform-login/platform-login.component.scss
apps/web/src/app/features/setup/setup.component.html
apps/web/src/app/features/setup/setup.component.scss
apps/web/src/app/shared/ui/copy-text/copy-text.component.scss
apps/web/src/app/shared/ui/line-chart/line-chart.component.scss
apps/web/src/app/shared/ui/line-chart/line-chart.component.ts
apps/web/src/app/shared/ui/platform-logo/platform-logo.component.html
apps/web/src/app/shared/ui/platform-logo/platform-logo.component.scss
apps/web/src/app/shared/ui/platform-logo/platform-logo.component.ts
apps/web/src/app/styles/base.scss
apps/web/src/app/styles/buttons.scss
apps/web/src/app/styles/filter-pills.scss
apps/web/src/app/styles/forms.scss
apps/web/src/app/styles/scrollbars.scss
apps/web/src/assets/favicon/ (the same seven files as the docs favicon folder)
apps/web/src/index.html
apps/web/src/styles.scss
```

Deleted (`git diff --name-status` lists each path):

```
apps/docs/src/assets/fonts/ (both Instrument Sans files)
apps/docs/src/assets/images/logos/ (the upstream logo PNG; the GitHub and Discord marks stay)
apps/docs/src/assets/images/screenshots/ (53 upstream screenshots and social images; the four used by platform-dashboard.ts stay)
apps/web/src/assets/fonts/ (both Instrument Sans files)
apps/web/src/assets/images/logos/ (the three upstream logo PNGs; the Ethereum and USDC marks stay)
```

### Task 17b fix round 1: offline builds and local preview image

- The production configurations of `web` and `docs` set `optimization.fonts.inline` to `false`, so production builds no longer download the Google Fonts stylesheet and work offline. Scripts and styles are still optimised. The `<link>` tags load Be Vietnam Pro at runtime, and `system-ui` covers the time before it loads or when it cannot be reached.
- The docs `og:image` (in `index.html` and the `MetaService` call) is now the root-relative `/assets/brand/fiatdesk-og.png`, like the dashboard's, rather than a placeholder host. A comment next to each `og:image` says operators set an absolute URL for link previews.
- The four new spec files carry the attribution header.

Modified:

```
CHANGES.md
apps/docs/project.json
apps/docs/src/app/pages/docs/docs.ts
apps/docs/src/index.html
apps/docs/src/index.spec.ts
apps/web/project.json
apps/web/src/app/features/platform-login/platform-login.component.spec.ts
apps/web/src/app/shared/ui/platform-logo/platform-logo.component.spec.ts
apps/web/src/index.html
apps/web/src/index.spec.ts
```

## Task 17c: Safe wallet switching and several platform wallets

A platform can hold up to 5 Ethereum wallets, with exactly one default, as Stripe's external accounts do. The default does every job: checkout `to`, the top-up scan, the balance, the payout signer and the destination of the subscription plans. Switching the default moves all of it safely (Fable Q13 and the ledger ruling "Task 17c").

- **Wallet rules** (`ExternalWallet.ts`, for every account):
  - At most 5 active wallets. A sixth is a 400: "An account can have at most 5 wallets. Remove one before adding another."
  - The first wallet is the default. A later one becomes the default only with `default_for_currency: true`, on create or on update (`POST /v1/accounts/:id/external_accounts/:wid`). `false` changes nothing; a non-default wallet is stored with `false`.
  - The default cannot be deleted: 400 "Set another wallet as the default before removing this one." A deleted wallet records `archived_at`.
  - `GetDefaultWallet` is the one place that picks the default, and every consumer uses it: the top-up scan, balance details, payouts (platform signer and a connected account's default destination), new recurring prices (`createPlan`'s destination), checkout and identity checks. It never returns an archived wallet, even one still flagged. An account with no active wallet flagged (left by the old Settings flow, which archived the flagged wallet) gets its newest active wallet flagged on the next read, so such databases repair themselves.
- **The switch** (platform accounts):
  1. Refused with 409 `payout_batch_in_progress` while a `built` or `broadcast` payout batch of the old default exists.
  2. One `RunTransaction`: save (or flag) the new default, unflag the others, and record a pending destination change on each active recurring price with an on-chain plan.
  3. After the commit, the changes are sent without waiting for confirmations, and simulated plans flip at once.
     `external_account.updated` is emitted for the new and the old default (`previous_attributes.default_for_currency`). Connected accounts only move the flag: their new default applies to future payouts (Q13 #4(iii)).
- **Plan destinations** (`PlanDestination.ts`, Q13 #1):
  - `Price.subscription_plan_destination` (the confirmed destination) and `Price.subscription_plan_destination_change` (`{ destination, transaction_hash, status: 'pending' | 'confirmed' | 'failed', created, failure_message, sent_at }`) are read-only FiatDesk extensions. New recurring prices record the default they were created with.
  - The change is persisted before it is sent, one in flight per plan; a repeat request for the same destination is the same change. Each signed hash is recorded with a compare-and-set before it is sent.
  - `Settlement.SetPlanDestination` sends `setPlanDestination` from `SUBSCRIPTION_OPERATOR_KEY` under the `sender:` lock. A recorded change is followed by its hash, with the cancel's re-price rule: re-priced at its nonce after 10 minutes. `FollowCancel` became `FollowOperatorTransaction`, shared by both. A plan already paying the destination is `confirmed` with nothing sent. A plan the operator key does not own is a 409 `plan_owner_mismatch`, stored as `failed` with `failure_message: 'plan_owner_mismatch'` and logged as an error; charges then go on to the previous destination. The simulated rail confirms at once.
  - The billing runner follows every pending change first (`ReconcilePending`). The charge gate (`ReadyToCharge`) runs before any new charge in `Invoice.CollectOnchainCycle` and in subscription checkout's first-period collect. It follows the plan's pending change, and moves a plan not on the current default (a plan of an archived price, a price created before this task, or a second switch made while a change was in flight) before anything is charged. A pending plan is a `plan_destination_pending` wait for invoices (no failed attempt, retried next run) and `payment_pending` for checkout.
  - On confirm the destination flips and `price.updated` is emitted with `previous_attributes`. Recording the destination of a price created before this task, with nothing sent, emits no event.
- **Deposits to non-default wallets** (`TopUpMonitor.ts`, `ArchivedWalletDeposits.ts`, Q13 #2):
  - Both the monitor and `check-deposits` scan the platform's other wallets: active non-default ones while they exist, and deleted ones for 30 days after `archived_at`. Each wallet has its own `ChainCursors` entry and uses the same bounded scan as top-ups. An address equal to the default's is scanned once, as the default. USDC an address received before its wallet was added is ignored.
  - Each transfer is stored once in `ArchivedWalletDeposits` (`wallet_id`, `wallet_address`, `transaction_hash`, `log_index`, `amount` in cents, `block_number`, `acknowledged`), with a unique index on `(transaction_hash, log_index)`. The index is registered in `EnsureCollections` and mirrored by `MemoryDatabase.UniqueIndex` in tests. Each detection logs a warning. Nothing is credited.
  - A watched wallet that cannot be scanned is logged and retried; it never blocks the default wallet's top-ups.
  - `BalanceDetails.archived_wallet_deposits[]` lists the unacknowledged ones (not those to the current default). `POST /v1/config/archived-deposits/:id/acknowledge` (platform key) dismisses one, with a 404 for another platform's.
- **Prepared checkouts** (`CheckoutPayment.ts`, Q13 #3):
  - A payment-mode confirm with no relay recorded, whose `payment_details.merchant_wallet` is no longer the default, is a 409 `merchant_wallet_changed`: "The merchant's receiving wallet changed. Please approve the payment again." Nothing is sent or cleared.
  - Prepare reuse (a relay is recorded) is the same 409, with that relay's `transaction_hash`, so the client follows that payment instead of signing the old authorization again.
  - A recorded relay keeps its reconcile: it completes and is credited, and the deposit alert covers the funds in the old wallet. A recorded relay the network never saw (`not_found`) is cleared and answered with `merchant_wallet_changed`, so the buyer approves the new wallet.
  - Subscription checkout pays the plan's destination and waits while the plan moves.
- **Dashboard (web):**
  - Settings shows a **Wallets** section for the platform. It lists the active wallets, the default first, each with a copyable address, a Default badge and the plans still moving to it ("Updating N plans on-chain", or "N plans could not move: the operator key does not own them"). **Add wallet** opens a slide panel with `app-external-wallet-form` and "Make this the default". **Set as default** and **Remove** (non-default rows only) each open a confirm dialog. Set as default says "Checkouts, top-ups, payouts and subscription plans move to 0x…. N plans will be updated on-chain." The per-wallet on-chain USDC balance is omitted: no existing call returns it per wallet. Connected accounts keep the Payout wallet card.
  - `SaveExternalWallet` ("Edit payout wallet", onboarding) now adds the new wallet as the default and then deletes the old one. The old order deleted the old wallet first, which the delete-default rule refuses and which left the flag on the archived wallet.
  - Home and Balances show a banner per wallet with unacknowledged deposits: "USDC arrived at your previous wallet 0x…. Send it to your current wallet 0x… to make it available for payouts." Its **I've moved it** button acknowledges them.
  - Hosted checkout (`util/checkout-payment.ts`, `PayAcrossWalletChange`): on `merchant_wallet_changed` it shows the copy, prepares again and asks the buyer to approve once more. With a `transaction_hash` it follows that payment. A second change ends with the fixed copy. `checkout.component.ts` grew by 8 lines (995).
- **Docs:**
  - External Wallets: wallet rules, `default_for_currency`, the delete-default 400, the platform-switch 409, `archived_at`, and Node examples for create, set default and delete.
  - Prices: `subscription_plan_destination` and `subscription_plan_destination_change`.
  - Balance: new pages "Retrieve balance details" (`archived_wallet_deposits`) and "Acknowledge an archived wallet deposit", both FiatDesk extensions.
  - Checkout Sessions, PaymentIntents and Payment Links: a `merchant_wallet_changed` callout.
  - Event types: `price.updated` and `external_account.updated`.
  - Platform Dashboard: Wallets, the banner and "Changing your platform wallet". Its 4 upstream screenshot references became text; the image files stay for the controller to delete after Task 17b merges.
  - Self-hosting and Subscriptions: a shared "Changing your platform wallet" section.
  - Fund the platform wallet and Top-ups: only the default wallet counts.
  - The two agent skills say the payout key is the default wallet's.
- **SDK:** no change. It does not wrap `/v1/config`, so the acknowledge endpoint (a dashboard route) is not added to it.
- **Tests:**
  - `ExternalWallet.spec` covers the 5 limit, first-is-default, set-default, delete-default, the self-heal of an archived flagged default, the switch transaction and its rollback, `payout_batch_in_progress`, migrations for active on-chain plans only, and connected accounts.
  - `PlanDestination.spec` covers the record and its idempotency, enqueue, send, confirm and event, re-price, `plan_owner_mismatch`, an unreachable rail, convergence, untracked plans and the simulated rail.
  - `SubscriptionBilling.spec` covers no charge while pending, the confirm-then-charge path, re-priced replacements and `plan_owner_mismatch`.
  - `TopUpMonitor.spec` covers watched wallets, the 30-day window, idempotency, pre-addition transfers and scan isolation.
  - `Balance.spec` covers the listing and acknowledge. `CheckoutPayment.spec` covers the confirm and prepare-reuse 409s, re-prepare, a recorded relay, a lost relay and the first-period wait.
  - A "default is not the first wallet" case was added to the TopUpMonitor, Balance, Price and Payout specs.
  - Rail cases were added to `Ethereum.spec` for `SetPlanDestination`.
  - New Anvil spec `WalletSwitch.anvil.spec.ts`: switch, `setPlanDestination` confirms and the next charge lands in the new wallet; a transfer to the old wallet is alerted, not credited, and acknowledged; a checkout prepared before the switch gets the 409 and completes after a re-prepare.
  - Web specs cover the Wallets section, the banner, `ExternalWalletService` (replace order, default pick) and checkout re-prepare (util and component).

Added:

```
apps/api/src/__tests__/PlanDestination.spec.ts
apps/api/src/__tests__/anvil/WalletSwitch.anvil.spec.ts
apps/api/src/modules/ArchivedWalletDeposits.ts
apps/api/src/modules/PlanDestination.ts
apps/web/src/app/data/services/external-wallet.service.spec.ts
apps/web/src/app/features/account/components/archived-deposit-banner/archived-deposit-banner.component.scss
apps/web/src/app/features/account/components/archived-deposit-banner/archived-deposit-banner.component.spec.ts
apps/web/src/app/features/account/components/archived-deposit-banner/archived-deposit-banner.component.ts
apps/web/src/app/features/account/settings/components/wallets-section/wallets-section.component.html
apps/web/src/app/features/account/settings/components/wallets-section/wallets-section.component.scss
apps/web/src/app/features/account/settings/components/wallets-section/wallets-section.component.spec.ts
apps/web/src/app/features/account/settings/components/wallets-section/wallets-section.component.ts
```

Modified:

```
.agents/skills/fiatdesk-marketplace/SKILL.md
.agents/skills/fiatdesk-payments/SKILL.md
CHANGES.md
apps/api/src/__tests__/Balance.spec.ts
apps/api/src/__tests__/CheckoutPayment.spec.ts
apps/api/src/__tests__/Database.spec.ts
apps/api/src/__tests__/ExternalWallet.spec.ts
apps/api/src/__tests__/Payout.spec.ts
apps/api/src/__tests__/Price.spec.ts
apps/api/src/__tests__/SubscriptionBilling.spec.ts
apps/api/src/__tests__/TopUpMonitor.spec.ts
apps/api/src/__tests__/mocks/Settlement.ts
apps/api/src/modules/Balance.ts
apps/api/src/modules/CheckoutPayment.ts
apps/api/src/modules/Database.ts
apps/api/src/modules/ExternalWallet.ts
apps/api/src/modules/Invoice.ts
apps/api/src/modules/Payout.ts
apps/api/src/modules/Price.ts
apps/api/src/modules/SubscriptionBilling.ts
apps/api/src/modules/TopUpMonitor.ts
apps/api/src/modules/chains/Ethereum.spec.ts
apps/api/src/modules/chains/Ethereum.ts
apps/api/src/modules/chains/EthereumSubscriptions.ts
apps/api/src/modules/chains/Settlement.ts
apps/api/src/modules/chains/types.ts
apps/api/src/routes/config.routes.ts
apps/api/src/routes/externalAccounts.routes.ts
apps/api/src/routes/paymentPages.routes.ts
apps/api/src/routes/testHelpers.routes.ts
apps/docs/src/app/pages/docs/data/balance.ts
apps/docs/src/app/pages/docs/data/checkout-sessions.ts
apps/docs/src/app/pages/docs/data/event-types.ts
apps/docs/src/app/pages/docs/data/external-wallets.ts
apps/docs/src/app/pages/docs/data/fund-platform-wallet.ts
apps/docs/src/app/pages/docs/data/payment-intents.ts
apps/docs/src/app/pages/docs/data/payment-links.ts
apps/docs/src/app/pages/docs/data/platform-dashboard.ts
apps/docs/src/app/pages/docs/data/prices.ts
apps/docs/src/app/pages/docs/data/self-hosting.ts
apps/docs/src/app/pages/docs/data/shared.ts
apps/docs/src/app/pages/docs/data/subscriptions.ts
apps/docs/src/app/pages/docs/data/top-ups.ts
apps/web/src/app/data/services/balance.service.ts
apps/web/src/app/data/services/external-wallet.service.ts
apps/web/src/app/data/services/price.service.ts
apps/web/src/app/features/account/balance/views/full-balance/full-balance.component.html
apps/web/src/app/features/account/balance/views/full-balance/full-balance.component.ts
apps/web/src/app/features/account/components/index.ts
apps/web/src/app/features/account/dashboard/full-home/full-home.component.html
apps/web/src/app/features/account/dashboard/full-home/full-home.component.ts
apps/web/src/app/features/account/settings/settings.component.html
apps/web/src/app/features/account/settings/settings.component.ts
apps/web/src/app/features/checkout/checkout.component.spec.ts
apps/web/src/app/features/checkout/checkout.component.ts
apps/web/src/app/features/checkout/util/checkout-payment.spec.ts
apps/web/src/app/features/checkout/util/checkout-payment.ts
libs/shared-types/src/lib/Balance.ts
libs/shared-types/src/lib/ExternalWallet.ts
libs/shared-types/src/lib/Price.ts
```

### Task 17c fix round 1: where the USDC stays on a switch, and the switch races

- **The USDC stays in the old wallet** (I1). A switch moves no funds.
  - The Set-as-default confirm, which Add-with-default now goes through too, says: "Your USDC stays in 0x… (N USDC). Send it to 0x… after switching. Until then, your available balance counts only the new wallet, and payouts above that amount will fail."
  - The Wallets list shows each wallet's on-chain USDC, read in one request: `GET /v1/accounts/:id/external_accounts?include_usdc_balance=true` adds `usdc_balance`, a FiatDesk extension. It is null on the simulated rail and when the chain cannot be read. The SDK's `list` accepts `include_usdc_balance`.
  - The Remove confirm says what a wallet still holds.
  - External Wallets, Platform Dashboard and the shared "Changing your platform wallet" section describe the move step.
- **One transaction per wallet change.**
  - `archive_previous: true` (create or update, with `default_for_currency: true`) deletes the previous default inside the switch transaction, and is allowed at 5 wallets. "Edit payout wallet" uses it in one request.
  - Every create, switch, delete and self-heal first writes the account's `ExternalWalletGuards` document, so concurrent changes conflict. Mongo then aborts one, and it is retried once. The 5-wallet count and the default are read inside that transaction, and the other wallets are unflagged with one filtered `UpdateMany` (new in `Database` and `MemoryDatabase`).
- **Events.** One `external_account.updated` per wallet per request. A set-default together with other fields is a single event. `previous_attributes.default_for_currency` carries the stored value (`null`, `false` or `true`). An archived previous default gets `external_account.deleted`.
- **Self-heal.**
  - It picks the first active wallet in storage order, the legacy `wallets[0]`, so no connected account's payout destination changes.
  - It unflags archived wallets that are still flagged, emits `external_account.updated` for each, and runs in the guarded transaction.
  - The list endpoint heals first.
- **Checkout.**
  - A payment that used the session's authorization and paid any of the platform's own wallets (the recorded merchant wallet, the current default, or an older one) is valid. It is credited, and the verification's new `merchant_address` is recorded.
  - A `transaction_hash` the client sends is verified before anything is refused; only a new relay to a stale wallet gets `merchant_wallet_changed`.
  - `VerifyCheckoutReceipt` takes `alsoPays`.
- **Plan changes.**
  - A switch sends at most 3 plan destination changes itself; the response's `plan_migrations_queued` says how many the billing run sends.
  - `ReconcilePending` follows pending changes oldest first and page by page, served by a new `Prices` index on the change's status and time.
  - `plan_owner_mismatch` is logged once.
  - The docs name the window in which one charge sent just before a switch still pays the old wallet; that charge is credited and its USDC is flagged.
- **Web.**
  - After a switch, the Wallets section reads the plan statuses again every 5 s for up to 2 minutes while any change is pending.
  - The confirm's plan count leaves out plans that already pay the target.
- **Docs:** `plan_destination_pending` is in the invoice wait list and the billing-run description. The Create "Returns" no longer says "already in use". The 5-wallet limit and the switch 409 are marked FiatDesk extensions. `archive_previous`, `usdc_balance`, `include_usdc_balance` and `plan_migrations_queued` are documented.
- **Tests:**
  - All-unflagged cases for top-ups, payouts (a connected account's default destination), prices and balance assert that the helper records its pick.
  - New cases cover concurrent switches (exactly one default), concurrent adds at 4 wallets (one succeeds), the guard write, a WriteConflict retry, `archive_previous`, events, the send cap, the 150-change reconcile, the used-nonce and customer-hash checkout paths, and the web confirm, polling and balances.
  - The CheckoutPayment and SubscriptionBilling specs mock `Logger`.
  - The top-up credit and skip rules for these moves are left to Task 17e (Q14).

Added: `sdks/node/src/__tests__/ExternalAccounts.spec.ts`.

### Task 17c fix round 2: checkout pays only the session's or the current wallet, and every plan change is paged

- **Checkout accepts two wallets only.** A payment that used the session's authorization (a used nonce, or a `transaction_hash` the client sends) is valid only when it paid one of:

  - the wallet the session recorded at prepare (`payment_details.merchant_wallet`);
  - the platform's current default.

  This replaces round 1's "any of the platform's own wallets". A payment to any other wallet is refused and not credited, a deleted wallet included, since its key may be someone else's. The new unit tests and an Anvil test cover this: the buyer signs the session's authorization to a deleted platform wallet and submits it, and the confirm is refused with nothing completed or credited. The Checkout Sessions docs and the shared "merchant wallet changed" callout say so.

- **Plan changes page on `(created, id)`.**
  - `ReconcilePending` reads, strictly after its cursor, the rest of the cursor's second by `id`, then the later seconds. One switch enqueues all its plans in the same second, so changes that stay pending neither repeat nor end the paging.
  - The `Prices` index adds `id`. `MemoryDatabase` sorts on every `orderBy` key, comparing strings by code point.
  - Tested with 150 changes of the same `created` that stay in flight: each is followed exactly once.
- **The switch confirm without a balance.** When the old wallet's USDC cannot be read, the confirm still says "Your USDC stays in 0x…. Send it to 0x… after switching. Until then, your available balance counts only the new wallet, and payouts above that amount will fail." The simulated rail lists no `usdc_balance`, so the confirm shows nothing about USDC there, and `null` now only means a failed read.
- **The plan-status poll stops on destroy.** It stops even when a plan read is still in flight at that moment.
- **Write conflicts.** A wallet change that meets a concurrent one is retried up to twice, each after a random 50 to 150 ms wait. If it still conflicts, it returns a `409` `conflict`: "Another change to this account's wallets is in progress. Try the request again." This rule is listed with the other External Wallet rules.

## Task 17e: The ledger counts each cent of USDC once

Before this task the top-up scan credited every USDC `Transfer` to the default wallet. A checkout or invoice payment was therefore credited twice, once as the payment and once as a top-up. So was USDC moved between the platform's own wallets after a switch, because the old default's funds were already on the ledger. Fable's Q14 ruling did not reach this repository. The rules below are rebuilt from the code and the 17c notes, so review them against that ruling.

- **Payments are counted once** (`PaymentLedger.ts`, `TopUp.ts`):
  - Checkout and invoice payments share one `RecordOnchainPayment`. It replaces the two copies of `RecordPaymentOnLedger`, and each caller passes its own `Settlement`.
  - The scan does not credit a deposit whose transaction is a `payment` balance transaction of that platform. `CreateFromDeposit` checks this after the transaction's first read and throws `DepositIsPaymentError`. A payment committed meanwhile conflicts on the balance write instead.
  - A payment recorded after the scan credited its transaction reverses that credit in the same transaction. The top-up becomes `reversed` and a `topup_reversal` balance transaction debits it. A move that credited the payment's USDC from an old wallet is debited the same way. `topup.reversed` is emitted and a warning logged.
  - USDC that reaches a platform wallet without a recorded payment (an expired session, say) is still credited, since the funds are there.
- **Moves between the platform's wallets** (`TopUpMonitor.ts`, `ArchivedWalletDeposits.ts`):
  - A transfer to the default from another wallet the platform ever added is credited only for that wallet's recorded deposits it carries, oldest first while they fit in the amount moved. A carried deposit must not be credited yet, not be a payment, not be a move from another platform wallet, and must date from no later than the move's block. The rest of a move was counted while that wallet was the default, so it adds nothing. A self-transfer is ignored.
  - Watched wallets are scanned before the default. A move is credited only once the sender's own scan has reached its block; until then the default's range is retried.
  - The credit and the marking of the deposits it covers (`topup`, `acknowledged: true`) commit together. The marking is a compare-and-set, so two moves never credit the same deposit.
  - When a wallet becomes the default, its recorded deposits that are uncredited and not dismissed are credited where they sit, one top-up each, keyed by their own `Transfer` log.
- **Index:** `BalanceTransactions` has a partial index on `(metadata.blockchain_tx, account)` for `payment` rows, which serves the scan's payment lookup.
- **`ArchivedWalletDeposit`** gains `sender_address` and `topup` (both FiatDesk extensions, documented on Balance details). Alerts recorded before this task have no sender and count as external deposits.
- **Docs:** Balance details (the new fields, and what a move to the default credits), the shared "Changing your platform wallet" section, Fund the platform wallet, and the top-up `reversed` status.
- **Tests:**
  - `PaymentLedger.spec` covers idempotency, reversing the scan's top-up, debiting a move that carried a payment, the scan refusing a transaction already paid, and another platform's top-ups being left alone.
  - `TopUpMonitor.spec` covers payment skips, moves with and without uncredited deposits, repeated scans, the block and amount limits, waiting for the sender's scan, and crediting at a wallet that became the default. Watched wallets are now scanned first.
  - No Anvil spec was added, and `api:test-anvil` was not run: the cloud session that wrote this task could not download `solc`. Run it before merging.

Added:

```
apps/api/src/modules/PaymentLedger.ts
apps/api/src/__tests__/PaymentLedger.spec.ts
```

Modified:

```
apps/api/src/modules/ArchivedWalletDeposits.ts
apps/api/src/modules/CheckoutPayment.ts
apps/api/src/modules/Database.ts
apps/api/src/modules/Invoice.ts
apps/api/src/modules/TopUp.ts
apps/api/src/modules/TopUpMonitor.ts
apps/api/src/__tests__/TopUpMonitor.spec.ts
apps/docs/src/app/pages/docs/data/balance.ts
apps/docs/src/app/pages/docs/data/fund-platform-wallet.ts
apps/docs/src/app/pages/docs/data/shared.ts
apps/docs/src/app/pages/docs/data/top-ups.ts
apps/web/src/app/features/account/components/archived-deposit-banner/archived-deposit-banner.component.spec.ts
libs/shared-types/src/lib/Balance.ts
```

## Task 17d: Repository placeholders and the README setup guide

- **Repository placeholders.** `OWNER/REPO` became `fiatdesk/payment-processor` in:
  - the root, CLI and Node SDK `package.json` repository links;
  - the issue-template links;
  - the Node SDK README;
  - the self-hosting and deployment docs (which now `cd payment-processor`);
  - `CONTRIBUTING.md`'s fork clone;
  - the docs site's GitHub star counter, whose placeholder guard is removed.
- **Old-name sweep.** Nothing left to remove. The remaining "Zoneless" mentions are required or are not the brand: the `LICENSE`, `NOTICE` and `CHANGES.md` attribution, the README fork notice, the license header on modified files, Angular's own `provideZonelessChangeDetection` / `setupZonelessTestEnv`, the `zoneless-v1` HKDF salt (renaming it would break every stored encrypted secret), and the fixtures of `scripts/rebrand.spec.sh`.
- **README setup guide.** The Quick start clones the real repository and says it runs on simulated funds. A new "Setup guide" covers:

  1. choosing a mode (simulated, Sepolia, Anvil, mainnet);
  2. the RPC endpoint;
  3. the four accounts (platform wallet, checkout relayer, subscription operator, deployer): where each key lives and what it holds;
  4. deploying `PayoutBatch` and `Subscriptions`;
  5. funding on Sepolia and mainnet;
  6. running `/setup`;
  7. scheduling deposit checks and billing.

  It ends with the audit and operator-obligation notes from going live.

Modified:

```
.github/ISSUE_TEMPLATE/config.yml
CONTRIBUTING.md
README.md
apps/cli/package.json
apps/docs/src/app/pages/docs/data/deployment.ts
apps/docs/src/app/pages/docs/data/self-hosting.ts
apps/docs/src/app/services/github.ts
package.json
sdks/node/README.md
sdks/node/package.json
```

## Positioning and screenshots

- **Tagline.** "Stablecoin payment processing platform" replaces "Stablecoin settlement for high-risk businesses" in the README, the dashboard and docs `<title>`/description/Open Graph tags, the docs page description, and their specs.
- **README.**
  - A new header with badges, quick links and a dashboard screenshot.
  - A "Why FiatDesk" list.
  - A product tour (hosted checkout, payments, subscriptions, marketplaces, API reference) that replaces the old feature list.
- **Screenshots.** `docs/screenshots/*.webp` were captured from a local simulated-rail instance seeded with demo data ("Northwind Market"). Nothing in them is real.
- **Upstream residue removed.**
  - The docs header's Discord link pointed to the original project's server; it is removed, with its icon and style.
  - The four unreferenced upstream docs screenshots under `apps/docs/src/assets/images/screenshots/` are deleted. They showed PromptBase and Solana.

Added:

```
docs/screenshots/checkout.webp
docs/screenshots/dashboard-connected-accounts.webp
docs/screenshots/dashboard-home.webp
docs/screenshots/dashboard-payments.webp
docs/screenshots/dashboard-subscriptions.webp
docs/screenshots/docs-api.webp
```

Deleted:

```
apps/docs/src/assets/images/logos/discord.svg
apps/docs/src/assets/images/screenshots/
```

Modified:

```
README.md
apps/docs/src/app/pages/docs/docs.html
apps/docs/src/app/pages/docs/docs.scss
apps/docs/src/app/pages/docs/docs.ts
apps/docs/src/index.html
apps/docs/src/index.spec.ts
apps/web/src/index.html
apps/web/src/index.spec.ts
```
