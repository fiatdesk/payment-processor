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
import type { PublicConfig } from '@zoneless/shared-types';
import { GetAppConfig, type SupportedChainId } from '../AppConfig';
import { ChainClientsGeneration } from './Chain';
import { CHAIN_EXPLORERS } from './contracts';
import { Ethereum } from './Ethereum';
import { Now } from '../../utils/Timestamp';
import type {
  BroadcastResult,
  CheckoutPaymentVerification,
  ConfirmedBlock,
  CheckoutSubscribeVerification,
  IncomingDeposit,
  PayoutBuildOptions,
  PayoutTransactionExpectation,
  PayoutTransactionMatch,
  RailDescription,
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
  BuildCheckoutPaymentTransaction(
    payer: string,
    merchant: string,
    amountCents: number,
    sessionId: string,
    options?: { relayed?: boolean }
  ): Promise<UnsignedTransaction>;
  ValidateAndBroadcastCheckoutTransaction(
    signed: string
  ): Promise<{ transaction_hash: string }>;
  VerifyCheckoutPayment(
    transactionHash: string,
    expected: {
      merchantWalletAddress: string;
      amountInCents: number;
      checkoutSessionId: string;
    }
  ): Promise<CheckoutPaymentVerification>;
  GetPlanOwnerAddress(): string;
  CreateSubscriptionPlan(
    priceId: string,
    periodHours: number,
    amountCents: number,
    destination: string,
    puller: string
  ): Promise<string>;
  BuildSubscribeTransaction(
    subscriber: string,
    priceId: string,
    planId: string,
    options?: { relayed?: boolean }
  ): Promise<UnsignedTransaction>;
  FindExistingSubscription(
    planId: string,
    subscriber: string
  ): Promise<string | null>;
  VerifySubscribeTransaction(
    transactionHash: string,
    expected: { planId: string; subscriberWallet: string }
  ): Promise<CheckoutSubscribeVerification>;
  CollectSubscriptionPayment(params: {
    subscriberWallet: string;
    planId: string;
    subscriptionId: string;
    amountCents: number;
    destinationWallet?: string;
  }): Promise<{ transaction_hash: string; alreadyCollected: boolean }>;
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

  async BuildCheckoutPaymentTransaction(
    _payer: string,
    _merchant: string,
    _amountCents: number,
    _sessionId: string,
    _options?: { relayed?: boolean }
  ): Promise<UnsignedTransaction> {
    return DummyUnsignedTransaction();
  }

  async BuildSubscribeTransaction(
    _subscriber: string,
    _priceId: string,
    _planId: string,
    _options?: { relayed?: boolean }
  ): Promise<UnsignedTransaction> {
    return DummyUnsignedTransaction();
  }

  async ValidateAndBroadcastCheckoutTransaction(
    signed: string
  ): Promise<{ transaction_hash: string }> {
    return { transaction_hash: signed || 'sim_sig_broadcast' };
  }

  async FindExistingSubscription(
    _planId: string,
    _subscriber: string
  ): Promise<string | null> {
    return null;
  }

  async VerifySubscribeTransaction(
    _transactionHash: string,
    expected: { planId: string; subscriberWallet: string }
  ): Promise<CheckoutSubscribeVerification> {
    return {
      verified: true,
      subscriber_address: expected.subscriberWallet,
      subscription_onchain_id: `sim_sub_${expected.planId}_${expected.subscriberWallet}`,
    };
  }

  async CollectSubscriptionPayment(params: {
    subscriberWallet: string;
    planId: string;
    subscriptionId: string;
    amountCents: number;
    destinationWallet?: string;
  }): Promise<{ transaction_hash: string; alreadyCollected: boolean }> {
    return {
      transaction_hash: `sim_collect:${params.subscriberWallet}`,
      alreadyCollected: false,
    };
  }

  async VerifyCheckoutPayment(
    transactionHash: string,
    expected: {
      merchantWalletAddress: string;
      amountInCents: number;
      checkoutSessionId: string;
    }
  ): Promise<CheckoutPaymentVerification> {
    const payerAddress = PayerFromSimulatedSignature(transactionHash);
    if (!payerAddress) {
      return {
        verified: false,
        amount_cents: 0,
        payer_address: null,
        failure_reason: 'Invalid simulated payment',
      };
    }
    return {
      verified: true,
      amount_cents: expected.amountInCents,
      payer_address: payerAddress,
    };
  }

  async CreateSubscriptionPlan(
    priceId: string,
    _periodHours: number,
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
