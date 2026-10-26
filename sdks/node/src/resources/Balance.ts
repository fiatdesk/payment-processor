import { BaseResource } from './Base';
import { RequestExtraOptions } from '../HttpClient';
import { Balance } from '@zoneless/shared-types';
/** @deprecated Use RequestExtraOptions instead */
export type RetrieveBalanceOptions = RequestExtraOptions;

/**
 * @see https://docs.zoneless.com/balance
 */
export class BalanceResource extends BaseResource {
  /** @see https://docs.zoneless.com/balance/retrieve */
  async retrieve(options?: RequestExtraOptions): Promise<Balance> {
    return this.client.Get<Balance>('/balance', undefined, options);
  }
}
