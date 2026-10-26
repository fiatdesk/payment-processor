import { HttpClient } from '../HttpClient';
import { CheckoutSessions } from './CheckoutSessions';

/**
 * Checkout API namespace.
 *
 * @see https://docs.zoneless.com/checkout/sessions
 */
export class Checkout {
  /** Checkout Sessions API resource */
  readonly sessions: CheckoutSessions;

  constructor(client: HttpClient) {
    this.sessions = new CheckoutSessions(client);
  }
}
