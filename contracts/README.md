# Contracts

Solidity contracts for the Ethereum settlement rail, built with [Foundry](https://book.getfoundry.sh/) (`solc 0.8.28`, EVM `cancun`, optimizer 200 runs).

| Path                            | What it is                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/PayoutBatch.sol`           | Pays up to 200 recipients from the caller's own token balance in one all-or-nothing transaction and emits `BatchPaid`. Each payer can pay a batch id once (`paid(payer, batchId)`), and never after the batch's `deadline` (`BatchExpired`). No admin, non-upgradeable, no ETH handling. The platform wallet approves it once.      |
| `src/Subscriptions.sol`         | Recurring pulls from a subscriber's bounded allowance. A plan owner registers a plan (token, amount, period, destination, puller); its puller may then take at most the plan amount once per billing period from each subscriber. No admin, no pause switch, non-upgradeable, no ETH handling. See [Subscriptions](#subscriptions). |
| `test/mocks/MockUSDC.sol`       | **Test only.** A FiatTokenV2 stand-in for Anvil: 6 decimals, EIP-2612 `permit`, EIP-3009 `transferWithAuthorization` / `receiveWithAuthorization`, `AuthorizationUsed`, and an open `mint` / `blacklist` hook. Never deploy it to a public network.                                                                                 |
| `test/mocks/Mock1271Wallet.sol` | **Test only.** A contract wallet that accepts, through EIP-1271, exactly its one signer key's signatures.                                                                                                                                                                                                                           |
| `script/`                       | Deployment scripts (`forge script`).                                                                                                                                                                                                                                                                                                |
| `lib/`                          | `forge-std` v1.9.4 and `openzeppelin-contracts` v5.1.0 as git submodules.                                                                                                                                                                                                                                                           |

## Setup

Install Foundry 1.5.1 (the version CI pins), then fetch the submodules. OpenZeppelin's own nested submodules are not needed:

```bash
git submodule update --init
```

## Build and test

From the repository root:

```bash
npx nx run contracts:build   # forge build
npx nx run contracts:test    # forge test -vv (unit, fuzz and invariant tests)
npx nx run api:test-anvil    # API integration tests against a local Anvil chain
```

Or from `contracts/`:

```bash
forge build
forge test -vv
forge fmt --check
```

`api:test-anvil` builds the contracts first, starts `anvil` on a free port, deploys `MockUSDC`, `PayoutBatch` and `Subscriptions` from `contracts/out` and runs `apps/api/src/__tests__/anvil/*.anvil.spec.ts`. It needs no RPC provider and no funds.

If `forge test` reports `No tests found` after running `forge lint`, clear the compiler cache with `forge clean`.

## Deploy

Deploy with an encrypted keystore account (`cast wallet import deployer --interactive`) or a hardware wallet rather than a raw private key:

```bash
cd contracts
forge script script/DeployPayoutBatch.s.sol --rpc-url "$ETH_RPC_URL" --account deployer --broadcast
forge script script/DeploySubscriptions.s.sol --rpc-url "$ETH_RPC_URL" --account deployer --broadcast
```

Then set `PAYOUT_BATCH_ADDRESS` and `SUBSCRIPTIONS_ADDRESS` to the logged addresses, or add them to the per-chain table in `apps/api/src/modules/chains/contracts.ts`. Without `--broadcast` the scripts only simulate.

`Subscriptions` must be externally audited before it is deployed to Ethereum mainnet.

## Subscriptions

- **Plans.**
  - `createPlan(planId, token, amount, periodSeconds, destination, puller)` registers a plan owned by the caller under `planKey = keccak256(abi.encode(owner, planId))`.
  - The period is 1 second to 10 years (`MAX_PERIOD_SECONDS`).
  - The token must be a standard ERC-20. Fee-on-transfer tokens are not supported: the destination would receive less than `Charged` reports.
  - The token, amount and period never change, and a plan key cannot be registered twice (`PlanExists`).
  - The owner can change the destination (`setPlanDestination`) and the puller (`setPlanPuller`), and can stop new subscriptions for good (`deactivatePlan`). Existing subscriptions keep billing.
  - The API uses the subscription operator key as both owner and puller, and the platform wallet as the destination.
- **Subscribing.**
  - A subscription's id is `subId = keccak256(abi.encode(planKey, subscriber))`.
  - `subscriptions(subId)` returns its plan key, subscriber, next due time, status (`None`, `Active`, `Paused`, `Canceled`) and who paused it (`PausedBy`: `None`, `Subscriber`, `Owner`).
  - A wallet subscribes itself with `subscribe(planKey)`, paying the gas.
  - A relayer can subscribe it with `subscribeWithAuthorization(planKey, subscriber, terms, deadline, sig)`.
    - `sig` is the subscriber's EIP-712 signature over `Subscribe(bytes32 planKey,address subscriber,address token,uint256 amount,uint64 periodSeconds,uint256 nonce,uint256 deadline)`.
    - `nonce` is `nonces(subscriber)`, read right before signing.
    - The domain is name `Subscriptions`, version `1`, the chain id and the contract address (`eip712Domain()`).
    - `terms` is the struct `(token, amount, periodSeconds)` and must equal the plan's, else `TermsMismatch`. It is one struct because twelve separate arguments would not decode without the IR pipeline.
    - The wallet prompt therefore shows the token, amount and period being agreed to.
    - The deadline is inclusive, and short deadlines are expected.
  - `subscribeWithPermit` first applies the subscriber's EIP-2612 `permit` for this contract on the plan's token, so a first-time subscriber needs no ETH. If someone submits that permit first, the subscribe still goes through.
  - Signatures are checked with OpenZeppelin `SignatureChecker`: ECDSA for externally owned accounts, EIP-1271 for contract wallets. A contract wallet whose token has no EIP-1271 `permit` calls `approve` and then `subscribe` itself.
  - `subscribe` and `cancel` both use up the subscriber's nonce. Once a subscription is cancelled, no `Subscribe` signature handed out earlier can bring it back.
  - A subscriber who cancels may subscribe again, which starts a new schedule.
- **Charging.**
  - Only the plan's puller can `charge(subId, amount)`.
  - Billing periods follow a fixed grid from the subscribe time, and the first period is due at once.
  - A charge moves `nextChargeAt` to the first grid point after the charge. A period the puller missed is skipped, never collected later, so no subscriber is charged more than once per billing period.
  - Checks run in this order:
    1. `Unauthorized`: not the puller, or an unknown subscription.
    2. `NotActive`: paused or cancelled.
    3. `InvalidAmount` (zero) or `AmountExceedsPlan` (above the plan amount).
    4. `NotDueYet`.
  - Only `NotDueYet` means the current period has already been collected.
- **Pause, resume, cancel.**
  - The subscriber or the plan owner can `pause` and `cancel`.
  - `resume` is open to the plan owner for any pause, but to the subscriber only for a pause they set. If the owner paused, the subscriber can still cancel or revoke the allowance.
  - Pausing never moves the billing grid:
    - a pause that ends before the next due time changes nothing;
    - if the current period has not been charged when the subscription resumes, it is due at once;
    - periods that passed entirely while paused are skipped.
- **Allowances.**
  - The contract expects a bounded allowance. One allowance to this contract serves all of a wallet's plans, so the API's permit adds `amount × max(12, ceil(365 days / periodSeconds))` (at least 12 periods and at least a year of service) to the wallet's current allowance. It asks for a permit when the allowance is below that value for the new plan plus the same value for each of the wallet's other live plans.
  - The per-period cap is enforced by `charge`, and the allowance caps the total. So a phished Subscribe signature can spend at most the wallet's remaining allowance to the Subscriptions contract, which equals the consents the wallet has granted (≈ one year per plan).
  - A subscriber stops all pulls by cancelling, or by revoking the allowance (`approve(subscriptions, 0)`), after which every `charge` reverts.
- **USDC blacklist.**
  - If Circle blacklists a subscriber, `charge` reverts for that subscription, and the schedule is left as it was.
  - If it blacklists the destination, every `charge` on the plan reverts until the operator rotates the destination with `setPlanDestination`.
  - If it blacklists the `Subscriptions` contract itself, every pull stops, and the only fix is a redeploy and re-subscribe.
- **Governance.** No owner, no pause switch, no upgrade path. A bug means deploying a new contract and subscribing again.
