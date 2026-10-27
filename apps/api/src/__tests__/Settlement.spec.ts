// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { GetAppConfig } from '../modules/AppConfig';
import {
  ExplorerUrl,
  GetSettlement,
  SIMULATED_TEST_WALLET,
  SimulatedSettlement,
  SimulatedSignature,
  type Settlement,
} from '../modules/chains/Settlement';
import { Ethereum } from '../modules/chains/Ethereum';
import { ResetChainClientsForTests } from '../modules/chains/Chain';
import type { PayoutTransactionExpectation } from '../modules/chains/types';
import { PayoutModule } from '../modules/Payout';
import { MemoryDatabase } from './mocks/MemoryDatabase';

jest.mock('../modules/AppConfig', () => ({
  ...jest.requireActual('../modules/AppConfig'),
  GetAppConfig: jest.fn(),
}));
jest.mock('../modules/identity/IdentityLite', () => ({
  IdentityLiteModule: jest.fn().mockImplementation(() => ({
    EvaluateAndApply: jest.fn().mockResolvedValue(undefined),
  })),
}));

const PAYER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const MERCHANT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const SIMULATED_EXPECTATION: PayoutTransactionExpectation = {
  wallet: MERCHANT,
  chainId: null,
  nonce: null,
  unsignedTransaction: 'sim_tx',
  transactionType: 'payout',
  batchId: '0xbatch',
  recipientsCount: 1,
  totalCents: 500,
  fromBlock: null,
};

function UseRail(rail: 'simulated' | 'onchain'): void {
  jest.mocked(GetAppConfig).mockReturnValue({
    settlement_rail: rail,
  } as ReturnType<typeof GetAppConfig>);
}

describe('SimulatedSettlement', () => {
  const settlement: Settlement = new SimulatedSettlement();

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
    const batch = await settlement.BuildBatchPayoutTransaction(
      MERCHANT,
      [{ destinationAddress: PAYER, amountInCents: 500 }],
      { batchId: '0xbatch' }
    );
    // Exact shape: the rail has no chain id, nonce, gas or fees.
    expect(batch).toEqual({
      unsigned_transaction: 'sim_tx',
      estimated_fee: '0',
      fee_currency: 'none',
      chain_id: null,
      nonce: null,
      to: null,
      recipients_count: 1,
      transaction_type: 'payout',
      batch_id: '0xbatch',
      gas_limit: null,
      max_fee_per_gas: null,
      max_priority_fee_per_gas: null,
      block_number: null,
      deadline: null,
      release_after: null,
    });
    await expect(
      settlement.BroadcastSignedTransaction('sim_tx', SIMULATED_EXPECTATION)
    ).resolves.toEqual({
      transaction_hash: 'sim_sig_payout:0xbatch',
      status: 'paid',
      viewer_url: '',
    });
  });

  it('matches any submission and has no nonce, hash, blacklist or payment log', async () => {
    await expect(
      settlement.MatchPayoutTransaction('sim_tx', SIMULATED_EXPECTATION)
    ).resolves.toEqual({
      status: 'match',
      transactionHash: 'sim_sig_payout:0xbatch',
      nonce: null,
    });
    expect(settlement.GetTransactionHash('sim_tx')).toBeNull();
    await expect(settlement.GetConfirmedBlock()).resolves.toMatchObject({
      number: 0,
    });
    expect(settlement.WaitsForExpiry()).toBe(false);
    await expect(settlement.GetAccountNonce(MERCHANT, 0)).resolves.toBeNull();
    await expect(settlement.IsBlacklisted([PAYER])).resolves.toEqual([]);
    await expect(
      settlement.IsBatchPaid(SIMULATED_EXPECTATION, 0)
    ).resolves.toBe(false);
    await expect(
      settlement.FindBatchPayment(SIMULATED_EXPECTATION, 0)
    ).resolves.toBeNull();
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
      new SimulatedSettlement().BroadcastSignedTransaction(
        'sim_tx',
        SIMULATED_EXPECTATION
      )
    ).resolves.toMatchObject({
      transaction_hash: 'sim_sig_payout:0xbatch',
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

describe('simulated rail payout batches', () => {
  let memory: MemoryDatabase;
  let module: PayoutModule;

  beforeEach(() => {
    jest.mocked(GetAppConfig).mockReturnValue({
      settlement_rail: 'simulated',
      livemode: false,
    } as ReturnType<typeof GetAppConfig>);
    memory = new MemoryDatabase();
    memory.Seed(
      'Accounts',
      { id: 'acct_z_platform', platform_account: 'acct_z_platform' },
      { id: 'acct_z_seller', platform_account: 'acct_z_platform' }
    );
    memory.Seed(
      'ExternalWallets',
      {
        id: 'wa_z_platform',
        account: 'acct_z_platform',
        wallet_address: MERCHANT,
        default_for_currency: true,
        status: 'new',
      },
      {
        id: 'wa_z_seller',
        account: 'acct_z_seller',
        wallet_address: PAYER,
        status: 'new',
      }
    );
    memory.Seed(
      'Payouts',
      ...['po_z_1', 'po_z_2'].map((id) => ({
        id,
        object: 'payout',
        account: 'acct_z_seller',
        platform_account: 'acct_z_platform',
        amount: 500,
        currency: 'usdc',
        destination: 'wa_z_seller',
        status: 'pending',
        metadata: {},
      }))
    );
    module = new PayoutModule(memory.AsDatabase());
  });

  it('holds the wallet lock from build until broadcast', async () => {
    const built = await module.BuildPayoutsBatch('acct_z_platform', {
      payouts: ['po_z_1'],
    });
    expect(built).toMatchObject({
      unsigned_transaction: 'sim_tx',
      chain_id: null,
      nonce: null,
      transaction_type: 'payout',
    });
    expect(memory.All('PayoutBatches')).toEqual([
      expect.objectContaining({ status: 'built', chain_id: null, nonce: null }),
    ]);

    await expect(
      module.BuildPayoutsBatch('acct_z_platform', { payouts: ['po_z_2'] })
    ).rejects.toMatchObject({
      statusCode: 409,
      type: 'payout_batch_in_progress',
    });

    await expect(
      module.BroadcastPayoutsBatch('acct_z_platform', {
        signed_transaction: built.unsigned_transaction,
        payouts: ['po_z_1'],
      })
    ).resolves.toMatchObject({
      status: 'paid',
      transaction_hash: `sim_sig_payout:${built.batch_id}`,
    });
    expect(memory.Doc('Payouts', 'po_z_1')).toMatchObject({ status: 'paid' });

    await expect(
      module.BuildPayoutsBatch('acct_z_platform', { payouts: ['po_z_2'] })
    ).resolves.toMatchObject({ transaction_type: 'payout' });
  });
});
