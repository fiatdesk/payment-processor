// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { ConfirmCheckoutPaymentSchema } from './CheckoutSessionSchema';

const SIMULATED = 'sim_sig:cs_z_1:0x1111111111111111111111111111111111111111';

describe('ConfirmCheckoutPaymentSchema', () => {
  it.each([
    ['a 65-byte signature', { signature: `0x${'ab'.repeat(65)}` }],
    ['a transaction hash', { transaction_hash: `0x${'AB'.repeat(32)}` }],
    ['a simulated transaction_hash', { transaction_hash: SIMULATED }],
    ['a simulated signature', { signature: SIMULATED }],
    [
      'an existing subscription',
      { already_subscribed: true, subscription_onchain_id: 'sub_1' },
    ],
  ])('accepts %s', (_label, body) => {
    expect(ConfirmCheckoutPaymentSchema.safeParse(body).success).toBe(true);
  });

  it.each([
    ['a 64-byte signature', { signature: `0x${'ab'.repeat(64)}` }],
    ['a short transaction hash', { transaction_hash: `0x${'ab'.repeat(31)}` }],
    ['a hash without 0x', { transaction_hash: 'ab'.repeat(32) }],
    ['a non-hex reference', { transaction_hash: 'sig_abc' }],
    [
      'both a signature and a hash',
      {
        signature: `0x${'ab'.repeat(65)}`,
        transaction_hash: `0x${'ab'.repeat(32)}`,
      },
    ],
  ])('rejects %s', (_label, body) => {
    expect(ConfirmCheckoutPaymentSchema.safeParse(body).success).toBe(false);
  });
});
