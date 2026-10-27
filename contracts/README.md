# Contracts

Solidity contracts for the Ethereum settlement rail, built with [Foundry](https://book.getfoundry.sh/) (`solc 0.8.28`, EVM `cancun`, optimizer 200 runs).

| Path                      | What it is                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/PayoutBatch.sol`     | Pays up to 200 recipients from the caller's own token balance in one all-or-nothing transaction and emits `BatchPaid`. Each payer can pay a batch id once (`paid(payer, batchId)`), and never after the batch's `deadline` (`BatchExpired`). No admin, non-upgradeable, no ETH handling. The platform wallet approves it once. |
| `src/Subscriptions.sol`   | Recurring pulls from a subscriber's standing allowance. A plan owner registers a plan (token, amount, period, destination, puller); its puller may then take at most the plan amount once per period from each subscriber. No admin, no pause switch, non-upgradeable, no ETH handling. See [Subscriptions](#subscriptions).   |
| `test/mocks/MockUSDC.sol` | **Test only.** A FiatTokenV2 stand-in for Anvil: 6 decimals, EIP-2612 `permit`, EIP-3009 `transferWithAuthorization` / `receiveWithAuthorization`, `AuthorizationUsed`, and an open `mint` / `blacklist` hook. Never deploy it to a public network.                                                                            |
| `script/`                 | Deployment scripts (`forge script`).                                                                                                                                                                                                                                                                                           |
| `lib/`                    | `forge-std` v1.9.4 and `openzeppelin-contracts` v5.1.0 as git submodules.                                                                                                                                                                                                                                                      |

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

- **Plans.** `createPlan(planId, token, amount, periodSeconds, destination, puller)` registers a plan owned by the caller under `planKey = keccak256(abi.encode(owner, planId))`. The period is 1 second to 10 years (`MAX_PERIOD_SECONDS`). The token, amount and period never change, and a plan key cannot be registered twice (`PlanExists`). The owner can change the destination (`setPlanDestination`) and the puller (`setPlanPuller`), and can stop new subscriptions for good (`deactivatePlan`); existing subscriptions keep billing. The API uses the subscription operator key as both owner and puller, and the platform wallet as the destination.
- **Subscribing.** A subscription's id is `subId = keccak256(abi.encode(planKey, subscriber))`, and `subscriptions(subId)` returns its plan key, subscriber, next due time and status (`None`, `Active`, `Paused`, `Canceled`). A wallet subscribes itself with `subscribe(planKey)`, paying the gas. A relayer can subscribe it with `subscribeWithAuthorization`, carrying the subscriber's EIP-712 signature over `Subscribe(bytes32 planKey,address subscriber,uint256 nonce,uint256 deadline)`, where `nonce = nonces(subscriber)`. The domain is name `Subscriptions`, version `1`, the chain id and the contract address (`eip712Domain()`). `subscribeWithPermit` first applies the subscriber's EIP-2612 `permit` for this contract on the plan's token, so a first-time subscriber needs no ETH. If someone submits that permit first, the subscribe still goes through. Signatures must come from an externally owned account; a contract wallet calls `subscribe` itself. A subscriber who cancels may subscribe again, which starts a new schedule.
- **Charging.** Only the plan's puller can `charge(subId, amount)`. The first period is due at subscribe time. Each charge needs `block.timestamp >= nextChargeAt` (else `NotDueYet`) and `0 < amount <= plan.amount` (else `InvalidAmount` / `AmountExceedsPlan`), and moves `nextChargeAt` forward by exactly one period. Periods the puller skipped can still be collected later, one charge per elapsed period, so over N started periods no subscriber pays more than N times the plan amount.
- **Pause, resume, cancel.** The subscriber or the plan owner can `pause`, `resume` and `cancel`. `resume` sets the next charge one full period from now, so the paused time is never charged.
- **Allowances.** First-time subscribers permit `type(uint256).max`. The per-period cap in `charge` is the enforced limit, not the allowance. A subscriber stops all pulls by cancelling, or by revoking the allowance (`approve(subscriptions, 0)`), after which every `charge` reverts.
- **Governance.** No owner, no pause switch, no upgrade path. A bug means deploying a new contract and subscribing again.
