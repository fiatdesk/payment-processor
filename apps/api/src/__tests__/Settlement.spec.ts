// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { GetAppConfig } from '../modules/AppConfig';
import {
  ExplorerUrl,
  GetSettlement,
  SIMULATED_TEST_WALLET,
  SimulatedSettlement,
  SimulatedSignature,
} from '../modules/chains/Settlement';
import { Ethereum } from '../modules/chains/Ethereum';
import { ResetChainClientsForTests } from '../modules/chains/Chain';

jest.mock('../modules/AppConfig', () => ({
  ...jest.requireActual('../modules/AppConfig'),
  GetAppConfig: jest.fn(),
}));

const PAYER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const MERCHANT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

function UseRail(rail: 'simulated' | 'onchain'): void {
  jest.mocked(GetAppConfig).mockReturnValue({
    settlement_rail: rail,
  } as ReturnType<typeof GetAppConfig>);
}

describe('SimulatedSettlement', () => {
  const settlement = new SimulatedSettlement();

  it('accepts only Ethereum addresses', async () => {
    await expect(
      settlement.CheckWalletExists('0x1111111111111111111111111111111111111111')
    ).resolves.toBe(true);
    await expect(settlement.CheckWalletExists('short')).resolves.toBe(false);
    await expect(
      settlement.CheckWalletExists('0xZZ11111111111111111111111111111111111111')
    ).resolves.toBe(false);
  });

  it('uses an Ethereum address as the simulated test wallet', () => {
    expect(SIMULATED_TEST_WALLET).toBe(
      '0x1111111111111111111111111111111111111111'
    );
  });

  it('verifies a simulated checkout signature', async () => {
    const signature = SimulatedSignature('cs_z_1', PAYER);
    const result = await settlement.VerifyCheckoutPayment(signature, {
      merchantWalletAddress: MERCHANT,
      amountInCents: 1500,
      checkoutSessionId: 'cs_z_1',
    });
    expect(result).toEqual({
      verified: true,
      amount_cents: 1500,
      payer_address: PAYER,
    });
  });

  it('rejects a non-simulated checkout signature', async () => {
    const result = await settlement.VerifyCheckoutPayment('real_sig', {
      merchantWalletAddress: MERCHANT,
      amountInCents: 1500,
      checkoutSessionId: 'cs_z_1',
    });
    expect(result.verified).toBe(false);
  });

  it('collects a subscription without hitting a chain', async () => {
    await expect(
      settlement.CollectSubscriptionPayment({
        subscriberWallet: PAYER,
        planId: 'sim_plan_price_z_1',
        subscriptionId: 'sim_sub_1',
        amountCents: 2000,
      })
    ).resolves.toEqual({
      transaction_hash: `sim_collect:${PAYER}`,
      alreadyCollected: false,
    });
  });

  it('builds and broadcasts a dummy payout without a chain', async () => {
    const batch = await settlement.BuildBatchPayoutTransaction(MERCHANT, [
      { destinationAddress: PAYER, amountInCents: 500 },
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
      MERCHANT,
      [{ destinationAddress: PAYER, amountInCents: 100 }]
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

describe('GetSettlement', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of ['LIVEMODE', 'ETH_CHAIN_ID', 'ETH_RPC_URL']) {
      delete process.env[key];
    }
    ResetChainClientsForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    ResetChainClientsForTests();
  });

  it('returns the simulated rail in simulated mode', () => {
    UseRail('simulated');
    expect(GetSettlement()).toBeInstanceOf(SimulatedSettlement);
  });

  it('returns the Ethereum rail in on-chain mode', () => {
    UseRail('onchain');
    expect(GetSettlement()).toBeInstanceOf(Ethereum);
  });

  it('reuses one rail instance until the chain clients are reset', () => {
    UseRail('onchain');
    const first = GetSettlement();

    expect(GetSettlement()).toBe(first);
    ResetChainClientsForTests();
    expect(GetSettlement()).not.toBe(first);
  });

  it('switches instances when the rail changes', () => {
    UseRail('onchain');
    const onchain = GetSettlement();
    UseRail('simulated');

    expect(GetSettlement()).not.toBe(onchain);
    expect(GetSettlement()).toBeInstanceOf(SimulatedSettlement);
  });

  it('formats explorer links on-chain without an RPC URL', () => {
    UseRail('onchain');

    expect(ExplorerUrl('tx', '0xab')).toBe(
      'https://sepolia.etherscan.io/tx/0xab'
    );
  });
});
