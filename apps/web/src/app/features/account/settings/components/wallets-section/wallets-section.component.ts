// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExternalWallet, Price, SameAddress } from '@fiatdesk/shared-types';
import {
  AccountService,
  ExternalWalletService,
  MAX_WALLETS,
  PriceService,
  ShortWalletAddress,
} from '../../../../../data';
import {
  ConfirmDialogComponent,
  CopyTextComponent,
  ExternalWalletFormComponent,
  SlidePanelComponent,
  StatusChipComponent,
} from '../../../../../shared';

/** On-chain plan keys are bytes32; simulated plans have no chain to update. */
const ONCHAIN_PLAN_ID = /^0x[0-9a-fA-F]{64}$/;

function Plans(count: number): string {
  return `${count} ${count === 1 ? 'plan' : 'plans'}`;
}

function ErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Settings → Wallets (platform): the platform's wallets, Stripe-style. The
 * default receives checkouts and top-ups, signs payouts and receives the
 * subscription plans' charges; making another wallet the default moves all
 * of that, including the plans on-chain.
 */
@Component({
  selector: 'app-wallets-section',
  imports: [
    FormsModule,
    ConfirmDialogComponent,
    CopyTextComponent,
    ExternalWalletFormComponent,
    SlidePanelComponent,
    StatusChipComponent,
  ],
  templateUrl: './wallets-section.component.html',
  styleUrl: './wallets-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletsSectionComponent implements OnInit {
  @ViewChild('addWalletForm') addWalletForm?: ExternalWalletFormComponent;

  readonly externalWalletService = inject(ExternalWalletService);
  private readonly accountService = inject(AccountService);
  private readonly priceService = inject(PriceService);

  readonly maxWallets = MAX_WALLETS;
  readonly ShortAddress = ShortWalletAddress;

  /** The default first, then the others newest first. */
  readonly wallets = computed(() => {
    const defaultId = this.externalWalletService.wallet()?.id;
    const wallets = this.externalWalletService.wallets();
    return [
      ...wallets.filter((wallet) => wallet.id === defaultId),
      ...wallets.filter((wallet) => wallet.id !== defaultId),
    ];
  });
  readonly atLimit = computed(() => this.wallets().length >= MAX_WALLETS);

  /** Active recurring prices with an on-chain plan. */
  readonly plans = signal<Price[]>([]);

  addPanelOpen = signal(false);
  addLoading = signal(false);
  addShowErrors = signal(false);
  addError = signal('');
  makeDefault = signal(false);

  setDefaultTarget = signal<ExternalWallet | null>(null);
  setDefaultLoading = signal(false);
  setDefaultError = signal('');

  removeTarget = signal<ExternalWallet | null>(null);
  removeLoading = signal(false);
  removeError = signal('');

  readonly setDefaultDescription = computed(() => {
    const target = this.setDefaultTarget();
    if (!target) return '';
    const count = this.plans().length;
    return `Checkouts, top-ups, payouts and subscription plans move to ${ShortWalletAddress(
      target.wallet_address
    )}. ${Plans(count)} will be updated on-chain.`;
  });

  readonly removeDescription = computed(() => {
    const target = this.removeTarget();
    if (!target) return '';
    return `${ShortWalletAddress(
      target.wallet_address
    )} will no longer be used. USDC sent to it in the next 30 days is flagged on Home and Balances, not added to your balance.`;
  });

  ngOnInit(): void {
    void this.LoadPlans();
  }

  async LoadPlans(): Promise<void> {
    try {
      const prices = await this.priceService.ListPlanPrices();
      this.plans.set(
        prices.filter((price) =>
          ONCHAIN_PLAN_ID.test(price.subscription_plan_id ?? '')
        )
      );
    } catch {
      // The list works without plan statuses.
    }
  }

  IsDefault(wallet: ExternalWallet): boolean {
    return wallet.id === this.externalWalletService.wallet()?.id;
  }

  /** Where the plans moving to this wallet stand, if any are moving. */
  MigrationStatus(wallet: ExternalWallet): string | null {
    const changes = this.plans()
      .map((price) => price.subscription_plan_destination_change)
      .filter((change) =>
        SameAddress(change?.destination, wallet.wallet_address)
      );
    const pending = changes.filter((c) => c?.status === 'pending').length;
    if (pending > 0) return `Updating ${Plans(pending)} on-chain`;
    const failed = changes.filter((c) => c?.status === 'failed').length;
    if (failed > 0) {
      return `${Plans(
        failed
      )} could not move: the operator key does not own them`;
    }
    return null;
  }

  OpenAddPanel(): void {
    this.addError.set('');
    this.addShowErrors.set(false);
    this.makeDefault.set(false);
    this.addPanelOpen.set(true);
  }

  CloseAddPanel(): void {
    this.addPanelOpen.set(false);
    this.addShowErrors.set(false);
  }

  async SubmitAdd(): Promise<void> {
    const form = this.addWalletForm;
    const account = this.accountService.account();
    if (!form || !account) return;
    this.addShowErrors.set(true);
    if (!form.ValidateAll()) return;

    this.addLoading.set(true);
    this.addError.set('');
    try {
      const data = form.GetFormData();
      await this.externalWalletService.AddWallet(account.id, {
        wallet_address: data.walletAddress,
        network: data.network,
        currency: data.currency,
        default_for_currency: this.makeDefault(),
      });
      this.addPanelOpen.set(false);
      if (this.makeDefault()) await this.LoadPlans();
    } catch (error) {
      this.addError.set(ErrorMessage(error, 'The wallet could not be added.'));
    } finally {
      this.addLoading.set(false);
    }
  }

  AskSetDefault(wallet: ExternalWallet): void {
    this.setDefaultError.set('');
    this.setDefaultTarget.set(wallet);
  }

  async ConfirmSetDefault(): Promise<void> {
    const target = this.setDefaultTarget();
    const account = this.accountService.account();
    if (!target || !account) return;
    this.setDefaultLoading.set(true);
    this.setDefaultError.set('');
    try {
      await this.externalWalletService.SetDefaultWallet(account.id, target.id);
      this.setDefaultTarget.set(null);
      await this.LoadPlans();
    } catch (error) {
      this.setDefaultError.set(
        ErrorMessage(error, 'The default wallet could not be changed.')
      );
    } finally {
      this.setDefaultLoading.set(false);
    }
  }

  AskRemove(wallet: ExternalWallet): void {
    this.removeError.set('');
    this.removeTarget.set(wallet);
  }

  async ConfirmRemove(): Promise<void> {
    const target = this.removeTarget();
    const account = this.accountService.account();
    if (!target || !account) return;
    this.removeLoading.set(true);
    this.removeError.set('');
    try {
      await this.externalWalletService.RemoveWallet(account.id, target.id);
      this.removeTarget.set(null);
    } catch (error) {
      this.removeError.set(
        ErrorMessage(error, 'The wallet could not be removed.')
      );
    } finally {
      this.removeLoading.set(false);
    }
  }
}
