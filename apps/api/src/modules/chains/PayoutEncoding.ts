// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Pure encoding helpers for payout batches on the PayoutBatch contract: the
 * off-chain batch id, `disperse` calldata, `BatchPaid` receipt matching and
 * revert-reason mapping. No RPC access.
 *
 * @module chains/PayoutEncoding
 */

import {
  encodeFunctionData,
  getAddress,
  keccak256,
  parseEventLogs,
  toBytes,
  type Address,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { PAYOUT_BATCH_ABI } from './abi/PayoutBatch';
import type { TransferRecipient } from './types';

/** USDC has 6 decimals; amounts are cents, so one cent is 10_000 units. */
export function CentsToTokenUnits(amountInCents: number): bigint {
  return BigInt(amountInCents) * 10_000n;
}

/** keccak256 of the sorted payout ids joined by ','; order-independent. */
export function ComputeBatchId(payoutIds: string[]): Hex {
  return keccak256(toBytes([...payoutIds].sort().join(',')));
}

/**
 * Calldata for `PayoutBatch.disperse(token, recipients, amounts, batchId,
 * deadline)`; the call reverts `BatchExpired` after `deadline` (unix seconds).
 */
export function EncodeDisperseCall(
  token: Address,
  recipients: TransferRecipient[],
  batchId: Hex,
  deadline: bigint
): Hex {
  return encodeFunctionData({
    abi: PAYOUT_BATCH_ABI,
    functionName: 'disperse',
    args: [
      token,
      recipients.map((r) => getAddress(r.destinationAddress)),
      recipients.map((r) => CentsToTokenUnits(r.amountInCents)),
      batchId,
      deadline,
    ],
  });
}

/** The receipt's `BatchPaid` log for `batchId` from the PayoutBatch contract. */
export function ParsePayoutReceipt(
  receipt: TransactionReceipt,
  expected: { payoutBatch: Address; batchId: Hex }
): { matched: boolean; count: number; total: bigint } {
  const log = parseEventLogs({
    abi: PAYOUT_BATCH_ABI,
    eventName: 'BatchPaid',
    logs: receipt.logs,
  }).find(
    (candidate) =>
      getAddress(candidate.address) === getAddress(expected.payoutBatch) &&
      candidate.args.batchId.toLowerCase() === expected.batchId.toLowerCase()
  );
  if (!log) return { matched: false, count: 0, total: 0n };
  return {
    matched: true,
    count: Number(log.args.count),
    total: log.args.total,
  };
}

/** FiatToken's blacklist revert means the recipient (or payer) is frozen. */
export function MapRevertToFailureCode(
  message: string
): 'account_frozen' | 'blockchain_error' {
  return /blacklisted/i.test(message) ? 'account_frozen' : 'blockchain_error';
}
