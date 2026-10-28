// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  Injectable,
  inject,
  signal,
  WritableSignal,
  computed,
} from '@angular/core';
import { ApiService } from '../../core';
import { ExternalWallet, SameAddress } from '@fiatdesk/shared-types';
import { SettingsCardRow } from '../../shared';

/**
 * Input type for creating an external wallet.
 * Only wallet_address is required - other fields have sensible defaults.
 */
export interface ExternalWalletCreateInput {
  wallet_address: string;
  network?: string;
  country?: string;
  currency?: string;
  account_holder_name?: string | null;
  account_holder_type?: 'individual' | 'company' | null;
  default_for_currency?: boolean | null;
  metadata?: Record<string, string>;
}

/** Most active wallets an account can hold (the API refuses a sixth). */
export const MAX_WALLETS = 5;

@Injectable({
  providedIn: 'root',
})
export class ExternalWalletService {
  private readonly api = inject(ApiService);

  loading: WritableSignal<boolean> = signal(false);
  /** The account's active wallets, newest first (as the API lists them). */
  wallets: WritableSignal<ExternalWallet[]> = signal([]);

  /**
   * The default wallet: the one flagged `default_for_currency`. Without a
   * flagged one, the newest, which the API makes the default on its next read.
   */
  wallet = computed<ExternalWallet | null>(() => {
    const wallets = this.wallets();
    return wallets.find((w) => w.default_for_currency) ?? wallets[0] ?? null;
  });

  Reset(): void {
    this.wallets.set([]);
  }

  /**
   * Replace the default wallet ("Edit payout wallet"): add the new address
   * as the default, then remove the old wallet. The first wallet of an
   * account is simply added.
   */
  async SaveExternalWallet(
    accountId: string,
    data: ExternalWalletCreateInput
  ): Promise<ExternalWallet> {
    this.loading.set(true);
    try {
      const existingWallet = this.wallet();

      if (
        existingWallet &&
        SameAddress(existingWallet.wallet_address, data.wallet_address)
      ) {
        return existingWallet;
      }

      const wallet = await this.Create(accountId, {
        ...data,
        default_for_currency: true,
      });
      if (existingWallet) {
        await this.api.Call<void>(
          'DELETE',
          `accounts/${accountId}/external_accounts/${existingWallet.id}`
        );
      }
      await this.GetExternalWallets(accountId);
      return wallet;
    } finally {
      this.loading.set(false);
    }
  }

  /** Add a wallet; `default_for_currency: true` also makes it the default. */
  async AddWallet(
    accountId: string,
    data: ExternalWalletCreateInput
  ): Promise<ExternalWallet> {
    const wallet = await this.Create(accountId, data);
    await this.GetExternalWallets(accountId);
    return wallet;
  }

  /** Make the wallet the default: it then receives and pays everything. */
  async SetDefaultWallet(accountId: string, walletId: string): Promise<void> {
    await this.api.Call<ExternalWallet>(
      'POST',
      `accounts/${accountId}/external_accounts/${walletId}`,
      { default_for_currency: true }
    );
    await this.GetExternalWallets(accountId);
  }

  /** Remove a wallet that is not the default. */
  async RemoveWallet(accountId: string, walletId: string): Promise<void> {
    await this.api.Call<void>(
      'DELETE',
      `accounts/${accountId}/external_accounts/${walletId}`
    );
    await this.GetExternalWallets(accountId);
  }

  async GetExternalWallets(accountId: string): Promise<ExternalWallet[]> {
    const response = await this.api.Call<{ data: ExternalWallet[] }>(
      'GET',
      `accounts/${accountId}/external_accounts`
    );
    this.wallets.set(response.data || []);
    return this.wallets();
  }

  GetWalletTitle(): string {
    const wallet = this.wallet();
    if (!wallet?.wallet_address) return '';
    return ShortWalletAddress(wallet.wallet_address);
  }

  GetFullWalletAddress(): string {
    return this.wallet()?.wallet_address || '';
  }

  private Create(
    accountId: string,
    data: ExternalWalletCreateInput
  ): Promise<ExternalWallet> {
    return this.api.Call<ExternalWallet>(
      'POST',
      `accounts/${accountId}/external_accounts`,
      data
    );
  }

  private GetNetworkDisplay(): string {
    const wallet = this.wallet();
    if (!wallet?.network) return 'Ethereum';
    return wallet.network.charAt(0).toUpperCase() + wallet.network.slice(1);
  }

  private GetCurrencyDisplay(): string {
    const wallet = this.wallet();
    return wallet?.currency?.toUpperCase() || 'USDC';
  }

  GetSettingsCardRows(): SettingsCardRow[] {
    const wallet = this.wallet();
    if (!wallet) return [];

    return [
      {
        label: 'Network',
        value: this.GetNetworkDisplay(),
        type: 'text',
      },
      {
        label: 'Currency',
        value: this.GetCurrencyDisplay(),
        type: 'text',
      },
      {
        label: 'Wallet address',
        value: this.GetWalletTitle(),
        type: 'text',
      },
    ];
  }
}

/** `0x1234...abcd` */
export function ShortWalletAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
