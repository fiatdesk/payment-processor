// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Transaction plumbing shared by the Ethereum rail's flows: sending signed
 * transactions from the API's keys (with the hash handed out before the
 * network sees it), receipts and confirmation depth, revert decoding, and
 * mapping node failures to errors that carry no provider text.
 *
 * @module chains/EthereumTransactions
 */

import {
  BaseError,
  decodeErrorResult,
  ExecutionRevertedError,
  getAddress,
  isAddress,
  isHex,
  keccak256,
  RawContractError,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  type Abi,
  type Address,
  type Hex,
  type Transaction,
  type TransactionReceipt,
} from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import { AppError } from '../../utils/AppError';
import { Logger } from '../../utils/Logger';
import { GetCheckoutRelayerKey } from '../AppConfig';
import { PAYOUT_BATCH_ABI } from './abi/PayoutBatch';
import { GetChainConfig, GetPublicClient } from './Chain';
import type {
  ConfirmedBlock,
  PayoutBuildOptions,
  SignedTransaction,
} from './types';

/** Ethereum's slot time. */
export const BLOCK_TIME_SECONDS = 12;
/** How long a send waits for its receipt, or a wallet's hash to appear. */
export const WAIT_TIMEOUT_MS = 60_000;
/** Sends of one transaction, re-signed when another sender took the nonce. */
const SEND_ATTEMPTS = 3;

export interface Fees {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

export interface RevertDetails {
  /** Custom error or `Error`/`Panic` name, when the revert data decodes */
  errorName: string | null;
  /**
   * The reason decoded from the revert data with our ABIs, or a generic
   * text; safe to show to clients
   */
  message: string;
  /** What the node said, for logs and failure-code mapping only */
  detail: string;
}

export function ToAddress(value: string): Address {
  if (!isAddress(value)) {
    throw new Error(`Invalid Ethereum address: ${value}`);
  }
  return getAddress(value);
}

export function CeilDiv(value: bigint, divisor: bigint): bigint {
  return (value + divisor - 1n) / divisor;
}

export function ErrorText(error: unknown): string {
  if (error instanceof BaseError) {
    return [error.shortMessage, error.details].filter(Boolean).join(': ');
  }
  return error instanceof Error ? error.message : String(error);
}

export function IsExecutionRevert(error: unknown): boolean {
  return (
    error instanceof BaseError &&
    !!error.walk(
      (cause) =>
        cause instanceof ExecutionRevertedError ||
        cause instanceof RawContractError
    )
  );
}

/**
 * The decoded revert: Error(string) reason or an error name from `abi`
 * (PayoutBatch's by default).
 */
export function DecodeRevert(
  error: unknown,
  abi: Abi = PAYOUT_BATCH_ABI
): RevertDetails {
  if (error instanceof BaseError) {
    const cause = error.walk() as { data?: Hex | { data?: Hex } } | null;
    const data =
      typeof cause?.data === 'object' ? cause.data?.data : cause?.data;
    if (data && isHex(data) && data.length > 2) {
      try {
        // viem also decodes the built-in Error(string) and Panic(uint256).
        const decoded = decodeErrorResult({ abi, data }) as {
          errorName: string;
          args?: readonly unknown[];
        };
        return {
          errorName: decoded.errorName,
          message:
            decoded.errorName === 'Error'
              ? String(decoded.args?.[0])
              : decoded.errorName,
          detail: ErrorText(error),
        };
      } catch {
        // Not an error this ABI knows; only the node's text is left.
      }
    }
  }
  return {
    errorName: null,
    message: 'The transaction reverted',
    detail: ErrorText(error),
  };
}

/**
 * 502 for a node that could not answer; nothing was sent. What the node
 * said goes to the log only: provider text never reaches a client.
 */
export function NodeUnavailable(operation: string, error: unknown): AppError {
  Logger.warn('An Ethereum node call failed', {
    operation,
    error: ErrorText(error),
  });
  return new AppError(
    'The payment network is unavailable; try again',
    502,
    'blockchain_error'
  );
}

export async function NodeCall<T>(
  operation: string,
  call: () => Promise<T>
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw NodeUnavailable(operation, error);
  }
}

/** Another transaction from the sender took the nonce this one used. */
export function IsNonceConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /nonce too low|replacement transaction underpriced/i.test(message);
}

export async function CurrentFees(): Promise<Fees> {
  const client = GetPublicClient();
  const [block, priorityFee] = await Promise.all([
    client.getBlock({ blockTag: 'latest' }),
    client.estimateMaxPriorityFeePerGas(),
  ]);
  return {
    maxFeePerGas: 2n * (block.baseFeePerGas ?? 0n) + priorityFee,
    maxPriorityFeePerGas: priorityFee,
  };
}

/**
 * Fees for a replacement at the same nonce: at least 1.125x the replaced
 * transaction's fees (nodes require a bump of 10 %) or the current fees,
 * whichever is higher.
 */
export function ReplacementFees(
  fees: Fees,
  replacing?: PayoutBuildOptions['replacing']
): Fees {
  if (!replacing) return fees;
  const Bump = (current: bigint, previous: string | null) => {
    if (!previous) return current;
    const floor = CeilDiv(BigInt(previous) * 9n, 8n);
    return current > floor ? current : floor;
  };
  const maxPriorityFeePerGas = Bump(
    fees.maxPriorityFeePerGas,
    replacing.maxPriorityFeePerGas
  );
  const maxFeePerGas = Bump(fees.maxFeePerGas, replacing.maxFeePerGas);
  return {
    maxFeePerGas:
      maxFeePerGas > maxPriorityFeePerGas ? maxFeePerGas : maxPriorityFeePerGas,
    maxPriorityFeePerGas,
  };
}

/** Whether the node has the transaction; null when it cannot say. */
export async function IsKnownTransaction(
  hash: string
): Promise<boolean | null> {
  try {
    await GetPublicClient().getTransaction({ hash: hash as Hex });
    return true;
  } catch (error) {
    return error instanceof TransactionNotFoundError ? false : null;
  }
}

/** "Already known", or "nonce too low" because this very hash was mined. */
export async function WasAccepted(error: unknown, hash: Hex): Promise<boolean> {
  const message = error instanceof Error ? error.message : String(error);
  if (/already known|known transaction|already imported/i.test(message)) {
    return true;
  }
  if (!/nonce too low/i.test(message)) return false;
  try {
    await GetPublicClient().getTransactionReceipt({ hash });
    return true;
  } catch {
    return false;
  }
}

/** One lock per sending address, so one key never races itself. */
export function SenderLock(address: Address): string {
  return `sender:${address}`;
}

export interface SendOptions {
  /** Runs with each signed hash (and its nonce) before it is sent; a throw cancels it */
  onSigned(transactionHash: string, signed: SignedTransaction): Promise<void>;
  /** The refusal message clients see */
  refused: string;
  /**
   * When the node gives no answer on whether it holds the transaction,
   * treat it as sent (the hash was recorded) instead of refused
   */
  ambiguousAsSent?: boolean;
  /** Replace the transaction at this nonce (no re-signing on conflicts) */
  replace?: { nonce: number; fees: Fees };
}

/**
 * Signs, hands the hash to `onSigned`, then sends. Accepted when the node
 * takes it, already holds it, or knows the hash after an error; a nonce
 * conflict re-signs at the next pending nonce; anything else throws
 * `refused`. Callers hold the sender's lock.
 */
export async function SendSigned(
  account: PrivateKeyAccount,
  to: Address,
  data: Hex,
  gas: bigint,
  options: SendOptions
): Promise<string> {
  const client = GetPublicClient();
  const { chainId } = GetChainConfig();
  for (let attempt = 1; ; attempt++) {
    const [fees, nonce] = options.replace
      ? [options.replace.fees, options.replace.nonce]
      : await NodeCall('nonce and fees', () =>
          Promise.all([
            CurrentFees(),
            client.getTransactionCount({
              address: account.address,
              blockTag: 'pending',
            }),
          ])
        );
    const serialized = await account.signTransaction({
      type: 'eip1559',
      chainId,
      nonce,
      to,
      data,
      value: 0n,
      gas,
      ...fees,
    });
    const hash = keccak256(serialized);
    await options.onSigned(hash, { nonce });
    try {
      await client.sendRawTransaction({ serializedTransaction: serialized });
      return hash;
    } catch (error) {
      if (await WasAccepted(error, hash)) return hash;
      const known = await IsKnownTransaction(hash);
      if (known === true) return hash;
      if (known === null && options.ambiguousAsSent) {
        Logger.warn('A send gave no clear answer; treating it as sent', {
          transactionHash: hash,
          error: ErrorText(error),
        });
        return hash;
      }
      if (
        !options.replace &&
        attempt < SEND_ATTEMPTS &&
        IsNonceConflict(error)
      ) {
        Logger.warn('The sender nonce was taken; signing again', {
          transactionHash: hash,
          nonce,
          error: ErrorText(error),
        });
        continue;
      }
      Logger.warn('The network refused a transaction', {
        transactionHash: hash,
        error: ErrorText(error),
      });
      throw new AppError(options.refused, 400, 'blockchain_error');
    }
  }
}

export async function GetReceiptOrNull(
  hash: Hex
): Promise<TransactionReceipt | null> {
  try {
    return await GetPublicClient().getTransactionReceipt({ hash });
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return null;
    throw error;
  }
}

/** True when the receipt is ETH_CONFIRMATIONS blocks below the head. */
async function IsConfirmed(receipt: TransactionReceipt): Promise<boolean> {
  const depth = BigInt(GetChainConfig().confirmations);
  const latest = await GetPublicClient().getBlockNumber({ cacheTime: 0 });
  return latest - receipt.blockNumber >= depth;
}

/**
 * Polls until the receipt is ETH_CONFIRMATIONS blocks below the head (at
 * or below the confirmed block); false when `timeoutMs` passes first.
 */
export async function WaitForReceiptDepth(
  hash: Hex,
  timeoutMs: number
): Promise<boolean> {
  const client = GetPublicClient();
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const receipt = await GetReceiptOrNull(hash);
    if (receipt && (await IsConfirmed(receipt))) return true;
    const left = deadline - Date.now();
    if (left <= 0) return false;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(client.pollingInterval, left))
    );
  }
}

/** The latest block's number and time. */
export async function LatestBlock(): Promise<ConfirmedBlock> {
  const block = await GetPublicClient().getBlock({ blockTag: 'latest' });
  return { number: Number(block.number), timestamp: Number(block.timestamp) };
}

/** The block at `latest - ETH_CONFIRMATIONS`. */
export async function ConfirmedBlockNow(): Promise<ConfirmedBlock> {
  const client = GetPublicClient();
  const latest = await client.getBlockNumber({ cacheTime: 0 });
  const depth = BigInt(GetChainConfig().confirmations);
  const block = await client.getBlock({
    blockNumber: latest > depth ? latest - depth : 0n,
  });
  return {
    number: Number(block.number),
    timestamp: Number(block.timestamp),
  };
}

/** Replays a reverted call at its block to read the revert reason. */
export async function RevertReason(
  transaction: Transaction,
  blockNumber: bigint,
  abi: Abi = PAYOUT_BATCH_ABI
): Promise<RevertDetails> {
  try {
    await GetPublicClient().call({
      account: transaction.from,
      to: transaction.to ?? undefined,
      data: transaction.input,
      gas: transaction.gas,
      value: transaction.value,
      blockNumber,
    });
    return {
      errorName: null,
      message: 'The transaction reverted',
      detail: '',
    };
  } catch (error) {
    // Only an execution revert says why; an RPC or transport error says
    // nothing about the transaction, so the caller leaves it unsettled.
    if (!IsExecutionRevert(error)) throw error;
    return DecodeRevert(error, abi);
  }
}

export function RelayerRequired(): AppError {
  return new AppError(
    'On-chain checkout needs CHECKOUT_RELAYER_KEY to relay payments',
    501,
    'not_supported'
  );
}

export function RequireRelayer(): Hex {
  const key = GetCheckoutRelayerKey();
  if (!key) throw RelayerRequired();
  return key;
}
