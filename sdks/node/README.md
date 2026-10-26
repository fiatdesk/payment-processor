# Zoneless Node.js SDK

The official Node.js SDK for the Zoneless API — an open-source Stripe-compatible payments platform that uses USDC on Solana.

Source lives in this monorepo at [`sdks/node`](https://github.com/OWNER/REPO/tree/main/sdks/node). Types and request schemas come from [`libs/shared-types`](https://github.com/OWNER/REPO/tree/main/libs/shared-types) and [`libs/shared-schemas`](https://github.com/OWNER/REPO/tree/main/libs/shared-schemas).

## Installation

```bash
npm install @zoneless/node
```

## Usage

```typescript
import { Zoneless } from '@zoneless/node';

const zoneless = new Zoneless('sk_live_z_YOUR_API_KEY', 'https://api.yourdomain.com');

// Create a connected account
const account = await zoneless.accounts.create({
  country: 'US',
  email: 'seller@example.com',
  controller: {
    fees: { payer: 'application' },
    losses: { payments: 'application' },
    zoneless_dashboard: { type: 'express' },
  },
});

console.log(account.id); // acct_...
```

## Documentation

Full API documentation is served by your own docs deployment (the `apps/docs` app in this repository).

## License

[Apache-2.0](../../LICENSE)
