// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Chain-neutral settlement types shared by every rail implementation.
 *
 * @module chains/types
 */

import type {
  CheckoutTransferAuthorization,
  Eip712TypedData,
} from '@fiatdesk/shared-types';
import type { AppError } from '../../utils/AppError';

export type Rail = 'simulated' | 'onchain';

/** Identity of the active settlement rail. */
export interface RailDescription {
  rail: Rail;
  network: 'ethereum' | 'simulated';
  chain_id: number | null;
  native_currency: string;
  token_address: string;
}

/** Unsigned transaction returned by builders for the client to sign. */
export interface UnsignedTransaction {
  unsigned_transaction: string;
  /** Atomic units of `fee_currency`, as a decimal string */
  estimated_fee: string;
  fee_currency: string;
  chain_id: number | null;
  nonce: number | null;
  to: string | null;
}

export interface UnsignedPayoutBatch extends UnsignedTransaction {
  recipients_count: number;
  transaction_type: 'payout' | 'approval';
  batch_id: string | null;
  /** Gas limit as a decimal string; null when the rail has none */
  gas_limit: string | null;
  /** EIP-1559 fees in wei as decimal strings; null when the rail has none */
  max_fee_per_gas: string | null;
  max_priority_fee_per_gas: string | null;
  /** Latest block when the transaction was built; null when the rail has none */
  block_number: number | null;
  /** Unix time after which a payout transaction reverts; null for approvals */
  deadline: number | null;
  /** `deadline` plus the confirmation depth (informational) */
  release_after: number | null;
}

/** A block at confirmed depth: what every reconcile check reads. */
export interface ConfirmedBlock {
  number: number;
  /** Unix seconds */
  timestamp: number;
}

/** Inputs for building a payout batch (or its approval) transaction. */
export interface PayoutBuildOptions {
  /** Off-chain batch id emitted on-chain so receipts tie back to payouts */
  batchId?: string;
  /** Reuse this nonce (a replacement) instead of the next pending nonce */
  nonce?: number;
  /** Seconds from the latest block until the payout transaction expires */
  deadlineSeconds?: number;
  /** Fees of the transaction being replaced; the new fees are at least 1.125x */
  replacing?: {
    maxFeePerGas: string | null;
    maxPriorityFeePerGas: string | null;
  };
}

/** What a payout batch transaction must be, taken from the batch record. */
export interface PayoutTransactionExpectation {
  wallet: string;
  chainId: number | null;
  /** Nonce the batch is bound to (the wallet's actual nonce once known) */
  nonce: number | null;
  /** The unsigned transaction returned by build */
  unsignedTransaction: string;
  transactionType: 'payout' | 'approval';
  batchId: string | null;
  recipientsCount: number;
  totalCents: number;
  /** First block that can hold the batch transaction */
  fromBlock: number | null;
}

/** Whether a submitted transaction is the one the batch was built for. */
export type PayoutTransactionMatch =
  | { status: 'match'; transactionHash: string; nonce: number | null }
  | { status: 'mismatch'; reason: string }
  | { status: 'not_found' };

export interface BroadcastResult {
  transaction_hash: string;
  status: 'paid' | 'failed' | 'pending';
  viewer_url: string;
  failure_message?: string;
  failure_code?: 'account_frozen' | 'blockchain_error';
}

/** A single recipient in a batch USDC transfer */
export interface TransferRecipient {
  destinationAddress: string;
  amountInCents: number;
}

/** An incoming USDC deposit detected on-chain */
export interface IncomingDeposit {
  transactionHash: string;
  logIndex: number;
  /** Amount in USDC (human-readable, e.g. 10.50) */
  amount: number;
  /** Amount in cents (e.g. 1050) */
  amountCents: number;
  senderAddress: string;
  /** Unix timestamp of the transaction */
  timestamp: number;
  blockNumber: number;
}

/**
 * What the customer signs at checkout: an EIP-3009 authorization on-chain,
 * nothing on the simulated rail.
 */
export interface PreparedAuthorization {
  method: 'eip3009_transfer' | 'simulated';
  typed_data: Eip712TypedData | null;
  authorization: CheckoutTransferAuthorization | null;
  /**
   * Upper bound of the gas the relayer pays, in atomic units of
   * `fee_currency`
   */
  estimated_fee: string;
  fee_currency: 'eth' | 'none';
  chain_id: number | null;
}

/** Hooks around relaying a checkout authorization. */
export interface RelayCheckoutOptions {
  /** A relay already recorded for the session; reused while the node knows it */
  pendingHash?: string | null;
  /**
   * Unix time the session was created: where the search for an earlier
   * payment under the session's authorization starts
   */
  createdAt: number;
  /**
   * Runs with the hash of each signed relay transaction before it is sent.
   * A throw cancels the send.
   */
  onSigned(transactionHash: string): Promise<void>;
}

/** The payment a checkout session expects. */
export interface CheckoutPaymentExpectation {
  merchantWalletAddress: string;
  /**
   * The other wallets a payment under the session's authorization may pay
   * (the platform's current default, when it is not the recorded one)
   */
  otherMerchantWalletAddresses?: string[];
  amountInCents: number;
  checkoutSessionId: string;
  /** The wallet that signed the authorization (recorded at prepare) */
  payerAddress: string;
  /** Unix time the session was created; its authorization is never older */
  createdAt: number;
}

/** Result of verifying a checkout payment on-chain */
export interface CheckoutPaymentVerification {
  /**
   * `verified`: the session is paid. `failed`: final; the transaction does
   * not pay the session. `pending`: not settled yet (not mined, not
   * confirmed, or the node did not answer). `not_found`: the node does not
   * know the transaction and the session's authorization is unused, so
   * waiting cannot help.
   */
  status: 'verified' | 'failed' | 'pending' | 'not_found';
  /**
   * The transaction the result is about. It differs from the one checked
   * when another transaction used the session's authorization first.
   */
  transaction_hash: string | null;
  /** Total USDC (in cents) the authorized transfer paid the merchant */
  amount_cents: number;
  /** The payer's wallet address */
  payer_address: string | null;
  /** The wallet the verified transfer paid, when it is known */
  merchant_address?: string | null;
  /** Reason verification failed, if it did */
  failure_reason?: string;
}

/**
 * What a subscriber signs at checkout: our EIP-712 `Subscribe`, plus a USDC
 * permit for the Subscriptions contract when the allowance is too low.
 * Nothing on the simulated rail.
 */
export interface PreparedSubscribe {
  /** True when the subscriber must also sign `permit_typed_data` */
  needs_permit: boolean;
  /** The USDC permit; null when not needed */
  permit_typed_data: Eip712TypedData | null;
  /** The contract's `Subscribe` message; null on the simulated rail */
  subscribe_typed_data: Eip712TypedData | null;
  /** Unix time after which both signatures are refused; null if simulated */
  deadline: number | null;
  /**
   * When the first period is due (Unix seconds), as signed: the trial end,
   * or 0 for the subscribe time
   */
  first_charge_at: number;
  /**
   * Upper bound of the gas the relayer pays, in atomic units of
   * `fee_currency`
   */
  estimated_fee: string;
  fee_currency: 'eth' | 'none';
  chain_id: number | null;
}

/** A signed subscribe for the relayer to submit. */
export interface SubscribeRelay {
  planKey: string;
  subscriber: string;
  /** The USDC permit signature, when the subscriber signed one */
  permitSignature: string | null;
  subscribeSignature: string;
  /** The `deadline` both signatures were made with */
  deadline: number;
  /** The signed first charge time (0: the subscribe time) */
  firstChargeAt: number;
}

/** Hooks around relaying a subscribe. */
export type RelaySubscribeOptions = Omit<RelayCheckoutOptions, 'createdAt'>;

/** Result of verifying an on-chain subscribe */
export interface CheckoutSubscribeVerification {
  /**
   * `verified`: the subscription exists on-chain. `failed`: final; the
   * transaction did not subscribe and no subscription exists. `pending`:
   * not settled yet. `not_found`: the node does not know the transaction
   * and no subscription exists, so waiting cannot help.
   */
  status: 'verified' | 'failed' | 'pending' | 'not_found';
  /**
   * The transaction that subscribed; null when the subscription exists but
   * this transaction did not create it
   */
  transaction_hash: string | null;
  /** The subscriber wallet */
  subscriber_address: string | null;
  /** The on-chain subscription id */
  subscription_onchain_id: string | null;
  /** Reason verification failed, if it did */
  failure_reason?: string;
}

/** What a signed operator transaction used, for reconciling it later. */
export interface SignedTransaction {
  nonce: number;
}

/** One period's collection from a subscriber. */
export interface SubscriptionCollectParams {
  subscriptionOnchainId: string;
  subscriberWallet: string;
  planKey: string;
  amountCents: number;
  /**
   * Persists the charge's hash (and its nonce) before the network sees it.
   * A throw cancels the send.
   */
  onSigned(transactionHash: string, signed: SignedTransaction): Promise<void>;
  /** How long to wait for confirmations before answering `pending` (ms) */
  timeoutMs?: number;
}

/**
 * A collection's outcome. `already_collected`: this period was charged
 * already (`NotDueYet`) and nothing moved. `pending`: the charge was sent
 * and recorded but is not confirmed yet; reconcile it by its hash.
 */
export type SubscriptionCollection =
  | {
      status: 'collected';
      transaction_hash: string;
      /** The contract's next due time after this charge */
      next_charge_at: number | null;
    }
  | { status: 'already_collected'; transaction_hash: null }
  | { status: 'pending'; transaction_hash: string };

/**
 * What the hashes recorded for a charge say, all of them together (the
 * original and every re-priced replacement). `paid`: one of them is
 * confirmed with its `Charged` log. `failed`: it reverted; `error` says
 * whether that is a decline. `dropped`: none has a receipt and another
 * transaction took their nonce, so none will be mined. `pending`: not mined
 * yet; `transaction_hash` is the newest, a re-priced replacement when the
 * charge was stuck.
 */
export type ChargeReconciliation =
  | { status: 'paid'; transaction_hash: string; next_charge_at: number | null }
  | { status: 'failed'; error: AppError }
  | { status: 'dropped' }
  | { status: 'pending'; transaction_hash: string };

/** What reconciling a recorded charge needs besides its hashes. */
export interface ChargeReconcileExpectation {
  subscriptionOnchainId: string;
  amountCents: number;
  /** When the newest hash was recorded, for re-pricing a stuck charge */
  sentAt: number | null;
  /** The charge's nonce, as recorded when it was signed */
  nonce: number | null;
  /** Records a re-priced replacement's hash before it is sent */
  onReplaced(transactionHash: string, signed: SignedTransaction): Promise<void>;
}

/** A search of the `Charged` logs of one subscription. */
export interface ChargeSearch {
  amountCents: number;
  /** Only charges in blocks at or after this time (Unix seconds) */
  since: number;
  /** Whether a found charge counts; every one does by default */
  accept?(transactionHash: string): Promise<boolean>;
}

/** Options of a subscribe authorization. */
export interface SubscribeAuthorizationOptions {
  /** The permit values of the wallet's other live plans */
  otherPlansAllowance?: bigint;
  /** The trial before the first charge, in seconds */
  trialSeconds?: number;
}

/** Hooks around sending the plan owner's cancel. */
export interface SubscriptionCancelOptions {
  /** The cancel recorded earlier, followed instead of sending another */
  pendingHash?: string | null;
  /** When `pendingHash` was recorded, for re-pricing a stuck cancel */
  sentAt?: number | null;
  /** Records each signed cancel before it is sent */
  onSigned(transactionHash: string): Promise<void>;
}

/**
 * Options of a plan destination change: the same follow-and-re-price rule as
 * a cancel (`SubscriptionCancelOptions`).
 */
export type PlanDestinationOptions = SubscriptionCancelOptions;

/**
 * Where a plan destination change stands: `confirmed` once its transaction
 * has ETH_CONFIRMATIONS confirmations, or at once when the plan already pays
 * the destination (`transaction_hash` null, nothing sent); `pending` while
 * it may still land.
 */
export type PlanDestinationResult =
  | { status: 'confirmed'; transaction_hash: string | null }
  | { status: 'pending'; transaction_hash: string };

/** On-chain state of a subscription. */
export type OnchainSubscriptionStatus =
  | 'none'
  | 'active'
  | 'paused'
  | 'canceled';

/** What the chain says about a subscription's status and schedule. */
export interface OnchainSubscriptionState {
  status: OnchainSubscriptionStatus;
  /**
   * When the next period is due on-chain (Unix seconds); null when the rail
   * keeps no schedule, so the off-chain one applies
   */
  next_charge_at: number | null;
  /** The plan's period in seconds; null when the rail keeps no schedule */
  period_seconds: number | null;
  /** The chain's time (latest block); null when the rail has no chain */
  chain_time: number | null;
}

/**
 * Error types of collections. A decline uses up a retry; every other code
 * is a wait or a state the billing runner resolves.
 */
export const COLLECTION_FAILED_ALLOWANCE = 'collection_failed_allowance';
export const INSUFFICIENT_FUNDS = 'insufficient_funds';
export const ACCOUNT_FROZEN = 'account_frozen';
/** The subscription is paused on-chain. */
export const PAUSED_ON_CHAIN = 'paused_on_chain';
/** The subscription is canceled on-chain (or never existed): terminal. */
export const CANCELED_ON_CHAIN = 'canceled_on_chain';
/** This period was already collected; wait for the next one. */
export const PERIOD_ALREADY_COLLECTED = 'period_already_collected';
/** A charge was sent and is not confirmed yet. */
export const CHARGE_PENDING = 'charge_pending';
/** The invoice bills a period the contract skipped; it is voided. */
export const CYCLE_MISSED = 'cycle_missed';
/** The subscription's price is not on the plan it subscribed to. */
export const ONCHAIN_PLAN_MISMATCH = 'onchain_plan_mismatch';
/** The amount exceeds what the on-chain plan can collect per period. */
export const ONCHAIN_PLAN_AMOUNT_EXCEEDED = 'onchain_plan_amount_exceeded';
/** SUBSCRIPTION_OPERATOR_KEY does not own the plan, so it cannot change it. */
export const PLAN_OWNER_MISMATCH = 'plan_owner_mismatch';
/** The plan's destination change is not confirmed yet; charges wait for it. */
export const PLAN_DESTINATION_PENDING = 'plan_destination_pending';

export const COLLECTION_DECLINE_CODES: ReadonlySet<string> = new Set([
  COLLECTION_FAILED_ALLOWANCE,
  INSUFFICIENT_FUNDS,
  ACCOUNT_FROZEN,
]);
