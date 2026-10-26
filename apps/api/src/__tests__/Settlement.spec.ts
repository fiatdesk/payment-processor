import {
  SimulatedSettlement,
  SimulatedSignature,
} from '../modules/chains/Settlement';

describe('SimulatedSettlement', () => {
  const settlement = new SimulatedSettlement();

  it('accepts a plausible wallet address', async () => {
    await expect(
      settlement.CheckWalletExists(
        'D8VMZCmmTUUfhejNhNQKAmqvZCKfUq1qU6RqQKxQwXyX'
      )
    ).resolves.toBe(true);
    await expect(settlement.CheckWalletExists('short')).resolves.toBe(false);
  });

  it('verifies a simulated checkout signature', async () => {
    const signature = SimulatedSignature('cs_z_1', 'Payer111');
    const result = await settlement.VerifyCheckoutPayment(signature, {
      merchantWalletAddress: 'Merchant111',
      amountInCents: 1500,
      checkoutSessionId: 'cs_z_1',
    });
    expect(result).toEqual({
      verified: true,
      amount_cents: 1500,
      payer_address: 'Payer111',
    });
  });

  it('rejects a non-simulated checkout signature', async () => {
    const result = await settlement.VerifyCheckoutPayment('real_sig', {
      merchantWalletAddress: 'Merchant111',
      amountInCents: 1500,
      checkoutSessionId: 'cs_z_1',
    });
    expect(result.verified).toBe(false);
  });

  it('skips subscription authority init so checkout is one approval', async () => {
    await expect(
      settlement.BuildInitSubscriptionAuthorityTransaction('Payer111')
    ).resolves.toBeNull();
  });

  it('collects a subscription without hitting a chain', async () => {
    await expect(
      settlement.CollectSubscriptionPayment({
        subscriberWallet: 'Payer111',
        planId: 'sim_plan_price_z_1',
        subscriptionId: 'sim_sub_1',
        amountCents: 2000,
      })
    ).resolves.toEqual({
      transaction_hash: 'sim_collect:Payer111',
      alreadyCollected: false,
    });
  });

  it('builds and broadcasts a dummy payout without a chain', async () => {
    const batch = await settlement.BuildBatchPayoutTransaction('Sender111', [
      { destinationAddress: 'Dest111', amountInCents: 500 },
    ]);
    // Exact shape: no rail-specific extras now that broadcast needs none.
    expect(batch).toEqual({
      unsigned_transaction: 'sim_tx',
      estimated_fee: '0',
      fee_currency: 'none',
      chain_id: null,
      nonce: null,
      to: null,
      recipients_count: 1,
      transaction_type: 'payout',
      batch_id: null,
    });
    await expect(
      settlement.BroadcastSignedTransaction('sim_tx')
    ).resolves.toEqual({
      transaction_hash: 'sim_sig_payout',
      status: 'paid',
      viewer_url: '',
    });
  });

  it('describes the simulated rail', () => {
    expect(new SimulatedSettlement().Describe()).toEqual({
      rail: 'simulated',
      network: 'simulated',
      chain_id: null,
      native_currency: 'none',
      token_address: 'simulated',
    });
  });

  it('returns an empty explorer url on the simulated rail', () => {
    expect(new SimulatedSettlement().ExplorerUrl('tx', 'abc')).toBe('');
  });

  it('shapes a simulated payout batch with chain-neutral fields', async () => {
    const batch = await new SimulatedSettlement().BuildBatchPayoutTransaction(
      'Sender111',
      [{ destinationAddress: 'A', amountInCents: 100 }]
    );
    expect(batch).toMatchObject({
      unsigned_transaction: 'sim_tx',
      estimated_fee: '0',
      fee_currency: 'none',
      chain_id: null,
      nonce: null,
      to: null,
      recipients_count: 1,
      transaction_type: 'payout',
    });
    expect(batch).not.toHaveProperty('estimated_fee_lamports');
  });

  it('broadcasts with transaction_hash', async () => {
    await expect(
      new SimulatedSettlement().BroadcastSignedTransaction('sim_tx')
    ).resolves.toMatchObject({
      transaction_hash: 'sim_sig_payout',
      status: 'paid',
    });
  });
});
