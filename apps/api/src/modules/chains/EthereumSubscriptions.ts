// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Subscriptions on the Subscriptions contract, for the Ethereum rail:
 * plans and charges from SUBSCRIPTION_OPERATOR_KEY, relayed subscribes from
 * CHECKOUT_RELAYER_KEY, and the reads and log searches that reconcile a
 * charge by its hash. `Ethereum` delegates its subscription methods here.
 *
 * @module chains/EthereumSubscriptions
 */

import {
  BaseError,
  encodeFunctionData,
  getAbiItem,
  getAddress,
  isHex,
  TransactionNotFoundError,
  WaitForTransactionReceiptTimeoutError,
  zeroAddress,
  type Address,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { IsTransactionHash, SameAddress } from '@fiatdesk/shared-types';
import { AppError } from '../../utils/AppError';
import { WithKeyedLock } from '../../utils/KeyedLock';
import { Logger } from '../../utils/Logger';
import { Now } from '../../utils/Timestamp';
import {
  GetCheckoutConfirmTimeoutMs,
  IsCheckoutRelayed,
  RequireSubscriptionOperatorKey,
} from '../AppConfig';
import { SUBSCRIPTIONS_ABI } from './abi/Subscriptions';
import { USDC_ABI } from './abi/Usdc';
import { GetChainConfig, GetPublicClient } from './Chain';
import { SplitSignature, type UsdcDomain } from './CheckoutAuthorization';
import {
  BLOCK_TIME_SECONDS,
  CeilDiv,
  ConfirmedBlockNow,
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
  type RevertDetails,
} from './EthereumTransactions';
import { CentsToTokenUnits, MapRevertToFailureCode } from './PayoutEncoding';
import {
  BuildPermitTypedData,
  BuildSubscribeTypedData,
  BuildSubscriptionsDomain,
  FindChargedEvent,
  FindSubscribedEvent,
  PermitValue,
  PlanIdFromPriceId,
  PlanKeyFor,
  SubscribeDeadline,
  SubscriptionIdFor,
  type PlanTerms,
} from './SubscriptionAuthorization';
import {
  ACCOUNT_FROZEN,
  CANCELED_ON_CHAIN,
  COLLECTION_FAILED_ALLOWANCE,
  INSUFFICIENT_FUNDS,
  ONCHAIN_PLAN_MISMATCH,
  PAUSED_ON_CHAIN,
  PERIOD_ALREADY_COLLECTED,
  type ChargeReconcileExpectation,
  type ChargeReconciliation,
  type ChargeSearch,
  type CheckoutSubscribeVerification,
  type OnchainSubscriptionState,
  type OnchainSubscriptionStatus,
  type PreparedSubscribe,
  type RelaySubscribeOptions,
  type SignedTransaction,
  type SubscribeAuthorizationOptions,
  type SubscribeRelay,
  type SubscriptionCancelOptions,
  type SubscriptionCollectParams,
  type SubscriptionCollection,
} from './types';

/** Gas of one relayed `subscribeWithPermit`, for the quoted relay fee. */
const SUBSCRIBE_GAS_ESTIMATE = 200_000n;
/** The contract's `MAX_FIRST_CHARGE_DELAY`. */
const MAX_FIRST_CHARGE_DELAY_SECONDS = 365 * 24 * 3600;
/** A charge still unmined after this long is re-priced at its nonce. */
const REPRICE_AFTER_SECONDS = 600;
/** Blocks per `getLogs` call when looking for a `Charged` log. */
const CHARGE_LOG_CHUNK = 2_000n;
const CHARGE_LOG_MAX_CHUNKS = 50;
/** Blocks searched before `since`, on top of the estimate. */
const CHARGE_LOG_MARGIN = 256n;
const CHARGED_EVENT = getAbiItem({ abi: SUBSCRIPTIONS_ABI, name: 'Charged' });
/** The contract's `Status` enum, by value. */
const SUBSCRIPTION_STATUSES: readonly OnchainSubscriptionStatus[] = [
  'none',
  'active',
  'paused',
  'canceled',
];
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

/** The USDC reads the rail caches (decimals check, EIP-712 domain). */
export interface UsdcAccess {
  VerifyDecimals(usdc: Address): Promise<void>;
  Domain(): Promise<UsdcDomain>;
}

export class EthereumSubscriptions {
  constructor(private readonly usdc: UsdcAccess) {}

  /** SUBSCRIPTION_OPERATOR_KEY's address: owner and puller of every plan. */
  GetPlanOwnerAddress(): string {
    return RequireOperator().address;
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
    await NodeCall('USDC decimals', () => this.usdc.VerifyDecimals(usdc));
    const planId = PlanIdFromPriceId(priceId);
    const planKey = PlanKeyFor(operator.address, planId);
    const terms: PlanTerms = {
      token: usdc,
      amount: PositiveTokenUnits(amountCents),
      periodSeconds: BigInt(periodSeconds),
    };

    const existing = await NodeCall('plan read', () => ReadPlan(planKey));
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
    const simulated = await SimulateSubscriptionsCall(operator.address, data);
    if ('revert' in simulated) {
      throw SubscriptionsCallRefused('plan', simulated.revert);
    }
    const hash = await SendOperatorTransaction(
      operator,
      subscriptions,
      data,
      simulated.gas,
      'subscription plan',
      async () => undefined
    );
    const receipt = await WaitForConfirmedReceipt(hash, WAIT_TIMEOUT_MS);
    if (!receipt) {
      throw new AppError(
        `The subscription plan transaction ${hash} is not confirmed yet`,
        502,
        'blockchain_error'
      );
    }
    if (receipt.status !== 'success') {
      throw SubscriptionsCallRefused(
        'plan',
        await ReplayRevert(hash, receipt.blockNumber)
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
   * is built) and, when needed, the USDC permit. A USDC permit sets the
   * allowance, and one allowance to the Subscriptions contract serves all of
   * the wallet's plans, so the permit is for the current allowance plus this
   * plan's `PermitValue`. It is needed while the allowance is below this
   * plan's `PermitValue` plus `otherPlansAllowance` (the wallet's other live
   * plans). Both are valid for 30 minutes of chain time and never after
   * `expiresAt`. The relayer pays the gas. With `trialSeconds`, the signed
   * `firstChargeAt` is that long after the latest block, so the contract
   * refuses any charge before the trial ends; without, it is 0 (now).
   */
  async BuildSubscribeAuthorization(
    subscriber: string,
    planKey: string,
    expiresAt: number,
    options: SubscribeAuthorizationOptions = {}
  ): Promise<PreparedSubscribe> {
    if (!IsCheckoutRelayed()) throw RelayerRequired();
    const { chainId, usdc } = GetChainConfig();
    const subscriptions = SubscriptionsAddress();
    const owner = ToAddress(subscriber);
    const key = Bytes32(planKey, 'subscription_plan_id');
    await NodeCall('USDC decimals', () => this.usdc.VerifyDecimals(usdc));

    const client = GetPublicClient();
    const [plan, block, allowance, permitNonce, subscribeNonce] =
      await NodeCall('subscribe reads', () =>
        Promise.all([
          ReadPlan(key),
          client.getBlock({ blockTag: 'latest' }),
          ReadAllowance(owner),
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
    const firstChargeAt = FirstChargeAt(
      Number(block.timestamp),
      options.trialSeconds ?? 0
    );
    const planValue = PermitValue(terms);
    const needsPermit =
      allowance < planValue + (options.otherPlansAllowance ?? 0n);
    const [usdcDomain, fees] = await NodeCall('USDC domain and fees', () =>
      Promise.all([this.usdc.Domain(), CurrentFees()])
    );
    return {
      needs_permit: needsPermit,
      permit_typed_data: needsPermit
        ? BuildPermitTypedData(usdcDomain, {
            owner,
            spender: subscriptions,
            value: allowance + planValue,
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
          firstChargeAt,
          nonce: subscribeNonce,
          deadline,
        }
      ),
      deadline,
      first_charge_at: firstChargeAt,
      estimated_fee: (SUBSCRIBE_GAS_ESTIMATE * fees.maxFeePerGas).toString(),
      fee_currency: 'eth',
      chain_id: chainId,
    };
  }

  /**
   * `subscribeWithPermit` (with a permit signature) or
   * `subscribeWithAuthorization` from CHECKOUT_RELAYER_KEY, with the plan's
   * terms read from the chain. The permit value is the current allowance
   * plus this plan's `PermitValue`, as prepared; if the allowance moved
   * since, the permit no longer matches and the answer is the stale 409.
   * Nothing is sent when the subscriber is already subscribed or the
   * recorded relay is still known to the node. The call is simulated first:
   * a stale or expired signature is a 409 `subscription_authorization_stale`
   * (prepare again and sign the new request); other reverts are a 400.
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

    const [plan, subscription, allowance] = await NodeCall(
      'subscribe relay reads',
      () =>
        Promise.all([
          ReadPlan(planKey),
          ReadSubscription(subId),
          ReadAllowance(subscriber),
        ])
    );
    const subscribed = IsSubscribed(subscription);
    if (options.pendingHash) {
      if (subscribed) return options.pendingHash;
      if ((await IsKnownTransaction(options.pendingHash)) !== false) {
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
    const firstChargeAt = BigInt(relay.firstChargeAt);
    const data = permit
      ? encodeFunctionData({
          abi: SUBSCRIPTIONS_ABI,
          functionName: 'subscribeWithPermit',
          args: [
            planKey,
            subscriber,
            terms,
            firstChargeAt,
            allowance + PermitValue(terms),
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
          args: [
            planKey,
            subscriber,
            terms,
            firstChargeAt,
            deadline,
            signature,
          ],
        });

    const simulated = await SimulateSubscriptionsCall(relayer.address, data);
    if ('revert' in simulated) {
      // Someone else submitted it first; verification finds the result.
      if (simulated.revert.errorName === 'AlreadySubscribed') return null;
      throw SubscribeRefused(simulated.revert, !!permit);
    }
    return WithKeyedLock(SenderLock(relayer.address), () =>
      SendSigned(relayer, subscriptions, data, simulated.gas, {
        onSigned: options.onSigned,
        refused: 'The network did not accept the subscription',
      })
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
      ReadSubscription(subId)
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
      IsSubscribed(await ReadSubscription(subId, blockNumber));

    try {
      // A transaction the node has never seen will not confirm by waiting.
      const known = hash === null ? null : await IsKnownTransaction(hash);
      if (hash && known === false && !(await Exists())) {
        return Result('not_found', hash);
      }
      const mined =
        hash !== null &&
        known !== false &&
        (await WaitForReceiptDepth(
          hash,
          options.timeoutMs ?? GetCheckoutConfirmTimeoutMs()
        ));
      const confirmed = await ConfirmedBlockNow();
      const receipt = hash && mined ? await GetReceiptOrNull(hash) : null;
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

  /** Status, next due time and period of the subscription, at chain time. */
  async GetSubscriptionState(
    subscriptionOnchainId: string
  ): Promise<OnchainSubscriptionState> {
    const subId = Bytes32(subscriptionOnchainId, 'subscription_onchain_id');
    return NodeCall('subscription state', async () => {
      const [subscription, block] = await Promise.all([
        ReadSubscription(subId),
        LatestBlock(),
      ]);
      const plan =
        subscription.status === 'none'
          ? null
          : await ReadPlan(subscription.planKey);
      return {
        status: subscription.status,
        next_charge_at:
          subscription.status === 'none'
            ? null
            : Number(subscription.nextChargeAt),
        period_seconds: plan ? Number(plan.terms.periodSeconds) : null,
        chain_time: block.timestamp,
      };
    });
  }

  /**
   * `charge(subId, amount)` from SUBSCRIPTION_OPERATOR_KEY. The status is
   * read first (the chain decides whether it is paused or canceled), the
   * charge is simulated, and `params.onSigned` records its hash before the
   * network sees it. A charge not confirmed within `timeoutMs`, or whose
   * send got no clear answer, is `pending`: reconcile it by its hash.
   * `NotDueYet` is `already_collected`; a `NotActive` revert re-reads the
   * status; a transfer the token refuses is classified from the allowance,
   * balance and blacklist.
   */
  async CollectSubscriptionPayment(
    params: SubscriptionCollectParams
  ): Promise<SubscriptionCollection> {
    const operator = RequireOperator();
    const { usdc } = GetChainConfig();
    const subscriptions = SubscriptionsAddress();
    await NodeCall('USDC decimals', () => this.usdc.VerifyDecimals(usdc));
    const subId = Bytes32(
      params.subscriptionOnchainId,
      'subscription_onchain_id'
    );
    const amount = PositiveTokenUnits(params.amountCents);

    const subscription = await NodeCall('subscription read', () =>
      ReadSubscription(subId)
    );
    AssertChargeable(subscription.status);
    if (subscription.planKey.toLowerCase() !== params.planKey.toLowerCase()) {
      Logger.error('A subscription price is on another on-chain plan', null, {
        subscriptionOnchainId: subId,
        onchainPlanKey: subscription.planKey,
        planKey: params.planKey,
      });
      throw new AppError(
        "The subscription's price is not on its on-chain plan",
        409,
        ONCHAIN_PLAN_MISMATCH
      );
    }

    const data = encodeFunctionData({
      abi: SUBSCRIPTIONS_ABI,
      functionName: 'charge',
      args: [subId, amount],
    });
    const simulated = await SimulateSubscriptionsCall(operator.address, data);
    if ('revert' in simulated) {
      return ChargeRefused(simulated.revert, subId, subscription, amount);
    }
    const hash = await SendOperatorTransaction(
      operator,
      subscriptions,
      data,
      simulated.gas,
      'subscription payment',
      params.onSigned
    );
    const receipt = await WaitForConfirmedReceipt(
      hash,
      params.timeoutMs ?? WAIT_TIMEOUT_MS
    );
    if (!receipt) return { status: 'pending', transaction_hash: hash };
    if (receipt.status !== 'success') {
      return ChargeRefused(
        await ReplayRevert(hash, receipt.blockNumber),
        subId,
        subscription,
        amount
      );
    }
    return {
      status: 'collected',
      transaction_hash: hash,
      next_charge_at: FindChargedEvent(receipt, {
        subscriptions,
        subId,
        amount,
      }),
    };
  }

  /**
   * What the hashes recorded for a charge say, taken together: the original
   * and every re-priced replacement (Q10 #7).
   * - Any of them confirmed with its `Charged(subId, amount)` log is `paid`;
   *   one mined but not deep enough yet is `pending`.
   * - One mined without collecting (a revert) is `failed`, with the error a
   *   fresh charge would give (a decline only for allowance, balance or
   *   blacklist).
   * - No receipt: `dropped` only when their nonce is consumed (by another
   *   transaction); otherwise `pending`, even when the node does not know
   *   them. A charge pending for more than 10 minutes is re-priced at its
   *   nonce under the operator's lock, `onReplaced` recording the new hash
   *   first; a re-price the network refuses leaves it pending.
   */
  async ReconcileSubscriptionCharge(
    transactionHashes: string[],
    expected: ChargeReconcileExpectation
  ): Promise<ChargeReconciliation> {
    const subscriptions = SubscriptionsAddress();
    const subId = Bytes32(
      expected.subscriptionOnchainId,
      'subscription_onchain_id'
    );
    const amount = PositiveTokenUnits(expected.amountCents);
    const hashes = [
      ...new Set(transactionHashes.map((hash) => hash.toLowerCase() as Hex)),
    ];
    const newest = hashes[hashes.length - 1];
    if (!newest) return { status: 'dropped' };
    const Pending = (hash: string = newest): ChargeReconciliation => ({
      status: 'pending',
      transaction_hash: hash,
    });

    const receipts = (
      await NodeCall('charge receipts', () =>
        Promise.all(hashes.map((hash) => GetReceiptOrNull(hash)))
      )
    ).filter((receipt): receipt is TransactionReceipt => receipt !== null);
    for (const receipt of receipts) {
      const nextChargeAt = FindChargedEvent(receipt, {
        subscriptions,
        subId,
        amount,
      });
      if (nextChargeAt === null) continue;
      if (!(await NodeCall('confirmations', () => HasConfirmations(receipt)))) {
        return Pending();
      }
      return {
        status: 'paid',
        transaction_hash: receipt.transactionHash.toLowerCase(),
        next_charge_at: nextChargeAt,
      };
    }
    // The current attempt is the hashes signed at the recorded nonce: the
    // original and its replacements. Hashes of an earlier attempt, cleared
    // when its nonce went elsewhere, can no longer decide anything but a
    // payment.
    const client = GetPublicClient();
    const transactions = await NodeCall('charge transactions', () =>
      Promise.all(
        hashes.map(async (hash) => {
          try {
            return await client.getTransaction({ hash });
          } catch (error) {
            if (error instanceof TransactionNotFoundError) return null;
            throw error;
          }
        })
      )
    );
    const InAttempt = (index: number) =>
      expected.nonce === null
        ? hashes[index] === newest
        : transactions[index]?.nonce === expected.nonce;
    const mined = receipts.find((receipt) =>
      InAttempt(hashes.indexOf(receipt.transactionHash.toLowerCase() as Hex))
    );
    if (mined) {
      // Their shared nonce went to one of them, which did not collect.
      if (!(await NodeCall('confirmations', () => HasConfirmations(mined)))) {
        return Pending();
      }
      return ChargeOutcome(mined, subId, amount);
    }

    const operator = RequireOperator();
    const known = transactions.filter(
      (transaction, index): transaction is NonNullable<typeof transaction> =>
        transaction !== null && InAttempt(index)
    );
    const latestKnown = known[known.length - 1];
    const nonce = expected.nonce ?? latestKnown?.nonce ?? null;
    // A charge recorded without its nonce and unknown to the node cannot be
    // shown to be pending; the Charged-log search covers one that landed.
    if (nonce === null) return { status: 'dropped' };
    const minedNonce = await NodeCall('sender nonce', () =>
      client.getTransactionCount({
        address: latestKnown?.from ?? operator.address,
        blockTag: 'latest',
      })
    );
    if (minedNonce > nonce) return { status: 'dropped' };

    if (
      expected.sentAt === null ||
      Now() - expected.sentAt < REPRICE_AFTER_SECONDS ||
      (latestKnown && !SameAddress(latestKnown.from, operator.address))
    ) {
      return Pending();
    }
    const data =
      latestKnown?.input ??
      encodeFunctionData({
        abi: SUBSCRIPTIONS_ABI,
        functionName: 'charge',
        args: [subId, amount],
      });
    let gas = latestKnown?.gas;
    if (gas === undefined) {
      const simulated = await SimulateSubscriptionsCall(operator.address, data);
      if ('revert' in simulated) return Pending();
      gas = simulated.gas;
    }
    const fees = ReplacementFees(
      await NodeCall('fees', () => CurrentFees()),
      latestKnown
        ? {
            maxFeePerGas: latestKnown.maxFeePerGas?.toString() ?? null,
            maxPriorityFeePerGas:
              latestKnown.maxPriorityFeePerGas?.toString() ?? null,
          }
        : undefined
    );
    let replacement: string | null = null;
    try {
      replacement = await WithKeyedLock(SenderLock(operator.address), () =>
        SendSigned(operator, subscriptions, data, gas, {
          onSigned: expected.onReplaced,
          refused:
            'The network did not accept the re-priced subscription payment',
          ambiguousAsSent: true,
          replace: { nonce, fees },
        })
      );
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      Logger.warn('A stuck subscription charge could not be re-priced', {
        subscriptionOnchainId: subId,
        transactionHash: newest,
        error: error.message,
      });
      return Pending();
    }
    Logger.warn('Re-priced a stuck subscription charge', {
      subscriptionOnchainId: subId,
      transactionHash: newest,
      replacement,
    });
    return Pending(replacement);
  }

  /**
   * The newest `Charged(subId)` log for `amount` in a block at or after
   * `since` that `accept` takes (all, by default), searched from the
   * confirmed block backwards (capped at 50 chunks of 2,000 blocks), or
   * null.
   */
  async FindSubscriptionCharge(
    subscriptionOnchainId: string,
    expected: ChargeSearch
  ): Promise<{ transaction_hash: string; next_charge_at: number } | null> {
    const subscriptions = SubscriptionsAddress();
    const subId = Bytes32(subscriptionOnchainId, 'subscription_onchain_id');
    const amount = PositiveTokenUnits(expected.amountCents);
    const client = GetPublicClient();
    const head = await NodeCall('charge log search', () => ConfirmedBlockNow());
    const toBlock = BigInt(head.number);
    const elapsed = BigInt(Math.max(0, head.timestamp - expected.since));
    const span =
      CeilDiv(elapsed, BigInt(BLOCK_TIME_SECONDS)) + CHARGE_LOG_MARGIN;
    const floor = toBlock > span ? toBlock - span : 0n;
    let end = toBlock;
    for (let chunk = 0; chunk < CHARGE_LOG_MAX_CHUNKS; chunk++) {
      const start =
        end - floor >= CHARGE_LOG_CHUNK ? end - CHARGE_LOG_CHUNK + 1n : floor;
      const logs = await NodeCall('charge log search', () =>
        client.getLogs({
          address: subscriptions,
          event: CHARGED_EVENT,
          args: { subId },
          fromBlock: start,
          toBlock: end,
          strict: true,
        })
      );
      for (const log of [...logs].reverse()) {
        if (
          log.removed ||
          !log.transactionHash ||
          log.blockNumber === null ||
          !SameAddress(log.address, subscriptions) ||
          log.args.subId.toLowerCase() !== subId ||
          log.args.amount !== amount
        ) {
          continue;
        }
        const blockNumber = log.blockNumber;
        const block = await NodeCall('charge log block', () =>
          client.getBlock({ blockNumber })
        );
        if (Number(block.timestamp) < expected.since) return null;
        const transactionHash = log.transactionHash.toLowerCase();
        if (expected.accept && !(await expected.accept(transactionHash))) {
          continue;
        }
        return {
          transaction_hash: transactionHash,
          next_charge_at: Number(log.args.nextChargeAt),
        };
      }
      if (start === floor) return null;
      end = start - 1n;
    }
    return null;
  }

  /**
   * Sends `cancel(subId)` from SUBSCRIPTION_OPERATOR_KEY, the plan owner,
   * without waiting for it: `options.onSigned` records the hash first and
   * the billing runner follows it later. Null when the subscription is no
   * longer active or paused on-chain. A recorded cancel that is still
   * pending is returned as it is, and re-priced at its nonce after 10
   * minutes, as a stuck charge is. One that reverted, or whose nonce went to
   * another transaction, or that the node does not know, is sent again.
   */
  async CancelSubscription(
    subscriptionOnchainId: string,
    options: SubscriptionCancelOptions
  ): Promise<string | null> {
    const operator = RequireOperator();
    const subscriptions = SubscriptionsAddress();
    const subId = Bytes32(subscriptionOnchainId, 'subscription_onchain_id');
    const subscription = await NodeCall('subscription read', () =>
      ReadSubscription(subId)
    );
    if (!IsSubscribed(subscription)) return null;
    if (options.pendingHash) {
      const pending = await this.FollowCancel(
        operator,
        options.pendingHash.toLowerCase() as Hex,
        options
      );
      if (pending) return pending;
    }

    const data = encodeFunctionData({
      abi: SUBSCRIPTIONS_ABI,
      functionName: 'cancel',
      args: [subId],
    });
    const simulated = await SimulateSubscriptionsCall(operator.address, data);
    if ('revert' in simulated) {
      if (simulated.revert.errorName === 'NotActive') return null;
      throw SubscriptionsCallRefused('cancel', simulated.revert);
    }
    return SendOperatorTransaction(
      operator,
      subscriptions,
      data,
      simulated.gas,
      'subscription cancel',
      options.onSigned
    );
  }

  /**
   * A recorded cancel that may still land: its hash, or its re-priced
   * replacement after 10 minutes. Null when a new cancel must be sent.
   */
  private async FollowCancel(
    operator: PrivateKeyAccount,
    hash: Hex,
    options: SubscriptionCancelOptions
  ): Promise<string | null> {
    const receipt = await NodeCall('cancel receipt', () =>
      GetReceiptOrNull(hash)
    );
    if (receipt) return receipt.status === 'success' ? hash : null;
    const client = GetPublicClient();
    const transaction = await NodeCall('cancel transaction', async () => {
      try {
        return await client.getTransaction({ hash });
      } catch (error) {
        if (error instanceof TransactionNotFoundError) return null;
        throw error;
      }
    });
    if (!transaction) return null;
    const minedNonce = await NodeCall('sender nonce', () =>
      client.getTransactionCount({
        address: transaction.from,
        blockTag: 'latest',
      })
    );
    if (minedNonce > transaction.nonce) return null;
    if (
      options.sentAt === null ||
      options.sentAt === undefined ||
      Now() - options.sentAt < REPRICE_AFTER_SECONDS ||
      !SameAddress(transaction.from, operator.address)
    ) {
      return hash;
    }
    const fees = ReplacementFees(await NodeCall('fees', () => CurrentFees()), {
      maxFeePerGas: transaction.maxFeePerGas?.toString() ?? null,
      maxPriorityFeePerGas:
        transaction.maxPriorityFeePerGas?.toString() ?? null,
    });
    try {
      return await WithKeyedLock(SenderLock(operator.address), () =>
        SendSigned(
          operator,
          SubscriptionsAddress(),
          transaction.input,
          transaction.gas,
          {
            onSigned: options.onSigned,
            refused:
              'The network did not accept the re-priced subscription cancel',
            ambiguousAsSent: true,
            replace: { nonce: transaction.nonce, fees },
          }
        )
      );
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      Logger.warn('A stuck subscription cancel could not be re-priced', {
        transactionHash: hash,
        error: error.message,
      });
      return hash;
    }
  }
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

async function ReadPlan(planKey: Hex): Promise<OnchainPlan | null> {
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

async function ReadSubscription(
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

/** The subscriber's USDC allowance to the Subscriptions contract. */
function ReadAllowance(owner: Address): Promise<bigint> {
  return GetPublicClient().readContract({
    address: GetChainConfig().usdc,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: [owner, SubscriptionsAddress()],
  });
}

/**
 * Estimates a Subscriptions call: the gas (with a 20 % margin), or the
 * decoded revert. Any other failure is a 502 with the node's text logged.
 */
async function SimulateSubscriptionsCall(
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
 * Sends a Subscriptions call from the operator under its lock. A send the
 * node gives no clear answer on counts as sent: its hash is recorded.
 */
function SendOperatorTransaction(
  operator: PrivateKeyAccount,
  to: Address,
  data: Hex,
  gas: bigint,
  label: string,
  onSigned: (
    transactionHash: string,
    signed: SignedTransaction
  ) => Promise<void>
): Promise<Hex> {
  return WithKeyedLock(
    SenderLock(operator.address),
    async () =>
      (await SendSigned(operator, to, data, gas, {
        onSigned,
        refused: `The network did not accept the ${label}`,
        ambiguousAsSent: true,
      })) as Hex
  );
}

/**
 * The receipt of this very transaction once it has ETH_CONFIRMATIONS
 * confirmations (its own block counts as the first), or null when
 * `timeoutMs` passes first, the node cannot say, or another transaction
 * took its nonce (the caller treats it as pending).
 */
async function WaitForConfirmedReceipt(
  hash: Hex,
  timeoutMs: number
): Promise<TransactionReceipt | null> {
  try {
    const receipt = await GetPublicClient().waitForTransactionReceipt({
      hash,
      confirmations: GetChainConfig().confirmations,
      timeout: timeoutMs,
    });
    return receipt.transactionHash.toLowerCase() === hash.toLowerCase()
      ? receipt
      : null;
  } catch (error) {
    if (!(error instanceof WaitForTransactionReceiptTimeoutError)) {
      Logger.warn('Waiting for a receipt failed; leaving it pending', {
        transactionHash: hash,
        error: ErrorText(error),
      });
    }
    return null;
  }
}

/** The same count as `WaitForConfirmedReceipt`, for a receipt read later. */
async function HasConfirmations(receipt: TransactionReceipt): Promise<boolean> {
  const latest = await GetPublicClient().getBlockNumber({ cacheTime: 0 });
  return (
    latest - receipt.blockNumber + 1n >= BigInt(GetChainConfig().confirmations)
  );
}

/** Why a mined Subscriptions call reverted, replayed at its block. */
async function ReplayRevert(
  hash: Hex,
  blockNumber: bigint
): Promise<RevertDetails> {
  const transaction = await NodeCall('transaction read', () =>
    GetPublicClient().getTransaction({ hash })
  );
  return NodeCall('revert replay', () =>
    RevertReason(transaction, blockNumber, SUBSCRIPTIONS_ABI)
  );
}

/**
 * What a mined charge that did not collect means. A reverted one maps as a
 * fresh charge refused the same way would (a decline only for allowance,
 * balance or blacklist; `NotDueYet` is `period_already_collected`).
 */
async function ChargeOutcome(
  receipt: TransactionReceipt,
  subId: Hex,
  amount: bigint
): Promise<ChargeReconciliation> {
  if (receipt.status === 'success') {
    return {
      status: 'failed',
      error: new AppError(
        'The recorded charge did not collect this subscription',
        400,
        'blockchain_error'
      ),
    };
  }
  const subscription = await NodeCall('subscription read', () =>
    ReadSubscription(subId)
  );
  try {
    const outcome = await ChargeRefused(
      await ReplayRevert(receipt.transactionHash, receipt.blockNumber),
      subId,
      subscription,
      amount
    );
    if (outcome.status === 'already_collected') {
      return { status: 'failed', error: PeriodAlreadyCollected(null) };
    }
  } catch (error) {
    if (error instanceof AppError) return { status: 'failed', error };
    throw error;
  }
  return { status: 'dropped' };
}

/** Paused and canceled subscriptions are never charged. */
function AssertChargeable(status: OnchainSubscriptionStatus): void {
  if (status === 'paused') {
    throw new AppError(
      'The subscription is paused on-chain',
      409,
      PAUSED_ON_CHAIN
    );
  }
  if (status !== 'active') {
    throw new AppError(
      status === 'canceled'
        ? 'The subscription is canceled on-chain'
        : 'This subscription does not exist on-chain',
      409,
      CANCELED_ON_CHAIN
    );
  }
}

export function PeriodAlreadyCollected(nextChargeAt: number | null): AppError {
  return new AppError(
    'This on-chain subscription period is already collected; wait for the next billing period before collecting again',
    409,
    PERIOD_ALREADY_COLLECTED,
    nextChargeAt === null ? undefined : { next_charge_at: nextChargeAt }
  );
}

/**
 * Maps a refused `charge`: `NotDueYet` is this period already collected,
 * `NotActive` is a pause or a cancel (the status is read again), and a
 * transfer the token refused is classified from the subscriber's
 * allowance, balance and blacklist. Anything else is a refusal that is not
 * the subscriber's decline.
 */
async function ChargeRefused(
  revert: RevertDetails,
  subId: Hex,
  subscription: OnchainSubscription,
  amount: bigint
): Promise<SubscriptionCollection> {
  if (revert.errorName === 'NotDueYet') {
    return { status: 'already_collected', transaction_hash: null };
  }
  if (revert.errorName === 'NotActive') {
    const current = await NodeCall('subscription read', () =>
      ReadSubscription(subId)
    );
    AssertChargeable(current.status === 'active' ? 'paused' : current.status);
  }
  if (!IsSubscriptionsError(revert.errorName)) {
    const [allowance, balance] = await NodeCall('subscriber USDC reads', () =>
      Promise.all([
        ReadAllowance(subscription.subscriber),
        GetPublicClient().readContract({
          address: GetChainConfig().usdc,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [subscription.subscriber],
        }),
      ])
    );
    if (allowance < amount) {
      throw new AppError(
        "The subscriber's USDC allowance for this subscription is used up; the subscriber must approve more USDC (subscribe again) for renewals to resume.",
        402,
        COLLECTION_FAILED_ALLOWANCE
      );
    }
    if (balance < amount) {
      throw new AppError(
        "The subscriber's wallet does not hold enough USDC for this payment",
        402,
        INSUFFICIENT_FUNDS
      );
    }
    if (
      MapRevertToFailureCode(`${revert.message} ${revert.detail}`) ===
      'account_frozen'
    ) {
      throw new AppError(
        "The subscriber's wallet is frozen by the USDC issuer",
        402,
        ACCOUNT_FROZEN
      );
    }
  }
  throw SubscriptionsCallRefused('payment', revert);
}

/**
 * The signed first charge time: `trialSeconds` after `chainNow`, or 0 (the
 * subscribe time) without a trial. The contract allows at most 365 days.
 */
function FirstChargeAt(chainNow: number, trialSeconds: number): number {
  if (!Number.isInteger(trialSeconds) || trialSeconds < 0) {
    throw new AppError(
      'A trial must be a whole number of seconds',
      400,
      'invalid_request_error'
    );
  }
  if (trialSeconds > MAX_FIRST_CHARGE_DELAY_SECONDS) {
    throw new AppError(
      'A trial on an on-chain subscription can last at most 365 days',
      400,
      'invalid_request_error'
    );
  }
  return trialSeconds === 0 ? 0 : chainNow + trialSeconds;
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
