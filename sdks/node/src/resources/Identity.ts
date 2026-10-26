import { HttpClient } from '../HttpClient';
import { IdentityVerificationSessions } from './IdentityVerificationSessions';

/**
 * @see https://docs.zoneless.com/identity/verification_sessions
 */
export class Identity {
  readonly verificationSessions: IdentityVerificationSessions;

  constructor(client: HttpClient) {
    this.verificationSessions = new IdentityVerificationSessions(client);
  }
}
