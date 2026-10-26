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
import { GetAppConfig } from '../AppConfig';
import { ChainClientsGeneration } from './Chain';
import { Ethereum } from './Ethereum';
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
