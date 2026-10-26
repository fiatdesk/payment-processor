import { BaseResource } from './Base';
import { ApplyDateFilter } from '../utils';
import {
  PaymentIntent,
  PaymentIntentAmountDetailsLineItem,
  ListResponse,
} from '@zoneless/shared-types';
import type {
  CancelPaymentIntentInput,
  CreatePaymentIntentInput,
  ListPaymentIntentLineItemsInput,
  ListPaymentIntentsInput,
  RetrievePaymentIntentInput,
  UpdatePaymentIntentInput,
} from '../generated/Inputs';

/**
 * @see https://docs.zoneless.com/payment_intents
 */
export class PaymentIntents extends BaseResource {
  /** @see https://docs.zoneless.com/payment_intents/create */
  async create(params: CreatePaymentIntentInput): Promise<PaymentIntent> {
    return this.client.Post<PaymentIntent>('/payment_intents', params);
  }

  /** @see https://docs.zoneless.com/payment_intents/update */
  async update(
    id: string,
    params: UpdatePaymentIntentInput
  ): Promise<PaymentIntent> {
    return this.client.Post<PaymentIntent>(`/payment_intents/${id}`, params);
  }

  /** @see https://docs.zoneless.com/payment_intents/retrieve */
  async retrieve(
    id: string,
    params: RetrievePaymentIntentInput = {}
  ): Promise<PaymentIntent> {
    return this.client.Get<PaymentIntent>(`/payment_intents/${id}`, params);
  }

  /** @see https://docs.zoneless.com/payment_intents/list */
  async list(
    params: ListPaymentIntentsInput = {}
  ): Promise<ListResponse<PaymentIntent>> {
    return this.client.Get<ListResponse<PaymentIntent>>(
      '/payment_intents',
      this.BuildQuery(params)
    );
  }

  /**
   * Lists amount_details line items for a PaymentIntent.
   * @see https://docs.zoneless.com/payment_intents/amount_details_line_items
   */
  async listAmountDetailsLineItems(
    id: string,
    params: ListPaymentIntentLineItemsInput = {}
  ): Promise<ListResponse<PaymentIntentAmountDetailsLineItem>> {
    return this.client.Get<ListResponse<PaymentIntentAmountDetailsLineItem>>(
      `/payment_intents/${id}/amount_details_line_items`,
      params
    );
  }

  /**
   * Cancels a PaymentIntent.
   * @see https://docs.zoneless.com/payment_intents/cancel
   */
  async cancel(
    id: string,
    params: CancelPaymentIntentInput = {}
  ): Promise<PaymentIntent> {
    return this.client.Post<PaymentIntent>(
      `/payment_intents/${id}/cancel`,
      params
    );
  }

  private BuildQuery(
    params: ListPaymentIntentsInput
  ): Record<string, string | number | boolean | undefined> {
    const query: Record<string, string | number | boolean | undefined> = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      customer: params.customer,
      customer_account: params.customer_account,
      status: params.status,
    };

    ApplyDateFilter(query, 'created', params.created);

    return query;
  }
}
