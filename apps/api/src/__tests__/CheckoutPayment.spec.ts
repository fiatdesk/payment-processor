import { CheckoutPaymentModule } from '../modules/CheckoutPayment';
import { CheckoutSessionModule } from '../modules/CheckoutSession';
import { ChargeModule } from '../modules/Charge';
import { Database } from '../modules/Database';
import { EventService } from '../modules/EventService';
import { ExternalWalletModule } from '../modules/ExternalWallet';
import { PaymentIntentModule } from '../modules/PaymentIntent';
import { ProductModule } from '../modules/Product';
import type { Settlement } from '../modules/chains/Settlement';
import type { UnsignedTransaction } from '../modules/chains/types';
import {
  CheckoutSession,
  CheckoutSessionLineItem,
  ExternalWallet,
  Price,
} from '@zoneless/shared-types';
import {
  CreateMockDatabase,
  DeterministicId,
  DeterministicUrlSlug,
  GetFixedTimestamp,
  ResetIdCounter,
} from './Setup';
import {
  CreateMockSettlement,
  MOCK_PAYER,
  MOCK_USDC,
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
  IsCheckoutRelayed: jest.fn(() => false),
}));
// Charges read the network from the module-level rail.
jest.mock('../modules/chains/Settlement', () => ({
  ...jest.requireActual('../modules/chains/Settlement'),
  GetSettlement: jest.fn(() =>
    jest.requireActual('./mocks/Settlement').CreateMockSettlement()
  ),
}));

const PAYER_WALLET = MOCK_PAYER;
const MERCHANT_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

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

function UnsignedTx(unsignedTransaction: string): UnsignedTransaction {
  return {
    unsigned_transaction: unsignedTransaction,
    estimated_fee: '5000',
    fee_currency: 'eth',
    chain_id: 11155111,
    nonce: null,
    to: null,
  };
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
    mockSettlement.BuildCheckoutPaymentTransaction.mockResolvedValue(
      UnsignedTx('unsigned_tx_base64')
    );
    mockSettlement.BuildSubscribeTransaction.mockResolvedValue(
      UnsignedTx('unsigned_subscribe_base64')
    );
    mockSettlement.ValidateAndBroadcastCheckoutTransaction.mockResolvedValue({
      transaction_hash: 'relay_sig',
    });

    mockExternalWalletModule = {
      GetDefaultWallet: jest.fn().mockResolvedValue(merchantWallet),
    };

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
    it('should build an unsigned tx and mark the PaymentIntent requires_confirmation', async () => {
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
        mockSettlement.BuildCheckoutPaymentTransaction
      ).toHaveBeenCalledWith(PAYER_WALLET, MERCHANT_WALLET, 1000, session.id, {
        relayed: false,
      });
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
      expect(result).toEqual(
        expect.objectContaining({
          object: 'checkout.payment_transaction',
          checkout_session: session.id,
          amount_total: 1000,
          unsigned_transaction: 'unsigned_tx_base64',
          estimated_fee: '5000',
          fee_currency: 'eth',
          chain_id: 11155111,
          nonce: null,
          to: null,
          relayed: false,
        })
      );
      expect(result).not.toHaveProperty('fee_sponsored');
      expect(mockDb.Update).toHaveBeenCalledWith(
        'CheckoutSessions',
        session.id,
        {
          payment_details: {
            transaction_hash: null,
            payer_wallet: PAYER_WALLET,
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
        mockSettlement.BuildCheckoutPaymentTransaction
      ).toHaveBeenCalledWith(PAYER_WALLET, MERCHANT_WALLET, 1000, session.id, {
        relayed: false,
      });
      expect(mockDb.Update).toHaveBeenCalledWith(
        'CheckoutSessions',
        session.id,
        {
          payment_details: {
            transaction_hash: null,
            payer_wallet: PAYER_WALLET,
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
        mockSettlement.BuildCheckoutPaymentTransaction
      ).not.toHaveBeenCalled();
    });

    it('should build a subscribe transaction for subscription mode', async () => {
      const recurringPrice = BuildPrice({
        type: 'recurring',
        recurring: {
          interval: 'month',
          interval_count: 1,
          meter: null,
          trial_period_days: null,
          usage_type: 'licensed',
        },
        subscription_plan_id: 'PlanId111',
      });
      const session = BuildOpenSession({
        mode: 'subscription',
        payment_intent: null,
        line_items: {
          object: 'list',
          data: [BuildLineItem({ price: recurringPrice })],
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

      const result = await module.PreparePayment(
        session.url_slug,
        PAYER_WALLET,
        { email: 'buyer@example.com' }
      );

      expect(mockSettlement.BuildSubscribeTransaction).toHaveBeenCalledWith(
        PAYER_WALLET,
        recurringPrice.id,
        'PlanId111',
        { relayed: false }
      );
      expect(
        mockSettlement.BuildCheckoutPaymentTransaction
      ).not.toHaveBeenCalled();
      expect(result.unsigned_transaction).toBe('unsigned_subscribe_base64');
      expect(result).not.toHaveProperty('subscription_step');
    });

    it('should return the existing subscription_onchain_id when the wallet is already subscribed', async () => {
      const recurringPrice = BuildPrice({
        type: 'recurring',
        recurring: {
          interval: 'month',
          interval_count: 1,
          meter: null,
          trial_period_days: null,
          usage_type: 'licensed',
        },
        subscription_plan_id: 'PlanId111',
      });
      const session = BuildOpenSession({
        mode: 'subscription',
        payment_intent: null,
        line_items: {
          object: 'list',
          data: [BuildLineItem({ price: recurringPrice })],
          has_more: false,
          url: '/v1/checkout/sessions/cs_z_1/line_items',
        },
      });

      mockSettlement.FindExistingSubscription.mockResolvedValue(
        'SubOnchain111'
      );

      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSessionByUrlSlug')
        .mockResolvedValue(session);
      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSession')
        .mockResolvedValue(session);
      mockDb.Update = jest.fn().mockResolvedValue(undefined);

      const result = await module.PreparePayment(
        session.url_slug,
        PAYER_WALLET,
        { email: 'buyer@example.com' }
      );

      expect(mockSettlement.FindExistingSubscription).toHaveBeenCalledWith(
        'PlanId111',
        PAYER_WALLET
      );
      expect(mockSettlement.BuildSubscribeTransaction).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        unsigned_transaction: '',
        estimated_fee: '0',
        already_subscribed: true,
        subscription_onchain_id: 'SubOnchain111',
      });
    });
  });

  describe('ConfirmPayment', () => {
    it('should relay signed transactions before completing the session', async () => {
      const session = BuildOpenSession();
      const requiresConfirmation = BuildPaymentIntent('requires_confirmation');
      const processing = {
        ...requiresConfirmation,
        status: 'processing' as const,
        next_action: null,
      };
      const succeeded = {
        ...processing,
        status: 'succeeded' as const,
        amount_received: 1000,
        latest_charge: 'ch_z_test001',
      };
      const completedSession = {
        ...session,
        status: 'complete' as const,
        payment_status: 'paid' as const,
        url: null,
        payment_details: {
          transaction_hash: 'sig_abc',
          payer_wallet: PAYER_WALLET,
        },
      };

      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSessionByUrlSlug')
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(completedSession);
      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSessionByTransactionHash')
        .mockResolvedValue(null);
      jest
        .spyOn(checkoutSessionModule, 'CompleteCheckoutSession')
        .mockResolvedValue(completedSession);

      mockDb.Get = jest
        .fn()
        // MarkProcessing: idempotency check + ApplyStatusTransition x2
        .mockResolvedValueOnce(requiresConfirmation)
        .mockResolvedValueOnce(requiresConfirmation)
        .mockResolvedValueOnce(processing)
        // CreateCheckoutCharge → GetPaymentIntent
        .mockResolvedValueOnce(processing)
        // MarkSucceeded: idempotency check + ApplyStatusTransition x2
        .mockResolvedValueOnce(processing)
        .mockResolvedValueOnce(processing)
        .mockResolvedValueOnce(succeeded)
        // AttachBalanceTransaction → RequireCharge
        .mockResolvedValueOnce({
          id: 'ch_z_test001',
          object: 'charge',
          balance_transaction: 'txn_z_test002',
        });
      mockDb.Find2Custom = jest.fn().mockResolvedValue([
        {
          id: 'txn_existing',
          type: 'payment',
          source: session.id,
        },
      ]);

      mockSettlement.VerifyCheckoutPayment.mockResolvedValue({
        verified: true,
        payer_address: PAYER_WALLET,
        amount_cents: 1000,
      });
      mockSettlement.ValidateAndBroadcastCheckoutTransaction.mockResolvedValueOnce(
        { transaction_hash: 'sig_abc' }
      );

      const result = await module.ConfirmPayment(session.url_slug, undefined, {
        signed_transaction: 'signed_tx_base64',
      });

      expect(
        mockSettlement.ValidateAndBroadcastCheckoutTransaction
      ).toHaveBeenCalledWith('signed_tx_base64');
      expect(eventService.Emit.mock.calls.map((call) => call[0])).toEqual([
        'payment_intent.processing',
        'charge.succeeded',
        'payment_intent.succeeded',
      ]);
      expect(mockDb.Set).toHaveBeenCalledWith(
        'Charges',
        expect.stringMatching(/^ch_z_/),
        expect.objectContaining({
          object: 'charge',
          payment_intent: 'pi_z_1',
          status: 'succeeded',
          payment_method_details: expect.objectContaining({
            type: 'crypto',
            crypto: expect.objectContaining({
              buyer_address: PAYER_WALLET,
              transaction_hash: 'sig_abc',
              network: 'ethereum',
              token_currency: 'usdc',
            }),
          }),
        })
      );
      expect(mockDb.Update).toHaveBeenCalledWith(
        'PaymentIntents',
        'pi_z_1',
        expect.objectContaining({
          status: 'succeeded',
          latest_charge: expect.stringMatching(/^ch_z_/),
        })
      );
      expect(
        checkoutSessionModule.CompleteCheckoutSession
      ).toHaveBeenCalledWith(session.id, {
        transaction_hash: 'sig_abc',
        payer_wallet: PAYER_WALLET,
      });
      expect(result.status).toBe('complete');
    });

    it('should emit charge.failed then payment_failed when on-chain verification fails', async () => {
      const session = BuildOpenSession();
      const requiresConfirmation = BuildPaymentIntent('requires_confirmation');
      const processing = {
        ...requiresConfirmation,
        status: 'processing' as const,
        next_action: null,
      };
      const failed = {
        ...processing,
        status: 'requires_payment_method' as const,
        last_payment_error: {
          message: 'Amount mismatch',
          charge: 'ch_z_test001',
        },
      };

      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSessionByUrlSlug')
        .mockResolvedValue(session);
      jest
        .spyOn(checkoutSessionModule, 'GetCheckoutSessionByTransactionHash')
        .mockResolvedValue(null);

      mockDb.Get = jest
        .fn()
        // MarkProcessing
        .mockResolvedValueOnce(requiresConfirmation)
        .mockResolvedValueOnce(requiresConfirmation)
        .mockResolvedValueOnce(processing)
        // CreateCheckoutCharge → GetPaymentIntent
        .mockResolvedValueOnce(processing)
        // MarkPaymentFailed (ApplyStatusTransition)
        .mockResolvedValueOnce(processing)
        .mockResolvedValueOnce(failed);

      mockSettlement.VerifyCheckoutPayment.mockResolvedValue({
        verified: false,
        payer_address: null,
        amount_cents: 0,
        failure_reason: 'Amount mismatch',
      });

      await expect(
        module.ConfirmPayment(session.url_slug, 'sig_bad')
      ).rejects.toThrow('Amount mismatch');

      expect(eventService.Emit.mock.calls.map((call) => call[0])).toEqual([
        'payment_intent.processing',
        'charge.failed',
        'payment_intent.payment_failed',
      ]);
      expect(mockDb.Set).toHaveBeenCalledWith(
        'Charges',
        expect.stringMatching(/^ch_z_/),
        expect.objectContaining({
          status: 'failed',
          paid: false,
          payment_intent: 'pi_z_1',
        })
      );
      expect(mockDb.Update).toHaveBeenCalledWith(
        'PaymentIntents',
        'pi_z_1',
        expect.objectContaining({
          last_payment_error: expect.objectContaining({
            charge: expect.stringMatching(/^ch_z_/),
            message: 'Amount mismatch',
          }),
        })
      );
    });
  });
});
