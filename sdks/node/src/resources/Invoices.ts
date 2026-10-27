import { BaseResource } from './Base';
import { ApplyDateFilter } from '../utils';
import { Invoice, InvoiceDeleted, ListResponse } from '@fiatdesk/shared-types';
import type {
  CreateInvoiceInput,
  FinalizeInvoiceInput,
  ListInvoicesInput,
  MarkInvoiceUncollectibleInput,
  PayInvoiceInput,
  RetrieveInvoiceInput,
  UpdateInvoiceInput,
  VoidInvoiceInput,
} from '../generated/Inputs';

/**
 * @see /invoices
 */
export class Invoices extends BaseResource {
  /** @see /invoices/create */
  async create(params: CreateInvoiceInput): Promise<Invoice> {
    return this.client.Post<Invoice>('/invoices', params);
  }

  /** @see /invoices/update */
  async update(id: string, params: UpdateInvoiceInput): Promise<Invoice> {
    return this.client.Post<Invoice>(`/invoices/${id}`, params);
  }

  /** @see /invoices/retrieve */
  async retrieve(
    id: string,
    params: RetrieveInvoiceInput = {}
  ): Promise<Invoice> {
    return this.client.Get<Invoice>(`/invoices/${id}`, params);
  }

  /** @see /invoices/list */
  async list(params: ListInvoicesInput = {}): Promise<ListResponse<Invoice>> {
    return this.client.Get<ListResponse<Invoice>>(
      '/invoices',
      this.BuildQuery(params)
    );
  }

  /**
   * Permanently deletes a one-off invoice draft. This cannot be undone.
   * @see /invoices/delete
   */
  async del(id: string): Promise<InvoiceDeleted> {
    return this.client.Delete<InvoiceDeleted>(`/invoices/${id}`);
  }

  /**
   * Finalize a draft invoice manually.
   * @see /invoices/finalize
   */
  async finalizeInvoice(
    id: string,
    params: FinalizeInvoiceInput = {}
  ): Promise<Invoice> {
    return this.client.Post<Invoice>(`/invoices/${id}/finalize`, params);
  }

  /**
   * Mark an invoice as uncollectible.
   * @see /invoices/mark_uncollectible
   */
  async markUncollectible(
    id: string,
    params: MarkInvoiceUncollectibleInput = {}
  ): Promise<Invoice> {
    return this.client.Post<Invoice>(
      `/invoices/${id}/mark_uncollectible`,
      params
    );
  }

  /**
   * Attempt payment on an invoice outside of the normal collection schedule.
   * @see /invoices/pay
   */
  async pay(id: string, params: PayInvoiceInput = {}): Promise<Invoice> {
    return this.client.Post<Invoice>(`/invoices/${id}/pay`, params);
  }

  /**
   * Mark a finalized invoice as void. This cannot be undone.
   * @see /invoices/void
   */
  async voidInvoice(
    id: string,
    params: VoidInvoiceInput = {}
  ): Promise<Invoice> {
    return this.client.Post<Invoice>(`/invoices/${id}/void`, params);
  }

  private BuildQuery(
    params: ListInvoicesInput
  ): Record<string, string | number | boolean | undefined> {
    const query: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      collection_method: params.collection_method,
      customer: params.customer,
      customer_account: params.customer_account,
      status: params.status,
      subscription: params.subscription,
    };

    ApplyDateFilter(query, 'created', params.created);

    return query;
  }
}
