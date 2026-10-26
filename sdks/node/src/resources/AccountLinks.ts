import { BaseResource } from './Base';
import { AccountLink } from '@zoneless/shared-types';
import type { CreateAccountLinkInput } from '../generated/Inputs';
/**
 * @see https://docs.zoneless.com/account-links
 */
export class AccountLinks extends BaseResource {
  /** @see https://docs.zoneless.com/account-links/create */
  async create(params: CreateAccountLinkInput): Promise<AccountLink> {
    return this.client.Post<AccountLink>('/account_links', params);
  }
}
