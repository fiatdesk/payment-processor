// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { CheckoutPaymentModule } from '../modules/CheckoutPayment';
import { CheckoutSessionModule } from '../modules/CheckoutSession';
import { ChargeModule } from '../modules/Charge';
import { CustomerModule } from '../modules/Customer';
import { Database } from '../modules/Database';
import { EventService } from '../modules/EventService';
import { ExternalWalletModule } from '../modules/ExternalWallet';
import { PaymentIntentModule } from '../modules/PaymentIntent';
import { ProductModule } from '../modules/Product';
import { InvoiceModule } from '../modules/Invoice';
import { InvoiceItemModule } from '../modules/InvoiceItem';
import { PriceModule } from '../modules/Price';
import { SubscriptionModule } from '../modules/Subscription';
import { LIVE_SUBSCRIPTION_STATUSES } from '../modules/SubscriptionCycleClaims';
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
  Subscription,
} from '@fiatdesk/shared-types';
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
  MOCK_DESTINATION_HASH,
  MOCK_PAYER,
  MOCK_PLAN_KEY,
  MOCK_RELAY_HASH,
  MOCK_SUBSCRIBE_HASH,
  MOCK_SUBSCRIPTION_ID,
  MOCK_USDC,
  MockPreparedSubscribe,
} from './mocks/Settlement';

jest.mock('../modules/Database');
jest.mock('../utils/Logger', () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));
jest.mock('../utils/IdGenerator', () => ({
  ...jest.requireActual('../utils/IdGenerator'),
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
    id: 'price_fd_1',
    active: true,
    currency: 'usdc',
    metadata: {},
    nickname: null,
    product: 'prod_fd_1',
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
    platform_account: 'acct_fd_platform',
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
    id: 'li_fd_1',
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
  id: 'ew_fd_1',
  object: 'wallet' as const,
  account: 'acct_fd_platform',
  wallet_address: MERCHANT_WALLET,
  network: 'ethereum',
  currency: 'usdc',
  default_for_currency: true,
  status: 'verified' as const,
  created: 1700000000,
  metadata: {},
  platform_account: 'acct_fd_platform',
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
      .mockResolvedValue({ id: 'cs_fd_updated' });

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
        'acct_fd_platform',
        { mode: 'payment', success_url: 'https://example.com/success' },
        [BuildLineItem()]
      ),
      payment_intent: 'pi_fd_1',
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
      ...paymentIntentModule.PaymentIntentObject('acct_fd_platform', {
        amount: 1000,
        currency: 'usdc',
      }),
      id: 'pi_fd_1',
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
        'acct_fd_platform',
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
            url: '/v1/checkout/sessions/cs_fd_1/line_items',
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
          session.expires_at,
          { otherPlansAllowance: 0n, trialSeconds: 0 }
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
          first_charge_at: 0,
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
      GetExternalWalletsByAccount: jest.fn(async () => [merchantWallet]),
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
        'acct_fd_platform',
        { mode: 'payment', success_url: 'https://example.com/success' },
        [BuildLineItem()]
      ),
      id: 'cs_fd_pay',
      url_slug: SLUG,
      payment_intent: 'pi_fd_1',
      payment_details: {
        transaction_hash: null,
        payer_wallet: PAYER_WALLET,
        relayed: true,
      },
    };
    memory.Seed('CheckoutSessions', { ...session });
    memory.Seed('PaymentIntents', {
      ...paymentIntentModule.PaymentIntentObject('acct_fd_platform', {
        amount: 1000,
        currency: 'usdc',
      }),
      id: 'pi_fd_1',
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

  function Session(id = 'cs_fd_pay'): CheckoutSession {
    return memory.Doc<CheckoutSession>('CheckoutSessions', id);
  }

  function Intent(): PaymentIntent {
    return memory.Doc<PaymentIntent>('PaymentIntents', 'pi_fd_1');
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
        sessionId: 'cs_fd_pay',
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
        otherMerchantWalletAddresses: [],
        amountInCents: 1000,
        checkoutSessionId: 'cs_fd_pay',
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
        source: 'cs_fd_pay',
        metadata: expect.objectContaining({ blockchain_tx: MOCK_RELAY_HASH }),
      }),
    ]);
  });

  it('returns payment_pending with the relayed hash when confirmations time out, keeping the hash', async () => {
    settlement.VerifyCheckoutPayment.mockResolvedValue(
      Pending(MOCK_RELAY_HASH)
    );

    const error = await module
      .ConfirmPayment(SLUG, { signature: SIGNATURE })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({
      statusCode: 409,
      type: 'payment_pending',
      details: { code: 'payment_pending', transaction_hash: MOCK_RELAY_HASH },
    });
    // Only a confirm racing another one says so.
    expect((error as AppError).details).not.toHaveProperty('reason');
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
      expect.objectContaining({ checkoutSessionId: 'cs_fd_pay' }),
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
      id: 'cs_fd_other',
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
      id: 'cs_fd_other',
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

  describe('after the merchant changes its default wallet', () => {
    const NEW_DEFAULT = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

    function SwitchDefault(): void {
      jest
        .mocked(wallets.GetDefaultWallet)
        .mockResolvedValue({ ...merchantWallet, wallet_address: NEW_DEFAULT });
    }

    it('answers merchant_wallet_changed at confirm, sending and clearing nothing', async () => {
      Seed({ payment_details: null });
      await module.PreparePayment(SLUG, PAYER_WALLET, {
        email: 'buyer@example.com',
      });
      const prepared = Session();
      SwitchDefault();

      await expect(
        module.ConfirmPayment(SLUG, { signature: SIGNATURE })
      ).rejects.toMatchObject({
        statusCode: 409,
        type: 'merchant_wallet_changed',
        message:
          "The merchant's receiving wallet changed. Please approve the payment again.",
        details: { code: 'merchant_wallet_changed' },
      });
      expect(settlement.RelayCheckoutAuthorization).not.toHaveBeenCalled();
      expect(Session()).toEqual(prepared);
      expect(Intent().status).toBe('requires_confirmation');
    });

    it('pays the new default after the client prepares again', async () => {
      Seed({ payment_details: null });
      await module.PreparePayment(SLUG, PAYER_WALLET, {
        email: 'buyer@example.com',
      });
      SwitchDefault();
      await expect(
        module.ConfirmPayment(SLUG, { signature: SIGNATURE })
      ).rejects.toMatchObject({ type: 'merchant_wallet_changed' });

      const again = await module.PreparePayment(SLUG, PAYER_WALLET, {
        email: 'buyer@example.com',
      });
      const result = await module.ConfirmPayment(SLUG, {
        signature: SIGNATURE,
      });

      expect(again.merchant_wallet_address).toBe(NEW_DEFAULT);
      expect(settlement.RelayCheckoutAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({ to: NEW_DEFAULT }),
        SIGNATURE,
        expect.anything()
      );
      expect(result).toMatchObject({
        status: 'complete',
        payment_details: { merchant_wallet: NEW_DEFAULT },
      });
    });

    it('answers merchant_wallet_changed with the recorded hash at prepare reuse, so the client follows that payment', async () => {
      Seed({
        payment_details: {
          transaction_hash: MOCK_RELAY_HASH,
          payer_wallet: PAYER_WALLET,
          relayed: true,
          merchant_wallet: MERCHANT_WALLET,
        },
      });
      SwitchDefault();

      await expect(
        module.PreparePayment(SLUG, PAYER_WALLET, {
          email: 'buyer@example.com',
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        type: 'merchant_wallet_changed',
        details: {
          code: 'merchant_wallet_changed',
          transaction_hash: MOCK_RELAY_HASH,
        },
      });
      expect(Session().payment_details?.transaction_hash).toBe(MOCK_RELAY_HASH);
      expect(
        settlement.BuildCheckoutPaymentAuthorization
      ).not.toHaveBeenCalled();
    });

    it('still completes a relay to the old wallet recorded before the change', async () => {
      Seed({
        payment_details: {
          transaction_hash: MOCK_RELAY_HASH,
          payer_wallet: PAYER_WALLET,
          relayed: true,
          merchant_wallet: MERCHANT_WALLET,
        },
      });
      memory.Seed('PaymentIntents', { ...Intent(), status: 'processing' });
      SwitchDefault();

      const result = await module.ConfirmPayment(SLUG, {
        transaction_hash: MOCK_RELAY_HASH,
      });

      expect(settlement.VerifyCheckoutPayment).toHaveBeenCalledWith(
        MOCK_RELAY_HASH,
        expect.objectContaining({ merchantWalletAddress: MERCHANT_WALLET }),
        expect.anything()
      );
      expect(result).toMatchObject({
        status: 'complete',
        payment_details: {
          transaction_hash: MOCK_RELAY_HASH,
          merchant_wallet: MERCHANT_WALLET,
        },
      });
      expect(
        memory.All<BalanceTransaction>('BalanceTransactions')
      ).toHaveLength(1);
    });

    it('clears a relay to the old wallet that never reached the network, and asks for approval again', async () => {
      Seed({
        payment_details: {
          transaction_hash: MOCK_RELAY_HASH,
          payer_wallet: PAYER_WALLET,
          relayed: true,
          merchant_wallet: MERCHANT_WALLET,
        },
      });
      memory.Seed('PaymentIntents', { ...Intent(), status: 'processing' });
      SwitchDefault();
      settlement.VerifyCheckoutPayment.mockResolvedValue({
        ...Pending(MOCK_RELAY_HASH),
        status: 'not_found',
      });

      await expect(
        module.ConfirmPayment(SLUG, { transaction_hash: MOCK_RELAY_HASH })
      ).rejects.toMatchObject({
        statusCode: 409,
        type: 'merchant_wallet_changed',
        details: { code: 'merchant_wallet_changed' },
      });
      expect(Session().payment_details?.transaction_hash).toBeNull();
      ExpectNothingCompleted();
    });

    /** The platform still lists the old wallet, archived, next to the new one. */
    function ListBothWallets(): void {
      jest.mocked(wallets.GetExternalWalletsByAccount).mockResolvedValue([
        { ...merchantWallet, status: 'archived' },
        { ...merchantWallet, id: 'ew_fd_2', wallet_address: NEW_DEFAULT },
      ]);
    }

    /**
     * The session's authorization paid `address`. As on-chain, that pays the
     * session only when `address` is the expected merchant wallet or one of
     * the others the confirm allows.
     */
    function PaidTo(address: string, hash: string = OTHER_HASH): void {
      settlement.VerifyCheckoutPayment.mockImplementation(
        async (_hash, expected) =>
          [
            expected.merchantWalletAddress,
            ...(expected.otherMerchantWalletAddresses ?? []),
          ].some((wallet) => wallet.toLowerCase() === address.toLowerCase())
            ? Verified(hash, { merchant_address: address })
            : {
                status: 'failed',
                transaction_hash: hash,
                amount_cents: 0,
                payer_address: PAYER_WALLET,
                failure_reason:
                  'The authorized transfer does not pay the merchant wallet',
              }
      );
    }

    it("verifies a customer's transaction_hash before refusing it, and completes a payment to the wallet the session recorded", async () => {
      Seed({
        payment_details: {
          transaction_hash: null,
          payer_wallet: PAYER_WALLET,
          relayed: true,
          merchant_wallet: MERCHANT_WALLET,
        },
      });
      SwitchDefault();
      ListBothWallets();
      PaidTo(MERCHANT_WALLET);

      const result = await module.ConfirmPayment(SLUG, {
        transaction_hash: OTHER_HASH,
      });

      expect(settlement.VerifyCheckoutPayment).toHaveBeenCalledWith(
        OTHER_HASH,
        expect.objectContaining({
          merchantWalletAddress: MERCHANT_WALLET,
          otherMerchantWalletAddresses: [NEW_DEFAULT],
        }),
        expect.anything()
      );
      expect(result).toMatchObject({
        status: 'complete',
        payment_details: {
          transaction_hash: OTHER_HASH,
          merchant_wallet: MERCHANT_WALLET,
        },
      });
      expect(
        memory.All<BalanceTransaction>('BalanceTransactions')
      ).toHaveLength(1);
    });

    it('credits a used-nonce payment to the current default and records the wallet it paid', async () => {
      Seed({
        payment_details: {
          transaction_hash: MOCK_RELAY_HASH,
          payer_wallet: PAYER_WALLET,
          relayed: true,
          merchant_wallet: MERCHANT_WALLET,
        },
      });
      memory.Seed('PaymentIntents', { ...Intent(), status: 'processing' });
      SwitchDefault();
      ListBothWallets();
      PaidTo(NEW_DEFAULT);

      const result = await module.ConfirmPayment(SLUG, {
        transaction_hash: MOCK_RELAY_HASH,
      });

      expect(result).toMatchObject({
        status: 'complete',
        payment_details: {
          transaction_hash: OTHER_HASH,
          merchant_wallet: NEW_DEFAULT,
        },
      });
      expect(
        memory.All<BalanceTransaction>('BalanceTransactions')
      ).toHaveLength(1);
    });

    it("refuses a customer's transaction_hash that paid a retired wallet the session never recorded", async () => {
      // Prepared after the switch: the session only ever offered NEW_DEFAULT.
      Seed({
        payment_details: {
          transaction_hash: null,
          payer_wallet: PAYER_WALLET,
          relayed: true,
          merchant_wallet: NEW_DEFAULT,
        },
      });
      SwitchDefault();
      ListBothWallets();
      PaidTo(MERCHANT_WALLET);

      await expect(
        module.ConfirmPayment(SLUG, { transaction_hash: OTHER_HASH })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'The authorized transfer does not pay the merchant wallet',
      });

      expect(settlement.VerifyCheckoutPayment).toHaveBeenCalledWith(
        OTHER_HASH,
        expect.objectContaining({
          merchantWalletAddress: NEW_DEFAULT,
          otherMerchantWalletAddresses: [],
        }),
        expect.anything()
      );
      ExpectNothingCompleted();
      expect(Intent().status).toBe('requires_confirmation');
    });

    it('refuses a used-nonce payment to a retired wallet the session never recorded', async () => {
      Seed({ payment_details: null });
      SwitchDefault();
      ListBothWallets();
      await module.PreparePayment(SLUG, PAYER_WALLET, {
        email: 'buyer@example.com',
      });
      // The session's nonce is used, by a transfer to the retired wallet.
      settlement.RelayCheckoutAuthorization.mockResolvedValue(null);
      PaidTo(MERCHANT_WALLET);

      await expect(
        module.ConfirmPayment(SLUG, { signature: SIGNATURE })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'The authorized transfer does not pay the merchant wallet',
      });

      expect(settlement.VerifyCheckoutPayment).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          merchantWalletAddress: NEW_DEFAULT,
          otherMerchantWalletAddresses: [],
        }),
        expect.anything()
      );
      expect(Session()).toMatchObject({
        status: 'open',
        payment_status: 'unpaid',
      });
      expect(Intent().status).not.toBe('succeeded');
      expect(
        memory
          .All<Charge>('Charges')
          .filter((charge) => charge.status !== 'failed')
      ).toEqual([]);
      expect(memory.All<BalanceTransaction>('BalanceTransactions')).toEqual([]);
    });
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
        id: 'ch_fd_crashed',
        object: 'charge',
        status: 'succeeded',
        payment_intent: 'pi_fd_1',
        platform_account: 'acct_fd_platform',
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
        latest_charge: 'ch_fd_crashed',
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
        details: { reason: 'another_confirmation' },
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
      details: {
        transaction_hash: OTHER_HASH,
        reason: 'another_confirmation',
      },
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
          sessionId: 'cs_fd_pay',
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

        const reference = SimulatedSignature('cs_fd_pay', PAYER_WALLET);
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
          url: '/v1/checkout/sessions/cs_fd_pay/line_items',
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
    const NOW = GetFixedTimestamp();
    let customers: jest.Mocked<Pick<CustomerModule, 'CreateCustomer'>>;
    let subscriptions: jest.Mocked<
      Pick<SubscriptionModule, 'CreateSubscription'>
    >;

    beforeEach(() => {
      customers = {
        CreateCustomer: jest.fn().mockResolvedValue({ id: 'cus_fd_1' }),
      } as unknown as typeof customers;
      subscriptions = {
        CreateSubscription: jest.fn().mockResolvedValue({ id: 'sub_fd_1' }),
      } as unknown as typeof subscriptions;
      module = Module(settlement, {
        customerModule: customers as unknown as CustomerModule,
        subscriptionModule: subscriptions as unknown as SubscriptionModule,
      });
    });

    function Claims(): Array<Record<string, unknown>> {
      return memory.All('SubscriptionCycleClaims');
    }

    function SeedClaim(overrides: Record<string, unknown> = {}): void {
      memory.Seed('SubscriptionCycleClaims', {
        id: `${MOCK_SUBSCRIPTION_ID}:${NOW}`,
        object: 'subscription_cycle_claim',
        subscription_onchain_id: MOCK_SUBSCRIPTION_ID,
        due_at: NOW,
        owner: 'cs_fd_pay',
        charge_hash: MOCK_CHARGE_HASH,
        charge_sent_at: NOW - 30,
        created: NOW - 30,
        ...overrides,
      });
    }

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
          firstChargeAt: 0,
        },
        expect.objectContaining({ pendingHash: null })
      );
      expect(seen.atSend).toBe(MOCK_SUBSCRIBE_HASH);
      expect(settlement.VerifySubscribeTransaction).toHaveBeenCalledWith(
        MOCK_SUBSCRIBE_HASH,
        { planKey: MOCK_PLAN_KEY, subscriberWallet: PAYER_WALLET },
        { timeoutMs: 90_000 }
      );
      expect(settlement.CollectSubscriptionPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionOnchainId: MOCK_SUBSCRIPTION_ID,
          planKey: MOCK_PLAN_KEY,
          subscriberWallet: PAYER_WALLET,
          amountCents: 1000,
        })
      );
      // The cycle was claimed for this session and the charge recorded.
      expect(Claims()).toEqual([
        expect.objectContaining({
          owner: 'cs_fd_pay',
          due_at: NOW,
          charge_hash: MOCK_CHARGE_HASH,
        }),
      ]);
      expect(subscriptions.CreateSubscription).toHaveBeenCalledWith(
        'acct_fd_platform',
        expect.objectContaining({
          default_payment_method: PAYER_WALLET,
          items: [{ price: 'price_fd_1', quantity: 1 }],
        }),
        {
          settlementTransactionHash: MOCK_CHARGE_HASH,
          subscriptionOnchainId: MOCK_SUBSCRIPTION_ID,
          periodStart: NOW,
        }
      );
      expect(result).toMatchObject({
        status: 'complete',
        subscription: 'sub_fd_1',
        payment_details: {
          transaction_hash: MOCK_SUBSCRIBE_HASH,
          payer_wallet: PAYER_WALLET,
        },
      });
    });

    it('waits with payment_pending while the plan moves to a new default wallet, then collects', async () => {
      memory.Seed('Prices', {
        ...RecurringPrice(),
        id: 'price_fd_1',
        subscription_plan_destination: PAYER_WALLET,
        subscription_plan_destination_change: {
          destination: MERCHANT_WALLET,
          transaction_hash: MOCK_DESTINATION_HASH,
          status: 'pending',
          created: NOW,
          failure_message: null,
          sent_at: NOW,
        },
      });
      settlement.SetPlanDestination.mockResolvedValue({
        status: 'pending',
        transaction_hash: MOCK_DESTINATION_HASH,
      });

      await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toMatchObject({
        statusCode: 409,
        type: 'payment_pending',
      });
      expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
      ExpectNoSubscription();

      settlement.SetPlanDestination.mockResolvedValue({
        status: 'confirmed',
        transaction_hash: MOCK_DESTINATION_HASH,
      });
      const result = await module.ConfirmPayment(SLUG, SIGNED);

      expect(settlement.CollectSubscriptionPayment).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('complete');
      expect(
        memory.Doc<Price>('Prices', 'price_fd_1').subscription_plan_destination
      ).toBe(MERCHANT_WALLET);
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
      // No made-up reference: the first period's charge stands for it.
      expect(result).toMatchObject({
        status: 'complete',
        payment_details: { transaction_hash: MOCK_CHARGE_HASH },
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

    it('refuses a first period collected without this session’s charge: 409, nothing created', async () => {
      settlement.CollectSubscriptionPayment.mockResolvedValue({
        status: 'already_collected',
        transaction_hash: null,
      });

      await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toMatchObject({
        statusCode: 409,
        type: 'period_already_collected',
      });
      ExpectNoSubscription();
    });

    it('answers payment_pending for a first-period charge not confirmed yet, keeping its hash', async () => {
      settlement.CollectSubscriptionPayment.mockImplementation(
        async (params) => {
          await params.onSigned(MOCK_CHARGE_HASH, { nonce: 7 });
          return { status: 'pending', transaction_hash: MOCK_CHARGE_HASH };
        }
      );

      await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toMatchObject({
        statusCode: 409,
        type: 'payment_pending',
        details: { transaction_hash: MOCK_SUBSCRIBE_HASH },
      });
      expect(Claims()).toEqual([
        expect.objectContaining({ charge_hash: MOCK_CHARGE_HASH }),
      ]);
      expect(Session().payment_details).toMatchObject({
        pending_charge_hash: MOCK_CHARGE_HASH,
      });
      ExpectNoSubscription();
    });

    it('completes a retry by reconciling this session’s recorded charge, sending nothing new', async () => {
      SeedClaim();

      const result = await module.ConfirmPayment(SLUG, SIGNED);

      expect(settlement.ReconcileSubscriptionCharge).toHaveBeenCalledWith(
        [MOCK_CHARGE_HASH],
        expect.objectContaining({
          subscriptionOnchainId: MOCK_SUBSCRIPTION_ID,
          amountCents: 1000,
        })
      );
      expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
      expect(subscriptions.CreateSubscription).toHaveBeenCalledWith(
        'acct_fd_platform',
        expect.anything(),
        expect.objectContaining({ settlementTransactionHash: MOCK_CHARGE_HASH })
      );
      expect(result.status).toBe('complete');
    });

    it('refuses the cycle another session holds', async () => {
      SeedClaim({ owner: 'cs_fd_other', charge_hash: null });

      await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toMatchObject({
        statusCode: 409,
        type: 'period_already_collected',
      });
      expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
      ExpectNoSubscription();
    });

    it.each([
      ['another live subscription bills it', { status: 'active' }],
      [
        'its earlier subscription’s on-chain cancel is still pending',
        { status: 'canceled', cancel_pending_on_chain: true },
      ],
    ])(
      'refuses an on-chain subscription when %s',
      async (_label, overrides) => {
        memory.Seed('Subscriptions', {
          id: 'sub_fd_other',
          subscription_onchain_id: MOCK_SUBSCRIPTION_ID,
          ...overrides,
        });

        await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toMatchObject(
          { statusCode: 400 }
        );
        expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
        ExpectNoSubscription();
      }
    );

    it('asks for a permit covering the wallet’s other live on-chain plans too', async () => {
      Seed({ payment_details: null });
      memory.Seed('Subscriptions', {
        id: 'sub_fd_b',
        status: 'active',
        subscription_onchain_id: `0x${'bb'.repeat(32)}`,
        default_payment_method: PAYER_WALLET,
      });
      memory.Seed('SubscriptionItems', {
        id: 'si_fd_b',
        subscription: 'sub_fd_b',
        price: 'price_fd_b',
      });
      memory.Seed('Prices', {
        id: 'price_fd_b',
        subscription_plan_id: `0x${'b0'.repeat(32)}`,
        unit_amount: 2000,
        recurring: { interval: 'month', interval_count: 1 },
      });

      await module.PreparePayment(SLUG, PAYER_WALLET, {
        email: 'buyer@example.com',
      });

      // 20 USDC every 30 days: 13 periods.
      expect(settlement.BuildSubscribeAuthorization).toHaveBeenCalledWith(
        PAYER_WALLET,
        MOCK_PLAN_KEY,
        expect.any(Number),
        { otherPlansAllowance: 20_000_000n * 13n, trialSeconds: 0 }
      );
    });

    it('refuses a quantity above 1, which the plan cannot collect', async () => {
      Seed({
        payment_details: null,
        line_items: {
          object: 'list',
          data: [BuildLineItem({ price: RecurringPrice(), quantity: 2 })],
          has_more: false,
          url: '/v1/checkout/sessions/cs_fd_pay/line_items',
        },
      });

      await expect(
        module.PreparePayment(SLUG, PAYER_WALLET, {
          email: 'buyer@example.com',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        details: { code: 'onchain_plan_amount_exceeded' },
      });
    });

    it('refuses a client transaction_hash after the session expired when no relay was recorded', async () => {
      Seed({ expires_at: NOW - 1 });

      await expect(
        module.ConfirmPayment(SLUG, { transaction_hash: MOCK_SUBSCRIBE_HASH })
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'This Checkout Session has expired',
      });
      expect(settlement.VerifySubscribeTransaction).not.toHaveBeenCalled();
    });

    it('completes two simulated subscription checkouts to the same price against the real one-subscription index', async () => {
      memory.UniqueIndex('Subscriptions', ['subscription_onchain_id'], {
        subscription_onchain_id: { $type: 'string' },
        status: { $in: [...LIVE_SUBSCRIPTION_STATUSES] },
      });
      const db = memory.AsDatabase();
      const eventService = {
        Emit: jest.fn().mockResolvedValue(undefined),
      } as unknown as EventService;
      const simulated = new SimulatedSettlement();
      const customerModule = new CustomerModule(db, eventService);
      const priceModule = new PriceModule(db, eventService, productModule);
      const invoiceModule = new InvoiceModule(
        db,
        eventService,
        customerModule,
        new InvoiceItemModule(db, eventService, customerModule, priceModule),
        paymentIntentModule,
        chargeModule,
        priceModule,
        simulated
      );
      module = Module(simulated, {
        customerModule,
        subscriptionModule: new SubscriptionModule(
          db,
          eventService,
          customerModule,
          priceModule,
          invoiceModule,
          simulated
        ),
      });
      memory.Seed('Prices', { ...RecurringPrice() });
      Seed({ payment_details: null });
      memory.Seed('CheckoutSessions', {
        ...Session(),
        id: 'cs_fd_second',
        url_slug: 'slug_second',
      });

      // Every simulated checkout pays from the same test wallet.
      for (const [id, slug] of [
        ['cs_fd_pay', SLUG],
        ['cs_fd_second', 'slug_second'],
      ]) {
        await module.PreparePayment(slug, PAYER_WALLET, {
          email: 'buyer@example.com',
        });
        await expect(
          module.ConfirmPayment(slug, {
            transaction_hash: SimulatedSignature(id, PAYER_WALLET),
          })
        ).resolves.toMatchObject({ status: 'complete' });
      }

      const created = memory.All<Subscription>('Subscriptions');
      expect(created.map((s) => s.subscription_onchain_id).sort()).toEqual([
        `sim_sub_${MOCK_PLAN_KEY}_${PAYER_WALLET}_cs_fd_pay`,
        `sim_sub_${MOCK_PLAN_KEY}_${PAYER_WALLET}_cs_fd_second`,
      ]);
      expect(created.map((s) => s.status)).toEqual(['active', 'active']);
    });

    describe('with a trial (Q11a)', () => {
      const WEEK = 7 * 86_400;

      beforeEach(() => {
        const price = RecurringPrice();
        Seed({
          line_items: {
            object: 'list',
            data: [
              BuildLineItem({
                price: {
                  ...price,
                  recurring: {
                    ...(price.recurring as NonNullable<Price['recurring']>),
                    trial_period_days: 7,
                  },
                },
              }),
            ],
            has_more: false,
            url: '/v1/checkout/sessions/cs_fd_pay/line_items',
          },
        });
      });

      it('prepares a Subscribe that signs the first charge at the trial end, and keeps it for the relay', async () => {
        Seed({ payment_details: null });
        settlement.BuildSubscribeAuthorization.mockImplementationOnce(
          async (subscriber, planKey, expiresAt) =>
            MockPreparedSubscribe(
              subscriber,
              planKey,
              expiresAt,
              true,
              NOW + WEEK
            )
        );

        const prepared = await module.PreparePayment(SLUG, PAYER_WALLET, {
          email: 'buyer@example.com',
        });

        expect(settlement.BuildSubscribeAuthorization).toHaveBeenCalledWith(
          PAYER_WALLET,
          MOCK_PLAN_KEY,
          expect.any(Number),
          expect.objectContaining({ trialSeconds: WEEK })
        );
        expect(prepared.subscription?.first_charge_at).toBe(NOW + WEEK);
        expect(Session().payment_details?.first_charge_at).toBe(NOW + WEEK);

        await module.ConfirmPayment(SLUG, SIGNED);

        expect(settlement.RelaySubscribe).toHaveBeenCalledWith(
          expect.objectContaining({ firstChargeAt: NOW + WEEK }),
          expect.anything()
        );
      });

      it('collects nothing and ends the trial at the chain’s first charge time', async () => {
        settlement.GetSubscriptionState.mockResolvedValue({
          status: 'active',
          next_charge_at: NOW + WEEK - 30,
          period_seconds: 2_592_000,
          chain_time: NOW,
        });

        const result = await module.ConfirmPayment(SLUG, SIGNED);

        expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
        expect(subscriptions.CreateSubscription).toHaveBeenCalledWith(
          'acct_fd_platform',
          expect.objectContaining({ trial_end: NOW + WEEK - 30 }),
          {
            settlementTransactionHash: undefined,
            subscriptionOnchainId: MOCK_SUBSCRIPTION_ID,
            periodStart: NOW,
            periodEnd: NOW + WEEK - 30,
          }
        );
        expect(Claims()).toEqual([]);
        expect(result.status).toBe('complete');
      });

      it('refuses an on-chain first charge later than the trial allows', async () => {
        settlement.GetSubscriptionState.mockResolvedValue({
          status: 'active',
          next_charge_at: NOW + WEEK + 1,
          period_seconds: 2_592_000,
          chain_time: NOW,
        });

        await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toMatchObject(
          { statusCode: 400 }
        );
        ExpectNoSubscription();
      });
    });

    it('completes from its own landed charge when the recorded hashes read dropped, never a 409', async () => {
      SeedClaim();
      Seed({
        payment_details: {
          ...(Session().payment_details as NonNullable<
            CheckoutSession['payment_details']
          >),
          pending_charge_hash: MOCK_CHARGE_HASH,
        },
      });
      settlement.ReconcileSubscriptionCharge.mockResolvedValue({
        status: 'dropped',
      });
      // The charge landed, so the chain is due one period on.
      settlement.GetSubscriptionState.mockResolvedValue({
        status: 'active',
        next_charge_at: NOW + 2_592_000,
        period_seconds: 2_592_000,
        chain_time: NOW + 60,
      });
      settlement.FindSubscriptionCharge.mockImplementation(
        async (_subId, search) =>
          search.accept && !(await search.accept(MOCK_CHARGE_HASH))
            ? null
            : {
                transaction_hash: MOCK_CHARGE_HASH,
                next_charge_at: NOW + 2_592_000,
              }
      );

      const result = await module.ConfirmPayment(SLUG, SIGNED);

      expect(settlement.FindSubscriptionCharge).toHaveBeenCalledWith(
        MOCK_SUBSCRIPTION_ID,
        expect.objectContaining({ amountCents: 1000, since: NOW })
      );
      expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
      expect(subscriptions.CreateSubscription).toHaveBeenCalledWith(
        'acct_fd_platform',
        expect.anything(),
        expect.objectContaining({
          settlementTransactionHash: MOCK_CHARGE_HASH,
          periodStart: NOW,
          periodEnd: NOW + 2_592_000,
        })
      );
      expect(result.status).toBe('complete');
    });

    it('clears the session’s pending charge once the recorded one is dropped', async () => {
      SeedClaim();
      Seed({
        payment_details: {
          ...(Session().payment_details as NonNullable<
            CheckoutSession['payment_details']
          >),
          pending_charge_hash: MOCK_CHARGE_HASH,
        },
      });
      settlement.ReconcileSubscriptionCharge.mockResolvedValue({
        status: 'dropped',
      });
      settlement.CollectSubscriptionPayment.mockRejectedValue(
        new AppError('allowance', 402, 'collection_failed_allowance')
      );

      await expect(module.ConfirmPayment(SLUG, SIGNED)).rejects.toMatchObject({
        statusCode: 402,
      });
      expect(Session().payment_details?.pending_charge_hash).toBeNull();
    });

    it('gives the first-period charge only what is left of the confirm budget', async () => {
      await module.ConfirmPayment(SLUG, SIGNED);

      const [params] = settlement.CollectSubscriptionPayment.mock.calls[0];
      expect(params.timeoutMs).toBeGreaterThan(0);
      expect(params.timeoutMs).toBeLessThanOrEqual(90_000);
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
        expect(subscriptions.CreateSubscription).toHaveBeenCalledWith(
          'acct_fd_platform',
          expect.anything(),
          expect.objectContaining({
            subscriptionOnchainId: MOCK_SUBSCRIPTION_ID,
          })
        );
        expect(result.status).toBe('complete');
      });

      it('never reports the subscription id as transaction_hash while another confirm records it', async () => {
        jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
        settlement.FindExistingSubscription.mockResolvedValue(
          MOCK_SUBSCRIPTION_ID
        );
        jest
          .spyOn(checkoutSessionModule, 'ClaimPaymentSettlement')
          .mockResolvedValue(false);

        const outcome = module
          .ConfirmPayment(SLUG, {
            already_subscribed: true,
            subscription_onchain_id: MOCK_SUBSCRIPTION_ID,
          })
          .catch((error: unknown) => error);
        await jest.advanceTimersByTimeAsync(11_000);
        jest.useRealTimers();

        await expect(outcome).resolves.toMatchObject({
          statusCode: 409,
          type: 'payment_pending',
          details: { reason: 'another_confirmation', transaction_hash: null },
        });
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
