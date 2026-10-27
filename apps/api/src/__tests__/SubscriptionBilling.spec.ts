// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { SubscriptionBillingModule } from '../modules/SubscriptionBilling';
import { SubscriptionModule } from '../modules/Subscription';
import { InvoiceModule } from '../modules/Invoice';
import { Database } from '../modules/Database';
import type { OnchainSubscriptionState } from '../modules/chains/types';
import { CreateMockDatabase, GetFixedTimestamp, ResetIdCounter } from './Setup';
import { CreateMockSettlement } from './mocks/Settlement';

jest.mock('../modules/Database');
jest.mock('../utils/Timestamp', () => ({
  Now: jest.fn(() => GetFixedTimestamp()),
}));
jest.mock('../modules/AppConfig', () => ({
  GetAppConfig: jest.fn(() => ({
    dashboardUrl: 'http://localhost:4200',
    livemode: false,
    appSecret: 'test-secret',
  })),
}));

const PLATFORM = 'acct_z_platform';
const SUB_ID = 'sub_z_1';
const INVOICE_ID = 'in_z_1';
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

    invoiceModule = {
      PayInvoice: jest.fn().mockResolvedValue({
        id: INVOICE_ID,
        status: 'paid',
        attempt_count: 1,
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

  it('bills the period due on-chain and advances to the period the charge paid', async () => {
    DueSubscription();
    // After the charge the chain is due one period later.
    settlement.GetSubscriptionState.mockResolvedValueOnce({
      status: 'active',
      next_charge_at: G1,
      period_seconds: PERIOD,
      chain_time: NOW,
    }).mockResolvedValueOnce({
      status: 'active',
      next_charge_at: G1 + PERIOD,
      period_seconds: PERIOD,
      chain_time: NOW + 15,
    });

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
      { id: 'in_z_g1', status: 'open', period_start: G1 },
      { id: 'in_z_g2', status: 'open', period_start: G1 + PERIOD },
    ] as never);

    await module.Run({ batchSize: 10 });

    expect(invoiceModule.VoidInvoice.mock.calls).toEqual([
      ['in_z_g1'],
      ['in_z_g2'],
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
        id: `in_z_${i}`,
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
        id: 'in_z_stale',
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
    expect(invoiceModule.VoidInvoice).toHaveBeenCalledWith('in_z_stale');
    expect(invoiceModule.PayInvoice).not.toHaveBeenCalledWith('in_z_stale');
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
      { id: 'in_z_pending', status: 'open', period_start: G1 },
    ] as never);
    invoiceModule.HasPendingCharge.mockResolvedValue(true);

    await module.Run({ batchSize: 10 });

    expect(invoiceModule.PayInvoice).toHaveBeenCalledWith('in_z_pending');
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
    const paused = Array.from({ length: 26 }, (_, i) => `sub_z_paused_${i}`);
    for (const id of paused) {
      Subscription(id, {
        pause_collection: { behavior: 'keep_as_draft', resumes_at: null },
        paused_on_chain: true,
      });
    }
    Subscription(SUB_ID);
    Due(...paused, SUB_ID);
    settlement.GetSubscriptionState.mockImplementation(async (onchainId) => ({
      status: onchainId.startsWith('0xsub_z_paused') ? 'paused' : 'active',
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
    const ids = Array.from({ length: 100 }, (_, i) => `sub_z_page_${i}`);
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
    query.Subscriptions = [{ id: 'sub_z_canceled' }];

    await module.Run({ batchSize: 10 });

    expect(subscriptionModule.SendOnchainCancel).toHaveBeenCalledWith(
      'sub_z_canceled'
    );
  });
});
