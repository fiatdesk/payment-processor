// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Settlement rail selection and the simulated (no-chain) implementation.
 *
 * Test mode defaults to simulated funds. Set SETTLEMENT_RAIL=onchain with
 * LIVEMODE=false to settle on Sepolia (or Anvil via ETH_CHAIN_ID=31337).
 *
 * @module Settlement
 */

import { isAddress } from 'viem';
import type {
  CheckoutTransferAuthorization,
  PublicConfig,
} from '@fiatdesk/shared-types';
import { GetAppConfig, type SupportedChainId } from '../AppConfig';
import { ChainClientsGeneration } from './Chain';
import { CHAIN_EXPLORERS } from './contracts';
import { Ethereum } from './Ethereum';
import { AppError } from '../../utils/AppError';
import { Now } from '../../utils/Timestamp';
import type {
  BroadcastResult,
  CheckoutPaymentExpectation,
  CheckoutPaymentVerification,
  ConfirmedBlock,
  CheckoutSubscribeVerification,
  IncomingDeposit,
  ChargeReconcileExpectation,
  ChargeReconciliation,
  ChargeSearch,
  OnchainSubscriptionState,
  PayoutBuildOptions,
  PayoutTransactionExpectation,
  PayoutTransactionMatch,
  PlanDestinationOptions,
  PlanDestinationResult,
  PreparedAuthorization,
  PreparedSubscribe,
  RailDescription,
  RelayCheckoutOptions,
  RelaySubscribeOptions,
  SubscribeAuthorizationOptions,
  SubscribeRelay,
  SubscriptionCancelOptions,
  SubscriptionCollectParams,
  SubscriptionCollection,
  TransferRecipient,
  UnsignedPayoutBatch,
  UnsignedTransaction,
} from './types';

/**
 * Everything the API needs from a settlement rail. Call sites depend on this
 * interface only, so rails can be swapped without per-flow branching.
 */
export interface Settlement {
  Describe(): RailDescription;
  ExplorerUrl(type: 'tx' | 'address', value: string): string;
  CheckWalletExists(address: string): Promise<boolean>;
  GetNativeBalance(address: string): Promise<number>;
  GetUSDCBalance(address: string): Promise<number>;
  /** The chain's latest block number; 0 on a rail without a chain. */
  GetLatestBlockNumber(): Promise<bigint>;
  /**
   * One deposit per USDC `Transfer` log to `address` in the inclusive block
   * range. Throws when the node cannot serve the range.
   */
  GetIncomingDeposits(
    address: string,
    range: { fromBlock: bigint; toBlock: bigint }
  ): Promise<IncomingDeposit[]>;
  /**
   * Unsigned batch payout, or the one-time approval when the platform
   * wallet's allowance does not cover the batch.
   */
  BuildBatchPayoutTransaction(
    sender: string,
    recipients: TransferRecipient[],
    options?: PayoutBuildOptions
  ): Promise<UnsignedPayoutBatch>;
  BuildApprovalTransaction(
    sender: string,
    options?: PayoutBuildOptions
  ): Promise<UnsignedPayoutBatch>;
  /** Hash of a raw signed transaction, or a normalised hash; null if unknown. */
  GetTransactionHash(signedOrHash: string): string | null;
  /** Checks a raw signed transaction or a broadcast hash against a batch. */
  MatchPayoutTransaction(
    signedOrHash: string,
    expected: PayoutTransactionExpectation
  ): Promise<PayoutTransactionMatch>;
  /**
   * Submits a raw signed transaction (a hash was submitted by the wallet),
   * then waits for confirmations. Throws only when a raw transaction was not
   * accepted; a timeout resolves `pending`.
   */
  BroadcastSignedTransaction(
    signedOrHash: string,
    expected: PayoutTransactionExpectation
  ): Promise<BroadcastResult>;
  WaitForReceipt(
    transactionHash: string,
    expected: PayoutTransactionExpectation
  ): Promise<BroadcastResult>;
  /**
   * The block at depth ETH_CONFIRMATIONS (number and timestamp). Reconcile
   * reads it once and passes it to every check below, so they all see one
   * chain state.
   */
  GetConfirmedBlock(): Promise<ConfirmedBlock>;
  /**
   * True when a signed batch can still execute until its deadline, so
   * releasing or refunding its payouts must wait for the expiry proof.
   */
  WaitsForExpiry(): boolean;
  /** Settles from a receipt mined at or before `confirmedBlock`; else `pending`. */
  GetTransactionStatus(
    transactionHash: string,
    expected: PayoutTransactionExpectation,
    confirmedBlock: number
  ): Promise<BroadcastResult>;
  /** Whether the wallet has paid the batch's id on-chain as of `blockNumber`. */
  IsBatchPaid(
    expected: PayoutTransactionExpectation,
    blockNumber: number
  ): Promise<boolean>;
  /** Locates the transaction that paid the batch, up to `toBlock`; or null. */
  FindBatchPayment(
    expected: PayoutTransactionExpectation,
    toBlock: number
  ): Promise<BroadcastResult | null>;
  /** The wallet's next nonce as of `blockNumber`; null when the rail has none. */
  GetAccountNonce(address: string, blockNumber: number): Promise<number | null>;
  /** The addresses the token issuer has blacklisted. */
  IsBlacklisted(addresses: string[]): Promise<string[]>;
  /**
   * What the payer signs to pay `amountCents` to the merchant for the
   * session: an EIP-3009 authorization valid until `expiresAt`.
   */
  BuildCheckoutPaymentAuthorization(
    payer: string,
    merchant: string,
    amountCents: number,
    sessionId: string,
    expiresAt: number
  ): Promise<PreparedAuthorization>;
  /**
   * Submits the signed authorization and returns the transaction hash;
   * `options.onSigned` sees the hash before the network does. Returns the
   * pending hash while the node still knows it, or null when the
   * authorization was already used on-chain, without sending anything.
   * Throws when nothing was accepted.
   */
  RelayCheckoutAuthorization(
    authorization: CheckoutTransferAuthorization,
    signature: string,
    options: RelayCheckoutOptions
  ): Promise<string | null>;
  /**
   * Waits up to `timeoutMs` for the transaction to confirm, then checks it
   * pays the session. With no hash, or a transaction that does not pay, it
   * looks for another transaction that used the session's authorization.
   */
  VerifyCheckoutPayment(
    transactionHash: string | null,
    expected: CheckoutPaymentExpectation,
    options?: { timeoutMs?: number }
  ): Promise<CheckoutPaymentVerification>;
  /** The wallet that owns subscription plans and collects (the puller). */
  GetPlanOwnerAddress(): string;
  /**
   * Registers the recurring price's plan (`createPlan`) and returns its
   * plan key; an existing plan with the same terms is returned as it is.
   */
  CreateSubscriptionPlan(
    priceId: string,
    periodSeconds: number,
    amountCents: number,
    destination: string,
    puller: string
  ): Promise<string>;
  /**
   * What the subscriber signs to subscribe to the plan: the `Subscribe`
   * message, and a USDC permit (for the current allowance plus this plan's
   * bounded value) when the allowance is below this plan's value plus
   * `otherPlansAllowance`, the values of the wallet's other live plans.
   * Valid until `expiresAt` at most. With `trialSeconds`, the first charge
   * is due that long after now (`first_charge_at`), else at subscribe.
   */
  BuildSubscribeAuthorization(
    subscriber: string,
    planKey: string,
    expiresAt: number,
    options?: SubscribeAuthorizationOptions
  ): Promise<PreparedSubscribe>;
  /**
   * Submits the signed subscribe (with its permit, if any) and returns the
   * transaction hash; `options.onSigned` sees the hash before the network
   * does. Returns the pending hash while the node still knows it, or null
   * when the subscriber is already subscribed, without sending anything.
   */
  RelaySubscribe(
    relay: SubscribeRelay,
    options: RelaySubscribeOptions
  ): Promise<string | null>;
  /** The subscription id when the wallet is subscribed (active or paused). */
  FindExistingSubscription(
    planKey: string,
    subscriber: string
  ): Promise<string | null>;
  /**
   * Waits up to `timeoutMs` for the subscribe transaction to confirm, then
   * checks the subscription exists. With no hash it only looks for the
   * subscription.
   */
  VerifySubscribeTransaction(
    transactionHash: string | null,
    expected: { planKey: string; subscriberWallet: string },
    options?: { timeoutMs?: number }
  ): Promise<CheckoutSubscribeVerification>;
  /** The subscription's on-chain status and schedule, at chain time. */
  GetSubscriptionState(
    subscriptionOnchainId: string
  ): Promise<OnchainSubscriptionState>;
  /**
   * Collects the current period; `params.onSigned` records the charge's
   * hash before it is sent. Throws `paused_on_chain`, `canceled_on_chain`
   * or a decline (`collection_failed_allowance`, `insufficient_funds`,
   * `account_frozen`).
   */
  CollectSubscriptionPayment(
    params: SubscriptionCollectParams
  ): Promise<SubscriptionCollection>;
  /**
   * What every hash recorded for a charge says, together (see
   * `ChargeReconciliation`).
   */
  ReconcileSubscriptionCharge(
    transactionHashes: string[],
    expected: ChargeReconcileExpectation
  ): Promise<ChargeReconciliation>;
  /**
   * The newest charge of `amountCents` mined at or after `since` that
   * `accept` takes, or null.
   */
  FindSubscriptionCharge(
    subscriptionOnchainId: string,
    expected: ChargeSearch
  ): Promise<{ transaction_hash: string; next_charge_at: number } | null>;
  /**
   * Sends the plan owner's cancel without waiting for it; `onSigned`
   * records the hash first. Null when the subscription is not active or
   * paused on-chain (nothing to send); the recorded cancel while it may
   * still land (re-priced after 10 minutes).
   */
  CancelSubscription(
    subscriptionOnchainId: string,
    options: SubscriptionCancelOptions
  ): Promise<string | null>;
  /**
   * Points the plan's future charges at `destination` from the plan owner,
   * without waiting for confirmations; `onSigned` records each hash first.
   * A recorded change is followed (re-priced after 10 minutes) until it is
   * confirmed. Throws a 409 `plan_owner_mismatch` when
   * SUBSCRIPTION_OPERATOR_KEY does not own the plan.
   */
  SetPlanDestination(
    planKey: string,
    destination: string,
    options: PlanDestinationOptions
  ): Promise<PlanDestinationResult>;
}

const SIM_SIG_PREFIX = 'sim_sig:';

/** Default payer used by simulated checkout and test helpers. */
export const SIMULATED_TEST_WALLET =
  '0x1111111111111111111111111111111111111111';

export function IsSimulatedSettlement(): boolean {
  return GetAppConfig().settlement_rail === 'simulated';
}

export function SimulatedSignature(
  checkoutSessionId: string,
  payerWallet: string
): string {
  return `${SIM_SIG_PREFIX}${checkoutSessionId}:${payerWallet}`;
}

function DummyUnsignedTransaction(): UnsignedTransaction {
  return {
    unsigned_transaction: 'sim_tx',
    estimated_fee: '0',
    fee_currency: 'none',
    chain_id: null,
    nonce: null,
    to: null,
  };
}

function PayerFromSimulatedSignature(signature: string): string | null {
  if (!signature.startsWith(SIM_SIG_PREFIX)) return null;
  const rest = signature.slice(SIM_SIG_PREFIX.length);
  const separator = rest.indexOf(':');
  if (separator < 0) return rest || null;
  return rest.slice(separator + 1) || null;
}

/** The checkout session a `sim_sig:` reference names, if any. */
function SessionFromSimulatedSignature(signature: string): string | null {
  if (!signature.startsWith(SIM_SIG_PREFIX)) return null;
  const rest = signature.slice(SIM_SIG_PREFIX.length);
  const separator = rest.indexOf(':');
  return separator > 0 ? rest.slice(0, separator) : null;
}

/** In-process rail that settles without touching a chain. */
export class SimulatedSettlement implements Settlement {
  Describe(): RailDescription {
    return {
      rail: 'simulated',
      network: 'simulated',
      chain_id: null,
      native_currency: 'none',
      token_address: 'simulated',
    };
  }

  ExplorerUrl(_type: 'tx' | 'address', _value: string): string {
    return '';
  }

  async CheckWalletExists(address: string): Promise<boolean> {
    return isAddress(address);
  }

  async GetNativeBalance(_address: string): Promise<number> {
    return 0;
  }

  async GetUSDCBalance(_address: string): Promise<number> {
    return 0;
  }

  GetPlanOwnerAddress(): string {
    return SIMULATED_TEST_WALLET;
  }

  async GetLatestBlockNumber(): Promise<bigint> {
    return 0n;
  }

  async GetIncomingDeposits(): Promise<IncomingDeposit[]> {
    return [];
  }

  async BuildCheckoutPaymentAuthorization(): Promise<PreparedAuthorization> {
    return {
      method: 'simulated',
      typed_data: null,
      authorization: null,
      estimated_fee: '0',
      fee_currency: 'none',
      chain_id: null,
    };
  }

  /** The simulated wallet's `sim_sig:` reference stands for the transaction. */
  async RelayCheckoutAuthorization(
    _authorization: CheckoutTransferAuthorization,
    signature: string,
    options: RelayCheckoutOptions
  ): Promise<string | null> {
    if (!PayerFromSimulatedSignature(signature)) {
      throw new AppError(
        'signature must be a simulated wallet signature in test mode',
        400,
        'invalid_request_error'
      );
    }
    if (options.pendingHash) return options.pendingHash;
    await options.onSigned(signature);
    return signature;
  }

  async BuildSubscribeAuthorization(): Promise<PreparedSubscribe> {
    return {
      needs_permit: false,
      permit_typed_data: null,
      subscribe_typed_data: null,
      deadline: null,
      first_charge_at: 0,
      estimated_fee: '0',
      fee_currency: 'none',
      chain_id: null,
    };
  }

  /** The simulated wallet's `sim_sig:` reference stands for the transaction. */
  async RelaySubscribe(
    relay: SubscribeRelay,
    options: RelaySubscribeOptions
  ): Promise<string | null> {
    if (!PayerFromSimulatedSignature(relay.subscribeSignature)) {
      throw new AppError(
        'subscribe_signature must be a simulated wallet signature in test mode',
        400,
        'invalid_request_error'
      );
    }
    if (options.pendingHash) return options.pendingHash;
    await options.onSigned(relay.subscribeSignature);
    return relay.subscribeSignature;
  }

  async FindExistingSubscription(
    _planKey: string,
    _subscriber: string
  ): Promise<string | null> {
    return null;
  }

  async VerifySubscribeTransaction(
    transactionHash: string | null,
    expected: { planKey: string; subscriberWallet: string }
  ): Promise<CheckoutSubscribeVerification> {
    if (!transactionHash || !PayerFromSimulatedSignature(transactionHash)) {
      return {
        status: transactionHash ? 'failed' : 'pending',
        transaction_hash: transactionHash,
        subscriber_address: null,
        subscription_onchain_id: null,
        ...(transactionHash
          ? { failure_reason: 'Invalid simulated subscription' }
          : {}),
      };
    }
    // One simulated subscription per checkout session: the test wallet is
    // the same for every simulated checkout.
    const session = SessionFromSimulatedSignature(transactionHash);
    return {
      status: 'verified',
      transaction_hash: transactionHash,
      subscriber_address: expected.subscriberWallet,
      subscription_onchain_id: `sim_sub_${expected.planKey}_${
        expected.subscriberWallet
      }${session ? `_${session}` : ''}`,
    };
  }

  /** Always active; the off-chain schedule applies (no chain to read). */
  async GetSubscriptionState(): Promise<OnchainSubscriptionState> {
    return {
      status: 'active',
      next_charge_at: null,
      period_seconds: null,
      chain_time: null,
    };
  }

  /** Collects at once; the `sim_collect:` reference stands for the charge. */
  async CollectSubscriptionPayment(
    params: SubscriptionCollectParams
  ): Promise<SubscriptionCollection> {
    const reference = `sim_collect:${params.subscriberWallet}`;
    await params.onSigned(reference, { nonce: 0 });
    return {
      status: 'collected',
      transaction_hash: reference,
      next_charge_at: null,
    };
  }

  async ReconcileSubscriptionCharge(
    transactionHashes: string[]
  ): Promise<ChargeReconciliation> {
    return {
      status: 'paid',
      transaction_hash: transactionHashes[transactionHashes.length - 1],
      next_charge_at: null,
    };
  }

  async FindSubscriptionCharge(): Promise<null> {
    return null;
  }

  async CancelSubscription(): Promise<string | null> {
    return null;
  }

  /** No chain: the change is confirmed at once and nothing is sent. */
  async SetPlanDestination(): Promise<PlanDestinationResult> {
    return { status: 'confirmed', transaction_hash: null };
  }

  async VerifyCheckoutPayment(
    transactionHash: string | null,
    expected: CheckoutPaymentExpectation
  ): Promise<CheckoutPaymentVerification> {
    if (!transactionHash) {
      return {
        status: 'pending',
        transaction_hash: null,
        amount_cents: 0,
        payer_address: null,
      };
    }
    const payerAddress = PayerFromSimulatedSignature(transactionHash);
    if (!payerAddress) {
      return {
        status: 'failed',
        transaction_hash: transactionHash,
        amount_cents: 0,
        payer_address: null,
        failure_reason: 'Invalid simulated payment',
      };
    }
    return {
      status: 'verified',
      transaction_hash: transactionHash,
      amount_cents: expected.amountInCents,
      payer_address: payerAddress,
      merchant_address: expected.merchantWalletAddress,
    };
  }

  async CreateSubscriptionPlan(
    priceId: string,
    _periodSeconds: number,
    _amountCents: number,
    _destination: string,
    _puller: string
  ): Promise<string> {
    return `sim_plan_${priceId}`;
  }

  async BuildBatchPayoutTransaction(
    _sender: string,
    recipients: TransferRecipient[],
    options?: PayoutBuildOptions
  ): Promise<UnsignedPayoutBatch> {
    return SimulatedPayoutBatch('payout', recipients.length, options);
  }

  async BuildApprovalTransaction(
    _sender: string,
    options?: PayoutBuildOptions
  ): Promise<UnsignedPayoutBatch> {
    return SimulatedPayoutBatch('approval', 0, options);
  }

  GetTransactionHash(): string | null {
    return null;
  }

  async MatchPayoutTransaction(
    _signedOrHash: string,
    expected: PayoutTransactionExpectation
  ): Promise<PayoutTransactionMatch> {
    return {
      status: 'match',
      transactionHash: SimulatedPayoutHash(expected),
      nonce: null,
    };
  }

  async BroadcastSignedTransaction(
    _signedOrHash: string,
    expected: PayoutTransactionExpectation
  ): Promise<BroadcastResult> {
    return SimulatedPaid(SimulatedPayoutHash(expected));
  }

  async WaitForReceipt(transactionHash: string): Promise<BroadcastResult> {
    return SimulatedPaid(transactionHash);
  }

  async GetConfirmedBlock(): Promise<ConfirmedBlock> {
    return { number: 0, timestamp: Now() };
  }

  /** Nothing can execute a simulated batch later. */
  WaitsForExpiry(): boolean {
    return false;
  }

  async GetTransactionStatus(
    transactionHash: string
  ): Promise<BroadcastResult> {
    return SimulatedPaid(transactionHash);
  }

  async IsBatchPaid(): Promise<boolean> {
    return false;
  }

  async FindBatchPayment(): Promise<BroadcastResult | null> {
    return null;
  }

  async GetAccountNonce(): Promise<number | null> {
    return null;
  }

  async IsBlacklisted(): Promise<string[]> {
    return [];
  }
}

function SimulatedPayoutBatch(
  transactionType: UnsignedPayoutBatch['transaction_type'],
  recipientsCount: number,
  options?: PayoutBuildOptions
): UnsignedPayoutBatch {
  // Stored for the record; the simulated rail never waits on it.
  const deadline =
    transactionType === 'payout' && options?.deadlineSeconds
      ? Now() + options.deadlineSeconds
      : null;
  return {
    ...DummyUnsignedTransaction(),
    recipients_count: recipientsCount,
    transaction_type: transactionType,
    batch_id: transactionType === 'payout' ? options?.batchId ?? null : null,
    gas_limit: null,
    max_fee_per_gas: null,
    max_priority_fee_per_gas: null,
    block_number: null,
    deadline,
    release_after: deadline,
  };
}

/** Simulated settlement has no hashes; one per batch keeps records distinct. */
function SimulatedPayoutHash(expected: PayoutTransactionExpectation): string {
  return `sim_sig_payout:${expected.batchId ?? expected.transactionType}`;
}

function SimulatedPaid(transactionHash: string): BroadcastResult {
  return { transaction_hash: transactionHash, status: 'paid', viewer_url: '' };
}

let activeRail: { key: string; settlement: Settlement } | null = null;

/**
 * The configured rail. One instance is reused per rail until the chain
 * clients are reset, so callers such as ExplorerUrl never rebuild clients.
 */
export function GetSettlement(): Settlement {
  const simulated = IsSimulatedSettlement();
  const key = simulated ? 'simulated' : `onchain:${ChainClientsGeneration()}`;
  if (activeRail?.key !== key) {
    activeRail = {
      key,
      settlement: simulated ? new SimulatedSettlement() : new Ethereum(),
    };
  }
  return activeRail.settlement;
}

/** Explorer link for the active rail; empty on the simulated rail. */
export function ExplorerUrl(type: 'tx' | 'address', value: string): string {
  return GetSettlement().ExplorerUrl(type, value);
}

/**
 * Rail fields of the public config: the chain clients must send on, and the
 * explorer origin for links (empty on the simulated rail and Anvil).
 */
export function PublicRailConfig(): Pick<
  PublicConfig,
  'network' | 'chain_id' | 'explorer_url_base'
> {
  const { network, chain_id } = GetSettlement().Describe();
  return {
    network,
    chain_id,
    explorer_url_base:
      chain_id === null
        ? ''
        : CHAIN_EXPLORERS[chain_id as SupportedChainId] ?? '',
  };
}
