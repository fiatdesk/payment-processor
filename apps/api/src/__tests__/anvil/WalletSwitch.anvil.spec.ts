// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Switching the platform's default wallet on a real chain (Fable Q13): the
 * plan's destination moves on-chain and the next charge pays the new
 * wallet, USDC sent to the old wallet is alerted and never credited, and a
 * checkout prepared before the switch is approved again for the new wallet.
 * The API modules run on MemoryDatabase, with the API clock at chain time.
 */
import {
  createTestClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type TypedDataDefinition,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import type {
  ArchivedWalletDeposit,
  CheckoutSession,
  Eip712TypedData,
  ExternalWallet,
  Price,
  TopUp,
} from '@fiatdesk/shared-types';
import { ArchivedWalletDepositStore } from '../../modules/ArchivedWalletDeposits';
import { BalanceModule } from '../../modules/Balance';
import { ChargeModule } from '../../modules/Charge';
import { CheckoutPaymentModule } from '../../modules/CheckoutPayment';
import { CheckoutSessionModule } from '../../modules/CheckoutSession';
import { CustomerModule } from '../../modules/Customer';
import { EventService } from '../../modules/EventService';
import { ExternalWalletModule } from '../../modules/ExternalWallet';
import { InvoiceModule } from '../../modules/Invoice';
import { InvoiceItemModule } from '../../modules/InvoiceItem';
import { PaymentIntentModule } from '../../modules/PaymentIntent';
import { PlanDestinationModule } from '../../modules/PlanDestination';
import { PriceModule } from '../../modules/Price';
import { ProductModule } from '../../modules/Product';
import { SubscriptionModule } from '../../modules/Subscription';
import { SubscriptionBillingModule } from '../../modules/SubscriptionBilling';
import { LIVE_SUBSCRIPTION_STATUSES } from '../../modules/SubscriptionCycleClaims';
import { TopUpMonitor } from '../../modules/TopUpMonitor';
import { SUBSCRIPTIONS_ABI } from '../../modules/chains/abi/Subscriptions';
import { USDC_ABI } from '../../modules/chains/abi/Usdc';
import { Ethereum } from '../../modules/chains/Ethereum';
import { MemoryDatabase } from '../mocks/MemoryDatabase';
import { StartAnvil, type AnvilContext } from './Anvil';

/** The API clock; null is wall time. Each case sets chain time. */
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
const PLATFORM = 'acct_fd_platform';

describe('Switching the platform wallet on Anvil', () => {
  let anvil: AnvilContext | undefined;
  let ethereum: Ethereum;
  let buyer: Address;
  let oldWallet: Address;
  let operator: Address;

  beforeAll(async () => {
    anvil = await StartAnvil();
    ethereum = new Ethereum();
    buyer = privateKeyToAccount(anvil.accounts.buyer).address;
    oldWallet = privateKeyToAccount(anvil.accounts.platform).address;
    operator = privateKeyToAccount(anvil.accounts.operator).address;
  });

  afterAll(async () => {
    await anvil?.Stop();
  });

  beforeEach(async () => {
    mockEvents.length = 0;
    mockClock = await ChainTime();
  });

  function Context(): AnvilContext {
    if (!anvil) throw new Error('Anvil did not start');
    return anvil;
  }

  async function ChainTime(): Promise<number> {
    return Number((await Context().publicClient.getBlock()).timestamp);
  }

  async function PassTime(seconds: number): Promise<void> {
    await createTestClient({
      mode: 'anvil',
      chain: foundry,
      transport: http(Context().rpcUrl),
    }).increaseTime({ seconds });
    await Context().Mine(1);
    mockClock = await ChainTime();
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

  async function PlanDestination(planKey: Hex): Promise<Address> {
    const { publicClient, addresses } = Context();
    const plan = await publicClient.readContract({
      address: addresses.subscriptions,
      abi: SUBSCRIPTIONS_ABI,
      functionName: 'plans',
      args: [planKey],
    });
    return plan[2];
  }

  /** The buyer signs typed data exactly as the API returned it. */
  async function Sign(typedData: Eip712TypedData | null): Promise<Hex> {
    if (!typedData) throw new Error('No typed data to sign');
    return privateKeyToAccount(Context().accounts.buyer).signTypedData(
      typedData as unknown as TypedDataDefinition
    );
  }

  /** The API's modules on one MemoryDatabase, with the platform's first wallet. */
  async function Platform() {
    const memory = new MemoryDatabase();
    memory.UniqueIndex('Subscriptions', ['subscription_onchain_id'], {
      subscription_onchain_id: { $type: 'string' },
      status: { $in: [...LIVE_SUBSCRIPTION_STATUSES] },
    });
    memory.UniqueIndex('ArchivedWalletDeposits', [
      'transaction_hash',
      'log_index',
    ]);
    memory.UniqueIndex('TopUps', [
      'metadata.blockchain_tx',
      'metadata.log_index',
    ]);
    // Only the connected-accounts total uses an aggregation.
    Object.assign(memory, { Aggregate: async () => [] });
    memory.Seed('Accounts', { id: PLATFORM, platform_account: PLATFORM });
    memory.Seed('Balances', {
      id: 'bal_fd_platform',
      account: PLATFORM,
      available: [{ amount: 0, currency: 'usdc' }],
      pending: [{ amount: 0, currency: 'usdc' }],
    });
    const db = memory.AsDatabase();
    const eventService = new EventService(db);
    const planDestinations = new PlanDestinationModule(
      db,
      ethereum,
      eventService
    );
    const wallets = new ExternalWalletModule(
      db,
      eventService,
      planDestinations
    );
    const customers = new CustomerModule(db, eventService);
    const products = new ProductModule(db, eventService);
    const prices = new PriceModule(db, eventService, products);
    const paymentIntents = new PaymentIntentModule(db, eventService, customers);
    const charges = new ChargeModule(db, eventService, customers);
    const invoices = new InvoiceModule(
      db,
      eventService,
      customers,
      new InvoiceItemModule(db, eventService, customers, prices),
      paymentIntents,
      charges,
      prices,
      ethereum
    );
    const subscriptions = new SubscriptionModule(
      db,
      eventService,
      customers,
      prices,
      invoices,
      ethereum
    );
    const billing = new SubscriptionBillingModule(
      db,
      subscriptions,
      invoices,
      ethereum,
      planDestinations
    );
    const first = await wallets.CreateExternalWallet(PLATFORM, {
      wallet_address: oldWallet,
    });
    return {
      memory,
      db,
      eventService,
      wallets,
      customers,
      products,
      prices,
      paymentIntents,
      charges,
      subscriptions,
      billing,
      first,
    };
  }

  /** A new wallet with no USDC, so what lands there is easy to count. */
  function FreshAddress(): Address {
    return privateKeyToAccount(generatePrivateKey()).address;
  }

  it('moves the plan on a switch, charges the new wallet next, and alerts USDC sent to the old one', async () => {
    const api = await Platform();
    const customer = await api.customers.CreateCustomer(PLATFORM, {
      email: 'subscriber@example.com',
    });
    // The plan is created as the API creates it: paying the default wallet.
    const created = await api.prices.CreatePrice(PLATFORM, {
      currency: 'usdc',
      unit_amount: AMOUNT_CENTS,
      recurring: { interval: 'month' },
      product_data: { name: 'Anvil plan' },
    });
    const planKey = (await ethereum.CreateSubscriptionPlan(
      created.id,
      PERIOD_SECONDS,
      AMOUNT_CENTS,
      oldWallet,
      operator
    )) as Hex;
    await api.db.Update<Price>('Prices', created.id, {
      subscription_plan_id: planKey,
      subscription_plan_destination: oldWallet,
    });

    // The buyer subscribes and the first period pays the old wallet.
    const prepared = await ethereum.BuildSubscribeAuthorization(
      buyer,
      planKey,
      (await ChainTime()) + 3600
    );
    const subscribeHash = await ethereum.RelaySubscribe(
      {
        planKey,
        subscriber: buyer,
        permitSignature: prepared.needs_permit
          ? await Sign(prepared.permit_typed_data)
          : null,
        subscribeSignature: await Sign(prepared.subscribe_typed_data),
        deadline: prepared.deadline ?? 0,
        firstChargeAt: prepared.first_charge_at,
      },
      { onSigned: async () => undefined }
    );
    await Context().Mine(1);
    const verified = await ethereum.VerifySubscribeTransaction(
      subscribeHash,
      { planKey, subscriberWallet: buyer },
      TIMEOUT
    );
    const subId = verified.subscription_onchain_id as Hex;
    const periodStart = (await ethereum.GetSubscriptionState(subId))
      .next_charge_at as number;
    const first = await ethereum.CollectSubscriptionPayment({
      subscriptionOnchainId: subId,
      planKey,
      subscriberWallet: buyer,
      amountCents: AMOUNT_CENTS,
      onSigned: async () => undefined,
    });
    if (first.status !== 'collected') throw new Error('Not collected');
    mockClock = await ChainTime();
    await api.subscriptions.CreateSubscription(
      PLATFORM,
      {
        customer: customer.id,
        items: [{ price: created.id, quantity: 1 }],
        default_payment_method: buyer,
      },
      {
        settlementTransactionHash: first.transaction_hash,
        subscriptionOnchainId: subId,
        periodStart,
      }
    );
    const oldBefore = await BalanceOf(oldWallet);
    // The deposit scan is up to date before the switch, as a running
    // monitor keeps it.
    await Context().Mine(1);
    const monitor = new TopUpMonitor(api.db);
    await monitor.CheckDepositsForAccount(PLATFORM);

    // Switch: add the new wallet as the default.
    const newWallet = FreshAddress();
    const added = await api.wallets.CreateExternalWallet(PLATFORM, {
      wallet_address: newWallet,
      default_for_currency: true,
    });

    expect((await api.wallets.GetDefaultWallet(PLATFORM))?.id).toBe(added.id);
    const change = api.memory.Doc<Price>(
      'Prices',
      created.id
    ).subscription_plan_destination_change;
    expect(change).toMatchObject({
      destination: newWallet,
      status: 'pending',
    });
    expect(change?.transaction_hash).toMatch(/^0x[0-9a-f]{64}$/);

    // The runner confirms the change by its hash, then charges: the new
    // wallet receives the period.
    await PassTime(PERIOD_SECONDS + 1);
    await api.billing.Run({ platformAccountId: PLATFORM, batchSize: 10 });

    expect(await PlanDestination(planKey)).toBe(newWallet);
    expect(api.memory.Doc<Price>('Prices', created.id)).toMatchObject({
      subscription_plan_destination: newWallet,
      subscription_plan_destination_change: {
        status: 'confirmed',
        transaction_hash: change?.transaction_hash,
      },
    });
    expect(mockEvents).toContain('price.updated');
    expect(await BalanceOf(newWallet)).toBe(AMOUNT);
    expect(await BalanceOf(oldWallet)).toBe(oldBefore);

    // USDC sent to the old wallet, now removed, is alerted, never credited.
    await api.wallets.DeleteExternalWallet(api.first.id);
    const { publicClient, addresses, accounts } = Context();
    const transfer = await createWalletClient({
      account: privateKeyToAccount(accounts.buyer),
      chain: foundry,
      transport: http(Context().rpcUrl),
    }).writeContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [oldWallet, 5_000_000n],
    });
    await publicClient.waitForTransactionReceipt({ hash: transfer });
    await Context().Mine(1);

    await monitor.CheckDepositsForAccount(PLATFORM);

    const transferHash = transfer.toLowerCase();
    expect(
      api.memory
        .All<TopUp>('TopUps')
        .filter((topUp) => topUp.metadata.blockchain_tx === transferHash)
    ).toEqual([]);
    expect(
      api.memory.All<ArchivedWalletDeposit>('ArchivedWalletDeposits')
    ).toEqual([
      expect.objectContaining({
        wallet_id: api.first.id,
        wallet_address: oldWallet,
        transaction_hash: transferHash,
        amount: 500,
        acknowledged: false,
      }),
    ]);
    const details = await new BalanceModule(api.db).GetBalanceDetails(PLATFORM);
    expect(details).toMatchObject({
      wallet_address: newWallet,
      archived_wallet_deposits: [
        expect.objectContaining({ transaction_hash: transferHash }),
      ],
    });

    const [alert] = details?.archived_wallet_deposits ?? [];
    await new ArchivedWalletDepositStore(api.db).Acknowledge(
      PLATFORM,
      alert.id
    );
    await expect(
      new BalanceModule(api.db).GetBalanceDetails(PLATFORM)
    ).resolves.toMatchObject({ archived_wallet_deposits: [] });
  });

  it('answers a checkout prepared before the switch with merchant_wallet_changed, and completes it after a re-prepare', async () => {
    const previous = process.env.CHECKOUT_CONFIRM_TIMEOUT_MS;
    process.env.CHECKOUT_CONFIRM_TIMEOUT_MS = '1000';
    try {
      const api = await Platform();
      const checkoutSessions = new CheckoutSessionModule(
        api.db,
        api.eventService,
        undefined,
        api.products,
        undefined,
        api.paymentIntents
      );
      const checkout = new CheckoutPaymentModule(
        api.db,
        checkoutSessions,
        api.wallets,
        api.products,
        api.paymentIntents,
        api.charges,
        undefined,
        ethereum
      );
      const intent = api.paymentIntents.PaymentIntentObject(PLATFORM, {
        amount: 1200,
        currency: 'usdc',
      });
      api.memory.Seed('PaymentIntents', { ...intent });
      const session: CheckoutSession = {
        ...checkoutSessions.CheckoutSessionObject(
          PLATFORM,
          { mode: 'payment', success_url: 'https://example.com/success' },
          [
            {
              id: 'li_fd_anvil',
              object: 'item',
              amount_discount: 0,
              amount_subtotal: 1200,
              amount_tax: 0,
              amount_total: 1200,
              currency: 'usdc',
              description: 'Anvil checkout',
              discounts: null,
              metadata: {},
              price: null,
              quantity: 1,
              taxes: null,
            },
          ]
        ),
        payment_intent: intent.id,
      };
      api.memory.Seed('CheckoutSessions', { ...session });
      const relayer = privateKeyToAccount(Context().accounts.relayer).address;
      const RelayerNonce = () =>
        Context().publicClient.getTransactionCount({
          address: relayer,
          blockTag: 'pending',
        });

      const before = await checkout.PreparePayment(session.url_slug, buyer, {
        email: 'buyer@example.com',
      });
      expect(before.merchant_wallet_address).toBe(oldWallet);
      const staleSignature = await Sign(before.typed_data ?? null);

      const newWallet = FreshAddress();
      await api.wallets.CreateExternalWallet(PLATFORM, {
        wallet_address: newWallet,
        default_for_currency: true,
      });
      const nonce = await RelayerNonce();

      await expect(
        checkout.ConfirmPayment(session.url_slug, { signature: staleSignature })
      ).rejects.toMatchObject({
        statusCode: 409,
        type: 'merchant_wallet_changed',
        message:
          "The merchant's receiving wallet changed. Please approve the payment again.",
      });
      expect(await RelayerNonce()).toBe(nonce);

      const again = await checkout.PreparePayment(session.url_slug, buyer, {
        email: 'buyer@example.com',
      });
      expect(again.merchant_wallet_address).toBe(newWallet);
      const pending = await checkout
        .ConfirmPayment(session.url_slug, {
          signature: await Sign(again.typed_data ?? null),
        })
        .catch((error: unknown) => error);
      expect(pending).toMatchObject({ type: 'payment_pending' });
      await Context().Mine(1);
      const hash = api.memory.Doc<CheckoutSession>(
        'CheckoutSessions',
        session.id
      ).payment_details?.transaction_hash;

      await expect(
        checkout.ConfirmPayment(session.url_slug, {
          transaction_hash: hash ?? undefined,
        })
      ).resolves.toMatchObject({
        status: 'complete',
        payment_details: { merchant_wallet: newWallet },
      });
      expect(await BalanceOf(newWallet)).toBe(12_000_000n);
      expect(
        api.memory.Doc<ExternalWallet>('ExternalWallets', api.first.id)
          .default_for_currency
      ).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.CHECKOUT_CONFIRM_TIMEOUT_MS;
      } else {
        process.env.CHECKOUT_CONFIRM_TIMEOUT_MS = previous;
      }
    }
  });
});
