// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { BalanceService, ShortWalletAddress } from '../../../../data';
import { AccountAlertBannerComponent } from '../account-alert-banner/account-alert-banner.component';

/** USDC at one of the platform's other wallets, still to be moved. */
interface ArchivedDepositAlert {
  walletAddress: string;
  depositIds: string[];
  message: string;
}

/**
 * Home and Balances: one banner per wallet that received USDC while it was
 * not the default (Fable Q13 #2). The funds are not in the balance until
 * they are sent to the default wallet; "I've moved it" dismisses the alert.
 */
@Component({
  selector: 'app-archived-deposit-banner',
  imports: [AccountAlertBannerComponent],
  template: `
    @for (alert of alerts(); track alert.walletAddress) {
    <div class="view-section archived-deposit-alert">
      <app-account-alert-banner
        label="Funds outside your default wallet"
        [message]="alert.message"
        [actionLabel]="actionLabel()"
        (actionClicked)="Acknowledge(alert)"
      ></app-account-alert-banner>
    </div>
    }
  `,
  styleUrl: './archived-deposit-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivedDepositBannerComponent {
  private readonly balanceService = inject(BalanceService);

  readonly acknowledging = signal(false);
  readonly actionLabel = computed(() =>
    this.acknowledging() ? 'Saving…' : "I've moved it"
  );

  readonly alerts = computed<ArchivedDepositAlert[]>(() => {
    const details = this.balanceService.balanceDetails();
    if (!details) return [];
    const byWallet = new Map<string, string[]>();
    for (const deposit of details.archived_wallet_deposits ?? []) {
      const ids = byWallet.get(deposit.wallet_address) ?? [];
      byWallet.set(deposit.wallet_address, [...ids, deposit.id]);
    }
    return [...byWallet].map(([walletAddress, depositIds]) => ({
      walletAddress,
      depositIds,
      message: ArchivedDepositMessage(walletAddress, details.wallet_address),
    }));
  });

  async Acknowledge(alert: ArchivedDepositAlert): Promise<void> {
    if (this.acknowledging()) return;
    this.acknowledging.set(true);
    try {
      for (const id of alert.depositIds) {
        await this.balanceService.AcknowledgeArchivedDeposit(id);
      }
    } catch {
      // The banner stays; the next page load shows what is left.
    } finally {
      this.acknowledging.set(false);
    }
  }
}

/** The fixed banner copy (Fable Q13 #2). */
export function ArchivedDepositMessage(
  previousWallet: string,
  currentWallet: string
): string {
  return `USDC arrived at your previous wallet ${ShortWalletAddress(
    previousWallet
  )}. Send it to your current wallet ${ShortWalletAddress(
    currentWallet
  )} to make it available for payouts.`;
}
