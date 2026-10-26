import { BaseResource } from './Base';
import { LoginLink } from '@zoneless/shared-types';
/**
 * @see https://docs.zoneless.com/login-links
 */
export class LoginLinks extends BaseResource {
  /** @see https://docs.zoneless.com/login-links/create */
  async create(account: string): Promise<LoginLink> {
    return this.client.Post<LoginLink>(`/accounts/${account}/login_links`, {});
  }
}
