/**
 * Payout failure codes
 * These map to crypto/blockchain-specific failure reasons
 */
export type PayoutFailureCode =
  | 'account_closed'
  | 'account_frozen'
  | 'could_not_process'
  | 'declined'
  | 'insufficient_funds'
  | 'invalid_account_number'
  | 'invalid_currency'
  | 'wallet_not_found'
  | 'sanctioned_address'
  | 'blockchain_error';

/**
 * Payout status values matching Stripe's API
 */
export type PayoutStatus =
  | 'pending'
  | 'processing'
  | 'in_transit'
  | 'paid'
  | 'failed'
  | 'canceled';

/**
 * Payout method - how the payout is sent
 * For crypto, 'instant' is the primary method
 */
export type PayoutMethod = 'standard' | 'instant';

/**
 * Payout destination type
 * Stripe uses 'bank_account' or 'card', we use 'wallet' for crypto
 */
export type PayoutDestinationType = 'wallet';

/**
 * Source type - the balance source the payout draws from
 * Stripe uses 'card', 'bank_account', or 'fpx'
 * We use 'wallet' for crypto balances
 */
export type PayoutSourceType = 'wallet';

export interface Payout {
  /** Unique identifier for the object */
  id: string;

  /** String representing the object's type */
  object: 'payout';

  /** The connected account ID this payout belongs to */
  account: string;

  /** The amount (in cents) that transfers to the external wallet */
  amount: number;

  /** Unix timestamp in seconds when the payout is expected to arrive */
  arrival_date: number;

  /** Returns true if the payout is created by an automated payout schedule */
  automatic: boolean;

  /** ID of the balance transaction that describes the impact of this payout */
  balance_transaction: string | null;

  /** Unix timestamp in seconds when the payout was created */
  created: number;

  /** Three-letter ISO currency code, in lowercase */
  currency: string;

  /** An arbitrary string attached to the object */
  description: string | null;

  /** ID of the external wallet the payout is sent to */
  destination: string;

  /** Error code that provides a reason for a payout failure, if available */
  failure_code?: PayoutFailureCode | null;

  /** Message that provides the reason for a payout failure, if available */
  failure_message?: string | null;

  /** Has the value true if the object exists in live mode or false if in test mode */
  livemode: boolean;

  /** Set of key-value pairs for storing additional information */
  metadata: {
    blockchain_tx?: string;
    network?: string;
    viewer_url?: string;
    gas_fee?: number;
    gas_fee_currency?: string;
    [key: string]: string | number | undefined;
  };

  /** The method used to send this payout: standard or instant */
  method: PayoutMethod;

  /** The source balance this payout came from */
  source_type: PayoutSourceType;

  /** Extra information about a payout that displays on the user's statement */
  statement_descriptor?: string | null;

  /** Current status of the payout */
  status: PayoutStatus;

  /** Can be 'wallet' for crypto payouts (equivalent to Stripe's 'bank_account' or 'card') */
  type: PayoutDestinationType;

  /**
   * The platform account that owns this resource.
   * For connected account resources, this is the platform's account ID.
   * For platform's own resources, this equals the account field (self-referential).
   * @fiatdesk_extension
   */
  platform_account: string;

  /**
   * Payout batch that holds this payout while it is built or broadcast, or
   * paid it. A held payout cannot be canceled or built into another batch.
   * @fiatdesk_extension
   */
  payout_batch?: string | null;
}

export interface PayoutResponse {
  network: string;
  blockchain_tx: string;
  gas_fee: number;
  gas_fee_currency: string;
  viewer_url: string;
  status: 'paid' | 'failed';
  failure_code?: PayoutFailureCode;
  failure_message?: string;
}

/** `payout` moves funds; `approval` is the one-time allowance signed first */
export type PayoutBatchTransactionType = 'payout' | 'approval';

/** Lifecycle of a payout batch transaction */
export type PayoutBatchStatus =
  | 'built'
  | 'broadcast'
  /** Its transaction reverted; payouts stay held until the deadline passes */
  | 'reverted'
  | 'paid'
  | 'failed'
  | 'replaced';

/**
 * Internal record of one built payout batch transaction. At most one batch
 * per wallet is `built` or `broadcast` at a time, which serialises nonces.
 * @fiatdesk_extension
 */
export interface PayoutBatch {
  id: string;
  object: 'payout_batch';
  platform_account: string;
  /** Platform wallet that signs the transaction (EIP-55) */
  wallet_address: string;
  chain_id: number | null;
  /** Sender nonce; the nonce actually used once a wallet broadcast is seen */
  nonce: number | null;
  /** On-chain batch id (`keccak256` of the sorted payout ids); null for approvals */
  batch_id: string | null;
  /** Payout ids paid by this transaction; empty for approvals */
  payouts: string[];
  /** Total of the included payouts in cents */
  total_amount: number;
  transaction_type: PayoutBatchTransactionType;
  status: PayoutBatchStatus;
  /** Latest hash submitted for this batch */
  transaction_hash: string | null;
  /** Every hash submitted for this batch (re-prices and wallet speed-ups) */
  transaction_hashes: string[];
  /** Hashes a client reported that were not visible yet when reported */
  reported_hashes: string[];
  /**
   * On-chain deadline (unix seconds) of every signed copy; the batch can no
   * longer pay once the confirmed chain is past the latest. Empty for approvals.
   */
  deadlines: number[];
  /** How the first broadcast arrived, or null while `built` */
  broadcast_mode: 'signed_transaction' | 'transaction_hash' | null;
  to: string | null;
  unsigned_transaction: string;
  gas_limit: string | null;
  max_fee_per_gas: string | null;
  max_priority_fee_per_gas: string | null;
  /** Block number when the batch was built; reconcile searches logs from here */
  build_block: number | null;
  /** Batch this one superseded, if any */
  replaces: string | null;
  /** Batch that superseded this one, if any */
  replaced_by: string | null;
  livemode: boolean;
  created: number;
  updated: number;
}

/**
 * Response from the build endpoint for batch payouts.
 * Contains an unsigned transaction ready for local signing.
 */
export interface PayoutBatchBuildResponse {
  object: 'payout_batch_build';
  /** Id of the payout batch record this transaction belongs to */
  payout_batch: string;
  /** Id of the batch this build superseded (`replace: true`), or null */
  replaced_payout_batch: string | null;
  /** Serialized unsigned transaction for the active settlement rail */
  unsigned_transaction: string;
  /** Estimated network fee in atomic units of `fee_currency`, as a decimal string */
  estimated_fee: string;
  /** Currency the network fee is paid in (`none` on the simulated rail) */
  fee_currency: string;
  /** Chain id the transaction is built for, or null when the rail has none */
  chain_id: number | null;
  /** Sender nonce the transaction uses, or null when the rail has none */
  nonce: number | null;
  /** Contract or address the transaction calls, or null when the rail has none */
  to: string | null;
  /** Gas limit as a decimal string, or null when the rail has none */
  gas_limit: string | null;
  /** EIP-1559 max fee per gas in wei, or null when the rail has none */
  max_fee_per_gas: string | null;
  /** EIP-1559 priority fee per gas in wei, or null when the rail has none */
  max_priority_fee_per_gas: string | null;
  /**
   * Unix time after which the transaction can no longer pay (it reverts
   * `BatchExpired`). Null for an approval.
   */
  deadline: number | null;
  /**
   * Roughly when the payouts are released if the transaction is never mined:
   * the deadline plus the confirmation depth. Informational; null for an approval.
   */
  release_after: number | null;
  /** `payout` moves funds; `approval` is a one-time allowance to sign first */
  transaction_type: PayoutBatchTransactionType;
  /** Identifier of the on-chain batch, or null for an approval */
  batch_id: string | null;
  /** Array of payout objects included in the transaction (empty for an approval) */
  payouts: Payout[];
  /** Total amount in cents being paid out */
  total_amount: number;
  /** Number of recipients in the transaction */
  recipients_count: number;
}

/**
 * Response from the broadcast endpoint for batch payouts.
 * Contains the result of broadcasting the signed transaction.
 */
export interface PayoutBatchBroadcastResponse {
  object: 'payout_batch_broadcast';
  /** Hash of the broadcast transaction */
  transaction_hash: string;
  /** `pending` means submitted but not yet confirmed; payouts stay `in_transit` */
  status: 'paid' | 'failed' | 'pending';
  /** Whether the transaction paid payouts or granted the payout allowance */
  transaction_type: PayoutBatchTransactionType;
  /** URL to view the transaction on a blockchain explorer */
  viewer_url: string;
  /** Array of updated payout objects (empty for an approval) */
  payouts: Payout[];
  /** Error code if the transaction failed */
  failure_code?: PayoutFailureCode;
  /** Error message if the transaction failed */
  failure_message?: string;
}

/**
 * Result of reconciling a platform's outstanding payout batches.
 * @fiatdesk_extension
 */
export interface ReconcileResponse {
  object: 'payout_reconcile';
  /** Outstanding batches examined */
  reconciled: number;
  /** Batches settled as paid */
  paid: number;
  /** Batches settled as failed or replaced */
  failed: number;
  /** Batches still waiting for confirmations */
  pending: number;
}

/**
 * Result of the SDK's `payouts.ensureAllowance()`: the payout build to sign,
 * after the one-time approval when the platform wallet needed one.
 */
export interface EnsureAllowanceResult {
  /** Payout build to sign and broadcast; null while the approval is unconfirmed or failed */
  build: PayoutBatchBuildResponse | null;
  /** Broadcast result of the approval, or null when none was needed */
  approval: PayoutBatchBroadcastResponse | null;
}

/**
 * Result of the processPending operation.
 */
export interface ProcessPendingResult {
  /** Hash of the broadcast transaction */
  transaction_hash: string;
  /**
   * Status of the operation. `pending` means submitted but not confirmed:
   * call `payouts.reconcile()` later, then process again.
   */
  status: 'paid' | 'failed' | 'pending';
  /** `approval` when the batch stopped at the one-time approval */
  transaction_type: PayoutBatchTransactionType;
  /** URL to view the transaction on a blockchain explorer */
  viewer_url: string;
  /** Array of processed payout objects */
  payouts: Payout[];
  /** Total amount in cents that was paid out */
  total_amount: number;
  /** Whether there are more pending payouts to process (call again if true) */
  has_more: boolean;
  /** Error message if the operation failed */
  failure_message?: string;
}
