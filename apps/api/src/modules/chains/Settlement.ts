// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Settlement rail selection and the simulated (no-chain) implementation.
 *
 * Test mode defaults to simulated funds. Set SETTLEMENT_RAIL=onchain with
 * LIVEMODE=false to use Solana Devnet (internal escape hatch).
 *
 * @module Settlement
 */

import { GetAppConfig } from '../AppConfig';
import { Solana } from './Solana';
import type {
  BroadcastResult,
  CheckoutPaymentVerification,
  CheckoutSubscribeVerification,
  IncomingDeposit,
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
  GetIncomingDeposits(
    address: string,
    limit: number,
    processed: Set<string>
  ): Promise<IncomingDeposit[]>;
  BuildBatchPayoutTransaction(
    sender: string,
    recipients: TransferRecipient[]
  ): Promise<UnsignedPayoutBatch>;
  BroadcastSignedTransaction(signed: string): Promise<BroadcastResult>;
  BuildCheckoutPaymentTransaction(
    payer: string,
    merchant: string,
    amountCents: number,
    sessionId: string,
    options?: { feeSponsored?: boolean }
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
    options?: { feeSponsored?: boolean }
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
  /** Solana only: first-time subscribers need a separate authority tx. */
  BuildInitSubscriptionAuthorityTransaction?(
    subscriber: string,
    options?: { feeSponsored?: boolean }
  ): Promise<UnsignedTransaction | null>;
  /** Solana only: wait for the authority created by the init tx. */
  WaitForSubscriptionAuthority?(subscriber: string): Promise<void>;
}

const SIM_SIG_PREFIX = 'sim_sig:';

/** Default payer used by simulated checkout and test helpers. */
export const SIMULATED_TEST_WALLET =
  'D8VMZCmmTUUfhejNhNQKAmqvZCKfUq1qU6RqQKxQwXyX';

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
    // Keeps the public blockhash fields valid (broadcast requires a positive
    // height) until the public API drops them.
    solana: {
      blockhash: 'sim_blockhash',
      last_valid_block_height: 1,
      min_context_slot: 0,
    },
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
    return typeof address === 'string' && address.length >= 32;
  }

  async GetNativeBalance(_address: string): Promise<number> {
    return 0;
  }

  async GetUSDCBalance(_address: string): Promise<number> {
    return 0;
  }

  GetPlanOwnerAddress(): string {
    return 'SimulatedPlanOwner111111111111111111111';
  }

  async GetIncomingDeposits(): Promise<IncomingDeposit[]> {
    return [];
  }

  async BuildCheckoutPaymentTransaction(
    _payer: string,
    _merchant: string,
    _amountCents: number,
    _sessionId: string,
    _options?: { feeSponsored?: boolean }
  ): Promise<UnsignedTransaction> {
    return DummyUnsignedTransaction();
  }

  async BuildInitSubscriptionAuthorityTransaction(
    _subscriber: string,
    _options?: { feeSponsored?: boolean }
  ): Promise<UnsignedTransaction | null> {
    return null;
  }

  async BuildSubscribeTransaction(
    _subscriber: string,
    _priceId: string,
    _planId: string,
    _options?: { feeSponsored?: boolean }
  ): Promise<UnsignedTransaction> {
    return DummyUnsignedTransaction();
  }

  async WaitForSubscriptionAuthority(_subscriber: string): Promise<void> {
    return;
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
    recipients: TransferRecipient[]
  ): Promise<UnsignedPayoutBatch> {
    return {
      ...DummyUnsignedTransaction(),
      recipients_count: recipients.length,
      transaction_type: 'payout',
      batch_id: null,
    };
  }

  async BroadcastSignedTransaction(_signed: string): Promise<BroadcastResult> {
    return {
      transaction_hash: 'sim_sig_payout',
      status: 'paid',
      viewer_url: '',
    };
  }
}

export function GetSettlement(): Settlement {
  return IsSimulatedSettlement() ? new SimulatedSettlement() : new Solana();
}

/** Explorer link for the active rail; empty on the simulated rail. */
export function ExplorerUrl(type: 'tx' | 'address', value: string): string {
  return GetSettlement().ExplorerUrl(type, value);
}
