import { Injectable, inject } from '@angular/core';
import type {
  BroadcastPayoutsBatchInput,
  BuildPayoutsBatchInput,
  CreatePayoutInput,
} from '@fiatdesk/shared-schemas';
import type {
  Payout,
  PayoutBatchBroadcastResponse,
  PayoutBatchBuildResponse,
  ReconcileResponse,
} from '@fiatdesk/shared-types';
import { ApiService } from '../../core';

/**
 * Broadcast can wait 60 s for a wallet-sent hash to appear and 60 s more for
 * confirmations, so the browser waits longer than the API.
 */
const BROADCAST_TIMEOUT_MS = 150000;

@Injectable({
  providedIn: 'root',
})
export class PayoutService {
  private readonly api = inject(ApiService);

  async CreatePayoutForConnectedAccount(
    connectedAccountId: string,
    input: CreatePayoutInput
  ): Promise<Payout> {
    return this.api.Call<Payout>('POST', 'payouts', input, {
      fiatdeskAccount: connectedAccountId,
    });
  }

  async BuildPayoutsBatch(
    input: BuildPayoutsBatchInput
  ): Promise<PayoutBatchBuildResponse> {
    return this.api.Call<PayoutBatchBuildResponse>(
      'POST',
      'payouts/build',
      input
    );
  }

  async BroadcastPayoutsBatch(
    input: BroadcastPayoutsBatchInput
  ): Promise<PayoutBatchBroadcastResponse> {
    return this.api.Call<PayoutBatchBroadcastResponse>(
      'POST',
      'payouts/broadcast',
      input,
      { timeout: BROADCAST_TIMEOUT_MS }
    );
  }

  /** Settles the platform's outstanding payout batches from the chain. */
  async Reconcile(): Promise<ReconcileResponse> {
    return this.api.Call<ReconcileResponse>('POST', 'payouts/reconcile');
  }

  async GetPayout(payoutId: string): Promise<Payout> {
    return this.api.Call<Payout>('GET', `payouts/${payoutId}`);
  }

  async CancelPayout(payoutId: string): Promise<Payout> {
    return this.api.Call<Payout>('POST', `payouts/${payoutId}/cancel`);
  }
}
