// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Jest double for the `Settlement` interface, with resolved defaults that
 * stand in for the on-chain Ethereum rail (Sepolia).
 */

import type { Settlement } from '../../modules/chains/Settlement';
import type {
  BroadcastResult,
  PayoutBuildOptions,
  PayoutTransactionExpectation,
  PayoutTransactionMatch,
  TransferRecipient,
  UnsignedPayoutBatch,
  UnsignedTransaction,
} from '../../modules/chains/types';

/** Anvil default accounts #0 and #1 (public test keys). */
export const MOCK_PLAN_OWNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
export const MOCK_PAYER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
export const MOCK_USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
export const MOCK_PAYOUT_BATCH = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
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
  return /^0x[0-9a-fA-F]{64}$/.test(signedOrHash)
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

function MockUnsignedTransaction(
  unsignedTransaction: string
): UnsignedTransaction {
  return {
    unsigned_transaction: unsignedTransaction,
    estimated_fee: '5000',
    fee_currency: 'eth',
    chain_id: 11155111,
    nonce: null,
    to: null,
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
    BuildCheckoutPaymentTransaction: jest
      .fn()
      .mockResolvedValue(MockUnsignedTransaction('0x02unsigned')),
    ValidateAndBroadcastCheckoutTransaction: jest.fn().mockResolvedValue({
      transaction_hash: 'checkout_sig',
    }),
    VerifyCheckoutPayment: jest.fn().mockResolvedValue({
      verified: true,
      amount_cents: 1000,
      payer_address: MOCK_PAYER,
    }),
    GetPlanOwnerAddress: jest.fn().mockReturnValue(MOCK_PLAN_OWNER),
    CreateSubscriptionPlan: jest.fn().mockResolvedValue('plan_onchain_test'),
    BuildSubscribeTransaction: jest
      .fn()
      .mockResolvedValue(MockUnsignedTransaction('0x02subscribe')),
    FindExistingSubscription: jest.fn().mockResolvedValue(null),
    VerifySubscribeTransaction: jest.fn().mockResolvedValue({
      verified: true,
      subscriber_address: MOCK_PAYER,
      subscription_onchain_id: 'sub_onchain_test',
    }),
    CollectSubscriptionPayment: jest.fn().mockResolvedValue({
      transaction_hash: 'collect_sig',
      alreadyCollected: false,
    }),
  };
}
