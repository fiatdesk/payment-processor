// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * @fileOverview Methods for the public hosted checkout payment flow:
 * bootstrapping the payment page, preparing the USDC authorization (or the
 * permit and subscribe signatures) the customer signs, and relaying,
 * confirming and completing it on-chain.
 *
 * @module CheckoutPayment
 */

import { getAddress, isAddress } from 'viem';
import { Database } from './Database';
import { AccountModule } from './Account';
import { CheckoutSessionModule } from './CheckoutSession';
import { ExternalWalletModule } from './ExternalWallet';
import { ProductModule } from './Product';
import type { CustomerModule } from './Customer';
import type { SubscriptionModule } from './Subscription';
import type { PaymentIntentModule } from './PaymentIntent';
import type { ChargeModule } from './Charge';
import type { PaymentLinkModule } from './PaymentLink';
import { PlanDestinationModule } from './PlanDestination';
import { RecordOnchainPayment } from './PaymentLedger';
import {
  GetSettlement,
  SimulatedSignature,
  type Settlement,
} from './chains/Settlement';
import { BuildTransferAuthorization } from './chains/CheckoutAuthorization';
import { CurrentDueAt, PermitValue } from './chains/SubscriptionAuthorization';
import {
  COLLECTION_DECLINE_CODES,
  ONCHAIN_PLAN_AMOUNT_EXCEEDED,
  PAUSED_ON_CHAIN,
  PERIOD_ALREADY_COLLECTED,
  type CheckoutPaymentVerification,
  type SignedTransaction,
} from './chains/types';
import { CentsToTokenUnits } from './chains/PayoutEncoding';
import {
  ClaimHashes,
  SubscriptionCycleClaims,
} from './SubscriptionCycleClaims';
import {
  RecurringIntervalToSeconds,
  SECONDS_PER_DAY,
} from '../utils/RecurringInterval';
import { GetCheckoutConfirmTimeoutMs } from './AppConfig';
import { AppError } from '../utils/AppError';
import { ERRORS } from '../utils/Errors';
import { WithKeyedLock } from '../utils/KeyedLock';
import { Logger } from '../utils/Logger';
import { Now } from '../utils/Timestamp';
import {
  ConfirmCheckoutPaymentInput,
  PrepareCheckoutPaymentInput,
} from '@fiatdesk/shared-schemas';
import {
  Account,
  BalanceTransaction,
  Charge,
  CheckoutPaymentTransaction,
  CheckoutSession,
  ExternalWallet,
  IsTransactionHash,
  Price,
  Product,
  SameAddress,
  Subscription,
  SubscriptionItem,
} from '@fiatdesk/shared-types';

/**
 * What PreparePayment returns: the authorization to sign (payment mode) or
 * the permit and subscribe messages to sign (subscription mode).
 */
export type PreparedCheckoutPayment = CheckoutPaymentTransaction;

/** Fields of a prepared subscription checkout. */
type PreparedSubscription = Pick<
  CheckoutPaymentTransaction,
  | 'relayed'
  | 'estimated_fee'
  | 'fee_currency'
  | 'chain_id'
  | 'subscription'
  | 'already_subscribed'
  | 'subscription_onchain_id'
>;

/** The first-period charge of a subscription checkout. */
interface FirstCharge {
  transactionHash: string;
  /** The period the charge paid; `end` null when the rail keeps no schedule */
  period: { start: number; end: number | null };
}

/** The signed subscribe (or its transaction) a subscription confirm sends. */
interface SubscribeConfirmation {
  permitSignature?: string;
  subscribeSignature?: string;
  deadline?: number;
  transactionHash?: string;
}

/** The trial a recurring price gives before its first charge, in seconds. */
function TrialSeconds(price: Price): number {
  const days = price.recurring?.trial_period_days ?? 0;
  return days > 0 ? days * SECONDS_PER_DAY : 0;
}

/**
 * 409 `period_already_collected`: the period due on-chain was collected
 * without this session's charge, so the session cannot be recorded as paid
 * and nothing is created.
 */
function PeriodAlreadyCollected(): AppError {
  return new AppError(
    'This on-chain subscription period is already collected; this checkout did not pay it',
    409,
    PERIOD_ALREADY_COLLECTED,
    { code: PERIOD_ALREADY_COLLECTED }
  );
}

/**
 * On-chain plans collect one price per period, so subscription checkout
 * takes quantity 1 (400 `onchain_plan_amount_exceeded`).
 */
function AssertSingleQuantity(session: CheckoutSession): void {
  const quantity = session.line_items?.data?.[0]?.quantity ?? 1;
  if (quantity !== 1) {
    throw new AppError(
      'Subscription checkout takes quantity 1: an on-chain plan collects one price per period',
      ERRORS.INVALID_REQUEST.status,
      ERRORS.INVALID_REQUEST.type,
      { code: ONCHAIN_PLAN_AMOUNT_EXCEEDED }
    );
  }
}

/** How long a confirm waits for another one recording the same payment. */
const SETTLEMENT_WAIT_MS = 10_000;
const SETTLEMENT_POLL_MS = 200;
/** Stored as the failed attempt when the network refuses a relay. */
const RELAY_REFUSED_MESSAGE = 'The network did not accept the payment';

/**
 * 409 while the payment waits for confirmations. `transaction_hash` may be
 * null (the authorization was used but is not confirmed yet); retrying with
 * `{ signature }` is always safe. `reason: 'another_confirmation'` says a
 * concurrent confirm is relaying or recording this payment.
 */
function PaymentPending(
  transactionHash: string | null,
  message = 'The payment is waiting for network confirmations. Confirm again with this transaction_hash.',
  reason?: 'another_confirmation'
): AppError {
  return new AppError(message, 409, 'payment_pending', {
    code: 'payment_pending',
    transaction_hash: transactionHash,
    ...(reason ? { reason } : {}),
  });
}

/**
 * Besides the wallet the session recorded at prepare (`merchantWallet`),
 * the only wallet a payment under the session's authorization may pay is
 * the platform's current default. Any other wallet, one the platform has
 * deleted included, does not pay the session: its key may be someone
 * else's, so such a payment is refused and not credited.
 */
function AlsoAccepted(
  merchantWallet: string,
  currentMerchant: string | null
): string[] {
  return currentMerchant && !SameAddress(currentMerchant, merchantWallet)
    ? [currentMerchant]
    : [];
}

/** What the buyer is told when the merchant's default wallet changed. */
export const MERCHANT_WALLET_CHANGED_MESSAGE =
  "The merchant's receiving wallet changed. Please approve the payment again.";

/**
 * 409 `merchant_wallet_changed`: the payment prepared for the
 * session pays a wallet that is no longer the merchant's default. Nothing
 * else is cleared; the client prepares again and the buyer signs a new
 * authorization. With `transactionHash`, a relay to the old wallet is still
 * recorded: the client follows it by that hash instead.
 */
function MerchantWalletChanged(
  transactionHash: string | null = null
): AppError {
  return new AppError(
    MERCHANT_WALLET_CHANGED_MESSAGE,
    409,
    'merchant_wallet_changed',
    {
      code: 'merchant_wallet_changed',
      ...(transactionHash ? { transaction_hash: transactionHash } : {}),
    }
  );
}

/**
 * 409 when the recorded transaction is unknown to the network and the
 * authorization is unused: waiting cannot help, so the client sends the
 * signature again (which relays it again).
 */
function ResubmitRequired(transactionHash: string): AppError {
  return new AppError(
    'The network does not know this payment transaction. Confirm again with the signature.',
    409,
    'payment_resubmit_required',
    { code: 'payment_resubmit_required', transaction_hash: transactionHash }
  );
}

/** Lowercases an Ethereum hash; simulated references pass through. */
function NormalizeTransactionHash(value?: string): string | undefined {
  return value && IsTransactionHash(value) ? value.toLowerCase() : value;
}

/** Convert a stored nullable address into CreateCustomer address input. */
function ToCreateCustomerAddress(
  address:
    | {
        city: string | null;
        country: string | null;
        line1: string | null;
        line2: string | null;
        postal_code: string | null;
        state: string | null;
      }
    | null
    | undefined
):
  | {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    }
  | undefined {
  if (!address) return undefined;
  const result = {
    ...(address.city ? { city: address.city } : {}),
    ...(address.country ? { country: address.country } : {}),
    ...(address.line1 ? { line1: address.line1 } : {}),
    ...(address.line2 ? { line2: address.line2 } : {}),
    ...(address.postal_code ? { postal_code: address.postal_code } : {}),
    ...(address.state ? { state: address.state } : {}),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

export class CheckoutPaymentModule {
  private readonly db: Database;
  private readonly accountModule: AccountModule;
  private readonly checkoutSessionModule: CheckoutSessionModule;
  private readonly externalWalletModule: ExternalWalletModule;
  private readonly productModule: ProductModule;
  private readonly paymentIntentModule: PaymentIntentModule | null;
  private readonly chargeModule: ChargeModule | null;
  private readonly paymentLinkModule: PaymentLinkModule | null;
  private readonly customerModule: CustomerModule | null;
  private readonly subscriptionModule: SubscriptionModule | null;
  private readonly settlement: Settlement;
  private readonly cycleClaims: SubscriptionCycleClaims;
  private readonly planDestinations: PlanDestinationModule;

  constructor(
    db: Database,
    checkoutSessionModule: CheckoutSessionModule,
    externalWalletModule: ExternalWalletModule,
    productModule: ProductModule,
    paymentIntentModule?: PaymentIntentModule,
    chargeModule?: ChargeModule,
    paymentLinkModule?: PaymentLinkModule,
    settlement?: Settlement,
    customerModule?: CustomerModule,
    subscriptionModule?: SubscriptionModule,
    planDestinations?: PlanDestinationModule
  ) {
    this.db = db;
    this.accountModule = new AccountModule(db);
    this.checkoutSessionModule = checkoutSessionModule;
    this.externalWalletModule = externalWalletModule;
    this.productModule = productModule;
    this.paymentIntentModule = paymentIntentModule || null;
    this.chargeModule = chargeModule || null;
    this.paymentLinkModule = paymentLinkModule || null;
    this.customerModule = customerModule || null;
    this.subscriptionModule = subscriptionModule || null;
    this.settlement = settlement || GetSettlement();
    this.cycleClaims = new SubscriptionCycleClaims(db);
    this.planDestinations =
      planDestinations ??
      new PlanDestinationModule(
        db,
        this.settlement,
        null,
        externalWalletModule
      );
  }

  /**
   * Bootstrap the hosted checkout page: the sanitized session enriched with
   * the merchant's receiving wallet, display details, and expanded products.
   */
  async GetPaymentPageSession(urlSlug: string): Promise<CheckoutSession> {
    const session = await this.GetSessionOrThrow(urlSlug);
    const [merchantWallet, account, expandedSession] = await Promise.all([
      this.ResolveMerchantWallet(session.platform_account),
      this.accountModule.GetAccount(session.platform_account),
      this.ExpandLineItemProducts(session),
    ]);

    return {
      ...this.SanitizeCheckoutSession(expandedSession),
      merchant_wallet: {
        wallet_address: merchantWallet.wallet_address,
        network: merchantWallet.network,
        currency: merchantWallet.currency,
        token_address: this.settlement.Describe().token_address,
      },
      merchant: this.ResolveMerchant(session, account),
    };
  }

  private async ExpandLineItemProducts(
    session: CheckoutSession
  ): Promise<CheckoutSession> {
    const lineItems = session.line_items?.data ?? [];
    const productIds = [
      ...new Set(
        lineItems
          .map((item) => item.price?.product)
          .filter((product): product is string => typeof product === 'string')
      ),
    ];

    if (productIds.length === 0) return session;

    const products = await this.productModule.BatchGet(
      productIds,
      session.platform_account
    );

    return {
      ...session,
      line_items: session.line_items
        ? {
            ...session.line_items,
            data: lineItems.map((item) => {
              const price = item.price as Price | null;
              if (!price || typeof price.product !== 'string') return item;

              const product = products.get(price.product);
              if (!product) return item;

              return {
                ...item,
                price: {
                  ...price,
                  product: product as Product,
                },
              };
            }),
          }
        : null,
    };
  }

  private ResolveMerchant(
    session: CheckoutSession,
    account: Account | null
  ): NonNullable<CheckoutSession['merchant']> {
    const brandingName = session.branding_settings?.display_name?.trim();
    const displayName =
      brandingName ||
      account?.business_profile?.name?.trim() ||
      account?.settings?.dashboard?.display_name?.trim() ||
      'Merchant';

    const brandingIcon =
      session.branding_settings?.icon?.url ??
      session.branding_settings?.logo?.url ??
      null;

    return {
      display_name: displayName,
      terms_url: account?.settings?.terms_url ?? null,
      privacy_url: account?.settings?.privacy_url ?? null,
      icon_url:
        brandingIcon ||
        account?.settings?.branding?.icon ||
        account?.settings?.branding?.logo ||
        null,
    };
  }

  /**
   * Prepare what the customer signs. One-time sessions get an EIP-3009 USDC
   * authorization; subscription sessions get the Subscriptions contract's
   * `Subscribe` message and, when the wallet's allowance is too low, a USDC
   * permit. The API relays either, so the customer pays no gas.
   */
  async PreparePayment(
    urlSlug: string,
    payerWalletInput: string | undefined,
    customerDetails?: Omit<PrepareCheckoutPaymentInput, 'payer_wallet'>
  ): Promise<PreparedCheckoutPayment> {
    if (!payerWalletInput || typeof payerWalletInput !== 'string') {
      throw new AppError(
        'payer_wallet is required',
        ERRORS.VALIDATION_ERROR.status,
        ERRORS.VALIDATION_ERROR.type
      );
    }
    if (!isAddress(payerWalletInput)) {
      throw new AppError(
        'payer_wallet must be a valid Ethereum address',
        ERRORS.VALIDATION_ERROR.status,
        ERRORS.VALIDATION_ERROR.type
      );
    }
    const payerWallet = getAddress(payerWalletInput);

    const session = await this.GetSessionOrThrow(urlSlug);
    this.AssertSessionPayable(session);

    // A relayed payment is confirming: its payer is fixed until it settles.
    const inFlight =
      session.mode === 'payment'
        ? session.payment_details?.transaction_hash ?? null
        : null;
    if (inFlight && session.payment_details?.payer_wallet !== payerWallet) {
      throw PaymentPending(
        inFlight,
        'A payment from another wallet is confirming for this Checkout Session'
      );
    }

    // Existing customers with an email cannot change it at checkout.
    const lockedEmail = session.customer
      ? session.customer_email?.trim() ||
        session.customer_details?.email?.trim() ||
        null
      : null;
    const resolvedDetails = lockedEmail
      ? { ...customerDetails, email: lockedEmail }
      : customerDetails;

    this.AssertCollectedCustomerDetails(session, resolvedDetails);

    const merchantWallet = await this.ResolveMerchantWallet(
      session.platform_account
    );
    // Preparing during a relay hands out the authorization it relayed; one
    // paying a wallet that is no longer the default is followed by its hash.
    const recordedMerchant = session.payment_details?.merchant_wallet ?? null;
    if (
      inFlight &&
      recordedMerchant &&
      !SameAddress(recordedMerchant, merchantWallet.wallet_address)
    ) {
      throw MerchantWalletChanged(inFlight);
    }

    if (resolvedDetails) {
      await this.checkoutSessionModule.SetCollectedCustomerDetails(
        session.id,
        resolvedDetails
      );
    }

    Logger.info('Preparing checkout transaction', {
      checkoutSessionId: session.id,
      mode: session.mode,
      amountTotal: session.amount_total,
    });

    // A confirming relay pays the merchant wallet recorded when it was
    // prepared, even if the default wallet changed since.
    const merchant =
      (inFlight && session.payment_details?.merchant_wallet) ||
      merchantWallet.wallet_address;
    const prepared =
      session.mode === 'subscription'
        ? await this.PrepareSubscription(session, payerWallet)
        : await this.PrepareAuthorization(session, payerWallet, merchant);

    // Re-preparing during a relay returns the same authorization to sign
    // again and leaves the confirming PaymentIntent as it is.
    if (!inFlight) {
      await this.MarkPaymentIntentRequiresConfirmation(session, {
        payer_wallet: payerWallet,
        relayed: prepared.relayed,
        merchant_wallet: merchant,
        ...('subscription' in prepared
          ? { first_charge_at: prepared.subscription?.first_charge_at ?? null }
          : {}),
      });
    }

    return {
      object: 'checkout.payment_transaction',
      checkout_session: session.id,
      amount_total: session.amount_total!,
      currency: session.currency,
      merchant_wallet_address: merchant,
      ...prepared,
    };
  }

  private async PrepareAuthorization(
    session: CheckoutSession,
    payerWallet: string,
    merchantWallet: string
  ) {
    const authorization =
      await this.settlement.BuildCheckoutPaymentAuthorization(
        payerWallet,
        merchantWallet,
        this.AmountDue(session),
        session.id,
        session.expires_at
      );
    return {
      relayed: authorization.method === 'eip3009_transfer',
      ...authorization,
    };
  }

  private async PrepareSubscription(
    session: CheckoutSession,
    payerWallet: string
  ): Promise<PreparedSubscription> {
    const planKey = this.RequirePlanKey(session);
    AssertSingleQuantity(session);
    const existing = await this.settlement.FindExistingSubscription(
      planKey,
      payerWallet
    );
    if (existing) {
      // A prior attempt likely landed on-chain while its confirm failed.
      const { chain_id, native_currency, rail } = this.settlement.Describe();
      return {
        relayed: rail === 'onchain',
        estimated_fee: '0',
        fee_currency: native_currency,
        chain_id,
        already_subscribed: true,
        subscription_onchain_id: existing,
        subscription: {
          plan_id: planKey,
          needs_permit: false,
          permit_typed_data: null,
          subscribe_typed_data: null,
          deadline: null,
          first_charge_at: null,
          already_subscribed: true,
          subscription_onchain_id: existing,
        },
      };
    }

    const prepared = await this.settlement.BuildSubscribeAuthorization(
      payerWallet,
      planKey,
      session.expires_at,
      {
        otherPlansAllowance: await this.OtherPlansAllowance(
          payerWallet,
          planKey
        ),
        trialSeconds: TrialSeconds(this.RequireRecurringCheckoutPrice(session)),
      }
    );
    return {
      relayed: prepared.subscribe_typed_data !== null,
      estimated_fee: prepared.estimated_fee,
      fee_currency: prepared.fee_currency,
      chain_id: prepared.chain_id,
      already_subscribed: false,
      subscription: {
        plan_id: planKey,
        needs_permit: prepared.needs_permit,
        permit_typed_data: prepared.permit_typed_data,
        subscribe_typed_data: prepared.subscribe_typed_data,
        deadline: prepared.deadline,
        first_charge_at: prepared.first_charge_at,
        already_subscribed: false,
        subscription_onchain_id: null,
      },
    };
  }

  /**
   * The bounded permit values (`PermitValue`) of the wallet's other live
   * on-chain subscriptions on this instance. One USDC allowance to the
   * Subscriptions contract serves all of them, so a new subscriber needs a
   * permit while the allowance is below their sum plus the new plan's.
   */
  private async OtherPlansAllowance(
    wallet: string,
    planKey: string
  ): Promise<bigint> {
    const subscriptions =
      (await this.db.FindCustom<Subscription>(
        'Subscriptions',
        'default_payment_method',
        '==',
        wallet
      )) ?? [];
    let total = 0n;
    for (const subscription of subscriptions) {
      if (
        !subscription.subscription_onchain_id ||
        subscription.status === 'canceled' ||
        subscription.status === 'incomplete_expired'
      ) {
        continue;
      }
      const items =
        (await this.db.Find<SubscriptionItem>(
          'SubscriptionItems',
          'subscription',
          subscription.id
        )) ?? [];
      for (const item of items) {
        const priceId =
          typeof item.price === 'string' ? item.price : item.price.id;
        const price = await this.db.Get<Price>('Prices', priceId);
        if (
          !price?.subscription_plan_id ||
          price.subscription_plan_id === planKey ||
          price.unit_amount === null
        ) {
          continue;
        }
        total += PermitValue({
          amount: CentsToTokenUnits(price.unit_amount),
          periodSeconds: BigInt(
            RecurringIntervalToSeconds(
              price.recurring?.interval ?? 'month',
              price.recurring?.interval_count ?? 1
            )
          ),
        });
      }
    }
    return total;
  }

  /**
   * Confirm a checkout payment and complete the session. Payment mode
   * relays the customer's signed authorization (`signature`), records its
   * hash before sending, waits up to CHECKOUT_CONFIRM_TIMEOUT_MS and
   * verifies it; a payment still confirming is a 409 `payment_pending` that
   * the client retries with the returned `transaction_hash`. Subscription
   * mode relays the signed subscribe (`subscribe_signature`, with its
   * `permit_signature` and `deadline`) the same way, verifies the on-chain
   * subscription, creates the off-chain Subscription, and collects the
   * first period (unless trialing).
   *
   * Confirms of one session run one at a time in this process.
   */
  async ConfirmPayment(
    urlSlug: string,
    body: ConfirmCheckoutPaymentInput = {}
  ): Promise<CheckoutSession> {
    return WithKeyedLock(`checkout:${urlSlug}`, () =>
      this.ConfirmSession(urlSlug, body)
    );
  }

  private async ConfirmSession(
    urlSlug: string,
    body: ConfirmCheckoutPaymentInput
  ): Promise<CheckoutSession> {
    const session = await this.GetSessionOrThrow(urlSlug);
    const transactionHash = NormalizeTransactionHash(body.transaction_hash);

    // Idempotency: already completed (duplicate / overlapping confirms).
    if (session.status === 'complete') {
      if (
        session.mode === 'payment' &&
        session.amount_total &&
        transactionHash &&
        session.payment_details?.transaction_hash === transactionHash
      ) {
        await this.RecordPaymentOnLedger(
          session,
          session.amount_total,
          session.payment_details.payer_wallet,
          transactionHash
        );
      }
      return this.SanitizeCheckoutSession(session);
    }

    if (session.mode === 'subscription') {
      // A subscribe that is already relayed may finish after `expires_at`.
      this.AssertSessionPayable(session, { allowExpired: true });
      if (body.already_subscribed) {
        this.AssertSessionNotExpired(session);
        return this.ConfirmSubscriptionFromExistingOnChain(
          session,
          body.subscription_onchain_id
        );
      }
      return this.ConfirmSubscription(session, {
        permitSignature: body.permit_signature,
        subscribeSignature: body.subscribe_signature,
        deadline: body.deadline,
        transactionHash,
      });
    }

    // USDC refuses the authorization after `expires_at`, so a payment that
    // is already relayed may finish confirming after it.
    this.AssertSessionPayable(session, { allowExpired: true });
    return this.ConfirmOneTimePayment(session, {
      signature: body.signature,
      transactionHash,
    });
  }

  /**
   * Complete a checkout session as if the simulated wallet approved.
   * Simulated test mode only.
   */
  async CompleteSimulatedCheckout(
    urlSlug: string,
    payerWallet: string,
    customerDetails?: Omit<PrepareCheckoutPaymentInput, 'payer_wallet'>
  ): Promise<CheckoutSession> {
    const prepared = await this.PreparePayment(
      urlSlug,
      payerWallet,
      customerDetails
    );
    return this.ConfirmPayment(urlSlug, {
      transaction_hash: SimulatedSignature(
        prepared.checkout_session,
        getAddress(payerWallet)
      ),
    });
  }

  private async ConfirmOneTimePayment(
    session: CheckoutSession,
    input: { signature?: string; transactionHash?: string }
  ): Promise<CheckoutSession> {
    const payerWallet = session.payment_details?.payer_wallet;
    if (!payerWallet) {
      throw new AppError(
        'Prepare the payment for this Checkout Session before confirming it',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }
    const amountDue = this.AmountDue(session);
    // The wallet the authorization pays was recorded at prepare; sessions
    // prepared before that was recorded use the current default wallet.
    const recordedMerchant = session.payment_details?.merchant_wallet ?? null;
    const currentMerchant = recordedMerchant
      ? (
          await this.externalWalletModule.GetDefaultWallet(
            session.platform_account
          )
        )?.wallet_address ?? null
      : (await this.ResolveMerchantWallet(session.platform_account))
          .wallet_address;
    const merchantWallet = recordedMerchant ?? (currentMerchant as string);
    const recorded = session.payment_details?.transaction_hash ?? null;
    // A new relay to a wallet that is no longer the default is not sent:
    // the buyer approves the new wallet. A recorded relay keeps its
    // reconcile, and a hash the customer sends is verified first.
    const walletChanged =
      recordedMerchant !== null &&
      !SameAddress(recordedMerchant, currentMerchant);
    if (walletChanged && !recorded && input.signature) {
      throw MerchantWalletChanged();
    }

    let transactionHash: string | null;
    if (input.transactionHash) {
      if (recorded && recorded !== input.transactionHash) {
        throw new AppError(
          'transaction_hash is not the payment relayed for this Checkout Session',
          ERRORS.INVALID_REQUEST.status,
          ERRORS.INVALID_REQUEST.type
        );
      }
      transactionHash = input.transactionHash;
    } else if (input.signature) {
      if (!recorded) this.AssertSessionNotExpired(session);
      transactionHash = await this.RelayPayment(session, {
        amountDue,
        merchantWallet,
        payerWallet,
        signature: input.signature,
        recorded,
      });
    } else {
      throw new AppError(
        'signature or transaction_hash is required',
        ERRORS.VALIDATION_ERROR.status,
        ERRORS.VALIDATION_ERROR.type
      );
    }
    if (transactionHash) {
      await this.AssertTransactionUnused(session, transactionHash);
    }

    Logger.info('Verifying checkout payment', {
      checkoutSessionId: session.id,
      transactionHash,
    });

    const verification = await this.settlement.VerifyCheckoutPayment(
      transactionHash,
      {
        merchantWalletAddress: merchantWallet,
        otherMerchantWalletAddresses: AlsoAccepted(
          merchantWallet,
          currentMerchant
        ),
        amountInCents: amountDue,
        checkoutSessionId: session.id,
        payerAddress: payerWallet,
        createdAt: session.created,
      },
      { timeoutMs: GetCheckoutConfirmTimeoutMs() }
    );

    const paidBy = verification.transaction_hash ?? transactionHash;
    if (verification.status === 'not_found' && !input.signature) {
      // Fail fast: the network has never seen this transaction.
      if (recorded && walletChanged) {
        // A relay to the old wallet that never reached the network is not
        // signed again: the buyer approves the new wallet instead.
        await this.checkoutSessionModule.SetPaymentTransactionHash(
          session.id,
          null,
          recorded
        );
        throw MerchantWalletChanged();
      }
      if (recorded) throw ResubmitRequired(recorded);
      throw new AppError(
        'transaction_hash is not a transaction the network knows',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }
    if (
      verification.status === 'pending' ||
      verification.status === 'not_found' ||
      !paidBy
    ) {
      throw PaymentPending(paidBy);
    }
    if (paidBy !== transactionHash) {
      await this.AssertTransactionUnused(session, paidBy);
    }

    if (verification.status === 'failed') {
      // A hash the customer sent that no relay of this session recorded is
      // not a payment attempt for it: reject it without failing anything.
      if (!input.signature && !recorded) {
        throw new AppError(
          verification.failure_reason || 'Payment verification failed',
          ERRORS.INVALID_REQUEST.status,
          ERRORS.INVALID_REQUEST.type
        );
      }
      // Stripe order: processing → charge.failed → payment_failed.
      await this.MarkPaymentIntentProcessing(session);
      return this.FailOneTimePayment(session, verification, {
        amountDue,
        paidBy,
        checkedHash: transactionHash,
      });
    }

    return this.SettleVerifiedPayment(session, verification, {
      paidBy,
      merchantWallet: verification.merchant_address ?? merchantWallet,
    });
  }

  /**
   * Record a verified payment exactly once. Every confirm that verified it
   * (one per API process, say) races for a single claim on the session
   * before any side effect; the winner creates the Charge, emits the events
   * and credits the ledger, and the others wait for it and return its
   * completed session.
   */
  private async SettleVerifiedPayment(
    session: CheckoutSession,
    verification: CheckoutPaymentVerification,
    payment: { paidBy: string; merchantWallet: string }
  ): Promise<CheckoutSession> {
    const finished = await this.ClaimSettlement(session, payment.paidBy);
    if (finished) return finished;
    try {
      return await this.CompleteVerifiedPayment(session, verification, payment);
    } catch (error) {
      try {
        await this.checkoutSessionModule.ReleasePaymentSettlement(
          session.id,
          payment.paidBy
        );
      } catch (releaseError) {
        Logger.error(
          'Could not release a checkout settlement claim',
          releaseError,
          {
            checkoutSessionId: session.id,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Null once this confirm holds the settlement claim; the completed session
   * when another confirm recorded the payment meanwhile. A claim that is not
   * released in time answers `payment_pending`.
   */
  /**
   * Waits for the session's settlement claim under `paidBy`. While another
   * confirm holds it past the wait, the 409 names `reportedHash` (by
   * default `paidBy`), the transaction the client may confirm with.
   */
  private async ClaimSettlement(
    session: CheckoutSession,
    paidBy: string,
    reportedHash: string | null = paidBy
  ): Promise<CheckoutSession | null> {
    const deadline = Date.now() + SETTLEMENT_WAIT_MS;
    for (;;) {
      if (
        await this.checkoutSessionModule.ClaimPaymentSettlement(
          session.id,
          paidBy
        )
      ) {
        return null;
      }
      const latest = await this.checkoutSessionModule.GetCheckoutSession(
        session.id
      );
      if (latest?.status === 'complete') {
        return this.SanitizeCheckoutSession(latest);
      }
      if (latest?.status !== 'open') {
        throw new AppError(
          'This Checkout Session is no longer accepting payments',
          ERRORS.INVALID_REQUEST.status,
          ERRORS.INVALID_REQUEST.type
        );
      }
      if (Date.now() >= deadline) {
        throw PaymentPending(
          reportedHash,
          'Another confirmation is recording this payment. Confirm again shortly.',
          'another_confirmation'
        );
      }
      await new Promise((resolve) => setTimeout(resolve, SETTLEMENT_POLL_MS));
    }
  }

  /** The side effects of a verified payment, in Stripe's order. */
  private async CompleteVerifiedPayment(
    claimed: CheckoutSession,
    verification: CheckoutPaymentVerification,
    payment: { paidBy: string; merchantWallet: string }
  ): Promise<CheckoutSession> {
    const { paidBy } = payment;
    // Read again: a confirm that crashed after the claim may have created
    // the customer or the Charge already.
    const session =
      (await this.checkoutSessionModule.GetCheckoutSession(claimed.id)) ??
      claimed;

    // Stripe order: processing → charge.succeeded → payment_intent.succeeded
    // → checkout.session.completed.
    await this.MarkPaymentIntentProcessing(session);

    const charge =
      (await this.FindSucceededCharge(session, paidBy)) ??
      (await this.CreateCheckoutCharge(session, {
        amount: verification.amount_cents,
        transactionHash: paidBy,
        payerAddress: verification.payer_address,
        outcome: 'succeeded',
      }));

    await this.MarkPaymentIntentSucceeded(session, {
      amountReceived: verification.amount_cents,
      latestCharge: charge?.id ?? null,
    });

    if (this.ShouldCreateCheckoutCustomer(session) && this.customerModule) {
      await this.EnsureCheckoutCustomer(
        session,
        verification.payer_address ?? ''
      );
    }

    const completedSession =
      await this.checkoutSessionModule.CompleteCheckoutSession(session.id, {
        transaction_hash: paidBy,
        payer_wallet: verification.payer_address,
        relayed: session.payment_details?.relayed ?? false,
        merchant_wallet: payment.merchantWallet,
      });

    if (completedSession.payment_link && this.paymentLinkModule) {
      await this.paymentLinkModule.RecordCompletedSession(
        completedSession.payment_link
      );
    }

    const balanceTransaction = await this.RecordPaymentOnLedger(
      completedSession,
      verification.amount_cents,
      verification.payer_address,
      paidBy
    );

    if (charge && this.chargeModule) {
      await this.chargeModule.AttachBalanceTransaction(
        charge.id,
        balanceTransaction.id
      );
    }

    Logger.info('Checkout session completed via payment', {
      checkoutSessionId: completedSession.id,
      transactionHash: paidBy,
      chargeId: charge?.id,
    });

    return this.SanitizeCheckoutSession(completedSession);
  }

  /** The succeeded Charge a crashed confirm already created for `paidBy`. */
  private async FindSucceededCharge(
    session: CheckoutSession,
    transactionHash: string
  ): Promise<Charge | null> {
    if (!session.payment_intent || !this.chargeModule) return null;
    const charges = await this.db.Find2Custom<Charge>(
      'Charges',
      'payment_intent',
      '==',
      session.payment_intent,
      'payment_method_details.crypto.transaction_hash',
      '==',
      transactionHash
    );
    return charges.find((charge) => charge.status === 'succeeded') ?? null;
  }

  /**
   * A final verification failure: a failed Charge, the PaymentIntent back to
   * `requires_payment_method`, and the recorded relay cleared so a new
   * signature can be relayed.
   */
  private async FailOneTimePayment(
    session: CheckoutSession,
    verification: CheckoutPaymentVerification,
    attempt: { amountDue: number; paidBy: string; checkedHash: string | null }
  ): Promise<never> {
    const { amountDue, paidBy, checkedHash } = attempt;
    const failureMessage =
      verification.failure_reason || 'Payment verification failed';
    const failedCharge = await this.CreateCheckoutCharge(session, {
      amount: amountDue,
      transactionHash: paidBy,
      payerAddress: verification.payer_address,
      outcome: 'failed',
      failureMessage,
    });
    await this.MarkPaymentIntentFailed(
      session,
      failureMessage,
      failedCharge?.id ?? null
    );
    if (checkedHash) {
      await this.checkoutSessionModule.SetPaymentTransactionHash(
        session.id,
        null,
        checkedHash
      );
    }
    throw new AppError(
      failureMessage,
      ERRORS.INVALID_REQUEST.status,
      ERRORS.INVALID_REQUEST.type
    );
  }

  /**
   * Relay the customer's signed authorization. Its hash is recorded on the
   * session, and the PaymentIntent marked processing, before the network
   * sees it. When the network refuses it, both are reverted so the customer
   * can try again. Returns the payment the rail found instead of relaying
   * (an earlier one under the session's nonce), or null when the
   * authorization is used but its payment not found yet (verification then
   * looks for it).
   */
  private async RelayPayment(
    session: CheckoutSession,
    payment: {
      amountDue: number;
      merchantWallet: string;
      payerWallet: string;
      signature: string;
      recorded: string | null;
    }
  ): Promise<string | null> {
    const { signature, recorded } = payment;
    const authorization = BuildTransferAuthorization({
      payer: payment.payerWallet,
      merchant: payment.merchantWallet,
      amountCents: payment.amountDue,
      sessionId: session.id,
      expiresAt: session.expires_at,
    });
    const recorder = this.RelayRecorder(session, recorded, 'payment', () =>
      this.MarkPaymentIntentProcessing(session)
    );
    try {
      const hash = await this.settlement.RelayCheckoutAuthorization(
        authorization,
        signature,
        {
          pendingHash: recorded,
          createdAt: session.created,
          onSigned: recorder.onSigned,
        }
      );
      // A payment the rail found instead of relaying is recorded too, so
      // retries by hash and prepare see it.
      if (hash && hash !== recorder.Current()) {
        await this.checkoutSessionModule.SetPaymentTransactionHash(
          session.id,
          hash,
          recorder.Current()
        );
      }
      return hash;
    } catch (error) {
      const recordedHere = recorder.RecordedHere();
      if (recordedHere) await this.RevertRelay(session, recordedHere, error);
      throw error;
    }
  }

  /**
   * The relay was signed and recorded but the network did not accept it.
   * The PaymentIntent returns to `requires_payment_method` with a fixed
   * message (what the node said is logged, never stored). Unlike a failed
   * verification, no failed Charge is created: nothing reached the chain,
   * as with a Stripe payment declined before it is attempted.
   */
  private async RevertRelay(
    session: CheckoutSession,
    transactionHash: string,
    error: unknown
  ): Promise<void> {
    Logger.warn('Checkout relay was not accepted; reverting', {
      checkoutSessionId: session.id,
      paymentIntentId: session.payment_intent,
      transactionHash,
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      await this.checkoutSessionModule.SetPaymentTransactionHash(
        session.id,
        null,
        transactionHash
      );
      await this.MarkPaymentIntentFailed(session, RELAY_REFUSED_MESSAGE);
    } catch (revertError) {
      Logger.error('Could not revert a checkout relay', revertError, {
        checkoutSessionId: session.id,
        transactionHash,
      });
    }
  }

  /** A transaction can pay one Checkout Session only. */
  private async AssertTransactionUnused(
    session: CheckoutSession,
    transactionHash: string
  ): Promise<void> {
    const owner =
      await this.checkoutSessionModule.GetCheckoutSessionByTransactionHash(
        transactionHash
      );
    if (owner && owner.id !== session.id) {
      throw new AppError(
        'This transaction has already been used for another Checkout Session',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }
  }

  /**
   * Relay the signed subscribe (or follow its transaction), verify the
   * on-chain subscription, then complete the session. The relay's hash is
   * recorded before it is sent, so a retry or a crash never loses it; a
   * subscribe still confirming is a 409 `payment_pending`.
   */
  private async ConfirmSubscription(
    session: CheckoutSession,
    input: SubscribeConfirmation
  ): Promise<CheckoutSession> {
    const planKey = this.RequirePlanKey(session);
    const subscriberWallet = await this.ResolvePreparedSubscriberWallet(
      session
    );
    const recorded = session.payment_details?.transaction_hash ?? null;
    // The whole confirm, the first-period collect included, stays within
    // CHECKOUT_CONFIRM_TIMEOUT_MS.
    const confirmDeadline = Date.now() + GetCheckoutConfirmTimeoutMs();

    let transactionHash: string | null;
    if (input.transactionHash) {
      if (recorded && recorded !== input.transactionHash) {
        throw new AppError(
          'transaction_hash is not the subscription relayed for this Checkout Session',
          ERRORS.INVALID_REQUEST.status,
          ERRORS.INVALID_REQUEST.type
        );
      }
      // Only a relay this session recorded may finish after `expires_at`.
      if (!recorded) this.AssertSessionNotExpired(session);
      transactionHash = input.transactionHash;
    } else if (input.subscribeSignature) {
      if (!recorded) this.AssertSessionNotExpired(session);
      transactionHash = await this.RelaySubscription(session, {
        planKey,
        subscriberWallet,
        recorded,
        permitSignature: input.permitSignature ?? null,
        subscribeSignature: input.subscribeSignature,
        deadline: input.deadline ?? 0,
        firstChargeAt: session.payment_details?.first_charge_at ?? 0,
      });
    } else {
      throw new AppError(
        'subscribe_signature or transaction_hash is required',
        ERRORS.VALIDATION_ERROR.status,
        ERRORS.VALIDATION_ERROR.type
      );
    }
    if (transactionHash) {
      await this.AssertTransactionUnused(session, transactionHash);
    }

    Logger.info('Verifying checkout subscribe transaction', {
      checkoutSessionId: session.id,
      transactionHash,
    });
    const verification = await this.settlement.VerifySubscribeTransaction(
      transactionHash,
      { planKey, subscriberWallet },
      { timeoutMs: GetCheckoutConfirmTimeoutMs() }
    );

    if (verification.status === 'not_found' && !input.subscribeSignature) {
      // Fail fast: the network has never seen this transaction.
      if (recorded) throw ResubmitRequired(recorded);
      throw new AppError(
        'transaction_hash is not a transaction the network knows',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }
    if (
      verification.status === 'pending' ||
      verification.status === 'not_found'
    ) {
      throw PaymentPending(transactionHash);
    }
    if (
      verification.status === 'failed' ||
      !verification.subscription_onchain_id
    ) {
      // Only clears a relay this session recorded, so the subscriber can
      // sign again.
      if (transactionHash) {
        await this.checkoutSessionModule.SetPaymentTransactionHash(
          session.id,
          null,
          transactionHash
        );
      }
      throw new AppError(
        verification.failure_reason || 'Subscription verification failed',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }

    return this.SettleSubscription(session, {
      subscriberWallet,
      subscriptionOnchainId: verification.subscription_onchain_id,
      subscribeHash: verification.transaction_hash,
      confirmDeadline,
    });
  }

  /**
   * Relay the signed subscribe. Its hash is recorded on the session before
   * the network sees it, and cleared again when the network refuses it.
   * Returns null when the subscriber is already subscribed on-chain (then
   * verification looks for the subscription).
   */
  private async RelaySubscription(
    session: CheckoutSession,
    relay: {
      planKey: string;
      subscriberWallet: string;
      recorded: string | null;
      permitSignature: string | null;
      subscribeSignature: string;
      deadline: number;
      firstChargeAt: number;
    }
  ): Promise<string | null> {
    const recorder = this.RelayRecorder(
      session,
      relay.recorded,
      'subscription'
    );
    try {
      return await this.settlement.RelaySubscribe(
        {
          planKey: relay.planKey,
          subscriber: relay.subscriberWallet,
          permitSignature: relay.permitSignature,
          subscribeSignature: relay.subscribeSignature,
          deadline: relay.deadline,
          firstChargeAt: relay.firstChargeAt,
        },
        { pendingHash: relay.recorded, onSigned: recorder.onSigned }
      );
    } catch (error) {
      const recordedHere = recorder.RecordedHere();
      if (recordedHere) await this.RevertRelay(session, recordedHere, error);
      throw error;
    }
  }

  /**
   * The `onSigned` of a relay: records each signed hash on the session
   * (compare-and-set against the hash it holds) before the network sees it,
   * after `beforeRecord`. A confirm that lost the race to another one gets
   * the 409 with that one's hash.
   */
  private RelayRecorder(
    session: CheckoutSession,
    recorded: string | null,
    noun: 'payment' | 'subscription',
    beforeRecord: () => Promise<void> = async () => undefined
  ): {
    onSigned(hash: string): Promise<void>;
    Current(): string | null;
    RecordedHere(): string | null;
  } {
    let current = recorded;
    let recordedHere: string | null = null;
    return {
      onSigned: async (hash) => {
        await beforeRecord();
        const claimed =
          await this.checkoutSessionModule.SetPaymentTransactionHash(
            session.id,
            hash,
            current
          );
        if (!claimed) {
          const latest = await this.checkoutSessionModule.GetCheckoutSession(
            session.id
          );
          throw PaymentPending(
            latest?.payment_details?.transaction_hash ?? null,
            `Another confirmation is relaying this ${noun}. Confirm again with this transaction_hash.`,
            'another_confirmation'
          );
        }
        current = hash;
        recordedHere = hash;
      },
      Current: () => current,
      RecordedHere: () => recordedHere,
    };
  }

  /**
   * Complete checkout when the wallet is already subscribed on-chain (e.g.
   * a prior relay landed but its confirm failed). The subscription is read
   * from the chain; a client-sent id must be that one.
   */
  private async ConfirmSubscriptionFromExistingOnChain(
    session: CheckoutSession,
    subscriptionOnchainId?: string
  ): Promise<CheckoutSession> {
    const planKey = this.RequirePlanKey(session);
    const subscriberWallet = await this.ResolvePreparedSubscriberWallet(
      session
    );
    const onchainId = await this.settlement.FindExistingSubscription(
      planKey,
      subscriberWallet
    );

    if (!onchainId) {
      throw new AppError(
        'No on-chain subscription found for this wallet and plan',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }
    if (
      subscriptionOnchainId &&
      subscriptionOnchainId.toLowerCase() !== onchainId.toLowerCase()
    ) {
      throw new AppError(
        "subscription_onchain_id is not this wallet's subscription to the plan",
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }

    Logger.info('Completing checkout from existing on-chain subscription', {
      checkoutSessionId: session.id,
      subscriptionOnchainId: onchainId,
    });

    return this.SettleSubscription(session, {
      subscriberWallet,
      subscriptionOnchainId: onchainId,
      subscribeHash: null,
      confirmDeadline: Date.now() + GetCheckoutConfirmTimeoutMs(),
    });
  }

  /**
   * Record a verified subscription exactly once: every confirm that
   * verified it races for the session's settlement claim before any side
   * effect (the first-period collect included), as payments do.
   */
  private async SettleSubscription(
    session: CheckoutSession,
    details: {
      subscriberWallet: string;
      subscriptionOnchainId: string;
      /** The subscribe transaction; null when another one created it */
      subscribeHash: string | null;
      /** When the confirm's time budget runs out (ms since the epoch) */
      confirmDeadline: number;
    }
  ): Promise<CheckoutSession> {
    // A claim token, not a settlement reference: a client never sees a
    // subscription id as `transaction_hash`.
    const token = details.subscribeHash ?? details.subscriptionOnchainId;
    const finished = await this.ClaimSettlement(
      session,
      token,
      details.subscribeHash
    );
    if (finished) return finished;
    try {
      // Read again: a confirm that crashed after the claim may have created
      // the customer already.
      const latest =
        (await this.checkoutSessionModule.GetCheckoutSession(session.id)) ??
        session;
      return await this.FinalizeSubscriptionCheckout(latest, details);
    } catch (error) {
      try {
        await this.checkoutSessionModule.ReleasePaymentSettlement(
          session.id,
          token
        );
      } catch (releaseError) {
        Logger.error(
          'Could not release a checkout settlement claim',
          releaseError,
          { checkoutSessionId: session.id }
        );
      }
      throw error;
    }
  }

  /**
   * Creates the Subscription for a verified on-chain subscription. Without a
   * trial the first period is collected first, and the period follows the
   * charge's `Charged` event. With a trial (Q11a) nothing is collected: the
   * chain's first charge time is the trial end (the contract refuses any
   * charge before it), so the trial is `[now, nextChargeAt]` and the first
   * cycle invoice will start at `nextChargeAt`. A subscription whose first
   * charge is later than this checkout's trial allows is refused; one
   * already due has no trial left and is collected at once.
   */
  private async FinalizeSubscriptionCheckout(
    session: CheckoutSession,
    details: {
      subscriberWallet: string;
      subscriptionOnchainId: string;
      subscribeHash: string | null;
      confirmDeadline: number;
    }
  ): Promise<CheckoutSession> {
    if (!this.subscriptionModule || !this.customerModule) {
      throw new AppError(
        'Subscription checkout is not configured',
        ERRORS.INTERNAL_ERROR.status,
        ERRORS.INTERNAL_ERROR.type
      );
    }

    const price = this.RequireRecurringCheckoutPrice(session);
    const planKey = this.RequirePlanKey(session);
    AssertSingleQuantity(session);
    const { subscriberWallet, subscriptionOnchainId, subscribeHash } = details;
    await this.AssertOnchainSubscriptionUnbilled(subscriptionOnchainId);

    const state = await this.settlement.GetSubscriptionState(
      subscriptionOnchainId
    );
    if (state.status === 'paused') {
      throw new AppError(
        'The subscription is paused on-chain',
        409,
        PAUSED_ON_CHAIN
      );
    }
    if (state.status !== 'active') {
      throw new AppError(
        'The on-chain subscription is canceled',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }
    const now = state.chain_time ?? Now();
    const nextChargeAt = state.next_charge_at ?? now;
    const periodSeconds =
      state.period_seconds ??
      RecurringIntervalToSeconds(
        price.recurring?.interval ?? 'month',
        price.recurring?.interval_count ?? 1
      );

    const trialSeconds = TrialSeconds(price);
    const trialEnd =
      trialSeconds === 0
        ? null
        : state.next_charge_at === null
        ? now + trialSeconds
        : state.next_charge_at > now
        ? state.next_charge_at
        : null;
    if (trialEnd !== null && trialEnd > now + trialSeconds) {
      throw new AppError(
        "The on-chain subscription's first charge is later than this checkout's trial allows",
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }

    let first: FirstCharge | null = null;
    if (trialEnd === null) {
      first = await this.CollectFirstPeriod(session, {
        price,
        subscriptionOnchainId,
        planKey,
        subscriberWallet,
        amountCents: price.unit_amount ?? session.amount_total!,
        now,
        nextChargeAt,
        periodSeconds,
        confirmDeadline: details.confirmDeadline,
      });
    }
    const chargeHash = first?.transactionHash ?? null;

    const customerId = await this.EnsureCheckoutCustomer(
      session,
      subscriberWallet
    );

    const subscription = await this.subscriptionModule.CreateSubscription(
      session.platform_account,
      {
        customer: customerId,
        items: [{ price: price.id, quantity: 1 }],
        ...(trialEnd !== null ? { trial_end: trialEnd } : {}),
        default_payment_method: subscriberWallet,
        metadata: {
          checkout_session: session.id,
          wallet_address: subscriberWallet,
        },
      },
      {
        settlementTransactionHash: chargeHash ?? undefined,
        subscriptionOnchainId,
        periodStart: first ? first.period.start : now,
        periodEnd: first
          ? first.period.end ?? undefined
          : trialEnd ?? undefined,
      }
    );

    const completedSession =
      await this.checkoutSessionModule.CompleteCheckoutSession(
        session.id,
        {
          transaction_hash: subscribeHash ?? chargeHash,
          payer_wallet: subscriberWallet,
          relayed: session.payment_details?.relayed ?? false,
        },
        { subscription: subscription.id }
      );

    if (completedSession.payment_link && this.paymentLinkModule) {
      await this.paymentLinkModule.RecordCompletedSession(
        completedSession.payment_link
      );
    }

    Logger.info('Checkout session completed via subscription', {
      checkoutSessionId: completedSession.id,
      subscriptionId: subscription.id,
      subscribeHash,
      chargeHash,
    });

    return this.SanitizeCheckoutSession(completedSession);
  }

  /**
   * Collects the first period. The cycle is claimed for this session before
   * anything is sent, so no other session can collect it, and every charge
   * hash is recorded on the claim (and the session) first.
   * - Charges an earlier attempt recorded are reconciled, all their hashes
   *   together: paid counts; pending answers `payment_pending`.
   * - When a claim of this session ever sent a charge, the chain's
   *   `Charged` logs since its period started decide before anything is
   *   refused or sent again, so this session's own landed charge always
   *   completes it.
   * - `NotDueYet` with no charge of this session behind it is a 409
   *   `period_already_collected`: nothing is created, since this session
   *   did not pay.
   * The charge waits only for what is left of the confirm's budget; past it,
   * it is `payment_pending` and the client confirms again.
   * - The plan's destination decides where it pays: while the plan moves to
   *   the platform's new default wallet, nothing new is charged and the
   *   answer is `payment_pending` (the plan's change is followed first).
   */
  private async CollectFirstPeriod(
    session: CheckoutSession,
    cycle: {
      price: Price;
      subscriptionOnchainId: string;
      planKey: string;
      subscriberWallet: string;
      amountCents: number;
      now: number;
      nextChargeAt: number;
      periodSeconds: number;
      confirmDeadline: number;
    }
  ): Promise<FirstCharge> {
    const { subscriptionOnchainId, amountCents, periodSeconds } = cycle;
    const Pending = () =>
      PaymentPending(
        session.payment_details?.transaction_hash ?? null,
        'The first subscription payment is waiting for network confirmations. Confirm again shortly.'
      );
    const Paid = async (
      transactionHash: string,
      start: number,
      nextChargeAt: number | null
    ) => {
      await this.SetSessionPendingCharge(session, null);
      return {
        transactionHash,
        period:
          nextChargeAt === null
            ? { start, end: null }
            : { start: nextChargeAt - periodSeconds, end: nextChargeAt },
      };
    };

    const owned = await this.cycleClaims.FindOwned(
      subscriptionOnchainId,
      session.id
    );
    for (const claim of owned) {
      if (!claim.charge_hash) continue;
      let current = claim.charge_hash;
      const result = await this.settlement.ReconcileSubscriptionCharge(
        ClaimHashes(claim),
        {
          subscriptionOnchainId,
          amountCents,
          sentAt: claim.charge_sent_at,
          nonce: claim.charge_nonce ?? null,
          onReplaced: async (hash, signed) => {
            await this.RecordFirstCharge(
              session,
              claim.id,
              hash,
              current,
              signed
            );
            current = hash;
          },
        }
      );
      if (result.status === 'paid') {
        return Paid(
          result.transaction_hash,
          claim.due_at,
          result.next_charge_at
        );
      }
      if (result.status === 'pending') throw Pending();
      await this.cycleClaims.SetChargeHash(claim.id, null, current);
      await this.SetSessionPendingCharge(session, null);
      if (
        result.status === 'failed' &&
        COLLECTION_DECLINE_CODES.has(result.error.type)
      ) {
        throw result.error;
      }
    }
    // A charge of this session may have landed without a receipt to show.
    for (const claim of owned) {
      if (ClaimHashes(claim).length === 0) continue;
      const found = await this.FindClaimCharge(
        subscriptionOnchainId,
        claim.id,
        amountCents,
        claim.due_at
      );
      if (found) {
        return Paid(found.transaction_hash, claim.due_at, found.next_charge_at);
      }
    }

    if (cycle.now < cycle.nextChargeAt) throw PeriodAlreadyCollected();
    if (!(await this.planDestinations.ReadyToCharge(cycle.price))) {
      throw Pending();
    }
    const dueAt = CurrentDueAt(cycle.nextChargeAt, cycle.now, periodSeconds);
    const { claim, owned: claimed } = await this.cycleClaims.Claim(
      subscriptionOnchainId,
      dueAt,
      session.id
    );
    if (!claimed) throw PeriodAlreadyCollected();

    let recorded = claim.charge_hash;
    let recordedHere: string | null = null;
    try {
      const collection = await this.settlement.CollectSubscriptionPayment({
        subscriptionOnchainId,
        planKey: cycle.planKey,
        subscriberWallet: cycle.subscriberWallet,
        amountCents,
        onSigned: async (hash, signed) => {
          await this.RecordFirstCharge(
            session,
            claim.id,
            hash,
            recorded,
            signed
          );
          recorded = hash;
          recordedHere = hash;
        },
        timeoutMs: Math.max(1, cycle.confirmDeadline - Date.now()),
      });
      if (collection.status === 'collected') {
        return await Paid(
          collection.transaction_hash,
          dueAt,
          collection.next_charge_at
        );
      }
      if (collection.status === 'pending') throw Pending();
      // NotDueYet: only a charge of this session's own counts.
      const found = await this.FindClaimCharge(
        subscriptionOnchainId,
        claim.id,
        amountCents,
        dueAt,
        { ownOnly: true }
      );
      if (found) {
        return await Paid(found.transaction_hash, dueAt, found.next_charge_at);
      }
      throw PeriodAlreadyCollected();
    } catch (error) {
      const pending =
        error instanceof AppError && error.type === 'payment_pending';
      if (recordedHere && !pending) {
        await this.cycleClaims.SetChargeHash(claim.id, null, recordedHere);
        await this.SetSessionPendingCharge(session, null);
      }
      // The subscribe landed: surface the failure rather than record a
      // first payment that was not collected. Typed errors keep their
      // status and type; anything else may carry provider text, which stays
      // in the log.
      Logger.error('First-period subscription collect failed', error, {
        checkoutSessionId: session.id,
      });
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Subscription authorized on-chain, but the first payment could not be collected. Confirm again to retry.',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }
  }

  /**
   * A `Charged` log since `since` that pays this claim: not recorded by any
   * other cycle, and with `ownOnly` one of this claim's own hashes.
   */
  private async FindClaimCharge(
    subscriptionOnchainId: string,
    claimId: string,
    amountCents: number,
    since: number,
    options: { ownOnly?: boolean } = {}
  ): Promise<{ transaction_hash: string; next_charge_at: number } | null> {
    return this.settlement.FindSubscriptionCharge(subscriptionOnchainId, {
      amountCents,
      since,
      accept: async (hash) => {
        const claims = await this.cycleClaims.FindByChargeHash(hash);
        if (options.ownOnly && !claims.some((c) => c.id === claimId)) {
          return false;
        }
        return claims.every((c) => c.id === claimId);
      },
    });
  }

  /**
   * Records the first-period charge's hash on its cycle claim (with its
   * nonce), and on the session for visibility, before it is sent. A claim
   * that moved meanwhile cancels the send.
   */
  private async RecordFirstCharge(
    session: CheckoutSession,
    claimId: string,
    hash: string,
    expected: string | null,
    signed?: SignedTransaction
  ): Promise<void> {
    if (
      !(await this.cycleClaims.SetChargeHash(claimId, hash, expected, signed))
    ) {
      throw PaymentPending(
        session.payment_details?.transaction_hash ?? null,
        'Another confirmation is collecting the first subscription payment. Confirm again shortly.',
        'another_confirmation'
      );
    }
    await this.SetSessionPendingCharge(session, hash);
  }

  /** The session's `payment_details.pending_charge_hash`, while it is open. */
  private async SetSessionPendingCharge(
    session: CheckoutSession,
    hash: string | null
  ): Promise<void> {
    await this.db.FindOneAndUpdateByFilter<CheckoutSession>(
      'CheckoutSessions',
      { id: session.id, status: 'open' },
      { 'payment_details.pending_charge_hash': hash }
    );
  }

  /**
   * One on-chain subscription is billed by one live Subscription: the
   * contract charges it once per period, so a second would only ever see
   * its periods already collected. A subscription canceled here whose
   * on-chain cancel has not landed still counts. The simulated rail has no
   * such limit (and every simulated checkout uses the same test wallet).
   */
  private async AssertOnchainSubscriptionUnbilled(
    subscriptionOnchainId: string
  ): Promise<void> {
    if (this.settlement.Describe().rail !== 'onchain') return;
    const existing = await this.db.FindCustom<Subscription>(
      'Subscriptions',
      'subscription_onchain_id',
      '==',
      subscriptionOnchainId
    );
    const live = (existing ?? []).find(
      (subscription) =>
        subscription.cancel_pending_on_chain === true ||
        (subscription.status !== 'canceled' &&
          subscription.status !== 'incomplete_expired')
    );
    if (live) {
      throw new AppError(
        live.status === 'canceled'
          ? 'The previous subscription to this price is still being canceled on-chain; try again shortly'
          : 'This wallet already has a subscription to this price',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }
  }

  /** The recurring price's on-chain plan key. */
  private RequirePlanKey(session: CheckoutSession): string {
    const price = this.RequireRecurringCheckoutPrice(session);
    if (!price.subscription_plan_id) {
      throw new AppError(
        'This subscription price has no on-chain plan. Recreate the price and try again.',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }
    return price.subscription_plan_id;
  }

  private async ResolvePreparedSubscriberWallet(
    session: CheckoutSession
  ): Promise<string> {
    if (session.payment_details?.payer_wallet) {
      return session.payment_details.payer_wallet;
    }

    if (session.payment_intent && this.paymentIntentModule) {
      const paymentIntent = await this.paymentIntentModule.GetPaymentIntent(
        session.payment_intent
      );
      if (paymentIntent?.payment_method) {
        return paymentIntent.payment_method;
      }
    }

    throw new AppError(
      'Missing subscriber wallet for this Checkout Session. Call prepare again.',
      ERRORS.INVALID_REQUEST.status,
      ERRORS.INVALID_REQUEST.type
    );
  }

  private ShouldCreateCheckoutCustomer(session: CheckoutSession): boolean {
    if (session.customer) return false;
    if (session.mode === 'subscription') return true;
    return (
      session.customer_creation === 'always' ||
      session.customer_creation === 'if_required'
    );
  }

  private async EnsureCheckoutCustomer(
    session: CheckoutSession,
    payerWallet: string
  ): Promise<string> {
    if (session.customer) return session.customer;
    if (!this.customerModule) {
      throw new AppError(
        'Customer module is not configured',
        ERRORS.INTERNAL_ERROR.status,
        ERRORS.INTERNAL_ERROR.type
      );
    }

    const details = session.customer_details;
    const email = session.customer_email ?? details?.email ?? undefined;
    const individualName = details?.individual_name ?? undefined;
    const businessName = details?.business_name ?? undefined;
    const name = details?.name ?? individualName ?? businessName ?? undefined;
    const phone = details?.phone ?? undefined;
    const address = ToCreateCustomerAddress(details?.address);
    const shippingDetails = session.collected_information?.shipping_details;
    const shippingAddress = ToCreateCustomerAddress(shippingDetails?.address);
    const shipping =
      shippingDetails?.name && shippingAddress
        ? {
            name: shippingDetails.name,
            address: shippingAddress,
            ...(phone ? { phone } : {}),
          }
        : undefined;
    const taxIdData = (details?.tax_ids ?? [])
      .filter((taxId) => !!taxId.value?.trim())
      .map((taxId) => ({
        type: taxId.type?.trim() || 'unknown',
        value: taxId.value.trim(),
      }));
    const customFieldMetadata: Record<string, string> = {};
    for (const field of session.custom_fields ?? []) {
      const value =
        field.text?.value ??
        field.numeric?.value ??
        field.dropdown?.value ??
        null;
      if (!value?.trim()) continue;
      customFieldMetadata[`custom_field_${field.key}`] = value.trim();
    }

    const customer = await this.customerModule.CreateCustomer(
      session.platform_account,
      {
        email,
        name,
        individual_name: individualName ?? undefined,
        business_name: businessName ?? undefined,
        phone,
        address,
        shipping,
        ...(taxIdData.length > 0 ? { tax_id_data: taxIdData } : {}),
        description: `Checkout customer ${payerWallet}`,
        metadata: {
          wallet_address: payerWallet,
          checkout_session: session.id,
          ...customFieldMetadata,
        },
      }
    );

    await this.db.Update<CheckoutSession>('CheckoutSessions', session.id, {
      customer: customer.id,
    });

    return customer.id;
  }

  private RequireRecurringCheckoutPrice(session: CheckoutSession): Price {
    const lineItems = session.line_items?.data ?? [];
    if (lineItems.length !== 1) {
      throw new AppError(
        'Subscription checkout currently supports exactly one line item',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }

    const price = lineItems[0]?.price;
    if (!price || typeof price === 'string') {
      throw new AppError(
        'Subscription checkout requires an expanded recurring price',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }

    if (price.type !== 'recurring' || !price.recurring) {
      throw new AppError(
        'Subscription checkout requires a recurring price',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }

    return price;
  }

  /**
   * Record a completed checkout payment on the merchant's internal ledger,
   * once per session (see `RecordOnchainPayment`).
   */
  private async RecordPaymentOnLedger(
    session: CheckoutSession,
    amountCents: number,
    payerWallet: string | null,
    transactionHash: string
  ): Promise<BalanceTransaction> {
    return RecordOnchainPayment(this.db, this.settlement, {
      source: session.id,
      description: `Payment for Checkout Session ${session.id}`,
      account: session.platform_account,
      amountCents,
      currency: session.currency ?? 'usdc',
      payerWallet,
      transactionHash,
    });
  }

  /**
   * Strips platform-internal fields before serving a session to an
   * unauthenticated customer.
   */
  private SanitizeCheckoutSession(session: CheckoutSession): CheckoutSession {
    return {
      ...session,
      metadata: null,
      line_items: session.line_items
        ? {
            ...session.line_items,
            data: session.line_items.data.map((item) => ({
              ...item,
              metadata: {},
            })),
          }
        : null,
    };
  }

  private async GetSessionOrThrow(urlSlug: string): Promise<CheckoutSession> {
    const session =
      await this.checkoutSessionModule.GetCheckoutSessionByUrlSlug(urlSlug);

    if (!session) {
      throw new AppError(
        ERRORS.CHECKOUT_SESSION_NOT_FOUND.message,
        ERRORS.CHECKOUT_SESSION_NOT_FOUND.status,
        ERRORS.CHECKOUT_SESSION_NOT_FOUND.type
      );
    }

    return session;
  }

  /**
   * Resolve the merchant's receiving wallet for a checkout session: the
   * platform account's default external wallet.
   */
  private async ResolveMerchantWallet(
    platformAccountId: string
  ): Promise<ExternalWallet> {
    const merchantWallet = await this.externalWalletModule.GetDefaultWallet(
      platformAccountId
    );

    if (!merchantWallet) {
      throw new AppError(
        'The merchant has no wallet configured to receive payments',
        ERRORS.VALIDATION_ERROR.status,
        'no_wallet_configured'
      );
    }

    return merchantWallet;
  }

  /**
   * Ensure a checkout session can accept a payment: it must be open, unpaid,
   * and not past its expiry time.
   */
  private AssertSessionPayable(
    session: CheckoutSession,
    options: { allowExpired?: boolean } = {}
  ): void {
    if (session.status !== 'open' || session.payment_status !== 'unpaid') {
      throw new AppError(
        'This Checkout Session is no longer accepting payments',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }

    if (!options.allowExpired) this.AssertSessionNotExpired(session);

    if (session.mode !== 'subscription') this.AmountDue(session);
  }

  /** The amount a payment-mode session collects, in cents. */
  private AmountDue(session: CheckoutSession): number {
    if (!session.amount_total || session.amount_total <= 0) {
      throw new AppError(
        'This Checkout Session has no amount due',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }
    return session.amount_total;
  }

  private AssertSessionNotExpired(session: CheckoutSession): void {
    if (session.expires_at && session.expires_at < Now()) {
      throw new AppError(
        'This Checkout Session has expired',
        ERRORS.INVALID_REQUEST.status,
        ERRORS.INVALID_REQUEST.type
      );
    }
  }

  /**
   * Enforce required collection fields configured on the session (name,
   * phone, address, tax ID, custom fields, terms) before building a payment.
   */
  private AssertCollectedCustomerDetails(
    session: CheckoutSession,
    details?: Omit<PrepareCheckoutPaymentInput, 'payer_wallet'>
  ): void {
    const Require = (condition: boolean, message: string): void => {
      if (condition) {
        throw new AppError(
          message,
          ERRORS.VALIDATION_ERROR.status,
          ERRORS.VALIDATION_ERROR.type
        );
      }
    };

    Require(!details?.email?.trim(), 'Email is required');

    const individual = session.name_collection?.individual;
    Require(
      !!individual?.enabled && !individual.optional && !details?.name?.trim(),
      'Name is required'
    );

    const business = session.name_collection?.business;
    Require(
      !!business?.enabled &&
        !business.optional &&
        !details?.business_name?.trim(),
      'Business name is required'
    );

    Require(
      !!session.phone_number_collection?.enabled && !details?.phone?.trim(),
      'Phone number is required'
    );

    const AssertAddress = (
      required: boolean,
      address:
        | {
            line1?: string;
            city?: string;
            postal_code?: string;
            country?: string;
          }
        | undefined,
      label: string
    ): void => {
      Require(
        required && !address?.line1?.trim(),
        `${label} line 1 is required`
      );
      Require(required && !address?.city?.trim(), `${label} city is required`);
      Require(
        required && !address?.postal_code?.trim(),
        `${label} postal code is required`
      );
      Require(
        required && !address?.country?.trim(),
        `${label} country is required`
      );
    };

    AssertAddress(
      session.billing_address_collection === 'required',
      details?.address,
      'Billing address'
    );
    AssertAddress(
      !!session.shipping_address_collection,
      details?.shipping_address,
      'Shipping address'
    );
    Require(
      !!session.shipping_address_collection &&
        !details?.shipping_address?.name?.trim(),
      'Shipping name is required'
    );

    Require(
      !!session.tax_id_collection?.enabled &&
        session.tax_id_collection.required === 'if_supported' &&
        !details?.tax_id?.trim(),
      'Tax ID is required'
    );

    Require(
      session.consent_collection?.terms_of_service === 'required' &&
        !details?.terms_of_service_accepted,
      'Terms of service must be accepted'
    );

    for (const field of session.custom_fields ?? []) {
      if (field.optional) continue;
      const value = details?.custom_fields?.find(
        (entry) => entry.key === field.key
      )?.value;
      Require(!value?.trim(), `${field.label.custom ?? field.key} is required`);
    }
  }

  private async MarkPaymentIntentRequiresConfirmation(
    session: CheckoutSession,
    details: {
      payer_wallet: string;
      relayed: boolean;
      merchant_wallet: string;
      first_charge_at?: number | null;
    }
  ): Promise<void> {
    // Persist the payer and merchant wallets on the open session: confirm
    // rebuilds the signed authorization from them, and subscription confirm
    // resolves the subscriber without relying on a PaymentIntent. Never
    // while a relay is recorded (a confirm may have recorded one since this
    // prepare read the session).
    if (
      !(await this.checkoutSessionModule.RecordPreparedPayment(
        session.id,
        details
      ))
    ) {
      const latest = await this.checkoutSessionModule.GetCheckoutSession(
        session.id
      );
      throw PaymentPending(
        latest?.payment_details?.transaction_hash ?? null,
        'A payment is confirming for this Checkout Session'
      );
    }

    if (!session.payment_intent || !this.paymentIntentModule) return;

    // Until crypto PaymentMethods exist, store the payer wallet address as
    // the payment_method stand-in so the PI reflects that details were
    // collected (Stripe: attach PM → requires_confirmation).
    await this.paymentIntentModule.MarkRequiresConfirmation(
      session.payment_intent,
      { paymentMethod: details.payer_wallet }
    );
  }

  private async MarkPaymentIntentProcessing(
    session: CheckoutSession
  ): Promise<void> {
    if (!session.payment_intent || !this.paymentIntentModule) return;
    await this.paymentIntentModule.MarkProcessing(session.payment_intent);
  }

  private async MarkPaymentIntentSucceeded(
    session: CheckoutSession,
    details: { amountReceived: number; latestCharge: string | null }
  ): Promise<void> {
    if (!session.payment_intent || !this.paymentIntentModule) return;

    await this.paymentIntentModule.MarkSucceeded(session.payment_intent, {
      amountReceived: details.amountReceived,
      latestCharge: details.latestCharge,
    });
  }

  private async MarkPaymentIntentFailed(
    session: CheckoutSession,
    message: string,
    chargeId: string | null = null
  ): Promise<void> {
    if (!session.payment_intent || !this.paymentIntentModule) return;

    await this.paymentIntentModule.MarkPaymentFailed(session.payment_intent, {
      advice_code: null,
      charge: chargeId,
      code: 'payment_intent_payment_attempt_failed',
      decline_code: null,
      doc_url: null,
      message,
      network_advice_code: null,
      network_decline_code: null,
      param: null,
      payment_method: null,
      payment_method_type: 'crypto',
      source: null,
      type: 'invalid_request_error',
    });
  }

  /**
   * Create the Charge that Stripe would create when a PaymentIntent is
   * confirmed. No-ops when ChargeModule or a linked PaymentIntent is absent.
   */
  private async CreateCheckoutCharge(
    session: CheckoutSession,
    details: {
      amount: number;
      transactionHash: string;
      payerAddress: string | null;
      outcome: 'succeeded' | 'failed';
      failureMessage?: string;
    }
  ): Promise<Charge | null> {
    if (!session.payment_intent || !this.chargeModule) return null;

    const paymentIntent = this.paymentIntentModule
      ? await this.paymentIntentModule.GetPaymentIntent(session.payment_intent)
      : null;

    return this.chargeModule.CreateFromPaymentAttempt(
      session.platform_account,
      {
        amount: details.amount,
        currency: session.currency ?? 'usdc',
        payment_intent: session.payment_intent,
        payment_method:
          paymentIntent?.payment_method ?? details.payerAddress ?? null,
        customer: session.customer,
        description: paymentIntent?.description ?? session.id,
        metadata: paymentIntent?.metadata ?? {},
        receipt_email:
          paymentIntent?.receipt_email ?? session.customer_email ?? null,
        application_fee_amount: paymentIntent?.application_fee_amount ?? null,
        transfer_data: paymentIntent?.transfer_data
          ? {
              amount: paymentIntent.transfer_data.amount,
              destination: paymentIntent.transfer_data.destination,
            }
          : null,
        transfer_group: paymentIntent?.transfer_group ?? null,
        crypto: {
          buyer_address: details.payerAddress,
          transaction_hash: details.transactionHash,
        },
        outcome: details.outcome,
        failure_code:
          details.outcome === 'failed'
            ? 'payment_intent_payment_attempt_failed'
            : null,
        failure_message: details.failureMessage ?? null,
      }
    );
  }
}
