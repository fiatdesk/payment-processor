import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { ApiService, GetApiErrorCode, type ApiError } from '../../core';
import { Subscription } from '@zoneless/shared-types';
import {
  CancelSubscriptionInput,
  CreateSubscriptionInput,
  ResumeSubscriptionInput,
  UpdateSubscriptionInput,
} from '@zoneless/shared-schemas';

/**
 * Shown for a 400 `onchain_plan_amount_exceeded` in place of the API's
 * words: an on-chain plan collects at most its amount once per period.
 */
export const ONCHAIN_PLAN_AMOUNT_EXCEEDED_MESSAGE =
  'An on-chain subscription bills one price at quantity 1, and nothing can raise its invoices above that price. Remove the extra items or set the quantity to 1.';

/** The same error with fixed words when an on-chain plan can't collect it. */
function WithFixedMessage(error: unknown): unknown {
  if (GetApiErrorCode(error) !== 'onchain_plan_amount_exceeded') return error;
  const { status, type, details } = error as ApiError;
  return Object.assign(new Error(ONCHAIN_PLAN_AMOUNT_EXCEEDED_MESSAGE), {
    status,
    type,
    details,
  });
}

@Injectable({
  providedIn: 'root',
})
export class SubscriptionService {
  private readonly api = inject(ApiService);

  loading: WritableSignal<boolean> = signal(false);

  async CreateSubscription(
    data: CreateSubscriptionInput
  ): Promise<Subscription> {
    this.loading.set(true);
    try {
      return await this.api.Call<Subscription>('POST', `subscriptions`, data);
    } catch (error) {
      throw WithFixedMessage(error);
    } finally {
      this.loading.set(false);
    }
  }

  async GetSubscription(
    subscriptionId: string,
    expand: string[] = ['customer']
  ): Promise<Subscription> {
    this.loading.set(true);
    try {
      const expandQuery =
        expand.length > 0 ? `?expand=${expand.join(',')}` : '';
      return await this.api.Call<Subscription>(
        'GET',
        `subscriptions/${subscriptionId}${expandQuery}`
      );
    } finally {
      this.loading.set(false);
    }
  }

  async UpdateSubscription(
    subscriptionId: string,
    data: UpdateSubscriptionInput
  ): Promise<Subscription> {
    this.loading.set(true);
    try {
      return await this.api.Call<Subscription>(
        'POST',
        `subscriptions/${subscriptionId}`,
        data
      );
    } catch (error) {
      throw WithFixedMessage(error);
    } finally {
      this.loading.set(false);
    }
  }

  async CancelSubscription(
    subscriptionId: string,
    data: CancelSubscriptionInput = {}
  ): Promise<Subscription> {
    this.loading.set(true);
    try {
      return await this.api.Call<Subscription>(
        'DELETE',
        `subscriptions/${subscriptionId}`,
        data
      );
    } finally {
      this.loading.set(false);
    }
  }

  async ResumeSubscription(
    subscriptionId: string,
    data: ResumeSubscriptionInput = {}
  ): Promise<Subscription> {
    this.loading.set(true);
    try {
      return await this.api.Call<Subscription>(
        'POST',
        `subscriptions/${subscriptionId}/resume`,
        data
      );
    } finally {
      this.loading.set(false);
    }
  }
}
