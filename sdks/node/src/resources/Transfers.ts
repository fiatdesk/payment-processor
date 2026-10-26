import { BaseResource } from './Base';
import { RequestExtraOptions } from '../HttpClient';
import { ApplyDateFilter } from '../utils';
import { Transfer, ListResponse } from '@zoneless/shared-types';
import type {
  CreateTransferInput,
  UpdateTransferInput,
  ListTransfersInput,
} from '../generated/Inputs';

/**
 * @see https://docs.zoneless.com/transfers
 */
export class Transfers extends BaseResource {
  /** @see https://docs.zoneless.com/transfers/create */
  async create(
    params: CreateTransferInput,
    options?: RequestExtraOptions
  ): Promise<Transfer> {
    return this.client.Post<Transfer>('/transfers', params, options);
  }

  /** @see https://docs.zoneless.com/transfers/retrieve */
  async retrieve(id: string, options?: RequestExtraOptions): Promise<Transfer> {
    return this.client.Get<Transfer>(`/transfers/${id}`, undefined, options);
  }

  /** @see https://docs.zoneless.com/transfers/update */
  async update(
    id: string,
    params: UpdateTransferInput,
    options?: RequestExtraOptions
  ): Promise<Transfer> {
    return this.client.Post<Transfer>(`/transfers/${id}`, params, options);
  }

  /** @see https://docs.zoneless.com/transfers/list */
  async list(
    params: ListTransfersInput = {},
    options?: RequestExtraOptions
  ): Promise<ListResponse<Transfer>> {
    const query = this.BuildQuery(params);
    return this.client.Get<ListResponse<Transfer>>(
      '/transfers',
      query,
      options
    );
  }

  private BuildQuery(
    params: ListTransfersInput
  ): Record<string, string | number | undefined> {
    const query: Record<string, string | number | undefined> = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      destination: params.destination,
      transfer_group: params.transfer_group,
    };

    ApplyDateFilter(query, 'created', params.created);

    return query;
  }
}
