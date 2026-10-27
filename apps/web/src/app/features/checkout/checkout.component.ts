// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import type { TypedDataDefinition } from 'viem';

import { IsUserRejectedError, MetaService, WalletService } from '../../core';
import {
  CheckoutPaymentConfirmation,
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
  Eip712TypedData,
  Price,
  Product,
} from '@zoneless/shared-types';
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
  GetCheckoutSubmitLabel,
} from './util/checkout-format';
import {
  BuildMobileWalletOptions,
  IsMobileBrowser,
  MobileWalletOption,
} from './util/mobile-wallet';
import { TEST_WALLET_DATA } from '../../utils/constants/test-data';

type PaymentPhase =
  | 'idle'
  | 'awaiting_wallet'
  | 'processing'
  | 'confirming'
  | 'complete';

/** A confirming payment is checked again this often, for this long. */
const CONFIRM_POLL_INTERVAL_MS = 4_000;
const CONFIRM_POLL_TIMEOUT_MS = 5 * 60_000;

const CONFIRMING_MESSAGE =
  'Waiting for network confirmations. This can take a minute.';
const ALREADY_CONFIRMING_MESSAGE =
  'A payment for this checkout is already being confirmed';
const RESIGN_MESSAGE =
  'The payment was not sent to the network. Press Pay to sign it again.';
const ATTEMPT_ENDED_MESSAGE =
  'The other payment for this checkout did not go through. You can pay now.';

/** The payment is still confirming when checkout stops polling. */
class StillConfirmingError extends Error {
  constructor() {
    super(
      'Your payment is still confirming. Keep this page open, then check again.'
    );
  }
}

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

  /**
   * The customer's signature of this session's authorization. Retrying
   * confirm with it is always safe, so it is kept until the payment
   * settles or fails.
   */
  private heldSignature: {
    checkoutSessionId: string;
    signature: string;
  } | null = null;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  async ngOnInit(): Promise<void> {
    const urlSlug = this.route.snapshot.paramMap.get('checkoutSessionId');
    if (!urlSlug) return;
    await Promise.all([
      this.LoadCheckoutSession(urlSlug),
      this.configService.LoadConfig().catch(() => undefined),
    ]);
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

    if (this.paymentPhase() !== 'idle') return;

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
      const completedSession = this.HeldSignature(session)
        ? await this.ConfirmUntilSettled(session)
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
        (await this.ConfirmAlreadySubscribed(session, prepared)) ??
        (await this.Confirm(session, {
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
    const chainId = this.configService.GetChainId();
    if (chainId === null) {
      throw new Error(
        'Could not load the payment network. Refresh the page and try again.'
      );
    }
    const payerWallet =
      this.walletService.GetAddress() || (await this.walletService.Connect());
    await this.walletService.EnsureChain(chainId);

    let prepared: CheckoutPaymentTransaction;
    try {
      prepared = await this.PreparePayment(session, payerWallet);
    } catch (error) {
      // Another wallet or tab is paying: follow that payment instead.
      const retry = ReadConfirmRetry(error);
      if (retry?.reason !== 'payment_pending') throw error;
      this.paymentNotice.set(ALREADY_CONFIRMING_MESSAGE);
      this.ShowConfirming(retry.transactionHash);
      return this.ConfirmUntilSettled(session, retry.transactionHash);
    }

    const completedSession = await this.ConfirmAlreadySubscribed(
      session,
      prepared
    );
    if (completedSession) return completedSession;

    const typedData = RequireAuthorizationTypedData(prepared, chainId);
    const signature = await this.walletService.SignTypedData(
      typedData as unknown as TypedDataDefinition
    );
    this.heldSignature = { checkoutSessionId: session.id, signature };
    return this.ConfirmUntilSettled(session);
  }

  /**
   * Confirm, then while the API answers `payment_pending` or
   * `payment_resubmit_required`, or gives no answer, confirm again every
   * 4 s for up to 5 minutes. A held signature is always what is sent: the
   * API never pays twice for it and relays it again if the network dropped
   * the payment. Without one (another wallet or tab is paying), checkout
   * follows the payment by its transaction hash, read from the session when
   * the API has not reported one.
   */
  private async ConfirmUntilSettled(
    session: CheckoutSession,
    knownTransactionHash: string | null = null
  ): Promise<CheckoutSession> {
    const deadline = Date.now() + CONFIRM_POLL_TIMEOUT_MS;
    let transactionHash = knownTransactionHash;

    while (!this.destroyed) {
      const confirmation = this.Confirmation(session, transactionHash);
      if (!confirmation) {
        // Nothing to confirm with yet: the session records the relay's hash.
        const latest =
          await this.checkoutSessionService.GetPublicCheckoutSession(
            session.url_slug
          );
        if (latest.status === 'complete') return latest;
        transactionHash = latest.payment_details?.transaction_hash ?? null;
        if (!transactionHash) throw new Error(ATTEMPT_ENDED_MESSAGE);
        continue;
      }
      try {
        return await this.Confirm(session, confirmation);
      } catch (error) {
        const retry = ReadConfirmRetry(error);
        if (!retry) throw error;
        if (
          retry.reason === 'payment_resubmit_required' &&
          !('signature' in confirmation)
        ) {
          throw new Error(RESIGN_MESSAGE);
        }
        transactionHash = retry.transactionHash ?? transactionHash;
        this.ShowConfirming(transactionHash);
      }
      if (Date.now() >= deadline) throw new StillConfirmingError();
      await Delay(CONFIRM_POLL_INTERVAL_MS);
    }
    throw new StillConfirmingError();
  }

  private Confirm(
    session: CheckoutSession,
    confirmation: CheckoutPaymentConfirmation
  ): Promise<CheckoutSession> {
    if (this.paymentPhase() !== 'confirming') {
      this.paymentPhase.set('processing');
    }
    return this.checkoutSessionService.ConfirmPayment(
      session.url_slug,
      confirmation
    );
  }

  private ShowConfirming(transactionHash: string | null): void {
    this.paymentPhase.set('confirming');
    this.pendingTransactionHash.set(transactionHash);
    if (!this.paymentNotice()) this.paymentNotice.set(CONFIRMING_MESSAGE);
  }

  /** The held signature, else the payment's hash, else nothing yet. */
  private Confirmation(
    session: CheckoutSession,
    transactionHash: string | null
  ): CheckoutPaymentConfirmation | null {
    const signature = this.HeldSignature(session);
    if (signature) return { signature };
    return transactionHash ? { transaction_hash: transactionHash } : null;
  }

  private HeldSignature(session: CheckoutSession): string | null {
    return this.heldSignature?.checkoutSessionId === session.id
      ? this.heldSignature.signature
      : null;
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

  private ConfirmAlreadySubscribed(
    session: CheckoutSession,
    prepared: CheckoutPaymentTransaction
  ): Promise<CheckoutSession | null> {
    if (!prepared.already_subscribed) return Promise.resolve(null);
    return this.Confirm(session, {
      already_subscribed: true,
      subscription_onchain_id: prepared.subscription_onchain_id,
    });
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
    this.heldSignature = null;
    this.paymentNotice.set(null);
    this.pendingTransactionHash.set(null);
    this.checkoutSession.set(completedSession);
    this.paymentPhase.set('complete');
    this.HandleAfterCompletion(completedSession);
  }

  /**
   * Back to idle with the error shown. A payment that is still confirming
   * keeps its signature and hash, so Pay checks on it again.
   */
  private HandlePaymentError(error: unknown): void {
    const stillConfirming = error instanceof StillConfirmingError;
    if (!stillConfirming) {
      this.heldSignature = null;
      this.pendingTransactionHash.set(null);
    }
    this.stillConfirming.set(stillConfirming);
    this.paymentNotice.set(null);
    this.paymentError.set(this.ErrorMessage(error));
    this.paymentPhase.set('idle');
  }

  private HandleAfterCompletion(session: CheckoutSession): void {
    const redirectUrl = GetCheckoutRedirectUrl(session);
    if (!redirectUrl) return;
    window.setTimeout(() => window.location.assign(redirectUrl), 1200);
  }

  private ErrorMessage(error: unknown): string {
    if (IsUserRejectedError(error)) {
      return 'The request was rejected in your wallet.';
    }
    // viem's errors carry a one-line summary next to their long message.
    const shortMessage = (error as { shortMessage?: unknown } | null)
      ?.shortMessage;
    if (typeof shortMessage === 'string' && shortMessage) return shortMessage;
    if (error instanceof Error && error.message) return error.message;
    return this.IsSubscription()
      ? 'Something went wrong starting your subscription. Please try again.'
      : 'Something went wrong processing your payment. Please try again.';
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

  /** Explorer link for the confirming payment; empty without an explorer. */
  TransactionUrl(transactionHash: string): string {
    return this.configService.GetExplorerUrl('tx', transactionHash);
  }

  ShortHash(transactionHash: string): string {
    return `${transactionHash.slice(0, 10)}…${transactionHash.slice(-8)}`;
  }

  SubmitLabel(): string {
    if (this.stillConfirming()) return 'Check payment status';
    return GetCheckoutSubmitLabel(
      this.checkoutSession()?.submit_type,
      this.IsSubscription()
    );
  }

  BusyLabel(): string {
    switch (this.paymentPhase()) {
      case 'awaiting_wallet':
        return 'Confirm in wallet';
      case 'confirming':
        return 'Confirming payment';
      default:
        return 'Processing';
    }
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
        ? `Connect your wallet to authorize recurring ${amount} USDC every ${cadence}.`
        : `Connect your wallet to authorize this recurring USDC subscription.`;
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

/**
 * The prepared EIP-3009 authorization, checked to be for `chainId`: a
 * wallet signs typed data only for the chain it is on.
 */
function RequireAuthorizationTypedData(
  prepared: CheckoutPaymentTransaction,
  chainId: number
): Eip712TypedData {
  if (prepared.method !== 'eip3009_transfer' || !prepared.typed_data) {
    throw new Error(
      'This checkout cannot be paid from a wallet on this network yet.'
    );
  }
  if (prepared.typed_data.domain.chainId !== chainId) {
    throw new Error(
      'The payment is for a different network than this checkout. Refresh the page and try again.'
    );
  }
  return prepared.typed_data;
}

function Delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
