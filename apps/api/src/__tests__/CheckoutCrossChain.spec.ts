import { CheckoutPaymentModule } from '../modules/CheckoutPayment';
import { CheckoutSessionModule } from '../modules/CheckoutSession';
import { ChargeModule } from '../modules/Charge';
import { EventService } from '../modules/EventService';
import { ExternalWalletModule } from '../modules/ExternalWallet';
import { PaymentIntentModule } from '../modules/PaymentIntent';
import { ProductModule } from '../modules/Product';
import {
  IsNearIntentsSimulated,
  USDC_ETHEREUM_ASSET_ID,
  type NearIntentsClient,
  type NearIntentsQuote,
  type NearIntentsStatus,
} from '../modules/intents';
import { Logger } from '../utils/Logger';
import {
  BalanceTransaction,
  Charge,
  CheckoutCrossChainPayment,
  CheckoutSession,
  ExternalWallet,
  PaymentIntent,
} from '@fiatdesk/shared-types';
import { DeterministicId, GetFixedTimestamp, ResetIdCounter } from './Setup';
import { MemoryDatabase } from './mocks/MemoryDatabase';

const mockNearIntents: jest.Mocked<NearIntentsClient> = {
  GetTokens: jest.fn(),
  Quote: jest.fn(),
  GetStatus: jest.fn(),
  SubmitDeposit: jest.fn(),
};

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
jest.mock('../modules/chains/Settlement', () => ({
  ...jest.requireActual('../modules/chains/Settlement'),
  GetSettlement: jest.fn(() =>
    jest.requireActual('./mocks/Settlement').CreateMockSettlement()
  ),
}));
jest.mock('../modules/intents', () => ({
  ...jest.requireActual('../modules/intents'),
  GetNearIntents: jest.fn(() => mockNearIntents),
  IsNearIntentsSimulated: jest.fn(() => false),
}));

const SLUG = 'slug_cross';
const NOW = GetFixedTimestamp();
const MERCHANT_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const REFUND_ADDRESS = 'mara.near';
const DEPOSIT_ADDRESS =
  'a3f1c9e27b5d4086f2e1b7c94d0a6e3f5b8c2d71e4f9a06b3c5d8e1f2a7b4c9d';
const ORIGIN_HASH = '9Hk2mQpX4vRt7sLw3NcYb8eJu5ZfAd1oGiKnTqWyEx6';
const SETTLEMENT_HASH = `0x${'e7'.repeat(32)}`;
const START = {
  origin_asset: 'near',
  refund_address: REFUND_ADDRESS,
  email: 'mara@example.com',
};

const merchantWallet = {
  id: 'ew_fd_1',
  object: 'wallet',
  account: 'acct_fd_platform',
  wallet_address: MERCHANT_WALLET,
  network: 'ethereum',
  currency: 'usdc',
  default_for_currency: true,
  status: 'verified',
  created: 1700000000,
  metadata: {},
  platform_account: 'acct_fd_platform',
} as unknown as ExternalWallet;

/** A real (`dry: false`) quote: 1Click assigns a deposit address. */
function LiveQuote(
  overrides: Partial<NearIntentsQuote> = {}
): NearIntentsQuote {
  return {
    correlationId: 'corr_7f3a',
    depositAddress: DEPOSIT_ADDRESS,
    amountIn: '2950000000000000000000000',
    amountInFormatted: '2.95',
    amountOut: '10000000',
    minAmountIn: '2920500000000000000000000',
    deadline: new Date((NOW + 1800) * 1000).toISOString(),
    timeEstimate: 25,
    ...overrides,
  };
}

/** What the client returns for a dry quote: no deposit address. */
function DryQuote(): NearIntentsQuote {
  return LiveQuote({ depositAddress: null, minAmountIn: undefined });
}

function Status(
  status: NearIntentsStatus['status'],
  hashes: { origin?: string; settlement?: string } = {}
): NearIntentsStatus {
  return {
    status,
    originChainTxHashes: hashes.origin ? [{ hash: hashes.origin }] : [],
    destinationChainTxHashes: hashes.settlement
      ? [{ hash: hashes.settlement }]
      : [],
  };
}

describe('CheckoutPaymentModule cross-chain payments', () => {
  let memory: MemoryDatabase;
  let events: string[];
  let module: CheckoutPaymentModule;

  beforeEach(() => {
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
    const productModule = new ProductModule(db);
    const paymentIntentModule = new PaymentIntentModule(db, eventService);
    const checkoutSessionModule = new CheckoutSessionModule(
      db,
      eventService,
      undefined,
      productModule,
      undefined,
      paymentIntentModule
    );
    const wallets = {
      GetDefaultWallet: jest.fn(async () => merchantWallet),
    } as unknown as ExternalWalletModule;
    module = new CheckoutPaymentModule(
      db,
      checkoutSessionModule,
      wallets,
      productModule,
      paymentIntentModule,
      new ChargeModule(db, eventService),
      undefined,
      jest.requireActual('./mocks/Settlement').CreateMockSettlement()
    );

    memory.Seed('CheckoutSessions', {
      ...checkoutSessionModule.CheckoutSessionObject(
        'acct_fd_platform',
        { mode: 'payment', success_url: 'https://example.com/success' },
        []
      ),
      id: 'cs_fd_cross',
      url_slug: SLUG,
      amount_subtotal: 1000,
      amount_total: 1000,
      payment_intent: 'pi_fd_cross',
    });
    memory.Seed('PaymentIntents', {
      ...paymentIntentModule.PaymentIntentObject('acct_fd_platform', {
        amount: 1000,
        currency: 'usdc',
      }),
      id: 'pi_fd_cross',
    });
    mockNearIntents.Quote.mockResolvedValue(LiveQuote());
    mockNearIntents.GetStatus.mockResolvedValue(Status('PENDING_DEPOSIT'));
  });

  function Session(): CheckoutSession {
    return memory.Doc<CheckoutSession>('CheckoutSessions', 'cs_fd_cross');
  }

  function CrossChain(): CheckoutCrossChainPayment {
    return Session().payment_details?.cross_chain as CheckoutCrossChainPayment;
  }

  function SetCrossChain(overrides: Partial<CheckoutCrossChainPayment>): void {
    const session = Session();
    memory.Seed('CheckoutSessions', {
      ...session,
      payment_details: {
        ...session.payment_details,
        cross_chain: { ...CrossChain(), ...overrides },
      },
    });
  }

  function ExpectPayable(): void {
    expect(Session()).toMatchObject({
      status: 'open',
      payment_status: 'unpaid',
    });
    expect(memory.All<Charge>('Charges')).toEqual([]);
    expect(memory.All<BalanceTransaction>('BalanceTransactions')).toEqual([]);
    expect(events).not.toContain('checkout.session.completed');
  }

  describe('StartCrossChainPayment', () => {
    it('quotes the amount due to the merchant wallet and stores the quote', async () => {
      const result = await module.StartCrossChainPayment(SLUG, START);

      expect(mockNearIntents.Quote).toHaveBeenCalledWith({
        dry: false,
        swapType: 'EXACT_OUTPUT',
        slippageTolerance: 100,
        originAsset: 'nep141:wrap.near',
        depositType: 'ORIGIN_CHAIN',
        destinationAsset: USDC_ETHEREUM_ASSET_ID,
        amount: '10000000',
        refundTo: REFUND_ADDRESS,
        refundType: 'ORIGIN_CHAIN',
        recipient: MERCHANT_WALLET,
        recipientType: 'DESTINATION_CHAIN',
        deadline: new Date((NOW + 1800) * 1000).toISOString(),
      });
      const crossChain: CheckoutCrossChainPayment = {
        provider: 'near_intents',
        origin_asset: 'near',
        origin_network: 'near',
        deposit_address: DEPOSIT_ADDRESS,
        amount_in: '2950000000000000000000000',
        amount_in_formatted: '2.95',
        refund_address: REFUND_ADDRESS,
        quote_deadline: NOW + 1800,
        correlation_id: 'corr_7f3a',
        status: 'PENDING_DEPOSIT',
        origin_transaction_hash: null,
        settlement_transaction_hash: null,
        simulated: false,
      };
      expect(Session()).toMatchObject({
        status: 'open',
        payment_status: 'unpaid',
        customer_email: 'mara@example.com',
        payment_details: {
          transaction_hash: null,
          payer_wallet: null,
          merchant_wallet: MERCHANT_WALLET,
          cross_chain: crossChain,
        },
      });
      expect(result.payment_details?.cross_chain).toEqual(crossChain);
    });

    it('marks a quote from the simulated provider', async () => {
      jest.mocked(IsNearIntentsSimulated).mockReturnValueOnce(true);

      await module.StartCrossChainPayment(SLUG, START);

      expect(CrossChain().simulated).toBe(true);
    });

    it('reuses an open quote', async () => {
      await module.StartCrossChainPayment(SLUG, START);
      const result = await module.StartCrossChainPayment(SLUG, START);

      expect(mockNearIntents.Quote).toHaveBeenCalledTimes(1);
      expect(result.payment_details?.cross_chain?.deposit_address).toBe(
        DEPOSIT_ADDRESS
      );
    });

    it.each([
      ['the quote expired', { quote_deadline: NOW - 1 }],
      ['the refund address changed', { refund_address: 'old.near' }],
    ])('quotes again when %s', async (_label, stale) => {
      await module.StartCrossChainPayment(SLUG, START);
      SetCrossChain(stale);
      mockNearIntents.Quote.mockResolvedValueOnce(
        LiveQuote({ depositAddress: 'deposit_second', correlationId: 'c2' })
      );

      await module.StartCrossChainPayment(SLUG, START);

      expect(mockNearIntents.Quote).toHaveBeenCalledTimes(2);
      expect(CrossChain()).toMatchObject({
        deposit_address: 'deposit_second',
        correlation_id: 'c2',
        refund_address: REFUND_ADDRESS,
        quote_deadline: NOW + 1800,
      });
    });

    it('keeps an expired quote the customer has deposited to', async () => {
      await module.StartCrossChainPayment(SLUG, START);
      SetCrossChain({ status: 'PROCESSING', quote_deadline: NOW - 1 });

      await module.StartCrossChainPayment(SLUG, START);

      expect(mockNearIntents.Quote).toHaveBeenCalledTimes(1);
      expect(CrossChain().deposit_address).toBe(DEPOSIT_ADDRESS);
    });

    it('rejects a quote without a deposit address (the dry shape)', async () => {
      mockNearIntents.Quote.mockResolvedValueOnce(DryQuote());

      await expect(
        module.StartCrossChainPayment(SLUG, START)
      ).rejects.toMatchObject({ statusCode: 502 });
      expect(Session().payment_details?.cross_chain).toBeUndefined();
    });

    it('rejects an unknown origin asset without quoting', async () => {
      await expect(
        module.StartCrossChainPayment(SLUG, { ...START, origin_asset: 'doge' })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockNearIntents.Quote).not.toHaveBeenCalled();
    });
  });

  describe('PollCrossChainPayment', () => {
    beforeEach(async () => {
      await module.StartCrossChainPayment(SLUG, START);
      events.length = 0;
    });

    it('leaves a pending deposit as it is', async () => {
      const result = await module.PollCrossChainPayment(SLUG);

      expect(mockNearIntents.GetStatus).toHaveBeenCalledWith(DEPOSIT_ADDRESS);
      expect(result.payment_details?.cross_chain?.status).toBe(
        'PENDING_DEPOSIT'
      );
      ExpectPayable();
      expect(events).toEqual([]);
    });

    it('completes the session once on SUCCESS, like an on-chain payment', async () => {
      mockNearIntents.GetStatus.mockResolvedValue(
        Status('SUCCESS', { origin: ORIGIN_HASH, settlement: SETTLEMENT_HASH })
      );

      const result = await module.PollCrossChainPayment(SLUG);
      const again = await module.PollCrossChainPayment(SLUG);

      expect(result).toMatchObject({
        status: 'complete',
        payment_status: 'paid',
        payment_details: {
          transaction_hash: SETTLEMENT_HASH,
          payer_wallet: null,
          merchant_wallet: MERCHANT_WALLET,
          cross_chain: {
            status: 'SUCCESS',
            origin_transaction_hash: ORIGIN_HASH,
            settlement_transaction_hash: SETTLEMENT_HASH,
          },
        },
      });
      expect(again).toEqual(result);
      expect(mockNearIntents.GetStatus).toHaveBeenCalledTimes(1);
      expect(memory.All<Charge>('Charges')).toEqual([
        expect.objectContaining({
          status: 'succeeded',
          amount: 1000,
          payment_intent: 'pi_fd_cross',
          payment_method_details: {
            type: 'crypto',
            crypto: expect.objectContaining({
              buyer_address: null,
              network: 'ethereum',
              origin_network: 'near',
              origin_transaction_hash: ORIGIN_HASH,
              transaction_hash: SETTLEMENT_HASH,
            }),
          },
        }),
      ]);
      expect(memory.All<BalanceTransaction>('BalanceTransactions')).toEqual([
        expect.objectContaining({
          type: 'payment',
          amount: 1000,
          source: 'cs_fd_cross',
        }),
      ]);
      expect(
        memory.Doc<PaymentIntent>('PaymentIntents', 'pi_fd_cross')
      ).toMatchObject({ status: 'succeeded', amount_received: 1000 });
      expect(events).toEqual([
        'payment_intent.processing',
        'charge.succeeded',
        'payment_intent.succeeded',
        'checkout.session.completed',
      ]);
    });

    it('references the deposit when SUCCESS carries no settlement hash', async () => {
      mockNearIntents.GetStatus.mockResolvedValue(
        Status('SUCCESS', { origin: ORIGIN_HASH })
      );

      const result = await module.PollCrossChainPayment(SLUG);

      const reference = `near_intents:${DEPOSIT_ADDRESS}`;
      expect(result.payment_details?.transaction_hash).toBe(reference);
      expect(memory.All<Charge>('Charges')).toEqual([
        expect.objectContaining({
          payment_method_details: expect.objectContaining({
            crypto: expect.objectContaining({
              origin_network: 'near',
              transaction_hash: reference,
            }),
          }),
        }),
      ]);
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('without a settlement hash'),
        expect.objectContaining({ reference })
      );
    });

    it.each(['REFUNDED', 'FAILED'] as const)(
      'records %s and leaves the session payable',
      async (status) => {
        mockNearIntents.GetStatus.mockResolvedValue(
          Status(status, { origin: ORIGIN_HASH })
        );

        const result = await module.PollCrossChainPayment(SLUG);

        expect(result.payment_details?.cross_chain).toMatchObject({
          status,
          origin_transaction_hash: ORIGIN_HASH,
        });
        ExpectPayable();
        expect(events).toEqual([]);

        mockNearIntents.Quote.mockResolvedValueOnce(
          LiveQuote({ depositAddress: 'deposit_retry' })
        );
        await module.StartCrossChainPayment(SLUG, START);
        expect(CrossChain()).toMatchObject({
          deposit_address: 'deposit_retry',
          status: 'PENDING_DEPOSIT',
          origin_transaction_hash: null,
        });
      }
    );

    it('rejects a session without a cross-chain payment', async () => {
      const session = Session();
      memory.Seed('CheckoutSessions', { ...session, payment_details: null });

      await expect(module.PollCrossChainPayment(SLUG)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(mockNearIntents.GetStatus).not.toHaveBeenCalled();
    });
  });

  describe('SubmitCrossChainDeposit', () => {
    beforeEach(async () => {
      await module.StartCrossChainPayment(SLUG, START);
    });

    it('forwards the deposit transaction, then polls', async () => {
      mockNearIntents.GetStatus.mockResolvedValue(
        Status('KNOWN_DEPOSIT_TX', { origin: ORIGIN_HASH })
      );

      const result = await module.SubmitCrossChainDeposit(SLUG, {
        transaction_hash: ORIGIN_HASH,
      });

      expect(mockNearIntents.SubmitDeposit).toHaveBeenCalledWith(
        DEPOSIT_ADDRESS,
        ORIGIN_HASH
      );
      expect(result.payment_details?.cross_chain?.status).toBe(
        'KNOWN_DEPOSIT_TX'
      );
    });

    it('requires the transaction hash for the live provider', async () => {
      await expect(
        module.SubmitCrossChainDeposit(SLUG, {})
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockNearIntents.SubmitDeposit).not.toHaveBeenCalled();
    });

    it('takes the call as the deposit for the simulated provider', async () => {
      jest.mocked(IsNearIntentsSimulated).mockReturnValueOnce(true);

      await module.SubmitCrossChainDeposit(SLUG, {});

      expect(mockNearIntents.SubmitDeposit).toHaveBeenCalledWith(
        DEPOSIT_ADDRESS,
        ''
      );
      expect(mockNearIntents.GetStatus).toHaveBeenCalledWith(DEPOSIT_ADDRESS);
    });
  });
});
