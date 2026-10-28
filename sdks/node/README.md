# FiatDesk Node.js SDK

The official Node.js SDK for the FiatDesk API — an open-source Stripe-compatible payments platform that uses USDC on Ethereum.

Source lives in this monorepo at [`sdks/node`](https://github.com/fiatdesk/payment-processor/tree/main/sdks/node). Types and request schemas come from [`libs/shared-types`](https://github.com/fiatdesk/payment-processor/tree/main/libs/shared-types) and [`libs/shared-schemas`](https://github.com/fiatdesk/payment-processor/tree/main/libs/shared-schemas).

## Installation

```bash
npm install @fiatdesk/node
```

## Usage

```typescript
import { FiatDesk } from '@fiatdesk/node';

const fiatdesk = new FiatDesk('sk_live_fd_YOUR_API_KEY', 'https://api.yourdomain.com');

// Create a connected account
const account = await fiatdesk.accounts.create({
  country: 'US',
  email: 'seller@example.com',
  controller: {
    fees: { payer: 'application' },
    losses: { payments: 'application' },
    fiatdesk_dashboard: { type: 'express' },
  },
});

console.log(account.id); // acct_...
```

## Payouts

Payouts stay `pending` until your platform processes them. The SDK builds an Ethereum transaction through the API, signs it locally with the platform wallet's private key, and broadcasts it. The key never leaves your process.

```typescript
const results = await fiatdesk.payouts.processAll(
  process.env.WALLET_PRIVATE_KEY as `0x${string}`, // 0x + 64 hex
  { expectedSigner: process.env.PLATFORM_WALLET_ADDRESS }
);

const last = results[results.length - 1];
if (last && last.status !== 'paid') {
  // Stopped early: pending (not confirmed yet) or failed.
  await fiatdesk.payouts.reconcile(); // later, then call processAll again
}
```

- **Wallet and gas.** The platform wallet holds the USDC it pays out and pays Ethereum network gas in ETH for every transaction. A batch of up to 100 payouts is one transaction, so payouts in one batch share its gas. `build()` returns `estimated_fee`, an upper bound in wei.
- **One-time approval.** Payouts go through the PayoutBatch contract. The first build for a wallet returns `transaction_type: 'approval'`. `processBatch()`, `processAll()` and `ensureAllowance()` sign and broadcast that approval, then build the payouts. If the approval is not confirmed yet, they return a `pending` result with `transaction_type: 'approval'`.
- **Pending results.** `status: 'pending'` means the transaction was submitted but not confirmed within the API's wait. Its payouts stay `in_transit`. Call `payouts.reconcile()` later to settle them; never sign the same payouts again in the meantime.
- **Errors.** Batch conflicts throw a `FiatDeskPayoutBatchError` whose `code` names the case. For example, `payout_batch_in_progress` means another batch holds the wallet. When `processAll()` throws, the error's `results` lists the batches processed before it.
- **Timeouts.** Requests time out after the client's `timeout` (default 30 s): `new FiatDesk(apiKey, baseUrl, { timeout: 60000 })`, or `{ timeout }` in any request's options. Broadcasts wait for confirmations, so they use at least 90 s for a signed transaction and 150 s for a transaction hash. If a broadcast still gets no answer, it throws `FiatDeskPayoutBatchError` with `code: 'broadcast_timeout'`. The transaction may still be mined, so call `payouts.reconcile()` later; do not sign the same payouts again.
- **Re-pricing.** `processBatch(key, { replace: true })` re-prices the wallet's outstanding batch with the same payouts (fresh fees and deadline). A different set of payouts waits until that batch is paid or its deadline passes.
- **Step by step.** Call `build()`, then `sign(build, privateKey)`, then `broadcast()`. `sign()` refuses a transaction that does not call `build.to` on `build.chain_id`, or a key that is not `expectedSigner`.

## Documentation

Full API documentation is served by your own docs deployment (the `apps/docs` app in this repository).

## License

[Apache-2.0](../../LICENSE)
