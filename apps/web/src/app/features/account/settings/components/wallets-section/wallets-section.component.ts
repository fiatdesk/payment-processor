// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
  ExternalWalletCreateInput,
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
/** After a switch, plan statuses are read again this often, this many times. */
export const PLAN_POLL_INTERVAL_MS = 5_000;
export const PLAN_POLL_ATTEMPTS = 24;

/** What a confirmed switch makes the default: a listed wallet, or one to add. */
interface SwitchTarget {
  address: string;
  wallet: ExternalWallet | null;
  add: ExternalWalletCreateInput | null;
}

function Plans(count: number): string {
  return `${count} ${count === 1 ? 'plan' : 'plans'}`;
}

/** `12.50 USDC` */
export function FormatUsdc(amount: number): string {
  return `${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })} USDC`;
}

function ErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Settings → Wallets (platform): the platform's wallets, Stripe-style, each
 * with its on-chain USDC. The default receives checkouts and top-ups, signs
 * payouts and receives the subscription plans' charges; making another
 * wallet the default moves all of that, including the plans on-chain, but
 * not the USDC already held, which the confirm says.
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
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

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

  setDefaultTarget = signal<SwitchTarget | null>(null);
  setDefaultLoading = signal(false);
  setDefaultError = signal('');

  removeTarget = signal<ExternalWallet | null>(null);
  removeLoading = signal(false);
  removeError = signal('');

  readonly setDefaultDescription = computed(() => {
    const target = this.setDefaultTarget();
    if (!target) return '';
    const moving = this.plans().filter(
      (price) =>
        !SameAddress(price.subscription_plan_destination, target.address)
    ).length;
    const parts = [
      `Checkouts, top-ups, payouts and subscription plans move to ${ShortWalletAddress(
        target.address
      )}. ${Plans(moving)} will be updated on-chain.`,
    ];
    const current = this.externalWalletService.wallet();
    if (
      current &&
      !SameAddress(current.wallet_address, target.address) &&
      typeof current.usdc_balance === 'number'
    ) {
      parts.push(
        `Your USDC stays in ${ShortWalletAddress(
          current.wallet_address
        )} (${FormatUsdc(
          current.usdc_balance
        )}). Send it to ${ShortWalletAddress(
          target.address
        )} after switching. Until then, your available balance counts only the new wallet, and payouts above that amount will fail.`
      );
    }
    return parts.join(' ');
  });

  readonly removeDescription = computed(() => {
    const target = this.removeTarget();
    if (!target) return '';
    const parts = [
      `${ShortWalletAddress(
        target.wallet_address
      )} will no longer be used. USDC sent to it in the next 30 days is flagged on Home and Balances, not added to your balance.`,
    ];
    if (typeof target.usdc_balance === 'number' && target.usdc_balance > 0) {
      parts.push(
        `It still holds ${FormatUsdc(
          target.usdc_balance
        )}: send it to your default wallet first.`
      );
    }
    return parts.join(' ');
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.StopWatching());
  }

  ngOnInit(): void {
    const account = this.accountService.account();
    if (account) {
      void this.externalWalletService
        .GetExternalWallets(account.id, { usdcBalance: true })
        .catch(() => undefined);
    }
    void this.LoadPlans().then(() => this.WatchPlanMigrations());
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

  /** The wallet's on-chain USDC, when the chain could be read. */
  Balance(wallet: ExternalWallet): string | null {
    return typeof wallet.usdc_balance === 'number'
      ? FormatUsdc(wallet.usdc_balance)
      : null;
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

  /**
   * Adds the wallet. Made the default while another wallet is the default,
   * it switches, so the switch's confirm comes first.
   */
  async SubmitAdd(): Promise<void> {
    const form = this.addWalletForm;
    if (!form) return;
    this.addShowErrors.set(true);
    if (!form.ValidateAll()) return;

    const data = form.GetFormData();
    const input: ExternalWalletCreateInput = {
      wallet_address: data.walletAddress,
      network: data.network,
      currency: data.currency,
      default_for_currency: this.makeDefault(),
    };
    if (this.makeDefault() && this.externalWalletService.wallet()) {
      this.setDefaultError.set('');
      this.setDefaultTarget.set({
        address: data.walletAddress,
        wallet: null,
        add: input,
      });
      return;
    }
    this.addLoading.set(true);
    this.addError.set('');
    try {
      await this.Add(input);
    } catch (error) {
      this.addError.set(ErrorMessage(error, 'The wallet could not be added.'));
    } finally {
      this.addLoading.set(false);
    }
  }

  AskSetDefault(wallet: ExternalWallet): void {
    this.setDefaultError.set('');
    this.setDefaultTarget.set({
      address: wallet.wallet_address,
      wallet,
      add: null,
    });
  }

  async ConfirmSetDefault(): Promise<void> {
    const target = this.setDefaultTarget();
    const account = this.accountService.account();
    if (!target || !account) return;
    this.setDefaultLoading.set(true);
    this.setDefaultError.set('');
    try {
      if (target.add) {
        await this.Add(target.add);
      } else if (target.wallet) {
        await this.externalWalletService.SetDefaultWallet(
          account.id,
          target.wallet.id,
          { usdcBalance: true }
        );
      }
      this.setDefaultTarget.set(null);
      await this.LoadPlans();
      this.WatchPlanMigrations();
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
      await this.externalWalletService.RemoveWallet(account.id, target.id, {
        usdcBalance: true,
      });
      this.removeTarget.set(null);
    } catch (error) {
      this.removeError.set(
        ErrorMessage(error, 'The wallet could not be removed.')
      );
    } finally {
      this.removeLoading.set(false);
    }
  }

  private async Add(input: ExternalWalletCreateInput): Promise<void> {
    const account = this.accountService.account();
    if (!account) return;
    await this.externalWalletService.AddWallet(account.id, input, {
      usdcBalance: true,
    });
    this.addPanelOpen.set(false);
  }

  /**
   * Reads the plan statuses again until no change is pending, for at most
   * 2 minutes: the billing run confirms the changes.
   */
  private WatchPlanMigrations(attempt = 0): void {
    this.StopWatching();
    const pending = this.plans().some(
      (price) =>
        price.subscription_plan_destination_change?.status === 'pending'
    );
    if (!pending || attempt >= PLAN_POLL_ATTEMPTS) return;
    this.pollTimer = setTimeout(async () => {
      await this.LoadPlans();
      this.WatchPlanMigrations(attempt + 1);
    }, PLAN_POLL_INTERVAL_MS);
  }

  private StopWatching(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }
}
