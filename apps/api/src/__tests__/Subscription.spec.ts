import { SubscriptionModule } from '../modules/Subscription';
import { Database } from '../modules/Database';
import { EventService } from '../modules/EventService';
import { CustomerModule } from '../modules/Customer';
import { PriceModule } from '../modules/Price';
import { InvoiceModule } from '../modules/Invoice';
import { ListHelper } from '../utils/ListHelper';
import {
  CreateMockDatabase,
  DeterministicId,
  ResetIdCounter,
  GetFixedTimestamp,
} from './Setup';
import {
  CreateMockSettlement,
  MOCK_CANCEL_HASH,
  MOCK_SUBSCRIPTION_ID,
} from './mocks/Settlement';

jest.mock('../modules/Database');
jest.mock('../utils/IdGenerator', () => ({
  GenerateId: jest.fn((prefix: string) => DeterministicId(prefix)),
}));
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
const CUSTOMER_ID = 'cus_z_1';
const PRICE_ID = 'price_z_1';

function MockCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: CUSTOMER_ID,
    object: 'customer',
    platform_account: PLATFORM,
    email: 'jennyrosen@example.com',
    name: 'Jenny Rosen',
    phone: null,
    address: null,
    shipping: null,
    tax_exempt: 'none',
    ...overrides,
  };
}

function MockRecurringPrice(overrides: Record<string, unknown> = {}) {
  return {
    id: PRICE_ID,
    object: 'price',
    platform_account: PLATFORM,
    product: 'prod_z_1',
    unit_amount: 2000,
    unit_amount_decimal: '2000',
    currency: 'usdc',
    type: 'recurring',
    recurring: {
      interval: 'month',
      interval_count: 1,
      trial_period_days: null,
      usage_type: 'licensed',
      meter: null,
    },
    subscription_plan_id: null,
    ...overrides,
  };
}

describe('SubscriptionModule', () => {
  let module: SubscriptionModule;
  let mockDb: jest.Mocked<Database>;
  let eventService: jest.Mocked<EventService>;
  let customerModule: jest.Mocked<CustomerModule>;
  let priceModule: jest.Mocked<PriceModule>;
  let invoiceModule: jest.Mocked<InvoiceModule>;
  let store: Map<string, Record<string, unknown>>;

  function StoreKey(collection: string, id: string): string {
    return `${collection}:${id}`;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    ResetIdCounter();
    store = new Map();

    mockDb = CreateMockDatabase();
    mockDb.Set = jest.fn(async (_collection, id, doc) => {
      store.set(StoreKey(_collection, id), {
        ...(doc as Record<string, unknown>),
      });
      return doc;
    }) as typeof mockDb.Set;
    mockDb.Get = jest.fn(async (_collection, id) => {
      return (store.get(StoreKey(_collection, id)) ?? null) as never;
    }) as typeof mockDb.Get;
    mockDb.Update = jest.fn(async (_collection, id, patch) => {
      const existing = store.get(StoreKey(_collection, id)) ?? {};
      const next = {
        ...existing,
        ...(patch as Record<string, unknown>),
      };
      store.set(StoreKey(_collection, id), next);
      return next as never;
    }) as typeof mockDb.Update;
    mockDb.Delete = jest.fn(async (_collection, id) => {
      store.delete(StoreKey(_collection, id));
      return { deletedCount: 1 };
    }) as typeof mockDb.Delete;
    mockDb.Query = jest.fn(async (options) => {
      const prefix = `${options.collection}:`;
      return [...store.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([, value]) => value) as never;
    }) as typeof mockDb.Query;

    eventService = {
      Emit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventService>;

    customerModule = {
      GetCustomer: jest.fn().mockResolvedValue(MockCustomer()),
    } as unknown as jest.Mocked<CustomerModule>;

    priceModule = {
      GetPrice: jest.fn().mockResolvedValue(MockRecurringPrice()),
      CreatePrice: jest.fn(),
    } as unknown as jest.Mocked<PriceModule>;

    invoiceModule = {
      CreateSubscriptionInvoice: jest.fn().mockResolvedValue({
        id: 'in_z_1',
        object: 'invoice',
        status: 'paid',
        billing_reason: 'subscription_create',
        parent: {
          type: 'subscription_details',
          subscription_details: { subscription: 'sub_z_test001' },
        },
      }),
      GetInvoice: jest.fn(),
      DeleteInvoice: jest.fn(),
      VoidInvoice: jest.fn(),
    } as unknown as jest.Mocked<InvoiceModule>;

    module = new SubscriptionModule(
      mockDb,
      eventService,
      customerModule,
      priceModule,
      invoiceModule
    );
  });

  describe('CreateSubscription', () => {
    it('should create subscription items, invoice, and emit customer.subscription.created', async () => {
      const subscription = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      expect(subscription.object).toBe('subscription');
      expect(subscription.customer).toBe(CUSTOMER_ID);
      expect(subscription.currency).toBe('usdc');
      expect(subscription.status).toBe('active');
      expect(subscription.latest_invoice).toBe('in_z_1');
      expect(subscription.platform_account).toBe(PLATFORM);
      expect(subscription.subscription_onchain_id).toBeNull();
      expect(subscription.items.data).toHaveLength(1);
      expect(subscription.items.data[0].price).toBe(PRICE_ID);
      expect(subscription.items.data[0].quantity).toBe(1);
      expect(subscription.items.url).toContain(subscription.id);

      expect(mockDb.Set).toHaveBeenCalledWith(
        'Subscriptions',
        subscription.id,
        expect.objectContaining({ id: subscription.id })
      );
      expect(invoiceModule.CreateSubscriptionInvoice).toHaveBeenCalledWith(
        PLATFORM,
        expect.objectContaining({
          customer: CUSTOMER_ID,
          subscription: subscription.id,
          billing_reason: 'subscription_create',
          finalize: true,
          collect: true,
          lineItems: [
            expect.objectContaining({
              price: PRICE_ID,
              quantity: 1,
            }),
          ],
        })
      );
      expect(eventService.Emit).toHaveBeenCalledWith(
        'customer.subscription.created',
        PLATFORM,
        expect.objectContaining({ id: subscription.id })
      );
    });

    it('should skip invoicing and set trialing when trial_period_days is set', async () => {
      const subscription = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
        trial_period_days: 14,
      });

      expect(subscription.status).toBe('trialing');
      expect(subscription.trial_start).toBe(GetFixedTimestamp());
      expect(subscription.trial_end).toBe(
        GetFixedTimestamp() + 14 * 24 * 60 * 60
      );
      expect(subscription.latest_invoice).toBeNull();
      expect(invoiceModule.CreateSubscriptionInvoice).not.toHaveBeenCalled();
      expect(eventService.Emit).toHaveBeenCalledWith(
        'customer.subscription.created',
        PLATFORM,
        expect.objectContaining({ id: subscription.id })
      );
      expect(eventService.Emit).not.toHaveBeenCalledWith(
        'customer.subscription.trial_will_end',
        expect.anything(),
        expect.anything()
      );
    });

    it('should emit trial_will_end when fewer than three days remain', async () => {
      const trialEnd = GetFixedTimestamp() + 2 * 24 * 60 * 60;
      const subscription = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
        trial_end: trialEnd,
      });

      expect(subscription.status).toBe('trialing');
      expect(eventService.Emit).toHaveBeenCalledWith(
        'customer.subscription.trial_will_end',
        PLATFORM,
        expect.objectContaining({ id: subscription.id })
      );
    });

    it('should finalize without collecting when payment_behavior is default_incomplete', async () => {
      invoiceModule.CreateSubscriptionInvoice = jest.fn().mockResolvedValue({
        id: 'in_z_open',
        object: 'invoice',
        status: 'open',
      });

      const subscription = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
        payment_behavior: 'default_incomplete',
      });

      expect(subscription.status).toBe('incomplete');
      expect(subscription.latest_invoice).toBe('in_z_open');
      expect(invoiceModule.CreateSubscriptionInvoice).toHaveBeenCalledWith(
        PLATFORM,
        expect.objectContaining({
          finalize: true,
          collect: false,
        })
      );
    });

    it('should reject customers that do not belong to the platform', async () => {
      customerModule.GetCustomer = jest.fn().mockResolvedValue({
        id: CUSTOMER_ID,
        platform_account: 'acct_z_other',
      });

      await expect(
        module.CreateSubscription(PLATFORM, {
          customer: CUSTOMER_ID,
          items: [{ price: PRICE_ID }],
        })
      ).rejects.toThrow('Customer not found');
    });

    it('should reject one-time prices', async () => {
      priceModule.GetPrice = jest.fn().mockResolvedValue(
        MockRecurringPrice({
          type: 'one_time',
          recurring: null,
        })
      );

      await expect(
        module.CreateSubscription(PLATFORM, {
          customer: CUSTOMER_ID,
          items: [{ price: PRICE_ID }],
        })
      ).rejects.toThrow('Subscription items require a recurring price');
    });

    it('should reject unsupported currencies', async () => {
      await expect(
        module.CreateSubscription(PLATFORM, {
          customer: CUSTOMER_ID,
          items: [{ price: PRICE_ID }],
          currency: 'usd',
        })
      ).rejects.toThrow("Currency 'usd' is not supported");
    });
  });

  describe('UpdateSubscription', () => {
    it('should update metadata and emit customer.subscription.updated', async () => {
      const created = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      const updated = await module.UpdateSubscription(created.id, {
        metadata: { order_id: '6735' },
      });

      expect(updated.metadata).toEqual({ order_id: '6735' });
      expect(mockDb.Update).toHaveBeenCalledWith(
        'Subscriptions',
        created.id,
        expect.objectContaining({ metadata: { order_id: '6735' } })
      );
      expect(eventService.Emit).toHaveBeenCalledWith(
        'customer.subscription.updated',
        PLATFORM,
        expect.objectContaining({ id: created.id }),
        expect.objectContaining({ previousAttributes: expect.any(Object) })
      );
    });

    it('should schedule cancel at period end without changing status', async () => {
      const created = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });
      const periodEnd = created.items.data[0].current_period_end;

      const updated = await module.UpdateSubscription(created.id, {
        cancel_at_period_end: true,
      });

      expect(updated.status).toBe('active');
      expect(updated.cancel_at_period_end).toBe(true);
      expect(updated.cancel_at).toBe(periodEnd);
      expect(updated.canceled_at).toBe(GetFixedTimestamp());
      expect(updated.cancellation_details?.reason).toBe(
        'cancellation_requested'
      );
      expect(updated.ended_at).toBeNull();
    });

    it('should clear scheduled cancel when cancel_at_period_end is false', async () => {
      const created = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      await module.UpdateSubscription(created.id, {
        cancel_at_period_end: true,
      });

      const resumed = await module.UpdateSubscription(created.id, {
        cancel_at_period_end: false,
      });

      expect(resumed.status).toBe('active');
      expect(resumed.cancel_at_period_end).toBe(false);
      expect(resumed.cancel_at).toBeNull();
      expect(resumed.canceled_at).toBeNull();
      expect(resumed.cancellation_details?.reason).toBeNull();
    });
  });

  describe('CancelSubscription', () => {
    it('should cancel immediately and emit deleted', async () => {
      const created = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      const canceled = await module.CancelSubscription(created.id, {
        cancellation_details: { feedback: 'too_expensive' },
      });

      expect(canceled.status).toBe('canceled');
      expect(canceled.canceled_at).toBe(GetFixedTimestamp());
      expect(canceled.ended_at).toBe(GetFixedTimestamp());
      expect(canceled.cancel_at).toBeNull();
      expect(canceled.cancel_at_period_end).toBe(false);
      expect(canceled.cancellation_details?.feedback).toBe('too_expensive');
      expect(canceled.cancellation_details?.reason).toBe(
        'cancellation_requested'
      );
      expect(eventService.Emit).toHaveBeenCalledWith(
        'customer.subscription.deleted',
        PLATFORM,
        expect.objectContaining({ id: created.id })
      );
    });

    it('should reject already canceled subscriptions', async () => {
      const created = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      await module.CancelSubscription(created.id, {});

      await expect(module.CancelSubscription(created.id, {})).rejects.toThrow(
        'Subscription is already canceled'
      );
    });

    it('should create a final invoice when invoice_now is true', async () => {
      const created = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      invoiceModule.CreateSubscriptionInvoice = jest.fn().mockResolvedValue({
        id: 'in_z_final',
        object: 'invoice',
        status: 'paid',
      });

      const canceled = await module.CancelSubscription(created.id, {
        invoice_now: true,
      });

      expect(invoiceModule.CreateSubscriptionInvoice).toHaveBeenCalledWith(
        PLATFORM,
        expect.objectContaining({
          billing_reason: 'subscription_update',
          finalize: true,
          collect: true,
        })
      );
      expect(canceled.latest_invoice).toBe('in_z_final');
    });
  });

  describe('FinalizeCancelAtPeriodEnd', () => {
    it('should mark canceled and emit deleted', async () => {
      const created = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      await module.UpdateSubscription(created.id, {
        cancel_at_period_end: true,
      });

      const finalized = await module.FinalizeCancelAtPeriodEnd(created.id);

      expect(finalized.status).toBe('canceled');
      expect(finalized.ended_at).toBe(GetFixedTimestamp());
      expect(finalized.cancel_at_period_end).toBe(false);
      expect(eventService.Emit).toHaveBeenCalledWith(
        'customer.subscription.deleted',
        PLATFORM,
        expect.objectContaining({ id: created.id })
      );
    });
  });

  describe('MigrateSubscription', () => {
    it('should set billing_mode to flexible and emit updated', async () => {
      const created = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      const migrated = await module.MigrateSubscription(created.id, {
        billing_mode: { type: 'flexible' },
      });

      expect(migrated.billing_mode.type).toBe('flexible');
      expect(migrated.billing_mode.updated_at).toBe(GetFixedTimestamp());
      expect(eventService.Emit).toHaveBeenCalledWith(
        'customer.subscription.updated',
        PLATFORM,
        expect.objectContaining({ id: created.id }),
        expect.objectContaining({ previousAttributes: expect.any(Object) })
      );
    });
  });

  describe('ResumeSubscription', () => {
    it('should reject non-paused subscriptions', async () => {
      const created = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      await expect(module.ResumeSubscription(created.id, {})).rejects.toThrow(
        'Only paused subscriptions can be resumed'
      );
    });

    it('should invoice, activate, and emit resumed when paused', async () => {
      const created = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      await mockDb.Update('Subscriptions', created.id, { status: 'paused' });

      invoiceModule.CreateSubscriptionInvoice = jest.fn().mockResolvedValue({
        id: 'in_z_resume',
        object: 'invoice',
        status: 'paid',
      });

      const resumed = await module.ResumeSubscription(created.id, {
        billing_cycle_anchor: 'now',
      });

      expect(resumed.status).toBe('active');
      expect(resumed.latest_invoice).toBe('in_z_resume');
      expect(invoiceModule.CreateSubscriptionInvoice).toHaveBeenCalledWith(
        PLATFORM,
        expect.objectContaining({
          billing_reason: 'subscription_update',
          finalize: true,
          collect: true,
        })
      );
      expect(eventService.Emit).toHaveBeenCalledWith(
        'customer.subscription.resumed',
        PLATFORM,
        expect.objectContaining({ id: created.id })
      );
    });
  });

  describe('ListSubscriptions', () => {
    it('should list via ListHelper and attach items', async () => {
      const created = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      const listSpy = jest
        .spyOn(ListHelper.prototype, 'List')
        .mockResolvedValue({
          object: 'list',
          data: [store.get(StoreKey('Subscriptions', created.id)) as never],
          has_more: false,
          url: '/v1/subscriptions',
        });

      const result = await module.ListSubscriptions({
        account: PLATFORM,
        limit: 10,
      });

      expect(listSpy).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].items.data).toHaveLength(1);
      listSpy.mockRestore();
    });
  });

  describe('GetSubscription', () => {
    it('should return null when missing', async () => {
      await expect(module.GetSubscription('sub_missing')).resolves.toBeNull();
    });
  });

  describe('SetSubscriptionOnchainId', () => {
    it('should persist the on-chain subscription id', async () => {
      const subscription = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      const updated = await module.SetSubscriptionOnchainId(
        subscription.id,
        'SubOnchain111'
      );

      expect(mockDb.Update).toHaveBeenCalledWith(
        'Subscriptions',
        subscription.id,
        { subscription_onchain_id: 'SubOnchain111' }
      );
      expect(updated.subscription_onchain_id).toBe('SubOnchain111');
    });
  });

  describe('on-chain subscriptions', () => {
    const MONTH = 30 * 24 * 3600;
    let settlement: ReturnType<typeof CreateMockSettlement>;

    beforeEach(() => {
      settlement = CreateMockSettlement();
      Object.assign(invoiceModule, {
        ListOpenSubscriptionInvoices: jest.fn().mockResolvedValue([]),
        ScheduleOpenSubscriptionInvoices: jest
          .fn()
          .mockResolvedValue(undefined),
      });
      module = new SubscriptionModule(
        mockDb,
        eventService,
        customerModule,
        priceModule,
        invoiceModule,
        settlement
      );
    });

    function CreateOnchain(periodStart?: number) {
      return module.CreateSubscription(
        PLATFORM,
        { customer: CUSTOMER_ID, items: [{ price: PRICE_ID }] },
        { subscriptionOnchainId: MOCK_SUBSCRIPTION_ID, periodStart }
      );
    }

    function Stored(id: string) {
      return store.get(`Subscriptions:${id}`) as Record<string, unknown>;
    }

    it('stores the on-chain id at create and anchors the first period on the chain grid', async () => {
      const periodStart = GetFixedTimestamp() - 12;

      const created = await CreateOnchain(periodStart);

      expect(created.subscription_onchain_id).toBe(MOCK_SUBSCRIPTION_ID);
      expect(created.items.data[0]).toMatchObject({
        current_period_start: periodStart,
        current_period_end: periodStart + MONTH,
      });
      expect(Stored(created.id)).toMatchObject({
        subscription_onchain_id: MOCK_SUBSCRIPTION_ID,
        paused_on_chain: false,
        cancel_pending_on_chain: false,
      });
    });

    it('fails a second live subscription for the same on-chain subscription and leaves no items behind', async () => {
      mockDb.Set = jest.fn(async (collection, id, doc) => {
        if (collection === 'Subscriptions') {
          throw Object.assign(new Error('E11000 duplicate key'), {
            code: 11000,
          });
        }
        store.set(`${collection}:${id}`, { ...(doc as object) });
        return doc;
      }) as typeof mockDb.Set;

      await expect(CreateOnchain()).rejects.toMatchObject({ statusCode: 409 });
      expect(
        [...store.keys()].filter((key) => key.startsWith('SubscriptionItems:'))
      ).toEqual([]);
    });

    it.each([
      ['two items', [{ price: PRICE_ID }, { price: PRICE_ID }]],
      ['quantity 2', [{ price: PRICE_ID, quantity: 2 }]],
    ])(
      'refuses %s on an on-chain subscription with onchain_plan_amount_exceeded',
      async (_label, items) => {
        await expect(
          module.CreateSubscription(
            PLATFORM,
            { customer: CUSTOMER_ID, items },
            { subscriptionOnchainId: MOCK_SUBSCRIPTION_ID }
          )
        ).rejects.toMatchObject({
          statusCode: 400,
          type: 'invalid_request_error',
          details: { code: 'onchain_plan_amount_exceeded' },
        });
      }
    );

    it('refuses item changes that would raise what the plan collects', async () => {
      const created = await CreateOnchain();
      const itemId = created.items.data[0].id;
      const refused = {
        statusCode: 400,
        details: { code: 'onchain_plan_amount_exceeded' },
      };

      await expect(
        module.UpdateSubscription(created.id, {
          items: [{ id: itemId, quantity: 3 }],
        })
      ).rejects.toMatchObject(refused);
      await expect(
        module.UpdateSubscription(created.id, {
          items: [{ price: PRICE_ID }],
        })
      ).rejects.toMatchObject(refused);
      await expect(
        module.CreateSubscriptionItem(PLATFORM, {
          subscription: created.id,
          price: PRICE_ID,
        })
      ).rejects.toMatchObject(refused);
      await expect(
        module.DeleteSubscriptionItem(itemId, {}, PLATFORM)
      ).rejects.toMatchObject(refused);
      // Quantity 1 is still fine.
      await expect(
        module.UpdateSubscription(created.id, {
          items: [{ id: itemId, quantity: 1 }],
        })
      ).resolves.toMatchObject({ id: created.id });
    });

    it('on cancel, sends the on-chain cancel without waiting and records its hash', async () => {
      const created = await CreateOnchain();

      const canceled = await module.CancelSubscription(created.id, {});

      expect(settlement.CancelSubscription).toHaveBeenCalledWith(
        MOCK_SUBSCRIPTION_ID,
        expect.objectContaining({ pendingHash: null })
      );
      expect(canceled.status).toBe('canceled');
      expect(Stored(created.id)).toMatchObject({
        cancel_pending_on_chain: true,
        cancel_pending_transaction_hash: MOCK_CANCEL_HASH,
        cancel_pending_sent_at: GetFixedTimestamp(),
      });
    });

    it('follows the recorded cancel with its send time, for re-pricing', async () => {
      const created = await CreateOnchain();
      await module.CancelSubscription(created.id, {});

      await module.SendOnchainCancel(created.id);

      expect(settlement.CancelSubscription).toHaveBeenLastCalledWith(
        MOCK_SUBSCRIPTION_ID,
        expect.objectContaining({
          pendingHash: MOCK_CANCEL_HASH,
          sentAt: GetFixedTimestamp(),
        })
      );
    });

    it('keeps the cancel pending when the on-chain cancel fails, for the runner to retry', async () => {
      const created = await CreateOnchain();
      settlement.CancelSubscription.mockRejectedValue(new Error('node down'));

      await expect(
        module.CancelSubscription(created.id, {})
      ).resolves.toMatchObject({ status: 'canceled' });
      expect(Stored(created.id)).toMatchObject({
        cancel_pending_on_chain: true,
      });
    });

    it('clears the pending cancel once nothing is left to cancel on-chain', async () => {
      const created = await CreateOnchain();
      await module.CancelSubscription(created.id, {});
      settlement.CancelSubscription.mockResolvedValue(null);

      await module.SendOnchainCancel(created.id);

      expect(settlement.CancelSubscription).toHaveBeenLastCalledWith(
        MOCK_SUBSCRIPTION_ID,
        expect.objectContaining({ pendingHash: MOCK_CANCEL_HASH })
      );
      expect(Stored(created.id)).toMatchObject({
        status: 'canceled',
        cancel_pending_on_chain: false,
        cancel_pending_transaction_hash: null,
        cancel_pending_sent_at: null,
      });
    });

    it('leaves the chain alone for a subscription without an on-chain id', async () => {
      const created = await module.CreateSubscription(PLATFORM, {
        customer: CUSTOMER_ID,
        items: [{ price: PRICE_ID }],
      });

      await module.CancelSubscription(created.id, {});

      expect(settlement.CancelSubscription).not.toHaveBeenCalled();
      expect(Stored(created.id)).toMatchObject({
        cancel_pending_on_chain: false,
      });
    });

    it('sends the on-chain cancel when a scheduled cancel takes effect', async () => {
      const created = await CreateOnchain();

      await module.FinalizeCancelAtPeriodEnd(created.id);

      expect(settlement.CancelSubscription).toHaveBeenCalledWith(
        MOCK_SUBSCRIPTION_ID,
        expect.anything()
      );
    });

    it('cancels for good when the chain says canceled: voids open invoices, no dunning', async () => {
      const created = await CreateOnchain();
      jest
        .mocked(invoiceModule.ListOpenSubscriptionInvoices)
        .mockResolvedValue([{ id: 'in_z_open' }] as never);

      const canceled = await module.CancelFromChain(created.id);

      expect(invoiceModule.VoidInvoice).toHaveBeenCalledWith('in_z_open');
      expect(canceled).toMatchObject({
        status: 'canceled',
        canceled_at: GetFixedTimestamp(),
        cancellation_details: {
          reason: 'cancellation_requested',
          comment: 'canceled_on_chain',
        },
        billing_lock_until: null,
      });
      expect(eventService.Emit).toHaveBeenCalledWith(
        'customer.subscription.deleted',
        PLATFORM,
        expect.objectContaining({ id: created.id })
      );
      // Like the API cancel: no `updated` before the `deleted`.
      expect(
        jest.mocked(eventService.Emit).mock.calls.map(([type]) => type)
      ).not.toContain('customer.subscription.updated');
      expect(settlement.CancelSubscription).not.toHaveBeenCalled();

      // Again: nothing more happens.
      jest.mocked(eventService.Emit).mockClear();
      jest.mocked(invoiceModule.VoidInvoice).mockClear();
      await module.CancelFromChain(created.id);
      expect(invoiceModule.VoidInvoice).not.toHaveBeenCalled();
      expect(eventService.Emit).not.toHaveBeenCalled();
    });

    it('aligns to an on-chain cycle without paying it, keeping status and billing lock', async () => {
      const created = await CreateOnchain();
      await mockDb.Update('Subscriptions', created.id, {
        billing_lock_until: GetFixedTimestamp() + 300,
        status: 'past_due',
      });
      const period = {
        start: GetFixedTimestamp() + 2 * MONTH,
        end: GetFixedTimestamp() + 3 * MONTH,
      };

      const aligned = await module.AlignToCycle(created.id, period);

      expect(aligned.items.data[0]).toMatchObject({
        current_period_start: period.start,
        current_period_end: period.end,
      });
      expect(aligned).toMatchObject({
        status: 'past_due',
        billing_lock_until: GetFixedTimestamp() + 300,
      });
    });

    it('advances to the period the on-chain charge paid', async () => {
      const created = await CreateOnchain();
      const period = { start: 1_700_100_000, end: 1_700_100_000 + MONTH };

      const advanced = await module.AdvanceSubscriptionPeriod(
        created.id,
        'in_z_paid',
        period
      );

      expect(advanced.items.data[0]).toMatchObject({
        current_period_start: period.start,
        current_period_end: period.end,
      });
      expect(advanced).toMatchObject({
        status: 'active',
        latest_invoice: 'in_z_paid',
      });
    });

    it('pauses collection for a pause on-chain, unschedules its invoices, and lifts only that pause', async () => {
      const created = await CreateOnchain();

      const paused = await module.PauseCollectionOnChain(created.id);

      expect(paused).toMatchObject({
        pause_collection: { behavior: 'keep_as_draft', resumes_at: null },
        paused_on_chain: true,
        billing_lock_until: null,
      });
      expect(
        invoiceModule.ScheduleOpenSubscriptionInvoices
      ).toHaveBeenCalledWith(created.id, null);

      await mockDb.Update('Subscriptions', created.id, {
        billing_lock_until: GetFixedTimestamp() + 300,
      });
      const resumed = await module.ResumeCollectionFromChain(created.id);

      expect(resumed).toMatchObject({
        pause_collection: null,
        paused_on_chain: false,
        billing_lock_until: GetFixedTimestamp() + 300,
      });
      expect(
        invoiceModule.ScheduleOpenSubscriptionInvoices
      ).toHaveBeenLastCalledWith(created.id, GetFixedTimestamp());
    });

    it('hands the pause to the merchant when the merchant sets pause_collection', async () => {
      const created = await CreateOnchain();
      await module.PauseCollectionOnChain(created.id);

      const updated = await module.UpdateSubscription(created.id, {
        pause_collection: { behavior: 'void' },
      });

      expect(updated).toMatchObject({
        pause_collection: { behavior: 'void' },
        paused_on_chain: false,
      });
    });

    it('reads older documents with the new flags defaulted', async () => {
      const created = await CreateOnchain();
      const stored = Stored(created.id);
      delete stored.paused_on_chain;
      delete stored.cancel_pending_on_chain;
      delete stored.cancel_pending_transaction_hash;

      await expect(module.GetSubscription(created.id)).resolves.toMatchObject({
        paused_on_chain: false,
        cancel_pending_on_chain: false,
        cancel_pending_transaction_hash: null,
      });
    });
  });
});
