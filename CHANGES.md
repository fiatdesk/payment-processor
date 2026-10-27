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
