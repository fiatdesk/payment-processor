import { BaseResource } from './Base';
import { ApplyDateFilter, type ListQuery } from '../utils';
import { Price, ListResponse } from '@zoneless/shared-types';
import type {
  CreatePriceInput,
  UpdatePriceInput,
  ListPricesInput,
  RetrievePriceInput,
} from '../generated/Inputs';

/**
 * @see https://docs.zoneless.com/prices
 */
export class Prices extends BaseResource {
  /** @see https://docs.zoneless.com/prices/create */
  async create(params: CreatePriceInput): Promise<Price> {
    return this.client.Post<Price>('/prices', params);
  }

  /** @see https://docs.zoneless.com/prices/update */
  async update(id: string, params: UpdatePriceInput): Promise<Price> {
    return this.client.Post<Price>(`/prices/${id}`, params);
  }

  /** @see https://docs.zoneless.com/prices/retrieve */
  async retrieve(id: string, params: RetrievePriceInput = {}): Promise<Price> {
    return this.client.Get<Price>(`/prices/${id}`, params);
  }

  /** @see https://docs.zoneless.com/prices/list */
  async list(params: ListPricesInput = {}): Promise<ListResponse<Price>> {
    const query: ListQuery = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      active: params.active,
      currency: params.currency,
      product: params.product,
      lookup_keys: params.lookup_keys,
    };
    ApplyDateFilter(query, 'created', params.created);
    if (params.recurring) {
      if (params.recurring.interval !== undefined) {
        query['recurring[interval]'] = params.recurring.interval;
      }
      if (params.recurring.usage_type !== undefined) {
        query['recurring[usage_type]'] = params.recurring.usage_type;
      }
      if (params.recurring.meter !== undefined) {
        query['recurring[meter]'] = params.recurring.meter;
      }
    }
    return this.client.Get<ListResponse<Price>>(`/prices`, query);
  }
}
