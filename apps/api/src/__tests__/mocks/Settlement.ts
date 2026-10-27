// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Jest double for the `Settlement` interface, with resolved defaults that
 * stand in for the on-chain Ethereum rail (Sepolia).
 */

import {
  IsTransactionHash,
  type CheckoutTransferAuthorization,
} from '@zoneless/shared-types';
import {
  BuildTransferAuthorization,
  BuildTransferAuthorizationTypedData,
  type UsdcDomain,
} from '../../modules/chains/CheckoutAuthorization';
import type { Settlement } from '../../modules/chains/Settlement';
import {
  BuildPermitTypedData,
  BuildSubscribeTypedData,
  BuildSubscriptionsDomain,
} from '../../modules/chains/SubscriptionAuthorization';
import type {
  BroadcastResult,
  ChargeReconciliation,
  CheckoutPaymentVerification,
  CheckoutSubscribeVerification,
  OnchainSubscriptionState,
  SubscriptionCollection,
  PayoutBuildOptions,
  PayoutTransactionExpectation,
  PayoutTransactionMatch,
  PreparedAuthorization,
  PreparedSubscribe,
  RelayCheckoutOptions,
  RelaySubscribeOptions,
  SubscribeRelay,
  TransferRecipient,
  UnsignedPayoutBatch,
} from '../../modules/chains/types';

/** Anvil default accounts #0 and #1 (public test keys). */
export const MOCK_PLAN_OWNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
export const MOCK_PAYER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
export const MOCK_USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
export const MOCK_PAYOUT_BATCH = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
export const MOCK_USDC_DOMAIN: UsdcDomain = {
  name: 'USDC',
  version: '2',
  chainId: 11155111,
  verifyingContract: MOCK_USDC,
};
/** Hash the mock relay returns for a checkout authorization. */
export const MOCK_RELAY_HASH = `0x${'c0'.repeat(32)}`;
export const MOCK_SUBSCRIPTIONS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
/** Plan key CreateSubscriptionPlan returns. */
export const MOCK_PLAN_KEY = `0x${'a1'.repeat(32)}`;
/** Subscription id VerifySubscribeTransaction reports. */
export const MOCK_SUBSCRIPTION_ID = `0x${'5b'.repeat(32)}`;
/** Hash the mock relay returns for a subscribe. */
export const MOCK_SUBSCRIBE_HASH = `0x${'5c'.repeat(32)}`;
/** Hash of the mock's `charge` transaction. */
export const MOCK_CHARGE_HASH = `0x${'c4'.repeat(32)}`;
/** The operator nonce the mock charge is signed with. */
export const MOCK_CHARGE_NONCE = 7;
export const MOCK_CANCEL_HASH = `0x${'ca'.repeat(32)}`;
/** Nonce of built batches; GetAccountNonce returns it, so nothing is consumed. */
export const MOCK_PAYOUT_NONCE = 7;
/** What GetConfirmedBlock returns: the block at `latest - ETH_CONFIRMATIONS`. */
export const MOCK_CONFIRMED_BLOCK = 150;
/** What GetLatestBlockNumber returns (Sepolia's default 2 confirmations). */
export const MOCK_LATEST_BLOCK = BigInt(MOCK_CONFIRMED_BLOCK + 2);
/** Mock "now" for deadlines; specs pin Now() to 1700000000. */
export const MOCK_BUILD_TIME = 1_700_000_000;
/** Confirmed-block time by default: after the build, before any deadline. */
export const MOCK_CONFIRMED_TIME = MOCK_BUILD_TIME + 100;

/** A hash passes through (lowercased); anything else stands for a raw tx. */
export function MockTransactionHash(signedOrHash: string): string {
  return IsTransactionHash(signedOrHash)
    ? signedOrHash.toLowerCase()
    : `0xhash_of_${signedOrHash}`;
}

export function MockReceipt(
  status: BroadcastResult['status'],
  hash: string,
  extra: Partial<BroadcastResult> = {}
): BroadcastResult {
  return {
    transaction_hash: hash,
    status,
    viewer_url: `https://sepolia.etherscan.io/tx/${hash}`,
    ...extra,
  };
}

export function MockPayoutBatch(
  transactionType: UnsignedPayoutBatch['transaction_type'],
  recipientsCount: number,
  options?: PayoutBuildOptions
): UnsignedPayoutBatch {
  return {
    unsigned_transaction: `0x02unsigned_${transactionType}`,
    estimated_fee: '180000000000000',
    fee_currency: 'eth',
    chain_id: 11155111,
    nonce: options?.nonce ?? MOCK_PAYOUT_NONCE,
    to: transactionType === 'payout' ? MOCK_PAYOUT_BATCH : MOCK_USDC,
    recipients_count: recipientsCount,
    transaction_type: transactionType,
    batch_id: transactionType === 'payout' ? options?.batchId ?? null : null,
    gas_limit: '60000',
    max_fee_per_gas: options?.replacing ? '3375000000' : '3000000000',
    max_priority_fee_per_gas: options?.replacing ? '1125000000' : '1000000000',
    block_number: 100,
    deadline:
      transactionType === 'payout'
        ? MOCK_BUILD_TIME + (options?.deadlineSeconds ?? 1800)
        : null,
    release_after:
      transactionType === 'payout'
        ? MOCK_BUILD_TIME + (options?.deadlineSeconds ?? 1800) + 24
        : null,
  };
}

/**
 * A prepared subscribe for 20 USDC every 30 days, valid until `deadline`,
 * first charged at `firstChargeAt` (0: at subscribe).
 */
export function MockPreparedSubscribe(
  subscriber: string,
  planKey: string,
  deadline: number,
  needsPermit = true,
  firstChargeAt = 0
): PreparedSubscribe {
  const terms = {
    token: MOCK_USDC,
    amount: 20_000_000n,
    periodSeconds: 2_592_000n,
  } as const;
  return {
    needs_permit: needsPermit,
    permit_typed_data: needsPermit
      ? BuildPermitTypedData(MOCK_USDC_DOMAIN, {
          owner: subscriber as `0x${string}`,
          spender: MOCK_SUBSCRIPTIONS,
          value: terms.amount * 13n,
          nonce: 0n,
          deadline,
        })
      : null,
    subscribe_typed_data: BuildSubscribeTypedData(
      BuildSubscriptionsDomain(11155111, MOCK_SUBSCRIPTIONS),
      {
        planKey: planKey as `0x${string}`,
        subscriber: subscriber as `0x${string}`,
        terms,
        firstChargeAt,
        nonce: 0n,
        deadline,
      }
    ),
    deadline,
    first_charge_at: firstChargeAt,
    estimated_fee: '600000000000000',
    fee_currency: 'eth',
    chain_id: 11155111,
  };
}

export function MockSubscribeVerified(
  transactionHash: string | null,
  subscriber: string = MOCK_PAYER
): CheckoutSubscribeVerification {
  return {
    status: 'verified',
    transaction_hash: transactionHash,
    subscriber_address: subscriber,
    subscription_onchain_id: MOCK_SUBSCRIPTION_ID,
  };
}

type ReceiptArgs = [string, PayoutTransactionExpectation];

export function CreateMockSettlement(): jest.Mocked<Settlement> {
  return {
    Describe: jest.fn().mockReturnValue({
      rail: 'onchain',
      network: 'ethereum',
      chain_id: 11155111,
      native_currency: 'eth',
      token_address: MOCK_USDC,
    }),
    ExplorerUrl: jest.fn(
      (type: 'tx' | 'address', value: string) =>
        `https://sepolia.etherscan.io/${type}/${value}`
    ),
    CheckWalletExists: jest.fn().mockResolvedValue(true),
    GetNativeBalance: jest.fn().mockResolvedValue(1),
    GetUSDCBalance: jest.fn().mockResolvedValue(100),
    GetLatestBlockNumber: jest.fn().mockResolvedValue(MOCK_LATEST_BLOCK),
    GetIncomingDeposits: jest.fn().mockResolvedValue([]),
    BuildBatchPayoutTransaction: jest.fn(
      async (
        _sender: string,
        recipients: TransferRecipient[],
        options?: PayoutBuildOptions
      ) => MockPayoutBatch('payout', recipients.length, options)
    ),
    BuildApprovalTransaction: jest.fn(
      async (_sender: string, options?: PayoutBuildOptions) =>
        MockPayoutBatch('approval', 0, options)
    ),
    GetTransactionHash: jest.fn(MockTransactionHash),
    MatchPayoutTransaction: jest.fn(
      async (
        signedOrHash: string,
        expected: PayoutTransactionExpectation
      ): Promise<PayoutTransactionMatch> => ({
        status: 'match',
        transactionHash: MockTransactionHash(signedOrHash),
        nonce: expected.nonce,
      })
    ),
    BroadcastSignedTransaction: jest.fn<Promise<BroadcastResult>, ReceiptArgs>(
      async (signedOrHash) =>
        MockReceipt('paid', MockTransactionHash(signedOrHash))
    ),
    WaitForReceipt: jest.fn<Promise<BroadcastResult>, ReceiptArgs>(
      async (hash) => MockReceipt('paid', hash)
    ),
    GetConfirmedBlock: jest.fn().mockResolvedValue({
      number: MOCK_CONFIRMED_BLOCK,
      timestamp: MOCK_CONFIRMED_TIME,
    }),
    WaitsForExpiry: jest.fn().mockReturnValue(true),
    GetTransactionStatus: jest.fn<
      Promise<BroadcastResult>,
      [string, PayoutTransactionExpectation, number]
    >(async (hash) => MockReceipt('pending', hash)),
    IsBatchPaid: jest.fn().mockResolvedValue(false),
    FindBatchPayment: jest.fn().mockResolvedValue(null),
    GetAccountNonce: jest.fn().mockResolvedValue(MOCK_PAYOUT_NONCE),
    IsBlacklisted: jest.fn().mockResolvedValue([]),
    BuildCheckoutPaymentAuthorization: jest.fn(
      async (
        payer: string,
        merchant: string,
        amountCents: number,
        sessionId: string,
        expiresAt: number
      ): Promise<PreparedAuthorization> => {
        const authorization = BuildTransferAuthorization({
          payer,
          merchant,
          amountCents,
          sessionId,
          expiresAt,
        });
        return {
          method: 'eip3009_transfer',
          typed_data: BuildTransferAuthorizationTypedData(
            MOCK_USDC_DOMAIN,
            authorization
          ),
          authorization,
          estimated_fee: '300000000000000',
          fee_currency: 'eth',
          chain_id: 11155111,
        };
      }
    ),
    // Records the relay before "sending" it, as the Ethereum rail does.
    RelayCheckoutAuthorization: jest.fn(
      async (
        _authorization: CheckoutTransferAuthorization,
        _signature: string,
        options: RelayCheckoutOptions
      ): Promise<string | null> => {
        if (options.pendingHash) return options.pendingHash;
        await options.onSigned(MOCK_RELAY_HASH);
        return MOCK_RELAY_HASH;
      }
    ),
    VerifyCheckoutPayment: jest.fn<
      Promise<CheckoutPaymentVerification>,
      Parameters<Settlement['VerifyCheckoutPayment']>
    >(async (transactionHash) => ({
      status: 'verified',
      transaction_hash: transactionHash,
      amount_cents: 1000,
      payer_address: MOCK_PAYER,
    })),
    GetPlanOwnerAddress: jest.fn().mockReturnValue(MOCK_PLAN_OWNER),
    CreateSubscriptionPlan: jest.fn().mockResolvedValue(MOCK_PLAN_KEY),
    BuildSubscribeAuthorization: jest.fn(
      async (subscriber: string, planKey: string, expiresAt: number) =>
        MockPreparedSubscribe(subscriber, planKey, expiresAt)
    ),
    // Records the relay before "sending" it, as the Ethereum rail does.
    RelaySubscribe: jest.fn(
      async (
        _relay: SubscribeRelay,
        options: RelaySubscribeOptions
      ): Promise<string | null> => {
        if (options.pendingHash) return options.pendingHash;
        await options.onSigned(MOCK_SUBSCRIBE_HASH);
        return MOCK_SUBSCRIBE_HASH;
      }
    ),
    FindExistingSubscription: jest.fn().mockResolvedValue(null),
    VerifySubscribeTransaction: jest.fn<
      Promise<CheckoutSubscribeVerification>,
      Parameters<Settlement['VerifySubscribeTransaction']>
    >(async (transactionHash) => MockSubscribeVerified(transactionHash)),
    // Active, with no on-chain schedule unless a test sets one.
    GetSubscriptionState: jest.fn<
      Promise<OnchainSubscriptionState>,
      Parameters<Settlement['GetSubscriptionState']>
    >(async () => ({
      status: 'active',
      next_charge_at: null,
      period_seconds: null,
      chain_time: null,
    })),
    // Records the charge before "sending" it, as the Ethereum rail does.
    CollectSubscriptionPayment: jest.fn<
      Promise<SubscriptionCollection>,
      Parameters<Settlement['CollectSubscriptionPayment']>
    >(async (params) => {
      await params.onSigned(MOCK_CHARGE_HASH, { nonce: MOCK_CHARGE_NONCE });
      return {
        status: 'collected',
        transaction_hash: MOCK_CHARGE_HASH,
        next_charge_at: null,
      };
    }),
    ReconcileSubscriptionCharge: jest.fn<
      Promise<ChargeReconciliation>,
      Parameters<Settlement['ReconcileSubscriptionCharge']>
    >(async (transactionHashes) => ({
      status: 'paid',
      transaction_hash: transactionHashes[transactionHashes.length - 1],
      next_charge_at: null,
    })),
    FindSubscriptionCharge: jest.fn().mockResolvedValue(null),
    CancelSubscription: jest.fn(
      async (
        _subscriptionOnchainId: string,
        options: { onSigned(hash: string): Promise<void> }
      ) => {
        await options.onSigned(MOCK_CANCEL_HASH);
        return MOCK_CANCEL_HASH;
      }
    ),
  };
}
