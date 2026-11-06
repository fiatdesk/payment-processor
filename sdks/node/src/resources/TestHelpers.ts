import { HttpClient } from '../HttpClient';
import { BaseResource } from './Base';
import { CheckoutSession } from '@fiatdesk/shared-types';

/**
 * Test helper Checkout Sessions. Platform keys only, simulated settlement only.
 *
 * @see /test-helpers/checkout/sessions
 */
export class TestHelpersCheckoutSessions extends BaseResource {
  /** Completes a quoted cross-chain checkout session with a simulated deposit. */
  async crossChainDeposit(id: string): Promise<CheckoutSession> {
    return this.client.Post<CheckoutSession>(
      `/test_helpers/checkout/sessions/${id}/cross_chain_deposit`
    );
  }
}

/**
 * Test helpers API namespace.
 */
export class TestHelpers {
  readonly checkout: { sessions: TestHelpersCheckoutSessions };

  constructor(client: HttpClient) {
    this.checkout = { sessions: new TestHelpersCheckoutSessions(client) };
  }
}
