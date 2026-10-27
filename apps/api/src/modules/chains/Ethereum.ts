// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * The on-chain Ethereum rail (mainnet, Sepolia or Anvil): rail description,
 * explorer links, address checks, balance reads, deposit detection from USDC
 * `Transfer` logs, batch payouts through the PayoutBatch contract, hosted
 * checkout through relayed EIP-3009 authorizations, and subscriptions on the
 * Subscriptions contract (plans and charges from SUBSCRIPTION_OPERATOR_KEY,
 * relayed subscribes from CHECKOUT_RELAYER_KEY).
 *
 * @module chains/Ethereum
 */

import {
  BaseError,
  decodeErrorResult,
  ExecutionRevertedError,
  RawContractError,
  encodeFunctionData,
  formatEther,
  formatUnits,
  getAbiItem,
  getAddress,
  isAddress,
  isHex,
  keccak256,
  maxUint256,
  parseTransaction,
  recoverTransactionAddress,
  serializeTransaction,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  WaitForTransactionReceiptTimeoutError,
  zeroAddress,
  type Abi,
  type Address,
  type Block,
  type Hex,
  type Transaction,
  type TransactionReceipt,
  type TransactionSerialized,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import {
  IsTransactionHash,
  SameAddress,
  type CheckoutTransferAuthorization,
} from '@zoneless/shared-types';
import { AppError } from '../../utils/AppError';
import { WithKeyedLock } from '../../utils/KeyedLock';
import { Logger } from '../../utils/Logger';
import {
  GetCheckoutConfirmTimeoutMs,
  GetCheckoutRelayerKey,
  GetPayoutDeadlineSeconds,
  IsCheckoutRelayed,
  RequireSubscriptionOperatorKey,
} from '../AppConfig';
import { PAYOUT_BATCH_ABI } from './abi/PayoutBatch';
import { SUBSCRIPTIONS_ABI } from './abi/Subscriptions';
import { USDC_ABI } from './abi/Usdc';
import {
  GetChainConfig,
  GetPublicClient,
  IsDeploylessMulticall,
} from './Chain';
import {
  BuildTransferAuthorization,
  BuildTransferAuthorizationTypedData,
  SessionNonce,
  SplitSignature,
  VerifyCheckoutReceipt,
  type UsdcDomain,
} from './CheckoutAuthorization';
import {
  CentsToTokenUnits,
  EncodeDisperseCall,
  MapRevertToFailureCode,
  ParsePayoutReceipt,
} from './PayoutEncoding';
import type { Settlement } from './Settlement';
import {
  BuildPermitTypedData,
  BuildSubscribeTypedData,
  BuildSubscriptionsDomain,
  FindSubscribedEvent,
  PermitValue,
  PlanIdFromPriceId,
  PlanKeyFor,
  SubscribeDeadline,
  SubscriptionIdFor,
  type PlanTerms,
} from './SubscriptionAuthorization';
import {
  COLLECTION_FAILED_ALLOWANCE,
  PAUSED_ON_CHAIN,
  type BroadcastResult,
  type CheckoutPaymentExpectation,
  type CheckoutPaymentVerification,
  type CheckoutSubscribeVerification,
  type ConfirmedBlock,
  type IncomingDeposit,
  type OnchainSubscriptionStatus,
  type PayoutBuildOptions,
  type PayoutTransactionExpectation,
  type PayoutTransactionMatch,
  type PreparedAuthorization,
  type PreparedSubscribe,
  type RailDescription,
  type RelayCheckoutOptions,
  type RelaySubscribeOptions,
  type SubscribeRelay,
  type SubscriptionCollectParams,
  type SubscriptionCollection,
  type TransferRecipient,
  type UnsignedPayoutBatch,
} from './types';

const USDC_DECIMALS = 6;
/** Ethereum's slot time; only used for the informational `release_after`. */
const BLOCK_TIME_SECONDS = 12;
/** How long broadcast waits for a receipt, or for a wallet's hash to appear. */
const WAIT_TIMEOUT_MS = 60_000;
const BATCH_PAID_EVENT = getAbiItem({
  abi: PAYOUT_BATCH_ABI,
  name: 'BatchPaid',
});
const TRANSFER_EVENT = getAbiItem({ abi: USDC_ABI, name: 'Transfer' });
const AUTHORIZATION_USED_EVENT = getAbiItem({
  abi: USDC_ABI,
  name: 'AuthorizationUsed',
});
/** Block timestamps kept for deposit lookups (oldest evicted first). */
const BLOCK_TIMESTAMP_CACHE_SIZE = 256;
/** Gas of one USDC `transferWithAuthorization`, for the quoted relay fee. */
const RELAY_GAS_ESTIMATE = 100_000n;
/** Gas of one relayed `subscribeWithPermit`, for the quoted relay fee. */
const SUBSCRIBE_GAS_ESTIMATE = 200_000n;
/** The contract's `Status` enum, by value. */
const SUBSCRIPTION_STATUSES: readonly OnchainSubscriptionStatus[] = [
  'none',
  'active',
  'paused',
  'canceled',
];
/** Sends of one relay, re-signed when another sender took the nonce. */
const RELAY_SEND_ATTEMPTS = 3;
/** Blocks per `getLogs` call when looking for a used authorization. */
const AUTHORIZATION_LOG_CHUNK = 2_000n;
const AUTHORIZATION_LOG_MAX_CHUNKS = 50;
/** Blocks searched before the session's creation, on top of the estimate. */
const AUTHORIZATION_LOG_MARGIN = 256n;

interface Fees {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

/** `plans(planKey)` of the Subscriptions contract. */
interface OnchainPlan {
  owner: Address;
  puller: Address;
  destination: Address;
  terms: PlanTerms;
  active: boolean;
}

/** `subscriptions(subId)` of the Subscriptions contract. */
interface OnchainSubscription {
  planKey: Hex;
  subscriber: Address;
  nextChargeAt: bigint;
  status: OnchainSubscriptionStatus;
}

/** 501 error for a rail capability that does not exist yet. */
export function NotSupported(method: string): AppError {
  return new AppError(
    `${method} is not available on this settlement rail yet`,
    501,
    'not_supported'
  );
}

export class Ethereum implements Settlement {
  private usdcDecimalsVerified = false;
  private usdcDomain: UsdcDomain | null = null;
  private readonly blockTimestamps = new Map<bigint, number>();

  Describe(): RailDescription {
    const { chainId, usdc } = GetChainConfig();
    return {
      rail: 'onchain',
      network: 'ethereum',
      chain_id: chainId,
      native_currency: 'eth',
      token_address: usdc,
    };
  }

  ExplorerUrl(type: 'tx' | 'address', value: string): string {
    const { explorer } = GetChainConfig();
    return explorer ? `${explorer}/${type}/${value}` : '';
  }

  /** Every well-formed address can receive USDC on Ethereum. */
  async CheckWalletExists(address: string): Promise<boolean> {
    return isAddress(address);
  }

  async GetNativeBalance(address: string): Promise<number> {
    const wei = await GetPublicClient().getBalance({
      address: ToAddress(address),
    });
    return Number(formatEther(wei));
  }

  async GetUSDCBalance(address: string): Promise<number> {
    const { usdc } = GetChainConfig();
    await this.VerifyUsdcDecimals(usdc);
    const balance = await GetPublicClient().readContract({
      address: usdc,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [ToAddress(address)],
    });
    return Number(formatUnits(balance, USDC_DECIMALS));
  }

  /** SUBSCRIPTION_OPERATOR_KEY's address: owner and puller of every plan. */
  GetPlanOwnerAddress(): string {
    return RequireOperator().address;
  }

  async GetLatestBlockNumber(): Promise<bigint> {
    return GetPublicClient().getBlockNumber({ cacheTime: 0 });
  }

  /** Unix seconds of a block, cached per block number. */
  async GetBlockTimestamp(blockNumber: bigint): Promise<number> {
    const cached = this.blockTimestamps.get(blockNumber);
    if (cached !== undefined) return cached;
    const block = await GetPublicClient().getBlock({ blockNumber });
    const timestamp = Number(block.timestamp);
    if (this.blockTimestamps.size >= BLOCK_TIMESTAMP_CACHE_SIZE) {
      const [oldest] = this.blockTimestamps.keys();
      this.blockTimestamps.delete(oldest);
    }
    this.blockTimestamps.set(blockNumber, timestamp);
    return timestamp;
  }

  /**
   * `Transfer(from, to = address, value)` logs of USDC in the range, in
   * chain order. Each log is one deposit, so a transaction paying the wallet
   * twice yields two deposits that differ in `logIndex`.
   */
  async GetIncomingDeposits(
    address: string,
    range: { fromBlock: bigint; toBlock: bigint }
  ): Promise<IncomingDeposit[]> {
    const { fromBlock, toBlock } = range;
    if (toBlock < fromBlock) {
      throw new Error(`Block range ${fromBlock}..${toBlock} is empty`);
    }
    const { usdc } = GetChainConfig();
    await this.VerifyUsdcDecimals(usdc);
    const wallet = ToAddress(address);

    const logs = await GetPublicClient().getLogs({
      address: usdc,
      event: TRANSFER_EVENT,
      args: { to: wallet },
      fromBlock,
      toBlock,
      strict: true,
    });
    const deposits: IncomingDeposit[] = [];
    for (const log of logs) {
      if (
        log.removed ||
        log.blockNumber === null ||
        log.transactionHash === null ||
        log.logIndex === null ||
        !SameAddress(log.address, usdc) ||
        !SameAddress(log.args.to, wallet)
      ) {
        continue;
      }
      const { from, value } = log.args;
      deposits.push({
        transactionHash: log.transactionHash.toLowerCase(),
        logIndex: log.logIndex,
        amount: Number(formatUnits(value, USDC_DECIMALS)),
        // Truncated to whole cents; fractions of a cent are not credited.
        amountCents: Number(value / 10_000n),
        senderAddress: getAddress(from),
        timestamp: await this.GetBlockTimestamp(log.blockNumber),
        blockNumber: Number(log.blockNumber),
      });
    }
    return deposits;
  }

  /**
   * `PayoutBatch.disperse` for the recipients, or the one-time approval when
   * the wallet's allowance to PayoutBatch is below the batch total. Refuses
   * a batch the wallet's USDC balance cannot cover.
   */
  async BuildBatchPayoutTransaction(
    sender: string,
    recipients: TransferRecipient[],
    options: PayoutBuildOptions = {}
  ): Promise<UnsignedPayoutBatch> {
    const { batchId } = options;
    if (recipients.length === 0 || !batchId) {
      throw new AppError(
        'A payout batch needs recipients and a batch id',
        400,
        'invalid_request_error'
      );
    }
    const { usdc, payoutBatch } = PayoutContracts();
    const from = ToAddress(sender);
    await this.VerifyUsdcDecimals(usdc);

    const total = recipients.reduce(
      (sum, r) => sum + CentsToTokenUnits(r.amountInCents),
      0n
    );
    const [balance, allowance, alreadyPaid] = await GetPublicClient().multicall(
      {
        contracts: [
          {
            address: usdc,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [from],
          },
          {
            address: usdc,
            abi: USDC_ABI,
            functionName: 'allowance',
            args: [from, payoutBatch],
          },
          {
            address: payoutBatch,
            abi: PAYOUT_BATCH_ABI,
            functionName: 'paid',
            args: [from, batchId as Hex],
          },
        ],
        allowFailure: false,
        deployless: IsDeploylessMulticall(),
      }
    );
    // PayoutBatch pays a batch id once per wallet; the same payouts were
    // already paid on-chain even though they are not settled here yet.
    if (alreadyPaid) {
      throw new AppError(
        `Wallet ${from} already paid batch ${batchId} on-chain; reconcile before building these payouts again`,
        400,
        'payout_batch_already_paid'
      );
    }
    if (balance < total) {
      throw new AppError(
        `Platform wallet ${from} holds ${formatUnits(
          balance,
          USDC_DECIMALS
        )} USDC; this batch needs ${formatUnits(total, USDC_DECIMALS)} USDC`,
        400,
        'insufficient_funds'
      );
    }
    if (allowance < total) {
      return this.BuildApprovalTransaction(sender, options);
    }

    // The deadline follows chain time: PayoutBatch compares block.timestamp.
    const block = await GetPublicClient().getBlock({ blockTag: 'latest' });
    const deadline =
      Number(block.timestamp) +
      (options.deadlineSeconds ?? GetPayoutDeadlineSeconds());
    return this.BuildUnsignedTransaction(
      from,
      payoutBatch,
      EncodeDisperseCall(usdc, recipients, batchId as Hex, BigInt(deadline)),
      options,
      {
        transaction_type: 'payout',
        batch_id: batchId,
        recipients_count: recipients.length,
        deadline,
        release_after:
          deadline + GetChainConfig().confirmations * BLOCK_TIME_SECONDS,
      },
      block
    );
  }

  /** `USDC.approve(PayoutBatch, MaxUint256)`, signed once per wallet. */
  async BuildApprovalTransaction(
    sender: string,
    options: PayoutBuildOptions = {}
  ): Promise<UnsignedPayoutBatch> {
    const { usdc, payoutBatch } = PayoutContracts();
    const data = encodeFunctionData({
      abi: USDC_ABI,
      functionName: 'approve',
      args: [payoutBatch, maxUint256],
    });
    return this.BuildUnsignedTransaction(
      ToAddress(sender),
      usdc,
      data,
      options,
      {
        transaction_type: 'approval',
        batch_id: null,
        recipients_count: 0,
        deadline: null,
        release_after: null,
      }
    );
  }

  GetTransactionHash(signedOrHash: string): string | null {
    if (IsTransactionHash(signedOrHash)) return signedOrHash.toLowerCase();
    if (isHex(signedOrHash) && signedOrHash.length > 66) {
      return keccak256(signedOrHash);
    }
    return null;
  }

  /**
   * A raw transaction must be signed by the wallet and equal the built one
   * (chain id, nonce, `to`, calldata). A hash must belong to a transaction
   * from the wallet with the built `to` and calldata; wallets pick their own
   * nonce, which is returned so the batch can track it.
   */
  async MatchPayoutTransaction(
    signedOrHash: string,
    expected: PayoutTransactionExpectation
  ): Promise<PayoutTransactionMatch> {
    const built = parseTransaction(expected.unsignedTransaction as Hex);

    if (IsTransactionHash(signedOrHash)) {
      const transaction = await this.WaitForTransaction(signedOrHash as Hex);
      if (!transaction) return { status: 'not_found' };
      const reason = DescribeMismatch(expected, built, {
        from: transaction.from,
        chainId: transaction.chainId,
        to: transaction.to,
        data: transaction.input,
      });
      return reason
        ? { status: 'mismatch', reason }
        : {
            status: 'match',
            transactionHash: transaction.hash.toLowerCase(),
            nonce: transaction.nonce,
          };
    }

    const serialized = signedOrHash as TransactionSerialized;
    let signed: ReturnType<typeof parseTransaction>;
    let from: Address;
    try {
      signed = parseTransaction(serialized);
      if (signed.r === undefined || signed.s === undefined) {
        return { status: 'mismatch', reason: 'the transaction is not signed' };
      }
      from = await recoverTransactionAddress({
        serializedTransaction: serialized,
      });
    } catch {
      return {
        status: 'mismatch',
        reason: 'signed_transaction is not a serialized Ethereum transaction',
      };
    }
    const reason = DescribeMismatch(expected, built, {
      from,
      chainId: signed.chainId ?? null,
      to: signed.to,
      data: signed.data,
      nonce: signed.nonce ?? null,
    });
    return reason
      ? { status: 'mismatch', reason }
      : {
          status: 'match',
          transactionHash: keccak256(serialized),
          nonce: signed.nonce ?? null,
        };
  }

  /**
   * Sends a raw signed transaction (a hash was sent by the wallet) and waits
   * for ETH_CONFIRMATIONS. A node that already holds the transaction counts
   * as accepted; any other send error throws.
   */
  async BroadcastSignedTransaction(
    signedOrHash: string,
    expected: PayoutTransactionExpectation
  ): Promise<BroadcastResult> {
    if (IsTransactionHash(signedOrHash)) {
      return this.WaitForReceipt(signedOrHash.toLowerCase(), expected);
    }
    const serialized = signedOrHash as Hex;
    const hash = keccak256(serialized);
    try {
      await GetPublicClient().sendRawTransaction({
        serializedTransaction: serialized,
      });
    } catch (error) {
      if (!(await this.WasAccepted(error, hash))) {
        Logger.warn('The network refused a payout transaction', {
          transactionHash: hash,
          error: ErrorText(error),
        });
        throw new AppError(
          'The network did not accept the transaction',
          400,
          'blockchain_error'
        );
      }
    }
    return this.WaitForReceipt(hash, expected);
  }

  /** Waits up to 60 s for confirmations; `pending` when there is no answer. */
  async WaitForReceipt(
    transactionHash: string,
    expected: PayoutTransactionExpectation
  ): Promise<BroadcastResult> {
    try {
      const receipt = await GetPublicClient().waitForTransactionReceipt({
        hash: transactionHash as Hex,
        confirmations: GetChainConfig().confirmations,
        timeout: WAIT_TIMEOUT_MS,
      });
      return await this.SettleReceipt(receipt, expected);
    } catch (error) {
      if (!(error instanceof WaitForTransactionReceiptTimeoutError)) {
        Logger.warn('Waiting for a payout receipt failed; leaving it pending', {
          transactionHash,
          error: ErrorText(error),
        });
      }
      return this.Pending(transactionHash);
    }
  }

  /** The block at `latest - ETH_CONFIRMATIONS`, read once per reconcile. */
  async GetConfirmedBlock(): Promise<ConfirmedBlock> {
    const latest = await this.GetLatestBlockNumber();
    const depth = BigInt(GetChainConfig().confirmations);
    const block = await GetPublicClient().getBlock({
      blockNumber: latest > depth ? latest - depth : 0n,
    });
    return {
      number: Number(block.number),
      timestamp: Number(block.timestamp),
    };
  }

  /** A signed batch can be mined until its on-chain deadline. */
  WaitsForExpiry(): boolean {
    return true;
  }

  async GetTransactionStatus(
    transactionHash: string,
    expected: PayoutTransactionExpectation,
    confirmedBlock: number
  ): Promise<BroadcastResult> {
    let receipt: TransactionReceipt;
    try {
      receipt = await GetPublicClient().getTransactionReceipt({
        hash: transactionHash as Hex,
      });
    } catch (error) {
      if (error instanceof TransactionReceiptNotFoundError) {
        return this.Pending(transactionHash);
      }
      throw error;
    }
    if (receipt.blockNumber > BigInt(confirmedBlock)) {
      return this.Pending(transactionHash);
    }
    return this.SettleReceipt(receipt, expected, confirmedBlock);
  }

  /**
   * `PayoutBatch.paid(wallet, batchId)` at `blockNumber`: the on-chain verdict
   * on whether the batch was paid. Errors propagate.
   */
  async IsBatchPaid(
    expected: PayoutTransactionExpectation,
    blockNumber: number
  ): Promise<boolean> {
    if (expected.transactionType !== 'payout' || !expected.batchId) {
      return false;
    }
    const { payoutBatch } = PayoutContracts();
    return GetPublicClient().readContract({
      address: payoutBatch,
      abi: PAYOUT_BATCH_ABI,
      functionName: 'paid',
      args: [ToAddress(expected.wallet), expected.batchId as Hex],
      blockNumber: BigInt(blockNumber),
    });
  }

  /**
   * The transaction that paid the batch: a `BatchPaid(payer = wallet,
   * token = USDC, batchId)` log from PayoutBatch with the batch's count and
   * total, between the build block and `toBlock`. Throws when that range is
   * empty or the node cannot serve it, so callers leave the batch alone.
   */
  async FindBatchPayment(
    expected: PayoutTransactionExpectation,
    toBlock: number
  ): Promise<BroadcastResult | null> {
    if (expected.transactionType !== 'payout' || !expected.batchId) {
      return null;
    }
    const { usdc, payoutBatch } = PayoutContracts();
    const fromBlock = BigInt(expected.fromBlock ?? 0);
    if (BigInt(toBlock) < fromBlock) {
      throw new Error(
        `Block ${toBlock} is before the batch was built (block ${fromBlock})`
      );
    }

    const logs = await GetPublicClient().getLogs({
      address: payoutBatch,
      event: BATCH_PAID_EVENT,
      args: {
        payer: ToAddress(expected.wallet),
        token: usdc,
        batchId: expected.batchId as Hex,
      },
      fromBlock,
      toBlock: BigInt(toBlock),
    });
    const total = CentsToTokenUnits(expected.totalCents);
    const log = logs.find(
      (candidate) =>
        SameAddress(candidate.address, payoutBatch) &&
        candidate.args.count === BigInt(expected.recipientsCount) &&
        candidate.args.total === total
    );
    if (!log?.transactionHash) return null;
    return {
      transaction_hash: log.transactionHash.toLowerCase(),
      status: 'paid',
      viewer_url: this.ExplorerUrl('tx', log.transactionHash),
    };
  }

  async GetAccountNonce(address: string, blockNumber: number): Promise<number> {
    return GetPublicClient().getTransactionCount({
      address: ToAddress(address),
      blockNumber: BigInt(blockNumber),
    });
  }

  async IsBlacklisted(addresses: string[]): Promise<string[]> {
    if (addresses.length === 0) return [];
    const { usdc } = GetChainConfig();
    const accounts = addresses.map(ToAddress);
    const results = await GetPublicClient().multicall({
      contracts: accounts.map((account) => ({
        address: usdc,
        abi: USDC_ABI,
        functionName: 'isBlacklisted' as const,
        args: [account] as const,
      })),
      allowFailure: false,
      deployless: IsDeploylessMulticall(),
    });
    return accounts.filter((_, i) => results[i]);
  }

  /** The USDC EIP-712 domain; the token's `name()` is read once. */
  async GetUsdcDomain(): Promise<UsdcDomain> {
    if (!this.usdcDomain) {
      const { chainId, usdc } = GetChainConfig();
      const name = await GetPublicClient().readContract({
        address: usdc,
        abi: USDC_ABI,
        functionName: 'name',
      });
      this.usdcDomain = {
        name,
        version: '2',
        chainId,
        verifyingContract: usdc,
      };
    }
    return this.usdcDomain;
  }

  /**
   * The `TransferWithAuthorization` the payer signs. The relayer pays the
   * gas; `estimated_fee` is an upper bound of what the relay costs.
   */
  async BuildCheckoutPaymentAuthorization(
    payer: string,
    merchant: string,
    amountCents: number,
    sessionId: string,
    expiresAt: number
  ): Promise<PreparedAuthorization> {
    if (!IsCheckoutRelayed()) throw RelayerRequired();
    const { chainId, usdc } = GetChainConfig();
    await this.VerifyUsdcDecimals(usdc);
    const authorization = BuildTransferAuthorization({
      payer,
      merchant,
      amountCents,
      sessionId,
      expiresAt,
    });
    const [domain, fees] = await Promise.all([
      this.GetUsdcDomain(),
      this.CurrentFees(),
    ]);
    return {
      method: 'eip3009_transfer',
      typed_data: BuildTransferAuthorizationTypedData(domain, authorization),
      authorization,
      estimated_fee: (RELAY_GAS_ESTIMATE * fees.maxFeePerGas).toString(),
      fee_currency: 'eth',
      chain_id: chainId,
    };
  }

  /**
   * `USDC.transferWithAuthorization` from CHECKOUT_RELAYER_KEY. Nothing is
   * sent when the payer's authorization is already used, when the recorded
   * relay is still known to the node, or when any wallet already paid the
   * merchant under the session's nonce (for example a relay that was reported
   * refused but landed). Otherwise the call is simulated first, so an
   * invalid, expired or unfunded authorization fails before anything is
   * signed. Sends for one relayer are serialised in this process and read
   * the `pending` nonce; a nonce taken by another process is re-signed (each
   * new hash goes through `onSigned` again).
   */
  async RelayCheckoutAuthorization(
    authorization: CheckoutTransferAuthorization,
    signature: string,
    options: RelayCheckoutOptions
  ): Promise<string | null> {
    const relayer = privateKeyToAccount(RequireRelayer());
    const { v, r, s } = SplitSignature(signature);
    const { usdc } = GetChainConfig();
    const from = ToAddress(authorization.from);
    const nonce = AuthorizationNonce(authorization.nonce);
    const data = encodeFunctionData({
      abi: USDC_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        from,
        ToAddress(authorization.to),
        BigInt(authorization.value),
        BigInt(authorization.valid_after),
        BigInt(authorization.valid_before),
        nonce,
        v,
        r,
        s,
      ],
    });

    const used = await NodeCall('authorizationState', () =>
      GetPublicClient().readContract({
        address: usdc,
        abi: USDC_ABI,
        functionName: 'authorizationState',
        args: [from, nonce],
      })
    );
    if (options.pendingHash) {
      if (used) return options.pendingHash;
      if ((await this.IsKnownTransaction(options.pendingHash)) !== false) {
        return options.pendingHash;
      }
    }

    const paid = {
      usdc,
      merchant: authorization.to,
      amountCents: Number(BigInt(authorization.value) / 10_000n),
      nonce,
    };
    const earlier = await NodeCall('authorization log search', async () =>
      this.FindAuthorizationUse(
        { nonce },
        { createdAt: options.createdAt, head: await this.GetLatestBlock() },
        (hash) => this.PaysMerchant(hash, paid)
      )
    );
    // A used authorization that paid nobody here is left to verification.
    if (earlier || used) return earlier;

    const gas = await this.EstimateRelayGas(relayer.address, usdc, data);
    return WithKeyedLock(SenderLock(relayer.address), () =>
      this.SendRelay(relayer, usdc, data, gas, options.onSigned)
    );
  }

  /**
   * Waits up to `timeoutMs` until the transaction is ETH_CONFIRMATIONS deep,
   * then reads everything at that confirmed block. A transaction that does
   * not pay the session is final unless the session's authorization was
   * used: then the transaction that used it (found by its `AuthorizationUsed`
   * log) decides. An RPC error leaves the result `pending`.
   */
  async VerifyCheckoutPayment(
    transactionHash: string | null,
    expected: CheckoutPaymentExpectation,
    options: { timeoutMs?: number } = {}
  ): Promise<CheckoutPaymentVerification> {
    if (transactionHash !== null && !IsTransactionHash(transactionHash)) {
      throw new AppError(
        'transaction_hash must be 0x followed by 64 hex characters',
        400,
        'invalid_request_error'
      );
    }
    const hash = transactionHash
      ? (transactionHash.toLowerCase() as Hex)
      : null;
    const { usdc } = GetChainConfig();
    const payer = ToAddress(expected.payerAddress);
    const nonce = SessionNonce(expected.checkoutSessionId);
    const receiptExpectation = {
      usdc,
      merchant: expected.merchantWalletAddress,
      amountCents: expected.amountInCents,
      nonce,
    };
    const client = GetPublicClient();
    const AuthorizationUsed = (blockNumber?: bigint) =>
      client.readContract({
        address: usdc,
        abi: USDC_ABI,
        functionName: 'authorizationState',
        args: [payer, nonce],
        blockNumber,
      });

    try {
      // A transaction the node has never seen will not confirm by waiting.
      const known = hash === null ? null : await this.IsKnownTransaction(hash);
      if (hash && known === false && !(await AuthorizationUsed())) {
        return { ...CheckoutPending(hash), status: 'not_found' };
      }
      const mined =
        hash !== null &&
        known !== false &&
        (await this.WaitForCheckoutReceipt(
          hash,
          options.timeoutMs ?? GetCheckoutConfirmTimeoutMs()
        ));
      const confirmed = await this.GetConfirmedBlock();
      let checked: CheckoutPaymentVerification | null = null;
      if (hash && mined) {
        const receipt = await this.GetReceiptOrNull(hash);
        if (receipt && receipt.blockNumber > BigInt(confirmed.number)) {
          return CheckoutPending(hash);
        }
        if (receipt) {
          checked = {
            ...VerifyCheckoutReceipt(receipt, receiptExpectation),
            transaction_hash: hash,
          };
          if (checked.status === 'verified') return checked;
        }
      }

      const used = await AuthorizationUsed(BigInt(confirmed.number));
      if (!used) return checked ?? CheckoutPending(hash);

      const usedBy = await this.FindAuthorizationUse(
        { nonce, authorizer: payer },
        { createdAt: expected.createdAt, head: confirmed }
      );
      if (!usedBy) {
        Logger.warn(
          'A checkout authorization is used but its log was not found',
          {
            checkoutSessionId: expected.checkoutSessionId,
            payer,
          }
        );
        return CheckoutPending(hash);
      }
      if (usedBy === hash && checked) return checked;
      const receipt = await client.getTransactionReceipt({ hash: usedBy });
      return {
        ...VerifyCheckoutReceipt(receipt, receiptExpectation),
        transaction_hash: usedBy,
      };
    } catch (error) {
      // Only a node or transport error means "try again later"; anything
      // else is a defect and must not pass as a payment still confirming.
      if (!(error instanceof BaseError)) {
        Logger.error('Checkout payment verification failed', error, {
          checkoutSessionId: expected.checkoutSessionId,
          transactionHash: hash,
        });
        throw error;
      }
      Logger.warn('Checkout payment verification could not read the chain', {
        checkoutSessionId: expected.checkoutSessionId,
        transactionHash: hash,
        error: ErrorText(error),
      });
      return CheckoutPending(hash);
    }
  }

  /**
   * `createPlan` from SUBSCRIPTION_OPERATOR_KEY, which owns the plan and is
   * the plan's puller here. The plan id is keccak256 of the price id, so a
   * plan already on-chain with the same terms (a retry) is returned as it
   * is; one with other terms is refused.
   */
  async CreateSubscriptionPlan(
    priceId: string,
    periodSeconds: number,
    amountCents: number,
    destination: string,
    puller: string
  ): Promise<string> {
    const operator = RequireOperator();
    const { usdc } = GetChainConfig();
    const subscriptions = SubscriptionsAddress();
    if (!Number.isInteger(periodSeconds) || periodSeconds <= 0) {
      throw new AppError(
        'A subscription period must be a positive whole number of seconds',
        400,
        'invalid_request_error'
      );
    }
    await NodeCall('USDC decimals', () => this.VerifyUsdcDecimals(usdc));
    const planId = PlanIdFromPriceId(priceId);
    const planKey = PlanKeyFor(operator.address, planId);
    const terms: PlanTerms = {
      token: usdc,
      amount: PositiveTokenUnits(amountCents),
      periodSeconds: BigInt(periodSeconds),
    };

    const existing = await NodeCall('plan read', () => this.ReadPlan(planKey));
    if (existing) {
      if (!SameTerms(existing.terms, terms)) {
        throw new AppError(
          `On-chain plan ${planKey} for price ${priceId} has other terms`,
          409,
          'invalid_request_error'
        );
      }
      return planKey;
    }

    const data = encodeFunctionData({
      abi: SUBSCRIPTIONS_ABI,
      functionName: 'createPlan',
      args: [
        planId,
        usdc,
        terms.amount,
        terms.periodSeconds,
        ToAddress(destination),
        ToAddress(puller),
      ],
    });
    const simulated = await this.SimulateSubscriptionsCall(
      operator.address,
      data
    );
    if ('revert' in simulated) {
      throw SubscriptionsCallRefused('plan', simulated.revert);
    }
    const { hash, receipt } = await this.SendAndConfirm(
      operator,
      subscriptions,
      data,
      simulated.gas,
      'subscription plan'
    );
    if (receipt.status !== 'success') {
      throw SubscriptionsCallRefused(
        'plan',
        await this.ReplayRevert(hash, receipt.blockNumber)
      );
    }
    Logger.info('Created an on-chain subscription plan', {
      priceId,
      planKey,
      transactionHash: hash,
    });
    return planKey;
  }

  /**
   * The `Subscribe` to sign (the subscriber's nonce is read just before it
   * is built) and, when the subscriber's USDC allowance to the
   * Subscriptions contract is below the bounded permit value, the USDC
   * permit for that value. Both are valid for 30 minutes of chain time and
   * never after `expiresAt`. The relayer pays the gas.
   */
  async BuildSubscribeAuthorization(
    subscriber: string,
    planKey: string,
    expiresAt: number
  ): Promise<PreparedSubscribe> {
    if (!IsCheckoutRelayed()) throw RelayerRequired();
    const { chainId, usdc } = GetChainConfig();
    const subscriptions = SubscriptionsAddress();
    const owner = ToAddress(subscriber);
    const key = Bytes32(planKey, 'subscription_plan_id');
    await NodeCall('USDC decimals', () => this.VerifyUsdcDecimals(usdc));

    const client = GetPublicClient();
    const [plan, block, allowance, permitNonce, subscribeNonce] =
      await NodeCall('subscribe reads', () =>
        Promise.all([
          this.ReadPlan(key),
          client.getBlock({ blockTag: 'latest' }),
          client.readContract({
            address: usdc,
            abi: USDC_ABI,
            functionName: 'allowance',
            args: [owner, subscriptions],
          }),
          client.readContract({
            address: usdc,
            abi: USDC_ABI,
            functionName: 'nonces',
            args: [owner],
          }),
          client.readContract({
            address: subscriptions,
            abi: SUBSCRIPTIONS_ABI,
            functionName: 'nonces',
            args: [owner],
          }),
        ])
      );
    const terms = OpenPlanTerms(plan, usdc);
    const deadline = SubscribeDeadline(expiresAt, Number(block.timestamp));
    const permitValue = PermitValue(terms);
    const needsPermit = allowance < permitValue;
    const [usdcDomain, fees] = await NodeCall('USDC domain and fees', () =>
      Promise.all([this.GetUsdcDomain(), this.CurrentFees()])
    );
    return {
      needs_permit: needsPermit,
      permit_typed_data: needsPermit
        ? BuildPermitTypedData(usdcDomain, {
            owner,
            spender: subscriptions,
            value: permitValue,
            nonce: permitNonce,
            deadline,
          })
        : null,
      subscribe_typed_data: BuildSubscribeTypedData(
        BuildSubscriptionsDomain(chainId, subscriptions),
        {
          planKey: key,
          subscriber: owner,
          terms,
          nonce: subscribeNonce,
          deadline,
        }
      ),
      deadline,
      estimated_fee: (SUBSCRIBE_GAS_ESTIMATE * fees.maxFeePerGas).toString(),
      fee_currency: 'eth',
      chain_id: chainId,
    };
  }

  /**
   * `subscribeWithPermit` (with a permit signature) or
   * `subscribeWithAuthorization` from CHECKOUT_RELAYER_KEY, with the plan's
   * terms read from the chain. Nothing is sent when the subscriber is
   * already subscribed or the recorded relay is still known to the node.
   * The call is simulated first: a stale or expired signature is a 409
   * `subscription_authorization_stale` (prepare again and sign the new
   * request); other reverts are a 400. Sends share the relayer's lock and
   * nonce handling with checkout relays.
   */
  async RelaySubscribe(
    relay: SubscribeRelay,
    options: RelaySubscribeOptions
  ): Promise<string | null> {
    const relayer = privateKeyToAccount(RequireRelayer());
    const { usdc } = GetChainConfig();
    const subscriptions = SubscriptionsAddress();
    const subscriber = ToAddress(relay.subscriber);
    const planKey = Bytes32(relay.planKey, 'subscription_plan_id');
    const signature = SignatureBytes(relay.subscribeSignature);
    const permit = relay.permitSignature
      ? SplitSignature(relay.permitSignature)
      : null;
    const subId = SubscriptionIdFor(planKey, subscriber);

    const client = GetPublicClient();
    const [plan, subscription, allowance] = await NodeCall(
      'subscribe relay reads',
      () =>
        Promise.all([
          this.ReadPlan(planKey),
          this.ReadSubscription(subId),
          client.readContract({
            address: usdc,
            abi: USDC_ABI,
            functionName: 'allowance',
            args: [subscriber, subscriptions],
          }),
        ])
    );
    const subscribed = IsSubscribed(subscription);
    if (options.pendingHash) {
      if (subscribed) return options.pendingHash;
      if ((await this.IsKnownTransaction(options.pendingHash)) !== false) {
        return options.pendingHash;
      }
    }
    if (subscribed) return null;

    const terms = OpenPlanTerms(plan, usdc);
    if (!permit && allowance < terms.amount) {
      throw new AppError(
        "permit_signature is required: the wallet's USDC allowance does not cover the first payment",
        400,
        'invalid_request_error'
      );
    }
    const deadline = BigInt(relay.deadline);
    const data = permit
      ? encodeFunctionData({
          abi: SUBSCRIPTIONS_ABI,
          functionName: 'subscribeWithPermit',
          args: [
            planKey,
            subscriber,
            terms,
            PermitValue(terms),
            deadline,
            permit.v,
            permit.r,
            permit.s,
            deadline,
            signature,
          ],
        })
      : encodeFunctionData({
          abi: SUBSCRIPTIONS_ABI,
          functionName: 'subscribeWithAuthorization',
          args: [planKey, subscriber, terms, deadline, signature],
        });

    const simulated = await this.SimulateSubscriptionsCall(
      relayer.address,
      data
    );
    if ('revert' in simulated) {
      // Someone else submitted it first; verification finds the result.
      if (simulated.revert.errorName === 'AlreadySubscribed') return null;
      throw SubscribeRefused(simulated.revert, !!permit);
    }
    return WithKeyedLock(SenderLock(relayer.address), () =>
      this.SendRelay(
        relayer,
        subscriptions,
        data,
        simulated.gas,
        options.onSigned,
        'The network did not accept the subscription'
      )
    );
  }

  async FindExistingSubscription(
    planKey: string,
    subscriber: string
  ): Promise<string | null> {
    const subId = SubscriptionIdFor(
      Bytes32(planKey, 'subscription_plan_id'),
      ToAddress(subscriber)
    );
    const subscription = await NodeCall('subscription read', () =>
      this.ReadSubscription(subId)
    );
    return IsSubscribed(subscription) ? subId : null;
  }

  /**
   * Waits up to `timeoutMs` until the transaction is ETH_CONFIRMATIONS deep,
   * then reads at that confirmed block. Verified when the receipt has the
   * `Subscribed` log, or when the subscription exists anyway (another
   * transaction, such as a copy of the relay, subscribed first). An RPC
   * error leaves the result `pending`.
   */
  async VerifySubscribeTransaction(
    transactionHash: string | null,
    expected: { planKey: string; subscriberWallet: string },
    options: { timeoutMs?: number } = {}
  ): Promise<CheckoutSubscribeVerification> {
    if (transactionHash !== null && !IsTransactionHash(transactionHash)) {
      throw new AppError(
        'transaction_hash must be 0x followed by 64 hex characters',
        400,
        'invalid_request_error'
      );
    }
    const hash = transactionHash
      ? (transactionHash.toLowerCase() as Hex)
      : null;
    const subscriptions = SubscriptionsAddress();
    const subscriber = ToAddress(expected.subscriberWallet);
    const planKey = Bytes32(expected.planKey, 'subscription_plan_id');
    const subId = SubscriptionIdFor(planKey, subscriber);
    const Result = (
      status: CheckoutSubscribeVerification['status'],
      transaction: string | null,
      failureReason?: string
    ): CheckoutSubscribeVerification => ({
      status,
      transaction_hash: transaction,
      subscriber_address: status === 'verified' ? subscriber : null,
      subscription_onchain_id: status === 'verified' ? subId : null,
      ...(failureReason ? { failure_reason: failureReason } : {}),
    });
    const Exists = async (blockNumber?: bigint) =>
      IsSubscribed(await this.ReadSubscription(subId, blockNumber));

    try {
      // A transaction the node has never seen will not confirm by waiting.
      const known = hash === null ? null : await this.IsKnownTransaction(hash);
      if (hash && known === false && !(await Exists())) {
        return Result('not_found', hash);
      }
      const mined =
        hash !== null &&
        known !== false &&
        (await this.WaitForCheckoutReceipt(
          hash,
          options.timeoutMs ?? GetCheckoutConfirmTimeoutMs()
        ));
      const confirmed = await this.GetConfirmedBlock();
      const receipt = hash && mined ? await this.GetReceiptOrNull(hash) : null;
      if (receipt && receipt.blockNumber > BigInt(confirmed.number)) {
        return Result('pending', hash);
      }
      if (
        receipt &&
        FindSubscribedEvent(receipt, { subscriptions, planKey, subscriber }) ===
          subId
      ) {
        return Result('verified', hash);
      }
      if (await Exists(BigInt(confirmed.number))) {
        return Result('verified', null);
      }
      return receipt
        ? Result(
            'failed',
            hash,
            'The subscribe transaction did not create the subscription'
          )
        : Result('pending', hash);
    } catch (error) {
      // Only a node or transport error means "try again later".
      if (!(error instanceof BaseError)) {
        Logger.error('Subscribe verification failed', error, {
          transactionHash: hash,
        });
        throw error;
      }
      Logger.warn('Subscribe verification could not read the chain', {
        transactionHash: hash,
        error: ErrorText(error),
      });
      return Result('pending', hash);
    }
  }

  /**
   * `charge(subId, amount)` from SUBSCRIPTION_OPERATOR_KEY, after reading
   * the subscription's on-chain status (the chain decides whether it is
   * paused). `NotDueYet` means this period was already collected; a
   * `NotActive` revert means it was paused meanwhile. A transfer the token
   * refuses is `collection_failed_allowance` when the allowance to the
   * Subscriptions contract is below the amount.
   */
  async CollectSubscriptionPayment(
    params: SubscriptionCollectParams
  ): Promise<SubscriptionCollection> {
    const operator = RequireOperator();
    const { usdc } = GetChainConfig();
    const subscriptions = SubscriptionsAddress();
    await NodeCall('USDC decimals', () => this.VerifyUsdcDecimals(usdc));
    const subId = Bytes32(
      params.subscriptionOnchainId,
      'subscription_onchain_id'
    );
    const amount = PositiveTokenUnits(params.amountCents);

    const subscription = await NodeCall('subscription read', () =>
      this.ReadSubscription(subId)
    );
    if (subscription.status === 'paused') throw PausedOnChain();
    if (subscription.status !== 'active') {
      throw new AppError(
        subscription.status === 'canceled'
          ? 'The subscriber canceled this subscription on-chain'
          : 'This subscription does not exist on-chain',
        400,
        'invalid_request_error'
      );
    }
    if (subscription.planKey.toLowerCase() !== params.planKey.toLowerCase()) {
      throw new Error(
        `On-chain subscription ${subId} belongs to plan ${subscription.planKey}, not ${params.planKey}`
      );
    }

    const data = encodeFunctionData({
      abi: SUBSCRIPTIONS_ABI,
      functionName: 'charge',
      args: [subId, amount],
    });
    const simulated = await this.SimulateSubscriptionsCall(
      operator.address,
      data
    );
    if ('revert' in simulated) {
      return this.ChargeRefused(simulated.revert, subscription, amount);
    }
    const { hash, receipt } = await this.SendAndConfirm(
      operator,
      subscriptions,
      data,
      simulated.gas,
      'subscription payment'
    );
    if (receipt.status !== 'success') {
      return this.ChargeRefused(
        await this.ReplayRevert(hash, receipt.blockNumber),
        subscription,
        amount
      );
    }
    return { transaction_hash: hash, alreadyCollected: false };
  }

  async GetSubscriptionStatus(
    subscriptionOnchainId: string
  ): Promise<OnchainSubscriptionStatus> {
    const subId = Bytes32(subscriptionOnchainId, 'subscription_onchain_id');
    const subscription = await NodeCall('subscription read', () =>
      this.ReadSubscription(subId)
    );
    return subscription.status;
  }

  /** `cancel(subId)` from SUBSCRIPTION_OPERATOR_KEY, the plan owner. */
  async CancelSubscription(
    subscriptionOnchainId: string
  ): Promise<string | null> {
    const operator = RequireOperator();
    const subscriptions = SubscriptionsAddress();
    const subId = Bytes32(subscriptionOnchainId, 'subscription_onchain_id');
    const subscription = await NodeCall('subscription read', () =>
      this.ReadSubscription(subId)
    );
    if (!IsSubscribed(subscription)) return null;

    const data = encodeFunctionData({
      abi: SUBSCRIPTIONS_ABI,
      functionName: 'cancel',
      args: [subId],
    });
    const simulated = await this.SimulateSubscriptionsCall(
      operator.address,
      data
    );
    if ('revert' in simulated) {
      throw SubscriptionsCallRefused('cancel', simulated.revert);
    }
    const { hash, receipt } = await this.SendAndConfirm(
      operator,
      subscriptions,
      data,
      simulated.gas,
      'subscription cancel'
    );
    if (receipt.status !== 'success') {
      throw SubscriptionsCallRefused(
        'cancel',
        await this.ReplayRevert(hash, receipt.blockNumber)
      );
    }
    return hash;
  }

  private async ReadPlan(planKey: Hex): Promise<OnchainPlan | null> {
    const [owner, puller, destination, token, amount, periodSeconds, active] =
      await GetPublicClient().readContract({
        address: SubscriptionsAddress(),
        abi: SUBSCRIPTIONS_ABI,
        functionName: 'plans',
        args: [planKey],
      });
    if (owner === zeroAddress) return null;
    return {
      owner,
      puller,
      destination,
      terms: { token, amount, periodSeconds },
      active,
    };
  }

  private async ReadSubscription(
    subId: Hex,
    blockNumber?: bigint
  ): Promise<OnchainSubscription> {
    const [planKey, subscriber, nextChargeAt, status] =
      await GetPublicClient().readContract({
        address: SubscriptionsAddress(),
        abi: SUBSCRIPTIONS_ABI,
        functionName: 'subscriptions',
        args: [subId],
        blockNumber,
      });
    return {
      planKey,
      subscriber,
      nextChargeAt,
      status: SUBSCRIPTION_STATUSES[status] ?? 'none',
    };
  }

  /**
   * Estimates a Subscriptions call: the gas (with a 20 % margin), or the
   * decoded revert. Any other failure is a 502 with the node's text logged.
   */
  private async SimulateSubscriptionsCall(
    from: Address,
    data: Hex
  ): Promise<{ gas: bigint } | { revert: RevertDetails }> {
    try {
      const estimate = await GetPublicClient().estimateGas({
        account: from,
        to: SubscriptionsAddress(),
        data,
      });
      return { gas: CeilDiv(estimate * 6n, 5n) };
    } catch (error) {
      if (!IsExecutionRevert(error)) {
        throw NodeUnavailable('estimateGas', error);
      }
      return { revert: DecodeRevert(error, SUBSCRIPTIONS_ABI) };
    }
  }

  /**
   * Signs and sends from `account` under its lock, then waits up to 60 s
   * for ETH_CONFIRMATIONS. A transaction still unconfirmed is a 502.
   */
  private async SendAndConfirm(
    account: PrivateKeyAccount,
    to: Address,
    data: Hex,
    gas: bigint,
    label: string
  ): Promise<{ hash: Hex; receipt: TransactionReceipt }> {
    const hash = (await WithKeyedLock(SenderLock(account.address), () =>
      this.SendRelay(
        account,
        to,
        data,
        gas,
        async () => undefined,
        `The network did not accept the ${label}`
      )
    )) as Hex;
    try {
      const receipt = await GetPublicClient().waitForTransactionReceipt({
        hash,
        confirmations: GetChainConfig().confirmations,
        timeout: WAIT_TIMEOUT_MS,
      });
      return { hash, receipt };
    } catch (error) {
      Logger.warn('A sent transaction did not confirm in time', {
        label,
        transactionHash: hash,
        error: ErrorText(error),
      });
      throw new AppError(
        `The ${label} transaction ${hash} is not confirmed yet`,
        502,
        'blockchain_error'
      );
    }
  }

  /** Why a mined Subscriptions call reverted, replayed at its block. */
  private async ReplayRevert(
    hash: Hex,
    blockNumber: bigint
  ): Promise<RevertDetails> {
    const transaction = await NodeCall('transaction read', () =>
      GetPublicClient().getTransaction({ hash })
    );
    return NodeCall('revert replay', () =>
      this.RevertReason(transaction, blockNumber, SUBSCRIPTIONS_ABI)
    );
  }

  /**
   * Maps a refused `charge`: `NotDueYet` is this period already collected,
   * `NotActive` a pause, and a transfer the token refused is classified
   * from the subscriber's allowance and balance.
   */
  private async ChargeRefused(
    revert: RevertDetails,
    subscription: OnchainSubscription,
    amount: bigint
  ): Promise<SubscriptionCollection> {
    if (revert.errorName === 'NotDueYet') {
      return { transaction_hash: null, alreadyCollected: true };
    }
    if (revert.errorName === 'NotActive') throw PausedOnChain();
    if (!IsSubscriptionsError(revert.errorName)) {
      const { usdc } = GetChainConfig();
      const client = GetPublicClient();
      const [allowance, balance] = await NodeCall('subscriber USDC reads', () =>
        Promise.all([
          client.readContract({
            address: usdc,
            abi: USDC_ABI,
            functionName: 'allowance',
            args: [subscription.subscriber, SubscriptionsAddress()],
          }),
          client.readContract({
            address: usdc,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [subscription.subscriber],
          }),
        ])
      );
      if (allowance < amount) {
        throw new AppError(
          "The subscriber's USDC allowance to the Subscriptions contract does not cover this payment; the subscriber must sign a new permit",
          402,
          COLLECTION_FAILED_ALLOWANCE
        );
      }
      if (balance < amount) {
        throw new AppError(
          "The subscriber's wallet does not hold enough USDC for this payment",
          402,
          'insufficient_funds'
        );
      }
    }
    throw SubscriptionsCallRefused('payment', revert);
  }

  private async BuildUnsignedTransaction(
    from: Address,
    to: Address,
    data: Hex,
    options: PayoutBuildOptions,
    kind: Pick<
      UnsignedPayoutBatch,
      | 'transaction_type'
      | 'batch_id'
      | 'recipients_count'
      | 'deadline'
      | 'release_after'
    >,
    latestBlock?: Block
  ): Promise<UnsignedPayoutBatch> {
    const client = GetPublicClient();
    const { chainId } = GetChainConfig();
    const block =
      latestBlock ?? (await client.getBlock({ blockTag: 'latest' }));
    const [estimate, priorityFee, nonce] = await Promise.all([
      this.EstimateGas(from, to, data),
      client.estimateMaxPriorityFeePerGas(),
      options.nonce ??
        client.getTransactionCount({ address: from, blockTag: 'pending' }),
    ]);
    const gas = CeilDiv(estimate * 6n, 5n);
    const fees = ReplacementFees(
      {
        maxFeePerGas: 2n * (block.baseFeePerGas ?? 0n) + priorityFee,
        maxPriorityFeePerGas: priorityFee,
      },
      options.replacing
    );
    const unsigned = serializeTransaction({
      type: 'eip1559',
      chainId,
      nonce,
      to,
      data,
      value: 0n,
      gas,
      ...fees,
    });
    return {
      unsigned_transaction: unsigned,
      estimated_fee: (gas * fees.maxFeePerGas).toString(),
      fee_currency: 'eth',
      chain_id: chainId,
      nonce,
      to,
      gas_limit: gas.toString(),
      max_fee_per_gas: fees.maxFeePerGas.toString(),
      max_priority_fee_per_gas: fees.maxPriorityFeePerGas.toString(),
      block_number: Number(block.number ?? 0n),
      ...kind,
    };
  }

  private async CurrentFees(): Promise<Fees> {
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

  /** Simulates the relay; a revert is the authorization's fault (400). */
  private async EstimateRelayGas(
    relayer: Address,
    usdc: Address,
    data: Hex
  ): Promise<bigint> {
    try {
      const estimate = await GetPublicClient().estimateGas({
        account: relayer,
        to: usdc,
        data,
      });
      return CeilDiv(estimate * 6n, 5n);
    } catch (error) {
      if (!IsExecutionRevert(error)) {
        throw NodeUnavailable('estimateGas', error);
      }
      const revert = DecodeRevert(error);
      Logger.warn('A checkout relay would revert', { error: revert.detail });
      throw new AppError(
        revert.errorName
          ? `The USDC authorization cannot be relayed: ${revert.message}`
          : 'The USDC authorization cannot be relayed',
        400,
        'invalid_request_error'
      );
    }
  }

  /**
   * Signs, hands the hash to `onSigned`, then sends. Accepted when the node
   * takes it, already holds it, or knows the hash after an error; a nonce
   * conflict re-signs at the next pending nonce; anything else throws
   * `refused`. Callers hold the sender's lock.
   */
  private async SendRelay(
    relayer: PrivateKeyAccount,
    to: Address,
    data: Hex,
    gas: bigint,
    onSigned: RelayCheckoutOptions['onSigned'],
    refused = 'The network did not accept the payment'
  ): Promise<string> {
    const client = GetPublicClient();
    const { chainId } = GetChainConfig();
    for (let attempt = 1; ; attempt++) {
      const [fees, nonce] = await NodeCall('relay nonce and fees', () =>
        Promise.all([
          this.CurrentFees(),
          client.getTransactionCount({
            address: relayer.address,
            blockTag: 'pending',
          }),
        ])
      );
      const serialized = await relayer.signTransaction({
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
      await onSigned(hash);
      try {
        await client.sendRawTransaction({ serializedTransaction: serialized });
        return hash;
      } catch (error) {
        if (
          (await this.WasAccepted(error, hash)) ||
          (await this.IsKnownTransaction(hash)) === true
        ) {
          return hash;
        }
        if (attempt < RELAY_SEND_ATTEMPTS && IsNonceConflict(error)) {
          Logger.warn('The relayer nonce was taken; signing the relay again', {
            transactionHash: hash,
            nonce,
            error: ErrorText(error),
          });
          continue;
        }
        Logger.warn('The network refused a relayed transaction', {
          transactionHash: hash,
          error: ErrorText(error),
        });
        throw new AppError(refused, 400, 'blockchain_error');
      }
    }
  }

  /** Whether the node has the transaction; null when it cannot say. */
  private async IsKnownTransaction(hash: string): Promise<boolean | null> {
    try {
      await GetPublicClient().getTransaction({ hash: hash as Hex });
      return true;
    } catch (error) {
      return error instanceof TransactionNotFoundError ? false : null;
    }
  }

  /**
   * Polls until the receipt is ETH_CONFIRMATIONS blocks below the head (at
   * or below the confirmed block); false when `timeoutMs` passes first.
   */
  private async WaitForCheckoutReceipt(
    hash: Hex,
    timeoutMs: number
  ): Promise<boolean> {
    const client = GetPublicClient();
    const depth = BigInt(GetChainConfig().confirmations);
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const receipt = await this.GetReceiptOrNull(hash);
      if (
        receipt &&
        (await this.GetLatestBlockNumber()) - receipt.blockNumber >= depth
      ) {
        return true;
      }
      const left = deadline - Date.now();
      if (left <= 0) return false;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(client.pollingInterval, left))
      );
    }
  }

  private async GetReceiptOrNull(
    hash: Hex
  ): Promise<TransactionReceipt | null> {
    try {
      return await GetPublicClient().getTransactionReceipt({ hash });
    } catch (error) {
      if (error instanceof TransactionReceiptNotFoundError) return null;
      throw error;
    }
  }

  /** The latest block's number and time. */
  private async GetLatestBlock(): Promise<ConfirmedBlock> {
    const block = await GetPublicClient().getBlock({ blockTag: 'latest' });
    return { number: Number(block.number), timestamp: Number(block.timestamp) };
  }

  /** True when the transaction's receipt shows it paid the merchant. */
  private async PaysMerchant(
    hash: Hex,
    expected: Parameters<typeof VerifyCheckoutReceipt>[1]
  ): Promise<boolean> {
    const receipt = await this.GetReceiptOrNull(hash);
    return (
      !!receipt &&
      VerifyCheckoutReceipt(receipt, expected).status === 'verified'
    );
  }

  /**
   * The newest transaction with an `AuthorizationUsed` log for `nonce` (and
   * `authorizer`, when given) at or below `head` that `accept` takes. The
   * search runs newest blocks first from a little before the block the
   * session's creation time maps to (slots are 12 s, so the estimate errs
   * earlier) and is capped at 50 chunks.
   */
  private async FindAuthorizationUse(
    filter: { nonce: Hex; authorizer?: Address },
    window: { createdAt: number; head: ConfirmedBlock },
    accept: (transactionHash: Hex) => Promise<boolean> = async () => true
  ): Promise<Hex | null> {
    const { usdc } = GetChainConfig();
    const { nonce, authorizer } = filter;
    const toBlock = BigInt(window.head.number);
    const elapsed = BigInt(
      Math.max(0, window.head.timestamp - window.createdAt)
    );
    const span =
      CeilDiv(elapsed, BigInt(BLOCK_TIME_SECONDS)) + AUTHORIZATION_LOG_MARGIN;
    const floor = toBlock > span ? toBlock - span : 0n;

    let end = toBlock;
    for (let chunk = 0; chunk < AUTHORIZATION_LOG_MAX_CHUNKS; chunk++) {
      const start =
        end - floor >= AUTHORIZATION_LOG_CHUNK
          ? end - AUTHORIZATION_LOG_CHUNK + 1n
          : floor;
      const logs = await GetPublicClient().getLogs({
        address: usdc,
        event: AUTHORIZATION_USED_EVENT,
        args: { authorizer, nonce },
        fromBlock: start,
        toBlock: end,
        strict: true,
      });
      for (const log of [...logs].reverse()) {
        if (
          log.removed ||
          !log.transactionHash ||
          !SameAddress(log.address, usdc) ||
          (authorizer && !SameAddress(log.args.authorizer, authorizer)) ||
          log.args.nonce.toLowerCase() !== nonce.toLowerCase()
        ) {
          continue;
        }
        const hash = log.transactionHash.toLowerCase() as Hex;
        if (await accept(hash)) return hash;
      }
      if (start === floor) return null;
      end = start - 1n;
    }
    return null;
  }

  private async EstimateGas(from: Address, to: Address, data: Hex) {
    try {
      return await GetPublicClient().estimateGas({ account: from, to, data });
    } catch (error) {
      const revert = DecodeRevert(error);
      Logger.warn('A payout transaction would revert', {
        error: revert.detail,
      });
      throw new AppError(
        revert.errorName
          ? `The payout transaction would revert: ${revert.message}`
          : 'The payout transaction would revert',
        400,
        MapRevertToFailureCode(`${revert.message} ${revert.detail}`)
      );
    }
  }

  /** Polls until a wallet-broadcast transaction is visible, up to 60 s. */
  private async WaitForTransaction(hash: Hex): Promise<Transaction | null> {
    const client = GetPublicClient();
    const deadline = Date.now() + WAIT_TIMEOUT_MS;
    for (;;) {
      try {
        return await client.getTransaction({ hash });
      } catch (error) {
        if (!(error instanceof TransactionNotFoundError)) throw error;
      }
      if (Date.now() >= deadline) return null;
      await new Promise((resolve) =>
        setTimeout(resolve, client.pollingInterval)
      );
    }
  }

  /** "Already known", or "nonce too low" because this very hash was mined. */
  private async WasAccepted(error: unknown, hash: Hex): Promise<boolean> {
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

  /**
   * Paid when the batch's own transaction succeeded with its BatchPaid log
   * (or, for an approval, succeeded); failed when it reverted. Anything that
   * does not prove either stays pending.
   */
  private async SettleReceipt(
    receipt: TransactionReceipt,
    expected: PayoutTransactionExpectation,
    confirmedBlock?: number
  ): Promise<BroadcastResult> {
    const hash = receipt.transactionHash.toLowerCase();
    const built = parseTransaction(expected.unsignedTransaction as Hex);
    const Unsettled = (reason: string): BroadcastResult => {
      Logger.warn('Payout receipt does not settle its batch', { hash, reason });
      return this.Pending(hash);
    };
    if (
      !SameAddress(receipt.from, expected.wallet) ||
      !SameAddress(receipt.to, built.to)
    ) {
      return Unsettled('the receipt is for another sender or contract');
    }

    if (receipt.status === 'success') {
      if (expected.transactionType === 'payout') {
        const { payoutBatch } = PayoutContracts();
        const parsed = ParsePayoutReceipt(receipt, {
          payoutBatch,
          batchId: (expected.batchId ?? '0x') as Hex,
        });
        if (
          !parsed.matched ||
          parsed.count !== expected.recipientsCount ||
          parsed.total !== CentsToTokenUnits(expected.totalCents)
        ) {
          return Unsettled('no matching BatchPaid log');
        }
      }
      return {
        transaction_hash: hash,
        status: 'paid',
        viewer_url: this.ExplorerUrl('tx', hash),
      };
    }

    // A reverted receipt is final for its nonce once it is this batch's call.
    const transaction = await GetPublicClient().getTransaction({
      hash: receipt.transactionHash,
    });
    if (
      transaction.input.toLowerCase() !== (built.data ?? '0x').toLowerCase()
    ) {
      return Unsettled('the reverted transaction carries other calldata');
    }
    const revert = await this.RevertReason(transaction, receipt.blockNumber);
    if (revert.errorName === 'BatchAlreadyPaid') {
      // Another transaction paid this batch first: never a failure. The
      // verdict is paid() at the confirmed block, not at the receipt's block
      // (whose state a pruned node may no longer hold).
      const blockNumber =
        confirmedBlock ?? (await this.GetConfirmedBlock()).number;
      if (!(await this.IsBatchPaid(expected, blockNumber))) {
        return Unsettled('BatchAlreadyPaid but the batch is not paid yet');
      }
      return (
        (await this.FindBatchPayment(expected, blockNumber)) ??
        Unsettled('the batch is paid but its BatchPaid log was not found')
      );
    }
    return {
      transaction_hash: hash,
      status: 'failed',
      viewer_url: this.ExplorerUrl('tx', hash),
      failure_code: MapRevertToFailureCode(
        `${revert.message} ${revert.detail}`
      ),
      failure_message: revert.message,
    };
  }

  /** Replays a reverted call at its block to read the revert reason. */
  private async RevertReason(
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

  private Pending(transactionHash: string): BroadcastResult {
    return {
      transaction_hash: transactionHash,
      status: 'pending',
      viewer_url: this.ExplorerUrl('tx', transactionHash),
    };
  }

  /** Amounts assume 6 decimals; refuse a token that says otherwise. */
  private async VerifyUsdcDecimals(usdc: Address): Promise<void> {
    if (this.usdcDecimalsVerified) return;
    const decimals = await GetPublicClient().readContract({
      address: usdc,
      abi: USDC_ABI,
      functionName: 'decimals',
    });
    if (decimals !== USDC_DECIMALS) {
      throw new Error(
        `USDC at ${usdc} reports ${decimals} decimals; expected ${USDC_DECIMALS}`
      );
    }
    this.usdcDecimalsVerified = true;
  }
}

function ToAddress(value: string): Address {
  if (!isAddress(value)) {
    throw new Error(`Invalid Ethereum address: ${value}`);
  }
  return getAddress(value);
}

function PayoutContracts(): { usdc: Address; payoutBatch: Address } {
  const { chainId, usdc, payoutBatch } = GetChainConfig();
  if (!payoutBatch) {
    throw new AppError(
      `Payouts need PAYOUT_BATCH_ADDRESS on chain ${chainId}`,
      501,
      'not_supported'
    );
  }
  return { usdc, payoutBatch };
}

function SubscriptionsAddress(): Address {
  const { chainId, subscriptions } = GetChainConfig();
  if (!subscriptions) {
    throw new AppError(
      `Subscriptions need SUBSCRIPTIONS_ADDRESS on chain ${chainId}`,
      501,
      'not_supported'
    );
  }
  return subscriptions;
}

function RelayerRequired(): AppError {
  return new AppError(
    'On-chain checkout needs CHECKOUT_RELAYER_KEY to relay payments',
    501,
    'not_supported'
  );
}

function RequireRelayer(): Hex {
  const key = GetCheckoutRelayerKey();
  if (!key) throw RelayerRequired();
  return key;
}

/** The SUBSCRIPTION_OPERATOR_KEY account; a 501 when it is not set. */
function RequireOperator(): PrivateKeyAccount {
  let key: Hex;
  try {
    key = RequireSubscriptionOperatorKey();
  } catch {
    throw new AppError(
      'Recurring prices need SUBSCRIPTION_OPERATOR_KEY to own their on-chain plans',
      501,
      'not_supported'
    );
  }
  return privateKeyToAccount(key);
}

/** One lock per sending address, so one key never races itself. */
function SenderLock(address: Address): string {
  return `sender:${address}`;
}

/** A plan key or subscription id: `0x` and 64 hex characters. */
function Bytes32(value: string, field: string): Hex {
  if (!isHex(value) || value.length !== 66) {
    throw new AppError(
      `${field} must be 0x followed by 64 hex characters`,
      400,
      'invalid_request_error'
    );
  }
  return value.toLowerCase() as Hex;
}

/** A subscribe signature: any non-empty bytes (contract wallets vary). */
function SignatureBytes(signature: string): Hex {
  if (!isHex(signature) || signature.length < 4 || signature.length % 2) {
    throw new AppError(
      'subscribe_signature must be 0x followed by hex bytes',
      400,
      'invalid_request_error'
    );
  }
  return signature;
}

function PositiveTokenUnits(amountCents: number): bigint {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new AppError(
      'A subscription amount must be a positive whole number of cents',
      400,
      'invalid_request_error'
    );
  }
  return CentsToTokenUnits(amountCents);
}

function SameTerms(a: PlanTerms, b: PlanTerms): boolean {
  return (
    SameAddress(a.token, b.token) &&
    a.amount === b.amount &&
    a.periodSeconds === b.periodSeconds
  );
}

/** The terms of a plan that takes subscribers in USDC; else a 400. */
function OpenPlanTerms(plan: OnchainPlan | null, usdc: Address): PlanTerms {
  if (!plan?.active) {
    throw new AppError(
      'This subscription plan does not accept new subscribers on-chain',
      400,
      'invalid_request_error'
    );
  }
  if (!SameAddress(plan.terms.token, usdc)) {
    throw new AppError(
      'This subscription plan does not charge USDC',
      400,
      'invalid_request_error'
    );
  }
  return { ...plan.terms, token: getAddress(plan.terms.token) };
}

function IsSubscribed(subscription: OnchainSubscription): boolean {
  return subscription.status === 'active' || subscription.status === 'paused';
}

function PausedOnChain(): AppError {
  return new AppError(
    'The subscription is paused on-chain',
    409,
    PAUSED_ON_CHAIN
  );
}

/**
 * The Subscriptions contract's own errors. The ABI's other errors
 * (SafeERC20FailedOperation, Nonces and EIP-712 errors) come from the
 * libraries it uses.
 */
const SUBSCRIPTIONS_ERRORS: ReadonlySet<string> = new Set([
  'AlreadySubscribed',
  'AmountExceedsPlan',
  'ExpiredSignature',
  'InvalidAmount',
  'InvalidPeriod',
  'InvalidSignature',
  'NotActive',
  'NotDueYet',
  'NotPaused',
  'PlanExists',
  'PlanInactive',
  'TermsMismatch',
  'Unauthorized',
  'ZeroAddress',
]);

/** True for a custom error of the Subscriptions contract itself. */
function IsSubscriptionsError(errorName: string | null): boolean {
  return errorName !== null && SUBSCRIPTIONS_ERRORS.has(errorName);
}

/**
 * Why a relayed subscribe would revert. A used nonce (another subscribe or
 * a cancel by the subscriber or any plan owner), an expired deadline or a
 * permit the token refuses all mean the signatures are stale: a 409 that
 * asks for a new prepare and new signatures. Only decoded reasons from our
 * ABI reach the client; the node's text is logged.
 */
function SubscribeRefused(
  revert: RevertDetails,
  withPermit: boolean
): AppError {
  Logger.warn('A relayed subscribe would revert', { error: revert.detail });
  const permitRefused = withPermit && !IsSubscriptionsError(revert.errorName);
  if (
    permitRefused ||
    revert.errorName === 'InvalidSignature' ||
    revert.errorName === 'ExpiredSignature'
  ) {
    return new AppError(
      permitRefused
        ? 'The USDC permit can no longer be used. Prepare the subscription again and sign the new request.'
        : 'The subscription signature can no longer be used. Prepare the subscription again and sign the new request.',
      409,
      'subscription_authorization_stale',
      { code: 'subscription_authorization_stale' }
    );
  }
  if (revert.errorName === 'PlanInactive') {
    return new AppError(
      'This subscription plan does not accept new subscribers on-chain',
      400,
      'invalid_request_error'
    );
  }
  return new AppError(
    revert.errorName
      ? `The subscription cannot be relayed: ${revert.message}`
      : 'The subscription cannot be relayed',
    400,
    'invalid_request_error'
  );
}

/** A refused operator call to the Subscriptions contract. */
function SubscriptionsCallRefused(
  label: string,
  revert: RevertDetails
): AppError {
  Logger.warn('A Subscriptions call was refused', {
    label,
    error: revert.detail,
  });
  return new AppError(
    revert.errorName
      ? `The subscription ${label} was refused on-chain: ${revert.message}`
      : `The subscription ${label} was refused on-chain`,
    400,
    'blockchain_error'
  );
}

function AuthorizationNonce(nonce: string): Hex {
  if (!isHex(nonce) || nonce.length !== 66) {
    throw new Error(`Invalid authorization nonce: ${nonce}`);
  }
  return nonce;
}

function CheckoutPending(hash: string | null): CheckoutPaymentVerification {
  return {
    status: 'pending',
    transaction_hash: hash,
    amount_cents: 0,
    payer_address: null,
  };
}

/** Another transaction from the relayer took the nonce this one used. */
function IsNonceConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /nonce too low|replacement transaction underpriced/i.test(message);
}

/**
 * 502 for a node that could not answer; nothing was sent. What the node
 * said goes to the log only: provider text never reaches a client.
 */
function NodeUnavailable(operation: string, error: unknown): AppError {
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

async function NodeCall<T>(
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

/** Why a submitted transaction is not the built one, or null when it is. */
function DescribeMismatch(
  expected: PayoutTransactionExpectation,
  built: ReturnType<typeof parseTransaction>,
  actual: {
    from: Address;
    chainId?: number | null;
    to?: string | null;
    data?: Hex;
    /** Only raw transactions are held to the built nonce. */
    nonce?: number | null;
  }
): string | null {
  if (!SameAddress(actual.from, expected.wallet)) {
    return `it is signed by ${actual.from}, not the platform wallet ${expected.wallet}`;
  }
  if (actual.chainId !== undefined && actual.chainId !== expected.chainId) {
    return `it is for chain ${actual.chainId}, not ${expected.chainId}`;
  }
  if (!SameAddress(actual.to, built.to)) {
    return `it calls ${actual.to ?? 'no contract'}, not ${built.to}`;
  }
  if (
    (actual.data ?? '0x').toLowerCase() !== (built.data ?? '0x').toLowerCase()
  ) {
    return 'its calldata differs from the built transaction';
  }
  if (actual.nonce !== undefined && actual.nonce !== (built.nonce ?? null)) {
    return `nonce ${actual.nonce} does not match the built nonce ${built.nonce}`;
  }
  return null;
}

function CeilDiv(value: bigint, divisor: bigint): bigint {
  return (value + divisor - 1n) / divisor;
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

function ErrorText(error: unknown): string {
  if (error instanceof BaseError) {
    return [error.shortMessage, error.details].filter(Boolean).join(': ');
  }
  return error instanceof Error ? error.message : String(error);
}

function IsExecutionRevert(error: unknown): boolean {
  return (
    error instanceof BaseError &&
    !!error.walk(
      (cause) =>
        cause instanceof ExecutionRevertedError ||
        cause instanceof RawContractError
    )
  );
}

interface RevertDetails {
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

/**
 * The decoded revert: Error(string) reason or an error name from `abi`
 * (PayoutBatch's by default).
 */
function DecodeRevert(
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
