// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { GetAppConfig } from '../modules/AppConfig';
import {
  ExplorerUrl,
  GetSettlement,
  PublicRailConfig,
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

  const CHECKOUT_EXPECTATION = {
    merchantWalletAddress: MERCHANT,
    amountInCents: 1500,
    checkoutSessionId: 'cs_fd_1',
    payerAddress: PAYER,
    createdAt: 1_700_000_000,
  };

  it('verifies a simulated checkout signature', async () => {
    const signature = SimulatedSignature('cs_fd_1', PAYER);
    const result = await settlement.VerifyCheckoutPayment(
      signature,
      CHECKOUT_EXPECTATION
    );
    expect(result).toEqual({
      status: 'verified',
      transaction_hash: signature,
      amount_cents: 1500,
      payer_address: PAYER,
      merchant_address: CHECKOUT_EXPECTATION.merchantWalletAddress,
    });
  });

  it('rejects a non-simulated checkout signature', async () => {
    const result = await settlement.VerifyCheckoutPayment(
      'real_sig',
      CHECKOUT_EXPECTATION
    );
    expect(result).toMatchObject({ status: 'failed' });
  });

  it('leaves a checkout with no transaction pending', async () => {
    await expect(
      settlement.VerifyCheckoutPayment(null, CHECKOUT_EXPECTATION)
    ).resolves.toMatchObject({ status: 'pending', transaction_hash: null });
  });

  it('prepares nothing to sign for checkout', async () => {
    await expect(
      settlement.BuildCheckoutPaymentAuthorization(
        PAYER,
        MERCHANT,
        1500,
        'cs_fd_1',
        1_700_086_400
      )
    ).resolves.toEqual({
      method: 'simulated',
      typed_data: null,
      authorization: null,
      estimated_fee: '0',
      fee_currency: 'none',
      chain_id: null,
    });
  });

  describe('RelayCheckoutAuthorization', () => {
    const authorization = {
      from: PAYER,
      to: MERCHANT,
      value: '15000000',
      valid_after: 0,
      valid_before: 1_700_086_400,
      nonce: `0x${'00'.repeat(32)}`,
    };

    it('records and returns the sim_sig reference as the transaction', async () => {
      const signature = SimulatedSignature('cs_fd_1', PAYER);
      const onSigned = jest.fn().mockResolvedValue(undefined);

      await expect(
        settlement.RelayCheckoutAuthorization(authorization, signature, {
          createdAt: 1_700_000_000,
          onSigned,
        })
      ).resolves.toBe(signature);
      expect(onSigned).toHaveBeenCalledWith(signature);
    });

    it('reuses a recorded relay', async () => {
      const onSigned = jest.fn();

      await expect(
        settlement.RelayCheckoutAuthorization(
          authorization,
          SimulatedSignature('cs_fd_1', PAYER),
          {
            pendingHash: 'sim_sig:cs_fd_1:recorded',
            createdAt: 1_700_000_000,
            onSigned,
          }
        )
      ).resolves.toBe('sim_sig:cs_fd_1:recorded');
      expect(onSigned).not.toHaveBeenCalled();
    });

    it('rejects a real signature with a 400', async () => {
      await expect(
        settlement.RelayCheckoutAuthorization(
          authorization,
          `0x${'ab'.repeat(65)}`,
          { createdAt: 1_700_000_000, onSigned: jest.fn() }
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        type: 'invalid_request_error',
      });
    });
  });

  describe('subscriptions', () => {
    const PLAN = 'sim_plan_price_fd_1';

    it('creates a plan without hitting a chain', async () => {
      await expect(
        settlement.CreateSubscriptionPlan(
          'price_fd_1',
          2_592_000,
          2000,
          MERCHANT,
          SIMULATED_TEST_WALLET
        )
      ).resolves.toBe(PLAN);
    });

    it('prepares nothing to sign', async () => {
      await expect(
        settlement.BuildSubscribeAuthorization(PAYER, PLAN, 1_700_086_400)
      ).resolves.toEqual({
        needs_permit: false,
        permit_typed_data: null,
        subscribe_typed_data: null,
        deadline: null,
        first_charge_at: 0,
        estimated_fee: '0',
        fee_currency: 'none',
        chain_id: null,
      });
    });

    it('records and returns the sim_sig reference as the subscribe', async () => {
      const reference = SimulatedSignature('cs_fd_1', PAYER);
      const onSigned = jest.fn().mockResolvedValue(undefined);
      const relay = {
        planKey: PLAN,
        subscriber: PAYER,
        permitSignature: null,
        subscribeSignature: reference,
        deadline: 1_700_001_800,
        firstChargeAt: 0,
      };

      await expect(
        settlement.RelaySubscribe(relay, { onSigned })
      ).resolves.toBe(reference);
      expect(onSigned).toHaveBeenCalledWith(reference);
      await expect(
        settlement.RelaySubscribe(
          { ...relay, subscribeSignature: `0x${'ab'.repeat(65)}` },
          { onSigned }
        )
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('verifies a simulated subscribe, one subscription id per checkout session, and nothing else', async () => {
      const reference = SimulatedSignature('cs_fd_1', PAYER);
      const expected = { planKey: PLAN, subscriberWallet: PAYER };

      await expect(
        settlement.VerifySubscribeTransaction(reference, expected)
      ).resolves.toEqual({
        status: 'verified',
        transaction_hash: reference,
        subscriber_address: PAYER,
        subscription_onchain_id: `sim_sub_${PLAN}_${PAYER}_cs_fd_1`,
      });
      await expect(
        settlement.VerifySubscribeTransaction(
          SimulatedSignature('cs_fd_2', PAYER),
          expected
        )
      ).resolves.toMatchObject({
        subscription_onchain_id: `sim_sub_${PLAN}_${PAYER}_cs_fd_2`,
      });
      await expect(
        settlement.VerifySubscribeTransaction(`0x${'ab'.repeat(32)}`, expected)
      ).resolves.toMatchObject({ status: 'failed' });
      await expect(
        settlement.VerifySubscribeTransaction(null, expected)
      ).resolves.toMatchObject({ status: 'pending' });
    });

    it('collects a subscription without hitting a chain, recording the reference first', async () => {
      const onSigned = jest.fn().mockResolvedValue(undefined);

      await expect(
        settlement.CollectSubscriptionPayment({
          subscriptionOnchainId: 'sim_sub_1',
          planKey: PLAN,
          subscriberWallet: PAYER,
          amountCents: 2000,
          onSigned,
        })
      ).resolves.toEqual({
        status: 'collected',
        transaction_hash: `sim_collect:${PAYER}`,
        next_charge_at: null,
      });
      expect(onSigned).toHaveBeenCalledWith(`sim_collect:${PAYER}`, {
        nonce: 0,
      });
      await expect(
        settlement.ReconcileSubscriptionCharge([`sim_collect:${PAYER}`], {
          subscriptionOnchainId: 'sim_sub_1',
          amountCents: 2000,
          sentAt: null,
          nonce: null,
          onReplaced: jest.fn(),
        })
      ).resolves.toEqual({
        status: 'paid',
        transaction_hash: `sim_collect:${PAYER}`,
        next_charge_at: null,
      });
    });

    it('is always active, keeps no schedule and has nothing to cancel on-chain', async () => {
      await expect(
        settlement.GetSubscriptionState('sim_sub_1')
      ).resolves.toEqual({
        status: 'active',
        next_charge_at: null,
        period_seconds: null,
        chain_time: null,
      });
      await expect(
        settlement.CancelSubscription('sim_sub_1', { onSigned: jest.fn() })
      ).resolves.toBeNull();
      await expect(
        settlement.FindSubscriptionCharge('sim_sub_1', {
          amountCents: 2000,
          since: 0,
        })
      ).resolves.toBeNull();
      await expect(
        settlement.FindExistingSubscription(PLAN, PAYER)
      ).resolves.toBeNull();
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

  it('has no chain head or deposit logs', async () => {
    await expect(settlement.GetLatestBlockNumber()).resolves.toBe(0n);
    await expect(
      settlement.GetIncomingDeposits(MERCHANT, { fromBlock: 0n, toBlock: 10n })
    ).resolves.toEqual([]);
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

  describe('PublicRailConfig', () => {
    it('has no chain or explorer on the simulated rail', () => {
      UseRail('simulated');

      expect(PublicRailConfig()).toEqual({
        network: 'simulated',
        chain_id: null,
        explorer_url_base: '',
      });
    });

    it('reports the chain and its explorer on-chain', () => {
      UseRail('onchain');

      expect(PublicRailConfig()).toEqual({
        network: 'ethereum',
        chain_id: 11155111,
        explorer_url_base: 'https://sepolia.etherscan.io',
      });
    });

    it('links no explorer on Anvil', () => {
      process.env.ETH_CHAIN_ID = '31337';
      process.env.USDC_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
      ResetChainClientsForTests();
      UseRail('onchain');

      expect(PublicRailConfig()).toEqual({
        network: 'ethereum',
        chain_id: 31337,
        explorer_url_base: '',
      });
    });
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
      { id: 'acct_fd_platform', platform_account: 'acct_fd_platform' },
      { id: 'acct_fd_seller', platform_account: 'acct_fd_platform' }
    );
    memory.Seed(
      'ExternalWallets',
      {
        id: 'wa_fd_platform',
        account: 'acct_fd_platform',
        wallet_address: MERCHANT,
        default_for_currency: true,
        status: 'new',
      },
      {
        id: 'wa_fd_seller',
        account: 'acct_fd_seller',
        wallet_address: PAYER,
        status: 'new',
      }
    );
    memory.Seed(
      'Payouts',
      ...['po_fd_1', 'po_fd_2'].map((id) => ({
        id,
        object: 'payout',
        account: 'acct_fd_seller',
        platform_account: 'acct_fd_platform',
        amount: 500,
        currency: 'usdc',
        destination: 'wa_fd_seller',
        status: 'pending',
        metadata: {},
      }))
    );
    module = new PayoutModule(memory.AsDatabase());
  });

  it('recovers a batch a crash left in broadcast by broadcasting it again', async () => {
    const built = await module.BuildPayoutsBatch('acct_fd_platform', {
      payouts: ['po_fd_1'],
    });
    // The crash came after persisting the broadcast, before settling it.
    const [batch] = memory.All<{ id: string }>('PayoutBatches');
    memory.Seed('PayoutBatches', {
      ...batch,
      status: 'broadcast',
      broadcast_mode: 'signed_transaction',
      transaction_hash: `sim_sig_payout:${built.batch_id}`,
      transaction_hashes: [`sim_sig_payout:${built.batch_id}`],
    });
    memory.Seed('Payouts', {
      ...memory.Doc<Record<string, unknown>>('Payouts', 'po_fd_1'),
      status: 'in_transit',
    });

    await expect(
      module.BroadcastPayoutsBatch('acct_fd_platform', {
        signed_transaction: built.unsigned_transaction,
        payouts: ['po_fd_1'],
      })
    ).resolves.toMatchObject({ status: 'paid' });
    expect(memory.Doc('Payouts', 'po_fd_1')).toMatchObject({ status: 'paid' });
    expect(memory.Doc('PayoutBatches', batch.id)).toMatchObject({
      status: 'paid',
    });
  });

  it('holds the wallet lock from build until broadcast', async () => {
    const built = await module.BuildPayoutsBatch('acct_fd_platform', {
      payouts: ['po_fd_1'],
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
      module.BuildPayoutsBatch('acct_fd_platform', { payouts: ['po_fd_2'] })
    ).rejects.toMatchObject({
      statusCode: 409,
      type: 'payout_batch_in_progress',
    });

    await expect(
      module.BroadcastPayoutsBatch('acct_fd_platform', {
        signed_transaction: built.unsigned_transaction,
        payouts: ['po_fd_1'],
      })
    ).resolves.toMatchObject({
      status: 'paid',
      transaction_hash: `sim_sig_payout:${built.batch_id}`,
    });
    expect(memory.Doc('Payouts', 'po_fd_1')).toMatchObject({ status: 'paid' });

    await expect(
      module.BuildPayoutsBatch('acct_fd_platform', { payouts: ['po_fd_2'] })
    ).resolves.toMatchObject({ transaction_type: 'payout' });
  });
});
