import { BaseResource } from './Base';
import { ExternalWallet, ListResponse } from '@fiatdesk/shared-types';
import type {
  CreateExternalWalletInput,
  UpdateExternalWalletInput,
  ListExternalWalletsInput,
} from '../generated/Inputs';
/** Response returned when an external wallet is deleted */
export interface ExternalWalletDeletedResponse {
  id: string;
  object: 'wallet';
  deleted: true;
}

/**
 * External Accounts (Wallets) API resource.
 * External wallets are Ethereum addresses for receiving USDC payouts.
 * @see /external-wallets
 */
export class ExternalAccounts extends BaseResource {
  /** @see /external-wallets/create */
  async create(
    accountId: string,
    params: CreateExternalWalletInput
  ): Promise<ExternalWallet> {
    return this.client.Post<ExternalWallet>(
      `/accounts/${accountId}/external_accounts`,
      params
    );
  }

  /** @see /external-wallets/retrieve */
  async retrieve(
    accountId: string,
    externalAccountId: string
  ): Promise<ExternalWallet> {
    return this.client.Get<ExternalWallet>(
      `/accounts/${accountId}/external_accounts/${externalAccountId}`
    );
  }

  /** @see /external-wallets/update */
  async update(
    accountId: string,
    externalAccountId: string,
    params: UpdateExternalWalletInput
  ): Promise<ExternalWallet> {
    return this.client.Post<ExternalWallet>(
      `/accounts/${accountId}/external_accounts/${externalAccountId}`,
      params
    );
  }

  /** @see /external-wallets/delete */
  async del(
    accountId: string,
    externalAccountId: string
  ): Promise<ExternalWalletDeletedResponse> {
    return this.client.Delete<ExternalWalletDeletedResponse>(
      `/accounts/${accountId}/external_accounts/${externalAccountId}`
    );
  }

  /** @see /external-wallets/list */
  async list(
    accountId: string,
    params: ListExternalWalletsInput = {}
  ): Promise<ListResponse<ExternalWallet>> {
    const query: Record<string, string | number | undefined> = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      include_usdc_balance:
        params.include_usdc_balance === undefined
          ? undefined
          : String(params.include_usdc_balance),
    };

    return this.client.Get<ListResponse<ExternalWallet>>(
      `/accounts/${accountId}/external_accounts`,
      query
    );
  }
}
