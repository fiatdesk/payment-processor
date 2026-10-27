import { BaseResource } from './Base';
import { LoginLink } from '@fiatdesk/shared-types';
/**
 * @see /login-links
 */
export class LoginLinks extends BaseResource {
  /** @see /login-links/create */
  async create(account: string): Promise<LoginLink> {
    return this.client.Post<LoginLink>(`/accounts/${account}/login_links`, {});
  }
}
