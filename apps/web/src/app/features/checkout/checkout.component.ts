// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { MetaService, WalletService } from '../../core';
import {
  CheckoutSessionService,
  ReadConfirmRetry,
} from '../../data/services/checkout-session.service';
import { ConfigService } from '../../data/services/config.service';
import {
  LoaderComponent,
  PageLoaderComponent,
  WalletGuideComponent,
} from '../../shared';
import { ISO_CODES } from '../../utils';
import {
  CheckoutPaymentTransaction,
  CheckoutSession,
  CheckoutSessionCustomField,
  CheckoutSessionLineItem,
  IsTransactionHash,
  Price,
  Product,
  SameAddress,
} from '@fiatdesk/shared-types';
import {
  CheckoutCollectionOptions,
  CustomFieldLabel,
  GetCheckoutCollectionOptions,
} from './util/checkout-collection';
import {
  BuildCheckoutConfirmationSections,
  CheckoutConfirmationSection,
  DEFAULT_CHECKOUT_CONFIRMATION_MESSAGE,
  GetCheckoutConfirmationMessage,
  GetCheckoutRedirectUrl,
  HasCheckoutConfirmationDetails,
} from './util/checkout-completion';
import {
  FormatUsdcAmount,
  GetCheckoutBusyLabel,
  GetCheckoutSubmitLabel,
} from './util/checkout-format';
import {
  BuildMobileWalletOptions,
  IsMobileBrowser,
  MobileWalletOption,
} from './util/mobile-wallet';
import {
  AlreadyConfirmingMessage,
  CheckoutErrorMessage,
  CheckoutPaymentConfirmer,
  PayAcrossWalletChange,
  PaymentPhase,
  ReadSignatureRequired,
  RequireAuthorizationTypedData,
  ShortAddress,
  ShortHash,
  SignAsPrepared,
  SignatureRequiredError,
  StillConfirmingError,
} from './util/checkout-payment';
import {
  CheckoutSubscriber,
  CheckoutTrial,
  CheckoutTrialSummary,
  SubscribeTerms,
} from './util/checkout-subscription';
import { TEST_WALLET_DATA } from '../../utils/constants/test-data';

type AddressFormValue = {
  name: string;
  country: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
};

type PreparedAddress = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

type CustomerDetailsPayload = {
  email?: string;
  name?: string;
  business_name?: string;
  phone?: string;
  address?: PreparedAddress;
  shipping_address?: PreparedAddress & { name?: string };
  tax_id?: string;
  custom_fields?: { key: string; value: string }[];
  terms_of_service_accepted?: boolean;
};

function EmptyAddressForm(): AddressFormValue {
  return {
    name: '',
    country: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
  };
}

function HasAddressDetails(form: AddressFormValue): boolean {
  return !!(
    form.line2.trim() ||
    form.city.trim() ||
    form.state.trim() ||
    form.postalCode.trim()
  );
}

@Component({
  selector: 'app-checkout',
  imports: [
    FormsModule,
    PageLoaderComponent,
    LoaderComponent,
    WalletGuideComponent,
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly checkoutSessionService = inject(CheckoutSessionService);
  private readonly configService = inject(ConfigService);
  private readonly metaService = inject(MetaService);
  private readonly walletService = inject(WalletService);

  checkoutSession: WritableSignal<CheckoutSession | null> = signal(null);
  loading: WritableSignal<boolean> = signal(true);
  paymentPhase: WritableSignal<PaymentPhase> = signal('idle');
  paymentError: WritableSignal<string | null> = signal(null);
  /** Progress of a payment that is confirming. */
  paymentNotice: WritableSignal<string | null> = signal(null);
  /** The relayed payment transaction, once the API reports it. */
  pendingTransactionHash: WritableSignal<string | null> = signal(null);
  /** Polling stopped before the payment confirmed. */
  stillConfirming: WritableSignal<boolean> = signal(false);
  /**
   * The wallet that must sign this session's payment again; another wallet
   * cannot pay it until it expires, so Pay is off.
   */
  blockedByWallet: WritableSignal<string | null> = signal(null);
  /** The subscription terms the wallet is asked to sign, once prepared. */
  subscribeTerms: WritableSignal<SubscribeTerms | null> = signal(null);
  simulatedWalletOpen: WritableSignal<boolean> = signal(false);
  confirmationExpanded: WritableSignal<boolean> = signal(false);
  billingAddressExpanded: WritableSignal<boolean> = signal(false);
  shippingAddressExpanded: WritableSignal<boolean> = signal(false);

  readonly countryOptions = [...ISO_CODES].sort((a, b) =>
    a.country.localeCompare(b.country)
  );

  email = '';
  name = '';
  businessName = '';
  phone = '';
  billingAddress = EmptyAddressForm();
  shippingAddress = EmptyAddressForm();
  taxId = '';
  promotionCode = '';
  termsAccepted = false;
  customFieldValues: Record<string, string> = {};

  private readonly confirmer = new CheckoutPaymentConfirmer(
    this.checkoutSessionService,
    {
      phase: this.paymentPhase,
      notice: this.paymentNotice,
      transactionHash: this.pendingTransactionHash,
    }
  );

  private readonly subscriber = new CheckoutSubscriber(
    this.walletService,
    this.confirmer,
    this.subscribeTerms
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.confirmer.Stop());
    // The wallet switched to the payer that must sign again: it may pay.
    effect(() => {
      const account = this.walletService.account();
      if (SameAddress(account, untracked(this.blockedByWallet))) {
        this.blockedByWallet.set(null);
        this.paymentError.set(null);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    const urlSlug = this.route.snapshot.paramMap.get('checkoutSessionId');
    if (!urlSlug) return;
    await Promise.all([
      this.LoadCheckoutSession(urlSlug),
      this.configService.LoadConfig().catch(() => undefined),
    ]);
    await this.ResumeRecordedPayment();
  }

  /**
   * A relay recorded before this page loaded (a reload, or another tab) is
   * confirmed by its hash, without the wallet: a payment, or a subscribe,
   * which may finish even after the session's `expires_at`.
   */
  private async ResumeRecordedPayment(): Promise<void> {
    const session = this.checkoutSession();
    const transactionHash = session?.payment_details?.transaction_hash;
    if (!session || session.status !== 'open' || !transactionHash) return;
    this.confirmer.ShowConfirming(transactionHash);
    try {
      this.CompletePayment(
        await this.ConfirmOrSignAgain(session, transactionHash, null)
      );
    } catch (error) {
      this.HandlePaymentError(error);
    }
  }

  private async LoadCheckoutSession(urlSlug: string): Promise<void> {
    this.loading.set(true);
    try {
      const checkoutSession =
        await this.checkoutSessionService.GetPublicCheckoutSession(urlSlug);
      this.checkoutSession.set(checkoutSession);
      this.email =
        checkoutSession.customer_email ??
        checkoutSession.customer_details?.email ??
        '';
      this.name =
        checkoutSession.customer_details?.individual_name ??
        checkoutSession.collected_information?.individual_name ??
        '';
      this.businessName =
        checkoutSession.customer_details?.business_name ??
        checkoutSession.collected_information?.business_name ??
        '';
      this.phone = checkoutSession.customer_details?.phone ?? '';
      this.billingAddress = this.ToAddressForm(
        checkoutSession.customer_details?.address
      );
      const shipping = checkoutSession.collected_information?.shipping_details;
      this.shippingAddress = this.ToAddressForm(
        shipping?.address,
        shipping?.name
      );
      this.billingAddressExpanded.set(HasAddressDetails(this.billingAddress));
      this.shippingAddressExpanded.set(HasAddressDetails(this.shippingAddress));
      this.taxId = checkoutSession.customer_details?.tax_ids?.[0]?.value ?? '';
      this.customFieldValues = Object.fromEntries(
        (checkoutSession.custom_fields ?? []).map((field) => [
          field.key,
          this.CustomFieldValue(field),
        ])
      );
      this.metaService.SetMetaTitle(`${this.MerchantName()} - Checkout`);
      if (checkoutSession.status === 'complete') {
        this.paymentPhase.set('complete');
        this.HandleAfterCompletion(checkoutSession);
      }
    } finally {
      this.loading.set(false);
    }
  }

  CollectionOptions(): CheckoutCollectionOptions {
    const session = this.checkoutSession();
    if (!session) {
      return {
        collectCustomerNames: false,
        collectBusinessNames: false,
        collectBillingAddresses: false,
        collectShippingAddresses: false,
        collectPhone: false,
        allowPromotionCodes: false,
        requireTerms: false,
        collectTaxIds: false,
      };
    }
    return GetCheckoutCollectionOptions(session);
  }

  IsEmailLocked(): boolean {
    return !!this.checkoutSession()?.customer && !!this.email.trim();
  }

  CustomFields(): CheckoutSessionCustomField[] {
    return this.checkoutSession()?.custom_fields ?? [];
  }

  readonly FieldLabel = CustomFieldLabel;

  LineItems(): CheckoutSessionLineItem[] {
    return this.checkoutSession()?.line_items?.data ?? [];
  }

  MerchantName(): string {
    return this.checkoutSession()?.merchant?.display_name || 'Merchant';
  }

  MerchantIconUrl(): string | null {
    return this.checkoutSession()?.merchant?.icon_url ?? null;
  }

  MerchantTermsUrl(): string | null {
    return this.checkoutSession()?.merchant?.terms_url ?? null;
  }

  MerchantPrivacyUrl(): string | null {
    return this.checkoutSession()?.merchant?.privacy_url ?? null;
  }

  IsSubscription(): boolean {
    return this.checkoutSession()?.mode === 'subscription';
  }

  RecurringIntervalLabel(): string | null {
    const price = this.PrimaryPrice();
    const interval = price?.recurring?.interval;
    if (!interval) return null;
    const count = price?.recurring?.interval_count ?? 1;
    if (count === 1) return interval;
    return `${count} ${interval}s`;
  }

  PrimaryPrice(): Price | null {
    const price = this.LineItems()[0]?.price;
    if (!price || typeof price === 'string') return null;
    return price;
  }

  LineItemCadence(item: CheckoutSessionLineItem): string | null {
    const price = item.price;
    if (!price || typeof price === 'string' || !price.recurring) return null;
    const count = price.recurring.interval_count ?? 1;
    const interval = price.recurring.interval;
    if (count === 1) return `every ${interval}`;
    return `every ${count} ${interval}s`;
  }

  IsBusy(): boolean {
    const phase = this.paymentPhase();
    return (
      phase === 'awaiting_wallet' ||
      phase === 'processing' ||
      phase === 'confirming'
    );
  }

  IsComplete(): boolean {
    return this.paymentPhase() === 'complete';
  }

  /** True until wallet discovery settles; the page waits for it. */
  IsDetectingWallet(): boolean {
    return (
      !this.IsSimulatedSettlement() && !this.walletService.discoveryComplete()
    );
  }

  /** Mobile browsers without an injected wallet reopen in a wallet app. */
  NeedsMobileWalletHandoff(): boolean {
    if (this.IsSimulatedSettlement() || this.IsDetectingWallet()) return false;
    if (typeof navigator === 'undefined') return false;
    return (
      IsMobileBrowser(navigator.userAgent, navigator.maxTouchPoints) &&
      !this.walletService.HasWallet()
    );
  }

  NeedsWalletSetup(): boolean {
    if (this.IsSimulatedSettlement() || this.IsDetectingWallet()) return false;
    if (typeof navigator === 'undefined') return false;
    return !this.walletService.HasWallet() && !this.NeedsMobileWalletHandoff();
  }

  MobileWalletOptions(): MobileWalletOption[] {
    if (typeof window === 'undefined') return [];
    return BuildMobileWalletOptions(window.location.href);
  }

  IsSimulatedSettlement(): boolean {
    return this.configService.IsSimulatedSettlement();
  }

  SimulatedPayerLabel(): string {
    const address = TEST_WALLET_DATA.walletAddress;
    return `${address.slice(0, 6)}…${address.slice(-6)}`;
  }

  async Pay(): Promise<void> {
    const session = this.checkoutSession();
    if (!session) return;

    if (this.paymentPhase() !== 'idle' || this.IsPayBlocked()) return;

    const validationError = this.ValidateCollectedDetails();
    if (validationError) {
      this.paymentError.set(validationError);
      return;
    }

    this.paymentError.set(null);
    this.stillConfirming.set(false);

    if (this.IsSimulatedSettlement()) {
      this.simulatedWalletOpen.set(true);
      return;
    }

    try {
      const completedSession = this.confirmer.CanCheckAgain(session)
        ? await this.ConfirmOrSignAgain(
            session,
            this.pendingTransactionHash(),
            this.walletService.GetAddress() || null
          )
        : await this.PayWithWallet(session);
      this.CompletePayment(completedSession);
    } catch (error) {
      this.HandlePaymentError(error);
    }
  }

  async ApproveSimulatedWallet(): Promise<void> {
    const session = this.checkoutSession();
    if (!session) return;

    this.simulatedWalletOpen.set(false);
    this.paymentPhase.set('awaiting_wallet');
    const payerWallet = TEST_WALLET_DATA.walletAddress;
    try {
      const prepared = await this.PreparePayment(session, payerWallet);
      const completedSession =
        (await this.subscriber.ConfirmExisting(session, prepared)) ??
        (await this.confirmer.Confirm(session, {
          transaction_hash: `sim_sig:${prepared.checkout_session}:${payerWallet}`,
        }));
      this.CompletePayment(completedSession);
    } catch (error) {
      this.HandlePaymentError(error);
    }
  }

  DeclineSimulatedWallet(): void {
    this.simulatedWalletOpen.set(false);
    this.paymentError.set('Payment was declined');
  }

  ConfirmationMessage(): string {
    const session = this.checkoutSession();
    if (!session) return DEFAULT_CHECKOUT_CONFIRMATION_MESSAGE;
    return GetCheckoutConfirmationMessage(session);
  }

  ConfirmationSubtitle(): string {
    return `A payment to ${this.MerchantName()} will appear on your statement.`;
  }

  ConfirmationSections(): CheckoutConfirmationSection[] {
    const session = this.checkoutSession();
    if (!session) return [];
    return BuildCheckoutConfirmationSections(session, (cents) =>
      this.FormatAmount(cents)
    );
  }

  VisibleConfirmationSections(): CheckoutConfirmationSection[] {
    const sections = this.ConfirmationSections();
    if (this.confirmationExpanded()) return sections;
    return sections.filter((section) => !section.detailOnly);
  }

  CanExpandConfirmation(): boolean {
    return HasCheckoutConfirmationDetails(this.ConfirmationSections());
  }

  ToggleConfirmationDetails(): void {
    this.confirmationExpanded.update((expanded) => !expanded);
  }

  IsRedirecting(): boolean {
    const session = this.checkoutSession();
    return !!session && !!GetCheckoutRedirectUrl(session);
  }

  ExpandBillingAddress(): void {
    this.billingAddressExpanded.set(true);
  }

  ExpandShippingAddress(): void {
    this.shippingAddressExpanded.set(true);
  }

  private ValidateCollectedDetails(): string | null {
    const session = this.checkoutSession();
    const options = this.CollectionOptions();
    if (!this.email.trim()) return 'Email is required';
    if (
      options.collectCustomerNames &&
      !session?.name_collection?.individual?.optional &&
      !this.name.trim()
    ) {
      return 'Name is required';
    }
    if (
      options.collectBusinessNames &&
      !session?.name_collection?.business?.optional &&
      !this.businessName.trim()
    ) {
      return 'Business name is required';
    }
    if (options.collectPhone && !this.phone.trim()) {
      return 'Phone number is required';
    }
    if (options.collectBillingAddresses) {
      const billingError = this.ValidateAddressForm(
        this.billingAddress,
        'Billing address'
      );
      if (billingError) {
        this.billingAddressExpanded.set(true);
        return billingError;
      }
    }
    if (options.collectShippingAddresses) {
      if (!this.shippingAddress.name.trim()) {
        return 'Shipping name is required';
      }
      const shippingError = this.ValidateAddressForm(
        this.shippingAddress,
        'Shipping address'
      );
      if (shippingError) {
        this.shippingAddressExpanded.set(true);
        return shippingError;
      }
    }
    if (
      options.collectTaxIds &&
      session?.tax_id_collection?.required === 'if_supported' &&
      !this.taxId.trim()
    ) {
      return 'Tax ID is required';
    }
    if (options.requireTerms && !this.termsAccepted) {
      return 'Please accept the Terms of Service';
    }
    for (const field of this.CustomFields()) {
      if (field.optional) continue;
      if (!this.customFieldValues[field.key]?.trim()) {
        return `${this.FieldLabel(field)} is required`;
      }
    }
    return null;
  }

  /**
   * Connect, switch the wallet to the platform's chain, prepare, sign the
   * EIP-3009 authorization and confirm. The API relays the signature and
   * pays the gas, so the customer needs USDC but no ETH.
   */
  private async PayWithWallet(
    session: CheckoutSession
  ): Promise<CheckoutSession> {
    this.paymentPhase.set('awaiting_wallet');
    const chainId = this.RequireChainId();
    const payerWallet =
      this.walletService.GetAddress() || (await this.walletService.Connect());
    return PayAcrossWalletChange(
      () => this.PrepareSignAndConfirm(session, payerWallet, chainId),
      (hash) => this.ConfirmOrSignAgain(session, hash, payerWallet),
      (message) => {
        this.confirmer.Forget();
        this.paymentNotice.set(message);
      }
    );
  }

  /**
   * `again`: this wallet's own recorded payment is being signed again, so a
   * second "a payment is confirming" answer is not followed once more.
   */
  private async PrepareSignAndConfirm(
    session: CheckoutSession,
    payerWallet: string,
    chainId: number,
    again = false
  ): Promise<CheckoutSession> {
    this.paymentPhase.set('awaiting_wallet');
    await this.walletService.EnsureChain(chainId);

    let prepared: CheckoutPaymentTransaction;
    try {
      prepared = await this.PreparePayment(session, payerWallet);
    } catch (error) {
      const retry = ReadConfirmRetry(error);
      if (again || retry?.reason !== 'payment_pending') throw error;
      return this.FollowPayment(
        session,
        payerWallet,
        chainId,
        retry.transactionHash
      );
    }

    const completedSession = await this.subscriber.ConfirmExisting(
      session,
      prepared
    );
    if (completedSession) return completedSession;
    if (session.mode === 'subscription') {
      return this.subscriber.SignAndConfirm(
        session,
        prepared,
        chainId,
        payerWallet
      );
    }

    const typedData = RequireAuthorizationTypedData(
      prepared,
      chainId,
      payerWallet
    );
    const signature = await SignAsPrepared(
      this.walletService,
      typedData,
      payerWallet,
      false
    );
    this.confirmer.Hold(session, signature);
    return this.confirmer.ConfirmUntilSettled(session);
  }

  /**
   * Prepare answered that a payment is confirming. The API says so to any
   * wallet but the recorded payer, or to the payer when its relay was
   * recorded (in another tab) while it prepared. The payer signs here too;
   * any other wallet follows the payment by its hash.
   */
  private async FollowPayment(
    session: CheckoutSession,
    payerWallet: string,
    chainId: number,
    reportedTransactionHash: string | null
  ): Promise<CheckoutSession> {
    const latest = await this.checkoutSessionService.GetPublicCheckoutSession(
      session.url_slug
    );
    if (latest.status === 'complete') return latest;
    const recordedPayer = latest.payment_details?.payer_wallet ?? null;
    if (SameAddress(recordedPayer, payerWallet)) {
      return this.PrepareSignAndConfirm(session, payerWallet, chainId, true);
    }
    const transactionHash =
      reportedTransactionHash ??
      latest.payment_details?.transaction_hash ??
      null;
    const confirming = AlreadyConfirmingMessage(this.IsSubscription());
    this.confirmer.ShowConfirming(
      transactionHash,
      recordedPayer
        ? `${confirming}. It was started from ${ShortAddress(
            recordedPayer
          )}, and only that wallet can finish it.`
        : confirming
    );
    return this.ConfirmOrSignAgain(session, transactionHash, payerWallet);
  }

  /**
   * Confirm until settled. When the network lost a payment and no signature
   * is held, the recorded payer must sign again: `signer`, the wallet that
   * pressed Pay, does so at once when it is that payer. Otherwise the
   * `SignatureRequiredError` reaches `HandlePaymentError`.
   */
  private async ConfirmOrSignAgain(
    session: CheckoutSession,
    transactionHash: string | null,
    signer: string | null
  ): Promise<CheckoutSession> {
    try {
      return await this.confirmer.ConfirmUntilSettled(session, transactionHash);
    } catch (error) {
      if (
        !(error instanceof SignatureRequiredError) ||
        !signer ||
        !SameAddress(error.payerWallet, signer)
      ) {
        throw error;
      }
      this.paymentNotice.set(null);
      return this.PrepareSignAndConfirm(
        session,
        signer,
        this.RequireChainId(),
        true
      );
    }
  }

  private RequireChainId(): number {
    const chainId = this.configService.GetChainId();
    if (chainId === null) {
      throw new Error(
        'Could not load the payment network. Refresh the page and try again.'
      );
    }
    return chainId;
  }

  private PreparePayment(
    session: CheckoutSession,
    payerWallet: string
  ): Promise<CheckoutPaymentTransaction> {
    return this.checkoutSessionService.PreparePayment(
      session.url_slug,
      payerWallet,
      this.BuildCustomerDetailsPayload()
    );
  }

  private BuildCustomerDetailsPayload(): CustomerDetailsPayload {
    const options = this.CollectionOptions();
    const customFields = this.CustomFields()
      .map((field) => ({
        key: field.key,
        value: this.customFieldValues[field.key]?.trim() ?? '',
      }))
      .filter((field) => field.value);

    return {
      ...(this.email.trim() ? { email: this.email.trim() } : {}),
      ...(options.collectCustomerNames && this.name.trim()
        ? { name: this.name.trim() }
        : {}),
      ...(options.collectBusinessNames && this.businessName.trim()
        ? { business_name: this.businessName.trim() }
        : {}),
      ...(options.collectPhone && this.phone.trim()
        ? { phone: this.phone.trim() }
        : {}),
      ...(options.collectBillingAddresses
        ? { address: this.ToPreparedAddress(this.billingAddress) }
        : {}),
      ...(options.collectShippingAddresses
        ? {
            shipping_address: {
              ...this.ToPreparedAddress(this.shippingAddress),
              ...(this.shippingAddress.name.trim()
                ? { name: this.shippingAddress.name.trim() }
                : {}),
            },
          }
        : {}),
      ...(options.collectTaxIds && this.taxId.trim()
        ? { tax_id: this.taxId.trim() }
        : {}),
      ...(customFields.length > 0 ? { custom_fields: customFields } : {}),
      ...(options.requireTerms && this.termsAccepted
        ? { terms_of_service_accepted: true }
        : {}),
    };
  }

  private ToAddressForm(
    address?: {
      country?: string | null;
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postal_code?: string | null;
    } | null,
    name?: string | null
  ): AddressFormValue {
    return {
      name: name ?? '',
      country: address?.country ?? '',
      line1: address?.line1 ?? '',
      line2: address?.line2 ?? '',
      city: address?.city ?? '',
      state: address?.state ?? '',
      postalCode: address?.postal_code ?? '',
    };
  }

  private ToPreparedAddress(form: AddressFormValue): PreparedAddress {
    return {
      ...(form.line1.trim() ? { line1: form.line1.trim() } : {}),
      ...(form.line2.trim() ? { line2: form.line2.trim() } : {}),
      ...(form.city.trim() ? { city: form.city.trim() } : {}),
      ...(form.state.trim() ? { state: form.state.trim() } : {}),
      ...(form.postalCode.trim()
        ? { postal_code: form.postalCode.trim() }
        : {}),
      ...(form.country.trim()
        ? { country: form.country.trim().toUpperCase() }
        : {}),
    };
  }

  private ValidateAddressForm(
    form: AddressFormValue,
    label: string
  ): string | null {
    if (!form.country.trim()) return `${label} country is required`;
    if (!form.line1.trim()) return `${label} line 1 is required`;
    if (!form.city.trim()) return `${label} city is required`;
    if (!form.postalCode.trim()) return `${label} postal code is required`;
    return null;
  }

  private CustomFieldValue(field: CheckoutSessionCustomField): string {
    if (field.type === 'dropdown') {
      return field.dropdown?.value ?? field.dropdown?.default_value ?? '';
    }
    if (field.type === 'numeric') {
      return field.numeric?.value ?? field.numeric?.default_value ?? '';
    }
    return field.text?.value ?? field.text?.default_value ?? '';
  }

  private CompletePayment(completedSession: CheckoutSession): void {
    this.confirmer.Forget();
    this.paymentNotice.set(null);
    this.checkoutSession.set(completedSession);
    this.paymentPhase.set('complete');
    this.HandleAfterCompletion(completedSession);
  }

  /**
   * Back to idle with the error shown. A payment that is still confirming
   * keeps its signature and hash, so Pay checks on it again. A lost payment
   * that another wallet must sign again turns Pay off for this one.
   */
  private HandlePaymentError(error: unknown): void {
    const stillConfirming = error instanceof StillConfirmingError;
    if (!stillConfirming) {
      this.confirmer.Forget();
      this.subscribeTerms.set(null);
    }
    this.stillConfirming.set(stillConfirming);
    this.paymentNotice.set(null);
    const signatureRequired =
      error instanceof SignatureRequiredError
        ? ReadSignatureRequired(error, this.walletService.GetAddress() || null)
        : null;
    if (signatureRequired?.blockedBy) {
      this.blockedByWallet.set(signatureRequired.blockedBy);
    }
    this.paymentError.set(
      signatureRequired?.message ??
        CheckoutErrorMessage(error, this.IsSubscription())
    );
    this.paymentPhase.set('idle');
  }

  private HandleAfterCompletion(session: CheckoutSession): void {
    const redirectUrl = GetCheckoutRedirectUrl(session);
    if (!redirectUrl) return;
    window.setTimeout(() => window.location.assign(redirectUrl), 1200);
  }

  LineItemImage(item: CheckoutSessionLineItem): string | null {
    const product = item.price?.product;
    if (product && typeof product === 'object') {
      return (product as Product).images?.[0] ?? null;
    }
    return null;
  }

  readonly FormatAmount = FormatUsdcAmount;

  DiscountAmount(): number {
    return this.checkoutSession()?.total_details?.amount_discount ?? 0;
  }

  DiscountLabel(): string {
    const discounts =
      this.checkoutSession()?.total_details?.breakdown?.discounts ?? [];
    const discount = discounts[0]?.discount;
    return discount?.promotion_code ?? discount?.source?.coupon ?? 'Discount';
  }

  DiscountPercent(): number | null {
    const subtotal = this.checkoutSession()?.amount_subtotal ?? 0;
    const discount = this.DiscountAmount();
    if (subtotal <= 0 || discount <= 0) return null;
    return Math.round((discount / subtotal) * 100);
  }

  /**
   * Explorer link for the confirming payment; empty without an explorer or
   * for anything that is not a transaction hash.
   */
  TransactionUrl(transactionHash: string): string {
    if (!IsTransactionHash(transactionHash)) return '';
    return this.configService.GetExplorerUrl('tx', transactionHash);
  }

  IsPayBlocked(): boolean {
    return this.blockedByWallet() !== null;
  }

  readonly ShortHash = ShortHash;

  SubmitLabel(): string {
    return GetCheckoutSubmitLabel(
      this.checkoutSession()?.submit_type,
      this.IsSubscription(),
      this.stillConfirming()
    );
  }

  BusyLabel(): string {
    return GetCheckoutBusyLabel(this.paymentPhase(), this.IsSubscription());
  }

  /** The price's trial; its first charge date is exact once signed. */
  Trial(): CheckoutTrial | null {
    const session = this.checkoutSession();
    const firstChargeAt = this.subscribeTerms()?.firstChargeAt ?? null;
    return session ? CheckoutTrialSummary(session, firstChargeAt) : null;
  }

  SummaryHeading(): string {
    return this.IsSubscription()
      ? `Subscribe to ${this.MerchantName()}`
      : `Pay ${this.MerchantName()}`;
  }

  MethodDetailLabel(): string {
    if (this.IsSimulatedSettlement()) {
      return this.IsSubscription()
        ? 'Subscribing with test USDC'
        : 'Paying with test USDC';
    }
    return this.IsSubscription()
      ? 'Subscribing with USDC on Ethereum'
      : 'Paying with USDC on Ethereum';
  }

  MethodHelpText(): string {
    const amount = this.FormatAmount(this.checkoutSession()?.amount_total);
    if (this.IsSimulatedSettlement()) {
      return this.IsSubscription()
        ? `Approve in the test wallet to start a ${amount} USDC subscription. No real wallet required.`
        : `Approve in the test wallet to pay ${amount} USDC. No real wallet required.`;
    }
    if (this.IsSubscription()) {
      const cadence = this.RecurringIntervalLabel();
      return cadence
        ? `Connect your wallet to authorize recurring ${amount} USDC every ${cadence}. First-time wallets approve twice. No ETH is needed for gas.`
        : `Connect your wallet to authorize this recurring USDC subscription. First-time wallets approve twice. No ETH is needed for gas.`;
    }
    return `Connect your wallet and sign once to pay ${amount} in USDC. No ETH is needed for gas.`;
  }

  FinePrintVerb(): string {
    return this.IsSubscription() ? 'subscribing' : 'paying';
  }

  TotalDueLabel(): string {
    return this.IsSubscription() ? 'Total due today' : 'Total due';
  }
}
