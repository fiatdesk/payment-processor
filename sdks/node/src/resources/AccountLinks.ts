import { BaseResource } from './Base';
import { AccountLink } from '@fiatdesk/shared-types';
import type { CreateAccountLinkInput } from '../generated/Inputs';
/**
 * @see /account-links
 */
export class AccountLinks extends BaseResource {
  /** @see /account-links/create */
  async create(params: CreateAccountLinkInput): Promise<AccountLink> {
    return this.client.Post<AccountLink>('/account_links', params);
  }
}
