// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Chain-neutral settlement types shared by every rail implementation.
 *
 * @module chains/types
 */

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
}

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

/** Result of verifying a checkout payment transaction on-chain */
export interface CheckoutPaymentVerification {
  verified: boolean;
  /** Total USDC (in cents) transferred to the merchant in this transaction */
  amount_cents: number;
  /** The payer's wallet address */
  payer_address: string | null;
  /** Reason verification failed, if it did */
  failure_reason?: string;
}

/** Result of verifying an on-chain subscribe transaction */
export interface CheckoutSubscribeVerification {
  verified: boolean;
  /** Subscriber wallet that signed the subscribe transaction */
  subscriber_address: string | null;
  /** On-chain subscription id created by the subscribe transaction */
  subscription_onchain_id: string | null;
  /** Reason verification failed, if it did */
  failure_reason?: string;
}
