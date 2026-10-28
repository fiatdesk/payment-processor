// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import type {
  Invoice,
  Price,
  Subscription,
  SubscriptionItem,
} from '@fiatdesk/shared-types';
import { SubscriptionBillingModule } from '../modules/SubscriptionBilling';
import { SubscriptionModule } from '../modules/Subscription';
import { InvoiceModule } from '../modules/Invoice';
import { InvoiceItemModule } from '../modules/InvoiceItem';
import { ChargeModule } from '../modules/Charge';
import { CustomerModule } from '../modules/Customer';
import { PaymentIntentModule } from '../modules/PaymentIntent';
import { PriceModule } from '../modules/Price';
import { ProductModule } from '../modules/Product';
import { PlanDestinationModule } from '../modules/PlanDestination';
import type { EventService } from '../modules/EventService';
import { Database } from '../modules/Database';
import { LIVE_SUBSCRIPTION_STATUSES } from '../modules/SubscriptionCycleClaims';
import {
  COLLECTION_FAILED_ALLOWANCE,
  type OnchainSubscriptionState,
} from '../modules/chains/types';
import { AppError } from '../utils/AppError';
import { Now } from '../utils/Timestamp';
import { CreateMockDatabase, GetFixedTimestamp, ResetIdCounter } from './Setup';
import { MemoryDatabase } from './mocks/MemoryDatabase';
import { CreateMockSettlement } from './mocks/Settlement';

jest.mock('../modules/Database');
jest.mock('../utils/Timestamp', () => ({
  ...jest.requireActual('../utils/Timestamp'),
  Now: jest.fn(() => GetFixedTimestamp()),
}));
jest.mock('../modules/AppConfig', () => ({
  ...jest.requireActual('../modules/AppConfig'),
  GetAppConfig: jest.fn(() => ({
    dashboardUrl: 'http://localhost:4200',
    livemode: false,
    appSecret: 'test-secret',
  })),
}));

const PLATFORM = 'acct_fd_platform';
const SUB_ID = 'sub_fd_1';
const INVOICE_ID = 'in_fd_1';
const PERIOD = 30 * 24 * 3600;
const NOW = GetFixedTimestamp();
/** The on-chain grid point the due subscription's current period ends on. */
const G1 = NOW - 10;

describe('SubscriptionBillingModule', () => {
  let mockDb: jest.Mocked<Database>;
  let subscriptionModule: jest.Mocked<SubscriptionModule>;
  let invoiceModule: jest.Mocked<InvoiceModule>;
  let settlement: ReturnType<typeof CreateMockSettlement>;
  let module: SubscriptionBillingModule;
  let subscriptions: Map<string, Record<string, unknown>>;
  let query: {
    Invoices: unknown[];
    SubscriptionItems: unknown[][];
    Subscriptions: unknown[];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    ResetIdCounter();
    mockDb = CreateMockDatabase();
    subscriptions = new Map();
    query = { Invoices: [], SubscriptionItems: [], Subscriptions: [] };
    mockDb.Query = jest.fn(async (options: { collection: string }) => {
      if (options.collection === 'Invoices') return query.Invoices;
      if (options.collection === 'SubscriptionItems') {
        return query.SubscriptionItems.shift() ?? [];
      }
      return query.Subscriptions;
    }) as never;

    subscriptionModule = {
      ClaimForBilling: jest.fn(async (id: string) => subscriptions.get(id)),
      ReleaseBillingLock: jest.fn(),
      CreateCycleInvoice: jest.fn().mockResolvedValue({
        id: INVOICE_ID,
        status: 'open',
        period_start: G1,
      }),
      AdvanceSubscriptionPeriod: jest.fn(),
      MarkSubscriptionPastDue: jest.fn(),
      MarkSubscriptionUnpaid: jest.fn(),
      FinalizeCancelAtPeriodEnd: jest.fn(),
      AlignToCycle: jest.fn(async (id: string) => subscriptions.get(id)),
      PauseCollectionOnChain: jest.fn(),
      ResumeCollectionFromChain: jest.fn(async (id: string) => ({
        ...subscriptions.get(id),
        pause_collection: null,
        paused_on_chain: false,
      })),
      CancelFromChain: jest.fn(),
      SendOnchainCancel: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionModule>;

    // The charge that paid the cycle at G1 paid [G1, G1 + PERIOD], as its
    // Charged event says (kept on the cycle claim).
    mockDb.Get = jest.fn(async (collection: string, id: string) =>
      collection === 'SubscriptionCycleClaims' && id.endsWith(`:${G1}`)
        ? { id, paid_period: { start: G1, end: G1 + PERIOD } }
        : null
    ) as never;

    invoiceModule = {
      PayInvoice: jest.fn().mockResolvedValue({
        id: INVOICE_ID,
        status: 'paid',
        attempt_count: 1,
        period_start: G1,
      }),
      MarkInvoiceUncollectible: jest.fn(),
      VoidInvoice: jest.fn(),
      ListOpenSubscriptionInvoices: jest.fn().mockResolvedValue([]),
      HasPendingCharge: jest.fn().mockResolvedValue(false),
      ScheduleOpenSubscriptionInvoices: jest.fn(),
    } as unknown as jest.Mocked<InvoiceModule>;

    settlement = CreateMockSettlement();
    // On-chain: due at G1, read just after it.
    Chain({ next_charge_at: G1, chain_time: NOW });

    module = new SubscriptionBillingModule(
      mockDb,
      subscriptionModule,
      invoiceModule,
      settlement
    );
  });

  function Chain(state: Partial<OnchainSubscriptionState>): void {
    settlement.GetSubscriptionState.mockResolvedValue({
      status: 'active',
      next_charge_at: G1,
      period_seconds: PERIOD,
      chain_time: NOW,
      ...state,
    });
  }

  /** An on-chain subscription whose current period ended at `G1`. */
  function Subscription(
    id: string,
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const subscription = {
      id,
      platform_account: PLATFORM,
      status: 'active',
      collection_method: 'charge_automatically',
      subscription_onchain_id: `0x${id.replace(/\W/g, '').padEnd(64, '0')}`,
      pause_collection: null,
      paused_on_chain: false,
      items: {
        object: 'list',
        data: [
          {
            id: `si_${id}`,
            current_period_start: G1 - PERIOD,
            current_period_end: G1,
          },
        ],
      },
      ...overrides,
    };
    subscriptions.set(id, subscription);
    return subscription;
  }

  function Due(...ids: string[]): void {
    query.SubscriptionItems.push(
      ids.map((id) => ({
        id: `si_${id}`,
        subscription: id,
        current_period_end: G1,
        platform_account: PLATFORM,
      }))
    );
  }

  function DueSubscription(overrides: Record<string, unknown> = {}) {
    const subscription = Subscription(SUB_ID, overrides);
    Due(SUB_ID);
    return subscription;
  }

  it('bills the period due on-chain and advances to the period the charge paid, from its Charged event', async () => {
    DueSubscription();

    const result = await module.Run({ batchSize: 10 });

    expect(subscriptionModule.AlignToCycle).not.toHaveBeenCalled();
    expect(subscriptionModule.CreateCycleInvoice).toHaveBeenCalledWith(
      PLATFORM,
      SUB_ID,
      { finalize: true, collect: false }
    );
    expect(invoiceModule.PayInvoice).toHaveBeenCalledWith(INVOICE_ID);
    expect(subscriptionModule.AdvanceSubscriptionPeriod).toHaveBeenCalledWith(
      SUB_ID,
      INVOICE_ID,
      { start: G1, end: G1 + PERIOD }
    );
    // The paid period is not read from the chain again.
    expect(settlement.GetSubscriptionState).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ processed: 1, succeeded: 1, failed: 0 });
  });

  it('pays the open invoice of the due period on retry instead of creating one', async () => {
    Subscription(SUB_ID, { status: 'past_due' });
    query.Invoices = [
      {
        id: INVOICE_ID,
        status: 'open',
        attempt_count: 1,
        next_payment_attempt: NOW - 1,
        parent: { subscription_details: { subscription: SUB_ID } },
      },
    ];
    invoiceModule.ListOpenSubscriptionInvoices.mockResolvedValue([
      { id: INVOICE_ID, status: 'open', period_start: G1 },
    ] as never);

    const result = await module.Run({ batchSize: 10 });

    expect(subscriptionModule.CreateCycleInvoice).not.toHaveBeenCalled();
    expect(invoiceModule.PayInvoice).toHaveBeenCalledWith(INVOICE_ID);
    expect(result.succeeded).toBe(1);
  });

  it('voids the open invoices of periods the chain skipped and pays the current one', async () => {
    DueSubscription();
    // Due since G1; read between G3 and G4.
    const G3 = G1 + 2 * PERIOD;
    Chain({ chain_time: G3 + 100 });
    invoiceModule.ListOpenSubscriptionInvoices.mockResolvedValue([
      { id: 'in_fd_g1', status: 'open', period_start: G1 },
      { id: 'in_fd_g2', status: 'open', period_start: G1 + PERIOD },
    ] as never);

    await module.Run({ batchSize: 10 });

    expect(invoiceModule.VoidInvoice.mock.calls).toEqual([
      ['in_fd_g1'],
      ['in_fd_g2'],
    ]);
    expect(subscriptionModule.AlignToCycle).toHaveBeenCalledWith(SUB_ID, {
      start: G3 - PERIOD,
      end: G3,
    });
    expect(subscriptionModule.CreateCycleInvoice).toHaveBeenCalledTimes(1);
    expect(invoiceModule.PayInvoice).toHaveBeenCalledTimes(1);
    expect(invoiceModule.PayInvoice).toHaveBeenCalledWith(INVOICE_ID);
  });

  it('voids at most 12 skipped periods per run and charges nothing until the rest are voided', async () => {
    DueSubscription();
    Chain({ chain_time: G1 + 20 * PERIOD });
    invoiceModule.ListOpenSubscriptionInvoices.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({
        id: `in_fd_${i}`,
        status: 'open',
        period_start: G1 + i * PERIOD,
      })) as never
    );

    await module.Run({ batchSize: 10 });

    expect(invoiceModule.VoidInvoice).toHaveBeenCalledTimes(12);
    expect(invoiceModule.PayInvoice).not.toHaveBeenCalled();
    expect(subscriptionModule.ReleaseBillingLock).toHaveBeenCalledWith(SUB_ID);
  });

  it('collects at once after an on-chain resume, paying the current period, not the stale invoice', async () => {
    // Paused after the G0 charge; the G1 invoice stayed open and unscheduled.
    DueSubscription({
      pause_collection: { behavior: 'keep_as_draft', resumes_at: null },
      paused_on_chain: true,
    });
    invoiceModule.ListOpenSubscriptionInvoices.mockResolvedValue([
      {
        id: 'in_fd_stale',
        status: 'open',
        period_start: G1,
        next_payment_attempt: null,
        metadata: { last_payment_error_code: 'paused_on_chain' },
      },
    ] as never);
    // Resumed between G3 and G4: nextChargeAt is still G1.
    const G3 = G1 + 2 * PERIOD;
    Chain({ chain_time: G3 + 3600 });

    const result = await module.Run({ batchSize: 10 });

    expect(subscriptionModule.ResumeCollectionFromChain).toHaveBeenCalledWith(
      SUB_ID
    );
    expect(invoiceModule.VoidInvoice).toHaveBeenCalledWith('in_fd_stale');
    expect(invoiceModule.PayInvoice).not.toHaveBeenCalledWith('in_fd_stale');
    expect(subscriptionModule.AlignToCycle).toHaveBeenCalledWith(SUB_ID, {
      start: G3 - PERIOD,
      end: G3,
    });
    expect(invoiceModule.PayInvoice).toHaveBeenCalledWith(INVOICE_ID);
    expect(result.succeeded).toBe(1);
  });

  it('reconciles a pending charge before reading the chain', async () => {
    DueSubscription();
    invoiceModule.ListOpenSubscriptionInvoices.mockResolvedValue([
      { id: 'in_fd_pending', status: 'open', period_start: G1 },
    ] as never);
    invoiceModule.HasPendingCharge.mockResolvedValue(true);

    await module.Run({ batchSize: 10 });

    expect(invoiceModule.PayInvoice).toHaveBeenCalledWith('in_fd_pending');
    expect(subscriptionModule.CreateCycleInvoice).not.toHaveBeenCalled();
  });

  it('waits, scheduling its invoices, while the chain is not due yet', async () => {
    DueSubscription();
    Chain({ next_charge_at: NOW + 500 });

    const result = await module.Run({ batchSize: 10 });

    expect(invoiceModule.ScheduleOpenSubscriptionInvoices).toHaveBeenCalledWith(
      SUB_ID,
      NOW + 500
    );
    expect(invoiceModule.PayInvoice).not.toHaveBeenCalled();
    expect(result).toMatchObject({ processed: 0, skipped: 1, failed: 0 });
  });

  it('should mark unpaid after max payment attempts', async () => {
    DueSubscription({ status: 'past_due' });
    invoiceModule.PayInvoice.mockResolvedValue({
      id: INVOICE_ID,
      status: 'open',
      attempt_count: 4,
      metadata: {
        last_payment_error: 'allowance',
        last_payment_error_code: 'collection_failed_allowance',
      },
    } as never);

    const result = await module.Run({ batchSize: 10 });

    expect(invoiceModule.MarkInvoiceUncollectible).toHaveBeenCalledWith(
      INVOICE_ID
    );
    expect(subscriptionModule.MarkSubscriptionUnpaid).toHaveBeenCalledWith(
      SUB_ID,
      INVOICE_ID
    );
    expect(result.failed).toBe(1);
  });

  it('marks the subscription past_due when the allowance is exhausted', async () => {
    DueSubscription();
    invoiceModule.PayInvoice.mockResolvedValue({
      id: INVOICE_ID,
      status: 'open',
      attempt_count: 1,
      metadata: {
        last_payment_error: 'allowance',
        last_payment_error_code: 'collection_failed_allowance',
      },
    } as never);

    const result = await module.Run({ batchSize: 10 });

    expect(subscriptionModule.MarkSubscriptionPastDue).toHaveBeenCalledWith(
      SUB_ID,
      INVOICE_ID
    );
    expect(result.failed).toBe(1);
  });

  it.each(['period_already_collected', 'charge_pending', 'chain_unavailable'])(
    'treats %s as a wait: no past_due, not counted',
    async (code) => {
      DueSubscription();
      invoiceModule.PayInvoice.mockResolvedValue({
        id: INVOICE_ID,
        status: 'open',
        attempt_count: 0,
        metadata: { last_payment_error_code: code },
      } as never);

      const result = await module.Run({ batchSize: 10 });

      expect(subscriptionModule.MarkSubscriptionPastDue).not.toHaveBeenCalled();
      expect(subscriptionModule.ReleaseBillingLock).toHaveBeenCalledWith(
        SUB_ID
      );
      expect(result).toMatchObject({ processed: 0, skipped: 1, failed: 0 });
    }
  );

  it('should skip when claim lock is already held', async () => {
    Due(SUB_ID);

    const result = await module.Run({ batchSize: 10 });

    expect(subscriptionModule.CreateCycleInvoice).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(0);
  });

  it('should finalize cancel_at_period_end instead of renewing', async () => {
    DueSubscription({ cancel_at_period_end: true, cancel_at: NOW - 10 });

    const result = await module.Run({ batchSize: 10 });

    expect(subscriptionModule.FinalizeCancelAtPeriodEnd).toHaveBeenCalledWith(
      SUB_ID
    );
    expect(subscriptionModule.CreateCycleInvoice).not.toHaveBeenCalled();
    expect(result.succeeded).toBe(1);
  });

  it('charges a subscription at most once per run', async () => {
    DueSubscription({ status: 'past_due' });
    query.Invoices = [
      {
        id: INVOICE_ID,
        status: 'open',
        attempt_count: 1,
        next_payment_attempt: NOW - 1,
        parent: { subscription_details: { subscription: SUB_ID } },
      },
    ];

    await module.Run({ batchSize: 10 });

    expect(invoiceModule.PayInvoice).toHaveBeenCalledTimes(1);
    expect(subscriptionModule.ClaimForBilling).toHaveBeenCalledTimes(1);
  });

  describe('chain status', () => {
    it('pauses collection, without a billing failure, when the chain says paused', async () => {
      DueSubscription();
      Chain({ status: 'paused' });

      const result = await module.Run({ batchSize: 10 });

      expect(subscriptionModule.PauseCollectionOnChain).toHaveBeenCalledWith(
        SUB_ID
      );
      expect(invoiceModule.PayInvoice).not.toHaveBeenCalled();
      expect(subscriptionModule.MarkSubscriptionPastDue).not.toHaveBeenCalled();
      expect(result).toMatchObject({ processed: 0, skipped: 1, failed: 0 });
    });

    it('keeps its own pause while the chain still says paused', async () => {
      DueSubscription({
        pause_collection: { behavior: 'keep_as_draft', resumes_at: null },
        paused_on_chain: true,
      });
      Chain({ status: 'paused' });

      const result = await module.Run({ batchSize: 10 });

      expect(
        subscriptionModule.ResumeCollectionFromChain
      ).not.toHaveBeenCalled();
      expect(invoiceModule.PayInvoice).not.toHaveBeenCalled();
      expect(result).toMatchObject({ processed: 0, skipped: 1 });
    });

    it.each([
      ['active', {}],
      [
        'paused',
        {
          pause_collection: { behavior: 'keep_as_draft', resumes_at: null },
          paused_on_chain: true,
        },
      ],
    ])(
      'cancels a subscription (%s here) that the chain says is canceled, without dunning',
      async (_label, overrides) => {
        DueSubscription(overrides);
        Chain({ status: 'canceled' });

        await module.Run({ batchSize: 10 });

        expect(subscriptionModule.CancelFromChain).toHaveBeenCalledWith(SUB_ID);
        expect(invoiceModule.PayInvoice).not.toHaveBeenCalled();
        expect(
          subscriptionModule.MarkSubscriptionPastDue
        ).not.toHaveBeenCalled();
      }
    );

    it('cancels when a collection reports canceled_on_chain', async () => {
      DueSubscription();
      invoiceModule.PayInvoice.mockResolvedValue({
        id: INVOICE_ID,
        status: 'open',
        attempt_count: 0,
        metadata: { last_payment_error_code: 'canceled_on_chain' },
      } as never);

      await module.Run({ batchSize: 10 });

      expect(subscriptionModule.CancelFromChain).toHaveBeenCalledWith(SUB_ID);
      expect(subscriptionModule.MarkSubscriptionPastDue).not.toHaveBeenCalled();
    });

    it('waits, without a failure, when the chain cannot be read', async () => {
      DueSubscription();
      settlement.GetSubscriptionState.mockRejectedValue(new Error('down'));

      const result = await module.Run({ batchSize: 10 });

      expect(subscriptionModule.MarkSubscriptionPastDue).not.toHaveBeenCalled();
      expect(subscriptionModule.ReleaseBillingLock).toHaveBeenCalledWith(
        SUB_ID
      );
      expect(result).toMatchObject({ processed: 0, skipped: 1, failed: 0 });
    });

    it('never reads the chain for, or lifts, a pause the merchant set', async () => {
      DueSubscription({
        pause_collection: { behavior: 'void', resumes_at: null },
      });

      const result = await module.Run({ batchSize: 10 });

      expect(settlement.GetSubscriptionState).not.toHaveBeenCalled();
      expect(subscriptionModule.CreateCycleInvoice).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });
  });

  it('still charges a due subscription behind more paused ones than the batch size', async () => {
    const paused = Array.from({ length: 26 }, (_, i) => `sub_fd_paused_${i}`);
    for (const id of paused) {
      Subscription(id, {
        pause_collection: { behavior: 'keep_as_draft', resumes_at: null },
        paused_on_chain: true,
      });
    }
    Subscription(SUB_ID);
    Due(...paused, SUB_ID);
    settlement.GetSubscriptionState.mockImplementation(async (onchainId) => ({
      status: onchainId.startsWith('0xsub_fd_paused') ? 'paused' : 'active',
      next_charge_at: G1,
      period_seconds: PERIOD,
      chain_time: NOW,
    }));

    const result = await module.Run({ batchSize: 25 });

    expect(invoiceModule.PayInvoice).toHaveBeenCalledTimes(1);
    expect(subscriptionModule.AdvanceSubscriptionPeriod).toHaveBeenCalledWith(
      SUB_ID,
      INVOICE_ID,
      expect.anything()
    );
    expect(result).toMatchObject({ processed: 1, skipped: 26, succeeded: 1 });
  });

  it('reads due subscriptions page by page', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `sub_fd_page_${i}`);
    for (const id of ids) {
      Subscription(id, { collection_method: 'send_invoice' });
    }
    Subscription(SUB_ID);
    Due(...ids);
    Due(SUB_ID);

    await module.Run({ batchSize: 5 });

    const pages = jest
      .mocked(mockDb.Query)
      .mock.calls.filter(
        ([options]) => options.collection === 'SubscriptionItems'
      );
    expect(pages).toHaveLength(2);
    expect(pages[1][0]).toMatchObject({ startAt: G1 });
    expect(invoiceModule.PayInvoice).toHaveBeenCalledTimes(1);
  });

  it('sends again the on-chain cancels still pending', async () => {
    query.Subscriptions = [{ id: 'sub_fd_canceled' }];

    await module.Run({ batchSize: 10 });

    expect(subscriptionModule.SendOnchainCancel).toHaveBeenCalledWith(
      'sub_fd_canceled'
    );
  });
});

describe('SubscriptionBillingModule with the real billing modules', () => {
  const PLATFORM_ACCOUNT = 'acct_fd_platform';
  const WALLET = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
  const ONCHAIN_ID = `0x${'5b'.repeat(32)}`;
  const PERIOD_SECONDS = 30 * 24 * 3600;
  const DAY = 24 * 3600;
  const T0 = GetFixedTimestamp();
  let memory: MemoryDatabase;
  let settlement: ReturnType<typeof CreateMockSettlement>;
  let subscriptions: SubscriptionModule;
  let billing: SubscriptionBillingModule;
  let events: string[];
  let clock: number;
  /** The chain's next due time. */
  let nextChargeAt: number;

  beforeEach(async () => {
    jest.clearAllMocks();
    memory = new MemoryDatabase();
    memory.UniqueIndex('Subscriptions', ['subscription_onchain_id'], {
      subscription_onchain_id: { $type: 'string' },
      status: { $in: [...LIVE_SUBSCRIPTION_STATUSES] },
    });
    const db = memory.AsDatabase();
    events = [];
    const eventService = {
      Emit: jest.fn(async (type: string) => {
        events.push(type);
      }),
    } as unknown as EventService;
    clock = T0;
    jest.mocked(Now).mockImplementation(() => clock);
    settlement = CreateMockSettlement();
    settlement.GetSubscriptionState.mockImplementation(async () => ({
      status: 'active',
      next_charge_at: nextChargeAt,
      period_seconds: PERIOD_SECONDS,
      chain_time: clock,
    }));
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
      settlement
    );
    subscriptions = new SubscriptionModule(
      db,
      eventService,
      customers,
      prices,
      invoices,
      settlement
    );
    billing = new SubscriptionBillingModule(
      db,
      subscriptions,
      invoices,
      settlement,
      new PlanDestinationModule(db, settlement, eventService)
    );
    memory.Seed('Customers', {
      id: 'cus_fd_1',
      object: 'customer',
      platform_account: PLATFORM_ACCOUNT,
      email: 'subscriber@example.com',
      invoice_prefix: 'ABCD1234',
      next_invoice_sequence: 1,
      metadata: {},
    });
    memory.Seed('Prices', {
      id: 'price_fd_1',
      object: 'price',
      active: true,
      currency: 'usdc',
      product: 'prod_fd_1',
      platform_account: PLATFORM_ACCOUNT,
      type: 'recurring',
      unit_amount: 2000,
      recurring: { interval: 'month', interval_count: 1 },
      subscription_plan_id: `0x${'a1'.repeat(32)}`,
      metadata: {},
    });
    memory.Seed('Products', {
      id: 'prod_fd_1',
      object: 'product',
      name: 'Plan',
      platform_account: PLATFORM_ACCOUNT,
      metadata: {},
    });
  });

  afterEach(() => {
    jest.mocked(Now).mockImplementation(() => GetFixedTimestamp());
  });

  /** A subscription whose first period was collected at checkout. */
  async function Subscribed(
    input: Record<string, unknown> = {},
    options: { periodStart: number; periodEnd: number } = {
      periodStart: T0 - PERIOD_SECONDS,
      periodEnd: T0,
    }
  ) {
    return subscriptions.CreateSubscription(
      PLATFORM_ACCOUNT,
      {
        customer: 'cus_fd_1',
        items: [{ price: 'price_fd_1', quantity: 1 }],
        default_payment_method: WALLET,
        ...input,
      },
      {
        subscriptionOnchainId: ONCHAIN_ID,
        settlementTransactionHash: input.trial_end
          ? undefined
          : `0x${'f1'.repeat(32)}`,
        ...options,
      }
    );
  }

  async function RunAt(time: number) {
    clock = time;
    return billing.Run({ platformAccountId: PLATFORM_ACCOUNT });
  }

  function CycleInvoices(): Invoice[] {
    return memory
      .All<Invoice>('Invoices')
      .filter((invoice) => invoice.billing_reason === 'subscription_cycle');
  }

  function Count(type: string): number {
    return events.filter((event) => event === type).length;
  }

  it('keeps the 1/3/5-day dunning schedule: one attempt per retry time, unpaid only after the last', async () => {
    nextChargeAt = T0;
    const subscription = await Subscribed();
    settlement.CollectSubscriptionPayment.mockRejectedValue(
      new AppError('allowance', 402, COLLECTION_FAILED_ALLOWANCE)
    );
    const attempts = () =>
      settlement.CollectSubscriptionPayment.mock.calls.length;
    const Status = () =>
      memory.Doc<Subscription>('Subscriptions', subscription.id).status;

    const first = T0 + 60;
    await RunAt(first);
    expect(attempts()).toBe(1);
    const [invoice] = CycleInvoices();
    expect(invoice).toMatchObject({
      status: 'open',
      attempt_count: 1,
      next_payment_attempt: first + DAY,
    });
    expect(Status()).toBe('past_due');

    // Another run inside the dunning window changes nothing.
    await expect(RunAt(first + 3600)).resolves.toMatchObject({
      processed: 0,
      failed: 0,
    });
    expect(attempts()).toBe(1);
    expect(Count('invoice.payment_failed')).toBe(1);
    expect(Count('customer.subscription.allowance_exhausted')).toBe(1);

    // Each retry comes at its delay: 1, then 3, then 5 days.
    const second = first + DAY;
    await RunAt(second - 1);
    expect(attempts()).toBe(1);
    await RunAt(second);
    expect(attempts()).toBe(2);
    expect(CycleInvoices()[0]).toMatchObject({
      attempt_count: 2,
      next_payment_attempt: second + 3 * DAY,
    });

    const third = second + 3 * DAY;
    await RunAt(third - 1);
    expect(attempts()).toBe(2);
    await RunAt(third);
    expect(attempts()).toBe(3);
    expect(CycleInvoices()[0]).toMatchObject({
      attempt_count: 3,
      next_payment_attempt: third + 5 * DAY,
    });
    expect(Status()).toBe('past_due');

    const fourth = third + 5 * DAY;
    await RunAt(fourth - 1);
    expect(attempts()).toBe(3);
    await RunAt(fourth);
    expect(attempts()).toBe(4);
    expect(CycleInvoices()[0]).toMatchObject({
      attempt_count: 4,
      status: 'uncollectible',
    });
    expect(Status()).toBe('unpaid');
    expect(Count('invoice.payment_failed')).toBe(4);
    expect(Count('customer.subscription.allowance_exhausted')).toBe(4);
  });

  it('collects the first period at the trial end, from the real post-subscribe state', async () => {
    const trialEnd = T0 + 7 * DAY;
    nextChargeAt = trialEnd;
    const subscription = await Subscribed(
      { trial_end: trialEnd },
      { periodStart: T0, periodEnd: trialEnd }
    );
    expect(subscription).toMatchObject({
      status: 'trialing',
      trial_end: trialEnd,
    });
    expect(subscription.items.data[0]).toMatchObject({
      current_period_start: T0,
      current_period_end: trialEnd,
    });
    expect(memory.All<Invoice>('Invoices')).toEqual([]);
    settlement.CollectSubscriptionPayment.mockImplementation(async (params) => {
      await params.onSigned(`0x${'c4'.repeat(32)}`, { nonce: 1 });
      nextChargeAt = trialEnd + PERIOD_SECONDS;
      return {
        status: 'collected',
        transaction_hash: `0x${'c4'.repeat(32)}`,
        next_charge_at: trialEnd + PERIOD_SECONDS,
      };
    });

    await RunAt(trialEnd - 60);
    expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();

    await RunAt(trialEnd + 30);

    expect(settlement.CollectSubscriptionPayment).toHaveBeenCalledTimes(1);
    expect(CycleInvoices()).toEqual([
      expect.objectContaining({ status: 'paid', period_start: trialEnd }),
    ]);
    const after = memory.Doc<Subscription>('Subscriptions', subscription.id);
    expect(after.status).toBe('active');
    expect(
      memory
        .All<SubscriptionItem>('SubscriptionItems')
        .find((item) => item.subscription === subscription.id)
    ).toMatchObject({
      current_period_start: trialEnd,
      current_period_end: trialEnd + PERIOD_SECONDS,
    });
  });

  it('follows every pending on-chain cancel oldest first, past the batch size', async () => {
    for (let i = 0; i < 3; i++) {
      memory.Seed('Subscriptions', {
        id: `sub_fd_cancel${i}`,
        platform_account: PLATFORM_ACCOUNT,
        status: 'canceled',
        canceled_at: T0 - 100 + i,
        cancel_pending_on_chain: true,
        subscription_onchain_id: `0x${String(i).repeat(64)}`,
      });
    }
    const sent = jest
      .spyOn(subscriptions, 'SendOnchainCancel')
      .mockResolvedValue(undefined);

    await billing.Run({ platformAccountId: PLATFORM_ACCOUNT, batchSize: 1 });

    expect(sent.mock.calls.map(([id]) => id)).toEqual([
      'sub_fd_cancel0',
      'sub_fd_cancel1',
      'sub_fd_cancel2',
    ]);
  });

  describe('while the plan moves to a new default wallet', () => {
    const OLD_WALLET = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
    const NEW_WALLET = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc';
    const CHANGE_HASH = `0x${'d5'.repeat(32)}`;
    const REPLACEMENT = `0x${'d6'.repeat(32)}`;

    beforeEach(() => {
      memory.Seed('ExternalWallets', {
        id: 'wa_fd_new',
        account: PLATFORM_ACCOUNT,
        wallet_address: NEW_WALLET,
        default_for_currency: true,
        status: 'new',
        created: 2,
      });
      memory.Seed('Prices', {
        ...memory.Doc<Record<string, unknown>>('Prices', 'price_fd_1'),
        subscription_plan_destination: OLD_WALLET,
        subscription_plan_destination_change: {
          destination: NEW_WALLET,
          transaction_hash: CHANGE_HASH,
          status: 'pending',
          created: T0,
          failure_message: null,
          sent_at: T0,
        },
      });
    });

    function Plan(): Price {
      return memory.Doc<Price>('Prices', 'price_fd_1');
    }

    it('does not charge while the change is pending, and charges after it confirms by its hash', async () => {
      nextChargeAt = T0;
      await Subscribed();
      settlement.SetPlanDestination.mockResolvedValue({
        status: 'pending',
        transaction_hash: CHANGE_HASH,
      });

      await RunAt(T0 + 60);

      expect(settlement.SetPlanDestination).toHaveBeenCalledWith(
        `0x${'a1'.repeat(32)}`,
        NEW_WALLET,
        expect.objectContaining({ pendingHash: CHANGE_HASH, sentAt: T0 })
      );
      expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
      expect(CycleInvoices()[0]).toMatchObject({
        status: 'open',
        attempt_count: 0,
        metadata: { last_payment_error_code: 'plan_destination_pending' },
      });
      expect(memory.All<Subscription>('Subscriptions')[0].status).not.toBe(
        'past_due'
      );
      expect(Count('invoice.payment_failed')).toBe(0);

      settlement.SetPlanDestination.mockResolvedValue({
        status: 'confirmed',
        transaction_hash: CHANGE_HASH,
      });
      await RunAt(T0 + 120);

      expect(Plan()).toMatchObject({
        subscription_plan_destination: NEW_WALLET,
        subscription_plan_destination_change: {
          status: 'confirmed',
          transaction_hash: CHANGE_HASH,
        },
      });
      expect(Count('price.updated')).toBe(1);
      expect(settlement.CollectSubscriptionPayment).toHaveBeenCalledTimes(1);
      expect(CycleInvoices()[0].status).toBe('paid');
    });

    it('follows a pending change in every run, even with nothing due, and records its re-priced replacement', async () => {
      settlement.SetPlanDestination.mockImplementation(
        async (_planKey, _destination, options) => {
          await options.onSigned(REPLACEMENT);
          return { status: 'pending', transaction_hash: REPLACEMENT };
        }
      );

      await RunAt(T0 + 601);

      expect(Plan().subscription_plan_destination_change).toMatchObject({
        status: 'pending',
        transaction_hash: REPLACEMENT,
        sent_at: T0 + 601,
      });
    });

    it('marks the change failed on plan_owner_mismatch and goes on charging', async () => {
      nextChargeAt = T0;
      await Subscribed();
      settlement.SetPlanDestination.mockRejectedValue(
        new AppError('not the owner', 409, 'plan_owner_mismatch')
      );

      await RunAt(T0 + 60);

      expect(Plan().subscription_plan_destination_change).toMatchObject({
        status: 'failed',
        failure_message: 'plan_owner_mismatch',
      });
      expect(settlement.CollectSubscriptionPayment).toHaveBeenCalledTimes(1);
    });
  });
});
