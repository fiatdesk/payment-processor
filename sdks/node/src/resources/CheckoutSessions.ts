import { BaseResource } from './Base';
import { ApplyDateFilter, type ListQuery } from '../utils';
import {
  CheckoutSession,
  CheckoutSessionDeleted,
  CheckoutSessionLineItem,
  ListResponse,
} from '@fiatdesk/shared-types';
import type {
  CreateCheckoutSessionInput,
  UpdateCheckoutSessionInput,
  ListCheckoutSessionsInput,
  RetrieveCheckoutSessionInput,
  ExpireCheckoutSessionInput,
  ListCheckoutSessionLineItemsInput,
} from '../generated/Inputs';

/**
 * @see /checkout/sessions
 */
export class CheckoutSessions extends BaseResource {
  /** @see /checkout/sessions/create */
  async create(params: CreateCheckoutSessionInput): Promise<CheckoutSession> {
    return this.client.Post<CheckoutSession>('/checkout/sessions', params);
  }

  /** @see /checkout/sessions/update */
  async update(
    id: string,
    params: UpdateCheckoutSessionInput
  ): Promise<CheckoutSession> {
    return this.client.Post<CheckoutSession>(
      `/checkout/sessions/${id}`,
      params
    );
  }

  /** @see /checkout/sessions/retrieve */
  async retrieve(
    id: string,
    params: RetrieveCheckoutSessionInput = {}
  ): Promise<CheckoutSession> {
    return this.client.Get<CheckoutSession>(`/checkout/sessions/${id}`, params);
  }

  /** @see /checkout/sessions/expire */
  async expire(
    id: string,
    params: ExpireCheckoutSessionInput = {}
  ): Promise<CheckoutSession> {
    return this.client.Post<CheckoutSession>(
      `/checkout/sessions/${id}/expire`,
      params
    );
  }

  /** @see /checkout/sessions/list-line-items */
  async listLineItems(
    id: string,
    params: ListCheckoutSessionLineItemsInput = {}
  ): Promise<ListResponse<CheckoutSessionLineItem>> {
    return this.client.Get<ListResponse<CheckoutSessionLineItem>>(
      `/checkout/sessions/${id}/line_items`,
      params
    );
  }

  /** @see /checkout/sessions/list */
  async list(
    params: ListCheckoutSessionsInput = {}
  ): Promise<ListResponse<CheckoutSession>> {
    const query: ListQuery = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      customer: params.customer,
      customer_account: params.customer_account,
      status: params.status,
      subscription: params.subscription,
      payment_intent: params.payment_intent,
      payment_link: params.payment_link,
    };
    if (params.customer_details) {
      query['customer_details[email]'] = params.customer_details.email;
    }
    ApplyDateFilter(query, 'created', params.created);
    return this.client.Get<ListResponse<CheckoutSession>>(
      `/checkout/sessions`,
      query
    );
  }

  /** @see /checkout/sessions/delete */
  async del(customerId: string): Promise<CheckoutSessionDeleted> {
    return this.client.Delete<CheckoutSessionDeleted>(
      `/checkout/sessions/${customerId}`
    );
  }
}
