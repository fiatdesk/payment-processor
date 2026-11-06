// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  ConfirmCheckoutPaymentSchema,
  StartCrossChainPaymentSchema,
  SubmitCrossChainDepositSchema,
} from './CheckoutSessionSchema';

const SIMULATED = 'sim_sig:cs_fd_1:0x1111111111111111111111111111111111111111';
const SIGNATURE = `0x${'ab'.repeat(65)}`;

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
    [
      'a subscribe signature with its permit and deadline',
      {
        permit_signature: SIGNATURE,
        subscribe_signature: SIGNATURE,
        deadline: 1_700_001_800,
      },
    ],
    [
      'a contract-wallet subscribe signature without a permit',
      { subscribe_signature: `0x${'cd'.repeat(97)}`, deadline: 1_700_001_800 },
    ],
    ['a simulated subscribe signature', { subscribe_signature: SIMULATED }],
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
    [
      'a subscribe signature without a deadline',
      { subscribe_signature: SIGNATURE },
    ],
    [
      'a permit signature without a subscribe signature',
      { permit_signature: SIGNATURE, deadline: 1_700_001_800 },
    ],
    [
      'a subscribe signature with a transaction hash',
      {
        subscribe_signature: SIGNATURE,
        deadline: 1_700_001_800,
        transaction_hash: `0x${'ab'.repeat(32)}`,
      },
    ],
    [
      'a subscribe signature of odd length',
      { subscribe_signature: `${SIGNATURE}a`, deadline: 1_700_001_800 },
    ],
    [
      'a fractional deadline',
      { subscribe_signature: SIGNATURE, deadline: 1.5 },
    ],
  ])('rejects %s', (_label, body) => {
    expect(ConfirmCheckoutPaymentSchema.safeParse(body).success).toBe(false);
  });
});

describe('StartCrossChainPaymentSchema', () => {
  const BODY = { origin_asset: 'near', refund_address: 'buyer.near' };

  it.each([
    ['an origin asset and refund address', BODY],
    [
      'customer details',
      {
        ...BODY,
        email: 'mara@example.com',
        name: 'Mara Ito',
        address: { line1: '1 Harbour Rd', country: 'SG' },
        terms_of_service_accepted: true,
      },
    ],
  ])('accepts %s', (_label, body) => {
    expect(StartCrossChainPaymentSchema.safeParse(body).success).toBe(true);
  });

  it.each([
    ['a missing origin asset', { refund_address: 'buyer.near' }],
    ['an empty origin asset', { ...BODY, origin_asset: '' }],
    ['a missing refund address', { origin_asset: 'near' }],
    ['an invalid email', { ...BODY, email: 'not-an-email' }],
  ])('rejects %s', (_label, body) => {
    expect(StartCrossChainPaymentSchema.safeParse(body).success).toBe(false);
  });
});

describe('SubmitCrossChainDepositSchema', () => {
  it.each([
    ['an empty body', {}],
    [
      'a deposit transaction hash',
      { transaction_hash: '7Yt2xQw9KmPbN4rVs3LcEh8dUa6ZfJ1oGiTnHqWyXk5' },
    ],
  ])('accepts %s', (_label, body) => {
    expect(SubmitCrossChainDepositSchema.safeParse(body).success).toBe(true);
  });

  it.each([
    ['an empty transaction hash', { transaction_hash: '' }],
    ['an oversized transaction hash', { transaction_hash: 'a'.repeat(201) }],
  ])('rejects %s', (_label, body) => {
    expect(SubmitCrossChainDepositSchema.safeParse(body).success).toBe(false);
  });
});
