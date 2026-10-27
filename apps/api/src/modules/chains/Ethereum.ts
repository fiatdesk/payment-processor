// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * The on-chain Ethereum rail (mainnet, Sepolia or Anvil): rail description,
 * explorer links, address checks, balance reads, deposit detection from USDC
 * `Transfer` logs, batch payouts through the PayoutBatch contract and hosted
 * checkout through relayed EIP-3009 authorizations. Subscriptions on the
 * Subscriptions contract live in `EthereumSubscriptions`, which this class
 * delegates to.
 *
 * @module chains/Ethereum
 */

import {
  BaseError,
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
  type Address,
  type Block,
  type Hex,
  type Transaction,
  type TransactionReceipt,
  type TransactionSerialized,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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
  GetPayoutDeadlineSeconds,
  IsCheckoutRelayed,
} from '../AppConfig';
import { PAYOUT_BATCH_ABI } from './abi/PayoutBatch';
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
  BLOCK_TIME_SECONDS,
  CeilDiv,
  CurrentFees,
  DecodeRevert,
  ErrorText,
  GetReceiptOrNull,
  IsExecutionRevert,
  IsKnownTransaction,
  LatestBlock,
  NodeCall,
  NodeUnavailable,
  RelayerRequired,
  ReplacementFees,
  RequireRelayer,
  RevertReason,
  SenderLock,
  SendSigned,
  ToAddress,
  WAIT_TIMEOUT_MS,
  WaitForReceiptDepth,
  WasAccepted,
} from './EthereumTransactions';
import { EthereumSubscriptions } from './EthereumSubscriptions';
import {
  CentsToTokenUnits,
  EncodeDisperseCall,
  MapRevertToFailureCode,
  ParsePayoutReceipt,
} from './PayoutEncoding';
import type { Settlement } from './Settlement';
import type {
  BroadcastResult,
  ChargeReconcileExpectation,
  ChargeReconciliation,
  ChargeSearch,
  CheckoutPaymentExpectation,
  CheckoutPaymentVerification,
  CheckoutSubscribeVerification,
  ConfirmedBlock,
  IncomingDeposit,
  OnchainSubscriptionState,
  PayoutBuildOptions,
  PayoutTransactionExpectation,
  PayoutTransactionMatch,
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
} from './types';

export { ReplacementFees };

const USDC_DECIMALS = 6;
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
/** Blocks per `getLogs` call when looking for a used authorization. */
const AUTHORIZATION_LOG_CHUNK = 2_000n;
const AUTHORIZATION_LOG_MAX_CHUNKS = 50;
/** Blocks searched before the session's creation, on top of the estimate. */
const AUTHORIZATION_LOG_MARGIN = 256n;

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
  private readonly subscriptions = new EthereumSubscriptions({
    VerifyDecimals: (usdc) => this.VerifyUsdcDecimals(usdc),
    Domain: () => this.GetUsdcDomain(),
  });

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
    return this.subscriptions.GetPlanOwnerAddress();
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
      if (!(await WasAccepted(error, hash))) {
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
      CurrentFees(),
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
      if ((await IsKnownTransaction(options.pendingHash)) !== false) {
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
        { createdAt: options.createdAt, head: await LatestBlock() },
        (hash) => this.PaysMerchant(hash, paid)
      )
    );
    // A used authorization that paid nobody here is left to verification.
    if (earlier || used) return earlier;

    const gas = await this.EstimateRelayGas(relayer.address, usdc, data);
    return WithKeyedLock(SenderLock(relayer.address), () =>
      SendSigned(relayer, usdc, data, gas, {
        onSigned: options.onSigned,
        refused: 'The network did not accept the payment',
      })
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
      const known = hash === null ? null : await IsKnownTransaction(hash);
      if (hash && known === false && !(await AuthorizationUsed())) {
        return { ...CheckoutPending(hash), status: 'not_found' };
      }
      const mined =
        hash !== null &&
        known !== false &&
        (await WaitForReceiptDepth(
          hash,
          options.timeoutMs ?? GetCheckoutConfirmTimeoutMs()
        ));
      const confirmed = await this.GetConfirmedBlock();
      let checked: CheckoutPaymentVerification | null = null;
      if (hash && mined) {
        const receipt = await GetReceiptOrNull(hash);
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

  CreateSubscriptionPlan(
    priceId: string,
    periodSeconds: number,
    amountCents: number,
    destination: string,
    puller: string
  ): Promise<string> {
    return this.subscriptions.CreateSubscriptionPlan(
      priceId,
      periodSeconds,
      amountCents,
      destination,
      puller
    );
  }

  BuildSubscribeAuthorization(
    subscriber: string,
    planKey: string,
    expiresAt: number,
    options?: SubscribeAuthorizationOptions
  ): Promise<PreparedSubscribe> {
    return this.subscriptions.BuildSubscribeAuthorization(
      subscriber,
      planKey,
      expiresAt,
      options
    );
  }

  RelaySubscribe(
    relay: SubscribeRelay,
    options: RelaySubscribeOptions
  ): Promise<string | null> {
    return this.subscriptions.RelaySubscribe(relay, options);
  }

  FindExistingSubscription(
    planKey: string,
    subscriber: string
  ): Promise<string | null> {
    return this.subscriptions.FindExistingSubscription(planKey, subscriber);
  }

  VerifySubscribeTransaction(
    transactionHash: string | null,
    expected: { planKey: string; subscriberWallet: string },
    options?: { timeoutMs?: number }
  ): Promise<CheckoutSubscribeVerification> {
    return this.subscriptions.VerifySubscribeTransaction(
      transactionHash,
      expected,
      options
    );
  }

  GetSubscriptionState(
    subscriptionOnchainId: string
  ): Promise<OnchainSubscriptionState> {
    return this.subscriptions.GetSubscriptionState(subscriptionOnchainId);
  }

  CollectSubscriptionPayment(
    params: SubscriptionCollectParams
  ): Promise<SubscriptionCollection> {
    return this.subscriptions.CollectSubscriptionPayment(params);
  }

  ReconcileSubscriptionCharge(
    transactionHashes: string[],
    expected: ChargeReconcileExpectation
  ): Promise<ChargeReconciliation> {
    return this.subscriptions.ReconcileSubscriptionCharge(
      transactionHashes,
      expected
    );
  }

  FindSubscriptionCharge(
    subscriptionOnchainId: string,
    expected: ChargeSearch
  ): Promise<{ transaction_hash: string; next_charge_at: number } | null> {
    return this.subscriptions.FindSubscriptionCharge(
      subscriptionOnchainId,
      expected
    );
  }

  CancelSubscription(
    subscriptionOnchainId: string,
    options: SubscriptionCancelOptions
  ): Promise<string | null> {
    return this.subscriptions.CancelSubscription(
      subscriptionOnchainId,
      options
    );
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

  /** True when the transaction's receipt shows it paid the merchant. */
  private async PaysMerchant(
    hash: Hex,
    expected: Parameters<typeof VerifyCheckoutReceipt>[1]
  ): Promise<boolean> {
    const receipt = await GetReceiptOrNull(hash);
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
    const revert = await RevertReason(transaction, receipt.blockNumber);
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
