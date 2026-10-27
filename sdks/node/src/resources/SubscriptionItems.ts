import { BaseResource } from './Base';
import {
  SubscriptionItem,
  SubscriptionItemDeleted,
  ListResponse,
} from '@fiatdesk/shared-types';
import type {
  CreateSubscriptionItemInput,
  ListSubscriptionItemsInput,
  RetrieveSubscriptionItemInput,
  UpdateSubscriptionItemInput,
  DeleteSubscriptionItemInput,
} from '../generated/Inputs';

/**
 * @see /subscriptionitems
 */
export class SubscriptionItems extends BaseResource {
  /** @see /subscriptionitems/create */
  async create(params: CreateSubscriptionItemInput): Promise<SubscriptionItem> {
    return this.client.Post<SubscriptionItem>('/subscription_items', params);
  }

  /** @see /subscriptionitems/update */
  async update(
    id: string,
    params: UpdateSubscriptionItemInput
  ): Promise<SubscriptionItem> {
    return this.client.Post<SubscriptionItem>(
      `/subscription_items/${id}`,
      params
    );
  }

  /** @see /subscriptionitems/retrieve */
  async retrieve(
    id: string,
    params: RetrieveSubscriptionItemInput = {}
  ): Promise<SubscriptionItem> {
    return this.client.Get<SubscriptionItem>(
      `/subscription_items/${id}`,
      params
    );
  }

  /** @see /subscriptionitems/list */
  async list(
    params: ListSubscriptionItemsInput
  ): Promise<ListResponse<SubscriptionItem>> {
    return this.client.Get<ListResponse<SubscriptionItem>>(
      '/subscription_items',
      this.BuildQuery(params)
    );
  }

  /**
   * Deletes a subscription item.
   * @see /subscriptionitems/delete
   */
  async del(
    id: string,
    params: DeleteSubscriptionItemInput = {}
  ): Promise<SubscriptionItemDeleted> {
    return this.client.Delete<SubscriptionItemDeleted>(
      `/subscription_items/${id}`,
      params
    );
  }

  private BuildQuery(
    params: ListSubscriptionItemsInput
  ): Record<string, string | number | boolean | undefined> {
    return {
      subscription: params.subscription,
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
    };
  }
}
