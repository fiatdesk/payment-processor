// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Jest double for the `Settlement` interface, with resolved defaults that
 * stand in for the on-chain Ethereum rail (Sepolia).
 */

import type { Settlement } from '../../modules/chains/Settlement';
import type { UnsignedTransaction } from '../../modules/chains/types';

/** Anvil default accounts #0 and #1 (public test keys). */
export const MOCK_PLAN_OWNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
export const MOCK_PAYER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
export const MOCK_USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

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
    GetIncomingDeposits: jest.fn().mockResolvedValue([]),
    BuildBatchPayoutTransaction: jest.fn().mockResolvedValue({
      ...MockUnsignedTransaction('0x02unsigned'),
      recipients_count: 1,
      transaction_type: 'payout',
      batch_id: null,
    }),
    BroadcastSignedTransaction: jest.fn().mockResolvedValue({
      status: 'paid',
      transaction_hash: 'sig123',
      viewer_url: 'https://sepolia.etherscan.io/tx/sig123',
    }),
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
