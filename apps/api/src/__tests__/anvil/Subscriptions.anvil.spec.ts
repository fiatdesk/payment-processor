// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Subscriptions on a real chain: the operator (account #4) creates a plan,
 * the buyer signs the API's permit and Subscribe typed data with viem, the
 * relayer (account #3) submits them, and the operator charges each period.
 * The billing cases run the API's billing runner, invoices and
 * subscriptions on MemoryDatabase against the chain, with the API clock at
 * chain time.
 */
import {
  createTestClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type TypedDataDefinition,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import type {
  Eip712TypedData,
  Invoice,
  PaymentIntent,
  Price,
  Subscription,
  SubscriptionItem,
} from '@zoneless/shared-types';
import { ChargeModule } from '../../modules/Charge';
import { CustomerModule } from '../../modules/Customer';
import { EventService } from '../../modules/EventService';
import { InvoiceModule } from '../../modules/Invoice';
import { InvoiceItemModule } from '../../modules/InvoiceItem';
import { PaymentIntentModule } from '../../modules/PaymentIntent';
import { PriceModule } from '../../modules/Price';
import { ProductModule } from '../../modules/Product';
import { SubscriptionModule } from '../../modules/Subscription';
import { SubscriptionBillingModule } from '../../modules/SubscriptionBilling';
import {
  CycleClaimId,
  LIVE_SUBSCRIPTION_STATUSES,
  type SubscriptionCycleClaim,
} from '../../modules/SubscriptionCycleClaims';
import { SUBSCRIPTIONS_ABI } from '../../modules/chains/abi/Subscriptions';
import { USDC_ABI } from '../../modules/chains/abi/Usdc';
import { GetPublicClient } from '../../modules/chains/Chain';
import { Ethereum } from '../../modules/chains/Ethereum';
import {
  PermitValue,
  SubscriptionIdFor,
} from '../../modules/chains/SubscriptionAuthorization';
import type {
  PreparedSubscribe,
  SubscriptionCollectParams,
} from '../../modules/chains/types';
import { ExpandableId } from '../../modules/Util';
import { MemoryDatabase } from '../mocks/MemoryDatabase';
import { StartAnvil, type AnvilContext } from './Anvil';

/** The API clock; null is wall time. The billing cases set chain time. */
let mockClock: number | null = null;
/** Event types the API emitted, in order. */
const mockEvents: string[] = [];

jest.mock('../../utils/Timestamp', () => {
  const actual = jest.requireActual('../../utils/Timestamp');
  return { ...actual, Now: jest.fn(() => mockClock ?? actual.Now()) };
});
jest.mock('../../modules/EventService', () => ({
  EventService: jest.fn().mockImplementation(() => ({
    Emit: jest.fn(async (type: string) => {
      mockEvents.push(type);
    }),
  })),
}));
jest.mock('../../utils/Logger', () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const TIMEOUT = { timeoutMs: 10_000 };
const PERIOD_SECONDS = 30 * 24 * 3600;
/** 20 USDC a period. */
const AMOUNT_CENTS = 2000;
const AMOUNT = 20_000_000n;
const PLATFORM_ACCOUNT = 'acct_z_platform';

describe('Subscriptions on Anvil', () => {
  let anvil: AnvilContext | undefined;
  let ethereum: Ethereum;
  let buyer: Address;
  let platform: Address;
  let operator: Address;
  let relayer: Address;
  let prices = 0;

  beforeAll(async () => {
    anvil = await StartAnvil();
    buyer = privateKeyToAccount(anvil.accounts.buyer).address;
    platform = privateKeyToAccount(anvil.accounts.platform).address;
    operator = privateKeyToAccount(anvil.accounts.operator).address;
    relayer = privateKeyToAccount(anvil.accounts.relayer).address;
    ethereum = new Ethereum();
  });

  afterAll(async () => {
    await anvil?.Stop();
  });

  beforeEach(() => {
    mockClock = null;
    mockEvents.length = 0;
  });

  function Context(): AnvilContext {
    if (!anvil) throw new Error('Anvil did not start');
    return anvil;
  }

  function TestClient() {
    return createTestClient({
      mode: 'anvil',
      chain: foundry,
      transport: http(Context().rpcUrl),
    });
  }

  async function ChainTime(): Promise<number> {
    return Number((await Context().publicClient.getBlock()).timestamp);
  }

  async function PassTime(seconds: number): Promise<void> {
    await TestClient().increaseTime({ seconds });
    await Context().Mine(1);
  }

  async function BalanceOf(owner: Address): Promise<bigint> {
    const { publicClient, addresses } = Context();
    return publicClient.readContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [owner],
    });
  }

  async function Allowance(): Promise<bigint> {
    const { publicClient, addresses } = Context();
    return publicClient.readContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [buyer, addresses.subscriptions],
    });
  }

  function SentFrom(address: Address): Promise<number> {
    return Context().publicClient.getTransactionCount({
      address,
      blockTag: 'pending',
    });
  }

  function BuyerWallet() {
    return createWalletClient({
      account: privateKeyToAccount(Context().accounts.buyer),
      chain: foundry,
      transport: http(Context().rpcUrl),
    });
  }

  /** The buyer calls the Subscriptions contract directly. */
  async function BuyerCalls(
    functionName: 'pause' | 'resume' | 'cancel',
    subId: Hex
  ): Promise<void> {
    const { publicClient, addresses } = Context();
    const hash = await BuyerWallet().writeContract({
      address: addresses.subscriptions,
      abi: SUBSCRIPTIONS_ABI,
      functionName,
      args: [subId],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  /** The buyer sets its USDC allowance to the Subscriptions contract. */
  async function Approve(value: bigint): Promise<void> {
    const { publicClient, addresses } = Context();
    const hash = await BuyerWallet().writeContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [addresses.subscriptions, value],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  /** The buyer signs typed data exactly as the API returned it. */
  async function Sign(typedData: Eip712TypedData | null): Promise<Hex> {
    if (!typedData) throw new Error('No typed data to sign');
    return privateKeyToAccount(Context().accounts.buyer).signTypedData(
      typedData as unknown as TypedDataDefinition
    );
  }

  /** A plan for a fresh price, created from the operator key. */
  async function Plan(
    amountCents = AMOUNT_CENTS,
    priceId = `price_z_anvil_${++prices}`
  ): Promise<Hex> {
    return (await ethereum.CreateSubscriptionPlan(
      priceId,
      PERIOD_SECONDS,
      amountCents,
      platform,
      operator
    )) as Hex;
  }

  /** What the buyer signs for `planKey`, and the signatures. */
  async function Signed(planKey: Hex) {
    const prepared: PreparedSubscribe =
      await ethereum.BuildSubscribeAuthorization(
        buyer,
        planKey,
        (await ChainTime()) + 3600
      );
    return {
      prepared,
      relay: {
        planKey,
        subscriber: buyer,
        permitSignature: prepared.needs_permit
          ? await Sign(prepared.permit_typed_data)
          : null,
        subscribeSignature: await Sign(prepared.subscribe_typed_data),
        deadline: prepared.deadline ?? 0,
      },
    };
  }

  async function Relay(relay: Awaited<ReturnType<typeof Signed>>['relay']) {
    const signed: string[] = [];
    const hash = await ethereum.RelaySubscribe(relay, {
      onSigned: async (transactionHash) => {
        signed.push(transactionHash);
      },
    });
    return { hash, signed };
  }

  /** Signs, relays and verifies a subscribe; returns the subscription id. */
  async function Subscribe(planKey: Hex): Promise<Hex> {
    const { relay } = await Signed(planKey);
    const { hash } = await Relay(relay);
    await Context().Mine(1);
    const verification = await ethereum.VerifySubscribeTransaction(
      hash,
      { planKey, subscriberWallet: buyer },
      TIMEOUT
    );
    expect(verification.status).toBe('verified');
    return verification.subscription_onchain_id as Hex;
  }

  /** Hashes `onSigned` saw, newest last. */
  let signedCharges: string[] = [];

  function Collect(
    planKey: Hex,
    subId: Hex,
    options: Partial<SubscriptionCollectParams> = {}
  ) {
    return ethereum.CollectSubscriptionPayment({
      subscriptionOnchainId: subId,
      planKey,
      subscriberWallet: buyer,
      amountCents: AMOUNT_CENTS,
      onSigned: async (hash) => {
        signedCharges.push(hash);
      },
      ...options,
    });
  }

  it('creates a plan, relays a permit and subscribe, and charges once per period', async () => {
    const { publicClient, addresses } = Context();
    const planKey = await Plan();

    await expect(
      publicClient.readContract({
        address: addresses.subscriptions,
        abi: SUBSCRIPTIONS_ABI,
        functionName: 'plans',
        args: [planKey],
      })
    ).resolves.toEqual([
      operator,
      operator,
      platform,
      addresses.usdc,
      AMOUNT,
      BigInt(PERIOD_SECONDS),
      true,
    ]);
    // A retry for the same price finds the plan and sends nothing.
    const operatorNonce = await SentFrom(operator);
    await expect(
      ethereum.CreateSubscriptionPlan(
        `price_z_anvil_${prices}`,
        PERIOD_SECONDS,
        AMOUNT_CENTS,
        platform,
        operator
      )
    ).resolves.toBe(planKey);
    expect(await SentFrom(operator)).toBe(operatorNonce);

    // A first-time subscriber signs the bounded permit and the Subscribe.
    // The permit is the current allowance (none yet) plus this plan's.
    const now = await ChainTime();
    const { prepared, relay } = await Signed(planKey);
    const permitValue = PermitValue({
      amount: AMOUNT,
      periodSeconds: BigInt(PERIOD_SECONDS),
    });
    expect(permitValue).toBe(AMOUNT * 13n);
    expect(await Allowance()).toBe(0n);
    expect(prepared).toMatchObject({
      needs_permit: true,
      fee_currency: 'eth',
      chain_id: 31337,
      permit_typed_data: {
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 31337,
          verifyingContract: addresses.usdc,
        },
        message: {
          owner: buyer,
          spender: addresses.subscriptions,
          value: permitValue.toString(),
        },
      },
      subscribe_typed_data: {
        domain: {
          name: 'Subscriptions',
          version: '1',
          chainId: 31337,
          verifyingContract: addresses.subscriptions,
        },
        message: {
          planKey,
          subscriber: buyer,
          token: addresses.usdc,
          amount: AMOUNT.toString(),
          periodSeconds: String(PERIOD_SECONDS),
          nonce: '0',
        },
      },
    });
    expect(prepared.deadline).toBeGreaterThanOrEqual(now + 1800);
    expect(prepared.deadline).toBeLessThanOrEqual(now + 1801);

    const { hash, signed } = await Relay(relay);
    if (!hash) throw new Error('Nothing was relayed');
    expect(signed).toEqual([hash]);
    const transaction = await publicClient.getTransaction({
      hash: hash as Hex,
    });
    expect(transaction.from).toBe(relayer.toLowerCase());

    await Context().Mine(1);
    const subId = SubscriptionIdFor(planKey, buyer);
    await expect(
      ethereum.VerifySubscribeTransaction(
        hash,
        { planKey, subscriberWallet: buyer },
        TIMEOUT
      )
    ).resolves.toEqual({
      status: 'verified',
      transaction_hash: hash,
      subscriber_address: buyer,
      subscription_onchain_id: subId,
    });
    await expect(
      ethereum.FindExistingSubscription(planKey, buyer)
    ).resolves.toBe(subId);
    expect(await Allowance()).toBe(permitValue);
    // Relaying the same signatures again sends nothing.
    await expect(Relay(relay)).resolves.toEqual({ hash: null, signed: [] });

    // The first period is due at once and moves the amount to the plan's
    // destination, from the operator key, with its hash recorded first.
    const subscribed = await ethereum.GetSubscriptionState(subId);
    expect(subscribed).toMatchObject({
      status: 'active',
      period_seconds: PERIOD_SECONDS,
    });
    const [platformBefore, buyerBefore] = await Promise.all([
      BalanceOf(platform),
      BalanceOf(buyer),
    ]);
    signedCharges = [];
    const first = await Collect(planKey, subId);
    if (first.status !== 'collected') throw new Error('Not collected');
    expect(signedCharges).toEqual([first.transaction_hash]);
    expect(first.next_charge_at).toBe(
      (subscribed.next_charge_at as number) + PERIOD_SECONDS
    );
    expect(
      (
        await publicClient.getTransaction({
          hash: first.transaction_hash as Hex,
        })
      ).from
    ).toBe(operator.toLowerCase());
    expect(await BalanceOf(platform)).toBe(platformBefore + AMOUNT);
    expect(await BalanceOf(buyer)).toBe(buyerBefore - AMOUNT);

    // The same period cannot be collected twice; nothing is sent.
    const nonceAfterCharge = await SentFrom(operator);
    await expect(Collect(planKey, subId)).resolves.toEqual({
      status: 'already_collected',
      transaction_hash: null,
    });
    expect(await SentFrom(operator)).toBe(nonceAfterCharge);
    expect(await BalanceOf(platform)).toBe(platformBefore + AMOUNT);

    // The next period collects again.
    await PassTime(PERIOD_SECONDS + 1);
    await expect(Collect(planKey, subId)).resolves.toMatchObject({
      status: 'collected',
    });
    expect(await BalanceOf(platform)).toBe(platformBefore + 2n * AMOUNT);
    expect(await Allowance()).toBe(permitValue - 2n * AMOUNT);
  });

  it('subscribes with the Subscribe signature alone when the allowance covers the permit value', async () => {
    // The first test left 11 periods of 20 USDC; 1 USDC a period needs 13.
    const planKey = await Plan(100);
    const { prepared, relay } = await Signed(planKey);

    expect(prepared).toMatchObject({
      needs_permit: false,
      permit_typed_data: null,
    });
    expect(relay.permitSignature).toBeNull();
    const { hash } = await Relay(relay);
    await Context().Mine(1);

    await expect(
      ethereum.VerifySubscribeTransaction(
        hash,
        { planKey, subscriberWallet: buyer },
        TIMEOUT
      )
    ).resolves.toMatchObject({
      status: 'verified',
      subscription_onchain_id: SubscriptionIdFor(planKey, buyer),
    });
  });

  it("asks for a permit that adds this plan to the wallet's allowance when its other plans need it", async () => {
    const planKey = await Plan();
    const planValue = AMOUNT * 13n;
    // Enough for this plan alone, not for this plan and one other.
    await Approve(planValue);

    const alone = await ethereum.BuildSubscribeAuthorization(
      buyer,
      planKey,
      (await ChainTime()) + 3600
    );
    const withOthers = await ethereum.BuildSubscribeAuthorization(
      buyer,
      planKey,
      (await ChainTime()) + 3600,
      { otherPlansAllowance: AMOUNT }
    );

    expect(alone.needs_permit).toBe(false);
    expect(withOthers).toMatchObject({
      needs_permit: true,
      permit_typed_data: {
        message: { value: (2n * planValue).toString() },
      },
    });
  });

  it('reports an on-chain pause before charging, and charges after the subscriber resumes', async () => {
    const planKey = await Plan();
    const subId = await Subscribe(planKey);
    await BuyerCalls('pause', subId);

    await expect(ethereum.GetSubscriptionState(subId)).resolves.toMatchObject({
      status: 'paused',
    });
    await expect(Collect(planKey, subId)).rejects.toMatchObject({
      statusCode: 409,
      type: 'paused_on_chain',
    });

    await BuyerCalls('resume', subId);
    await expect(ethereum.GetSubscriptionState(subId)).resolves.toMatchObject({
      status: 'active',
    });
    // Resuming does not move the schedule: the first period is still due.
    await expect(Collect(planKey, subId)).resolves.toMatchObject({
      status: 'collected',
    });
  });

  it('answers a signature made stale by a cancel with a 409, and cancels from the plan owner', async () => {
    const planKey = await Plan();
    const subId = await Subscribe(planKey);
    // Signed for another plan before the cancel used the subscriber's nonce.
    const { relay } = await Signed(await Plan());
    const recorded: string[] = [];
    const onSigned = async (hash: string) => {
      recorded.push(hash);
    };

    const cancel = await ethereum.CancelSubscription(subId, { onSigned });
    expect(cancel).toMatch(/^0x[0-9a-f]{64}$/);
    expect(recorded).toEqual([cancel]);
    await expect(ethereum.GetSubscriptionState(subId)).resolves.toMatchObject({
      status: 'canceled',
    });
    await expect(
      ethereum.CancelSubscription(subId, { pendingHash: cancel, onSigned })
    ).resolves.toBeNull();
    await expect(Collect(planKey, subId)).rejects.toMatchObject({
      statusCode: 409,
      type: 'canceled_on_chain',
      message: 'The subscription is canceled on-chain',
    });

    const relayerNonce = await SentFrom(relayer);
    await expect(Relay(relay)).rejects.toMatchObject({
      statusCode: 409,
      type: 'subscription_authorization_stale',
    });
    expect(await SentFrom(relayer)).toBe(relayerNonce);
  });

  it('reports an exhausted allowance as collection_failed_allowance', async () => {
    const planKey = await Plan();
    const subId = await Subscribe(planKey);
    const allowance = await Allowance();
    await Approve(AMOUNT - 1n);

    await expect(Collect(planKey, subId)).rejects.toMatchObject({
      statusCode: 402,
      type: 'collection_failed_allowance',
    });
    await Approve(allowance);
  });

  describe('billing through the API', () => {
    interface BillingApi {
      memory: MemoryDatabase;
      subscriptions: SubscriptionModule;
      billing: SubscriptionBillingModule;
      customer: string;
      price: Price;
      planKey: Hex;
    }

    /** The billing modules on MemoryDatabase and a price with its plan. */
    async function BillingApi(): Promise<BillingApi> {
      const memory = new MemoryDatabase();
      memory.UniqueIndex('Subscriptions', ['subscription_onchain_id'], {
        subscription_onchain_id: { $type: 'string' },
        status: { $in: [...LIVE_SUBSCRIPTION_STATUSES] },
      });
      const db = memory.AsDatabase();
      const eventService = new EventService(db);
      const customers = new CustomerModule(db, eventService);
      const products = new ProductModule(db, eventService);
      const priceModule = new PriceModule(db, eventService, products);
      const paymentIntents = new PaymentIntentModule(
        db,
        eventService,
        customers
      );
      const charges = new ChargeModule(db, eventService, customers);
      const invoiceItems = new InvoiceItemModule(
        db,
        eventService,
        customers,
        priceModule
      );
      const invoices = new InvoiceModule(
        db,
        eventService,
        customers,
        invoiceItems,
        paymentIntents,
        charges,
        priceModule,
        ethereum
      );
      const subscriptions = new SubscriptionModule(
        db,
        eventService,
        customers,
        priceModule,
        invoices,
        ethereum
      );
      const billing = new SubscriptionBillingModule(
        db,
        subscriptions,
        invoices,
        ethereum
      );

      const customer = await customers.CreateCustomer(PLATFORM_ACCOUNT, {
        email: 'subscriber@example.com',
      });
      const price = await priceModule.CreatePrice(PLATFORM_ACCOUNT, {
        currency: 'usdc',
        unit_amount: AMOUNT_CENTS,
        recurring: { interval: 'month' },
        product_data: { name: `Anvil plan ${++prices}` },
      });
      const planKey = await Plan(AMOUNT_CENTS, price.id);
      await db.Update<Price>('Prices', price.id, {
        subscription_plan_id: planKey,
      });
      return {
        memory,
        subscriptions,
        billing,
        customer: customer.id,
        price: { ...price, subscription_plan_id: planKey },
        planKey,
      };
    }

    /**
     * What a subscription checkout does: subscribe, collect the first
     * period, and record the subscription on the chain's grid.
     */
    async function Checkout(api: BillingApi) {
      const subId = await Subscribe(api.planKey);
      const periodStart = (await ethereum.GetSubscriptionState(subId))
        .next_charge_at as number;
      const first = await Collect(api.planKey, subId);
      if (first.status !== 'collected') throw new Error('Not collected');
      mockClock = await ChainTime();
      const subscription = await api.subscriptions.CreateSubscription(
        PLATFORM_ACCOUNT,
        {
          customer: api.customer,
          items: [{ price: api.price.id, quantity: 1 }],
          default_payment_method: buyer,
        },
        {
          settlementTransactionHash: first.transaction_hash,
          subscriptionOnchainId: subId,
          periodStart,
        }
      );
      expect(subscription.status).toBe('active');
      return { subId, subscription, periodStart };
    }

    async function RunBilling(api: BillingApi) {
      mockClock = await ChainTime();
      return api.billing.Run({
        platformAccountId: PLATFORM_ACCOUNT,
        batchSize: 10,
      });
    }

    function Stored(api: BillingApi, id: string): Subscription {
      return api.memory.Doc<Subscription>('Subscriptions', id);
    }

    function Period(api: BillingApi, id: string) {
      const [item] = api.memory
        .All<SubscriptionItem>('SubscriptionItems')
        .filter((candidate) => candidate.subscription === id);
      return {
        start: item.current_period_start,
        end: item.current_period_end,
      };
    }

    /** The subscription's cycle invoices, oldest period first. */
    function CycleInvoices(api: BillingApi, id: string): Invoice[] {
      return api.memory
        .All<Invoice>('Invoices')
        .filter(
          (invoice) =>
            invoice.billing_reason === 'subscription_cycle' &&
            ExpandableId(invoice.parent?.subscription_details?.subscription) ===
              id
        )
        .sort((a, b) => a.period_start - b.period_start);
    }

    function IntentOf(api: BillingApi, invoice: Invoice): PaymentIntent {
      const payment = invoice.payments?.data?.find((p) => p.is_default);
      return api.memory.Doc<PaymentIntent>(
        'PaymentIntents',
        ExpandableId(payment?.payment?.payment_intent ?? null) as string
      );
    }

    async function SetAutomine(enabled: boolean): Promise<void> {
      await TestClient().setAutomine(enabled);
    }

    it('declines on an exhausted allowance, then charges late across two periods and voids the skipped one', async () => {
      const api = await BillingApi();
      const { subId, subscription, periodStart } = await Checkout(api);
      const s = periodStart;
      const P = PERIOD_SECONDS;
      expect(Period(api, subscription.id)).toEqual({ start: s, end: s + P });
      const allowance = await Allowance();

      // The second period is due, and the subscriber's allowance is short.
      await Approve(AMOUNT - 1n);
      await PassTime(P + 60);
      const declined = await RunBilling(api);

      expect(declined).toMatchObject({ processed: 1, failed: 1 });
      const [missed] = CycleInvoices(api, subscription.id);
      expect(missed).toMatchObject({
        status: 'open',
        period_start: s + P,
        attempt_count: 1,
      });
      expect(IntentOf(api, missed).last_payment_error).toMatchObject({
        code: 'collection_failed_allowance',
      });
      expect(Stored(api, subscription.id).status).toBe('past_due');
      expect(mockEvents).toEqual(
        expect.arrayContaining([
          'invoice.payment_failed',
          'customer.subscription.allowance_exhausted',
        ])
      );

      // The subscriber restores the allowance only after the next period is
      // due too. The chain skips the missed period: one charge, for now.
      await Approve(allowance);
      await PassTime(P);
      const platformBefore = await BalanceOf(platform);
      const charged = await RunBilling(api);

      expect(charged).toMatchObject({ processed: 1, succeeded: 1, failed: 0 });
      const [voided, paid] = CycleInvoices(api, subscription.id);
      expect(voided).toMatchObject({ id: missed.id, status: 'void' });
      expect(paid).toMatchObject({ status: 'paid', period_start: s + 2 * P });
      const intent = IntentOf(api, paid);
      expect(intent).toMatchObject({
        status: 'succeeded',
        pending_charge_hash: null,
      });
      const claim = api.memory.Doc<SubscriptionCycleClaim>(
        'SubscriptionCycleClaims',
        CycleClaimId(subId, s + 2 * P)
      );
      expect(claim).toMatchObject({ owner: paid.id });
      expect(claim.charge_hash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(await BalanceOf(platform)).toBe(platformBefore + AMOUNT);
      // The off-chain period follows the chain's grid after the late charge.
      await expect(ethereum.GetSubscriptionState(subId)).resolves.toMatchObject(
        {
          next_charge_at: s + 3 * P,
        }
      );
      expect(Period(api, subscription.id)).toEqual({
        start: s + 2 * P,
        end: s + 3 * P,
      });
      expect(Stored(api, subscription.id).status).toBe('active');

      // Nothing is due until the next grid point; nothing is sent.
      const nonce = await SentFrom(operator);
      await expect(RunBilling(api)).resolves.toMatchObject({ processed: 0 });
      expect(await SentFrom(operator)).toBe(nonce);
    });

    it('waits while the subscriber pauses across a due time, then collects that period on resume', async () => {
      const api = await BillingApi();
      const { subId, subscription, periodStart } = await Checkout(api);
      const P = PERIOD_SECONDS;
      await BuyerCalls('pause', subId);
      await PassTime(P + 60);
      const platformBefore = await BalanceOf(platform);

      const paused = await RunBilling(api);
      expect(paused).toMatchObject({ processed: 0, failed: 0 });
      expect(Stored(api, subscription.id)).toMatchObject({
        status: 'active',
        paused_on_chain: true,
        pause_collection: { behavior: 'keep_as_draft' },
      });
      await expect(RunBilling(api)).resolves.toMatchObject({ processed: 0 });
      expect(CycleInvoices(api, subscription.id)).toEqual([]);
      expect(await BalanceOf(platform)).toBe(platformBefore);
      expect(mockEvents).not.toContain('invoice.payment_failed');

      await BuyerCalls('resume', subId);
      const resumed = await RunBilling(api);

      expect(resumed).toMatchObject({ processed: 1, succeeded: 1 });
      expect(Stored(api, subscription.id)).toMatchObject({
        paused_on_chain: false,
        pause_collection: null,
      });
      expect(CycleInvoices(api, subscription.id)).toEqual([
        expect.objectContaining({
          status: 'paid',
          period_start: periodStart + P,
        }),
      ]);
      expect(Period(api, subscription.id)).toEqual({
        start: periodStart + P,
        end: periodStart + 2 * P,
      });
      expect(await BalanceOf(platform)).toBe(platformBefore + AMOUNT);
    });

    it('cancels from the API without waiting, confirms the on-chain cancel in the runner, and takes a new subscription after', async () => {
      const api = await BillingApi();
      const { subId, subscription } = await Checkout(api);

      const canceled = await api.subscriptions.CancelSubscription(
        subscription.id
      );

      expect(canceled.status).toBe('canceled');
      const sent = Stored(api, subscription.id);
      expect(sent).toMatchObject({ cancel_pending_on_chain: true });
      expect(sent.cancel_pending_transaction_hash).toMatch(/^0x[0-9a-f]{64}$/);
      await expect(ethereum.GetSubscriptionState(subId)).resolves.toMatchObject(
        {
          status: 'canceled',
        }
      );

      await RunBilling(api);
      expect(Stored(api, subscription.id)).toMatchObject({
        cancel_pending_on_chain: false,
        cancel_pending_transaction_hash: null,
      });

      // The subscriber subscribes again: the same subscription id on-chain.
      const again = await Checkout(api);
      expect(again.subId).toBe(subId);
      expect(again.subscription.id).not.toBe(subscription.id);
      expect(
        api.memory
          .All<Subscription>('Subscriptions')
          .filter((candidate) => candidate.subscription_onchain_id === subId)
          .map((candidate) => candidate.status)
          .sort()
      ).toEqual(['active', 'canceled']);
      // A second live subscription for it is refused.
      await expect(
        api.subscriptions.CreateSubscription(
          PLATFORM_ACCOUNT,
          {
            customer: api.customer,
            items: [{ price: api.price.id, quantity: 1 }],
            default_payment_method: buyer,
          },
          { subscriptionOnchainId: subId, periodStart: again.periodStart }
        )
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('cancels for good when the subscriber cancels on-chain, voiding the open invoice', async () => {
      const api = await BillingApi();
      const { subId, subscription } = await Checkout(api);
      const allowance = await Allowance();
      await Approve(AMOUNT - 1n);
      await PassTime(PERIOD_SECONDS + 60);
      await RunBilling(api);
      const [open] = CycleInvoices(api, subscription.id);
      expect(open).toMatchObject({ status: 'open', attempt_count: 1 });
      await Approve(allowance);

      await BuyerCalls('cancel', subId);
      mockEvents.length = 0;
      const result = await RunBilling(api);

      expect(result).toMatchObject({ failed: 0 });
      expect(Stored(api, subscription.id)).toMatchObject({
        status: 'canceled',
        cancellation_details: {
          reason: 'cancellation_requested',
          comment: 'canceled_on_chain',
        },
        billing_lock_until: null,
      });
      expect(CycleInvoices(api, subscription.id)).toEqual([
        expect.objectContaining({ id: open.id, status: 'void' }),
      ]);
      expect(mockEvents).toEqual(
        expect.arrayContaining([
          'invoice.voided',
          'customer.subscription.deleted',
        ])
      );
      expect(mockEvents).not.toContain('invoice.payment_failed');

      // Running again changes nothing.
      mockEvents.length = 0;
      await RunBilling(api);
      expect(mockEvents).toEqual([]);
    });

    it('leaves a charge whose receipt times out pending, then settles it by its hash', async () => {
      const api = await BillingApi();
      const { subId, subscription, periodStart } = await Checkout(api);
      const P = PERIOD_SECONDS;
      const collect = ethereum.CollectSubscriptionPayment.bind(ethereum);
      const wait = jest
        .spyOn(ethereum, 'CollectSubscriptionPayment')
        .mockImplementation((params) => collect({ ...params, timeoutMs: 500 }));
      await PassTime(P + 60);
      const platformBefore = await BalanceOf(platform);

      try {
        await SetAutomine(false);
        await expect(RunBilling(api)).resolves.toMatchObject({
          processed: 0,
          failed: 0,
        });
        const [invoice] = CycleInvoices(api, subscription.id);
        expect(invoice).toMatchObject({
          status: 'open',
          period_start: periodStart + P,
          attempt_count: 0,
        });
        const intent = IntentOf(api, invoice);
        expect(intent.status).toBe('processing');
        expect(intent.pending_charge_hash).toMatch(/^0x[0-9a-f]{64}$/);
        expect(
          api.memory.Doc<SubscriptionCycleClaim>(
            'SubscriptionCycleClaims',
            CycleClaimId(subId, periodStart + P)
          )
        ).toMatchObject({
          owner: invoice.id,
          charge_hash: intent.pending_charge_hash,
        });
        expect(Stored(api, subscription.id).status).toBe('active');
        expect(mockEvents).not.toContain('invoice.payment_failed');

        // Still unmined: the next run reconciles by the hash, sends nothing.
        const nonce = await SentFrom(operator);
        await RunBilling(api);
        expect(await SentFrom(operator)).toBe(nonce);
        expect(IntentOf(api, invoice).status).toBe('processing');

        // A timed-out viem receipt wait leaves one poll timer of the client's
        // polling interval; let it run out so the worker exits cleanly.
        await new Promise((resolve) =>
          setTimeout(resolve, GetPublicClient().pollingInterval + 100)
        );
        await Context().Mine(2);
      } finally {
        await SetAutomine(true);
        wait.mockRestore();
      }

      const settled = await RunBilling(api);
      expect(settled).toMatchObject({ processed: 1, succeeded: 1 });
      const [paid] = CycleInvoices(api, subscription.id);
      expect(paid.status).toBe('paid');
      expect(IntentOf(api, paid)).toMatchObject({
        status: 'succeeded',
        pending_charge_hash: null,
      });
      expect(Period(api, subscription.id)).toEqual({
        start: periodStart + P,
        end: periodStart + 2 * P,
      });
      expect(await BalanceOf(platform)).toBe(platformBefore + AMOUNT);
    });
  });
});
