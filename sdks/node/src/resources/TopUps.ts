import { BaseResource } from './Base';
import { ApplyDateFilter } from '../utils';
import {
  TopUp,
  CheckDepositsResponse,
  ListResponse,
} from '@zoneless/shared-types';
import type {
  CreateTopUpInput,
  UpdateTopUpInput,
  ListTopUpsInput,
} from '../generated/Inputs';

/**
 * @see https://docs.zoneless.com/topups
 */
export class TopUps extends BaseResource {
  /** @see https://docs.zoneless.com/topups/create */
  async create(params: CreateTopUpInput): Promise<TopUp> {
    return this.client.Post<TopUp>('/topups', params);
  }

  /** @see https://docs.zoneless.com/topups/retrieve */
  async retrieve(id: string): Promise<TopUp> {
    return this.client.Get<TopUp>(`/topups/${id}`);
  }

  /** @see https://docs.zoneless.com/topups/update */
  async update(id: string, params: UpdateTopUpInput): Promise<TopUp> {
    return this.client.Post<TopUp>(`/topups/${id}`, params);
  }

  /** @see https://docs.zoneless.com/topups/list */
  async list(params: ListTopUpsInput = {}): Promise<ListResponse<TopUp>> {
    const query = this.BuildQuery(params);
    return this.client.Get<ListResponse<TopUp>>('/topups', query);
  }

  /** @see https://docs.zoneless.com/topups/cancel */
  async cancel(id: string): Promise<TopUp> {
    return this.client.Post<TopUp>(`/topups/${id}/cancel`, {});
  }

  /** @see https://docs.zoneless.com/topups/check-deposits */
  async checkDeposits(): Promise<CheckDepositsResponse> {
    return this.client.Post<CheckDepositsResponse>(
      '/topups/check-deposits',
      {}
    );
  }

  private BuildQuery(
    params: ListTopUpsInput
  ): Record<string, string | number | undefined> {
    const query: Record<string, string | number | undefined> = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      status: params.status,
    };

    ApplyDateFilter(query, 'amount', params.amount);
    ApplyDateFilter(query, 'created', params.created);

    return query;
  }
}
