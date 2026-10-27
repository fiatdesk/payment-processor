import {
  computed,
  inject,
  Injectable,
  signal,
  WritableSignal,
} from '@angular/core';
import { Subject } from 'rxjs';
import type {
  Account,
  AccountLink,
  Balance,
  ExternalWallet,
  LoginLink,
  PayoutBatchBroadcastResponse,
  PayoutBatchBuildResponse,
  ReconcileResponse,
} from '@zoneless/shared-types';
import type {
  BroadcastPayoutsBatchInput,
  CreateAccountInput,
} from '@zoneless/shared-schemas';
import { IsRejectedAccountReason } from '@zoneless/shared-schemas';
import {
  AccountService,
  AccountLinkService,
  BalanceService,
  ConfigService,
  ExternalWalletService,
  IdentityService,
  PayoutService,
  TopupService,
  TransferService,
} from '../../../../data';
import {
  ExpectedTransaction,
  GetApiErrorType,
  IsUserRejectedError,
  WalletNotReadyError,
  WalletService,
} from '../../../../core';
import { FormatBusinessType, GetCountryName } from '../../../../utils';
import { FormatClockTime } from '../util/payout-fee';

export type CreateConnectedAccountStep = 'summary' | 'edit-details' | 'success';

export type BusinessType =
  | 'individual'
  | 'company'
  | 'non_profit'
  | 'government_entity';

export type ConnectedAccountActionEvent =
  | {
      type: 'created';
      account: Account;
      accountLink: AccountLink;
    }
  | { type: 'updated'; account: Account }
  | { type: 'funds_added'; accountId: string }
  | { type: 'funds_pulled'; accountId: string }
  | { type: 'payout_processed'; accountId: string };

/**
 * Payout modal steps. On-chain: `details` creates and builds, `approval`
 * signs the wallet's one-time allowance, `review` shows the fee and signs,
 * `submitted` waits for confirmations (its only action is Reconcile).
 */
export type PayoutStep = 'details' | 'approval' | 'review' | 'submitted';

/** What the modal offers after a build refused because of another batch. */
export type PayoutRecovery = 'none' | 'reconcile' | 'reconcile_or_replace';

/** Seconds a dashboard-built payout stays signable (and its payout held). */
const PAYOUT_DEADLINE_SECONDS = 300;

const RECOVERY_FOR_BUILD_ERROR: Record<string, PayoutRecovery> = {
  payout_batch_in_progress: 'reconcile_or_replace',
  payout_batch_in_flight: 'reconcile',
  payout_batch_already_paid: 'reconcile',
};

const SUBMITTED_NOTICE = 'Submitted, waiting for confirmations.';

export interface ConnectedAccountDraft {
  country: string;
  businessType: BusinessType;
  transfersRequested: boolean;
}

const DEFAULT_DRAFT: ConnectedAccountDraft = {
  country: 'US',
  businessType: 'individual',
  transfersRequested: true,
};

@Injectable()
export class ConnectedAccountActionsService {
  private readonly accountService = inject(AccountService);
  private readonly accountLinkService = inject(AccountLinkService);
  private readonly balanceService = inject(BalanceService);
  private readonly transferService = inject(TransferService);
  private readonly externalWalletService = inject(ExternalWalletService);
  private readonly payoutService = inject(PayoutService);
  private readonly topupService = inject(TopupService);
  private readonly configService = inject(ConfigService);
  private readonly identityService = inject(IdentityService);
  readonly walletService = inject(WalletService);

  // ── Create flow ──────────────────────────────────────────────────────────
  flowOpen: WritableSignal<boolean> = signal(false);
  step: WritableSignal<CreateConnectedAccountStep> = signal('summary');
  loading: WritableSignal<boolean> = signal(false);
  error: WritableSignal<string> = signal('');

  country: WritableSignal<string> = signal(DEFAULT_DRAFT.country);
  businessType: WritableSignal<BusinessType> = signal(
    DEFAULT_DRAFT.businessType
  );
  transfersRequested: WritableSignal<boolean> = signal(
    DEFAULT_DRAFT.transfersRequested
  );

  draftCountry: WritableSignal<string> = signal(DEFAULT_DRAFT.country);
  draftBusinessType: WritableSignal<BusinessType> = signal(
    DEFAULT_DRAFT.businessType
  );
  draftTransfersRequested: WritableSignal<boolean> = signal(
    DEFAULT_DRAFT.transfersRequested
  );

  createdAccount: WritableSignal<Account | null> = signal(null);
  createdAccountLink: WritableSignal<AccountLink | null> = signal(null);
  linkCopied: WritableSignal<boolean> = signal(false);

  // ── Detail page modals ───────────────────────────────────────────────────
  activeAccount: WritableSignal<Account | null> = signal(null);
  platformBalance: WritableSignal<Balance | null> = signal(null);
  connectedBalance: WritableSignal<Balance | null> = signal(null);
  externalWallets: WritableSignal<ExternalWallet[]> = signal([]);

  addFundsOpen: WritableSignal<boolean> = signal(false);
  addFundsAmount: WritableSignal<string> = signal('');
  addFundsTransferGroup: WritableSignal<string> = signal('');
  addFundsConfirmed: WritableSignal<boolean> = signal(false);
  addFundsLoading: WritableSignal<boolean> = signal(false);
  addFundsError: WritableSignal<string> = signal('');

  pullFundsOpen: WritableSignal<boolean> = signal(false);
  pullFundsAmount: WritableSignal<string> = signal('');
  pullFundsLoading: WritableSignal<boolean> = signal(false);
  pullFundsError: WritableSignal<string> = signal('');

  payoutOpen: WritableSignal<boolean> = signal(false);
  payoutAmount: WritableSignal<string> = signal('');
  payoutConfirmed: WritableSignal<boolean> = signal(false);
  payoutLoading: WritableSignal<boolean> = signal(false);
  payoutError: WritableSignal<string> = signal('');
  payoutSignerMethod: WritableSignal<'wallet' | 'private_key'> =
    signal('wallet');
  payoutPrivateKey: WritableSignal<string> = signal('');
  payoutPrivateKeyAddress: WritableSignal<string> = signal('');
  payoutPlatformWalletAddress: WritableSignal<string> = signal('');
  payoutCreatedId: WritableSignal<string> = signal('');
  payoutBuildResult: WritableSignal<PayoutBatchBuildResponse | null> =
    signal(null);
  payoutStep: WritableSignal<PayoutStep> = signal('details');
  payoutRecovery: WritableSignal<PayoutRecovery> = signal('none');
  payoutNotice: WritableSignal<string> = signal('');
  /** Hash of the submitted transaction, once one is known */
  payoutSubmittedHash: WritableSignal<string> = signal('');

  profilePanelOpen: WritableSignal<boolean> = signal(false);

  loginLinkOpen: WritableSignal<boolean> = signal(false);
  loginLinkLoading: WritableSignal<boolean> = signal(false);
  loginLink: WritableSignal<LoginLink | null> = signal(null);
  loginLinkCopied: WritableSignal<boolean> = signal(false);
  loginLinkError: WritableSignal<string> = signal('');

  verificationLinkOpen: WritableSignal<boolean> = signal(false);
  verificationLinkLoading: WritableSignal<boolean> = signal(false);
  verificationLinkUrl: WritableSignal<string | null> = signal(null);
  verificationLinkCopied: WritableSignal<boolean> = signal(false);
  verificationLinkError: WritableSignal<string> = signal('');

  metadataDialogOpen: WritableSignal<boolean> = signal(false);
  metadataSaving: WritableSignal<boolean> = signal(false);
  metadataDraft: WritableSignal<Record<string, string>> = signal({});

  pausePaymentsOpen: WritableSignal<boolean> = signal(false);
  pausePayoutsOpen: WritableSignal<boolean> = signal(false);
  resumePaymentsOpen: WritableSignal<boolean> = signal(false);
  resumePayoutsOpen: WritableSignal<boolean> = signal(false);
  rejectOpen: WritableSignal<boolean> = signal(false);
  unrejectOpen: WritableSignal<boolean> = signal(false);
  platformActionLoading: WritableSignal<boolean> = signal(false);
  platformActionError: WritableSignal<string> = signal('');

  rejectReason: WritableSignal<'fraud' | 'terms_of_service' | 'other'> =
    signal('fraud');
  rejectPausePayouts: WritableSignal<boolean> = signal(true);

  readonly canSubmitAddFunds = computed(() => {
    const amount = this.ParseAmountCents(this.addFundsAmount());
    const available = this.GetAvailableAmount(this.platformBalance());
    return (
      amount > 0 &&
      amount <= available &&
      this.addFundsConfirmed() &&
      !this.addFundsLoading()
    );
  });

  readonly canSubmitPullFunds = computed(() => {
    const amount = this.ParseAmountCents(this.pullFundsAmount());
    const available = this.GetAvailableAmount(this.connectedBalance());
    return amount > 0 && amount <= available && !this.pullFundsLoading();
  });

  readonly canSubmitPayout = computed(() => {
    if (this.payoutLoading()) return false;
    const step = this.payoutStep();
    if (step === 'submitted') return true;

    const signerReady =
      this.configService.IsSimulatedSettlement() || this.IsPayoutSignerReady();
    if (step !== 'details') return signerReady;

    // Once the payout exists its amount is debited, so the balance no longer
    // bounds it.
    const amount = this.ParseAmountCents(this.payoutAmount());
    const available = this.GetAvailableAmount(this.connectedBalance());
    const amountValid =
      !!this.payoutCreatedId() || (amount > 0 && amount <= available);
    return (
      amountValid &&
      !!this.GetDefaultWallet() &&
      !!this.activeAccount()?.payouts_enabled &&
      signerReady &&
      this.payoutConfirmed()
    );
  });

  readonly payoutSubmitLabel = computed(() => {
    switch (this.payoutStep()) {
      case 'approval':
        return 'Approve USDC';
      case 'review':
        return 'Sign and pay out';
      case 'submitted':
        return 'Reconcile';
      default:
        return this.configService.IsSimulatedSettlement()
          ? 'Pay out'
          : 'Review payout';
    }
  });

  readonly events$ = new Subject<ConnectedAccountActionEvent>();

  // ── Create flow methods ──────────────────────────────────────────────────

  OpenCreate(): void {
    this.ResetDraft();
    this.step.set('summary');
    this.error.set('');
    this.createdAccount.set(null);
    this.createdAccountLink.set(null);
    this.linkCopied.set(false);
    this.flowOpen.set(true);
  }

  CloseFlow(): void {
    this.flowOpen.set(false);
    this.step.set('summary');
    this.error.set('');
    this.loading.set(false);
    this.linkCopied.set(false);
  }

  OpenEditDetails(): void {
    this.draftCountry.set(this.country());
    this.draftBusinessType.set(this.businessType());
    this.draftTransfersRequested.set(this.transfersRequested());
    this.step.set('edit-details');
  }

  BackToSummary(): void {
    this.step.set('summary');
  }

  SaveDetails(): void {
    this.country.set(this.draftCountry());
    this.businessType.set(this.draftBusinessType());
    this.transfersRequested.set(this.draftTransfersRequested());
    this.step.set('summary');
  }

  async Create(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const input = this.BuildCreateInput();
      const account = await this.accountService.CreateAccount(input);

      const origin = window.location.origin;
      const accountLink = await this.accountLinkService.CreateAccountLink({
        account: account.id,
        type: 'account_onboarding',
        return_url: `${origin}/account/connected-accounts`,
        refresh_url: `${origin}/account/connected-accounts`,
      });

      this.createdAccount.set(account);
      this.createdAccountLink.set(accountLink);
      this.step.set('success');
      this.events$.next({ type: 'created', account, accountLink });
    } catch (err) {
      console.error('Failed to create connected account:', err);
      this.error.set(
        err instanceof Error
          ? err.message
          : 'Failed to create connected account. Please try again.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  async CopyOnboardingLink(): Promise<void> {
    const url = this.createdAccountLink()?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 1500);
    } catch {
      // Clipboard may be unavailable in some contexts
    }
  }

  GetCountryDisplayName(code: string = this.country()): string {
    return GetCountryName(code) || code;
  }

  GetBusinessTypeLabel(type: BusinessType = this.businessType()): string {
    return FormatBusinessType(type);
  }

  GetCapabilitiesLabel(): string {
    return this.transfersRequested() ? 'Transfers' : 'None';
  }

  GetExpiresInLabel(): string {
    const link = this.createdAccountLink();
    if (!link) return '';
    const secondsLeft = link.expires_at - Math.floor(Date.now() / 1000);
    if (secondsLeft <= 0) return 'Expired';
    const hours = Math.floor(secondsLeft / 3600);
    if (hours >= 24) {
      const days = Math.round(hours / 24);
      return `Expires in ${days} day${days === 1 ? '' : 's'}.`;
    }
    if (hours >= 1) {
      return `Expires in ${hours} hour${hours === 1 ? '' : 's'}.`;
    }
    const minutes = Math.max(1, Math.round(secondsLeft / 60));
    return `Expires in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  }

  GetProgressPercent(): number {
    switch (this.step()) {
      case 'edit-details':
        return 50;
      case 'summary':
        return 90;
      case 'success':
        return 100;
    }
  }

  // ── Detail page helpers ──────────────────────────────────────────────────

  SetActiveAccount(account: Account | null): void {
    this.activeAccount.set(account);
  }

  async RefreshBalances(accountId: string): Promise<void> {
    const [platformBalance, connectedBalance] = await Promise.all([
      this.balanceService.GetBalance(),
      this.balanceService.GetBalance(accountId),
    ]);
    this.platformBalance.set(platformBalance);
    this.connectedBalance.set(connectedBalance);
  }

  async LoadExternalWallets(accountId: string): Promise<void> {
    try {
      const wallets = await this.externalWalletService.GetExternalWallets(
        accountId
      );
      this.externalWallets.set(wallets);
    } catch {
      this.externalWallets.set([]);
    }
  }

  GetAvailableAmount(balance: Balance | null): number {
    if (!balance) return 0;
    return balance.available.find((b) => b.currency === 'usdc')?.amount ?? 0;
  }

  GetPendingAmount(balance: Balance | null): number {
    if (!balance) return 0;
    return balance.pending.find((b) => b.currency === 'usdc')?.amount ?? 0;
  }

  GetDisplayName(account: Account | null = this.activeAccount()): string {
    if (!account) return 'Connected account';
    return this.accountService.GetConnectedAccountDisplayName(account);
  }

  GetDefaultWallet(): ExternalWallet | null {
    const wallets = this.externalWallets();
    if (!wallets.length) return null;
    return wallets.find((w) => w.default_for_currency) ?? wallets[0];
  }

  FormatWalletLabel(wallet: ExternalWallet | null): string {
    if (!wallet) return 'No external wallet';
    const network = wallet.network
      ? wallet.network.charAt(0).toUpperCase() + wallet.network.slice(1)
      : 'Ethereum';
    return `${network} wallet •••• ${wallet.last4}`;
  }

  // ── Add funds ────────────────────────────────────────────────────────────

  async OpenAddFunds(account: Account): Promise<void> {
    this.activeAccount.set(account);
    this.addFundsAmount.set('');
    this.addFundsTransferGroup.set('');
    this.addFundsConfirmed.set(false);
    this.addFundsError.set('');
    this.addFundsLoading.set(false);
    try {
      const platformBalance = await this.balanceService.GetBalance();
      this.platformBalance.set(platformBalance);
    } catch {
      this.platformBalance.set(null);
    }
    this.addFundsOpen.set(true);
  }

  CloseAddFunds(): void {
    this.addFundsOpen.set(false);
    this.addFundsError.set('');
    this.addFundsLoading.set(false);
  }

  ParseAmountCents(raw: string): number {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    if (!cleaned) return 0;
    const value = Number.parseFloat(cleaned);
    if (Number.isNaN(value) || value <= 0) return 0;
    return Math.round(value * 100);
  }

  async ConfirmAddFunds(): Promise<void> {
    const account = this.activeAccount();
    if (!account || !this.canSubmitAddFunds()) return;

    const amount = this.ParseAmountCents(this.addFundsAmount());
    this.addFundsLoading.set(true);
    this.addFundsError.set('');
    try {
      const transferGroup = this.addFundsTransferGroup().trim();
      await this.transferService.CreateTransfer({
        amount,
        currency: 'usdc',
        destination: account.id,
        ...(transferGroup ? { transfer_group: transferGroup } : {}),
      });
      this.events$.next({ type: 'funds_added', accountId: account.id });
      this.CloseAddFunds();
    } catch (err) {
      this.addFundsError.set(
        err instanceof Error ? err.message : 'Failed to add funds.'
      );
    } finally {
      this.addFundsLoading.set(false);
    }
  }

  // ── Pull funds ───────────────────────────────────────────────────────────

  async OpenPullFunds(account: Account): Promise<void> {
    this.activeAccount.set(account);
    this.pullFundsAmount.set('');
    this.pullFundsError.set('');
    this.pullFundsLoading.set(false);
    try {
      const connectedBalance = await this.balanceService.GetBalance(account.id);
      this.connectedBalance.set(connectedBalance);
    } catch {
      this.connectedBalance.set(null);
    }
    this.pullFundsOpen.set(true);
  }

  ClosePullFunds(): void {
    this.pullFundsOpen.set(false);
    this.pullFundsError.set('');
    this.pullFundsLoading.set(false);
  }

  async ConfirmPullFunds(): Promise<void> {
    const account = this.activeAccount();
    const platform = this.accountService.account();
    if (!account || !platform || !this.canSubmitPullFunds()) return;

    const amount = this.ParseAmountCents(this.pullFundsAmount());
    this.pullFundsLoading.set(true);
    this.pullFundsError.set('');
    try {
      await this.transferService.CreateTransferForConnectedAccount(account.id, {
        amount,
        currency: 'usdc',
        destination: platform.id,
      });
      this.events$.next({ type: 'funds_pulled', accountId: account.id });
      this.ClosePullFunds();
    } catch (err) {
      this.pullFundsError.set(
        err instanceof Error ? err.message : 'Failed to pull funds.'
      );
    } finally {
      this.pullFundsLoading.set(false);
    }
  }

  // ── Payout ───────────────────────────────────────────────────────────────

  async OpenPayout(account: Account): Promise<void> {
    this.activeAccount.set(account);
    this.payoutAmount.set('');
    this.payoutConfirmed.set(false);
    this.payoutError.set('');
    this.payoutLoading.set(false);
    this.ResetPayoutSigner();
    try {
      const [connectedBalance, , depositInfo] = await Promise.all([
        this.balanceService.GetBalance(account.id),
        this.LoadExternalWallets(account.id),
        this.topupService.GetDepositInfo(),
        this.configService.LoadConfig(),
      ]);
      this.connectedBalance.set(connectedBalance);
      this.payoutPlatformWalletAddress.set(depositInfo.wallet_address);
    } catch {
      this.connectedBalance.set(null);
      this.payoutError.set('Failed to load payout signing details.');
    }
    this.payoutOpen.set(true);
  }

  async ClosePayout(): Promise<void> {
    const pendingPayoutId = this.payoutCreatedId();
    if (pendingPayoutId) {
      // A built or broadcast batch holds its payout until it is paid or its
      // deadline passes, and the API refuses to cancel it before then.
      if (this.IsPayoutUnheld()) {
        try {
          await this.payoutService.CancelPayout(pendingPayoutId);
        } catch {
          // The payout may already be terminal.
        }
      }
      const account = this.activeAccount();
      if (account) {
        this.events$.next({
          type: 'payout_processed',
          accountId: account.id,
        });
      }
    }

    this.payoutOpen.set(false);
    this.payoutError.set('');
    this.payoutLoading.set(false);
    this.ResetPayoutSigner();
  }

  /** The modal's primary action for the current step. */
  async ConfirmPayout(): Promise<void> {
    const account = this.activeAccount();
    if (!account || !this.canSubmitPayout()) return;

    await this.RunPayoutAction(async () => {
      switch (this.payoutStep()) {
        case 'details':
          return this.StartPayout(account);
        case 'approval':
        case 'review':
          return this.SignAndSubmit(account);
        case 'submitted':
          return this.ReconcileAndCheck(account);
      }
    });
  }

  /**
   * Settles outstanding batches from the chain. While submitted, it then
   * reports where this payout stands; it never sends anything again.
   */
  async ReconcilePayout(): Promise<void> {
    const account = this.activeAccount();
    if (!account || this.payoutLoading()) return;
    await this.RunPayoutAction(() => this.ReconcileAndCheck(account));
  }

  /** Builds with `replace: true` after a batch conflict the user saw. */
  async ReplaceOutstandingBatch(): Promise<void> {
    const account = this.activeAccount();
    if (!account || this.payoutLoading()) return;
    await this.RunPayoutAction(() => this.StartPayout(account, true));
  }

  GetPayoutSignerAddress(): string {
    return this.payoutSignerMethod() === 'wallet'
      ? this.walletService.GetAddress()
      : this.payoutPrivateKeyAddress();
  }

  async ConnectPayoutWallet(): Promise<void> {
    this.payoutError.set('');
    try {
      this.ValidatePayoutSignerAddress(await this.walletService.Connect());
    } catch (error) {
      this.payoutError.set(
        error instanceof Error ? error.message : 'Failed to connect wallet.'
      );
    }
  }

  async ValidatePayoutPrivateKey(): Promise<void> {
    this.payoutPrivateKeyAddress.set('');
    const privateKey = this.payoutPrivateKey().trim();
    if (!privateKey) return;

    try {
      const address = await this.walletService.GetPrivateKeyAddress(privateKey);
      this.ValidatePayoutSignerAddress(address);
      this.payoutPrivateKeyAddress.set(address);
      this.payoutError.set('');
    } catch (error) {
      this.payoutError.set(
        error instanceof Error ? error.message : 'Invalid private key.'
      );
    }
  }

  SetPayoutSignerMethod(method: 'wallet' | 'private_key'): void {
    this.payoutSignerMethod.set(method);
    this.payoutError.set('');
  }

  SetPayoutPrivateKey(privateKey: string): void {
    this.payoutPrivateKey.set(privateKey);
    this.payoutPrivateKeyAddress.set('');
    this.payoutError.set('');
  }

  private ValidatePayoutSignerAddress(address: string): void {
    const expected = this.payoutPlatformWalletAddress();
    if (!address || address.toLowerCase() !== expected.toLowerCase()) {
      throw new Error(
        'Signer does not match the configured platform payout wallet'
      );
    }
  }

  private IsPayoutSignerReady(): boolean {
    const signer = this.GetPayoutSignerAddress();
    const expected = this.payoutPlatformWalletAddress();
    return !!signer && signer.toLowerCase() === expected.toLowerCase();
  }

  /** True while no batch holds the created payout, so it can be canceled. */
  private IsPayoutUnheld(): boolean {
    const build = this.payoutBuildResult();
    // An approval batch holds no payouts.
    if (build?.transaction_type === 'approval') return true;
    return this.payoutStep() === 'details' && !build;
  }

  private async RunPayoutAction(action: () => Promise<void>): Promise<void> {
    this.payoutLoading.set(true);
    this.payoutError.set('');
    this.payoutNotice.set('');
    try {
      await action();
    } catch (err) {
      this.payoutError.set(
        err instanceof Error ? err.message : 'Failed to process payout.'
      );
    } finally {
      this.payoutLoading.set(false);
    }
  }

  /** Creates and builds the payout; the simulated rail settles at once. */
  private async StartPayout(account: Account, replace = false): Promise<void> {
    const simulated = this.configService.IsSimulatedSettlement();
    // A simulated build left by a failed broadcast still holds the wallet.
    const build =
      (simulated && !replace && this.payoutBuildResult()) ||
      (await this.BuildPayout(account, replace));
    if (simulated) {
      await this.BroadcastSimulated(account.id, build);
      return;
    }
    this.payoutStep.set(
      build.transaction_type === 'approval' ? 'approval' : 'review'
    );
  }

  private async BuildPayout(
    account: Account,
    replace = false
  ): Promise<PayoutBatchBuildResponse> {
    const payoutId = await this.EnsurePayoutCreated(account);
    this.payoutRecovery.set('none');
    try {
      const build = await this.payoutService.BuildPayoutsBatch({
        payouts: [payoutId],
        deadline_seconds: PAYOUT_DEADLINE_SECONDS,
        ...(replace ? { replace: true } : {}),
      });
      this.payoutBuildResult.set(build);
      return build;
    } catch (error) {
      this.payoutRecovery.set(
        RECOVERY_FOR_BUILD_ERROR[GetApiErrorType(error) ?? ''] ?? 'none'
      );
      throw error;
    }
  }

  private async EnsurePayoutCreated(account: Account): Promise<string> {
    const existing = this.payoutCreatedId();
    if (existing) return existing;

    const wallet = this.GetDefaultWallet();
    if (!wallet) throw new Error('This account has no external wallet.');
    const statementDescriptor =
      account.settings?.payouts?.statement_descriptor?.trim() ?? '';
    const payout = await this.payoutService.CreatePayoutForConnectedAccount(
      account.id,
      {
        amount: this.ParseAmountCents(this.payoutAmount()),
        currency: 'usdc',
        destination: wallet.id,
        method: 'instant',
        ...(statementDescriptor
          ? { statement_descriptor: statementDescriptor }
          : {}),
      }
    );
    this.payoutCreatedId.set(payout.id);
    return payout.id;
  }

  private async BroadcastSimulated(
    accountId: string,
    build: PayoutBatchBuildResponse
  ): Promise<void> {
    const result = await this.payoutService.BroadcastPayoutsBatch({
      signed_transaction: build.unsigned_transaction,
      payouts: build.payouts.map((payout) => payout.id),
    });
    this.events$.next({ type: 'payout_processed', accountId });
    this.ClearPayoutRetryState();
    if (result.status === 'failed') {
      this.payoutError.set(
        result.failure_message || 'Failed to process payout.'
      );
      return;
    }
    await this.ClosePayout();
  }

  /** Signs the built transaction (approval or payout) and broadcasts it. */
  private async SignAndSubmit(account: Account): Promise<void> {
    const build = this.payoutBuildResult();
    if (!build) return;
    const chainId = this.configService.GetChainId();
    if (chainId === null || !build.to) {
      throw new Error('This instance did not report the chain to pay on.');
    }
    if (build.deadline !== null && Date.now() / 1000 >= build.deadline) {
      this.EnterSubmitted(
        `The signing window closed at ${FormatClockTime(
          build.deadline
        )}. Reconcile after ${FormatClockTime(
          build.release_after ?? build.deadline
        )} to build the payout again.`
      );
      return;
    }

    const expected: ExpectedTransaction = {
      from: this.payoutPlatformWalletAddress(),
      to: build.to,
      chainId,
    };
    const submission =
      this.payoutSignerMethod() === 'wallet'
        ? await this.SendFromWallet(build, expected)
        : await this.SignWithPrivateKey(build, expected);
    if (!submission) return;

    // Known before the broadcast, so the operator can look it up if the
    // broadcast fails.
    const hash =
      'transaction_hash' in submission
        ? submission.transaction_hash
        : await this.walletService.SignedTransactionHash(
            submission.signed_transaction
          );
    await this.SubmitBatch(
      account,
      { ...submission, payouts: build.payouts.map((payout) => payout.id) },
      hash
    );
  }

  /** Null when the wallet may have sent it: the modal then only reconciles. */
  private async SendFromWallet(
    build: PayoutBatchBuildResponse,
    expected: ExpectedTransaction
  ): Promise<{ transaction_hash: string } | null> {
    await this.walletService.EnsureChain(expected.chainId);
    const { to, data } = await this.walletService.ReadBuiltTransaction(
      build.unsigned_transaction,
      expected
    );
    try {
      const hash = await this.walletService.SendTransaction({
        from: expected.from,
        to,
        data,
        chainId: expected.chainId,
      });
      return { transaction_hash: hash };
    } catch (error) {
      if (error instanceof WalletNotReadyError) throw error;
      if (IsUserRejectedError(error)) {
        const until = build.deadline
          ? ` before ${FormatClockTime(build.deadline)}`
          : '';
        throw new Error(
          `The transaction was rejected in the wallet. Sign again${until}, or close.`
        );
      }
      this.EnterSubmitted(
        "The wallet did not confirm whether it sent the transaction. Check the wallet's activity, then reconcile; do not send it again."
      );
      this.payoutError.set(
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  private async SignWithPrivateKey(
    build: PayoutBatchBuildResponse,
    expected: ExpectedTransaction
  ): Promise<{ signed_transaction: string }> {
    try {
      const signed = await this.walletService.SignTransactionWithPrivateKey(
        build.unsigned_transaction,
        this.payoutPrivateKey(),
        expected
      );
      return { signed_transaction: signed };
    } finally {
      // The pasted key signs once and is never kept.
      this.payoutPrivateKey.set('');
      this.payoutPrivateKeyAddress.set('');
    }
  }

  private async SubmitBatch(
    account: Account,
    submission: BroadcastPayoutsBatchInput,
    hash: string
  ): Promise<void> {
    this.payoutSubmittedHash.set(hash);
    let result: PayoutBatchBroadcastResponse;
    try {
      result = await this.payoutService.BroadcastPayoutsBatch(submission);
    } catch (error) {
      // It may still reach the chain (timeout, transaction_not_found, ...).
      this.EnterSubmitted();
      this.payoutError.set(
        error instanceof Error ? error.message : 'Broadcast failed.'
      );
      return;
    }
    this.events$.next({ type: 'payout_processed', accountId: account.id });
    this.payoutSubmittedHash.set(result.transaction_hash);

    if (result.status === 'pending') {
      this.EnterSubmitted();
    } else if (result.status === 'failed') {
      this.EnterSubmitted('');
      this.payoutError.set(
        result.failure_message || 'The transaction failed on-chain.'
      );
    } else if (result.transaction_type === 'approval') {
      // The approval is spent: if the next build fails, start from details
      // rather than offering to send the approval again.
      this.payoutBuildResult.set(null);
      this.payoutStep.set('details');
      await this.ContinueAfterApproval(account);
    } else {
      this.ClearPayoutRetryState();
      await this.ClosePayout();
    }
  }

  private async ContinueAfterApproval(account: Account): Promise<void> {
    const build = await this.BuildPayout(account);
    this.payoutSubmittedHash.set('');
    if (build.transaction_type === 'approval') {
      this.payoutStep.set('approval');
      this.payoutNotice.set(
        'The earlier approval did not take effect. Approve again to continue.'
      );
      return;
    }
    this.payoutStep.set('review');
    this.payoutNotice.set(
      this.payoutSignerMethod() === 'private_key'
        ? 'Approval confirmed. Paste the private key again to sign the payout.'
        : 'Approval confirmed. Review the payout and sign it.'
    );
  }

  private async ReconcileAndCheck(account: Account): Promise<void> {
    const result = await this.payoutService.Reconcile();
    this.events$.next({ type: 'payout_processed', accountId: account.id });
    if (this.payoutStep() !== 'submitted') {
      this.payoutRecovery.set('none');
      this.payoutNotice.set(ReconcileSummary(result));
      return;
    }
    if (this.payoutBuildResult()?.transaction_type === 'approval') {
      await this.CheckApproval(account);
      return;
    }

    const payout = await this.payoutService.GetPayout(this.payoutCreatedId());
    if (payout.status === 'paid') {
      this.ClearPayoutRetryState();
      await this.ClosePayout();
    } else if (payout.status === 'failed') {
      this.payoutError.set(
        `The payout failed${
          payout.failure_message ? `: ${payout.failure_message}` : ''
        }. Its amount was returned to the connected account's balance.`
      );
    } else if (payout.status === 'pending' && !payout.payout_batch) {
      // Released after its deadline without being mined: build it afresh.
      this.payoutBuildResult.set(null);
      this.payoutSubmittedHash.set('');
      this.payoutStep.set('details');
      this.payoutNotice.set(
        'The payout was not sent and is pending again. Review it to build a new transaction, or close to cancel it.'
      );
    } else {
      this.payoutNotice.set('Not settled yet. Reconcile again in a minute.');
    }
  }

  /** The approval has settled once the wallet can build again. */
  private async CheckApproval(account: Account): Promise<void> {
    try {
      await this.ContinueAfterApproval(account);
    } catch (error) {
      if (GetApiErrorType(error) !== 'payout_batch_in_progress') throw error;
      this.payoutRecovery.set('none');
      this.payoutNotice.set(
        'The approval is still waiting for confirmations. Reconcile again in a minute.'
      );
    }
  }

  private EnterSubmitted(notice = SUBMITTED_NOTICE): void {
    this.payoutStep.set('submitted');
    this.payoutNotice.set(notice);
  }

  private ResetPayoutSigner(): void {
    this.payoutSignerMethod.set('wallet');
    this.payoutPlatformWalletAddress.set('');
    this.ClearPayoutRetryState();
  }

  private ClearPayoutRetryState(): void {
    this.payoutPrivateKey.set('');
    this.payoutPrivateKeyAddress.set('');
    this.payoutCreatedId.set('');
    this.payoutBuildResult.set(null);
    this.payoutStep.set('details');
    this.payoutRecovery.set('none');
    this.payoutNotice.set('');
    this.payoutSubmittedHash.set('');
  }

  // ── Profile panel ────────────────────────────────────────────────────────

  OpenProfile(account: Account): void {
    this.activeAccount.set(account);
    this.profilePanelOpen.set(true);
  }

  CloseProfile(): void {
    this.profilePanelOpen.set(false);
  }

  // ── Login link ───────────────────────────────────────────────────────────

  async OpenLoginLink(account: Account): Promise<void> {
    this.activeAccount.set(account);
    this.loginLink.set(null);
    this.loginLinkCopied.set(false);
    this.loginLinkError.set('');
    this.loginLinkOpen.set(true);
    this.loginLinkLoading.set(true);
    try {
      const link = await this.accountService.CreateLoginLink(account.id);
      this.loginLink.set(link);
    } catch (err) {
      this.loginLinkError.set(
        err instanceof Error
          ? err.message
          : 'Failed to create login link. Please try again.'
      );
    } finally {
      this.loginLinkLoading.set(false);
    }
  }

  CloseLoginLink(): void {
    this.loginLinkOpen.set(false);
    this.loginLink.set(null);
    this.loginLinkCopied.set(false);
    this.loginLinkError.set('');
    this.loginLinkLoading.set(false);
  }

  async CopyLoginLink(): Promise<void> {
    const url = this.loginLink()?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.loginLinkCopied.set(true);
      setTimeout(() => this.loginLinkCopied.set(false), 2000);
    } catch {
      this.loginLinkError.set('Could not copy to clipboard.');
    }
  }

  // ── Identity verification link ───────────────────────────────────────────

  async OpenVerificationLink(account: Account): Promise<void> {
    this.activeAccount.set(account);
    this.verificationLinkUrl.set(null);
    this.verificationLinkCopied.set(false);
    this.verificationLinkError.set('');
    this.verificationLinkOpen.set(true);
    this.verificationLinkLoading.set(true);
    try {
      const session = await this.identityService.CreateVerificationSession({
        type: 'document',
        related_account: account.id,
      });
      if (!session.url) {
        this.verificationLinkError.set(
          'Verification session was created but no link was returned.'
        );
        return;
      }
      this.verificationLinkUrl.set(session.url);
    } catch (err) {
      this.verificationLinkError.set(
        err instanceof Error
          ? err.message
          : 'Failed to create verification link. Please try again.'
      );
    } finally {
      this.verificationLinkLoading.set(false);
    }
  }

  CloseVerificationLink(): void {
    this.verificationLinkOpen.set(false);
    this.verificationLinkUrl.set(null);
    this.verificationLinkCopied.set(false);
    this.verificationLinkError.set('');
    this.verificationLinkLoading.set(false);
  }

  async CopyVerificationLink(): Promise<void> {
    const url = this.verificationLinkUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.verificationLinkCopied.set(true);
      setTimeout(() => this.verificationLinkCopied.set(false), 2000);
    } catch {
      this.verificationLinkError.set('Could not copy to clipboard.');
    }
  }

  // ── Metadata ─────────────────────────────────────────────────────────────

  OpenEditMetadata(account: Account): void {
    this.activeAccount.set(account);
    this.metadataDraft.set({ ...(account.metadata ?? {}) });
    this.metadataDialogOpen.set(true);
  }

  OnMetadataChange(metadata: Record<string, string>): void {
    this.metadataDraft.set(metadata);
  }

  async ConfirmEditMetadata(): Promise<void> {
    const account = this.activeAccount();
    if (!account) return;
    this.metadataSaving.set(true);
    try {
      const updated = await this.accountService.UpdateAccount(account.id, {
        metadata: this.metadataDraft(),
      });
      this.activeAccount.set(updated);
      this.events$.next({ type: 'updated', account: updated });
      this.metadataDialogOpen.set(false);
    } catch (err) {
      console.error('Failed to update metadata:', err);
    } finally {
      this.metadataSaving.set(false);
    }
  }

  // ── Pause / resume payments & payouts ────────────────────────────────────

  OpenPausePayments(account: Account): void {
    this.BeginPlatformAction(account);
    this.pausePaymentsOpen.set(true);
  }

  OpenResumePayments(account: Account): void {
    this.BeginPlatformAction(account);
    this.resumePaymentsOpen.set(true);
  }

  OpenPausePayouts(account: Account): void {
    this.BeginPlatformAction(account);
    this.pausePayoutsOpen.set(true);
  }

  OpenResumePayouts(account: Account): void {
    this.BeginPlatformAction(account);
    this.resumePayoutsOpen.set(true);
  }

  ClosePausePayments(): void {
    this.pausePaymentsOpen.set(false);
    this.ClearPlatformActionState();
  }

  CloseResumePayments(): void {
    this.resumePaymentsOpen.set(false);
    this.ClearPlatformActionState();
  }

  ClosePausePayouts(): void {
    this.pausePayoutsOpen.set(false);
    this.ClearPlatformActionState();
  }

  CloseResumePayouts(): void {
    this.resumePayoutsOpen.set(false);
    this.ClearPlatformActionState();
  }

  async ConfirmPausePayments(): Promise<void> {
    await this.RunChargesToggle(false, () => this.ClosePausePayments());
  }

  async ConfirmResumePayments(): Promise<void> {
    await this.RunChargesToggle(true, () => this.CloseResumePayments());
  }

  async ConfirmPausePayouts(): Promise<void> {
    await this.RunPayoutsToggle(false, () => this.ClosePausePayouts());
  }

  async ConfirmResumePayouts(): Promise<void> {
    await this.RunPayoutsToggle(true, () => this.CloseResumePayouts());
  }

  // ── Reject / unreject ────────────────────────────────────────────────────

  OpenReject(account: Account): void {
    this.BeginPlatformAction(account);
    this.rejectReason.set('fraud');
    this.rejectPausePayouts.set(true);
    this.rejectOpen.set(true);
  }

  CloseReject(): void {
    this.rejectOpen.set(false);
    this.ClearPlatformActionState();
  }

  OpenUnreject(account: Account): void {
    this.BeginPlatformAction(account);
    this.unrejectOpen.set(true);
  }

  CloseUnreject(): void {
    this.unrejectOpen.set(false);
    this.ClearPlatformActionState();
  }

  async ConfirmReject(): Promise<void> {
    const account = this.activeAccount();
    if (!account || this.platformActionLoading()) return;

    this.platformActionLoading.set(true);
    this.platformActionError.set('');
    try {
      const updated = await this.accountService.RejectAccount(account.id, {
        reason: this.rejectReason(),
        pause_payouts: this.rejectPausePayouts(),
      });
      this.EmitUpdated(updated);
      this.CloseReject();
    } catch (err) {
      this.platformActionError.set(
        err instanceof Error ? err.message : 'Failed to reject account.'
      );
    } finally {
      this.platformActionLoading.set(false);
    }
  }

  async ConfirmUnreject(): Promise<void> {
    const account = this.activeAccount();
    if (!account || this.platformActionLoading()) return;

    this.platformActionLoading.set(true);
    this.platformActionError.set('');
    try {
      const updated = await this.accountService.UnrejectAccount(account.id);
      this.EmitUpdated(updated);
      this.CloseUnreject();
    } catch (err) {
      this.platformActionError.set(
        err instanceof Error ? err.message : 'Failed to unreject account.'
      );
    } finally {
      this.platformActionLoading.set(false);
    }
  }

  IsAccountRejected(account: Account | null = this.activeAccount()): boolean {
    return IsRejectedAccountReason(account?.requirements?.disabled_reason);
  }

  private BeginPlatformAction(account: Account): void {
    this.activeAccount.set(account);
    this.platformActionError.set('');
    this.platformActionLoading.set(false);
  }

  private ClearPlatformActionState(): void {
    this.platformActionError.set('');
    this.platformActionLoading.set(false);
  }

  private EmitUpdated(account: Account): void {
    this.activeAccount.set(account);
    this.events$.next({ type: 'updated', account });
  }

  private async RunChargesToggle(
    enabled: boolean,
    close: () => void
  ): Promise<void> {
    const account = this.activeAccount();
    if (!account || this.platformActionLoading()) return;

    this.platformActionLoading.set(true);
    this.platformActionError.set('');
    try {
      const updated = await this.accountService.SetChargesEnabled(
        account.id,
        enabled
      );
      this.EmitUpdated(updated);
      close();
    } catch (err) {
      this.platformActionError.set(
        err instanceof Error
          ? err.message
          : enabled
          ? 'Failed to resume payments.'
          : 'Failed to pause payments.'
      );
    } finally {
      this.platformActionLoading.set(false);
    }
  }

  private async RunPayoutsToggle(
    enabled: boolean,
    close: () => void
  ): Promise<void> {
    const account = this.activeAccount();
    if (!account || this.platformActionLoading()) return;

    this.platformActionLoading.set(true);
    this.platformActionError.set('');
    try {
      const updated = await this.accountService.SetPayoutsEnabled(
        account.id,
        enabled
      );
      this.EmitUpdated(updated);
      close();
    } catch (err) {
      this.platformActionError.set(
        err instanceof Error
          ? err.message
          : enabled
          ? 'Failed to resume payouts.'
          : 'Failed to pause payouts.'
      );
    } finally {
      this.platformActionLoading.set(false);
    }
  }

  private BuildCreateInput(): CreateAccountInput {
    const input: CreateAccountInput = {
      type: 'express',
      country: this.country(),
      business_type: this.businessType(),
    };

    if (this.transfersRequested()) {
      input.capabilities = {
        transfers: { requested: true },
      };
    }

    return input;
  }

  private ResetDraft(): void {
    this.country.set(DEFAULT_DRAFT.country);
    this.businessType.set(DEFAULT_DRAFT.businessType);
    this.transfersRequested.set(DEFAULT_DRAFT.transfersRequested);
    this.draftCountry.set(DEFAULT_DRAFT.country);
    this.draftBusinessType.set(DEFAULT_DRAFT.businessType);
    this.draftTransfersRequested.set(DEFAULT_DRAFT.transfersRequested);
  }
}

function ReconcileSummary(result: ReconcileResponse): string {
  if (result.reconciled === 0) return 'No payout batches were outstanding.';
  return `Reconciled ${result.reconciled} payout batch${
    result.reconciled === 1 ? '' : 'es'
  }: ${result.paid} paid, ${result.failed} failed, ${
    result.pending
  } still waiting.`;
}
