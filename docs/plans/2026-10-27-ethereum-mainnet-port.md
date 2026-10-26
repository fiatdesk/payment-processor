# Ethereum Port Implementation Plan (Sepolia first, mainnet human-gated)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Tasks are headed `### Task N: <name>` and numbered globally so a script can extract one task at a time. Every task ends with the full test suite green. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Solana settlement rail of this Stripe-compatible payments platform with Ethereum (Sepolia for everything executed here; mainnet chainId 1 stays the configured live-mode target but is never deployed to or funded by any task), keep the self-custody model, cut all ties to upstream infrastructure and branding, and stay Apache-2.0 compliant as a derivative work.

**Architecture:** The API already routes every chain operation through `GetSettlement()` in `apps/api/src/modules/chains/Settlement.ts`, but the seam is a TypeScript union (`Solana | SimulatedSettlement`) whose Solana-shaped return values leak into shared-types, the web app, the SDK and the docs. The port first hardens that seam into a chain-neutral `Settlement` interface while Solana still runs (so the suite stays green), then swaps the rail for an `Ethereum` class built on viem, then ports each money flow (payouts, top-ups, checkout, subscriptions) one at a time, each verified against a local Anvil chain with mock USDC and against the existing `simulated` rail. Two small Solidity contracts (`PayoutBatch`, `Subscriptions`) replace Solana-native batching and the `@solana/subscriptions` program. Rebranding is centralised behind one constant plus a script so the name can be flipped when chosen.

**Tech Stack:** TypeScript (Nx 22, Express 4, Angular 20, Jest 29, Zod 4), viem 2.x (only new npm dependency), Foundry 1.5.1 (forge/anvil/cast, installed), Solidity 0.8.28, OpenZeppelin Contracts v5.1.0, MongoDB 7 via docker-compose (Colima).

**Spec:** There is no separate spec file. The brief and the decisions already taken are reproduced in §0 of this document; the findings it argues from are in §2. Executors read this file only.

**Branch:** `eth-sepolia-port`. **Baseline:** `npx nx run-many --target=test --all` passes 6 projects / 611 tests on Node v22.23.2 (`.nvmrc` says 20; do not change it). Dependencies are installed.

---

## 0. Brief (decisions already made — do not reopen)

1. Ethereum only. Remove all Solana code, dependencies, docs, the Anchor program and mocks. No multi-chain abstraction beyond what is cheap to keep.
2. Keep the Apache-2.0 license. This is an independent fork with no upstream ties (the `origin` remote is already removed).
3. Self-custody: the platform never holds the operator's treasury key. The operator's platform wallet signs payouts. Two server-held *operational* keys already exist upstream and are kept with the same role: the subscription puller (`SUBSCRIPTION_OPERATOR_KEY`) and the optional checkout fee sponsor (becomes `CHECKOUT_RELAYER_KEY`). Neither can move treasury funds.
4. Execution constraints (coordinator update): Sepolia (11155111) plus a local Anvil chain for automated tests; mainnet (1) is configured but **no task deploys to mainnet or needs mainnet funds**; every executed task is verifiable without real funds; everything that needs a funded Sepolia key, a deployment or a real RPC key is grouped into Task 18; mainnet deployment and the audit are Task 19, marked NOT EXECUTED — human-gated.
5. Conventions from `AGENTS.md` / `CONTRIBUTING.md` apply: small focused commits with tests; docs and the Node SDK change in the same task as the API surface; Stripe-shaped API; PascalCase functions, camelCase variables; Zod for request validation; no new dependency unless the work cannot be done with what is here (viem is the one exception, replacing nine Solana packages).

---

## 1. Global Constraints

Every task and every reviewer applies these. Values are exact.

**Chains and addresses**

| Item | Value | Status |
| --- | --- | --- |
| Live mode (`LIVEMODE=true`) chain | Ethereum mainnet, chainId `1` | configured only; never deployed/funded in this plan |
| Test mode on-chain (`LIVEMODE=false`, `SETTLEMENT_RAIL=onchain`) chain | Sepolia, chainId `11155111` | Task 18 only touches a real RPC |
| Automated integration tests | Anvil, chainId `31337` (set `ETH_CHAIN_ID=31337`, allowed only when `LIVEMODE=false`) | every executed task |
| USDC mainnet | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | verified on Circle's "USDC contract addresses" page during planning |
| USDC Sepolia | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | verified on the same Circle page |
| USDC Anvil | `MockUSDC` deployed by the test harness; address injected via `USDC_ADDRESS` | created in Task 7 |
| USDC decimals | `6` on every chain. Cents to atomic units is `BigInt(amountCents) * 10_000n` (same arithmetic the Solana code used). | decimals not stated on the Circle page; the `Ethereum` client asserts `decimals() == 6` once at startup in on-chain mode and Task 18 confirms on Sepolia |
| USDC EIP-712 domain | `name` read from the token's `name()`, `version` `"2"`, `chainId`, `verifyingContract` = token address | FiatTokenV2 convention; Task 18 verifies `DOMAIN_SEPARATOR()` matches on Sepolia |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` (reads only; never approved for token spending) | from memory, fetch of multicall3.com failed during planning — verify in Task 18 |
| Chainalysis sanctions oracle (mainnet) | `0x40C57923924B5c5c5455c48D93317139ADDaC8fb`, `isSanctioned(address) view returns (bool)` | from memory — verify in Task 19; overridable via `SANCTIONS_ORACLE_ADDRESS` |
| Anvil default accounts | #0 deployer `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`, #1 platform wallet, #2 buyer, #3 checkout relayer, #4 subscription operator (standard Anvil mnemonic keys; public test keys) | |
| Explorer URLs | `https://etherscan.io/{tx|address}/…` (1), `https://sepolia.etherscan.io/…` (11155111), `''` (31337 and simulated) | |

**Toolchain and versions**

| Item | Value |
| --- | --- |
| viem | `^2` — the only new npm dependency; add once to root `package.json`, `sdks/node/package.json`, `apps/cli/package.json`; record the resolved version in `CHANGES.md` |
| Foundry | 1.5.1 (installed). `foundry.toml`: `solc = "0.8.28"`, `evm_version = "cancun"`, `optimizer = true`, `optimizer_runs = 200` |
| forge-std | `foundry-rs/forge-std@v1.9.4` |
| OpenZeppelin | `OpenZeppelin/openzeppelin-contracts@v5.1.0` (`SafeERC20`, `IERC20`, `IERC20Permit`, `EIP712`, `ECDSA`, `ERC20Permit` for the mock) |
| Node | v22.23.2 at runtime; `.nvmrc` stays `20` |
| Removed packages | `@solana/kit`, `@solana/kit-plugin-rpc`, `@solana/kit-plugin-signer`, `@solana/spl-token`, `@solana/subscriptions`, `@solana/web3.js`, `@solana-mobile/mobile-wallet-adapter-protocol`, `bs58`, `@types/bs58`, `@wallet-standard/app` (root, SDK and CLI `package.json`); `npm install` is run by the implementer of Task 6 to refresh `package-lock.json` |

**Environment variables (final set)**

| Variable | Meaning | Default |
| --- | --- | --- |
| `ETH_RPC_URL` | Comma-separated JSON-RPC URLs; first is primary, rest are fallbacks | required when `SETTLEMENT_RAIL=onchain` |
| `ETH_CHAIN_ID` | Override, honoured only when `LIVEMODE=false` (Anvil) | `1` if `LIVEMODE=true`, else `11155111` |
| `ETH_CONFIRMATIONS` | Blocks to wait before a tx counts as settled (checkout, payouts, top-ups) | `2` |
| `USDC_ADDRESS` | Override of the per-chain USDC address (Anvil) | per-chain table |
| `PAYOUT_BATCH_ADDRESS`, `SUBSCRIPTIONS_ADDRESS` | Override of deployed contract addresses | per-chain table in `apps/api/src/modules/chains/contracts.ts` (Sepolia filled in Task 18, mainnet `null`) |
| `CHECKOUT_RELAYER_KEY` | Replaces `TRANSACTION_FEE_PAYER_KEY`. `0x` + 64 hex. Pays gas to relay EIP-3009 checkout authorizations and subscription subscribe calls | required for on-chain checkout |
| `SUBSCRIPTION_OPERATOR_KEY` | Same name as upstream, new format `0x` + 64 hex. Owns on-chain plans and calls `charge` | required for recurring prices |
| `SANCTIONS_ORACLE_ADDRESS` | Override for the sanctions oracle | per-chain table |
| `CHECKOUT_CONFIRM_TIMEOUT_MS` | How long `/confirm` waits for confirmations before returning `payment_pending` | `90000` |
| Removed | `SOLANA_RPC_URL`, `TRANSACTION_FEE_PAYER_KEY`, `ZONELESS_TELEMETRY` | |
| Unchanged | `LIVEMODE`, `SETTLEMENT_RAIL` (`simulated` default in test mode, `onchain` otherwise), `TOPUP_MONITOR_ENABLED`, `TOPUP_POLL_INTERVAL_MS`, `BILLING_MONITOR_ENABLED`, `BILLING_POLL_INTERVAL_MS` | |

Private-key env values must match `/^0x[0-9a-fA-F]{64}$/`; `AppConfig` throws at startup otherwise.

**Naming and data rules**

- Addresses: accept any input that passes viem `isAddress(value)` (all-lowercase, all-uppercase, or correctly checksummed mixed case; wrong checksum is rejected). Store and return EIP-55 via `getAddress(value)`. Never store lowercase.
- Transaction identifiers are `transaction_hash` (`0x` + 64 hex) everywhere the API, DB, SDK, web or docs previously said `signature`, `blockchain_tx` stays as the metadata key name (chain-neutral) but holds a hash.
- On-chain ids: `Price.subscription_plan_id` and `Subscription.subscription_onchain_id` (both `bytes32` hex strings). The `_pda` names are gone after Task 5.
- Fee fields: `estimated_fee` (string, atomic units of `fee_currency`), `fee_currency` (`'eth'` | `'none'`), never `*_lamports`.
- Internal TS types stay camelCase (`transactionHash`, `logIndex`); API JSON stays snake_case.
- `Settlement` is the interface name (`apps/api/src/modules/chains/Settlement.ts`); `Ethereum` is the on-chain class (`apps/api/src/modules/chains/Ethereum.ts`); `SimulatedSettlement` is unchanged. Module fields are named `settlement`, not `solana`.
- No new code may contain the strings `solana`, `lamport`, `bs58`, `base58`, `Phantom`, or new occurrences of `zoneless` (existing identifiers stay until Task 17). Grep gates are listed per task.
- `<NEWNAME>` policy: the final name is not chosen. Code and docs keep `Zoneless`/`zoneless` until Task 17 centralises them and Task 19 flips them with `scripts/rebrand.sh`. The literal placeholder `<NEWNAME>` may appear only in `NOTICE`, `CHANGES.md` and this plan. The brand id infix stays `z` (`po_z_…`, `sk_live_z_…`) until the flip.
- Commits: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`), one commit per task unless a task says otherwise, each ending with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Gates at the end of every task: `npx nx run-many --target=test --all` green, `npm run format:check` clean, `npx nx run-many --target=lint --all` clean. Tasks that add Anvil tests also run `npx nx run api:test-anvil`.
- Nothing in Tasks 1–17 and 19 may contact a public RPC, require ETH or USDC, or deploy to a public network. Only Task 18 does.

---

## 2. What the code does today (verified findings)

**The seam.** `GetSettlement()` returns `IsSimulatedSettlement() ? new SimulatedSettlement() : new Solana()`. `Settlement` is `type Settlement = Solana | SimulatedSettlement` — duck-typed by method name, not an interface. Six modules use it (`Balance.ts`, `CheckoutPayment.ts`, `Invoice.ts`, `Payout.ts`, `Price.ts`, `TopUpMonitor.ts`); `CheckoutPayment` and `Invoice` accept an injected `Settlement`. Four more files import directly from `./chains/Solana` for `SolanaExplorerUrl` and `IncomingDeposit` (`CheckoutPayment.ts:22`, `Invoice.ts:23`, `TopUp.ts:29`, `TopUpMonitor.ts:26`, `routes/config.routes.ts:24`). Solana shapes leak outward: `estimated_fee_lamports`, `blockhash`, `last_valid_block_height`, `min_context_slot` (shared-types `Payout.ts:141-146`, web `checkout-session.service.ts:16-20`, SDK `generated/Inputs.ts`), `subscription_plan_pda` (`Price.ts:100`), `subscription_delegation_pda` (`Subscription.ts:233`), `payment_details.transaction_signature` (`CheckoutSession.ts:473`), `merchant_wallet.usdc_mint` (`CheckoutSession.ts:492`), `solana_public_key` (`Config.ts:113,133`), `DepositInfo.network: 'solana'` (`Config.ts:147`), `wallet_sol` (`Balance.ts:235` area), literal `network: 'solana'` / `gas_fee_currency: 'sol'` in `Payout.ts`, `TopUp.ts`, `Charge.ts:284,404`, `CheckoutPayment.ts:1035`, `Invoice.ts:1397`, `ExternalWallet.ts:140`, `Setup.ts:138`, `config.routes.ts:171`. Verdict: the seam is good enough to port behind, but the API surface must be made chain-neutral first (Tasks 4–5) or the swap touches ~120 files at once.

**The in-repo Anchor program is dead code.** `apps/programs/src/lib.rs` (program id `9JAVCcRBhZz4…`) has no `project.json`, no `Anchor.toml`/`Cargo.toml`, and the id is referenced nowhere else. The API actually drives the external `@solana/subscriptions` package (Plan PDA, SubscriptionAuthority PDA, SubscriptionDelegation PDA, `createPlan`, `subscribe`, `transferSubscription`, error `#400 exceeds period limit` mapped to `alreadyCollected`). `lib.rs` is still useful as the semantic reference for the Solidity port (first charge due immediately; `next_charge_at += period`; resume pushes `next_charge_at = now + period`; subscriber or merchant may cancel/pause).

**Checkout binding.** `BuildCheckoutPaymentTransaction` builds `transferChecked(payer ATA → merchant ATA)` plus an SPL Memo whose bytes are the checkout session id. `VerifyCheckoutPayment` requires the memo to equal `session.id` and the transferred amount to be ≥ `amount_total`; the payer is the transfer authority. Replay protection is `GetCheckoutSessionByTransactionSignature` (DB lookup on `payment_details.transaction_signature`). Fee sponsorship: when `TRANSACTION_FEE_PAYER_KEY` is set the API partial-signs as fee payer, the buyer co-signs, and the API validates and broadcasts (`ValidateSponsoredCheckoutTransaction`). Subscription checkout is two wallet approvals for first-time wallets (`init_authority`, then `subscribe`).

**Top-up detection.** `GetIncomingDeposits` lists signatures for the platform wallet's USDC ATA, fetches each parsed transaction (2 s sleep between RPC calls), and extracts `spl-token` transfers to that ATA. Deduplication is `TopUps.metadata.blockchain_tx`. Any deposit to the platform wallet is credited; there is no per-deposit binding. `POST /v1/topups/check-deposits` is the on-demand path (limit 1); the poller is off by default.

**Payouts.** `BuildPayoutsBatch` → `BuildBatchPayoutTransaction` (≤ `MAX_BATCH_RECIPIENTS = 10`, legacy tx, fee payer = platform wallet, idempotent ATA creates) → client signs (SDK `sign()` = `Transaction.from().partialSign(keypair)`; dashboard signs with a wallet-standard wallet or a pasted secret key) → `BroadcastPayoutsBatch` sends, polls confirmation for ~30 s, marks all payouts `paid` or **marks them `failed` and refunds balances on timeout**. The `blockhash`/`last_valid_block_height` fields that the SDK passes to `broadcast` are never read by `BroadcastPayoutsBatch` (dead fields).

**Subscriptions.** `Price.CreatePrice` (recurring) calls `CreateSubscriptionPlan` with `SUBSCRIPTION_OPERATOR_KEY` as both plan owner and puller and the platform wallet as destination, storing `subscription_plan_pda`. Checkout subscribe stores `subscription_delegation_pda`. `SubscriptionBilling.Run` → `Invoice` → `CollectSubscriptionPayment` signed server-side by the operator key; `BillingMonitor` (poller) or `POST /v1/billing/run*` is the crank.

**Sanctions.** `SanctionsScreening.ts` is a placeholder: an empty hardcoded `Set`, `source: 'OFAC SDN List'`, called only from `ExternalWalletModule.CreateExternalWallet`.

**Web.** `SolanaWalletService` (`@wallet-standard/app` + Solana Mobile Wallet Adapter), `utils/validation/solana.ts` (base58 regex), setup wizard generates a keypair in the browser via `@solana/web3.js` and shows the secret once, checkout deep-links to Phantom/Solflare/Backpack, `wallet-guide` component is a Phantom tutorial, `connected-account-actions.service.ts` signs payouts with wallet or pasted secret key, `add-funds-panel` links `faucet.solana.com`, setup page claims "Near-zero fees — fractions of a cent per payment".

**Tests.** `apps/api/jest.config.ts` maps `chains/Solana` to `__tests__/mocks/Solana.ts` and excludes `Solana.ts` from ts-jest diagnostics (Kit package exports broke the suite). `Payout.spec.ts` mocks `chains/Settlement`; `CheckoutPayment.spec.ts` injects a `jest.Mocked<Solana>`; `Settlement.spec.ts` tests the simulated rail; `Solana.spec.ts` tests `ValidateSponsoredCheckoutTransaction`.

**Upstream infrastructure ties (file paths).**

- Telemetry phone-home: `apps/api/src/modules/Telemetry.ts:55` (`TELEMETRY_URL = 'https://zoneless.com/api/telemetry'`), `TelemetryMonitor.ts`, `routes/telemetry.routes.ts`, `routes/index.ts:38,102`, `main.ts:30-32,219-220,259-261`, `modules/Database.ts`, `modules/Setup.ts` (`telemetry_enabled`), `libs/shared-types/src/lib/{Telemetry,Config,Operator,index}.ts`, web `data/services/telemetry.service.ts` + `index.ts`, `features/account/settings/settings.component.{html,scss,ts}`, `features/setup/setup.component.{html,scss,ts}`, `.env.example`, `.env.production.example`, `AGENTS.md`, `SECURITY.md:54`, `TELEMETRY.md`, docs `environment-variables.ts`.
- CLI hosted provisioning against upstream's cloud: `apps/cli/src/app/AgentSetup.ts:17-19` (`defaultAuthUrl = 'https://us-central1-zoneless-app.cloudfunctions.net/Actions'`, `defaultActivationUrl = 'https://zoneless.com/activate'`), `WebhookSync.ts:146-147` (`dashboard(-test).zoneless.com`), `AgentSetup.spec.ts:100,205`, `Cli.spec.ts:705-746`, `EnvSync.spec.ts:50-120`, `WebhookSync.spec.ts:88,147`, `apps/cli/README.md:126-128`, `apps/cli/package.json` (repo/homepage).
- Web: `shared/forms/identity-settings-form/didit-webhook-url.ts:5-6` (maps `dashboard.zoneless.com` → `api.zoneless.com`), `features/account/settings/settings.component.html:175`, `features/setup/setup.component.html:128`, `features/onboard/onboard.component.html:35`, `features/account/products/views/price-detail/price-detail.component.html:143,221`, `core/services/wallet.service.spec.ts:72,89,120`.
- API: `apps/api/src/main.ts:129` (docs link).
- Docs app: `apps/docs/scripts/generate-agent-docs.ts:13,35`, `src/app/pages/docs/docs.html:26,61,121`, `docs.ts:176-177`, `services/github.ts:10` (`zonelessdev/zoneless`), `services/meta.ts:49` (`@zonelessdev`), `components/agent-prompt-cta/agent-{marketplace,payments}-prompt.ts`, plus 15 data pages containing `zoneless.com` (`authentication`, `api-quickstart`, `agent-*-quickstart`, `migrate-from-stripe`, `marketplace-quickstart`, `webhooks`, `quickstart`, `identity-verification`, `fund-platform-wallet`, `errors`, `build-a-marketplace`, `shared`, `platform-dashboard`, `environment-variables`).
- Repo metadata: `package.json:5-13`, `sdks/node/package.json` (`@zoneless/node`, `publishConfig.access: public`, keywords `solana`), `apps/cli/package.json` (`@zoneless/cli`, bin `zoneless`, `publishConfig`), `README.md` (all links, screenshots served from `docs.zoneless.com`, "built for PromptBase" claim, Discord), `CONTRIBUTING.md:9-64` (Discord, issues, `git remote add upstream`), `SECURITY.md:42`, `.github/ISSUE_TEMPLATE/config.yml` (links to `github.com/zoneless/zoneless`), `.env.example:14,19`, `libs/shared-types/src/lib/Config.ts:13-22`, `libs/shared-schemas/src/lib/{BillingSchema,EventSchema,TopUpSchema}.ts` `@see` links, `sdks/node/src/resources/*.ts` `@see` links, `sdks/node/README.md`, `.agents/skills/zoneless-{marketplace,payments}/SKILL.md` (`api(-test).zoneless.com`, `dashboard(-test).zoneless.com`, `docs.zoneless.com/llms.txt`), `docker-compose.yml` (container/network/db names only; no remote endpoints).
- CI: `.github/workflows/ci.yml` has no upstream secrets or publish step; it needs a Foundry step added (Task 7). No npm publish workflow exists; publishing is manual via `nx run node-sdk:pack` / `cli:pack`.
- Connected-account header: `apps/api/src/middleware/Authorization.ts:266-269` default `'zoneless-account'` (also `balance.routes.ts:49`, `balanceTransactions.routes.ts:38`).

---

## 3. Review Focus

Failure modes the brief implies but no existing test covers. Each line names the task that must add the pinning test.

1. **Payout receipt timeout must not refund.** On Ethereum a transaction that has not been mined within the wait window can still be mined later. If `BroadcastPayoutsBatch` keeps today's behaviour (timeout → `failed` → refund balance) the platform pays twice. Expected: timeout leaves payouts `in_transit` with `transaction_hash` stored; a later reconcile marks `paid` or, only when the nonce was consumed by a different hash, `failed` + refund. Test in Task 8.
2. **Two USDC `Transfer` logs to the platform wallet in one transaction must create two top-ups.** Deduplicating on `transaction_hash` alone silently drops the second deposit. Expected: dedupe key is `transaction_hash` + `log_index`. Test in Task 10.
3. **A checkout authorization whose nonce is not `keccak256(session.id)` or whose `to` is not the merchant wallet must be rejected at confirm**, even if a valid USDC transfer of the right amount happened. Test in Task 11.
4. **A USDC-blacklisted recipient must fail cleanly.** The batch call reverts; the payout must end `failed` with `failure_code: 'account_frozen'` and the balance refunded (safe: a reverted receipt is final). Build must also refuse blacklisted recipients up front. Test in Task 8.
5. **Concurrent `payouts/build` calls for the same platform wallet must not reuse a nonce.** The second call must fail with `payout_batch_in_progress` while a built or broadcast batch is outstanding. Test in Task 8.

---

## 4. Design

### 4.1 Concept mapping, Solana → Ethereum

| Solana (today) | Ethereum (this plan) | Consequence in code |
| --- | --- | --- |
| ed25519 keypair, base58 public key (32–44 chars), base58 secret key | secp256k1 EOA, 20-byte address written EIP-55 (`0x` + 40 hex), private key `0x` + 64 hex | `ExternalWalletSchema`, `Setup.ts`, web `utils/validation`, CLI `GenerateWallet`, setup wizard keygen, `SimulatedSettlement.CheckWalletExists` |
| SPL USDC mint + per-owner Associated Token Account (rent, idempotent create) | ERC-20 USDC contract; balance keyed by address; no account creation, no rent | drop every `createAssociatedTokenAccountIdempotent` path; `GetUSDCBalance` = `balanceOf`; `GetSOLBalance` → `GetNativeBalance` (`eth_getBalance`) |
| SOL fees (~5000 lamports), fee payer field, `recentBlockhash` + `lastValidBlockHeight` expiry, `minContextSlot` | EIP-1559: `maxFeePerGas`, `maxPriorityFeePerGas`, `gasLimit`, per-account `nonce`; txs do not expire; replacement = same nonce with ≥ 10 % higher fees; a pending tx can be dropped from mempools and later re-included | payout build stores `nonce` and returns fee params; broadcast timeout keeps `in_transit`; `replace: true` rebuild for stuck batches; §4.3 |
| Multiple signers per tx (buyer + fee payer partial-sign) | One signer per tx. Gas sponsorship = relayer submits a tx that carries the buyer's **off-chain EIP-712 signature** (EIP-3009 for USDC, EIP-2612 permit, our own typed data for subscribe) | checkout and subscribe become "sign typed data, API relays" (§4.4, §4.6) |
| `confirmed` (~400 ms) / `finalized` (~13 s) commitments | 12 s blocks; `latest`, `safe` (~6 min), `finalized` (~13 min). Single-block reorgs are rare post-merge but possible; deep reorgs practically do not happen under finality | `ETH_CONFIRMATIONS` (default 2 ≈ 24 s) for all flows; top-up scanning only reads up to `latest - ETH_CONFIRMATIONS` |
| Memo instruction binds a payment to a session | EIP-3009 `nonce` (bytes32) = `keccak256(utf8(session.id))`; `AuthorizationUsed(authorizer, nonce)` event proves it on-chain and makes replay impossible at the token level | `VerifyCheckoutPayment` decodes receipt logs instead of parsed instructions (§4.4) |
| `getSignaturesForAddress(ATA)` for deposits | `eth_getLogs` filtered on USDC `Transfer(address indexed from, address indexed to, uint256)` with `to = platform wallet`, scanned by block ranges with a persisted cursor | `TopUpMonitor`, new `ChainCursors` collection (§4.5) |
| Devnet + `SETTLEMENT_RAIL=simulated` | Sepolia + the same `simulated` rail (unchanged, still the test-mode default) + Anvil for automated tests | `AppConfig.ResolveSettlementRail` unchanged; chain id derives from `LIVEMODE` |
| `@solana/subscriptions` program (plans, delegations, period-limited pulls) | `Subscriptions.sol`: plan registry + allowance-based pull with one charge per period, cranked by the operator key | §4.6 |
| Explorer `explorer.solana.com` | Etherscan / Sepolia Etherscan | `ExplorerUrl` moves to `Settlement.ts` and reads the rail |

### 4.2 Library and tooling

- **viem** for all TypeScript (API, SDK, CLI, web). One dependency replaces nine: typed ABIs, `signTypedData`, `serializeTransaction`/`parseTransaction` for the unsigned-tx hand-off, `getLogs`/`decodeEventLog` for verification, `fallback([http(), http()])` transport for RPC redundancy, `custom(provider)` for EIP-1193 wallets in the browser, `privateKeyToAccount` for local signing, `isAddress`/`getAddress` for validation, `foundry`/`sepolia`/`mainnet` chain objects. Isomorphic, tree-shakeable, no polyfills in Angular. ethers would do the same with a larger bundle and no `as const` ABI typing; web3.js needs Node polyfills.
- **No wallet aggregator library.** EIP-6963 discovery is two DOM events (`eip6963:requestProvider` / `eip6963:announceProvider`); the plan implements it in `WalletService` directly. WalletConnect is deferred (Open decision 9) — it pulls a large SDK and a project id.
- **Foundry** for contracts: `forge test` (fuzz + invariants), `forge script` for Sepolia deployment, `anvil` for the Jest integration suite, `cast` for Task 18 checks. Contracts live in `contracts/` at the repo root (Foundry layout: `src/`, `test/`, `script/`, `lib/`), wired into Nx as project `contracts` with `build` and `test` run-commands so `nx run-many --target=test --all` covers them.
- **Jest integration against Anvil** lives in `apps/api/src/__tests__/anvil/*.anvil.spec.ts`, run by a second Jest config (`apps/api/jest.anvil.config.ts`) through Nx target `api:test-anvil` (depends on `contracts:build`). The default `api:test` ignores `*.anvil.spec.ts`, so unit tests never need forge. The harness spawns `anvil` on a free port, deploys `MockUSDC`, `PayoutBatch` and `Subscriptions` from `contracts/out/*.json` with Anvil account #0, and tests the real `Ethereum` class with no Mongo.

### 4.3 Payouts: how to batch from an EOA

The flow to preserve: `POST /v1/payouts/build` → unsigned payload → operator signs locally (SDK with a private key, or dashboard with a browser wallet) → `POST /v1/payouts/broadcast` → payouts `paid`/`failed`.

| Option | How | Verdict |
| --- | --- | --- |
| **A. `PayoutBatch` contract** — `disperse(token, recipients[], amounts[], batchId)` loops `safeTransferFrom(msg.sender, recipient_i, amount_i)`; platform EOA approves the contract once | One tx per batch, atomic (all-or-nothing), works with every signer type (`eth_sendTransaction` from a browser/hardware wallet, raw signing in the SDK). Stateless, ownerless, non-upgradeable: it can only move `msg.sender`'s own tokens, so a standing allowance to it is exercisable only by the platform wallet itself. ~50 k gas marginal per recipient. One small contract to review (the Disperse.app pattern). | **Recommended.** |
| B. Multicall3 + `transferFrom` | Approve Multicall3, then `aggregate3([USDC.transferFrom(platform, r_i, a_i)…])` | **Unsafe.** Multicall3 is permissionless: once the platform approves it, anyone can call `aggregate3` with `transferFrom(platform, attacker, …)` because `msg.sender` inside USDC is Multicall3, which holds the allowance. Multicall3 is used only for batched *reads* (balances, allowance, blacklist flags). |
| C. EIP-7702 | Platform EOA delegates to a batch-executor contract once (type-4 tx), then calls `execute([USDC.transfer(r_i, a_i)…])` from itself — no allowance, direct `transfer` (~45 k marginal) | Cleanest trust model and cheapest per recipient, but: injected wallets only sign 7702 authorizations for their own delegator contracts, hardware-wallet support is uneven, and it changes the platform EOA's code permanently (revocable). Keep as a later optimisation (Open decision 1). |

Design details for A (Task 7–8):

- `contracts/src/PayoutBatch.sol`: `function disperse(IERC20 token, address[] calldata recipients, uint256[] calldata amounts, bytes32 batchId) external` with `LengthMismatch()`, `EmptyBatch()`, `TooMany()` (cap 200) custom errors and `event BatchPaid(address indexed payer, address indexed token, bytes32 indexed batchId, uint256 count, uint256 total)`. No owner, no state, no ETH handling.
- `MAX_BATCH_RECIPIENTS` becomes `100` (≈ 5.1 M gas, well under the block limit); `BuildPayoutsBatchSchema`/`BroadcastPayoutsBatchSchema` `.max(100)`; SDK `processBatch` limit 100.
- `batchId = keccak256(sorted payout ids joined by ',')`, returned by build, stored on the batch record and emitted on-chain, so a receipt can be tied back to its payouts during reconcile.
- Allowance: `build` reads `allowance(platform, PayoutBatch)`; if `< total` it returns `transaction_type: 'approval'` with an unsigned `approve(PayoutBatch, MaxUint256)` tx and `payouts: []`; the client signs/broadcasts that, then calls `build` again. One-time per wallet.
- Nonce lock: new internal collection `PayoutBatches` (`id` prefix `pob`, `platform_account`, `wallet_address`, `chain_id`, `nonce`, `batch_id`, `payouts[]`, `transaction_type`, `status: built|broadcast|paid|failed|replaced`, `transaction_hash`, `created`). `build` refuses while a batch for the same wallet is `built` or `broadcast` unless `replace: true` (same nonce, fees × 1.125). Nonce comes from `getTransactionCount(wallet, 'pending')`.
- Fees: `gas_limit = estimateGas × 1.2`, `max_priority_fee_per_gas` from `eth_maxPriorityFeePerGas`, `max_fee_per_gas = 2 × baseFee + priority`, `estimated_fee = gas_limit × max_fee_per_gas` (upper bound, wei string).
- `broadcast` accepts either `signed_transaction` (raw signed tx hex; API calls `eth_sendRawTransaction`) or `transaction_hash` (the wallet already broadcast via `eth_sendTransaction`). It waits for `ETH_CONFIRMATIONS` up to 60 s. Receipt `status: 1` → `paid`; `status: 0` → `failed` + refund (map revert data `Blacklistable: account is blacklisted` → `account_frozen`, else `blockchain_error`); timeout → stays `in_transit`, `status: 'pending'` in the response.
- Reconcile: `ReconcilePayoutBatches(platformAccountId)` runs at the start of `build` and `broadcast` and via `POST /v1/payouts/reconcile` (platform key). For each `broadcast` batch: receipt present → settle as above; no receipt and `getTransactionCount(wallet,'latest') > nonce` → `replaced` → payouts `failed` + refund; otherwise leave.
- Pre-checks at build: every recipient passes `isAddress`, is not `isBlacklisted` on USDC (multicall), and the platform wallet balance ≥ total; failures are a 400 listing offenders (no state change).

### 4.4 Checkout: binding an on-chain payment to a session

Options considered for a plain `USDC.transfer` that has no memo: (a) CREATE2 per-session deposit forwarder — needs a factory contract, a sweep tx per session (~100 k gas, more than the payment itself on L1) and a 20-byte address per session; (b) amount tagging (unique cents) — collides under load and changes the price; (c) Permit2 — adds a universal approval step and a dependency; (d) log scanning on `from = payer` with amount matching — ambiguous when a payer has two sessions.

**Recommended: EIP-3009 `transferWithAuthorization`, relayed by the API.** USDC implements it natively (FiatTokenV2+). The buyer signs one EIP-712 message `TransferWithAuthorization(from, to, value, validAfter, validBefore, nonce)` with `to = merchant wallet`, `value = amount_total × 10_000`, `validAfter = 0`, `validBefore = session.expires_at`, `nonce = keccak256(utf8(session.id))`. The API (`CHECKOUT_RELAYER_KEY`) submits `transferWithAuthorization(from,to,value,validAfter,validBefore,nonce,v,r,s)`, pays gas, waits for confirmations, and verifies the receipt: a USDC `Transfer(from=payer, to=merchant, value ≥ expected)` log **and** an `AuthorizationUsed(payer, keccak256(session.id))` log from the USDC contract. This is the memo check, enforced by the token itself; an authorization can be used once, and front-running it only means someone else paid our gas for an identical transfer. The buyer needs USDC but no ETH, and every EIP-1193 wallet supports `eth_signTypedData_v4`. Idempotency: `authorizationState(payer, nonce)` on-chain plus the existing DB uniqueness on `payment_details.transaction_hash`.

Consequences: `fee_sponsored` becomes `relayed: true` (always, on-chain); `CHECKOUT_RELAYER_KEY` is required for on-chain checkout (Open decision 2–3); `ValidateSponsoredCheckoutTransaction` and its spec are replaced by pure functions `BuildTransferAuthorizationTypedData` and `VerifyCheckoutReceipt`; `/confirm` body is `{ signature }` (65-byte hex) or, on retry, `{ transaction_hash }`; the API persists `transaction_hash` right after relaying so retries are idempotent, waits up to `CHECKOUT_CONFIRM_TIMEOUT_MS`, and returns a `payment_pending` error (HTTP 409, `code: 'payment_pending'`, `transaction_hash`) if still unconfirmed so the web can poll by retrying confirm with that hash. Smart-contract wallets: FiatTokenV2_2 validates EIP-1271 signatures (believed, not verified here); Task 18 tries a Safe only if time permits (Open decision 11).

### 4.5 Top-ups

Platform wallet address is the deposit address (as today). `GetIncomingDeposits(wallet, cursor)` = `getLogs({ address: USDC, event: Transfer, args: { to: wallet }, fromBlock, toBlock })` in chunks of ≤ 2 000 blocks, `toBlock = latest - ETH_CONFIRMATIONS`, at most 10 chunks per call. Cursor per wallet in a new internal collection `ChainCursors` (`id = wallet.id`, `last_scanned_block`, `updated`); first scan starts at `latest - 1000`. Each log becomes an `IncomingDeposit { transactionHash, logIndex, senderAddress = from, amountCents = value / 10_000n, blockNumber, timestamp = block.timestamp }`. Dedupe key is `(blockchain_tx, log_index)` stored in `TopUp.metadata`. `check-deposits` and the poller keep their endpoints and flags. The dashboard add-funds panel links Circle's faucet (`https://faucet.circle.com`) in test mode and Etherscan for the address.

### 4.6 Subscriptions: `Subscriptions.sol`

Semantics ported from `lib.rs` plus the plan/puller model of `@solana/subscriptions`:

```solidity
struct Plan { address owner; address puller; address destination; IERC20 token; uint256 amount; uint64 periodSeconds; bool active; }
struct Sub  { bytes32 planKey; address subscriber; uint64 nextChargeAt; Status status; } // Status { None, Active, Paused, Canceled }

function createPlan(bytes32 planId, IERC20 token, uint256 amount, uint64 periodSeconds, address destination, address puller) external returns (bytes32 planKey); // planKey = keccak256(msg.sender, planId); 0 < period <= 10 years
function setPlanDestination(bytes32 planKey, address destination) external; // owner only
function setPlanPuller(bytes32 planKey, address puller) external;           // owner only
function deactivatePlan(bytes32 planKey) external;                          // owner only; blocks new subscribes
function subscribe(bytes32 planKey) external returns (bytes32 subId);       // msg.sender pays gas (fallback path)
function subscribeWithAuthorization(bytes32 planKey, address subscriber, uint256 deadline, bytes calldata sig) external returns (bytes32 subId); // relayed; EIP-712 Subscribe(planKey, subscriber, nonce, deadline)
function subscribeWithPermit(bytes32 planKey, address subscriber, uint256 permitValue, uint256 permitDeadline, uint8 v, bytes32 r, bytes32 s, uint256 deadline, bytes calldata sig) external returns (bytes32 subId); // token.permit(...) then subscribeWithAuthorization
function charge(bytes32 subId, uint256 amount) external;  // puller only; Active; now >= nextChargeAt; amount <= plan.amount; nextChargeAt += period; safeTransferFrom(subscriber, destination, amount)
function cancel(bytes32 subId) external;                  // subscriber or plan owner
function pause(bytes32 subId) external;                   // subscriber or plan owner
function resume(bytes32 subId) external;                  // subscriber or plan owner; nextChargeAt = now + period
// subId = keccak256(planKey, subscriber); events PlanCreated, Subscribed, Charged, Canceled, Paused, Resumed; errors NotDueYet, NotActive, Unauthorized, AmountExceedsPlan, InvalidPeriod, InvalidAmount, PlanInactive, AlreadySubscribed, ExpiredSignature, InvalidSignature
```

Mapping: `Price.subscription_plan_id = planKey`; `Subscription.subscription_onchain_id = subId`; `SUBSCRIPTION_OPERATOR_KEY` is the plan owner and puller (unchanged role; pays gas for `createPlan` once per recurring price and for every `charge`); destination = platform wallet (unchanged). `CollectSubscriptionPayment` maps revert `NotDueYet` to `alreadyCollected: true` (replaces `#400`). The Solana `init_authority` step disappears: first-time subscribers sign two typed-data messages (USDC `permit` for the subscriptions contract + our `Subscribe`), relayed in one `subscribeWithPermit` tx; returning subscribers with sufficient allowance sign only `Subscribe`. The web already says "first-time wallets approve twice", so UX parity holds. Allowance size default `MaxUint256` with the contract's per-period `amount` check as the enforced boundary (Open decision 8). Revoking the allowance stops pulls — document it. No admin, no upgradeability, no pause switch: a bug means redeploy and re-subscribe (Open decision 10). **An external audit is required before any mainnet deployment (Task 19).**

### 4.7 Web wallet connection

`WalletService` (replaces `SolanaWalletService`): EIP-6963 discovery with a `window.ethereum` fallback after 300 ms; `Connect()` → `eth_requestAccounts` → checksummed address; `EnsureChain(chainId)` → `wallet_switchEthereumChain` (+ `wallet_addEthereumChain` for Sepolia); `SignTypedData(typedData)` → `eth_signTypedData_v4`; `SendTransaction({ to, data, value })` → `eth_sendTransaction` returning the hash (browser wallets generally do not implement `eth_signTransaction`, so the dashboard payout path broadcasts from the wallet and posts `transaction_hash`); `SignTransactionWithPrivateKey(unsignedTx, privateKey, expected)` for the existing "paste a key" payout path (viem `privateKeyToAccount` + `parseTransaction`, asserting `to`/`chainId`/`from`); `GenerateWallet()` and `GetPrivateKeyAddress()` for the setup wizard. Mobile without an injected provider: deep links into MetaMask (`https://metamask.app.link/dapp/<host+path>`) and Coinbase Wallet (`https://go.cb-w.com/dapp?cb_url=<encoded url>`), replacing the Phantom/Solflare/Backpack list (verify link formats in Task 12). Address validation in the web uses viem `isAddress`; the external-wallet form normalises with `getAddress` before submit.

### 4.8 Sanctions screening

Today: empty static set. Ethereum: OFAC actually lists ETH addresses, and Chainalysis publishes a free on-chain oracle (`isSanctioned(address)`) on mainnet. `SanctionsScreeningModule.CheckWalletAddress` becomes: static set (kept, now EIP-55 addresses) ∪ oracle call when `SANCTIONS_ORACLE_ADDRESS` is configured for the chain; skipped on the simulated rail; RPC failure logs a warning and does not block (Open decision 13). Called where it is today (external wallet creation) plus at payout build for each recipient.

### 4.9 Gas economics (estimates — label them as such in docs)

Assumptions: USDC `transfer` ≈ 45–65 k gas (proxy + first-time recipient costs more), `transferFrom` ≈ +5 k, tx base 21 k, ETH at $3 000 (placeholder), gas price scenarios 1 / 5 / 20 gwei. Solana reference from the brief: ≈ $0.002 per transfer.

| Operation | Gas | 1 gwei | 5 gwei | 20 gwei |
| --- | --- | --- | --- | --- |
| Single payout from an EOA (`transfer`) | ~62 k | $0.19 | $0.93 | $3.72 |
| `PayoutBatch.disperse`, 50 recipients | 21 k + 50 × ~50 k ≈ 2.55 M | $7.65 ($0.15 each) | $38 ($0.77 each) | $153 ($3.06 each) |
| One-time `approve(PayoutBatch)` | ~46 k | $0.14 | $0.69 | $2.76 |
| Checkout relay `transferWithAuthorization` (paid by operator) | ~85 k | $0.26 | $1.28 | $5.10 |
| `Subscriptions.charge` | ~85 k | $0.26 | $1.28 | $5.10 |
| `createPlan` (once per recurring price) | ~120 k | $0.36 | $1.80 | $7.20 |

Batching on L1 saves only the per-tx base cost and one signature: ~15–25 % per payout, not an order of magnitude, because the ERC-20 transfer dominates. The levers that matter are gas price timing (the build endpoint exposes `estimated_fee`; operators can schedule batches off-peak) and amount thresholds. Product copy must change: README "No middlemen and no fees", setup page "Near-zero fees / Fractions of a cent per payment", docs "SOL pays the small network fee" become "No platform fee or percentage cut. You pay Ethereum network gas per transaction, typically a few cents to a few dollars depending on network load; batch payouts to share it." The dashboard payout modal shows `estimated_fee` in ETH and warns when it exceeds 10 % of the payout amount (Open decision 16). Mention L2s nowhere as a feature (out of scope) — at most one line in `CHANGES.md` noting the design keeps the chain id configurable.

### 4.10 Data model

No deployments exist, so this is a clean rename with no migration script; `CHANGES.md` states that databases created by upstream are incompatible. Renames (all done in Task 5 while Solana still runs, so the suite proves them):

| Before | After |
| --- | --- |
| `PayoutBatchBuildResponse.estimated_fee_lamports`, `.blockhash`, `.last_valid_block_height` | `.estimated_fee: string`, `.fee_currency`, `.chain_id`, `.nonce`, `.to`, `.transaction_type`, `.batch_id` (blockhash fields deleted; the Solana class keeps them under an optional `solana` sub-object until Task 6) |
| `PayoutBatchBroadcastResponse.signature`, `ProcessPendingResult.signature` | `.transaction_hash`; `status` gains `'pending'` |
| `BroadcastPayoutsBatchSchema.blockhash`, `.last_valid_block_height` (never read) | removed; `.transaction_hash` optional added in Task 8 |
| `CheckoutSession.payment_details.transaction_signature` | `.transaction_hash` (Mongo field path too) |
| `CheckoutSession.merchant_wallet.usdc_mint` | `.token_address` |
| `Price.subscription_plan_pda` | `.subscription_plan_id` |
| `Subscription.subscription_delegation_pda` | `.subscription_onchain_id` |
| `SetupRequest/SetupResponse.solana_public_key` | `.wallet_address` |
| `DepositInfo.network: 'solana'` | `network: string` from `Settlement.Describe()` |
| `BalanceDetails.wallet_sol` | `.wallet_native` + `.native_currency` |
| `Payout.metadata.network / gas_fee_currency` literals | from `Describe()` (`'ethereum'` / `'eth'`, `'simulated'` / `'none'`) |
| `TopUp.metadata` | gains `log_index` |
| `IncomingDeposit.signature / slot` | `.transactionHash / .logIndex / .blockNumber` |
| New collections | `PayoutBatches`, `ChainCursors` (internal; no public endpoint) |

### 4.11 Test strategy

- **Unit (Jest, `nx test api/web/node-sdk/docs/cli`)**: unchanged mocking style; chain code is mocked through `Settlement` (`__tests__/mocks/Settlement.ts` exports `CreateMockSettlement(): jest.Mocked<Settlement>`). The `moduleNameMapper` hack goes away in Task 6.
- **Pure chain helpers** (`BuildTransferAuthorizationTypedData`, `VerifyCheckoutReceipt`, `EncodeDisperseCall`, `ParsePayoutReceipt`, address and key validation) are tested with fixtures, no RPC.
- **Contracts**: `forge test` with fuzzing (`disperse` with random arrays, `charge` timing), run by `nx run contracts:test`.
- **Integration**: `nx run api:test-anvil` — real `Ethereum` class against Anvil with `MockUSDC` (6 decimals, EIP-2612 permit, EIP-3009 `transferWithAuthorization`/`receiveWithAuthorization`, `AuthorizationUsed` event, `blacklist(address)` test hook).
- **Simulated rail**: every API flow keeps working with `SETTLEMENT_RAIL=simulated` and `docker compose up mongodb -d` (Colima); the existing `Settlement.spec.ts` grows with each flow.
- **Sepolia (Task 18 only)**: manual end-to-end with a funded key and a real RPC.

### 4.12 Apache-2.0 compliance and rebranding

- `LICENSE` stays byte-for-byte, including the appendix block "Copyright 2026 Zoneless Ltd." (§4(c): retain notices).
- `NOTICE` (new): product line with `<NEWNAME>` and the new copyright holder, then: "This product includes software developed by Zoneless Ltd. (https://github.com/zonelessdev/zoneless), Copyright 2026 Zoneless Ltd., licensed under the Apache License, Version 2.0. Forked from commit `5febc1a` (156 commits) on 2026-10-27. Modified by the <NEWNAME> maintainers: settlement ported from Solana to Ethereum, telemetry removed, rebranded." §4(d) requires downstream recipients to receive this NOTICE; the SDK and CLI `files` arrays include it.
- §4(b) "prominent notices stating that You changed the files": `CHANGES.md` lists every modified/added/deleted path per task (generated with `git diff --name-status 5febc1a..HEAD`), and files that are substantively rewritten or new carry a one-line header `// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.` (Open decision 5).
- §6 grants no trademark rights: no published artifact may carry "Zoneless", the `@zoneless` scope, the `zoneless` CLI bin, `Zoneless-Account` header, upstream logos or screenshots (README images are served from `docs.zoneless.com` and are removed in Task 1), or the `_z` id infix once the name is chosen. Task 17 centralises these behind `BRAND` and a script; Task 19 flips them. Until then nothing is published.
- Upstream's "built for PromptBase … runs in production" claim is removed (Task 1); it is not true of this fork.

---

## 5. Phases and task index

Tasks are sequential. Each leaves `npx nx run-many --target=test --all` green, `npm run format:check` clean and `npx nx run-many --target=lint --all` clean.

| Phase | Tasks | Outcome |
| --- | --- | --- |
| 0. Fork hygiene (no behaviour change) | 1–3 | Legal notices, dead Anchor code gone, telemetry phone-home gone, no upstream endpoints in code |
| 1. Chain-neutral seam (still Solana) | 4–5 | `Settlement` interface; chain-neutral API/type/SDK/doc field names; suite proves the rename |
| 2. Ethereum rail on Anvil: wallets, payouts, top-ups | 6–10 | Solana removed; viem; `Ethereum` class; contracts project + Anvil harness; payouts and top-ups work on Anvil and simulated |
| 3. Checkout on Ethereum | 11–12 | EIP-3009 relayed checkout, API + web |
| 4. Subscriptions on Ethereum | 13–15 | `Subscriptions.sol`, API billing, web subscribe |
| 5. Copy, docs, brand centralisation | 16–17 | Zero Solana mentions; honest gas copy; `BRAND` + `scripts/rebrand.sh` |
| 6. Testnet reality check — HUMAN INPUT NEEDED | 18 | Sepolia deployment and manual end-to-end with a funded key and a real RPC |
| 7. NOT EXECUTED — human-gated | 19 | Audit, mainnet deployment, rebrand flip, publishing |

---

## 6. Tasks

### Task 1: Fork notices, dead Anchor program, repository metadata

**Files:**
- Create: `NOTICE`, `CHANGES.md`
- Delete: `apps/programs/` (entire directory; verified unreferenced: no `project.json`, program id `9JAVCcRBhZz4…` appears nowhere else)
- Modify: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `package.json` (`repository`, `homepage`, `bugs`), `sdks/node/package.json` (`repository`, `homepage`, `bugs`, `files` += `NOTICE`), `apps/cli/package.json` (`repository`, `homepage`, `files` += `NOTICE`), `.github/ISSUE_TEMPLATE/config.yml`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, `AGENTS.md` (remove the sentence about `apps/programs` if present; keep the rest)
- Copy NOTICE into SDK/CLI packs: add `NOTICE` to the `files` arrays above and to `sdks/node/project.json` / `apps/cli/project.json` pack steps if they copy files explicitly (check first).

**Steps:**
- [ ] Write `NOTICE` with the text in §4.12 (use `<NEWNAME>` and `<NEWOWNER>` placeholders; fork commit `5febc1a`, 156 commits, date 2026-10-27).
- [ ] Write `CHANGES.md` with a header explaining §4(b), a "How this list is maintained" line (`git diff --name-status 5febc1a..HEAD`), and a first section "Task 1" listing the files this task touches. Every later task appends its own section.
- [ ] `git rm -r apps/programs`.
- [ ] `README.md`: remove the four `<img>` blocks and the header image served from `docs.zoneless.com`, the badges pointing at `zonelessdev`, the Discord link, the "Running in production / PromptBase" section, the blog links, and the `## Project structure` `apps/programs` line if present. Replace external docs links with relative `apps/docs` paths or `http://localhost:4205`. Add a short "## Fork notice" section pointing to `NOTICE` and `CHANGES.md` and stating the Solana → Ethereum port is in progress. Keep everything else.
- [ ] `CONTRIBUTING.md`: remove Discord, upstream issue links, the `git remote add upstream` line and the "Looking for something to work on?" section; change the devnet sentence to "To exercise Ethereum Sepolia, set `LIVEMODE=false` and `SETTLEMENT_RAIL=onchain` (wired up later in this port)". `SECURITY.md`: replace the `docs.zoneless.com/deployment` link with `apps/docs` and remove the telemetry paragraph (Task 2 deletes `TELEMETRY.md`; leaving a dangling link is not acceptable, so remove the paragraph here).
- [ ] `package.json` ×3: set `repository.url`, `homepage`, `bugs.url` to `https://github.com/OWNER/REPO` placeholders. `.github/ISSUE_TEMPLATE/config.yml`: same placeholder host. Issue templates: no link changes needed beyond that; leave wording.
- [ ] Append the Task 1 file list to `CHANGES.md`.

**Verification:**
```bash
test -f NOTICE && test -f CHANGES.md && test ! -d apps/programs && echo OK
git grep -n -I "PromptBase\|docs.zoneless.com/assets\|discord.gg\|zonelessdev" -- ':!CHANGES.md' ':!NOTICE' ':!docs/plans' ':!package-lock.json' ':!apps/docs' ':!apps/cli' ':!apps/web' ':!apps/api' ':!libs' ':!sdks' ':!.agents'   # expect no output
npx nx run-many --target=test --all   # expect: Successfully ran target test for 6 projects
npm run format:check                  # expect: All matched files use Prettier code style!
```

**Commit:** `chore: add fork notices, remove dead Anchor program and upstream repo metadata`

### Task 2: Remove the telemetry phone-home

**Files:**
- Delete: `apps/api/src/modules/Telemetry.ts`, `apps/api/src/modules/TelemetryMonitor.ts`, `apps/api/src/routes/telemetry.routes.ts`, `libs/shared-types/src/lib/Telemetry.ts`, `apps/web/src/app/data/services/telemetry.service.ts`, `TELEMETRY.md`
- Modify: `apps/api/src/routes/index.ts:38,102`, `apps/api/src/main.ts:30-32,219-220,259-261`, `apps/api/src/modules/Database.ts` (telemetry collection/index references), `apps/api/src/modules/Setup.ts` (`telemetry_enabled` handling), `libs/shared-types/src/lib/index.ts`, `libs/shared-types/src/lib/Config.ts` (`SetupRequest.telemetry_enabled`), `libs/shared-types/src/lib/Operator.ts` (telemetry fields, if any), `apps/web/src/app/data/services/index.ts`, `apps/web/src/app/features/account/settings/settings.component.{html,scss,ts}` (the "Anonymous usage" block and `TelemetryService` usage), `apps/web/src/app/features/setup/setup.component.{html,scss,ts}` (`telemetryEnabled` signal, checkbox, request field), `.env.example`, `.env.production.example` (`ZONELESS_TELEMETRY` block), `AGENTS.md` (drop `/telemetry` from the "Do not wrap internal routes" list), `apps/docs/src/app/pages/docs/data/environment-variables.ts` (`ZONELESS_TELEMETRY` entry), `CHANGES.md`

**Steps:**
- [ ] Remove the module, monitor, route registration and `main.ts` start/stop blocks; remove the telemetry opt-in from setup (API `Setup.ts` and shared `SetupRequest`) and from the settings page; delete the web service and its export.
- [ ] Update any spec that asserted `telemetry_enabled` (grep `apps/api/src/__tests__` and `apps/web/src` for `telemetry`).
- [ ] Remove env documentation and the file `TELEMETRY.md`.
- [ ] Append the Task 2 file list to `CHANGES.md`.

**Verification:**
```bash
git grep -n -i "telemetry" -- ':!package-lock.json' ':!CHANGES.md' ':!docs/plans'   # expect no output
npx nx run-many --target=test --all   # expect: Successfully ran target test for 6 projects
npx nx run-many --target=lint --all && npm run format:check
```

**Commit:** `chore: remove opt-in telemetry and its upstream ingest endpoint`

### Task 3: Cut remaining upstream endpoints from code and docs

**Files:**
- Modify (API): `apps/api/src/main.ts:129`
- Modify (CLI): `apps/cli/src/app/AgentSetup.ts:17-19` (delete `defaultAuthUrl`/`defaultActivationUrl`; `authUrl` and `activationUrl` become required options; throw `CliError('auth_url_required', …)` with exit code `exitCodes.invalidInput` when missing), `apps/cli/src/app/Cli.ts` + `apps/cli/src/app/Arguments.ts` (add `--auth-url` / `--activation-url` flags following the existing flag pattern; help text), `apps/cli/src/app/WebhookSync.ts:146-147` (derive the dashboard URL from the profile's API URL — replace `api` with `dashboard` only when the host starts with `api.`/`api-test.`, otherwise print "open your dashboard"), `apps/cli/README.md`, specs `AgentSetup.spec.ts`, `Cli.spec.ts`, `EnvSync.spec.ts`, `WebhookSync.spec.ts` (fixtures → `https://api.example.com`, `https://auth.example.com`)
- Modify (web): `apps/web/src/app/shared/forms/identity-settings-form/didit-webhook-url.ts` (replace the host map with `BuildDiditWebhookUrl(apiBaseUrl: string): string` using the configured API origin), its spec if present, `features/account/settings/settings.component.html:175`, `features/setup/setup.component.html:128`, `features/onboard/onboard.component.html:35`, `features/account/products/views/price-detail/price-detail.component.html:143,221`, `core/services/wallet.service.spec.ts:72,89,120` (fixture origin → `https://buy.example.com`)
- Modify (docs app): `apps/docs/scripts/generate-agent-docs.ts:13` (`defaultSiteUrl` → `process.env.DOCS_SITE_URL ?? 'http://localhost:4205'`), `apps/docs/scripts/generate-agent-docs.test.ts`, `src/app/pages/docs/docs.html:26,61,121`, `docs.ts:176-177`, `services/github.ts:10` (repo → `OWNER/REPO` placeholder; the star-count fetch must fail soft), `services/meta.ts:49`, `components/agent-prompt-cta/agent-marketplace-prompt.ts`, `components/agent-prompt-cta/agent-payments-prompt.ts`, and the 15 data pages listed in §2 (host `https://docs.zoneless.com` → relative path; `https://api(-test).zoneless.com` → `https://api.yourdomain.com`; `https://dashboard(-test).zoneless.com` → `https://pay.yourdomain.com`)
- Modify (shared): `.env.example:14,19`, `libs/shared-types/src/lib/Config.ts:13-22`, `libs/shared-schemas/src/lib/{BillingSchema,EventSchema,TopUpSchema}.ts`, `sdks/node/src/resources/*.ts` `@see` links (strip host, keep path), `sdks/node/README.md`, `.agents/skills/zoneless-marketplace/SKILL.md`, `.agents/skills/zoneless-payments/SKILL.md` (hosts only; content is rewritten in Task 16)
- Modify: `CHANGES.md`

**Steps:**
- [ ] Apply the replacements above. For docs `@see` comments use the path form `@see /payouts/create` (docs site is self-hosted).
- [ ] CLI: add the two flags and the required-option error; update specs so no fixture references a `zoneless` host.
- [ ] Append the Task 3 file list to `CHANGES.md`.

**Verification:**
```bash
git grep -n -I "zoneless\.com\|zonelessdev\|zoneless-app\.cloudfunctions\|github\.com/zoneless/" -- ':!package-lock.json' ':!CHANGES.md' ':!NOTICE' ':!docs/plans'   # expect no output
npx nx run-many --target=test --all   # expect: Successfully ran target test for 6 projects
npx nx run-many --target=lint --all && npm run format:check
```

**Commit:** `chore: remove hardcoded upstream hosts from api, cli, web and docs`

### Task 4: Introduce the `Settlement` interface and chain-neutral types (Solana still runs)

Purpose: make `Settlement` an explicit interface with chain-neutral types, route every chain-specific import through `chains/Settlement.ts` or `chains/types.ts`, and rename module fields from `solana` to `settlement`. Behaviour is unchanged; Solana remains the on-chain implementation. This is what lets Task 6 swap rails without touching call sites.

**Files:**
- Create: `apps/api/src/modules/chains/types.ts`, `apps/api/src/__tests__/mocks/Settlement.ts`
- Modify: `apps/api/src/modules/chains/Settlement.ts`, `apps/api/src/modules/chains/Solana.ts` (`export class Solana implements Settlement`, move the exported interfaces to `types.ts`, add `Describe()`, `ExplorerUrl` reads `Describe()`), `apps/api/src/modules/{Balance,CheckoutPayment,Invoice,Payout,Price,TopUp,TopUpMonitor}.ts`, `apps/api/src/routes/config.routes.ts`, `apps/api/src/__tests__/{CheckoutPayment,Payout,Invoice,Settlement}.spec.ts`, `apps/api/src/__tests__/mocks/Solana.ts` (keep; it is still what `jest.config.ts` maps `chains/Solana` to — add `Describe` and `ExplorerUrl` to it), `CHANGES.md`

**Interfaces (produced by this task; later tasks rely on these exact names):**

```ts
// apps/api/src/modules/chains/types.ts
export type Rail = 'simulated' | 'onchain';
export interface RailDescription {
  rail: Rail;
  network: string;            // 'solana' now, 'ethereum' after Task 6, 'simulated'
  chain_id: number | null;
  native_currency: string;    // 'sol' now, 'eth' after Task 6, 'none'
  token_address: string;      // USDC mint now, USDC contract after Task 6, 'simulated'
}
export interface UnsignedTransaction {
  unsigned_transaction: string;
  estimated_fee: string;      // atomic units of fee_currency, decimal string
  fee_currency: string;
  chain_id: number | null;
  nonce: number | null;
  to: string | null;
  solana?: { blockhash: string; last_valid_block_height: number; min_context_slot: number }; // deleted in Task 6
}
export interface UnsignedPayoutBatch extends UnsignedTransaction {
  recipients_count: number;
  transaction_type: 'payout' | 'approval';
  batch_id: string | null;
}
export interface BroadcastResult {
  transaction_hash: string;
  status: 'paid' | 'failed' | 'pending';
  viewer_url: string;
  failure_message?: string;
  failure_code?: 'account_frozen' | 'blockchain_error';
}
export interface TransferRecipient { destinationAddress: string; amountInCents: number }
export interface IncomingDeposit {
  transactionHash: string; logIndex: number; amount: number; amountCents: number;
  senderAddress: string; timestamp: number; blockNumber: number;
}
export interface CheckoutPaymentVerification { verified: boolean; amount_cents: number; payer_address: string | null; failure_reason?: string }
export interface CheckoutSubscribeVerification { verified: boolean; subscriber_address: string | null; subscription_onchain_id: string | null; failure_reason?: string }
```

```ts
// apps/api/src/modules/chains/Settlement.ts (interface; the Solana-only members are optional and removed in Task 6)
export interface Settlement {
  Describe(): RailDescription;
  ExplorerUrl(type: 'tx' | 'address', value: string): string;
  CheckWalletExists(address: string): Promise<boolean>;
  GetNativeBalance(address: string): Promise<number>;
  GetUSDCBalance(address: string): Promise<number>;
  GetIncomingDeposits(address: string, limit: number, processed: Set<string>): Promise<IncomingDeposit[]>; // signature changes in Task 10
  BuildBatchPayoutTransaction(sender: string, recipients: TransferRecipient[]): Promise<UnsignedPayoutBatch>;
  BroadcastSignedTransaction(signed: string): Promise<BroadcastResult>;
  BuildCheckoutPaymentTransaction(payer: string, merchant: string, amountCents: number, sessionId: string, options?: { feeSponsored?: boolean }): Promise<UnsignedTransaction>;
  ValidateAndBroadcastCheckoutTransaction(signed: string): Promise<{ transaction_hash: string }>;
  VerifyCheckoutPayment(transactionHash: string, expected: { merchantWalletAddress: string; amountInCents: number; checkoutSessionId: string }): Promise<CheckoutPaymentVerification>;
  GetPlanOwnerAddress(): string;
  CreateSubscriptionPlan(priceId: string, periodHours: number, amountCents: number, destination: string, puller: string): Promise<string>;
  BuildSubscribeTransaction(subscriber: string, priceId: string, planId: string, options?: { feeSponsored?: boolean }): Promise<UnsignedTransaction>;
  FindExistingSubscription(planId: string, subscriber: string): Promise<string | null>;
  VerifySubscribeTransaction(transactionHash: string, expected: { planId: string; subscriberWallet: string }): Promise<CheckoutSubscribeVerification>;
  CollectSubscriptionPayment(params: { subscriberWallet: string; planId: string; subscriptionId: string; amountCents: number; destinationWallet?: string }): Promise<{ transaction_hash: string; alreadyCollected: boolean }>;
  BuildInitSubscriptionAuthorityTransaction?(subscriber: string, options?: { feeSponsored?: boolean }): Promise<UnsignedTransaction | null>; // Solana only
  WaitForSubscriptionAuthority?(subscriber: string): Promise<void>;                                                                    // Solana only
}
export function GetSettlement(): Settlement;
export function ExplorerUrl(type: 'tx' | 'address', value: string): string; // = GetSettlement().ExplorerUrl(type, value)
export const SIMULATED_TEST_WALLET: string; // unchanged value in this task
```

**Steps:**
- [ ] Write the failing test `apps/api/src/__tests__/Settlement.spec.ts` additions:
  ```ts
  it('describes the simulated rail', () => {
    expect(new SimulatedSettlement().Describe()).toEqual({ rail: 'simulated', network: 'simulated', chain_id: null, native_currency: 'none', token_address: 'simulated' });
  });
  it('returns an empty explorer url on the simulated rail', () => {
    expect(new SimulatedSettlement().ExplorerUrl('tx', 'abc')).toBe('');
  });
  it('shapes a simulated payout batch with chain-neutral fields', async () => {
    const batch = await new SimulatedSettlement().BuildBatchPayoutTransaction('Sender111', [{ destinationAddress: 'A', amountInCents: 100 }]);
    expect(batch).toMatchObject({ unsigned_transaction: 'sim_tx', estimated_fee: '0', fee_currency: 'none', chain_id: null, nonce: null, to: null, recipients_count: 1, transaction_type: 'payout' });
    expect(batch).not.toHaveProperty('estimated_fee_lamports');
  });
  it('broadcasts with transaction_hash', async () => {
    await expect(new SimulatedSettlement().BroadcastSignedTransaction('sim_tx')).resolves.toMatchObject({ transaction_hash: 'sim_sig_payout', status: 'paid' });
  });
  ```
- [ ] Run `npx nx test api --testPathPattern=Settlement` — expect FAIL (`Describe is not a function`, property mismatches).
- [ ] Create `chains/types.ts` with the interfaces above. Move `CheckoutPaymentVerification`, `CheckoutSubscribeVerification`, `TransferRecipient`, `IncomingDeposit` out of `Solana.ts` into it (Solana's `IncomingDeposit` producer maps `signature → transactionHash`, `slot → blockNumber`, `logIndex: 0`).
- [ ] In `Settlement.ts`: declare the `Settlement` interface; `SimulatedSettlement implements Settlement` with `Describe()`, `ExplorerUrl()` returning `''`, `GetNativeBalance`, `GetPlanOwnerAddress`, `FindExistingSubscription`, and the new return shapes (`estimated_fee: '0'`, `fee_currency: 'none'`, `transaction_hash`); add the module-level `ExplorerUrl` helper; `GetSettlement(): Settlement`.
- [ ] In `Solana.ts`: `class Solana implements Settlement`; rename `GetSOLBalance → GetNativeBalance`, `GetPlanOwnerPublicKey → GetPlanOwnerAddress`, `FindExistingSubscriptionDelegation → FindExistingSubscription`, `GetUSDCMintAddress` → private, surfaced through `Describe().token_address`; return `estimated_fee: String(fee.value ?? 0)`, `fee_currency: 'sol'`, `chain_id: null`, `nonce: null`, `to: null`, `solana: { blockhash, last_valid_block_height, min_context_slot }`; broadcast returns `transaction_hash`; `SolanaExplorerUrl` becomes the instance `ExplorerUrl` (delete the module-level export). Keep `MAX_BATCH_RECIPIENTS = 10` for now.
- [ ] Update call sites: `Balance.ts` (`GetNativeBalance`), `CheckoutPayment.ts` (field `settlement: Settlement`, `ExplorerUrl` from `./chains/Settlement`, `transaction_hash` from broadcast, `settlement.Describe().token_address` for `usdc_mint` (public field renamed in Task 5), `FindExistingSubscription`, `GetPlanOwnerAddress`), `Invoice.ts`, `Payout.ts` (`settlement`, `result.transaction_hash`, `metadata.network`/`gas_fee_currency` from `Describe()`), `Price.ts` (`GetPlanOwnerAddress`), `TopUp.ts` (`IncomingDeposit` from `./chains/types`, `deposit.transactionHash`, `ExplorerUrl`), `TopUpMonitor.ts`, `routes/config.routes.ts` (`ExplorerUrl`, `network: GetSettlement().Describe().network`).
- [ ] Replace the `jest.Mocked<Solana>` in `CheckoutPayment.spec.ts` with `CreateMockSettlement()` from the new `__tests__/mocks/Settlement.ts` (a factory returning `jest.Mocked<Settlement>` with the same default resolved values the old `mocks/Solana.ts` class used, renamed fields). Keep `mocks/Solana.ts` in sync because `jest.config.ts` still maps the module path to it (remove both in Task 6).
- [ ] Run `npx nx test api` — expect PASS; fix any type fallout (`npx tsc -p apps/api/tsconfig.app.json --noEmit` is a fast check).
- [ ] Append the Task 4 file list to `CHANGES.md`.

**Verification:**
```bash
git grep -n "SolanaExplorerUrl\|GetSOLBalance\|GetPlanOwnerPublicKey\|FindExistingSubscriptionDelegation\|this\.solana\b" -- apps/api/src   # expect no output
git grep -n "from './chains/Solana'\|from '../chains/Solana'\|from '../modules/chains/Solana'" -- apps/api/src ':!apps/api/src/modules/chains/Settlement.ts' ':!apps/api/src/__tests__'   # expect no output
npx nx run-many --target=test --all   # expect: Successfully ran target test for 6 projects
npx nx run-many --target=lint --all && npm run format:check
```

**Commit:** `refactor: make Settlement an interface with chain-neutral types`

### Task 5: Rename the public API surface to chain-neutral field names (API, shared libs, web, SDK, docs)

Purpose: every externally visible Solana-shaped field is renamed once, while Solana still produces real values, so the SDK, web and docs are updated together (per `AGENTS.md`) and the suite proves the rename end to end.

**Files:**
- Modify (shared-types): `libs/shared-types/src/lib/Payout.ts` (`PayoutBatchBuildResponse`, `PayoutBatchBroadcastResponse`, `ProcessPendingResult`), `CheckoutSession.ts` (`payment_details.transaction_hash`, `merchant_wallet.token_address`), `Price.ts` (`subscription_plan_id`), `Subscription.ts` (`subscription_onchain_id`), `Config.ts` (`SetupRequest.wallet_address`, `SetupResponse.wallet_address`, `DepositInfo.network: string`, `SettlementRail` comments), `Balance.ts` or wherever `BalanceDetails` lives (`wallet_native`, `native_currency`), comments in `Charge.ts`, `Customer.ts`, `Invoice.ts`, `InvoicePayment.ts`
- Modify (shared-schemas): `libs/shared-schemas/src/lib/PayoutSchema.ts` (`BroadcastPayoutsBatchSchema`: drop `blockhash`, `last_valid_block_height`), `PriceSchema.ts` comment, `CheckoutSessionSchema.ts` comment
- Modify (API): `apps/api/src/modules/Payout.ts` (`BuildPayoutsBatch` response fields; `BroadcastPayoutsBatch` returns `transaction_hash`, `status`), `CheckoutPayment.ts` (`PreparedCheckoutPayment` fields: `estimated_fee`, `fee_currency`, `chain_id`, `nonce`, `to`, `solana?`, `subscription_onchain_id`; `ConfirmPayment(urlSlug, transactionHash, options)`; `payment_details.transaction_hash`; `merchant_wallet.token_address`), `CheckoutSession.ts:880-895` (`GetCheckoutSessionByTransactionHash`, field path `payment_details.transaction_hash`), `Price.ts` (`subscription_plan_id`), `Subscription.ts` (`subscription_onchain_id`, `SetSubscriptionOnchainId`), `SubscriptionBilling.ts:225`, `Invoice.ts:1667-1705`, `Setup.ts` (`wallet_address`), `Balance.ts` (`wallet_native`, `native_currency`), `routes/paymentPages.routes.ts` (confirm body `transaction_hash`, `subscription_onchain_id`), `routes/setup.routes.ts:213`, `routes/config.routes.ts`, `routes/payouts.routes.ts` comments, specs: `CheckoutPayment.spec.ts`, `CheckoutSession.spec.ts`, `Payout.spec.ts`, `Price.spec.ts`, `Subscription.spec.ts`, `SubscriptionBilling.spec.ts`, `Invoice.spec.ts`, `Balance.spec.ts`, `Setup.ts`-related specs
- Modify (web): `apps/web/src/app/data/services/checkout-session.service.ts` (`CheckoutPaymentTransaction`, `ConfirmPayment` body), `features/checkout/checkout.component.ts` (reads `prepared.solana?.min_context_slot`, posts `transaction_hash`), `data/services/setup.service.ts` + `features/setup/setup.component.{ts,html}` (`wallet_address`), `features/account/balance/**` (`wallet_native`), `features/account/connected-accounts/services/connected-account-actions.service.ts` (build/broadcast fields), `features/account/products/**` (`subscription_plan_id` if displayed), `features/account/subscriptions/**` (`subscription_onchain_id` if displayed), `utils/constants/test-data.ts`, specs `checkout.component.spec.ts`
- Modify (SDK): `sdks/node/src/resources/Payouts.ts` (`processBatch` stops sending blockhash; result `transaction_hash`), `sdks/node/src/generated/Inputs.ts` (regenerated by `npx nx build node-sdk`), SDK tests, `sdks/node/README.md`
- Modify (docs): `apps/docs/src/app/pages/docs/data/payouts.ts` (build/broadcast/process samples and attribute lists), `checkout-sessions.ts` (`payment_details`, `merchant_wallet`), `prices.ts`, `subscriptions.ts`, `balance.ts`, `self-hosting.ts` / `local-development.ts` / `quickstart.ts` if they mention `solana_public_key`, `top-ups.ts`
- Modify: `CHANGES.md`

**Steps:**
- [ ] Write failing tests first, one per surface:
  - `Payout.spec.ts`: `BuildPayoutsBatch` result `toMatchObject({ object: 'payout_batch_build', estimated_fee: expect.any(String), fee_currency: expect.any(String), transaction_type: 'payout' })` and `not.toHaveProperty('estimated_fee_lamports')`; `BroadcastPayoutsBatch` result has `transaction_hash` and no `signature`.
  - `CheckoutPayment.spec.ts`: `PreparePayment` returns `estimated_fee`/`fee_currency`; `ConfirmPayment` persists `payment_details.transaction_hash`; subscription prepare returns `subscription_onchain_id`.
  - `CheckoutSession.spec.ts`: `GetCheckoutSessionByTransactionHash` queries `payment_details.transaction_hash`.
  - `Price.spec.ts` / `Subscription.spec.ts`: objects carry `subscription_plan_id: null` / `subscription_onchain_id: null`.
  - `Balance.spec.ts`: `GetBalanceDetails` returns `wallet_native` and `native_currency`.
  - A Setup spec (create `apps/api/src/__tests__/SetupModule.spec.ts` if none exists) asserting `CreatePlatform` rejects a missing `wallet_address` with the message `wallet_address is required`.
  - SDK: `sdks/node/src/__tests__/Payouts.spec.ts` (new) asserting `processBatch` posts `{ signed_transaction, payouts }` only and returns `transaction_hash` (mock `HttpClient`).
- [ ] Run `npx nx test api --testPathPattern="Payout|CheckoutPayment|CheckoutSession|Price|Subscription|Balance|Setup"` and `npx nx test node-sdk` — expect FAIL on the new assertions.
- [ ] Apply the renames in shared-types and shared-schemas, then the API modules and routes, then the web, then the SDK; run `npx nx build node-sdk` to regenerate `generated/Inputs.ts`.
- [ ] Update the docs data pages: attribute names, descriptions ("Base64-encoded unsigned transaction" → "Serialized unsigned transaction for the active settlement rail"), JSON samples (`"estimated_fee": "5000"`, `"fee_currency": "sol"`, `"transaction_hash": …`, `"subscription_plan_id"`, `"subscription_onchain_id"`, `"token_address"`, `"wallet_address"`). Keep the samples' other values.
- [ ] Run the full suite — expect PASS.
- [ ] Append the Task 5 file list to `CHANGES.md`.

**Verification:**
```bash
git grep -n -I "estimated_fee_lamports\|last_valid_block_height\|min_context_slot\|_pda\b\|usdc_mint\|solana_public_key\|transaction_signature\|wallet_sol\b\|blockhash" -- ':!package-lock.json' ':!CHANGES.md' ':!docs/plans' ':!apps/api/src/modules/chains/Solana.ts' ':!apps/api/src/__tests__/mocks/Solana.ts' ':!apps/api/src/modules/chains/Solana.spec.ts' ':!apps/web/src/app/features/checkout/checkout.component.ts' ':!apps/api/src/modules/chains/types.ts'   # expect no output (the excluded files keep Solana internals until Task 6)
npx nx run-many --target=test --all   # expect: Successfully ran target test for 6 projects
npx nx build node-sdk                 # expect: success; generated/Inputs.ts has no blockhash field
npx nx run-many --target=lint --all && npm run format:check
```

**Commit:** `refactor!: rename chain-specific API fields to chain-neutral names`

### Task 6: Swap the rail — remove Solana, add viem, `Ethereum` stub, addresses and keys everywhere

Purpose: the pivot. After this task no Solana package, file or address format remains; `GetSettlement()` returns `Ethereum` in on-chain mode; the simulated rail is fully functional; on-chain money flows throw a clear `not_supported` error until Tasks 8–15 implement them. The web `WalletService` and key generation move to secp256k1.

**Files:**
- Delete: `apps/api/src/modules/chains/Solana.ts`, `apps/api/src/modules/chains/Solana.spec.ts`, `apps/api/src/__tests__/mocks/Solana.ts`, `apps/web/src/app/utils/validation/solana.ts`, `apps/web/src/assets/icons/phantom-wallet.svg` (if only the wallet guide uses it)
- Create: `apps/api/src/modules/chains/Ethereum.ts`, `apps/api/src/modules/chains/Chain.ts` (chain selection + viem clients), `apps/api/src/modules/chains/contracts.ts` (per-chain address table from §1), `apps/api/src/modules/chains/Ethereum.spec.ts` (pure helpers only), `apps/web/src/app/utils/validation/ethereum.ts`, `libs/shared-schemas/src/lib/AddressSchema.ts`
- Modify (deps): root `package.json` (remove the ten packages in §1, add `viem`), `sdks/node/package.json` (deps → `viem`; keywords `solana` → `ethereum`), `sdks/node/tsup.config.ts` (`external: ['viem']`), `apps/cli/package.json` (`bs58` → `viem`), `package-lock.json` (via `npm install`)
- Modify (API): `apps/api/jest.config.ts` (delete `moduleNameMapper` and the `diagnostics.exclude`), `apps/api/src/modules/chains/Settlement.ts` (`GetSettlement` → `new Ethereum()`; `SIMULATED_TEST_WALLET = '0x1111111111111111111111111111111111111111'`; `CheckWalletExists` → `isAddress`; remove the optional Solana-only interface members), `apps/api/src/modules/chains/types.ts` (delete the `solana?` sub-object), `AppConfig.ts` (`GetCheckoutRelayerKey()` reading `CHECKOUT_RELAYER_KEY`, `RequireSubscriptionOperatorKey()`, both validated against `/^0x[0-9a-fA-F]{64}$/`; `GetChainConfig()` resolving chain id / RPC URLs / confirmations per §1; remove `TRANSACTION_FEE_PAYER_KEY`, `IsCheckoutFeeSponsored` → `IsCheckoutRelayed()`), `Setup.ts:40-50` (replace the base58 regex with `isAddress`; store `getAddress(value)`), `ExternalWallet.ts` (normalise with `getAddress`; `network` default from `Describe()`), `CheckoutPayment.ts` (delete the `init_authority` branch, `subscription_step`, `WaitForSubscriptionAuthority` usage; `relayed` replaces `fee_sponsored`), `Payout.ts:216` (error text "not a valid Ethereum address"), `main.ts:232-233` (banner: `Ethereum: mainnet (live USDC)` / `Ethereum: sepolia (test mode)` / `simulated`), `SanctionsScreening.ts` (comment + EIP-55 example), comments in `PaymentIntent.ts:5`, `Subscription.ts`, `SubscriptionBilling.ts`, `BillingMonitor.ts`, `Invoice.ts`, `utils/RecurringInterval.ts:30`, `routes/{paymentPages,payouts,topups,setup,config}.routes.ts`
- Modify (API tests): `__tests__/mocks/Settlement.ts` (now the only mock; default addresses are 0x), `Settlement.spec.ts` (`0x` addresses; `CheckWalletExists('0x1111…')` true, `'short'` false, `'0xZZ…'` false), fixtures in `CheckoutPayment.spec.ts`, `Charge.spec.ts`, `ExternalWallet.spec.ts`, `Invoice.spec.ts`, `Payout.spec.ts`, `SetupModule.spec.ts` (base58 strings → checksummed 0x addresses; use Anvil account addresses `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`, `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`, `0x3C44CdDdB6a900fa2b585dd299e03d8fA7F6a9b9`)
- Modify (shared): `libs/shared-schemas/src/lib/ExternalWalletSchema.ts` (`wallet_address: EthereumAddressSchema`), `CheckoutSessionSchema.ts` (`payer_wallet: EthereumAddressSchema`), `libs/shared-schemas/src/index.ts`, `libs/shared-types/src/lib/Charge.ts:57` comment, `Config.ts` comments
- Modify (web): `apps/web/src/app/core/services/wallet.service.ts` → `WalletService` per §4.7 (rename the class; keep the file name), `wallet.service.spec.ts` (fake EIP-1193 provider announcing via `eip6963:announceProvider`), `core/services/index.ts`, `utils/validation/index.ts` (`export * from './ethereum'`), `shared/forms/external-wallet-form/external-wallet-form.component.ts` (`ValidateEthereumAddress`, `GetEthereumAddressError`, `ETHEREUM_NETWORK`, `ETHEREUM_CURRENCY`), `utils/constants/test-data.ts` (`walletAddress: '0x1111111111111111111111111111111111111111'`), `data/services/setup.service.ts` (`GenerateWallet()` via `WalletService`), `features/setup/setup.component.{ts,html}` (secp256k1 copy: "Create a new Ethereum wallet in your browser", private key shown once as `0x…`, "Enter your existing Ethereum wallet address"; remove "Near-zero fees" bullets — final copy lands in Task 16, use "No platform fees" for now), `features/checkout/checkout.component.ts` (replace `SolanaWalletService` with `WalletService`; the pay path calls the API and, in on-chain mode, shows the error the API returns — real signing arrives in Task 12; delete `bs58` usage, `TransactWithMobileWallet`, `min_context_slot`), `features/checkout/util/mobile-wallet.ts` (MetaMask + Coinbase Wallet deep links), `features/checkout/checkout.component.spec.ts`, `features/account/connected-accounts/services/connected-account-actions.service.ts` (uses `WalletService`; signing path finished in Task 9 — for now the on-chain branch throws "Payout signing is wired up in a later step"), `features/account/connected-accounts/components/payout-modal/payout-modal.component.ts`, `data/services/external-wallet.service.ts:110` ("Ethereum"), `features/account/balance/components/add-funds-panel/add-funds-panel.component.{ts,html}` (`https://faucet.circle.com`), `shared/ui/wallet-guide/wallet-guide.component.html` (MetaMask steps, no Phantom), `apps/web/project.json` (drop any Solana `allowedCommonJsDependencies` if present)
- Modify (SDK): `sdks/node/src/resources/Payouts.ts` (`sign()` becomes `async sign(unsignedTransaction: Hex, privateKey: Hex): Promise<Hex>` using `privateKeyToAccount(privateKey).signTransaction(parseTransaction(unsignedTransaction))`; `'sim_tx'` short-circuit kept; `processBatch`/`processAll` take `privateKey`), `sdks/node/src/__tests__/Payouts.spec.ts` (sign a fixture tx and assert `recoverTransactionAddress` equals the account), `sdks/node/README.md`
- Modify (CLI): `apps/cli/src/app/AgentSetup.ts:417-433` (`GenerateWallet()` → `{ address, privateKey }` via `generatePrivateKey`/`privateKeyToAccount`; the auth request field `solanaPublicKey` → `walletAddress`), `apps/cli/src/app/Wallet.ts` (`CreateWalletBackup` → `{ address, privateKey }`), `apps/cli/src/app/EnvSync.ts:56` (`SOLANA_SECRET_KEY` → `WALLET_PRIVATE_KEY`), `apps/cli/src/app/Cli.ts:57`, `apps/cli/README.md`, specs `AgentSetup.spec.ts`, `Wallet.spec.ts`, `EnvSync.spec.ts`
- Modify (env/infra/docs): `.env.example`, `.env.production.example` (per §1 table; comments), `docker-compose.yml` (`SOLANA_RPC_URL` → `ETH_RPC_URL`, add `ETH_CONFIRMATIONS`, `CHECKOUT_RELAYER_KEY`, `SUBSCRIPTION_OPERATOR_KEY` passthroughs), `apps/docs/src/app/pages/docs/data/environment-variables.ts`, `local-development.ts`, `self-hosting.ts` (env names only; prose sweep is Task 16), `AGENTS.md` ("uses USDC on Ethereum", "Ethereum wallets"), `CONTRIBUTING.md` (same two sentences), `CHANGES.md`

**Interfaces produced:**

```ts
// apps/api/src/modules/chains/Chain.ts
export interface ChainConfig { chainId: 1 | 11155111 | 31337; rpcUrls: string[]; confirmations: number; usdc: Address; payoutBatch: Address | null; subscriptions: Address | null; sanctionsOracle: Address | null; explorer: string }
export function GetChainConfig(): ChainConfig;        // from AppConfig env + contracts.ts; throws if ETH_CHAIN_ID is set while LIVEMODE=true
export function GetPublicClient(): PublicClient;      // viem createPublicClient({ chain, transport: fallback(rpcUrls.map(url => http(url))) }), memoised
export function GetWalletClient(privateKey: Hex): WalletClient;
export function ResetChainClientsForTests(): void;

// apps/api/src/modules/chains/Ethereum.ts
export class Ethereum implements Settlement { /* Describe, ExplorerUrl, CheckWalletExists (isAddress), GetNativeBalance, GetUSDCBalance (balanceOf / 1e6, asserts decimals()==6 once); every other method throws NotSupported('<method>') */ }
export function NotSupported(method: string): AppError; // 501, type 'not_supported', message `${method} is not available on this settlement rail yet`
export const USDC_ABI, ERC20_ABI: readonly [...] as const; // in apps/api/src/modules/chains/abi/Usdc.ts: balanceOf, decimals, name, allowance, approve, transfer, transferFrom, isBlacklisted, authorizationState, transferWithAuthorization(v,r,s), permit, nonces, DOMAIN_SEPARATOR, events Transfer, Approval, AuthorizationUsed

// libs/shared-schemas/src/lib/AddressSchema.ts
export const EthereumAddressSchema = z.string().refine((v) => isAddress(v), 'Must be a valid Ethereum address'); // normalisation with getAddress happens in modules, not in the schema
```

**Steps:**
- [ ] Update the three `package.json` files, run `npm install`, confirm `node -e "require('viem')"` works and `git grep -l "@solana\|bs58\|wallet-standard\|solana-mobile" -- package.json sdks/node/package.json apps/cli/package.json` is empty.
- [ ] Write failing tests: `Ethereum.spec.ts` (`new Ethereum().Describe()` for `LIVEMODE=false`/`SETTLEMENT_RAIL=onchain`/`ETH_CHAIN_ID=31337`/`USDC_ADDRESS=0x…` gives `{ rail: 'onchain', network: 'ethereum', chain_id: 31337, native_currency: 'eth', token_address: <checksummed> }`; `ExplorerUrl('tx','0xab')` is `''` on 31337 and `https://sepolia.etherscan.io/tx/0xab` on 11155111; `CheckWalletExists` true/false cases; `BuildBatchPayoutTransaction` rejects with `not_supported`), an `AppConfig` spec for key format validation (`CHECKOUT_RELAYER_KEY=abc` throws), `Settlement.spec.ts` updates, `wallet.service.spec.ts` (discovery, connect returns checksummed address, `SignTypedData` forwards `eth_signTypedData_v4`), SDK `Payouts.spec.ts` (sign/recover), CLI `Wallet.spec.ts` (address matches private key), `AddressSchema` spec in `libs/shared-schemas` if the lib has tests (otherwise cover through `ExternalWallet.spec.ts`: lowercase accepted, bad checksum rejected, stored value checksummed).
- [ ] Run the targeted suites — expect FAIL.
- [ ] Implement `Chain.ts`, `contracts.ts`, `abi/Usdc.ts`, `Ethereum.ts`, the `AppConfig` changes, `Settlement.ts` changes, schema, web `WalletService`, setup wizard, SDK `sign`, CLI wallet, then delete the Solana files and the jest mapper.
- [ ] Sweep comments and strings: `git grep -n -i "solana\|lamport\|base58\|bs58\|phantom\|devnet" -- apps libs sdks ':!apps/docs' ':!.agents'` and fix every hit in code (docs prose is Task 16).
- [ ] Run the full suite, lint, format. Append the Task 6 file list to `CHANGES.md` (this task's section also records the resolved viem version).

**Verification:**
```bash
git grep -n -i -I "solana\|lamport\|base58\|bs58\|phantom\|wallet-standard\|solana-mobile" -- apps/api apps/web apps/cli libs sdks package.json docker-compose.yml .env.example .env.production.example ':!**/CHANGES.md'   # expect no output
npx nx run-many --target=test --all   # expect: Successfully ran target test for 6 projects
npx nx build node-sdk && npx nx build cli && npx nx build api   # expect: success (api build proves no dangling Solana import)
npx nx run-many --target=lint --all && npm run format:check
```

**Commit:** `feat!: replace the Solana settlement rail with an Ethereum rail stub on viem`

### Task 7: Foundry project, `PayoutBatch.sol`, `MockUSDC.sol`, Nx wiring, CI, Anvil test harness

Purpose: give the repo a contracts toolchain and an integration lane that needs no funds.

**Files:**
- Create: `contracts/foundry.toml`, `contracts/remappings.txt`, `contracts/src/PayoutBatch.sol`, `contracts/test/mocks/MockUSDC.sol`, `contracts/test/PayoutBatch.t.sol`, `contracts/script/DeployPayoutBatch.s.sol`, `contracts/README.md` (how to build/test/deploy; no addresses yet), `contracts/project.json`, `contracts/lib/forge-std` + `contracts/lib/openzeppelin-contracts` (git submodules via `forge install foundry-rs/forge-std@v1.9.4 OpenZeppelin/openzeppelin-contracts@v5.1.0`; commit `.gitmodules`), `apps/api/jest.anvil.config.ts`, `apps/api/src/__tests__/anvil/Anvil.ts`, `apps/api/src/__tests__/anvil/Artifacts.ts`, `apps/api/src/__tests__/anvil/Harness.anvil.spec.ts`, `apps/api/src/modules/chains/abi/PayoutBatch.ts`
- Modify: `apps/api/jest.config.ts` (`testPathIgnorePatterns: ['\\.anvil\\.spec\\.ts$']`), `apps/api/project.json` (target `test-anvil`: executor `@nx/jest:jest`, `jestConfig: apps/api/jest.anvil.config.ts`, `dependsOn: ['contracts:build']`), `.prettierignore` (`contracts/lib`, `contracts/out`, `contracts/cache`), `.gitignore` (`contracts/out`, `contracts/cache`, `contracts/broadcast/**/dry-run`), `eslint.config.mjs` (ignore `contracts/**`), `.github/workflows/ci.yml` (add `foundry-rs/foundry-toolchain@v1` with `version: stable` to the `test` and `build` jobs before `npm ci`; add a step `npx nx run api:test-anvil` to the `test` job), `CHANGES.md`

**Contract surface (exact):**

```solidity
// contracts/src/PayoutBatch.sol  — SPDX-License-Identifier: Apache-2.0, pragma solidity 0.8.28
contract PayoutBatch {
    using SafeERC20 for IERC20;
    uint256 public constant MAX_RECIPIENTS = 200;
    error EmptyBatch(); error LengthMismatch(); error TooMany(); error ZeroRecipient(); error ZeroAmount();
    event BatchPaid(address indexed payer, address indexed token, bytes32 indexed batchId, uint256 count, uint256 total);
    function disperse(IERC20 token, address[] calldata recipients, uint256[] calldata amounts, bytes32 batchId) external;
}
// contracts/test/mocks/MockUSDC.sol — ERC20Permit("USD Coin") symbol "USDC", decimals 6, name() "USD Coin", version() "2",
// mint(address,uint256) (test only), blacklist(address,bool) + isBlacklisted(address) (revert string "Blacklistable: account is blacklisted" on transfer/transferFrom/authorizations),
// transferWithAuthorization(from,to,value,validAfter,validBefore,nonce,v,r,s), receiveWithAuthorization(same, requires msg.sender == to),
// authorizationState(address,bytes32), event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce),
// EIP-712 typehash keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)") and the Receive variant.
```

**Harness interface (produced for Tasks 8, 10, 11, 14):**

```ts
// apps/api/src/__tests__/anvil/Anvil.ts
export interface AnvilContext { rpcUrl: string; chainId: 31337; accounts: { deployer: Hex; platform: Hex; buyer: Hex; relayer: Hex; operator: Hex }; addresses: { usdc: Address; payoutBatch: Address; subscriptions: Address | null }; publicClient: PublicClient; Stop(): Promise<void>; Mine(blocks: number): Promise<void> }
export async function StartAnvil(): Promise<AnvilContext>; // spawns `anvil --port <free> --chain-id 31337 --silent`, waits for RPC, deploys MockUSDC + PayoutBatch from contracts/out via viem deployContract (account #0), mints 1_000_000 USDC to platform and buyer, sets process.env (LIVEMODE=false, SETTLEMENT_RAIL=onchain, ETH_CHAIN_ID=31337, ETH_RPC_URL, USDC_ADDRESS, PAYOUT_BATCH_ADDRESS, ETH_CONFIRMATIONS=1, CHECKOUT_RELAYER_KEY=#3, SUBSCRIPTION_OPERATOR_KEY=#4) and calls ResetChainClientsForTests()
export function ReadArtifact(name: 'MockUSDC' | 'PayoutBatch' | 'Subscriptions'): { abi: Abi; bytecode: Hex }; // from contracts/out/<name>.sol/<name>.json
```

**Steps:**
- [ ] `forge init --no-git --force contracts` is not needed; create the files by hand so no sample contracts are added. Run the `forge install` commands from the repo root with `--root contracts` (or `cd contracts && forge install …`).
- [ ] Write `PayoutBatch.t.sol` first: `testDisperseTransfersEachAmount` (3 recipients, balances and `BatchPaid` event), `testRevertsOnLengthMismatch`, `testRevertsOnEmpty`, `testRevertsOnTooMany` (201), `testRevertsWhenAllowanceInsufficient`, `testRevertsWhenRecipientBlacklisted` (expects the mock's revert string), `testFuzzDisperse(uint8 count, uint96 seed)` (sum of balances equals total). Run `forge test` — expect compile failure (contract missing).
- [ ] Implement `MockUSDC.sol` and `PayoutBatch.sol`; `forge test -vv` — expect all pass. `forge fmt --check` clean.
- [ ] Add `contracts/project.json` with `build` (`forge build`) and `test` (`forge test -vv`) run-commands (`cwd: contracts`), and `nx.json` needs no change. Confirm `npx nx run-many --target=test --all` now reports 7 projects.
- [ ] Commit the trimmed ABI to `apps/api/src/modules/chains/abi/PayoutBatch.ts` (`export const PAYOUT_BATCH_ABI = [...] as const`).
- [ ] Write the Anvil harness and `Harness.anvil.spec.ts`: starts Anvil, asserts `decimals() == 6`, platform USDC balance `1_000_000e6`, `PayoutBatch` code present, and that `PAYOUT_BATCH_ABI` deep-equals the `abi` in `contracts/out/PayoutBatch.sol/PayoutBatch.json` (sync guard). Timeout 120 s per test; `afterAll` stops Anvil.
- [ ] CI edits as listed. Append the Task 7 file list to `CHANGES.md`.

**Verification:**
```bash
cd contracts && forge build && forge test -vv && forge fmt --check && cd ..   # expect: Suite result: ok. 7 passed
npx nx run api:test-anvil             # expect: all Harness tests passed
npx nx run-many --target=test --all   # expect: Successfully ran target test for 7 projects
npx nx test api                       # expect: no *.anvil.spec.ts in the run
npm run format:check && npx nx run-many --target=lint --all
```

**Commit:** `feat: add Foundry contracts project with PayoutBatch, mock USDC and an Anvil test lane`

### Task 8: Payouts on Ethereum (build, broadcast, reconcile)

**Files:**
- Create: `apps/api/src/modules/PayoutBatchStore.ts` (CRUD for the `PayoutBatches` collection), `apps/api/src/modules/chains/PayoutEncoding.ts` (pure: `EncodeDisperseCall`, `ComputeBatchId`, `ParsePayoutReceipt`, `MapRevertToFailureCode`), `apps/api/src/__tests__/PayoutEncoding.spec.ts`, `apps/api/src/__tests__/PayoutBatchStore.spec.ts`, `apps/api/src/__tests__/anvil/Payouts.anvil.spec.ts`
- Modify: `apps/api/src/modules/chains/Ethereum.ts` (implement `BuildBatchPayoutTransaction`, `BuildApprovalTransaction`, `BroadcastSignedTransaction`, `WaitForReceipt`, `GetTransactionStatus(hash)`, `GetAccountNonce(address)`, `IsBlacklisted(addresses[])` via multicall), `apps/api/src/modules/chains/types.ts` (`UnsignedPayoutBatch.gas_limit`, `max_fee_per_gas`, `max_priority_fee_per_gas` as strings), `apps/api/src/modules/chains/Settlement.ts` (interface + simulated: `BuildBatchPayoutTransaction` returns `transaction_type: 'payout'`; `BroadcastSignedTransaction` accepts a hash or raw tx), `apps/api/src/modules/Payout.ts` (`BuildPayoutsBatch` with allowance check / approval variant / nonce lock / reconcile-first / blacklist precheck / `MAX_BATCH_RECIPIENTS = 100`; `BroadcastPayoutsBatch` with `signed_transaction | transaction_hash`, pending outcome, failure code mapping; new `ReconcilePayoutBatches(platformAccountId)`), `apps/api/src/modules/SanctionsScreening.ts` (oracle call per §4.8; `CheckWalletAddresses(addresses[])`), `apps/api/src/routes/payouts.routes.ts` (`POST /v1/payouts/reconcile`, docs comments), `libs/shared-schemas/src/lib/PayoutSchema.ts` (`BuildPayoutsBatchSchema.replace?: boolean`, `.max(100)`; `BroadcastPayoutsBatchSchema`: `signed_transaction` optional, `transaction_hash` optional, refine one-of), `libs/shared-types/src/lib/Payout.ts` (`PayoutBatchBuildResponse` gains `transaction_type`, `batch_id`, `gas_limit`, `max_fee_per_gas`, `max_priority_fee_per_gas`, `chain_id`, `nonce`, `to`; `PayoutBatchBroadcastResponse.status` adds `'pending'`; new `PayoutBatch` type; `ReconcileResponse`), `apps/api/src/__tests__/Payout.spec.ts`, `Settlement.spec.ts`, `apps/docs/src/app/pages/docs/data/payouts.ts` (build/broadcast/reconcile pages and samples), `sdks/node/src/resources/Payouts.ts` (`reconcile()` method only; signing lands in Task 9), `CHANGES.md`

**Interfaces produced:**

```ts
// chains/PayoutEncoding.ts
export function ComputeBatchId(payoutIds: string[]): Hex;                                  // keccak256(toBytes([...ids].sort().join(',')))
export function EncodeDisperseCall(token: Address, recipients: TransferRecipient[], batchId: Hex): Hex; // encodeFunctionData(PAYOUT_BATCH_ABI, 'disperse', …) with amounts BigInt(cents) * 10_000n
export function ParsePayoutReceipt(receipt: TransactionReceipt, expected: { payoutBatch: Address; batchId: Hex }): { matched: boolean; count: number; total: bigint };
export function MapRevertToFailureCode(message: string): 'account_frozen' | 'blockchain_error';   // /blacklisted/i → account_frozen
// Payout.ts
async ReconcilePayoutBatches(platformAccountId: string): Promise<{ object: 'payout_reconcile'; reconciled: number; paid: number; failed: number; pending: number }>;
```

**Steps:**
- [ ] Unit tests first (`Payout.spec.ts`, mocked settlement): approval variant when allowance < total; `payout_batch_in_progress` on a second build; timeout → payouts stay `in_transit`, no refund, batch `broadcast` (Review Focus 1, 5); receipt `status: 0` with blacklist message → `failed`, `failure_code: 'account_frozen'`, balance refunded (Review Focus 4); reconcile paths (paid / replaced / still pending); build refuses > 100 and blacklisted recipients. `PayoutEncoding.spec.ts`: deterministic `ComputeBatchId` regardless of order; `EncodeDisperseCall` selector matches `disperse(address,address[],uint256[],bytes32)`; `ParsePayoutReceipt` matches on the `BatchPaid` log.
- [ ] Run `npx nx test api --testPathPattern="Payout"` — expect FAIL.
- [ ] Implement `Ethereum.ts` methods with viem (`estimateGas`, `estimateFeesPerGas`, `getTransactionCount`, `sendRawTransaction`, `waitForTransactionReceipt({ confirmations, timeout: 60_000 })`, `multicall` for `isBlacklisted`), `PayoutBatchStore`, `Payout.ts` logic per §4.3, route, schemas, types, SDK `reconcile()`, docs.
- [ ] Anvil test `Payouts.anvil.spec.ts`: build for 3 recipients → `transaction_type: 'approval'`; sign with platform key (`privateKeyToAccount(...).signTransaction(parseTransaction(unsigned))`) → broadcast → `paid`; build again → `payout` with `batch_id`; sign/broadcast → recipients' `balanceOf` increased by exact amounts; a blacklisted recipient build → 400; a broadcast of a tx with a reverting recipient → `failed`/`account_frozen`.
- [ ] Full suite, anvil lane, lint, format. Append the Task 8 file list to `CHANGES.md`.

**Verification:**
```bash
npx nx test api --testPathPattern="Payout|Settlement"   # expect: PASS incl. the five new behaviours
npx nx run api:test-anvil                                 # expect: Payouts suite passed
npx nx run-many --target=test --all                        # expect: Successfully ran target test for 7 projects
npm run format:check && npx nx run-many --target=lint --all
```

**Commit:** `feat: build, broadcast and reconcile payout batches on Ethereum`

### Task 9: SDK and dashboard payout signing

**Files:**
- Modify (SDK): `sdks/node/src/resources/Payouts.ts` (`sign()` verifies the parsed tx before signing: `to` equals `build.to`, `chainId` equals `build.chain_id`, `from`-derived address equals the platform wallet when `expectedSigner` is passed; new `ensureAllowance(privateKey)` that loops build/approval; `processBatch(privateKey, { limit ≤ 100 })` handles `transaction_type: 'approval'` then retries once; `ProcessPendingResult.status` includes `'pending'`), `sdks/node/src/__tests__/Payouts.spec.ts`, `sdks/node/README.md` (payout section: Ethereum private key, allowance step, gas), `sdks/node/src/index.ts` JSDoc
- Modify (web): `apps/web/src/app/features/account/connected-accounts/services/connected-account-actions.service.ts` (wallet path: `EnsureChain(config.chain_id)` → `WalletService.SendTransaction({ to: build.to, data: <from unsigned tx>, value: 0 })` → broadcast `{ transaction_hash }`; private-key path: `SignTransactionWithPrivateKey` → broadcast `{ signed_transaction }`; approval variant handled with a second confirmation step; `pending` result shows "Submitted, waiting for confirmations" and offers Reconcile), `features/account/connected-accounts/components/payout-modal/payout-modal.component.{ts,html}` (show `estimated_fee` in ETH with 6 decimals, warn when fee > 10 % of amount, show approval step), `data/services/payout.service.ts` (`Reconcile()`), `data/services/config.service.ts` + `libs/shared-types/src/lib/Config.ts` (`PublicConfig.chain_id: number | null`, `PublicConfig.network`), `apps/api/src/routes/config.routes.ts` (populate from `Describe()`), specs for the service and modal
- Modify: `apps/docs/src/app/pages/docs/data/payouts.ts` (SDK snippets: `processAll(process.env.WALLET_PRIVATE_KEY)`), `CHANGES.md`

**Steps:**
- [ ] Failing tests: SDK `sign()` rejects a tx whose `to` differs from `build.to` (`Unsigned transaction does not target the expected contract`); `processBatch` performs approval then payout when the first build returns `transaction_type: 'approval'`; web service spec: wallet path posts `transaction_hash`, private-key path posts `signed_transaction`.
- [ ] Implement, run `npx nx test node-sdk web`, then the full suite. Append to `CHANGES.md`.

**Verification:**
```bash
npx nx test node-sdk && npx nx test web    # expect: PASS
npx nx build node-sdk                      # expect: success; dist has no @solana imports (grep dist/sdks/node for "solana" → none)
npx nx run-many --target=test --all        # expect: Successfully ran target test for 7 projects
npm run format:check && npx nx run-many --target=lint --all
```

**Commit:** `feat: sign Ethereum payout batches from the SDK and the dashboard`

### Task 10: Top-ups by USDC `Transfer` log scanning

**Files:**
- Create: `apps/api/src/modules/ChainCursorStore.ts`, `apps/api/src/__tests__/ChainCursorStore.spec.ts`, `apps/api/src/__tests__/anvil/TopUps.anvil.spec.ts`, `apps/api/src/__tests__/TopUpMonitor.spec.ts` (if missing)
- Modify: `apps/api/src/modules/chains/Ethereum.ts` (`GetIncomingDeposits(address, fromBlock, toBlock)` via `getLogs`; `GetLatestBlockNumber()`; `GetBlockTimestamp(blockNumber)` cached), `apps/api/src/modules/chains/Settlement.ts` (interface signature `GetIncomingDeposits(address: string, range: { fromBlock: bigint; toBlock: bigint }): Promise<IncomingDeposit[]>`; simulated returns `[]`), `apps/api/src/modules/TopUpMonitor.ts` (cursor logic per §4.5: chunks ≤ 2000, ≤ 10 chunks per call, `toBlock = latest - confirmations`, first run `latest - 1000`; `PollWallet` ignores the old `limit`), `apps/api/src/modules/TopUp.ts` (`CreateFromDeposit` writes `metadata.log_index`; `IsDepositProcessed(transactionHash, logIndex)`; `GetProcessedDepositKeys`), `apps/api/src/modules/Balance.ts` (`wallet_native` from `GetNativeBalance`), `apps/api/src/routes/topups.routes.ts` (comments; `check-deposits` body ignores `limit`), `libs/shared-types/src/lib/TopUp.ts` (metadata `log_index`), `apps/api/src/__tests__/TopUp.spec.ts`, `apps/web/src/app/features/account/balance/**` (copy: "Ethereum", confirmations note; Circle faucet link already added), `apps/docs/src/app/pages/docs/data/top-ups.ts`, `fund-platform-wallet.ts` (full rewrite: buy USDC, withdraw on the **Ethereum** network — never Solana/Base/Polygon; keep ETH for gas; confirmations take minutes; Sepolia faucet note for test mode), `balance.ts`, `CHANGES.md`

**Steps:**
- [ ] Failing tests: `TopUp.spec.ts` — two deposits with the same `transactionHash` and different `logIndex` both create top-ups (Review Focus 2); `TopUpMonitor.spec.ts` — cursor advances to `toBlock`, chunking at 2000, respects `latest - confirmations`; `ChainCursorStore.spec.ts` — get/set.
- [ ] Implement; Anvil test: transfer USDC from buyer to platform twice in one tx (use `PayoutBatch.disperse` from the buyer with two entries both pointing at the platform wallet) → `GetIncomingDeposits` returns two entries with distinct `logIndex`; cursor persisted; a second scan returns none.
- [ ] Full suite, anvil lane, docs. Append to `CHANGES.md`.

**Verification:**
```bash
npx nx test api --testPathPattern="TopUp|ChainCursor|Balance"   # expect: PASS
npx nx run api:test-anvil                                        # expect: TopUps suite passed
npx nx run-many --target=test --all                               # expect: Successfully ran target test for 7 projects
npm run format:check && npx nx run-many --target=lint --all
```

**Commit:** `feat: detect USDC top-ups on Ethereum with cursor-based log scanning`

### Task 11: Checkout payments via relayed EIP-3009 authorizations (API)

**Files:**
- Create: `apps/api/src/modules/chains/CheckoutAuthorization.ts` (pure: `SessionNonce(sessionId): Hex`, `BuildTransferAuthorizationTypedData(params): TypedData`, `SplitSignature(sig): { v, r, s }`, `VerifyCheckoutReceipt(receipt, expected): CheckoutPaymentVerification`), `apps/api/src/__tests__/CheckoutAuthorization.spec.ts`, `apps/api/src/__tests__/anvil/Checkout.anvil.spec.ts`
- Modify: `apps/api/src/modules/chains/Ethereum.ts` (`BuildCheckoutPaymentAuthorization`, `RelayCheckoutAuthorization(authorization, signature)` → tx hash, `VerifyCheckoutPayment(hash, expected)` using the receipt + `AuthorizationUsed`, `GetUsdcDomain()` cached), `apps/api/src/modules/chains/Settlement.ts` (interface: `BuildCheckoutPaymentAuthorization(payer, merchant, amountCents, sessionId, expiresAt): Promise<PreparedAuthorization>`, `RelayCheckoutAuthorization(...)`; drop `BuildCheckoutPaymentTransaction`/`ValidateAndBroadcastCheckoutTransaction`; simulated returns `method: 'simulated'` and accepts the existing `sim_sig:` scheme), `apps/api/src/modules/chains/types.ts` (`PreparedAuthorization { method: 'eip3009_transfer' | 'simulated'; typed_data: TypedData | null; authorization: { from; to; value: string; valid_after: number; valid_before: number; nonce: Hex } | null; estimated_fee; fee_currency; chain_id }`), `apps/api/src/modules/CheckoutPayment.ts` (`PreparedCheckoutPayment` per §4.4; `PreparePayment` → authorization; `ConfirmPayment(urlSlug, body: { signature?: Hex; transaction_hash?: Hex; … })`: relay → persist `payment_details.transaction_hash` → wait ≤ `CHECKOUT_CONFIRM_TIMEOUT_MS` → verify → complete; `payment_pending` AppError 409 with `transaction_hash`), `apps/api/src/modules/CheckoutSession.ts` (helper `SetPaymentTransactionHash`), `apps/api/src/modules/AppConfig.ts` (`GetCheckoutConfirmTimeoutMs()`), `apps/api/src/routes/paymentPages.routes.ts` (confirm body shape), `libs/shared-schemas/src/lib/CheckoutSessionSchema.ts` (`ConfirmCheckoutPaymentSchema`: `signature` hex 132 chars | `transaction_hash` hex 66 chars | subscription fields from Task 14 later), `libs/shared-types/src/lib/CheckoutSession.ts` (`CheckoutPaymentTransaction` moves here from the web service; `payment_details.relayed`), `apps/api/src/modules/Charge.ts:284,404` (`network` from `Describe()`), `apps/api/src/__tests__/CheckoutPayment.spec.ts`, `Settlement.spec.ts`, `apps/docs/src/app/pages/docs/data/checkout-sessions.ts`, `payment-intents.ts`, `charges.ts`, `payment-links.ts` (payment flow prose: "sign an authorization; no ETH needed"), `CHANGES.md`

**Steps:**
- [ ] Failing tests in `CheckoutAuthorization.spec.ts`: `SessionNonce('cs_z_1')` equals `keccak256(toBytes('cs_z_1'))`; typed data has `primaryType: 'TransferWithAuthorization'`, domain `{ name, version: '2', chainId, verifyingContract }`, `message.value` is `amount × 10_000` as string; `VerifyCheckoutReceipt` rejects when the `AuthorizationUsed.nonce` differs or `Transfer.to` is not the merchant (Review Focus 3), accepts `value ≥ expected`, extracts `payer_address` from `Transfer.from`. `CheckoutPayment.spec.ts`: confirm persists the hash before waiting; `payment_pending` on timeout; retry with `transaction_hash` completes without re-relaying.
- [ ] Implement; Anvil test: buyer signs the typed data with `privateKeyToAccount(buyer).signTypedData`, `RelayCheckoutAuthorization` from the relayer, `VerifyCheckoutPayment` returns verified with the buyer as payer; a second relay of the same authorization reverts (used nonce); a tampered `to` fails verification.
- [ ] Full suite, anvil lane, docs. Append to `CHANGES.md`.

**Verification:**
```bash
npx nx test api --testPathPattern="CheckoutAuthorization|CheckoutPayment|Settlement|Charge"   # expect: PASS
npx nx run api:test-anvil                                                                     # expect: Checkout suite passed
npx nx run-many --target=test --all                                                            # expect: Successfully ran target test for 7 projects
npm run format:check && npx nx run-many --target=lint --all
```

**Commit:** `feat: relay EIP-3009 USDC authorizations for hosted checkout`

### Task 12: Hosted checkout on Ethereum (web)

**Files:**
- Modify: `apps/web/src/app/data/services/checkout-session.service.ts` (import `CheckoutPaymentTransaction` from shared-types; `ConfirmPayment(urlSlug, { signature } | { transaction_hash })`), `apps/web/src/app/features/checkout/checkout.component.{ts,html}` (pay flow: `Connect` → `EnsureChain(session chain)` → `PreparePayment` → `SignTypedData(prepared.typed_data)` → `ConfirmPayment({ signature })`; on `payment_pending` poll confirm with the hash every 4 s up to 5 min; copy "Paying with USDC on Ethereum"; remove the two-step subscription copy until Task 15), `features/checkout/util/mobile-wallet.ts` (verify MetaMask / Coinbase Wallet deep-link formats against their current docs and record the sources in the file header), `shared/ui/wallet-guide/wallet-guide.component.{html,ts}` (MetaMask guide), `features/checkout/checkout.component.spec.ts`, `core/services/wallet.service.ts` (any gaps found), `apps/docs/src/app/pages/docs/data/quickstart.ts`, `payment-link-quickstart` page if present, `CHANGES.md`

**Steps:**
- [ ] Failing component spec: with a fake provider the pay button triggers `eth_signTypedData_v4` with the prepared typed data and posts `{ signature }`; a `payment_pending` response leads to a retry with `transaction_hash`; simulated mode still uses the test wallet dialog.
- [ ] Implement; run `npx nx test web`; serve `npm run dev` with `SETTLEMENT_RAIL=simulated` and complete a payment link checkout manually (Mongo via `docker compose up mongodb -d`).
- [ ] Append to `CHANGES.md`.

**Verification:**
```bash
npx nx test web                        # expect: PASS
npx nx build web --configuration=production   # expect: success, no Solana chunks (grep dist/apps/web for "solana" → none)
npx nx run-many --target=test --all    # expect: Successfully ran target test for 7 projects
npm run format:check && npx nx run-many --target=lint --all
```

**Commit:** `feat: sign checkout authorizations with EIP-6963 wallets`

### Task 13: `Subscriptions.sol` with Foundry tests

**Files:**
- Create: `contracts/src/Subscriptions.sol` (surface exactly as §4.6), `contracts/src/interfaces/IERC20Permit.sol` only if OZ's is not used directly, `contracts/test/Subscriptions.t.sol`, `contracts/script/DeploySubscriptions.s.sol`, `apps/api/src/modules/chains/abi/Subscriptions.ts`
- Modify: `apps/api/src/__tests__/anvil/Anvil.ts` (deploy `Subscriptions`, set `SUBSCRIPTIONS_ADDRESS`), `apps/api/src/__tests__/anvil/Harness.anvil.spec.ts` (ABI sync guard for Subscriptions), `contracts/README.md`, `CHANGES.md`

**Steps:**
- [ ] Tests first in `Subscriptions.t.sol`: plan creation and key derivation; `subscribe` by subscriber; `subscribeWithPermit` relayed by a third party with a permit signature from the subscriber (use `vm.sign`); `charge` succeeds immediately after subscribe (first charge due now), reverts `NotDueYet` before the period elapses, succeeds after `vm.warp`, `nextChargeAt` advances by exactly `periodSeconds`; `charge` with `amount > plan.amount` reverts; only the puller can charge; cancel by subscriber and by owner, not by a stranger; pause blocks charge, resume sets `nextChargeAt = now + period`; `deactivatePlan` blocks new subscribes; `setPlanDestination` affects where `charge` sends; fuzz `testFuzzChargeSchedule(uint64 period, uint8 cycles)`; an invariant that total charged over N cycles ≤ N × amount.
- [ ] Implement with OZ `EIP712`, `ECDSA`, `SafeERC20`, `IERC20Permit`; no `Ownable`, no proxy.
- [ ] `forge test -vv`, `forge fmt --check`; export the ABI to `abi/Subscriptions.ts`; extend the harness; run the anvil lane.
- [ ] Append to `CHANGES.md`.

**Verification:**
```bash
cd contracts && forge test -vv --match-contract Subscriptions && forge fmt --check && cd ..   # expect: all pass incl. fuzz/invariant
npx nx run api:test-anvil             # expect: Harness suite passes with Subscriptions deployed
npx nx run-many --target=test --all   # expect: Successfully ran target test for 7 projects
```

**Commit:** `feat: add Subscriptions contract for allowance-based recurring pulls`

### Task 14: Subscriptions on Ethereum (API: plans, subscribe, collect, billing)

**Files:**
- Create: `apps/api/src/modules/chains/SubscriptionAuthorization.ts` (pure: `BuildPermitTypedData`, `BuildSubscribeTypedData`, `PlanIdFromPriceId(priceId): Hex` (bytes32 keccak of the price id), `SubscriptionIdFor(planKey, subscriber): Hex`), `apps/api/src/__tests__/SubscriptionAuthorization.spec.ts`, `apps/api/src/__tests__/anvil/Subscriptions.anvil.spec.ts`
- Modify: `apps/api/src/modules/chains/Ethereum.ts` (`CreateSubscriptionPlan` → `createPlan` tx from the operator key, returns `planKey`; `BuildSubscribeAuthorization(subscriber, planKey)` → `{ needs_permit, permit_typed_data?, subscribe_typed_data, deadline }` (checks `allowance`); `RelaySubscribe(planKey, subscriber, permitSig?, subscribeSig, deadline)` → tx hash; `VerifySubscribeTransaction` via `Subscribed` event; `FindExistingSubscription` via `subscriptions(subId)` view; `CollectSubscriptionPayment` → `charge(subId, amount)` from the operator key, `NotDueYet` → `alreadyCollected: true`), `apps/api/src/modules/chains/Settlement.ts` (interface + simulated equivalents; remove `BuildSubscribeTransaction`), `apps/api/src/modules/chains/types.ts` (`PreparedSubscribe`), `apps/api/src/modules/Price.ts` (`subscription_plan_id = planKey`; period in seconds = hours × 3600), `apps/api/src/modules/CheckoutPayment.ts` (subscription prepare returns `subscription: { plan_id, needs_permit, permit_typed_data, subscribe_typed_data, deadline, already_subscribed, subscription_onchain_id }`; confirm accepts `{ permit_signature?, subscribe_signature, deadline }` or `{ transaction_hash }`; first-period collect unchanged), `apps/api/src/modules/Invoice.ts:1655-1725` (field names; error text "wait for the next billing period"), `apps/api/src/modules/SubscriptionBilling.ts`, `BillingMonitor.ts` (comments), `apps/api/src/modules/Subscription.ts` (on cancel with `subscription_onchain_id`, call `cancel(subId)` from the operator key when on-chain — best effort, logged), `apps/api/src/routes/paymentPages.routes.ts`, `libs/shared-schemas/src/lib/CheckoutSessionSchema.ts` (`ConfirmCheckoutPaymentSchema` subscription fields), `libs/shared-types/src/lib/CheckoutSession.ts`, `apps/api/src/__tests__/{CheckoutPayment,Price,Invoice,SubscriptionBilling,Settlement}.spec.ts`, `apps/docs/src/app/pages/docs/data/subscriptions.ts`, `prices.ts`, `invoices.ts`, `billing.ts`, `environment-variables.ts` (`SUBSCRIPTION_OPERATOR_KEY` format and gas note), `CHANGES.md`

**Steps:**
- [ ] Failing tests: typed data shapes; `PlanIdFromPriceId` deterministic 32-byte; `CheckoutPayment` subscription prepare includes permit typed data only when `needs_permit`; confirm relays and finalises; `Invoice` collect maps `alreadyCollected` to the existing warning path; `Price` passes `period_seconds` and stores `planKey`.
- [ ] Implement; Anvil test: create a recurring price plan from the operator → subscriber signs permit + subscribe → relay → `VerifySubscribeTransaction` ok → `CollectSubscriptionPayment` moves `amount` to the destination → immediate second collect returns `alreadyCollected` → `anvil` `evm_increaseTime` past the period → collect succeeds again.
- [ ] Full suite, anvil lane, docs. Append to `CHANGES.md`.

**Verification:**
```bash
npx nx test api --testPathPattern="Subscription|Price|Invoice|CheckoutPayment|Settlement"   # expect: PASS
npx nx run api:test-anvil                                                                  # expect: Subscriptions suite passed
npx nx run-many --target=test --all                                                         # expect: Successfully ran target test for 7 projects
npm run format:check && npx nx run-many --target=lint --all
```

**Commit:** `feat: run subscription plans, subscribes and pulls on the Subscriptions contract`

### Task 15: Subscription checkout and dashboard (web)

**Files:**
- Modify: `apps/web/src/app/features/checkout/checkout.component.{ts,html}` (subscription mode: sign permit (if `needs_permit`) then subscribe typed data; one confirm call; copy "First-time wallets approve twice"; `already_subscribed` path), `data/services/checkout-session.service.ts`, `features/checkout/checkout.component.spec.ts`, `features/account/subscriptions/**` (show `subscription_onchain_id` with an explorer link; cancel copy mentions the on-chain cancel and that revoking the USDC allowance also stops pulls), `features/account/products/**` (recurring price shows `subscription_plan_id`), `apps/docs/src/app/pages/docs/data/subscriptions.ts` (customer-facing flow), `CHANGES.md`

**Steps:**
- [ ] Failing spec: two `eth_signTypedData_v4` calls when `needs_permit`, one otherwise; confirm payload carries both signatures and `deadline`.
- [ ] Implement; `npx nx test web`; manual simulated-rail run of a subscription payment link.
- [ ] Append to `CHANGES.md`.

**Verification:**
```bash
npx nx test web && npx nx build web --configuration=production   # expect: PASS / success
npx nx run-many --target=test --all                               # expect: Successfully ran target test for 7 projects
npm run format:check && npx nx run-many --target=lint --all
```

**Commit:** `feat: subscribe with permit and subscribe signatures in hosted checkout`

### Task 16: Docs, copy and agent-skill sweep (zero Solana mentions, honest gas copy)

**Files:**
- Modify (docs data, all 30 files listed by `git grep -lIi solana -- apps/docs`): `payouts.ts`, `external-wallets.ts` (wallet address samples → EIP-55 addresses such as `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`, `last4` → last four hex chars, "Ethereum address (42 characters)"), `accounts.ts`, `top-ups.ts`, `fund-platform-wallet.ts` (verify Task 10's rewrite), `checkout-sessions.ts`, `charges.ts`, `migrate-from-stripe.ts`, `build-a-marketplace.ts`, `customers.ts`, `payment-intents.ts`, `payment-links.ts`, `invoices.ts`, `subscriptions.ts`, `local-development.ts`, `event-types.ts`, `environment-variables.ts`, `agent-marketplace-quickstart.ts`, `agent-payments-quickstart.ts`, `webhook-endpoints.ts`, `platform-dashboard.ts`, `billing.ts`, `transfers.ts`, `self-hosting.ts`, `quickstart.ts`, `marketplace-quickstart.ts`, `balance.ts`, `authentication.ts`, `api-quickstart.ts`, `account-links.ts`, `apps/docs/scripts/generate-agent-docs.ts:35` + its test
- Modify (copy): `README.md` (tagline: "No platform fees. You pay Ethereum network gas."; feature blurbs "pay with USDC on Ethereum"), `apps/web/src/app/features/setup/setup.component.html` (§4.9 wording; funding bullet "Fund your wallet with ETH (for gas) and USDC"), `apps/web/src/app/shared/ui/wallet-guide/**`, `.agents/skills/zoneless-marketplace/SKILL.md`, `.agents/skills/zoneless-payments/SKILL.md` (Ethereum vocabulary; `WALLET_PRIVATE_KEY`; gas note; batch guidance), `AGENTS.md`, `CONTRIBUTING.md` (final wording), `sdks/node/README.md`, `apps/cli/README.md`
- Create: `apps/docs/src/app/pages/docs/data/gas-and-fees.ts` (new guide page: the §4.9 table as estimates, how to read `estimated_fee`, batching, minimum payout guidance) and register it in `data/index.ts`, `data/guides.ts` (or wherever guides are listed) and `docs-catalog.ts`
- Modify: `CHANGES.md`

**Steps:**
- [ ] Run the grep gates below, fix every hit; add the gas page; run `npx nx test docs` and `npx nx build docs --configuration=production`.
- [ ] Append to `CHANGES.md`.

**Verification:**
```bash
git grep -n -i -I "solana\|lamport\|devnet\|phantom\|solflare\|backpack\|\bSOL\b\|faucet.solana" -- ':!package-lock.json' ':!CHANGES.md' ':!NOTICE' ':!docs/plans'   # expect no output
git grep -n -i -I "near-zero fees\|fractions of a cent\|no fees" -- README.md apps/web/src apps/docs/src .agents   # expect no output
npx nx test docs && npx nx build docs --configuration=production   # expect: PASS / success
npx nx run-many --target=test --all   # expect: Successfully ran target test for 7 projects
npm run format:check && npx nx run-many --target=lint --all
```

**Commit:** `docs: describe the Ethereum rail, gas costs and wallet setup; remove Solana copy`

### Task 17: Centralise the brand and prepare the rename script

**Files:**
- Create: `libs/shared-types/src/lib/Brand.ts`, `scripts/rebrand.sh`, `scripts/rebrand.spec.sh` (bats-free: a bash self-test that runs the script in `--dry-run` mode on a temp copy and checks counts), `apps/api/src/__tests__/IdGenerator.spec.ts` (if missing)
- Modify: `libs/shared-types/src/index.ts` (export `BRAND`), `apps/api/src/utils/IdGenerator.ts` (`GenerateId(prefix)` inserts `BRAND.idInfix`: `GenerateId('po')` → `po_z_…`; `GenerateApiKey(mode)` → `sk_${mode}_${infix}_…` if such a helper exists, otherwise the two call sites in `ApiKey.ts`), every `GenerateId('xxx_z')` call site in `apps/api/src/modules/**` (≈45, listed by `git grep -n "GenerateId('[a-z_]*_z'" apps/api/src`) → drop the `_z`, `apps/api/src/middleware/Authorization.ts:266-269` + `routes/balance.routes.ts:49` + `routes/balanceTransactions.routes.ts:38` (header name from `BRAND.connectedAccountHeader`), `sdks/node/src/HttpClient.ts` (header name from `BRAND`), `apps/web/src/app/core/services/api.service.ts` (same), tests asserting `_z_` literals (keep passing: they still see `z`), `apps/api/src/__tests__/Setup.ts` `DeterministicId` (insert infix), `CHANGES.md`

**`BRAND` (exact):**
```ts
export const BRAND = { productName: 'Zoneless', packageScope: '@zoneless', idInfix: 'z', connectedAccountHeader: 'zoneless-account', envPrefix: 'ZONELESS', cliBin: 'zoneless' } as const;
```

**`scripts/rebrand.sh <name> <Name> <infix>`** (idempotent; `--dry-run` prints per-pattern hit counts and exits 0 without writing):
1. `BRAND` values → arguments.
2. `@zoneless/` → `@<name>/` in all `package.json`, `tsconfig*.json`, `*.ts` imports, `project.json`, docs snippets.
3. `Zoneless` → `<Name>`, `zoneless` → `<name>`, `ZONELESS_` → `<NAME>_` in `apps/`, `libs/`, `sdks/`, `docker/`, `docker-compose.yml`, `.env*.example`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `AGENTS.md`, `.github/`, `.agents/` (rename the two skill directories too); never touches `LICENSE`, `NOTICE`, `CHANGES.md`, `docs/plans/`, `package-lock.json`, `contracts/lib/`.
4. Prints the follow-ups the human must run: `npm install` (lockfile), `npx nx run-many --target=test --all`, `npm run format`, review `git diff --stat`.

**Steps:**
- [ ] Failing test `IdGenerator.spec.ts`: `GenerateId('po')` matches `/^po_z_[0-9A-Za-z]{16}$/`; `GenerateId('acct')` matches `/^acct_z_/`.
- [ ] Implement `BRAND`, the generator, the call-site sweep, the header constant, the script and its self-test.
- [ ] Append to `CHANGES.md`.

**Verification:**
```bash
git grep -n "GenerateId('[a-z_]*_z'" -- apps/api/src   # expect no output
git grep -n "'zoneless-account'" -- apps/api/src sdks/node/src apps/web/src   # expect no output (only BRAND defines it)
bash scripts/rebrand.sh --dry-run acme Acme a           # expect: a table of hit counts and "dry run: no files written"
bash scripts/rebrand.spec.sh                            # expect: rebrand.spec.sh: OK
npx nx run-many --target=test --all   # expect: Successfully ran target test for 7 projects
npm run format:check && npx nx run-many --target=lint --all
```

**Commit:** `refactor: centralise brand tokens and add a rebrand script`

### Task 18: Sepolia deployment and live testnet verification — HUMAN INPUT NEEDED

This is the only task that touches a public network. Before starting, the implementer asks the user for: (1) a Sepolia RPC URL (Alchemy/Infura/public), (2) a funded Sepolia deployer key (≈ 0.2 Sepolia ETH), (3) a funded platform wallet key (≈ 0.1 Sepolia ETH + Sepolia USDC from `https://faucet.circle.com`), (4) relayer and operator keys (≈ 0.05 Sepolia ETH each), (5) a buyer key with Sepolia USDC in a browser wallet. Keys go in a local `.env` that is never committed.

**Files:**
- Modify: `apps/api/src/modules/chains/contracts.ts` (Sepolia `payoutBatch` and `subscriptions` addresses), `contracts/README.md` (deployment record: addresses, tx hashes, Etherscan verification links, forge version), `contracts/broadcast/**/11155111/run-latest.json` (commit forge's broadcast log), `.env.production.example` (comment with the Sepolia addresses), `CHANGES.md`
- Create: `docs/plans/2026-10-27-sepolia-verification.md` (checklist results with tx hashes)

**Steps:**
- [ ] Pre-flight with `cast`: `cast call <USDC_SEPOLIA> "decimals()(uint8)" --rpc-url $ETH_RPC_URL` → `6`; `cast call <USDC_SEPOLIA> "name()(string)"` and `"version()(string)"` → record; `cast call <USDC_SEPOLIA> "authorizationState(address,bytes32)(bool)" <buyer> 0x00…01` → `false` (proves EIP-3009 surface); `cast code 0xcA11bde05977b3631167028862bE2a173976CA11` non-empty (Multicall3). Record each in the verification doc; if any fails, stop and report.
- [ ] `forge script script/DeployPayoutBatch.s.sol --rpc-url $ETH_RPC_URL --broadcast --verify` (Etherscan API key optional; if absent, verify later) and the same for `DeploySubscriptions.s.sol`; write the addresses into `contracts.ts`.
- [ ] Run the API with `LIVEMODE=false SETTLEMENT_RAIL=onchain ETH_RPC_URL=… ETH_CONFIRMATIONS=2` and the web; complete: setup with the platform address → `check-deposits` detects a faucet USDC transfer (top-up) → create a payment link, pay with the buyer wallet (EIP-3009) → create a recurring price (plan tx), subscribe (permit + subscribe), run `POST /v1/billing/run_for_platform` after the period (use an `hour` interval) → create a transfer + payout, approve once, build/sign/broadcast a batch from the dashboard and another from the SDK (`processAll`) → `reconcile` reports nothing pending.
- [ ] Record every tx hash and the observed gas used per operation in the verification doc; compare with §4.9 and correct the gas page if off by more than 25 %.
- [ ] Append to `CHANGES.md`.

**Verification:**
```bash
cast call <PAYOUT_BATCH_SEPOLIA address from contracts.ts> "MAX_RECIPIENTS()(uint256)" --rpc-url $ETH_RPC_URL   # expect: 200
test -f docs/plans/2026-10-27-sepolia-verification.md && grep -c "0x" docs/plans/2026-10-27-sepolia-verification.md   # expect: ≥ 8 recorded hashes/addresses
npx nx run-many --target=test --all   # expect: Successfully ran target test for 7 projects (no test depends on Sepolia)
```

**Commit:** `chore: deploy PayoutBatch and Subscriptions to Sepolia and record testnet verification`

### Task 19: NOT EXECUTED — human-gated: audit, mainnet, rebrand flip, publishing

No implementer runs this task. It records what must happen before any live-mode use.

- [ ] Choose `<NEWNAME>`; run `bash scripts/rebrand.sh <name> <Name> <infix>`, then `npm install`, full suite, format; update `NOTICE`/`CHANGES.md` placeholders; rename the GitHub repository and the `@<name>/node`, `@<name>/cli` npm scopes; decide whether to publish at all (`publishConfig.access` stays `public` only if yes).
- [ ] Legal review of `NOTICE` and the §4(b) file-header policy by counsel; confirm the removed upstream copy (PromptBase, Discord, blog links) has no residue (`git grep -i zoneless` → only `NOTICE`, `CHANGES.md`, `LICENSE`).
- [ ] Independent security audit of `contracts/src/PayoutBatch.sol` and `contracts/src/Subscriptions.sol` (scope: allowance handling, signature replay, period arithmetic, access control); fix findings on Sepolia first (Task 18 flow re-run).
- [ ] Mainnet deployment (`forge script … --rpc-url <mainnet> --broadcast --verify`) from a hardware-wallet-backed deployer; fill `contracts.ts` chain `1` entries; verify Multicall3 and the Chainalysis oracle addresses on Etherscan before enabling `SANCTIONS_ORACLE_ADDRESS` for chain 1; confirm mainnet USDC `name()`/`version()` and that `DOMAIN_SEPARATOR()` matches the API's typed-data domain.
- [ ] Operational readiness: dedicated low-balance alerting for the relayer and operator keys; RPC provider contract with a fallback URL; incident runbook for stuck/replaced payout batches (`replace: true`) and for USDC blacklisting of a counterparty.
- [ ] Compliance: the operator carries money-transmission, AML/KYC and sanctions obligations in their jurisdiction; upstream's terms disclaimed them and this fork does not change that. Document it in the self-hosting guide.

---

## 7. Risks

- **Smart-contract security.** Two new contracts hold no funds but move funds under allowances. `PayoutBatch` is stateless and only moves `msg.sender`'s tokens; `Subscriptions` enforces per-period amount caps but a bug there could drain a subscriber's allowance up to `MaxUint256`. Mitigations: fuzz/invariant tests (Tasks 7, 13), no admin/upgrade surface, Sepolia soak (Task 18), external audit before mainnet (Task 19), documented allowance revocation for subscribers.
- **Key handling.** The platform treasury key never touches the server (SDK/dashboard sign). The relayer and operator keys live in env on the API host, hold only gas ETH, and can at most relay user-signed authorizations or pull ≤ plan amount per period to the plan destination. Rotate by changing env and re-pointing plan pullers (`setPlanPuller`). Never log keys; `AppConfig` validates format at startup.
- **RPC reliability and rate limits.** viem `fallback()` across `ETH_RPC_URL` entries with retries; log scanning is chunked; confirmations are polled with timeouts; every on-chain wait path tolerates a missing receipt (payouts stay `in_transit`, checkout returns `payment_pending`). Public RPCs are fine for Sepolia, not for production.
- **MEV / front-running.** EIP-3009 authorizations are bound to `from/to/value/nonce`; a front-runner can only execute the identical transfer and pay our gas. Payout batches and approvals have no price exposure. On-chain privacy is nil: payout graphs are public on Etherscan, as they were on Solana explorers.
- **USDC blacklisting and pausing.** Circle can freeze addresses or pause the token; transfers revert. Build-time `isBlacklisted` checks fail fast; receipts with `status: 0` map to `account_frozen`; a paused token stops every flow — surface the revert reason in `failure_message`.
- **Reorgs.** `ETH_CONFIRMATIONS` (default 2) bounds the risk for checkout and top-ups; a reorg deeper than that after a credit is not handled (would require reversing a balance). Operators who want stronger guarantees raise the value (Open decision 4).
- **Gas economics.** L1 gas is 100–1000× Solana's fee; low-value payouts can cost more in gas than they deliver. The product copy, the gas page and the dashboard warning (Task 16, Task 9) make this visible; the design does not hide it.
- **Compliance.** The operator carries money-transmission, AML/KYC and sanctions-screening obligations for their jurisdiction; upstream's terms disclaim them and nothing in this fork assumes them for the operator.

## 8. Open decisions (each has a default; none blocks execution)

1. **Payout batching mechanism.** Default: `PayoutBatch` contract with a one-time `MaxUint256` approval (§4.3 A). Alternative: EIP-7702 delegation later for ~20 % lower gas and no allowance.
2. **Checkout path.** Default: EIP-3009 relay only; no plain `transfer` fallback (keeps session binding exact and buyers gas-free). Alternative: add a buyer-pays `transfer` + hash-confirm path for wallets that cannot sign typed data.
3. **Relayer key requirement.** Default: `CHECKOUT_RELAYER_KEY` is required whenever `SETTLEMENT_RAIL=onchain`; the API refuses to start on-chain checkout without it. Alternative: optional with checkout disabled.
4. **Confirmations.** Default: `ETH_CONFIRMATIONS=2` for every flow. Alternative: 1 for checkout UX, `safe` tag for top-ups above a threshold.
5. **§4(b) notice style.** Default: `CHANGES.md` for all files plus a one-line header on substantively rewritten/new files. Alternative: header on every modified file.
6. **Telemetry.** Default: removed entirely (Task 2). Alternative: re-point to an operator-owned endpoint later.
7. **CLI hosted provisioning.** Default: keep the command but require `--auth-url`/`--activation-url` (Task 3). Alternative: delete `AgentSetup` and its specs.
8. **Permit allowance size for subscriptions.** Default: `MaxUint256`, bounded by the contract's per-period cap. Alternative: `amount × 12` periods with a re-permit prompt.
9. **WalletConnect.** Default: deferred; mobile via MetaMask/Coinbase deep links. Alternative: add `@walletconnect/ethereum-provider` with a project id.
10. **Contract governance.** Default: no owner, no pause, non-upgradeable. Alternative: an `Ownable2Step` guardian with a pause switch on `Subscriptions`.
11. **Smart-contract wallet buyers (EIP-1271).** Default: rely on FiatTokenV2_2's `SignatureChecker` support, verified only if a Safe is available in Task 18. Alternative: explicitly block contract accounts at checkout prepare.
12. **`MAX_BATCH_RECIPIENTS`.** Default: 100 (API) / 200 (contract cap). Alternative: 50 to keep batch gas under ~2.6 M.
13. **Sanctions source.** Default: static set ∪ Chainalysis oracle when configured; RPC failure logs and does not block. Alternative: fail closed.
14. **Brand tokens.** Default placeholders until the user chooses: `<NEWNAME>`, infix `n`, header `<newname>-account`. The script takes them as arguments.
15. **Price/gas figures in docs.** Default: show formulas and a labelled-estimate table; the dashboard shows the live `estimated_fee`. Alternative: no USD figures at all.
16. **Minimum payout policy.** Default: warn in the dashboard when `estimated_fee > 10 %` of the payout amount; no hard block. Alternative: a platform setting `minimum_payout_amount`.
17. **Anvil tests in CI.** Default: `api:test-anvil` runs in CI after `foundry-toolchain` (Task 7). Alternative: local-only lane.
18. **Node version.** Default: keep `.nvmrc` at 20 (CI) while developing on 22. Alternative: bump to 22 in a separate chore.
