import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { ModalComponent } from '../../../../../shared';
import { ConfigService } from '../../../../../data';
import { ConnectedAccountActionsService } from '../../services/connected-account-actions.service';
import {
  FormatClockTime,
  FormatEth,
  FormatGwei,
  PerRecipientFee,
} from '../../util/payout-fee';

@Component({
  selector: 'app-payout-modal',
  imports: [ModalComponent],
  templateUrl: './payout-modal.component.html',
  styleUrl: './payout-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayoutModalComponent {
  readonly actions = inject(ConnectedAccountActionsService);
  private readonly configService = inject(ConfigService);

  readonly isSimulatedSettlement = computed(() =>
    this.configService.IsSimulatedSettlement()
  );

  readonly step = computed(() => this.actions.payoutStep());

  /** Amount and destination are fixed once the payout exists. */
  readonly detailsEditable = computed(
    () =>
      this.step() === 'details' &&
      !this.actions.payoutCreatedId() &&
      !this.actions.payoutLoading()
  );

  readonly closeLabel = computed(() =>
    this.step() === 'details' ? 'Cancel' : 'Close'
  );

  readonly availableCents = computed(() =>
    this.actions.GetAvailableAmount(this.actions.connectedBalance())
  );

  readonly availableLabel = computed(() =>
    (this.availableCents() / 100).toFixed(2)
  );

  readonly hasBalance = computed(() => this.availableCents() > 0);

  readonly walletLabel = computed(() =>
    this.actions.FormatWalletLabel(this.actions.GetDefaultWallet())
  );

  readonly connectedSignerAddress = computed(() =>
    this.actions.walletService.GetAddress()
  );

  readonly connectedSignerLabel = computed(() => {
    const address = this.connectedSignerAddress();
    return address ? `${address.slice(0, 6)}…${address.slice(-6)}` : '';
  });

  readonly confirmLabel = computed(() => {
    const amount = this.actions.ParseAmountCents(this.actions.payoutAmount());
    const dollars = (amount / 100).toFixed(2);
    const name = this.actions.GetDisplayName();
    const wallet = this.walletLabel();
    return `Pay out US$${dollars} from ${name}'s balance to ${wallet}.`;
  });

  private readonly build = computed(() => this.actions.payoutBuildResult());

  /** Upper bound of the network fee, in ETH. */
  readonly feeEth = computed(() => {
    const build = this.build();
    return build ? FormatEth(build.estimated_fee) : '';
  });

  readonly perRecipientFeeEth = computed(() => {
    const build = this.build();
    if (!build || build.recipients_count === 0) return '';
    return FormatEth(
      PerRecipientFee(build.estimated_fee, build.recipients_count)
    );
  });

  readonly gasPriceGwei = computed(() => {
    const maxFeePerGas = this.build()?.max_fee_per_gas;
    return maxFeePerGas ? FormatGwei(maxFeePerGas) : '';
  });

  readonly signBefore = computed(() => {
    const deadline = this.build()?.deadline;
    return deadline ? FormatClockTime(deadline) : '';
  });

  readonly reservedUntil = computed(() => {
    const releaseAfter = this.build()?.release_after;
    return releaseAfter ? FormatClockTime(releaseAfter) : '';
  });

  readonly submittedHash = computed(() => this.actions.payoutSubmittedHash());

  readonly submittedHashLabel = computed(() => {
    const hash = this.submittedHash();
    return hash ? `${hash.slice(0, 10)}…${hash.slice(-8)}` : '';
  });

  readonly submittedExplorerUrl = computed(() =>
    this.configService.GetExplorerUrl('tx', this.submittedHash())
  );

  OnAmountInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.actions.payoutAmount.set(value);
  }

  OnConfirmChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.actions.payoutConfirmed.set(checked);
  }

  OnSignerMethodChange(method: 'wallet' | 'private_key'): void {
    this.actions.SetPayoutSignerMethod(method);
  }

  OnPrivateKeyInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.actions.SetPayoutPrivateKey(value);
  }
}
