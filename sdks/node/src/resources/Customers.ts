import { BaseResource } from './Base';
import { ApplyDateFilter, type ListQuery } from '../utils';
import {
  Customer,
  CustomerDeleted,
  ListResponse,
} from '@zoneless/shared-types';
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  ListCustomersInput,
  RetrieveCustomerInput,
} from '../generated/Inputs';

/**
 * @see https://docs.zoneless.com/customers
 */
export class Customers extends BaseResource {
  /** @see https://docs.zoneless.com/customers/create */
  async create(params: CreateCustomerInput): Promise<Customer> {
    return this.client.Post<Customer>('/customers', params);
  }

  /** @see https://docs.zoneless.com/customers/update */
  async update(id: string, params: UpdateCustomerInput): Promise<Customer> {
    return this.client.Post<Customer>(`/customers/${id}`, params);
  }

  /** @see https://docs.zoneless.com/customers/retrieve */
  async retrieve(
    id: string,
    params: RetrieveCustomerInput = {}
  ): Promise<Customer> {
    return this.client.Get<Customer>(`/customers/${id}`, params);
  }

  /** @see https://docs.zoneless.com/customers/list */
  async list(params: ListCustomersInput = {}): Promise<ListResponse<Customer>> {
    const query: ListQuery = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      email: params.email,
    };
    ApplyDateFilter(query, 'created', params.created);
    return this.client.Get<ListResponse<Customer>>(`/customers`, query);
  }

  /** @see https://docs.zoneless.com/customers/delete */
  async del(customerId: string): Promise<CustomerDeleted> {
    return this.client.Delete<CustomerDeleted>(`/customers/${customerId}`);
  }
}
