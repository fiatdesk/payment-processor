import { InvoiceModule } from '../modules/Invoice';
import { Database } from '../modules/Database';
import { EventService } from '../modules/EventService';
import { CustomerModule } from '../modules/Customer';
import { InvoiceItemModule } from '../modules/InvoiceItem';
import { Invoice, InvoiceItem } from '@fiatdesk/shared-types';
import { ListHelper } from '../utils/ListHelper';
import {
  CreateMockDatabase,
  DeterministicId,
  ResetIdCounter,
  GetFixedTimestamp,
} from './Setup';
import { CreateMockSettlement } from './mocks/Settlement';
import { MemoryDatabase } from './mocks/MemoryDatabase';
import {
  CANCELED_ON_CHAIN,
  COLLECTION_FAILED_ALLOWANCE,
  CYCLE_MISSED,
  PAUSED_ON_CHAIN,
  PERIOD_ALREADY_COLLECTED,
} from '../modules/chains/types';
import { AppError } from '../utils/AppError';

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

const PLATFORM = 'acct_fd_platform';
const CUSTOMER_ID = 'cus_fd_1';

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
    tax_ids: { object: 'list', data: [], has_more: false, url: '/v1/tax_ids' },
    balance: 0,
    ...overrides,
  };
}

function DraftInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'in_fd_test001',
    object: 'invoice',
    account_country: null,
    account_name: null,
    account_tax_ids: null,
    amount_due: 1099,
    amount_overpaid: 0,
    amount_paid: 0,
    amount_paid_off_stripe: 0,
    amount_remaining: 1099,
    amount_shipping: 0,
    application: null,
    attempt_count: 0,
    attempted: false,
    auto_advance: false,
    automatic_tax: {
      disabled_reason: null,
      enabled: false,
      liability: null,
      provider: null,
      status: null,
    },
    automatically_finalizes_at: null,
    billing_reason: 'manual',
    collection_method: 'charge_automatically',
    confirmation_secret: null,
    created: GetFixedTimestamp(),
    currency: 'usdc',
    custom_fields: null,
    customer: CUSTOMER_ID,
    customer_account: null,
    customer_address: null,
    customer_email: 'jennyrosen@example.com',
    customer_name: 'Jenny Rosen',
    customer_phone: null,
    customer_shipping: null,
    customer_tax_exempt: 'none',
    customer_tax_ids: [],
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discounts: [],
    due_date: null,
    effective_at: null,
    ending_balance: null,
    footer: null,
    from_invoice: null,
    hosted_invoice_url: null,
    invoice_pdf: null,
    issuer: { type: 'self', account: null },
    last_finalization_error: null,
    latest_revision: null,
    lines: {
      object: 'list',
      data: [],
      has_more: false,
      total_count: 0,
      url: '/v1/invoices/in_fd_test001/lines',
    },
    livemode: false,
    metadata: {},
    next_payment_attempt: null,
    number: null,
    on_behalf_of: null,
    parent: null,
    payment_settings: {
      default_mandate: null,
      payment_method_options: null,
      payment_method_types: null,
    },
    payments: {
      object: 'list',
      data: [],
      has_more: false,
      total_count: 0,
      url: '/v1/invoices/in_fd_test001/payments',
    },
    period_end: GetFixedTimestamp(),
    period_start: GetFixedTimestamp(),
    post_payment_credit_notes_amount: 0,
    pre_payment_credit_notes_amount: 0,
    receipt_number: null,
    rendering: null,
    shipping_cost: null,
    shipping_details: null,
    starting_balance: 0,
    statement_descriptor: null,
    status: 'draft',
    status_transitions: {
      finalized_at: null,
      marked_uncollectible_at: null,
      paid_at: null,
      voided_at: null,
    },
    subtotal: 1099,
    subtotal_excluding_tax: 1099,
    test_clock: null,
    threshold_reason: null,
    total: 1099,
    total_discount_amounts: [],
    total_excluding_tax: 1099,
    total_pretax_credit_amounts: [],
    total_taxes: [],
    transfer_data: null,
    webhooks_delivered_at: GetFixedTimestamp(),
    platform_account: PLATFORM,
    ...overrides,
  } as Invoice;
}

describe('InvoiceModule', () => {
  let module: InvoiceModule;
  let mockDb: jest.Mocked<Database>;
  let eventService: jest.Mocked<EventService>;
  let customerModule: jest.Mocked<CustomerModule>;
  let invoiceItemModule: jest.Mocked<InvoiceItemModule>;

  beforeEach(() => {
    jest.clearAllMocks();
    ResetIdCounter();
    mockDb = CreateMockDatabase();
    eventService = {
      Emit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventService>;
    customerModule = {
      GetCustomer: jest.fn().mockResolvedValue(MockCustomer()),
      ClaimNextInvoiceNumber: jest.fn().mockResolvedValue('TESTPREF-0001'),
    } as unknown as jest.Mocked<CustomerModule>;
    invoiceItemModule = {
      ListAllPendingInvoiceItems: jest.fn().mockResolvedValue([]),
      AttachInvoiceItems: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<InvoiceItemModule>;
    module = new InvoiceModule(
      mockDb,
      eventService,
      customerModule,
      invoiceItemModule
    );
  });

  describe('CreateInvoice', () => {
    it('should persist a draft invoice and emit invoice.created', async () => {
      const invoice = await module.CreateInvoice(PLATFORM, {
        customer: CUSTOMER_ID,
      });

      expect(invoice.object).toBe('invoice');
      expect(invoice.status).toBe('draft');
      expect(invoice.customer).toBe(CUSTOMER_ID);
      expect(invoice.customer_email).toBe('jennyrosen@example.com');
      expect(invoice.customer_name).toBe('Jenny Rosen');
      expect(invoice.currency).toBe('usdc');
      expect(invoice.billing_reason).toBe('manual');
      expect(invoice.collection_method).toBe('charge_automatically');
      expect(invoice.lines.data).toEqual([]);
      expect(invoice.platform_account).toBe(PLATFORM);
      expect(mockDb.Set).toHaveBeenCalledWith('Invoices', invoice.id, invoice);
      expect(eventService.Emit).toHaveBeenCalledWith(
        'invoice.created',
        PLATFORM,
        invoice
      );
      expect(
        invoiceItemModule.ListAllPendingInvoiceItems
      ).not.toHaveBeenCalled();
    });

    it('should leave pending items alone when behavior is exclude (default)', async () => {
      await module.CreateInvoice(PLATFORM, {
        customer: CUSTOMER_ID,
        pending_invoice_items_behavior: 'exclude',
      });

      expect(
        invoiceItemModule.ListAllPendingInvoiceItems
      ).not.toHaveBeenCalled();
      expect(invoiceItemModule.AttachInvoiceItems).not.toHaveBeenCalled();
    });

    it('should include pending invoice items and recalculate totals', async () => {
      const pendingItem = {
        id: 'ii_fd_1',
        object: 'invoiceitem',
        amount: 1099,
        currency: 'usdc',
        created: GetFixedTimestamp(),
        date: GetFixedTimestamp(),
        description: 'My First Invoice Item',
        discountable: true,
        discounts: [],
        invoice: null,
        livemode: false,
        metadata: {},
        period: {
          start: GetFixedTimestamp(),
          end: GetFixedTimestamp(),
        },
        pricing: {
          price_details: null,
          type: 'price_details',
          unit_amount_decimal: '1099',
        },
        proration: false,
        parent: null,
        quantity: 1,
        quantity_decimal: '1',
        platform_account: PLATFORM,
      } as unknown as InvoiceItem;

      invoiceItemModule.ListAllPendingInvoiceItems = jest
        .fn()
        .mockResolvedValue([pendingItem]);
      invoiceItemModule.AttachInvoiceItems = jest
        .fn()
        .mockResolvedValue([{ ...pendingItem, invoice: 'attached' }]);

      const invoice = await module.CreateInvoice(PLATFORM, {
        customer: CUSTOMER_ID,
        pending_invoice_items_behavior: 'include',
      });

      expect(invoiceItemModule.ListAllPendingInvoiceItems).toHaveBeenCalledWith(
        PLATFORM,
        CUSTOMER_ID
      );
      expect(invoiceItemModule.AttachInvoiceItems).toHaveBeenCalledWith(
        ['ii_fd_1'],
        invoice.id
      );
      expect(invoice.lines.data).toHaveLength(1);
      expect(invoice.lines.data[0].amount).toBe(1099);
      expect(invoice.lines.data[0].parent?.type).toBe('invoice_item_details');
      expect(invoice.subtotal).toBe(1099);
      expect(invoice.total).toBe(1099);
      expect(invoice.amount_due).toBe(1099);
      expect(invoice.amount_remaining).toBe(1099);
    });

    it('should reject customers that do not belong to the platform', async () => {
      customerModule.GetCustomer = jest.fn().mockResolvedValue({
        id: CUSTOMER_ID,
        platform_account: 'acct_fd_other',
      });

      await expect(
        module.CreateInvoice(PLATFORM, { customer: CUSTOMER_ID })
      ).rejects.toThrow('Customer not found');
    });

    it('should reject unsupported currencies', async () => {
      await expect(
        module.CreateInvoice(PLATFORM, {
          customer: CUSTOMER_ID,
          currency: 'usd',
        })
      ).rejects.toThrow("Currency 'usd' is not supported");
    });
  });

  describe('UpdateInvoice', () => {
    it('should update metadata and emit invoice.updated with previous attributes', async () => {
      const existing = DraftInvoice({ metadata: {} });
      mockDb.Get = jest
        .fn()
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          metadata: { order_id: '6735' },
        });

      const result = await module.UpdateInvoice(existing.id, {
        metadata: { order_id: '6735' },
      });

      expect(mockDb.Update).toHaveBeenCalledWith(
        'Invoices',
        existing.id,
        expect.objectContaining({ metadata: { order_id: '6735' } })
      );
      expect(eventService.Emit).toHaveBeenCalledWith(
        'invoice.updated',
        PLATFORM,
        result,
        expect.objectContaining({
          previousAttributes: expect.any(Object),
        })
      );
    });

    it('should reject draft-only fields on a finalized invoice', async () => {
      mockDb.Get = jest
        .fn()
        .mockResolvedValue(DraftInvoice({ status: 'open' }));

      await expect(
        module.UpdateInvoice('in_fd_test001', {
          collection_method: 'send_invoice',
        })
      ).rejects.toThrow(
        'Cannot update collection_method on a non-draft invoice'
      );
    });
  });

  describe('DeleteInvoice', () => {
    it('should delete a draft and emit invoice.deleted', async () => {
      const existing = DraftInvoice();
      mockDb.Get = jest.fn().mockResolvedValue(existing);

      const result = await module.DeleteInvoice(existing.id);

      expect(mockDb.Delete).toHaveBeenCalledWith('Invoices', existing.id);
      expect(eventService.Emit).toHaveBeenCalledWith(
        'invoice.deleted',
        PLATFORM,
        existing
      );
      expect(result).toEqual({
        id: existing.id,
        object: 'invoice',
        deleted: true,
      });
    });

    it('should reject deleting a non-draft invoice', async () => {
      mockDb.Get = jest
        .fn()
        .mockResolvedValue(DraftInvoice({ status: 'open' }));

      await expect(module.DeleteInvoice('in_fd_test001')).rejects.toThrow(
        "Cannot delete invoice with status 'open'"
      );
    });
  });

  describe('FinalizeInvoice', () => {
    it('should move draft to open and emit invoice.finalized', async () => {
      const existing = DraftInvoice({ number: null, amount_due: 0 });
      mockDb.Get = jest
        .fn()
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          status: 'open',
          number: 'TESTPREF-0001',
          status_transitions: {
            ...existing.status_transitions,
            finalized_at: GetFixedTimestamp(),
          },
        });

      const result = await module.FinalizeInvoice(existing.id);

      expect(customerModule.ClaimNextInvoiceNumber).toHaveBeenCalledWith(
        CUSTOMER_ID
      );
      expect(mockDb.Update).toHaveBeenCalledWith(
        'Invoices',
        existing.id,
        expect.objectContaining({
          status: 'open',
          ending_balance: 0,
          number: 'TESTPREF-0001',
        })
      );
      expect(eventService.Emit).toHaveBeenCalledWith(
        'invoice.finalized',
        PLATFORM,
        result
      );
      expect(result.status).toBe('open');
    });

    it('should keep an existing invoice number without claiming a new sequence', async () => {
      const existing = DraftInvoice({
        number: 'CUSTOM-0042',
        amount_due: 0,
      });
      mockDb.Get = jest
        .fn()
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          status: 'open',
        });

      await module.FinalizeInvoice(existing.id);

      expect(customerModule.ClaimNextInvoiceNumber).not.toHaveBeenCalled();
      expect(mockDb.Update).toHaveBeenCalledWith(
        'Invoices',
        existing.id,
        expect.objectContaining({
          number: 'CUSTOM-0042',
        })
      );
    });

    it('should create a PaymentIntent and confirmation_secret when amount_due > 0', async () => {
      const existing = DraftInvoice({
        number: null,
        amount_due: 1099,
        collection_method: 'charge_automatically',
      });
      const paymentIntentModule = {
        CreatePaymentIntent: jest.fn().mockResolvedValue({
          id: 'pi_fd_1',
          client_secret: 'pi_fd_1_secret_abc',
          amount: 1099,
        }),
      };

      module = new InvoiceModule(
        mockDb,
        eventService,
        customerModule,
        invoiceItemModule,
        paymentIntentModule as never
      );

      mockDb.Get = jest
        .fn()
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          status: 'open',
          confirmation_secret: {
            type: 'payment_intent',
            client_secret: 'pi_fd_1_secret_abc',
          },
        });

      await module.FinalizeInvoice(existing.id);

      expect(paymentIntentModule.CreatePaymentIntent).toHaveBeenCalledWith(
        PLATFORM,
        expect.objectContaining({
          amount: 1099,
          currency: 'usdc',
          customer: CUSTOMER_ID,
        })
      );
      expect(mockDb.Update).toHaveBeenCalledWith(
        'Invoices',
        existing.id,
        expect.objectContaining({
          status: 'open',
          confirmation_secret: {
            type: 'payment_intent',
            client_secret: 'pi_fd_1_secret_abc',
          },
          payments: expect.objectContaining({
            total_count: 1,
          }),
        })
      );
    });

    it('should reject finalizing a non-draft invoice', async () => {
      mockDb.Get = jest
        .fn()
        .mockResolvedValue(DraftInvoice({ status: 'open', amount_due: 0 }));

      await expect(module.FinalizeInvoice('in_fd_test001')).rejects.toThrow(
        "Cannot finalize invoice with status 'open'"
      );
    });
  });

  describe('MarkInvoiceUncollectible', () => {
    it('should mark an open invoice uncollectible and emit the event', async () => {
      const existing = DraftInvoice({ status: 'open' });
      mockDb.Get = jest
        .fn()
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          status: 'uncollectible',
        });

      const result = await module.MarkInvoiceUncollectible(existing.id);

      expect(mockDb.Update).toHaveBeenCalledWith(
        'Invoices',
        existing.id,
        expect.objectContaining({ status: 'uncollectible' })
      );
      expect(eventService.Emit).toHaveBeenCalledWith(
        'invoice.marked_uncollectible',
        PLATFORM,
        result
      );
    });
  });

  describe('PayInvoice', () => {
    it('should require a PaymentIntent when not paid out of band', async () => {
      mockDb.Get = jest
        .fn()
        .mockResolvedValue(DraftInvoice({ status: 'open', amount_due: 1099 }));

      await expect(module.PayInvoice('in_fd_test001', {})).rejects.toThrow(
        'Invoice has no PaymentIntent'
      );
    });

    it('should mark paid out of band and emit paid + payment_succeeded', async () => {
      const existing = DraftInvoice({
        status: 'open',
        amount_due: 1099,
        amount_remaining: 1099,
      });
      mockDb.Get = jest
        .fn()
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          status: 'paid',
          amount_paid: 1099,
          amount_remaining: 0,
          attempted: true,
        });

      const result = await module.PayInvoice(existing.id, {
        paid_out_of_band: true,
      });

      expect(mockDb.Update).toHaveBeenCalledWith(
        'Invoices',
        existing.id,
        expect.objectContaining({
          status: 'paid',
          amount_paid: 1099,
          amount_remaining: 0,
          attempted: true,
        })
      );
      expect(eventService.Emit).toHaveBeenCalledWith(
        'invoice.paid',
        PLATFORM,
        result
      );
      expect(eventService.Emit).toHaveBeenCalledWith(
        'invoice.payment_succeeded',
        PLATFORM,
        result
      );
    });

    it('should settle with settlement_transaction_hash and create charge', async () => {
      const existing = DraftInvoice({
        status: 'open',
        amount_due: 1099,
        amount_remaining: 1099,
        payments: {
          object: 'list',
          data: [
            {
              id: 'inpay_fd_1',
              object: 'invoice_payment',
              amount_paid: null,
              amount_requested: 1099,
              created: GetFixedTimestamp(),
              currency: 'usdc',
              invoice: 'in_fd_test001',
              is_default: true,
              livemode: false,
              payment: {
                charge: null,
                payment_intent: 'pi_fd_1',
                payment_record: null,
                type: 'payment_intent',
              },
              status: 'open',
              status_transitions: { canceled_at: null, paid_at: null },
              platform_account: PLATFORM,
            },
          ],
          has_more: false,
          total_count: 1,
          url: '/v1/invoices/in_fd_test001/payments',
        },
      });

      const paymentIntentModule = {
        MarkSucceeded: jest.fn().mockResolvedValue({ id: 'pi_fd_1' }),
        MarkPaymentFailed: jest.fn(),
      };
      const chargeModule = {
        CreateFromPaymentAttempt: jest.fn().mockResolvedValue({
          id: 'ch_fd_1',
        }),
        AttachBalanceTransaction: jest.fn().mockResolvedValue({
          id: 'ch_fd_1',
          balance_transaction: 'txn_fd_1',
        }),
      };

      module = new InvoiceModule(
        mockDb,
        eventService,
        customerModule,
        invoiceItemModule,
        paymentIntentModule as never,
        chargeModule as never,
        undefined,
        CreateMockSettlement()
      );

      const paidInvoice = {
        ...existing,
        status: 'paid' as const,
        amount_paid: 1099,
        amount_remaining: 0,
        attempted: true,
        next_payment_attempt: null,
      };

      mockDb.Get = jest
        .fn()
        .mockResolvedValueOnce(existing)
        .mockImplementation(async (collection: string, id: string) => {
          if (collection === 'Invoices' && id === existing.id) {
            return paidInvoice;
          }
          return null;
        }) as typeof mockDb.Get;

      const result = await module.PayInvoice(existing.id, {
        settlement_transaction_hash: 'tx_settled',
      });

      expect(chargeModule.CreateFromPaymentAttempt).toHaveBeenCalledWith(
        PLATFORM,
        expect.objectContaining({
          crypto: expect.objectContaining({ transaction_hash: 'tx_settled' }),
        })
      );
      expect(chargeModule.AttachBalanceTransaction).toHaveBeenCalledWith(
        'ch_fd_1',
        expect.any(String)
      );
      expect(paymentIntentModule.MarkSucceeded).toHaveBeenCalledWith(
        'pi_fd_1',
        expect.objectContaining({
          amountReceived: 1099,
          latestCharge: 'ch_fd_1',
        })
      );
      expect(result.status).toBe('paid');
    });

    describe('automatic collection from an on-chain subscription', () => {
      const SUBSCRIBER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
      const SUB_ONCHAIN = `0x${'5b'.repeat(32)}`;
      const PLAN_KEY = `0x${'a1'.repeat(32)}`;
      const CHARGE = `0x${'c4'.repeat(32)}`;
      const PERIOD = 30 * 24 * 3600;
      const NOW = GetFixedTimestamp();
      const CLAIM = `${SUB_ONCHAIN}:${NOW}`;
      let memory: MemoryDatabase;
      let settlement: ReturnType<typeof CreateMockSettlement>;
      let paymentIntentModule: {
        MarkSucceeded: jest.Mock;
        MarkPaymentFailed: jest.Mock;
        MarkProcessing: jest.Mock;
        SetPendingChargeHash: jest.Mock;
        ClearPendingChargeHash: jest.Mock;
        GetPaymentIntent: jest.Mock;
      };
      let chargeModule: {
        CreateFromPaymentAttempt: jest.Mock;
        AttachBalanceTransaction: jest.Mock;
      };

      beforeEach(() => {
        memory = new MemoryDatabase();
        memory.Seed(
          'Invoices',
          DraftInvoice({
            status: 'open',
            amount_due: 1099,
            amount_remaining: 1099,
            period_start: NOW,
            period_end: NOW + PERIOD,
            parent: {
              type: 'subscription_details',
              subscription_details: {
                subscription: 'sub_fd_1',
                metadata: null,
                subscription_proration_date: null,
              },
              quote_details: null,
            },
            payments: {
              object: 'list',
              data: [
                {
                  id: 'inpay_fd_1',
                  object: 'invoice_payment',
                  amount_paid: null,
                  amount_requested: 1099,
                  created: NOW,
                  currency: 'usdc',
                  invoice: 'in_fd_test001',
                  is_default: true,
                  livemode: false,
                  payment: {
                    charge: null,
                    payment_intent: 'pi_fd_1',
                    payment_record: null,
                    type: 'payment_intent',
                  },
                  status: 'open',
                  status_transitions: { canceled_at: null, paid_at: null },
                  platform_account: PLATFORM,
                },
              ],
              has_more: false,
              total_count: 1,
              url: '/v1/invoices/in_fd_test001/payments',
            },
          }) as unknown as Record<string, unknown>
        );
        memory.Seed('Subscriptions', {
          id: 'sub_fd_1',
          object: 'subscription',
          platform_account: PLATFORM,
          subscription_onchain_id: SUB_ONCHAIN,
          default_payment_method: SUBSCRIBER,
          metadata: {},
        });
        memory.Seed('SubscriptionItems', {
          id: 'si_fd_1',
          subscription: 'sub_fd_1',
          price: 'price_fd_1',
        });
        memory.Seed('Prices', {
          id: 'price_fd_1',
          platform_account: PLATFORM,
          subscription_plan_id: PLAN_KEY,
          unit_amount: 1099,
          recurring: { interval: 'month', interval_count: 1 },
        });

        paymentIntentModule = {
          MarkSucceeded: jest.fn(),
          MarkPaymentFailed: jest.fn().mockResolvedValue({ id: 'pi_fd_1' }),
          MarkProcessing: jest.fn().mockResolvedValue({ id: 'pi_fd_1' }),
          SetPendingChargeHash: jest.fn().mockResolvedValue(true),
          ClearPendingChargeHash: jest.fn(),
          GetPaymentIntent: jest.fn().mockResolvedValue(null),
        };
        chargeModule = {
          CreateFromPaymentAttempt: jest
            .fn()
            .mockResolvedValue({ id: 'ch_fd_1' }),
          AttachBalanceTransaction: jest.fn(),
        };
        settlement = CreateMockSettlement();
        module = new InvoiceModule(
          memory.AsDatabase(),
          eventService,
          customerModule,
          invoiceItemModule,
          paymentIntentModule as never,
          chargeModule as never,
          undefined,
          settlement
        );
      });

      function Pay(): Promise<Invoice> {
        return module.PayInvoice('in_fd_test001', {});
      }

      function Claim(): Record<string, unknown> {
        return memory.Doc('SubscriptionCycleClaims', CLAIM);
      }

      /** This invoice's claim on the cycle at NOW. */
      function SeedClaim(overrides: Record<string, unknown> = {}): void {
        memory.Seed('SubscriptionCycleClaims', {
          id: CLAIM,
          subscription_onchain_id: SUB_ONCHAIN,
          due_at: NOW,
          owner: 'in_fd_test001',
          charge_hash: CHARGE,
          charge_hashes: [CHARGE],
          charge_nonce: 7,
          charge_sent_at: NOW - 60,
          ...overrides,
        });
      }

      /** The chain's logs hold `hash`, offered to the search's `accept`. */
      function LogsHold(hash: string): void {
        settlement.FindSubscriptionCharge.mockImplementation(
          async (
            _subId: string,
            search: { accept?(h: string): Promise<boolean> }
          ) =>
            search.accept && !(await search.accept(hash))
              ? null
              : { transaction_hash: hash, next_charge_at: NOW + PERIOD }
        );
      }

      function EmittedTypes(): string[] {
        return eventService.Emit.mock.calls.map(([type]) => type);
      }

      function ExpectWait(result: Invoice, code: string): void {
        expect(result.status).toBe('open');
        expect(result.attempt_count).toBe(0);
        expect(result.metadata?.['last_payment_error_code']).toBe(code);
        expect(paymentIntentModule.MarkPaymentFailed).not.toHaveBeenCalled();
        expect(EmittedTypes()).not.toContain('invoice.payment_failed');
      }

      it('claims the cycle and records the charge on the claim and the PaymentIntent before sending', async () => {
        const seen: Record<string, unknown> = {};
        settlement.CollectSubscriptionPayment.mockImplementation(
          async (params) => {
            await params.onSigned(CHARGE, { nonce: 7 });
            seen.claim = Claim();
            seen.processing = paymentIntentModule.MarkProcessing.mock.calls;
            return {
              status: 'collected',
              transaction_hash: CHARGE,
              next_charge_at: NOW + PERIOD,
            };
          }
        );

        const result = await Pay();

        expect(settlement.CollectSubscriptionPayment).toHaveBeenCalledWith(
          expect.objectContaining({
            subscriptionOnchainId: SUB_ONCHAIN,
            planKey: PLAN_KEY,
            subscriberWallet: SUBSCRIBER,
            amountCents: 1099,
          })
        );
        expect(seen.claim).toMatchObject({
          owner: 'in_fd_test001',
          due_at: NOW,
          charge_hash: CHARGE,
          charge_hashes: [CHARGE],
          charge_nonce: 7,
        });
        expect(seen.processing).toEqual([['pi_fd_1']]);
        expect(paymentIntentModule.SetPendingChargeHash).toHaveBeenCalledWith(
          'pi_fd_1',
          CHARGE,
          null
        );
        expect(result.status).toBe('paid');
        expect(chargeModule.CreateFromPaymentAttempt).toHaveBeenCalledWith(
          PLATFORM,
          expect.objectContaining({
            crypto: expect.objectContaining({ transaction_hash: CHARGE }),
          })
        );
        // The settled charge is no longer pending on the PaymentIntent, and
        // the period it paid comes from its Charged event.
        expect(paymentIntentModule.ClearPendingChargeHash).toHaveBeenCalledWith(
          'pi_fd_1'
        );
        expect(Claim()).toMatchObject({
          paid_period: { start: NOW, end: NOW + PERIOD },
        });
      });

      it('keeps a charge that did not confirm in time pending: no decline, no failure events', async () => {
        settlement.CollectSubscriptionPayment.mockImplementation(
          async (params) => {
            await params.onSigned(CHARGE, { nonce: 7 });
            return { status: 'pending', transaction_hash: CHARGE };
          }
        );

        const result = await Pay();

        ExpectWait(result, 'charge_pending');
        expect(result.next_payment_attempt).toBe(NOW);
        expect(Claim()).toMatchObject({ charge_hash: CHARGE });
      });

      it('reconciles a recorded charge by its hash before sending another', async () => {
        settlement.CollectSubscriptionPayment.mockImplementationOnce(
          async (params) => {
            await params.onSigned(CHARGE, { nonce: 7 });
            return { status: 'pending', transaction_hash: CHARGE };
          }
        );
        await Pay();
        jest.mocked(settlement.CollectSubscriptionPayment).mockClear();

        const result = await Pay();

        expect(settlement.ReconcileSubscriptionCharge).toHaveBeenCalledWith(
          [CHARGE],
          expect.objectContaining({
            subscriptionOnchainId: SUB_ONCHAIN,
            amountCents: 1099,
            nonce: 7,
          })
        );
        expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
        expect(result.status).toBe('paid');
      });

      it('reconciles every hash of the claim: a re-priced charge whose original mined is paid, not voided', async () => {
        const REPLACEMENT = `0x${'c5'.repeat(32)}`;
        SeedClaim({
          charge_hash: REPLACEMENT,
          charge_hashes: [CHARGE, REPLACEMENT],
          charge_nonce: 7,
        });
        // The original landed, so the chain is due one period on.
        settlement.GetSubscriptionState.mockResolvedValue({
          status: 'active',
          next_charge_at: NOW + PERIOD,
          period_seconds: PERIOD,
          chain_time: NOW + 120,
        });
        settlement.ReconcileSubscriptionCharge.mockImplementation(
          async (hashes) =>
            hashes.includes(CHARGE)
              ? {
                  status: 'paid',
                  transaction_hash: CHARGE,
                  next_charge_at: NOW + PERIOD,
                }
              : { status: 'dropped' }
        );

        const result = await Pay();

        expect(settlement.ReconcileSubscriptionCharge).toHaveBeenCalledWith(
          [CHARGE, REPLACEMENT],
          expect.objectContaining({ nonce: 7 })
        );
        expect(result.status).toBe('paid');
        expect(chargeModule.CreateFromPaymentAttempt).toHaveBeenCalledWith(
          PLATFORM,
          expect.objectContaining({
            crypto: expect.objectContaining({ transaction_hash: CHARGE }),
          })
        );
        expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
      });

      it.each([
        // Its charge landed, so the chain moved on past its period.
        ['a missed cycle', NOW + PERIOD, NOW + 120],
        // The chain does not show the period due yet.
        ['a period not due', NOW, NOW - 30],
      ])(
        'pays from the logs a charge of its own claim before refusing it as %s',
        async (_label, nextChargeAt, chainTime) => {
          SeedClaim({ charge_hash: null, charge_hashes: [CHARGE] });
          settlement.GetSubscriptionState.mockResolvedValue({
            status: 'active',
            next_charge_at: nextChargeAt,
            period_seconds: PERIOD,
            chain_time: chainTime,
          });
          LogsHold(CHARGE);

          const result = await Pay();

          expect(result.status).toBe('paid');
          expect(settlement.FindSubscriptionCharge).toHaveBeenCalledWith(
            SUB_ONCHAIN,
            expect.objectContaining({ amountCents: 1099, since: NOW })
          );
          expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
        }
      );

      it('does not take a logged charge another cycle recorded', async () => {
        SeedClaim({
          charge_hash: null,
          charge_hashes: [`0x${'dd'.repeat(32)}`],
        });
        memory.Seed('SubscriptionCycleClaims', {
          id: `${SUB_ONCHAIN}:${NOW + PERIOD}`,
          subscription_onchain_id: SUB_ONCHAIN,
          due_at: NOW + PERIOD,
          owner: 'in_fd_next',
          charge_hash: null,
          charge_hashes: [CHARGE],
        });
        settlement.GetSubscriptionState.mockResolvedValue({
          status: 'active',
          next_charge_at: NOW + 2 * PERIOD,
          period_seconds: PERIOD,
          chain_time: NOW + PERIOD + 5,
        });
        LogsHold(CHARGE);

        ExpectWait(await Pay(), CYCLE_MISSED);
      });

      it('follows the claim when the PaymentIntent holds another pending hash', async () => {
        paymentIntentModule.SetPendingChargeHash.mockResolvedValueOnce(false);
        paymentIntentModule.GetPaymentIntent.mockResolvedValue({
          id: 'pi_fd_1',
          pending_charge_hash: `0x${'ee'.repeat(32)}`,
        });

        const result = await Pay();

        expect(
          paymentIntentModule.SetPendingChargeHash
        ).toHaveBeenNthCalledWith(2, 'pi_fd_1', CHARGE, `0x${'ee'.repeat(32)}`);
        expect(result.status).toBe('paid');
      });

      it('keeps a decline’s retry time over a pause and a resume', async () => {
        SeedClaim({ charge_hash: null });
        memory.Seed('Invoices', {
          ...memory.Doc<Record<string, unknown>>('Invoices', 'in_fd_test001'),
          next_payment_attempt: NOW + 3 * 86_400,
        });

        await module.ScheduleOpenSubscriptionInvoices('sub_fd_1', null);
        expect(
          memory.Doc<Invoice>('Invoices', 'in_fd_test001').next_payment_attempt
        ).toBeNull();
        expect(Claim()).toMatchObject({ paused_retry_at: NOW + 3 * 86_400 });

        await module.ScheduleOpenSubscriptionInvoices('sub_fd_1', NOW + 60);
        expect(
          memory.Doc<Invoice>('Invoices', 'in_fd_test001').next_payment_attempt
        ).toBe(NOW + 3 * 86_400);
        expect(Claim()).toMatchObject({ paused_retry_at: null });
      });

      it('sends a new charge when the recorded one was dropped', async () => {
        memory.Seed('SubscriptionCycleClaims', {
          id: CLAIM,
          subscription_onchain_id: SUB_ONCHAIN,
          due_at: NOW,
          owner: 'in_fd_test001',
          charge_hash: `0x${'dd'.repeat(32)}`,
          charge_sent_at: NOW - 60,
        });
        settlement.ReconcileSubscriptionCharge.mockResolvedValue({
          status: 'dropped',
        });

        const result = await Pay();

        expect(settlement.CollectSubscriptionPayment).toHaveBeenCalledTimes(1);
        expect(result.status).toBe('paid');
        expect(Claim()).toMatchObject({ charge_hash: CHARGE });
      });

      it('counts a recorded charge that reverted on the allowance as a decline', async () => {
        memory.Seed('SubscriptionCycleClaims', {
          id: CLAIM,
          subscription_onchain_id: SUB_ONCHAIN,
          due_at: NOW,
          owner: 'in_fd_test001',
          charge_hash: CHARGE,
          charge_sent_at: NOW - 60,
        });
        settlement.ReconcileSubscriptionCharge.mockResolvedValue({
          status: 'failed',
          error: new AppError('allowance', 402, COLLECTION_FAILED_ALLOWANCE),
        });

        const result = await Pay();

        expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
        expect(result.attempt_count).toBe(1);
        expect(result.metadata?.['last_payment_error_code']).toBe(
          COLLECTION_FAILED_ALLOWANCE
        );
        expect(paymentIntentModule.MarkPaymentFailed).toHaveBeenCalledWith(
          'pi_fd_1',
          expect.objectContaining({
            code: COLLECTION_FAILED_ALLOWANCE,
            decline_code: COLLECTION_FAILED_ALLOWANCE,
          })
        );
        expect(EmittedTypes()).toEqual(
          expect.arrayContaining([
            'invoice.payment_failed',
            'customer.subscription.allowance_exhausted',
          ])
        );
        expect(Claim()).toMatchObject({ charge_hash: null });
      });

      it('treats a collected period as a wait until the next due time', async () => {
        settlement.GetSubscriptionState.mockResolvedValue({
          status: 'active',
          next_charge_at: NOW + PERIOD,
          period_seconds: PERIOD,
          chain_time: NOW + 10,
        });
        memory.Seed('Invoices', {
          ...memory.Doc<Record<string, unknown>>('Invoices', 'in_fd_test001'),
          period_start: NOW + PERIOD,
        });

        const result = await Pay();

        ExpectWait(result, PERIOD_ALREADY_COLLECTED);
        expect(result.next_payment_attempt).toBe(NOW + PERIOD);
        expect(result.metadata?.['last_payment_error']).toContain(
          'wait for the next billing period'
        );
        expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
      });

      it('settles NotDueYet from the chain logs: paid when a charge since the period start is found', async () => {
        settlement.CollectSubscriptionPayment.mockResolvedValue({
          status: 'already_collected',
          transaction_hash: null,
        });
        settlement.FindSubscriptionCharge.mockResolvedValue({
          transaction_hash: CHARGE,
          next_charge_at: NOW + PERIOD,
        });

        const result = await Pay();

        expect(settlement.FindSubscriptionCharge).toHaveBeenCalledWith(
          SUB_ONCHAIN,
          expect.objectContaining({ amountCents: 1099, since: NOW })
        );
        expect(result.status).toBe('paid');
      });

      it('settles NotDueYet from the chain logs: a missed cycle when none is found', async () => {
        settlement.CollectSubscriptionPayment.mockResolvedValue({
          status: 'already_collected',
          transaction_hash: null,
        });

        ExpectWait(await Pay(), CYCLE_MISSED);
      });

      it('refuses to collect an invoice for a period the chain skipped', async () => {
        settlement.GetSubscriptionState.mockResolvedValue({
          status: 'active',
          next_charge_at: NOW,
          period_seconds: PERIOD,
          chain_time: NOW + 2 * PERIOD + 5,
        });

        const result = await Pay();

        ExpectWait(result, CYCLE_MISSED);
        expect(result.next_payment_attempt).toBeNull();
        expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
      });

      it('waits when another collector holds the cycle', async () => {
        memory.Seed('SubscriptionCycleClaims', {
          id: CLAIM,
          subscription_onchain_id: SUB_ONCHAIN,
          due_at: NOW,
          owner: 'cs_fd_checkout',
          charge_hash: null,
          charge_sent_at: null,
        });

        ExpectWait(await Pay(), PERIOD_ALREADY_COLLECTED);
        expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
      });

      it.each([
        ['paused', PAUSED_ON_CHAIN],
        ['canceled', CANCELED_ON_CHAIN],
      ] as const)(
        'records a subscription %s on-chain without a failed attempt',
        async (status, code) => {
          settlement.GetSubscriptionState.mockResolvedValue({
            status,
            next_charge_at: NOW,
            period_seconds: PERIOD,
            chain_time: NOW,
          });

          const result = await Pay();

          ExpectWait(result, code);
          expect(result.next_payment_attempt).toBeNull();
        }
      );

      it('refuses an amount above what the plan collects, without a decline', async () => {
        memory.Seed('Invoices', {
          ...memory.Doc<Record<string, unknown>>('Invoices', 'in_fd_test001'),
          amount_due: 5000,
        });

        ExpectWait(await Pay(), 'onchain_plan_amount_exceeded');
        expect(settlement.CollectSubscriptionPayment).not.toHaveBeenCalled();
      });

      it('waits a few minutes, without a decline, when the node cannot answer', async () => {
        settlement.GetSubscriptionState.mockRejectedValue(
          new AppError(
            'The payment network is unavailable; try again',
            502,
            'blockchain_error'
          )
        );

        const result = await Pay();

        ExpectWait(result, 'chain_unavailable');
        expect(result.next_payment_attempt).toBe(NOW + 300);
      });

      it('emits allowance_exhausted only for the invoice platform’s subscription', async () => {
        memory.Seed('Subscriptions', {
          ...memory.Doc<Record<string, unknown>>('Subscriptions', 'sub_fd_1'),
          platform_account: 'acct_fd_other',
        });
        settlement.CollectSubscriptionPayment.mockRejectedValue(
          new AppError('allowance', 402, COLLECTION_FAILED_ALLOWANCE)
        );

        await Pay();

        expect(EmittedTypes()).not.toContain(
          'customer.subscription.allowance_exhausted'
        );
      });

      it('clears the error code of an earlier attempt when another error follows', async () => {
        memory.Seed('Invoices', {
          ...memory.Doc<Record<string, unknown>>('Invoices', 'in_fd_test001'),
          metadata: { last_payment_error_code: PAUSED_ON_CHAIN },
        });
        settlement.CollectSubscriptionPayment.mockRejectedValue(
          new Error('unexpected')
        );

        const result = await Pay();

        expect(result.attempt_count).toBe(1);
        expect(result.metadata).not.toHaveProperty('last_payment_error_code');
      });
    });
  });

  describe('VoidInvoice', () => {
    it('should void an open invoice and emit invoice.voided', async () => {
      const existing = DraftInvoice({ status: 'open' });
      mockDb.Get = jest
        .fn()
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          status: 'void',
        });

      const result = await module.VoidInvoice(existing.id);

      expect(mockDb.Update).toHaveBeenCalledWith(
        'Invoices',
        existing.id,
        expect.objectContaining({ status: 'void' })
      );
      expect(eventService.Emit).toHaveBeenCalledWith(
        'invoice.voided',
        PLATFORM,
        result
      );
    });

    it('should reject voiding a draft invoice', async () => {
      mockDb.Get = jest
        .fn()
        .mockResolvedValue(DraftInvoice({ status: 'draft' }));

      await expect(module.VoidInvoice('in_fd_test001')).rejects.toThrow(
        "Cannot void invoice with status 'draft'"
      );
    });
  });

  describe('ListInvoices', () => {
    it('should pass account and filters to ListHelper', async () => {
      const listSpy = jest
        .spyOn(ListHelper.prototype, 'List')
        .mockResolvedValue({
          object: 'list',
          data: [],
          has_more: false,
          url: '/v1/invoices',
        });

      await module.ListInvoices({
        account: PLATFORM,
        limit: 25,
        customer: CUSTOMER_ID,
        status: 'draft',
        collection_method: 'charge_automatically',
      });

      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          account: PLATFORM,
          limit: 25,
          filters: expect.objectContaining({
            customer: CUSTOMER_ID,
            status: 'draft',
            collection_method: 'charge_automatically',
          }),
        })
      );
    });
  });
});
