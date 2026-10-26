import { BaseResource } from './Base';
import { ApplyDateFilter } from '../utils';
import {
  InvoiceItem,
  InvoiceItemDeleted,
  ListResponse,
} from '@zoneless/shared-types';
import type {
  CreateInvoiceItemInput,
  ListInvoiceItemsInput,
  RetrieveInvoiceItemInput,
  UpdateInvoiceItemInput,
} from '../generated/Inputs';

/**
 * @see https://docs.zoneless.com/invoiceitems
 */
export class InvoiceItems extends BaseResource {
  /** @see https://docs.zoneless.com/invoiceitems/create */
  async create(params: CreateInvoiceItemInput): Promise<InvoiceItem> {
    return this.client.Post<InvoiceItem>('/invoiceitems', params);
  }

  /** @see https://docs.zoneless.com/invoiceitems/update */
  async update(
    id: string,
    params: UpdateInvoiceItemInput
  ): Promise<InvoiceItem> {
    return this.client.Post<InvoiceItem>(`/invoiceitems/${id}`, params);
  }

  /** @see https://docs.zoneless.com/invoiceitems/retrieve */
  async retrieve(
    id: string,
    params: RetrieveInvoiceItemInput = {}
  ): Promise<InvoiceItem> {
    return this.client.Get<InvoiceItem>(`/invoiceitems/${id}`, params);
  }

  /** @see https://docs.zoneless.com/invoiceitems/list */
  async list(
    params: ListInvoiceItemsInput = {}
  ): Promise<ListResponse<InvoiceItem>> {
    return this.client.Get<ListResponse<InvoiceItem>>(
      '/invoiceitems',
      this.BuildQuery(params)
    );
  }

  /**
   * Deletes an invoice item. Only possible when not attached to an invoice,
   * or when attached to a draft invoice.
   * @see https://docs.zoneless.com/invoiceitems/delete
   */
  async del(id: string): Promise<InvoiceItemDeleted> {
    return this.client.Delete<InvoiceItemDeleted>(`/invoiceitems/${id}`);
  }

  private BuildQuery(
    params: ListInvoiceItemsInput
  ): Record<string, string | number | boolean | undefined> {
    const query: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      customer: params.customer,
      customer_account: params.customer_account,
      invoice: params.invoice,
      pending: params.pending,
    };

    ApplyDateFilter(query, 'created', params.created);

    return query;
  }
}
