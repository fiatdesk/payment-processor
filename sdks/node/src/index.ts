import { HttpClient } from './HttpClient';
import { Accounts } from './resources/Accounts';
import { AccountLinks } from './resources/AccountLinks';
import { BalanceResource } from './resources/Balance';
import { BalanceTransactions } from './resources/BalanceTransactions';
import { Billing } from './resources/Billing';
import { Charges } from './resources/Charges';
import { Checkout } from './resources/Checkout';
import { Customers } from './resources/Customers';
import { Events } from './resources/Events';
import { Identity } from './resources/Identity';
import { InvoiceItems } from './resources/InvoiceItems';
import { Invoices } from './resources/Invoices';
import { LoginLinks } from './resources/LoginLinks';
import { PaymentIntents } from './resources/PaymentIntents';
import { PaymentLinks } from './resources/PaymentLinks';
import { Payouts } from './resources/Payouts';
import { Prices } from './resources/Prices';
import { Products } from './resources/Products';
import { Subscriptions } from './resources/Subscriptions';
import { SubscriptionItems } from './resources/SubscriptionItems';
import { TopUps } from './resources/TopUps';
import { Transfers } from './resources/Transfers';
import { WebhookEndpoints } from './resources/WebhookEndpoints';
import { Webhooks } from './resources/Webhooks';

export interface FiatDeskConfig {
  /**
   * Request timeout in milliseconds (default: 30000). Payout broadcasts wait
   * for confirmations, so they use at least 90 s (150 s for a reported hash);
   * any request can set its own `timeout` in its options.
   */
  timeout?: number;
}

/**
 * FiatDesk SDK client for interacting with the FiatDesk API.
 *
 * @example
 * ```typescript
 * import { FiatDesk } from '@fiatdesk/node';
 *
 * const fiatdesk = new FiatDesk('sk_live_fd_YOUR_API_KEY', 'https://api.yourdomain.com');
 *
 * // Create an account
 * const account = await fiatdesk.accounts.create({
 *   country: 'US',
 *   email: 'jenny.rosen@example.com',
 *   controller: {
 *     fees: { payer: 'application' },
 *     losses: { payments: 'application' },
 *     fiatdesk_dashboard: { type: 'express' },
 *   },
 * });
 * ```
 */
export class FiatDesk {
  private readonly client: HttpClient;

  /** Accounts API resource */
  readonly accounts: Accounts;

  /** AccountLinks API resource */
  readonly accountLinks: AccountLinks;

  /** Balance API resource */
  readonly balance: BalanceResource;

  /** BalanceTransactions API resource */
  readonly balanceTransactions: BalanceTransactions;

  /** Billing helpers (subscription cycle collection) */
  readonly billing: Billing;

  /** Charges API resource */
  readonly charges: Charges;

  /** Checkout API namespace */
  readonly checkout: Checkout;

  /** Customers API resource */
  readonly customers: Customers;

  /** Events API resource */
  readonly events: Events;

  /** Identity API namespace */
  readonly identity: Identity;

  /** InvoiceItems API resource */
  readonly invoiceItems: InvoiceItems;

  /** Invoices API resource */
  readonly invoices: Invoices;

  /** LoginLinks API resource */
  readonly loginLinks: LoginLinks;

  /** PaymentIntents API resource */
  readonly paymentIntents: PaymentIntents;

  /** PaymentLinks API resource */
  readonly paymentLinks: PaymentLinks;

  /**
   * Payouts API resource. Payouts settle in USDC on Ethereum from the
   * platform wallet, which signs locally with its private key and pays the
   * network gas in ETH. The first batch for a wallet also signs a one-time
   * approval of the PayoutBatch contract; `processAll()` handles it.
   *
   * @example
   * ```typescript
   * const results = await fiatdesk.payouts.processAll(
   *   process.env.WALLET_PRIVATE_KEY as `0x${string}`
   * );
   * if (results.some((r) => r.status === 'pending')) {
   *   await fiatdesk.payouts.reconcile(); // later, then process again
   * }
   * ```
   */
  readonly payouts: Payouts;

  /** Prices API resource */
  readonly prices: Prices;

  /** Products API resource */
  readonly products: Products;

  /** Subscriptions API resource */
  readonly subscriptions: Subscriptions;

  /** SubscriptionItems API resource */
  readonly subscriptionItems: SubscriptionItems;

  /** TopUps API resource */
  readonly topups: TopUps;

  /** Transfers API resource */
  readonly transfers: Transfers;

  /** WebhookEndpoints API resource */
  readonly webhookEndpoints: WebhookEndpoints;

  /** Webhooks utility for signature verification */
  readonly webhooks: Webhooks;

  /**
   * Creates a new FiatDesk SDK instance.
   *
   * @param apiKey - Your FiatDesk API secret key
   * @param baseUrl - The base URL of your FiatDesk API instance
   * @param config - Optional configuration options
   */
  constructor(apiKey: string, baseUrl: string, config: FiatDeskConfig = {}) {
    if (!apiKey) {
      throw new Error('FiatDesk API key is required');
    }
    if (!baseUrl) {
      throw new Error('FiatDesk API base URL is required');
    }

    this.client = new HttpClient({
      apiKey,
      baseUrl,
      timeout: config.timeout,
    });

    // Initialize resources
    this.accounts = new Accounts(this.client);
    this.accountLinks = new AccountLinks(this.client);
    this.balance = new BalanceResource(this.client);
    this.balanceTransactions = new BalanceTransactions(this.client);
    this.billing = new Billing(this.client);
    this.charges = new Charges(this.client);
    this.checkout = new Checkout(this.client);
    this.customers = new Customers(this.client);
    this.events = new Events(this.client);
    this.identity = new Identity(this.client);
    this.invoiceItems = new InvoiceItems(this.client);
    this.invoices = new Invoices(this.client);
    this.loginLinks = new LoginLinks(this.client);
    this.paymentIntents = new PaymentIntents(this.client);
    this.paymentLinks = new PaymentLinks(this.client);
    this.payouts = new Payouts(this.client);
    this.prices = new Prices(this.client);
    this.products = new Products(this.client);
    this.subscriptions = new Subscriptions(this.client);
    this.subscriptionItems = new SubscriptionItems(this.client);
    this.topups = new TopUps(this.client);
    this.transfers = new Transfers(this.client);
    this.webhookEndpoints = new WebhookEndpoints(this.client);
    this.webhooks = new Webhooks();
  }
}

// Default export for convenient usage: import FiatDesk from '@fiatdesk/node'
export default FiatDesk;

// Named exports
export {
  FiatDeskApiError,
  FiatDeskPayoutBatchError,
  PAYOUT_BATCH_ERROR_CODES,
} from './HttpClient';
export type { PayoutBatchErrorCode, RequestExtraOptions } from './HttpClient';
export type {
  EnsureAllowanceOptions,
  ProcessAllError,
  ProcessAllOptions,
  ProcessBatchOptions,
  SignPayoutOptions,
} from './resources/Payouts';
export { WebhookSignatureVerificationError } from './resources/Webhooks';
export * from '@fiatdesk/shared-types';
