import { SubscriptionBillingModule } from '../modules/SubscriptionBilling';
import { SubscriptionModule } from '../modules/Subscription';
import { InvoiceModule } from '../modules/Invoice';
import { Database } from '../modules/Database';
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

describe('SubscriptionBillingModule', () => {
  let mockDb: jest.Mocked<Database>;
  let subscriptionModule: jest.Mocked<SubscriptionModule>;
  let invoiceModule: jest.Mocked<InvoiceModule>;
  let module: SubscriptionBillingModule;

  let settlement: ReturnType<typeof CreateMockSettlement>;

  beforeEach(() => {
    jest.clearAllMocks();
    ResetIdCounter();
    mockDb = CreateMockDatabase();

    subscriptionModule = {
      ClaimForBilling: jest.fn(),
      ReleaseBillingLock: jest.fn(),
      CreateCycleInvoice: jest.fn(),
      AdvanceSubscriptionPeriod: jest.fn(),
      MarkSubscriptionPastDue: jest.fn(),
      MarkSubscriptionUnpaid: jest.fn(),
      FinalizeCancelAtPeriodEnd: jest.fn(),
      // The next cycle is the current one unless a test says otherwise.
      NextCycleEnd: jest.fn().mockResolvedValue(GetFixedTimestamp() + 1000),
      SkipMissedCycle: jest.fn(),
      PauseCollectionOnChain: jest.fn(),
      ResumeCollectionFromChain: jest.fn(),
    } as unknown as jest.Mocked<SubscriptionModule>;

    invoiceModule = {
      PayInvoice: jest.fn(),
      MarkInvoiceUncollectible: jest.fn(),
      VoidInvoice: jest.fn(),
    } as unknown as jest.Mocked<InvoiceModule>;

    settlement = CreateMockSettlement();
    module = new SubscriptionBillingModule(
      mockDb,
      subscriptionModule,
      invoiceModule,
      settlement
    );
  });

  /** One active on-chain subscription whose period ended 10 s ago. */
  function DueSubscription(overrides: Record<string, unknown> = {}) {
    const now = GetFixedTimestamp();
    mockDb.Query = jest
      .fn()
      .mockResolvedValueOnce([]) // retry invoices
      .mockResolvedValueOnce([
        {
          id: 'si_z_1',
          subscription: SUB_ID,
          current_period_end: now - 10,
          platform_account: PLATFORM,
        },
      ])
      .mockResolvedValueOnce([]); // open cycle invoices
    const claimed = {
      id: SUB_ID,
      platform_account: PLATFORM,
      status: 'active',
      collection_method: 'charge_automatically',
      subscription_onchain_id: 'SubOnchain111',
      pause_collection: null,
      items: {
        object: 'list',
        data: [
          {
            id: 'si_z_1',
            current_period_start: now - 1000,
            current_period_end: now - 10,
          },
        ],
      },
      ...overrides,
    };
    subscriptionModule.ClaimForBilling.mockResolvedValue(claimed as never);
    return claimed;
  }

  describe('after missed cycles', () => {
    it('voids the invoices of cycles it missed and collects only the current cycle', async () => {
      const now = GetFixedTimestamp();
      const claimed = DueSubscription();
      subscriptionModule.NextCycleEnd.mockResolvedValueOnce(now - 500)
        .mockResolvedValueOnce(now - 100)
        .mockResolvedValueOnce(now + 1000);
      subscriptionModule.SkipMissedCycle.mockResolvedValue(claimed as never);
      subscriptionModule.CreateCycleInvoice.mockResolvedValueOnce({
        id: 'in_z_missed_1',
        status: 'open',
      } as never)
        .mockResolvedValueOnce({ id: 'in_z_missed_2', status: 'open' } as never)
        .mockResolvedValueOnce({
          id: INVOICE_ID,
          status: 'paid',
          attempt_count: 1,
        } as never);

      const result = await module.Run({ batchSize: 10 });

      expect(subscriptionModule.CreateCycleInvoice.mock.calls).toEqual([
        [PLATFORM, SUB_ID, { finalize: true, collect: false }],
        [PLATFORM, SUB_ID, { finalize: true, collect: false }],
        [PLATFORM, SUB_ID, { finalize: true, collect: true }],
      ]);
      expect(invoiceModule.VoidInvoice.mock.calls).toEqual([
        ['in_z_missed_1'],
        ['in_z_missed_2'],
      ]);
      expect(subscriptionModule.SkipMissedCycle.mock.calls).toEqual([
        [SUB_ID, 'in_z_missed_1'],
        [SUB_ID, 'in_z_missed_2'],
      ]);
      expect(invoiceModule.PayInvoice).not.toHaveBeenCalled();
      expect(subscriptionModule.AdvanceSubscriptionPeriod).toHaveBeenCalledWith(
        SUB_ID,
        INVOICE_ID
      );
      expect(result).toMatchObject({ succeeded: 1, failed: 0 });
    });

    it('voids at most 12 missed cycles per run and leaves the charge for a later run', async () => {
      const claimed = DueSubscription();
      subscriptionModule.NextCycleEnd.mockResolvedValue(
        GetFixedTimestamp() - 1
      );
      subscriptionModule.SkipMissedCycle.mockResolvedValue(claimed as never);
      subscriptionModule.CreateCycleInvoice.mockResolvedValue({
        id: 'in_z_missed',
        status: 'open',
      } as never);

      const result = await module.Run({ batchSize: 10 });

      expect(invoiceModule.VoidInvoice).toHaveBeenCalledTimes(12);
      expect(subscriptionModule.CreateCycleInvoice).not.toHaveBeenCalledWith(
        PLATFORM,
        SUB_ID,
        { finalize: true, collect: true }
      );
      expect(subscriptionModule.ReleaseBillingLock).toHaveBeenCalledWith(
        SUB_ID
      );
      expect(result).toMatchObject({ skipped: 1, failed: 0 });
    });
  });

  it('charges a subscription at most once per run', async () => {
    const now = GetFixedTimestamp();
    DueSubscription({ status: 'past_due' });
    mockDb.Query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: INVOICE_ID,
          status: 'open',
          attempt_count: 1,
          next_payment_attempt: now - 1,
          parent: { subscription_details: { subscription: SUB_ID } },
          metadata: {},
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'si_z_1',
          subscription: SUB_ID,
          current_period_end: now - 10,
          platform_account: PLATFORM,
        },
      ]);
    invoiceModule.PayInvoice.mockResolvedValue({
      id: INVOICE_ID,
      status: 'open',
      attempt_count: 2,
      metadata: { last_payment_error: 'insufficient funds' },
    } as never);

    await module.Run({ batchSize: 10 });

    expect(invoiceModule.PayInvoice).toHaveBeenCalledTimes(1);
    expect(subscriptionModule.CreateCycleInvoice).not.toHaveBeenCalled();
    expect(subscriptionModule.ClaimForBilling).toHaveBeenCalledTimes(1);
  });

  describe('on-chain pauses', () => {
    it('pauses collection, without a billing failure, when the chain says paused', async () => {
      DueSubscription();
      subscriptionModule.CreateCycleInvoice.mockResolvedValue({
        id: INVOICE_ID,
        status: 'open',
        attempt_count: 0,
        metadata: {
          last_payment_error: 'The subscription is paused on-chain',
          last_payment_error_code: 'paused_on_chain',
        },
      } as never);

      const result = await module.Run({ batchSize: 10 });

      expect(subscriptionModule.PauseCollectionOnChain).toHaveBeenCalledWith(
        SUB_ID
      );
      expect(subscriptionModule.MarkSubscriptionPastDue).not.toHaveBeenCalled();
      expect(result).toMatchObject({ skipped: 1, failed: 0 });
    });

    it('lifts its own pause and collects at once when the chain resumes', async () => {
      const claimed = DueSubscription({
        pause_collection: { behavior: 'keep_as_draft', resumes_at: null },
        paused_on_chain: true,
      });
      settlement.GetSubscriptionStatus.mockResolvedValue('active');
      subscriptionModule.ResumeCollectionFromChain.mockResolvedValue({
        ...claimed,
        pause_collection: null,
        paused_on_chain: false,
      } as never);
      subscriptionModule.CreateCycleInvoice.mockResolvedValue({
        id: INVOICE_ID,
        status: 'paid',
        attempt_count: 1,
      } as never);

      const result = await module.Run({ batchSize: 10 });

      expect(settlement.GetSubscriptionStatus).toHaveBeenCalledWith(
        'SubOnchain111'
      );
      expect(subscriptionModule.ResumeCollectionFromChain).toHaveBeenCalledWith(
        SUB_ID
      );
      expect(subscriptionModule.CreateCycleInvoice).toHaveBeenCalledWith(
        PLATFORM,
        SUB_ID,
        { finalize: true, collect: true }
      );
      expect(result.succeeded).toBe(1);
    });

    it.each(['paused', 'canceled'] as const)(
      'keeps its pause while the chain says %s',
      async (status) => {
        DueSubscription({
          pause_collection: { behavior: 'keep_as_draft', resumes_at: null },
          paused_on_chain: true,
        });
        settlement.GetSubscriptionStatus.mockResolvedValue(status);

        const result = await module.Run({ batchSize: 10 });

        expect(
          subscriptionModule.ResumeCollectionFromChain
        ).not.toHaveBeenCalled();
        expect(subscriptionModule.CreateCycleInvoice).not.toHaveBeenCalled();
        expect(subscriptionModule.ReleaseBillingLock).toHaveBeenCalledWith(
          SUB_ID
        );
        expect(result).toMatchObject({ skipped: 1, failed: 0 });
      }
    );

    it('keeps its pause, without a failure, when the chain cannot be read', async () => {
      DueSubscription({
        pause_collection: { behavior: 'keep_as_draft', resumes_at: null },
        paused_on_chain: true,
      });
      settlement.GetSubscriptionStatus.mockRejectedValue(new Error('down'));

      const result = await module.Run({ batchSize: 10 });

      expect(subscriptionModule.MarkSubscriptionPastDue).not.toHaveBeenCalled();
      expect(subscriptionModule.ReleaseBillingLock).toHaveBeenCalledWith(
        SUB_ID
      );
      expect(result).toMatchObject({ skipped: 1, failed: 0 });
    });

    it('never lifts a pause the merchant set', async () => {
      DueSubscription({
        pause_collection: { behavior: 'void', resumes_at: null },
      });

      const result = await module.Run({ batchSize: 10 });

      expect(settlement.GetSubscriptionStatus).not.toHaveBeenCalled();
      expect(subscriptionModule.CreateCycleInvoice).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });
  });

  it('marks the subscription past_due when the allowance is exhausted', async () => {
    DueSubscription();
    subscriptionModule.CreateCycleInvoice.mockResolvedValue({
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

  it('should create a cycle invoice for a due subscription and advance on pay', async () => {
    const now = GetFixedTimestamp();
    mockDb.Query = jest
      .fn()
      .mockResolvedValueOnce([]) // retry invoices
      .mockResolvedValueOnce([
        {
          id: 'si_z_1',
          subscription: SUB_ID,
          current_period_end: now - 10,
          platform_account: PLATFORM,
        },
      ])
      .mockResolvedValueOnce([]); // open cycle invoices

    const claimed = {
      id: SUB_ID,
      platform_account: PLATFORM,
      status: 'active',
      collection_method: 'charge_automatically',
      subscription_onchain_id: 'SubPda111',
      pause_collection: null,
      items: {
        object: 'list',
        data: [
          {
            id: 'si_z_1',
            current_period_start: now - 1000,
            current_period_end: now - 10,
          },
        ],
      },
    };

    subscriptionModule.ClaimForBilling.mockResolvedValue(claimed as never);
    subscriptionModule.CreateCycleInvoice.mockResolvedValue({
      id: INVOICE_ID,
      status: 'paid',
      attempt_count: 1,
    } as never);
    subscriptionModule.AdvanceSubscriptionPeriod.mockResolvedValue(
      claimed as never
    );

    const result = await module.Run({ batchSize: 10 });

    expect(subscriptionModule.CreateCycleInvoice).toHaveBeenCalledWith(
      PLATFORM,
      SUB_ID,
      { finalize: true, collect: true }
    );
    expect(subscriptionModule.AdvanceSubscriptionPeriod).toHaveBeenCalledWith(
      SUB_ID,
      INVOICE_ID
    );
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('should retry an open invoice when next_payment_attempt is due', async () => {
    const now = GetFixedTimestamp();
    mockDb.Query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: INVOICE_ID,
          status: 'open',
          attempt_count: 1,
          next_payment_attempt: now - 1,
          parent: {
            subscription_details: { subscription: SUB_ID },
          },
          metadata: {},
        },
      ])
      .mockResolvedValueOnce([]); // no further due items

    const claimed = {
      id: SUB_ID,
      platform_account: PLATFORM,
      status: 'past_due',
      collection_method: 'charge_automatically',
      subscription_onchain_id: 'SubPda111',
      items: { object: 'list', data: [] },
    };

    subscriptionModule.ClaimForBilling.mockResolvedValue(claimed as never);
    invoiceModule.PayInvoice.mockResolvedValue({
      id: INVOICE_ID,
      status: 'paid',
      attempt_count: 2,
    } as never);
    subscriptionModule.AdvanceSubscriptionPeriod.mockResolvedValue(
      claimed as never
    );

    const result = await module.Run({ batchSize: 10 });

    expect(invoiceModule.PayInvoice).toHaveBeenCalledWith(INVOICE_ID);
    expect(subscriptionModule.AdvanceSubscriptionPeriod).toHaveBeenCalled();
    expect(result.succeeded).toBe(1);
  });

  it('should mark unpaid after max payment attempts', async () => {
    const now = GetFixedTimestamp();
    mockDb.Query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: INVOICE_ID,
          status: 'open',
          attempt_count: 3,
          next_payment_attempt: now - 1,
          parent: {
            subscription_details: { subscription: SUB_ID },
          },
          metadata: { last_payment_error: 'insufficient funds' },
        },
      ])
      .mockResolvedValueOnce([]);

    const claimed = {
      id: SUB_ID,
      platform_account: PLATFORM,
      status: 'past_due',
      collection_method: 'charge_automatically',
      subscription_onchain_id: 'SubPda111',
      items: { object: 'list', data: [] },
    };

    subscriptionModule.ClaimForBilling.mockResolvedValue(claimed as never);
    invoiceModule.PayInvoice.mockResolvedValue({
      id: INVOICE_ID,
      status: 'open',
      attempt_count: 4,
      metadata: { last_payment_error: 'insufficient funds' },
    } as never);
    invoiceModule.MarkInvoiceUncollectible.mockResolvedValue({
      id: INVOICE_ID,
      status: 'uncollectible',
    } as never);
    subscriptionModule.MarkSubscriptionUnpaid.mockResolvedValue(
      claimed as never
    );

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

  it('should skip when claim lock is already held', async () => {
    const now = GetFixedTimestamp();
    mockDb.Query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'si_z_1',
          subscription: SUB_ID,
          current_period_end: now - 10,
          platform_account: PLATFORM,
        },
      ]);

    subscriptionModule.ClaimForBilling.mockResolvedValue(null);

    const result = await module.Run({ batchSize: 10 });

    expect(subscriptionModule.CreateCycleInvoice).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(0);
  });

  it('should finalize cancel_at_period_end instead of renewing', async () => {
    const now = GetFixedTimestamp();
    mockDb.Query = jest
      .fn()
      .mockResolvedValueOnce([]) // retry invoices
      .mockResolvedValueOnce([
        {
          id: 'si_z_1',
          subscription: SUB_ID,
          current_period_end: now - 10,
          platform_account: PLATFORM,
        },
      ])
      .mockResolvedValueOnce([]); // open cycle invoices

    const claimed = {
      id: SUB_ID,
      platform_account: PLATFORM,
      status: 'active',
      collection_method: 'charge_automatically',
      subscription_onchain_id: 'SubPda111',
      pause_collection: null,
      cancel_at_period_end: true,
      cancel_at: now - 10,
      items: {
        object: 'list',
        data: [
          {
            id: 'si_z_1',
            current_period_start: now - 1000,
            current_period_end: now - 10,
          },
        ],
      },
    };

    subscriptionModule.ClaimForBilling.mockResolvedValue(claimed as never);
    subscriptionModule.FinalizeCancelAtPeriodEnd.mockResolvedValue({
      ...claimed,
      status: 'canceled',
      ended_at: now,
      cancel_at_period_end: false,
    } as never);

    const result = await module.Run({ batchSize: 10 });

    expect(subscriptionModule.FinalizeCancelAtPeriodEnd).toHaveBeenCalledWith(
      SUB_ID
    );
    expect(subscriptionModule.CreateCycleInvoice).not.toHaveBeenCalled();
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
  });
});
