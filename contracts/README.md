# Contracts

Solidity contracts for the Ethereum settlement rail, built with [Foundry](https://book.getfoundry.sh/) (`solc 0.8.28`, EVM `cancun`, optimizer 200 runs).

| Path                      | What it is                                                                                                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/PayoutBatch.sol`     | Pays up to 200 recipients from the caller's own token balance in one all-or-nothing transaction and emits `BatchPaid`. Each payer can pay a batch id once (`paid(payer, batchId)`). No admin, non-upgradeable, no ETH handling. The platform wallet approves it once. |
| `test/mocks/MockUSDC.sol` | **Test only.** A FiatTokenV2 stand-in for Anvil: 6 decimals, EIP-2612 `permit`, EIP-3009 `transferWithAuthorization` / `receiveWithAuthorization`, `AuthorizationUsed`, and an open `mint` / `blacklist` hook. Never deploy it to a public network.                   |
| `script/`                 | Deployment scripts (`forge script`).                                                                                                                                                                                                                                  |
| `lib/`                    | `forge-std` v1.9.4 and `openzeppelin-contracts` v5.1.0 as git submodules.                                                                                                                                                                                             |

## Setup

Install Foundry 1.5.1 (the version CI pins), then fetch the submodules. OpenZeppelin's own nested submodules are not needed:

```bash
git submodule update --init
```

## Build and test

From the repository root:

```bash
npx nx run contracts:build   # forge build
npx nx run contracts:test    # forge test -vv (unit and fuzz tests)
npx nx run api:test-anvil    # API integration tests against a local Anvil chain
```

Or from `contracts/`:

```bash
forge build
forge test -vv
forge fmt --check
```

`api:test-anvil` builds the contracts first, starts `anvil` on a free port, deploys `MockUSDC` and `PayoutBatch` from `contracts/out` and runs `apps/api/src/__tests__/anvil/*.anvil.spec.ts`. It needs no RPC provider and no funds.

If `forge test` reports `No tests found` after running `forge lint`, clear the compiler cache with `forge clean`.

## Deploy

Deploy with an encrypted keystore account (`cast wallet import deployer --interactive`) or a hardware wallet rather than a raw private key:

```bash
cd contracts
forge script script/DeployPayoutBatch.s.sol --rpc-url "$ETH_RPC_URL" --account deployer --broadcast
```

Then set `PAYOUT_BATCH_ADDRESS` to the logged address, or add it to the per-chain table in `apps/api/src/modules/chains/contracts.ts`. Without `--broadcast` the script only simulates.
