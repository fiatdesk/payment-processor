// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { CheckoutPaymentModule } from '../modules/CheckoutPayment';
import { CheckoutSessionModule } from '../modules/CheckoutSession';
import { ChargeModule } from '../modules/Charge';
import type { CustomerModule } from '../modules/Customer';
import { Database } from '../modules/Database';
import { EventService } from '../modules/EventService';
import { ExternalWalletModule } from '../modules/ExternalWallet';
import { PaymentIntentModule } from '../modules/PaymentIntent';
import { ProductModule } from '../modules/Product';
import type { SubscriptionModule } from '../modules/Subscription';
import { NotSupported } from '../modules/chains/Ethereum';
import { BuildTransferAuthorization } from '../modules/chains/CheckoutAuthorization';
import {
  SimulatedSettlement,
  SimulatedSignature,
  type Settlement,
} from '../modules/chains/Settlement';
import type {
  CheckoutPaymentVerification,
  CheckoutSubscribeVerification,
} from '../modules/chains/types';
import { AppError } from '../utils/AppError';
import { WithKeyedLock } from '../utils/KeyedLock';
import {
  BalanceTransaction,
  Charge,
  CheckoutSession,
  CheckoutSessionLineItem,
  ExternalWallet,
  PaymentIntent,
  Price,
} from '@zoneless/shared-types';
import {
  CreateMockDatabase,
  DeterministicId,
  DeterministicUrlSlug,
  GetFixedTimestamp,
  ResetIdCounter,
} from './Setup';
import { MemoryDatabase } from './mocks/MemoryDatabase';
import {
  CreateMockSettlement,
  MOCK_CHARGE_HASH,
  MOCK_PAYER,
  MOCK_PLAN_KEY,
  MOCK_RELAY_HASH,
  MOCK_SUBSCRIBE_HASH,
  MOCK_SUBSCRIPTION_ID,
  MOCK_USDC,
  MockPreparedSubscribe,
} from './mocks/Settlement';

jest.mock('../modules/Database');
jest.mock('../utils/IdGenerator', () => ({
  GenerateId: jest.fn((prefix: string) => DeterministicId(prefix)),
  GenerateUrlSlug: jest.fn(() => DeterministicUrlSlug()),
}));
jest.mock('../utils/Timestamp', () => ({
  Now: jest.fn(() => GetFixedTimestamp()),
}));
jest.mock('../modules/AppConfig', () => ({
  GetAppConfig: jest.fn(() => ({
    dashboardUrl: 'http://localhost:4200',
    checkoutUrl: 'http://localhost:4200',
    paymentLinkUrl: 'http://localhost:4200',
    livemode: false,
    appSecret: 'test-secret',
  })),
  GetCheckoutConfirmTimeoutMs: jest.fn(() => 90_000),
}));
// Charges read the network from the module-level rail.
// Real per-session locking by default; a test can bypass it to act as
// several API processes.
jest.mock('../utils/KeyedLock', () => {
  const actual = jest.requireActual('../utils/KeyedLock');
  return { WithKeyedLock: jest.fn(actual.WithKeyedLock) };
});
jest.mock('../modules/chains/Settlement', () => ({
  ...jest.requireActual('../modules/chains/Settlement'),
  GetSettlement: jest.fn(() =>
    jest.requireActual('./mocks/Settlement').CreateMockSettlement()
  ),
}));

const PAYER_WALLET = MOCK_PAYER;
const MERCHANT_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const SIGNATURE = `0x${'5a'.repeat(64)}1b`;
const OTHER_HASH = `0x${'0b'.repeat(32)}`;

function BuildPrice(overrides: Partial<Price> = {}): Price {
  return {
    id: 'price_z_1',
    active: true,
    currency: 'usdc',
    metadata: {},
    nickname: null,
    product: 'prod_z_1',
    recurring: null,
    tax_behavior: 'unspecified',
    type: 'one_time',
    unit_amount: 1000,
    object: 'price',
    billing_scheme: 'per_unit',
    currency_options: null,
    created: 1700000000,
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    tiers: null,
    tiers_mode: null,
    transform_quantity: null,
    unit_amount_decimal: '1000',
    platform_account: 'acct_z_platform',
    subscription_plan_id: null,
    ...overrides,
  };
}

function RecurringPrice(): Price {
  return BuildPrice({
    type: 'recurring',
    recurring: {
      interval: 'month',
      interval_count: 1,
      meter: null,
      trial_period_days: null,
      usage_type: 'licensed',
    },
    subscription_plan_id: MOCK_PLAN_KEY,
  });
}

function BuildLineItem(
  overrides: Partial<CheckoutSessionLineItem> = {}
): CheckoutSessionLineItem {
  return {
    id: 'li_z_1',
    object: 'item',
    amount_discount: 0,
    amount_subtotal: 1000,
    amount_tax: 0,
    amount_total: 1000,
    currency: 'usdc',
    description: 'Test Product',
    discounts: null,
    metadata: {},
    price: BuildPrice(),
    quantity: 1,
    taxes: null,
    ...overrides,
  };
}

const merchantWallet = {
  id: 'ew_z_1',
  object: 'wallet' as const,
  account: 'acct_z_platform',
  wallet_address: MERCHANT_WALLET,
  network: 'ethereum',
  currency: 'usdc',
  default_for_currency: true,
  status: 'verified' as const,
  created: 1700000000,
  metadata: {},
  platform_account: 'acct_z_platform',
} as unknown as ExternalWallet;

function Verified(
  transactionHash: string | null,
  overrides: Partial<CheckoutPaymentVerification> = {}
): CheckoutPaymentVerification {
  return {
    status: 'verified',
    transaction_hash: transactionHash,
    amount_cents: 1000,
    payer_address: PAYER_WALLET,
    ...overrides,
  };
}

function Pending(transactionHash: string | null): CheckoutPaymentVerification {
  return {
    status: 'pending',
    transaction_hash: transactionHash,
    amount_cents: 0,
    payer_address: null,
  };
}

describe('CheckoutPaymentModule', () => {
  let module: CheckoutPaymentModule;
  let mockDb: jest.Mocked<Database>;
  let eventService: jest.Mocked<EventService>;
  let checkoutSessionModule: CheckoutSessionModule;
  let paymentIntentModule: PaymentIntentModule;
  let chargeModule: ChargeModule;
  let mockSettlement: jest.Mocked<Settlement>;
  let mockExternalWalletModule: jest.Mocked<
    Pick<ExternalWalletModule, 'GetDefaultWallet'>
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    ResetIdCounter();
    mockDb = CreateMockDatabase();
    eventService = {
      Emit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventService>;

    const productModule = new ProductModule(mockDb);
    paymentIntentModule = new PaymentIntentModule(mockDb, eventService);
    chargeModule = new ChargeModule(mockDb, eventService);
    checkoutSessionModule = new CheckoutSessionModule(
      mockDb,
      eventService,
      undefined,
      productModule,
      undefined,
      paymentIntentModule
    );

    mockSettlement = CreateMockSettlement();

    mockExternalWalletModule = {
      GetDefaultWallet: jest.fn().mockResolvedValue(merchantWallet),
    };
    // The prepare write is conditional on no relay being recorded.
    mockDb.FindOneAndUpdateByFilter = jest
      .fn()
      .mockResolvedValue({ id: 'cs_z_updated' });

    module = new CheckoutPaymentModule(
      mockDb,
      checkoutSessionModule,
      mockExternalWalletModule as unknown as ExternalWalletModule,
      productModule,
      paymentIntentModule,
      chargeModule,
      undefined,
      mockSettlement
    );
  });

  function BuildOpenSession(
    overrides: Partial<CheckoutSession> = {}
  ): CheckoutSession {
    return {
      ...checkoutSessionModule.CheckoutSessionObject(
        'acct_z_platform',
        { mode: 'payment', success_url: 'https://example.com/success' },
        [BuildLineItem()]
      ),
      payment_intent: 'pi_z_1',
      ...overrides,
    };
  }

  function BuildPaymentIntent(
    status:
      | 'requires_payment_method'
      | 'requires_confirmation'
      | 'processing' = 'requires_payment_method'
  ) {
    return {
      ...paymentIntentModule.PaymentIntentObject('acct_z_platform', {
        amount: 1000,
        currency: 'usdc',
      }),
      id: 'pi_z_1',
      status,
      payment_method: PAYER_WALLET,
    };
  }

  describe('GetPaymentPageSession', () => {
    it("should expose the rail's token address on the merchant wallet", async () => {
      const session = BuildOpenSession();
      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSessionByUrlSlug')
        .mockResolvedValue(session);

      const result = await module.GetPaymentPageSession(session.url_slug);

      expect(mockSettlement.Describe).toHaveBeenCalled();
      expect(result.merchant_wallet).toEqual({
        wallet_address: MERCHANT_WALLET,
        network: 'ethereum',
        currency: 'usdc',
        token_address: MOCK_USDC,
      });
    });
  });

  describe('PreparePayment', () => {
    it('should prepare a relayed USDC authorization and mark the PaymentIntent requires_confirmation', async () => {
      const session = BuildOpenSession();
      const paymentIntent = BuildPaymentIntent();
      const requiresConfirmation = {
        ...paymentIntent,
        status: 'requires_confirmation' as const,
        payment_method: PAYER_WALLET,
      };

      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSessionByUrlSlug')
        .mockResolvedValue(session);
      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSession')
        .mockResolvedValue(session);
      mockDb.Get = jest
        .fn()
        .mockResolvedValueOnce(paymentIntent)
        .mockResolvedValueOnce(paymentIntent)
        .mockResolvedValueOnce(requiresConfirmation);

      const result = await module.PreparePayment(
        session.url_slug,
        PAYER_WALLET,
        { email: 'buyer@example.com' }
      );

      expect(
        mockSettlement.BuildCheckoutPaymentAuthorization
      ).toHaveBeenCalledWith(
        PAYER_WALLET,
        MERCHANT_WALLET,
        1000,
        session.id,
        session.expires_at
      );
      expect(eventService.Emit).toHaveBeenCalledWith(
        'payment_intent.updated',
        'acct_z_platform',
        requiresConfirmation,
        expect.objectContaining({
          previousAttributes: expect.objectContaining({
            status: 'requires_payment_method',
          }),
        })
      );
      const authorization = BuildTransferAuthorization({
        payer: PAYER_WALLET,
        merchant: MERCHANT_WALLET,
        amountCents: 1000,
        sessionId: session.id,
        expiresAt: session.expires_at,
      });
      expect(result).toEqual({
        object: 'checkout.payment_transaction',
        checkout_session: session.id,
        amount_total: 1000,
        currency: 'usdc',
        merchant_wallet_address: MERCHANT_WALLET,
        relayed: true,
        method: 'eip3009_transfer',
        typed_data: expect.objectContaining({
          primaryType: 'TransferWithAuthorization',
          message: expect.objectContaining({ value: '10000000' }),
        }),
        authorization,
        estimated_fee: '300000000000000',
        fee_currency: 'eth',
        chain_id: 11155111,
      });
      expect(mockDb.FindOneAndUpdateByFilter).toHaveBeenCalledWith(
        'CheckoutSessions',
        { id: session.id, status: 'open', payment_details: null },
        {
          payment_details: {
            transaction_hash: null,
            payer_wallet: PAYER_WALLET,
            relayed: true,
            merchant_wallet: MERCHANT_WALLET,
          },
        }
      );
    });

    it('should store a lowercase payer wallet checksummed', async () => {
      const session = BuildOpenSession();
      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSessionByUrlSlug')
        .mockResolvedValue(session);
      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSession')
        .mockResolvedValue(session);
      mockDb.Get = jest.fn().mockResolvedValue(BuildPaymentIntent());

      await module.PreparePayment(
        session.url_slug,
        PAYER_WALLET.toLowerCase(),
        { email: 'buyer@example.com' }
      );

      expect(
        mockSettlement.BuildCheckoutPaymentAuthorization
      ).toHaveBeenCalledWith(
        PAYER_WALLET,
        MERCHANT_WALLET,
        1000,
        session.id,
        session.expires_at
      );
      expect(mockDb.FindOneAndUpdateByFilter).toHaveBeenCalledWith(
        'CheckoutSessions',
        { id: session.id, status: 'open', payment_details: null },
        {
          payment_details: {
            transaction_hash: null,
            payer_wallet: PAYER_WALLET,
            relayed: true,
            merchant_wallet: MERCHANT_WALLET,
          },
        }
      );
    });

    it('should reject a payer wallet that is not an Ethereum address', async () => {
      await expect(
        module.PreparePayment(
          'any-slug',
          'D8VMZCmmTUUfhejNhNQKAmqvZCKfUq1qU6RqQKxQwXyX',
          { email: 'buyer@example.com' }
        )
      ).rejects.toThrow('payer_wallet must be a valid Ethereum address');
      expect(
        mockSettlement.BuildCheckoutPaymentAuthorization
      ).not.toHaveBeenCalled();
    });

    it('should let a missing relayer key surface as not_supported', async () => {
      const session = BuildOpenSession();
      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSessionByUrlSlug')
        .mockResolvedValue(session);
      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSession')
        .mockResolvedValue(session);
      mockSettlement.BuildCheckoutPaymentAuthorization.mockRejectedValue(
        new AppError(
          'On-chain checkout needs CHECKOUT_RELAYER_KEY to relay payments',
          501,
          'not_supported'
        )
      );

      await expect(
        module.PreparePayment(session.url_slug, PAYER_WALLET, {
          email: 'buyer@example.com',
        })
      ).rejects.toMatchObject({ statusCode: 501, type: 'not_supported' });
      expect(mockDb.Update).not.toHaveBeenCalledWith(
        'PaymentIntents',
        expect.anything(),
        expect.anything()
      );
    });

    describe('in subscription mode', () => {
      let session: CheckoutSession;

      beforeEach(() => {
        session = BuildOpenSession({
          mode: 'subscription',
          payment_intent: null,
          line_items: {
            object: 'list',
            data: [BuildLineItem({ price: RecurringPrice() })],
            has_more: false,
            url: '/v1/checkout/sessions/cs_z_1/line_items',
          },
        });
        jest
          .spyOn(checkoutSessionModule, 'GetCheckoutSessionByUrlSlug')
          .mockResolvedValue(session);
        jest
          .spyOn(checkoutSessionModule, 'GetCheckoutSession')
          .mockResolvedValue(session);
        mockDb.Update = jest.fn().mockResolvedValue(undefined);
      });

      function Prepare() {
        return module.PreparePayment(session.url_slug, PAYER_WALLET, {
          email: 'buyer@example.com',
        });
      }

      it('returns the permit and subscribe typed data for a first-time subscriber, relayed', async () => {
        const result = await Prepare();

        expect(mockSettlement.BuildSubscribeAuthorization).toHaveBeenCalledWith(
          PAYER_WALLET,
          MOCK_PLAN_KEY,
          session.expires_at
        );
        expect(
          mockSettlement.BuildCheckoutPaymentAuthorization
        ).not.toHaveBeenCalled();
        const prepared = MockPreparedSubscribe(
          PAYER_WALLET,
          MOCK_PLAN_KEY,
          session.expires_at
        );
        expect(result).toMatchObject({
          relayed: true,
          estimated_fee: prepared.estimated_fee,
          fee_currency: 'eth',
          chain_id: 11155111,
          already_subscribed: false,
        });
        expect(result.subscription).toEqual({
          plan_id: MOCK_PLAN_KEY,
          needs_permit: true,
          permit_typed_data: prepared.permit_typed_data,
          subscribe_typed_data: prepared.subscribe_typed_data,
          deadline: session.expires_at,
          already_subscribed: false,
          subscription_onchain_id: null,
        });
        expect(result.subscription?.permit_typed_data).not.toBeNull();
        expect(result).not.toHaveProperty('unsigned_transaction');
      });

      it('leaves the permit out when the allowance already covers the plan', async () => {
        mockSettlement.BuildSubscribeAuthorization.mockImplementation(
          async (subscriber, planKey, expiresAt) =>
            MockPreparedSubscribe(subscriber, planKey, expiresAt, false)
        );

        const result = await Prepare();

        expect(result.subscription).toMatchObject({
          needs_permit: false,
          permit_typed_data: null,
          subscribe_typed_data: expect.objectContaining({
            primaryType: 'Subscribe',
          }),
        });
      });

      it('reports an existing on-chain subscription instead of typed data', async () => {
        mockSettlement.FindExistingSubscription.mockResolvedValue(
          MOCK_SUBSCRIPTION_ID
        );

        const result = await Prepare();

        expect(mockSettlement.FindExistingSubscription).toHaveBeenCalledWith(
          MOCK_PLAN_KEY,
          PAYER_WALLET
        );
        expect(
          mockSettlement.BuildSubscribeAuthorization
        ).not.toHaveBeenCalled();
        expect(result).toMatchObject({
          estimated_fee: '0',
          already_subscribed: true,
          subscription_onchain_id: MOCK_SUBSCRIPTION_ID,
          subscription: {
            plan_id: MOCK_PLAN_KEY,
            needs_permit: false,
            permit_typed_data: null,
            subscribe_typed_data: null,
            deadline: null,
            already_subscribed: true,
            subscription_onchain_id: MOCK_SUBSCRIPTION_ID,
          },
        });
      });
    });
  });
});

/** Confirm flows against an in-memory database, so state is real. */
describe('CheckoutPaymentModule.ConfirmPayment', () => {
  const SLUG = 'slug_pay';
  let memory: MemoryDatabase;
  let checkoutSessionModule: CheckoutSessionModule;
  let paymentIntentModule: PaymentIntentModule;
  let chargeModule: ChargeModule;
  let productModule: ProductModule;
  let settlement: jest.Mocked<Settlement>;
  let events: string[];
  let module: CheckoutPaymentModule;
  let session: CheckoutSession;

  let wallets: ExternalWalletModule;

  beforeEach(() => {
    wallets = {
      GetDefaultWallet: jest.fn(async () => merchantWallet),
    } as unknown as ExternalWalletModule;
    jest.clearAllMocks();
    ResetIdCounter();
    memory = new MemoryDatabase();
    const db = memory.AsDatabase();
    events = [];
    const eventService = {
      Emit: jest.fn(async (type: string) => {
        events.push(type);
      }),
    } as unknown as EventService;
    productModule = new ProductModule(db);
    paymentIntentModule = new PaymentIntentModule(db, eventService);
    chargeModule = new ChargeModule(db, eventService);
    checkoutSessionModule = new CheckoutSessionModule(
      db,
      eventService,
      undefined,
      productModule,
      undefined,
      paymentIntentModule
    );
    settlement = CreateMockSettlement();
    module = Module(settlement);

    session = {
      ...checkoutSessionModule.CheckoutSessionObject(
        'acct_z_platform',
        { mode: 'payment', success_url: 'https://example.com/success' },
        [BuildLineItem()]
      ),
      id: 'cs_z_pay',
      url_slug: SLUG,
      payment_intent: 'pi_z_1',
      payment_details: {
        transaction_hash: null,
        payer_wallet: PAYER_WALLET,
        relayed: true,
      },
    };
    memory.Seed('CheckoutSessions', { ...session });
    memory.Seed('PaymentIntents', {
      ...paymentIntentModule.PaymentIntentObject('acct_z_platform', {
        amount: 1000,
        currency: 'usdc',
      }),
      id: 'pi_z_1',
      status: 'requires_confirmation',
      payment_method: PAYER_WALLET,
    });
  });

  function Module(
    rail: Settlement,
    extra: {
      customerModule?: CustomerModule;
      subscriptionModule?: SubscriptionModule;
    } = {}
  ): CheckoutPaymentModule {
    return new CheckoutPaymentModule(
      memory.AsDatabase(),
      checkoutSessionModule,
      wallets,
      productModule,
      paymentIntentModule,
      chargeModule,
      undefined,
      rail,
      extra.customerModule,
      extra.subscriptionModule
    );
  }

  function Session(id = 'cs_z_pay'): CheckoutSession {
    return memory.Doc<CheckoutSession>('CheckoutSessions', id);
  }

  function Intent(): PaymentIntent {
    return memory.Doc<PaymentIntent>('PaymentIntents', 'pi_z_1');
  }

  function Seed(overrides: Partial<CheckoutSession>): void {
    memory.Seed('CheckoutSessions', { ...Session(), ...overrides });
  }

  function ExpectNothingCompleted(): void {
    expect(Session()).toMatchObject({
      status: 'open',
      payment_status: 'unpaid',
    });
    expect(memory.All<Charge>('Charges')).toEqual([]);
    expect(memory.All<BalanceTransaction>('BalanceTransactions')).toEqual([]);
  }

  it('relays the signature, records its hash and the processing PaymentIntent before waiting, then completes', async () => {
    const seen: Record<string, unknown> = {};
    settlement.RelayCheckoutAuthorization.mockImplementation(
      async (_authorization, _signature, options) => {
        await options.onSigned(MOCK_RELAY_HASH);
        // What a crash right after sending would leave behind.
        seen.atSend = {
          hash: Session().payment_details?.transaction_hash,
          intent: Intent().status,
        };
        return MOCK_RELAY_HASH;
      }
    );
    settlement.VerifyCheckoutPayment.mockImplementation(async (hash) => {
      seen.atWait = {
        hash: Session().payment_details?.transaction_hash,
        intent: Intent().status,
      };
      return Verified(hash);
    });

    const result = await module.ConfirmPayment(SLUG, { signature: SIGNATURE });

    expect(settlement.RelayCheckoutAuthorization).toHaveBeenCalledWith(
      BuildTransferAuthorization({
        payer: PAYER_WALLET,
        merchant: MERCHANT_WALLET,
        amountCents: 1000,
        sessionId: 'cs_z_pay',
        expiresAt: session.expires_at,
      }),
      SIGNATURE,
      expect.objectContaining({ pendingHash: null })
    );
    expect(seen).toEqual({
      atSend: { hash: MOCK_RELAY_HASH, intent: 'processing' },
      atWait: { hash: MOCK_RELAY_HASH, intent: 'processing' },
    });
    expect(settlement.VerifyCheckoutPayment).toHaveBeenCalledWith(
      MOCK_RELAY_HASH,
      {
        merchantWalletAddress: MERCHANT_WALLET,
        amountInCents: 1000,
        checkoutSessionId: 'cs_z_pay',
        payerAddress: PAYER_WALLET,
        createdAt: session.created,
      },
      { timeoutMs: 90_000 }
    );
    expect(result).toMatchObject({
      status: 'complete',
      payment_status: 'paid',
      payment_details: {
        transaction_hash: MOCK_RELAY_HASH,
        payer_wallet: PAYER_WALLET,
        relayed: true,
      },
    });
    expect(Intent()).toMatchObject({
      status: 'succeeded',
      amount_received: 1000,
    });
    expect(events).toEqual([
      'payment_intent.processing',
      'charge.succeeded',
      'payment_intent.succeeded',
      'checkout.session.completed',
    ]);
    expect(memory.All<Charge>('Charges')).toEqual([
      expect.objectContaining({
        status: 'succeeded',
        payment_method_details: expect.objectContaining({
          crypto: expect.objectContaining({
            transaction_hash: MOCK_RELAY_HASH,
            buyer_address: PAYER_WALLET,
          }),
        }),
      }),
    ]);
    expect(memory.All<BalanceTransaction>('BalanceTransactions')).toEqual([
      expect.objectContaining({
        type: 'payment',
        amount: 1000,
        source: 'cs_z_pay',
        metadata: expect.objectContaining({ blockchain_tx: MOCK_RELAY_HASH }),
      }),
    ]);
  });

  it('returns payment_pending with the relayed hash when confirmations time out, keeping the hash', async () => {
    settlement.VerifyCheckoutPayment.mockResolvedValue(
      Pending(MOCK_RELAY_HASH)
    );

    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).rejects.toMatchObject({
      statusCode: 409,
      type: 'payment_pending',
      details: { code: 'payment_pending', transaction_hash: MOCK_RELAY_HASH },
    });

    expect(Session().payment_details?.transaction_hash).toBe(MOCK_RELAY_HASH);
    expect(Intent().status).toBe('processing');
    ExpectNothingCompleted();
  });

  it('completes a retry with transaction_hash without relaying again', async () => {
    settlement.VerifyCheckoutPayment.mockResolvedValueOnce(
      Pending(MOCK_RELAY_HASH)
    );
    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).rejects.toMatchObject({ type: 'payment_pending' });

    const result = await module.ConfirmPayment(SLUG, {
      transaction_hash: `0x${MOCK_RELAY_HASH.slice(2).toUpperCase()}`,
    });

    expect(settlement.RelayCheckoutAuthorization).toHaveBeenCalledTimes(1);
    expect(settlement.VerifyCheckoutPayment).toHaveBeenLastCalledWith(
      MOCK_RELAY_HASH,
      expect.objectContaining({ checkoutSessionId: 'cs_z_pay' }),
      { timeoutMs: 90_000 }
    );
    expect(result).toMatchObject({
      status: 'complete',
      payment_details: { transaction_hash: MOCK_RELAY_HASH },
    });
    expect(memory.All<BalanceTransaction>('BalanceTransactions')).toHaveLength(
      1
    );
  });

  it('hands the recorded relay to the rail when the signature is sent again', async () => {
    Seed({
      payment_details: {
        transaction_hash: MOCK_RELAY_HASH,
        payer_wallet: PAYER_WALLET,
        relayed: true,
      },
    });

    await module.ConfirmPayment(SLUG, { signature: SIGNATURE });

    expect(settlement.RelayCheckoutAuthorization).toHaveBeenCalledWith(
      expect.anything(),
      SIGNATURE,
      expect.objectContaining({ pendingHash: MOCK_RELAY_HASH })
    );
    expect(Session()).toMatchObject({
      status: 'complete',
      payment_details: { transaction_hash: MOCK_RELAY_HASH },
    });
  });

  it('rejects a transaction_hash that already paid another Checkout Session and completes nothing', async () => {
    memory.Seed('CheckoutSessions', {
      ...session,
      id: 'cs_z_other',
      url_slug: 'slug_other',
      status: 'complete',
      payment_status: 'paid',
      payment_details: {
        transaction_hash: OTHER_HASH,
        payer_wallet: PAYER_WALLET,
        relayed: true,
      },
    });

    await expect(
      module.ConfirmPayment(SLUG, { transaction_hash: OTHER_HASH })
    ).rejects.toMatchObject({
      statusCode: 400,
      message:
        'This transaction has already been used for another Checkout Session',
    });

    expect(settlement.VerifyCheckoutPayment).not.toHaveBeenCalled();
    expect(Session().payment_details?.transaction_hash).toBeNull();
    expect(Intent().status).toBe('requires_confirmation');
    ExpectNothingCompleted();
    expect(events).toEqual([]);
  });

  it('rejects a verified payment whose transaction already paid another Checkout Session', async () => {
    memory.Seed('CheckoutSessions', {
      ...session,
      id: 'cs_z_other',
      url_slug: 'slug_other',
      status: 'complete',
      payment_status: 'paid',
      payment_details: {
        transaction_hash: OTHER_HASH,
        payer_wallet: PAYER_WALLET,
      },
    });
    settlement.VerifyCheckoutPayment.mockResolvedValue(Verified(OTHER_HASH));

    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).rejects.toThrow(
      'This transaction has already been used for another Checkout Session'
    );
    ExpectNothingCompleted();
  });

  it('leaves the PaymentIntent and session untouched when the relay is refused before sending', async () => {
    settlement.RelayCheckoutAuthorization.mockRejectedValue(
      new AppError(
        'The USDC authorization cannot be relayed: FiatTokenV2: invalid signature',
        400,
        'invalid_request_error'
      )
    );

    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/invalid signature/),
    });

    expect(Intent().status).toBe('requires_confirmation');
    expect(Session().payment_details?.transaction_hash).toBeNull();
    expect(settlement.VerifyCheckoutPayment).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('propagates not_supported from the rail unwrapped', async () => {
    const notSupported = NotSupported('RelayCheckoutAuthorization');
    settlement.RelayCheckoutAuthorization.mockRejectedValue(notSupported);

    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).rejects.toBe(notSupported);
    expect(Intent().status).toBe('requires_confirmation');
  });

  it('reverts the recorded relay when the network refuses it, so the customer can retry', async () => {
    settlement.RelayCheckoutAuthorization.mockImplementationOnce(
      async (_authorization, _signature, options) => {
        await options.onSigned(MOCK_RELAY_HASH);
        throw new AppError(
          'The network did not accept the payment: insufficient funds for gas',
          400,
          'blockchain_error'
        );
      }
    );

    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).rejects.toMatchObject({ statusCode: 400, type: 'blockchain_error' });

    expect(Session().payment_details?.transaction_hash).toBeNull();
    expect(Intent()).toMatchObject({
      status: 'requires_payment_method',
      last_payment_error: expect.objectContaining({
        message: 'The network did not accept the payment',
      }),
    });
    expect(events).toEqual([
      'payment_intent.processing',
      'payment_intent.payment_failed',
    ]);

    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).resolves.toMatchObject({ status: 'complete' });
    expect(settlement.RelayCheckoutAuthorization).toHaveBeenLastCalledWith(
      expect.anything(),
      SIGNATURE,
      expect.objectContaining({ pendingHash: null })
    );
  });

  it('refuses a transaction_hash other than the relayed one', async () => {
    Seed({
      payment_details: {
        transaction_hash: MOCK_RELAY_HASH,
        payer_wallet: PAYER_WALLET,
        relayed: true,
      },
    });

    await expect(
      module.ConfirmPayment(SLUG, { transaction_hash: OTHER_HASH })
    ).rejects.toThrow(
      'transaction_hash is not the payment relayed for this Checkout Session'
    );
    expect(settlement.VerifyCheckoutPayment).not.toHaveBeenCalled();
    expect(Session().payment_details?.transaction_hash).toBe(MOCK_RELAY_HASH);
  });

  it('fails the attempt and clears the relay when verification fails', async () => {
    settlement.VerifyCheckoutPayment.mockResolvedValue({
      status: 'failed',
      transaction_hash: MOCK_RELAY_HASH,
      amount_cents: 0,
      payer_address: PAYER_WALLET,
      failure_reason:
        'The authorized transfer does not pay the merchant wallet',
    });

    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'The authorized transfer does not pay the merchant wallet',
    });

    expect(events).toEqual([
      'payment_intent.processing',
      'charge.failed',
      'payment_intent.payment_failed',
    ]);
    expect(memory.All<Charge>('Charges')).toEqual([
      expect.objectContaining({ status: 'failed', paid: false }),
    ]);
    expect(Intent()).toMatchObject({
      status: 'requires_payment_method',
      last_payment_error: expect.objectContaining({
        message: 'The authorized transfer does not pay the merchant wallet',
      }),
    });
    expect(Session()).toMatchObject({
      status: 'open',
      payment_details: { transaction_hash: null },
    });
  });

  it('completes with the transaction that used the authorization first', async () => {
    settlement.VerifyCheckoutPayment.mockResolvedValue(Verified(OTHER_HASH));

    const result = await module.ConfirmPayment(SLUG, { signature: SIGNATURE });

    expect(result.payment_details?.transaction_hash).toBe(OTHER_HASH);
    expect(memory.All<Charge>('Charges')).toEqual([
      expect.objectContaining({
        payment_method_details: expect.objectContaining({
          crypto: expect.objectContaining({ transaction_hash: OTHER_HASH }),
        }),
      }),
    ]);
  });

  it('verifies by authorization when the rail reports it already used', async () => {
    settlement.RelayCheckoutAuthorization.mockResolvedValue(null);
    settlement.VerifyCheckoutPayment.mockResolvedValue(Verified(OTHER_HASH));

    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).resolves.toMatchObject({
      status: 'complete',
      payment_details: { transaction_hash: OTHER_HASH },
    });
    expect(settlement.VerifyCheckoutPayment).toHaveBeenCalledWith(
      null,
      expect.anything(),
      expect.anything()
    );
  });

  it('requires prepare before confirming', async () => {
    Seed({ payment_details: null });

    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).rejects.toThrow(
      'Prepare the payment for this Checkout Session before confirming it'
    );
    expect(settlement.RelayCheckoutAuthorization).not.toHaveBeenCalled();
  });

  it('requires a signature or a transaction_hash', async () => {
    await expect(module.ConfirmPayment(SLUG, {})).rejects.toThrow(
      'signature or transaction_hash is required'
    );
  });

  it('finishes a relayed payment after expires_at but relays nothing new after it', async () => {
    Seed({ expires_at: GetFixedTimestamp() - 1 });

    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).rejects.toThrow('This Checkout Session has expired');
    expect(settlement.RelayCheckoutAuthorization).not.toHaveBeenCalled();

    Seed({
      payment_details: {
        transaction_hash: MOCK_RELAY_HASH,
        payer_wallet: PAYER_WALLET,
        relayed: true,
      },
    });
    await expect(
      module.ConfirmPayment(SLUG, { transaction_hash: MOCK_RELAY_HASH })
    ).resolves.toMatchObject({ status: 'complete' });
  });

  it('runs overlapping confirms of one session one at a time and pays once', async () => {
    const [first, second] = await Promise.all([
      module.ConfirmPayment(SLUG, { signature: SIGNATURE }),
      module.ConfirmPayment(SLUG, { signature: SIGNATURE }),
    ]);

    expect(first.status).toBe('complete');
    expect(second.status).toBe('complete');
    expect(settlement.RelayCheckoutAuthorization).toHaveBeenCalledTimes(1);
    expect(memory.All<Charge>('Charges')).toHaveLength(1);
    expect(memory.All<BalanceTransaction>('BalanceTransactions')).toHaveLength(
      1
    );
  });

  it('never stores provider error text on the PaymentIntent', async () => {
    settlement.RelayCheckoutAuthorization.mockImplementationOnce(
      async (_authorization, _signature, options) => {
        await options.onSigned(MOCK_RELAY_HASH);
        throw new Error('RPC error: quota exceeded for key sk_provider_secret');
      }
    );

    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).rejects.toThrow();

    expect(Intent().last_payment_error?.message).toBe(
      'The network did not accept the payment'
    );
    expect(JSON.stringify(Intent())).not.toContain('sk_provider_secret');
  });

  it('records a payment the rail found instead of relaying, then completes with it', async () => {
    settlement.RelayCheckoutAuthorization.mockResolvedValue(OTHER_HASH);
    let recordedAtWait: string | null | undefined;
    settlement.VerifyCheckoutPayment.mockImplementation(async (hash) => {
      recordedAtWait = Session().payment_details?.transaction_hash;
      return Verified(hash);
    });

    const result = await module.ConfirmPayment(SLUG, { signature: SIGNATURE });

    expect(settlement.RelayCheckoutAuthorization).toHaveBeenCalledWith(
      expect.anything(),
      SIGNATURE,
      expect.objectContaining({ createdAt: session.created })
    );
    expect(recordedAtWait).toBe(OTHER_HASH);
    expect(result.payment_details?.transaction_hash).toBe(OTHER_HASH);
  });

  it('verifies against the merchant wallet recorded at prepare, not the current default', async () => {
    const NEW_DEFAULT = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
    Seed({ payment_details: null });
    await module.PreparePayment(SLUG, PAYER_WALLET, {
      email: 'buyer@example.com',
    });
    expect(Session().payment_details).toMatchObject({
      payer_wallet: PAYER_WALLET,
      merchant_wallet: MERCHANT_WALLET,
    });
    jest
      .mocked(wallets.GetDefaultWallet)
      .mockResolvedValue({ ...merchantWallet, wallet_address: NEW_DEFAULT });

    const result = await module.ConfirmPayment(SLUG, { signature: SIGNATURE });

    expect(settlement.RelayCheckoutAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ to: MERCHANT_WALLET }),
      SIGNATURE,
      expect.anything()
    );
    expect(settlement.VerifyCheckoutPayment).toHaveBeenCalledWith(
      MOCK_RELAY_HASH,
      expect.objectContaining({ merchantWalletAddress: MERCHANT_WALLET }),
      expect.anything()
    );
    expect(result.payment_details?.merchant_wallet).toBe(MERCHANT_WALLET);
  });

  describe('when the network does not know the transaction', () => {
    const NotFound = (hash: string): CheckoutPaymentVerification => ({
      ...Pending(hash),
      status: 'not_found',
    });

    it('asks for the signature again for a recorded relay, keeping its state', async () => {
      Seed({
        payment_details: {
          transaction_hash: MOCK_RELAY_HASH,
          payer_wallet: PAYER_WALLET,
          relayed: true,
        },
      });
      memory.Seed('PaymentIntents', { ...Intent(), status: 'processing' });
      settlement.VerifyCheckoutPayment.mockResolvedValue(
        NotFound(MOCK_RELAY_HASH)
      );

      await expect(
        module.ConfirmPayment(SLUG, { transaction_hash: MOCK_RELAY_HASH })
      ).rejects.toMatchObject({
        statusCode: 409,
        type: 'payment_resubmit_required',
        details: {
          code: 'payment_resubmit_required',
          transaction_hash: MOCK_RELAY_HASH,
        },
      });
      expect(Session().payment_details?.transaction_hash).toBe(MOCK_RELAY_HASH);
      expect(Intent().status).toBe('processing');
      ExpectNothingCompleted();
    });

    it('rejects at once a hash no relay recorded, failing nothing', async () => {
      settlement.VerifyCheckoutPayment.mockResolvedValue(NotFound(OTHER_HASH));

      await expect(
        module.ConfirmPayment(SLUG, { transaction_hash: OTHER_HASH })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'transaction_hash is not a transaction the network knows',
      });
      expect(Intent().status).toBe('requires_confirmation');
      ExpectNothingCompleted();
      expect(events).toEqual([]);
    });

    it('keeps waiting for a relay it just sent', async () => {
      settlement.VerifyCheckoutPayment.mockResolvedValue(
        NotFound(MOCK_RELAY_HASH)
      );

      await expect(
        module.ConfirmPayment(SLUG, { signature: SIGNATURE })
      ).rejects.toMatchObject({ statusCode: 409, type: 'payment_pending' });
    });
  });

  it('rejects a foreign transaction_hash that does not pay the session without failing the PaymentIntent', async () => {
    settlement.VerifyCheckoutPayment.mockResolvedValue({
      status: 'failed',
      transaction_hash: OTHER_HASH,
      amount_cents: 0,
      payer_address: null,
      failure_reason:
        "The transaction does not use this Checkout Session's authorization",
    });

    await expect(
      module.ConfirmPayment(SLUG, { transaction_hash: OTHER_HASH })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Intent().status).toBe('requires_confirmation');
    ExpectNothingCompleted();
    expect(events).toEqual([]);
  });

  describe('across API processes', () => {
    const actualLock: typeof WithKeyedLock =
      jest.requireActual('../utils/KeyedLock').WithKeyedLock;

    beforeEach(() => {
      Seed({
        payment_details: {
          transaction_hash: MOCK_RELAY_HASH,
          payer_wallet: PAYER_WALLET,
          relayed: true,
        },
      });
      memory.Seed('PaymentIntents', { ...Intent(), status: 'processing' });
    });

    afterEach(() => {
      jest.mocked(WithKeyedLock).mockImplementation(actualLock);
      jest.useRealTimers();
    });

    function WithoutProcessLock(): void {
      jest
        .mocked(WithKeyedLock)
        .mockImplementation(((_key: string, task: () => Promise<unknown>) =>
          task()) as typeof WithKeyedLock);
    }

    it('records a payment two processes verified once, and both confirms succeed', async () => {
      WithoutProcessLock();
      // Both verifications finish together, as two long-polls on one hash do.
      settlement.VerifyCheckoutPayment.mockImplementation(async (hash) => {
        await new Promise((resolve) => setImmediate(resolve));
        return Verified(hash);
      });

      const results = await Promise.all([
        module.ConfirmPayment(SLUG, { transaction_hash: MOCK_RELAY_HASH }),
        Module(settlement).ConfirmPayment(SLUG, {
          transaction_hash: MOCK_RELAY_HASH,
        }),
      ]);

      expect(results.map((result) => result.status)).toEqual([
        'complete',
        'complete',
      ]);
      expect(results[1]).toEqual(results[0]);
      expect(memory.All<Charge>('Charges')).toHaveLength(1);
      for (const event of [
        'charge.succeeded',
        'payment_intent.succeeded',
        'checkout.session.completed',
      ]) {
        expect(events.filter((type) => type === event)).toHaveLength(1);
      }
      expect(
        memory.All<BalanceTransaction>('BalanceTransactions')
      ).toHaveLength(1);
    });

    it('takes over the claim of a confirm that crashed and reuses its Charge', async () => {
      Seed({
        payment_details: {
          transaction_hash: MOCK_RELAY_HASH,
          payer_wallet: PAYER_WALLET,
          relayed: true,
          settling_since: GetFixedTimestamp() - 120,
          settling_transaction: MOCK_RELAY_HASH,
        } as CheckoutSession['payment_details'],
      });
      memory.Seed('Charges', {
        id: 'ch_z_crashed',
        object: 'charge',
        status: 'succeeded',
        payment_intent: 'pi_z_1',
        platform_account: 'acct_z_platform',
        payment_method_details: {
          type: 'crypto',
          crypto: { transaction_hash: MOCK_RELAY_HASH },
        },
      });

      await expect(
        module.ConfirmPayment(SLUG, { transaction_hash: MOCK_RELAY_HASH })
      ).resolves.toMatchObject({ status: 'complete' });

      expect(memory.All<Charge>('Charges')).toHaveLength(1);
      expect(Intent()).toMatchObject({
        status: 'succeeded',
        latest_charge: 'ch_z_crashed',
      });
      expect(events).not.toContain('charge.succeeded');
    });

    it('stops waiting for another claim once the session is no longer open', async () => {
      jest
        .spyOn(checkoutSessionModule, 'ClaimPaymentSettlement')
        .mockImplementationOnce(async () => {
          // The merchant expires the session while another process records.
          Seed({ status: 'expired' });
          return false;
        });

      await expect(
        module.ConfirmPayment(SLUG, { transaction_hash: MOCK_RELAY_HASH })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'This Checkout Session is no longer accepting payments',
      });
      expect(memory.All<Charge>('Charges')).toEqual([]);
    });

    it('answers payment_pending while another process holds the claim', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
      Seed({
        payment_details: {
          transaction_hash: MOCK_RELAY_HASH,
          payer_wallet: PAYER_WALLET,
          relayed: true,
          settling_since: GetFixedTimestamp(),
          settling_transaction: MOCK_RELAY_HASH,
        } as CheckoutSession['payment_details'],
      });

      const outcome = module
        .ConfirmPayment(SLUG, { transaction_hash: MOCK_RELAY_HASH })
        .catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(11_000);

      await expect(outcome).resolves.toMatchObject({
        statusCode: 409,
        type: 'payment_pending',
      });
      ExpectNothingCompleted();
    });
  });

  it('prepare never replaces a relay recorded after it read the session', async () => {
    const build = settlement.BuildCheckoutPaymentAuthorization;
    const original = build.getMockImplementation();
    build.mockImplementationOnce(async (...args) => {
      // A confirm records its relay while this prepare is building.
      Seed({
        payment_details: {
          transaction_hash: MOCK_RELAY_HASH,
          payer_wallet: PAYER_WALLET,
          relayed: true,
        },
      });
      if (!original) throw new Error('No mock implementation');
      return original(...args);
    });

    await expect(
      module.PreparePayment(SLUG, MERCHANT_WALLET, {
        email: 'buyer@example.com',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      type: 'payment_pending',
      details: { transaction_hash: MOCK_RELAY_HASH },
    });
    expect(Session().payment_details).toMatchObject({
      transaction_hash: MOCK_RELAY_HASH,
      payer_wallet: PAYER_WALLET,
    });
    expect(Intent().status).toBe('requires_confirmation');
  });

  it('answers payment_pending when another process claimed the relay first', async () => {
    settlement.RelayCheckoutAuthorization.mockImplementation(
      async (_authorization, _signature, options) => {
        // Another API instance recorded its relay after this one read the session.
        Seed({
          payment_details: {
            transaction_hash: OTHER_HASH,
            payer_wallet: PAYER_WALLET,
            relayed: true,
          },
        });
        await options.onSigned(MOCK_RELAY_HASH);
        return MOCK_RELAY_HASH;
      }
    );

    await expect(
      module.ConfirmPayment(SLUG, { signature: SIGNATURE })
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { transaction_hash: OTHER_HASH },
    });
    expect(Session().payment_details?.transaction_hash).toBe(OTHER_HASH);
    expect(settlement.VerifyCheckoutPayment).not.toHaveBeenCalled();
  });

  describe('PreparePayment while a relay confirms', () => {
    beforeEach(() => {
      Seed({
        payment_details: {
          transaction_hash: MOCK_RELAY_HASH,
          payer_wallet: PAYER_WALLET,
          relayed: true,
        },
      });
      memory.Seed('PaymentIntents', { ...Intent(), status: 'processing' });
    });

    it('returns the same authorization to sign again and leaves the PaymentIntent processing', async () => {
      const prepared = await module.PreparePayment(SLUG, PAYER_WALLET, {
        email: 'buyer@example.com',
      });

      expect(prepared.authorization).toEqual(
        BuildTransferAuthorization({
          payer: PAYER_WALLET,
          merchant: MERCHANT_WALLET,
          amountCents: 1000,
          sessionId: 'cs_z_pay',
          expiresAt: session.expires_at,
        })
      );
      expect(Intent().status).toBe('processing');
      expect(Session().payment_details?.transaction_hash).toBe(MOCK_RELAY_HASH);
    });

    it('refuses another wallet', async () => {
      await expect(
        module.PreparePayment(SLUG, MERCHANT_WALLET, {
          email: 'buyer@example.com',
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        type: 'payment_pending',
        details: { transaction_hash: MOCK_RELAY_HASH },
      });
      expect(Session().payment_details?.payer_wallet).toBe(PAYER_WALLET);
    });
  });

  describe('on the simulated rail', () => {
    beforeEach(() => {
      module = Module(new SimulatedSettlement());
      Seed({ payment_details: null });
    });

    it.each(['transaction_hash', 'signature'] as const)(
      'prepares nothing to sign and completes with a sim_sig %s',
      async (field) => {
        const prepared = await module.PreparePayment(SLUG, PAYER_WALLET, {
          email: 'buyer@example.com',
        });
        expect(prepared).toMatchObject({
          method: 'simulated',
          typed_data: null,
          authorization: null,
          relayed: false,
          fee_currency: 'none',
        });

        const reference = SimulatedSignature('cs_z_pay', PAYER_WALLET);
        const result = await module.ConfirmPayment(SLUG, {
          [field]: reference,
        });

        expect(result).toMatchObject({
          status: 'complete',
          payment_details: {
            transaction_hash: reference,
            payer_wallet: PAYER_WALLET,
            relayed: false,
          },
        });
      }
    );
  });

  describe('subscription mode', () => {
    beforeEach(() => {
      Seed({
        mode: 'subscription',
        payment_intent: null,
        line_items: {
          object: 'list',
          data: [BuildLineItem({ price: RecurringPrice() })],
          has_more: false,
          url: '/v1/checkout/sessions/cs_z_pay/line_items',
        },
      });
    });

    const PERMIT_SIGNATURE = `0x${'7e'.repeat(64)}1c`;
    const SUBSCRIBE_SIGNATURE = `0x${'5d'.repeat(64)}1b`;
    const DEADLINE = 1_700_001_800;
    const SIGNED = {
      permit_signature: PERMIT_SIGNATURE,
      subscribe_signature: SUBSCRIBE_SIGNATURE,
      deadline: DEADLINE,
    };
    let customers: jest.Mocked<Pick<CustomerModule, 'CreateCustomer'>>;
    let subscriptions: jest.Mocked<
      Pick<
        SubscriptionModule,
        'CreateSubscription' | 'SetSubscriptionOnchainId'
      >
    >;

    beforeEach(() => {
      customers = {
        CreateCustomer: jest.fn().mockResolvedValue({ id: 'cus_z_1' }),
      } as unknown as typeof customers;
      subscriptions = {
        CreateSubscription: jest.fn().mockResolvedValue({ id: 'sub_z_1' }),
        SetSubscriptionOnchainId: jest.fn().mockResolvedValue({}),
      } as unknown as typeof subscriptions;
      module = Module(settlement, {
        customerModule: customers as unknown as CustomerModule,
        subscriptionModule: subscriptions as unknown as SubscriptionModule,
      });
    });

    function SubscribePending(
      transactionHash: string | null
    ): CheckoutSubscribeVerification {
      return {
        status: 'pending',
        transaction_hash: transactionHash,
        subscriber_address: null,
        subscription_onchain_id: null,
      };
    }

    function ExpectNoSubscription(): void {
      expect(Session()).toMatchObject({
        status: 'open',
        payment_status: 'unpaid',
      });
      expect(subscriptions.CreateSubscription).not.toHaveBeenCalled();
    }

    it('relays both signatures, recording the hash before sending, then verifies, collects and completes', async () => {
      const seen: Record<string, unknown> = {};
      settlement.RelaySubscribe.mockImplementation(async (_relay, options) => {
        await options.onSigned(MOCK_SUBSCRIBE_HASH);
        seen.atSend = Session().payment_details?.transaction_hash;
        return MOCK_SUBSCRIBE_HASH;
      });

      const result = await module.ConfirmPayment(SLUG, SIGNED);

      expect(settlement.RelaySubscribe).toHaveBeenCalledWith(
        {
          planKey: MOCK_PLAN_KEY,
          subscriber: PAYER_WALLET,
          permitSignature: PERMIT_SIGNATURE,
          subscribeSignature: SUBSCRIBE_SIGNATURE,
          deadline: DEADLINE,
        },
        expect.objectContaining({ pendingHash: null })
      );
      expect(seen.atSend).toBe(MOCK_SUBSCRIBE_HASH);
      expect(settlement.VerifySubscribeTransaction).toHaveBeenCalledWith(
        MOCK_SUBSCRIBE_HASH,
        { planKey: MOCK_PLAN_KEY, subscriberWallet: PAYER_WALLET },
        { timeoutMs: 90_000 }
      );
      expect(settlement.CollectSubscriptionPayment).toHaveBeenCalledWith({
        subscriptionOnchainId: MOCK_SUBSCRIPTION_ID,
        planKey: MOCK_PLAN_KEY,
        subscriberWallet: PAYER_WALLET,
        amountCents: 1000,
      });
      expect(subscriptions.CreateSubscription).toHaveBeenCalledWith(
        'acct_z_platform',
        expect.objectContaining({ default_payment_method: PAYER_WALLET }),
        { settlementTransactionHash: MOCK_CHARGE_HASH }
      );
      expect(subscriptions.SetSubscriptionOnchainId).toHaveBeenCalledWith(
        'sub_z_1',
        MOCK_SUBSCRIPTION_ID
      );
      expect(result).toMatchObject({
        status: 'complete',
        subscription: 'sub_z_1',
        payment_details: {
          transaction_hash: MOCK_SUBSCRIBE_HASH,
          payer_wallet: PAYER_WALLET,
        },
      });
    });

    it('relays without a permit when none was signed', async () => {
      await module.ConfirmPayment(SLUG, {
        subscribe_signature: SUBSCRIBE_SIGNATURE,
        deadline: DEADLINE,
      });

      expect(settlement.RelaySubscribe).toHaveBeenCalledWith(
        expect.objectContaining({ permitSignature: null }),
        expect.anything()
      );
    });

    it('answers payment_pending with the relayed hash while the subscribe confirms, keeping it', async () => {
      settlement.VerifySubscribeTransaction.mockResolvedValue(
        SubscribePending(MOCK_SUBSCRIBE_HASH)
      );

      await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toMatchObject({
        statusCode: 409,
        type: 'payment_pending',
        details: {
          code: 'payment_pending',
          transaction_hash: MOCK_SUBSCRIBE_HASH,
        },
      });

      expect(Session().payment_details?.transaction_hash).toBe(
        MOCK_SUBSCRIBE_HASH
      );
      expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
      ExpectNoSubscription();
    });

    it('completes a retry with transaction_hash without relaying again', async () => {
      settlement.VerifySubscribeTransaction.mockResolvedValueOnce(
        SubscribePending(MOCK_SUBSCRIBE_HASH)
      );
      await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toMatchObject({
        type: 'payment_pending',
      });

      const result = await module.ConfirmPayment(SLUG, {
        transaction_hash: MOCK_SUBSCRIBE_HASH,
      });

      expect(settlement.RelaySubscribe).toHaveBeenCalledTimes(1);
      expect(settlement.CollectSubscriptionPayment).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        status: 'complete',
        payment_details: { transaction_hash: MOCK_SUBSCRIBE_HASH },
      });
    });

    it('hands the recorded relay to the rail when the signatures are sent again', async () => {
      Seed({
        payment_details: {
          transaction_hash: MOCK_SUBSCRIBE_HASH,
          payer_wallet: PAYER_WALLET,
          relayed: true,
        },
      });

      await module.ConfirmPayment(SLUG, SIGNED);

      expect(settlement.RelaySubscribe).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ pendingHash: MOCK_SUBSCRIBE_HASH })
      );
    });

    it('refuses a transaction_hash other than the relayed one', async () => {
      Seed({
        payment_details: {
          transaction_hash: MOCK_SUBSCRIBE_HASH,
          payer_wallet: PAYER_WALLET,
          relayed: true,
        },
      });

      await expect(
        module.ConfirmPayment(SLUG, { transaction_hash: OTHER_HASH })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(settlement.VerifySubscribeTransaction).not.toHaveBeenCalled();
    });

    it('passes a stale-signature 409 through and records nothing', async () => {
      const stale = new AppError(
        'The subscription signature can no longer be used. Prepare the subscription again and sign the new request.',
        409,
        'subscription_authorization_stale',
        { code: 'subscription_authorization_stale' }
      );
      settlement.RelaySubscribe.mockRejectedValue(stale);

      await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toBe(stale);
      expect(Session().payment_details?.transaction_hash).toBeNull();
      ExpectNoSubscription();
    });

    it('clears the recorded relay when the network refuses it, so the subscriber can retry', async () => {
      settlement.RelaySubscribe.mockImplementation(async (_relay, options) => {
        await options.onSigned(MOCK_SUBSCRIBE_HASH);
        throw new AppError(
          'The network did not accept the subscription',
          400,
          'blockchain_error'
        );
      });

      await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toMatchObject({
        statusCode: 400,
        type: 'blockchain_error',
      });
      expect(Session().payment_details?.transaction_hash).toBeNull();
      ExpectNoSubscription();
    });

    it('fails and clears the relay when the subscribe did not subscribe', async () => {
      settlement.VerifySubscribeTransaction.mockResolvedValue({
        status: 'failed',
        transaction_hash: MOCK_SUBSCRIBE_HASH,
        subscriber_address: null,
        subscription_onchain_id: null,
        failure_reason:
          'The subscribe transaction did not create the subscription',
      });

      await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toMatchObject({
        statusCode: 400,
        message: 'The subscribe transaction did not create the subscription',
      });
      expect(Session().payment_details?.transaction_hash).toBeNull();
      ExpectNoSubscription();
    });

    it('completes with the on-chain subscription when another transaction created it', async () => {
      settlement.RelaySubscribe.mockResolvedValue(null);
      settlement.VerifySubscribeTransaction.mockResolvedValue({
        status: 'verified',
        transaction_hash: null,
        subscriber_address: PAYER_WALLET,
        subscription_onchain_id: MOCK_SUBSCRIPTION_ID,
      });

      const result = await module.ConfirmPayment(SLUG, SIGNED);

      expect(settlement.VerifySubscribeTransaction).toHaveBeenCalledWith(
        null,
        expect.anything(),
        expect.anything()
      );
      expect(result).toMatchObject({
        status: 'complete',
        payment_details: {
          transaction_hash: `onchain:${MOCK_SUBSCRIPTION_ID}`,
        },
      });
    });

    it('needs signatures or a transaction_hash', async () => {
      await expect(module.ConfirmPayment(SLUG, {})).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('keeps provider text out of a failed first-period collect and releases the claim', async () => {
      settlement.CollectSubscriptionPayment.mockRejectedValue(
        new Error('upstream said: project-key-SECRET-1234')
      );

      const failure = await module
        .ConfirmPayment(SLUG, SIGNED)
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(AppError);
      expect(failure).toMatchObject({
        statusCode: 400,
        message:
          'Subscription authorized on-chain, but the first payment could not be collected. Confirm again to retry.',
      });
      expect(JSON.stringify(failure)).not.toContain('SECRET');
      expect(
        (Session().payment_details as Record<string, unknown>)?.[
          'settling_since'
        ]
      ).toBeNull();
      ExpectNoSubscription();
    });

    it('lets a typed first-period collect error propagate unwrapped', async () => {
      const notSupported = NotSupported('CollectSubscriptionPayment');
      settlement.CollectSubscriptionPayment.mockRejectedValue(notSupported);

      await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toBe(
        notSupported
      );
      expect(Session().status).toBe('open');
    });

    it('records the first period as paid when an earlier attempt already collected it', async () => {
      settlement.CollectSubscriptionPayment.mockResolvedValue({
        transaction_hash: null,
        alreadyCollected: true,
      });

      const result = await module.ConfirmPayment(SLUG, SIGNED);

      expect(subscriptions.CreateSubscription).toHaveBeenCalledWith(
        'acct_z_platform',
        expect.anything(),
        { settlementTransactionHash: MOCK_SUBSCRIBE_HASH }
      );
      expect(result.status).toBe('complete');
    });

    it('refuses an on-chain subscription that another subscription already bills', async () => {
      memory.Seed('Subscriptions', {
        id: 'sub_z_other',
        status: 'active',
        subscription_onchain_id: MOCK_SUBSCRIPTION_ID,
      });

      await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
      ExpectNoSubscription();
    });

    it('completes a simulated subscription by its sim_sig reference, without the one-subscription limit', async () => {
      const simulatedId = `sim_sub_${MOCK_PLAN_KEY}_${PAYER_WALLET}`;
      module = Module(new SimulatedSettlement(), {
        customerModule: customers as unknown as CustomerModule,
        subscriptionModule: subscriptions as unknown as SubscriptionModule,
      });
      Seed({ payment_details: null });
      // Every simulated checkout uses the same test wallet.
      memory.Seed('Subscriptions', {
        id: 'sub_z_earlier',
        status: 'active',
        subscription_onchain_id: simulatedId,
      });

      const prepared = await module.PreparePayment(SLUG, PAYER_WALLET, {
        email: 'buyer@example.com',
      });
      expect(prepared).toMatchObject({
        relayed: false,
        fee_currency: 'none',
        subscription: {
          needs_permit: false,
          permit_typed_data: null,
          subscribe_typed_data: null,
        },
      });

      const reference = SimulatedSignature('cs_z_pay', PAYER_WALLET);
      const result = await module.ConfirmPayment(SLUG, {
        transaction_hash: reference,
      });

      expect(result).toMatchObject({
        status: 'complete',
        payment_details: { transaction_hash: reference },
      });
      expect(subscriptions.SetSubscriptionOnchainId).toHaveBeenCalledWith(
        'sub_z_1',
        simulatedId
      );
    });

    describe('with already_subscribed', () => {
      it('completes from the wallet’s own on-chain subscription', async () => {
        settlement.FindExistingSubscription.mockResolvedValue(
          MOCK_SUBSCRIPTION_ID
        );

        const result = await module.ConfirmPayment(SLUG, {
          already_subscribed: true,
          subscription_onchain_id: MOCK_SUBSCRIPTION_ID,
        });

        expect(settlement.FindExistingSubscription).toHaveBeenCalledWith(
          MOCK_PLAN_KEY,
          PAYER_WALLET
        );
        expect(subscriptions.SetSubscriptionOnchainId).toHaveBeenCalledWith(
          'sub_z_1',
          MOCK_SUBSCRIPTION_ID
        );
        expect(result.status).toBe('complete');
      });

      it('refuses a subscription id that is not the wallet’s', async () => {
        settlement.FindExistingSubscription.mockResolvedValue(
          MOCK_SUBSCRIPTION_ID
        );

        await expect(
          module.ConfirmPayment(SLUG, {
            already_subscribed: true,
            subscription_onchain_id: `0x${'99'.repeat(32)}`,
          })
        ).rejects.toMatchObject({ statusCode: 400 });
        ExpectNoSubscription();
      });
    });
  });
});
