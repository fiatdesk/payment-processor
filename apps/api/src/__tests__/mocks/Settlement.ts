// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Jest double for the `Settlement` interface, with resolved defaults that
 * stand in for the on-chain rail.
 */

import type { Settlement } from '../../modules/chains/Settlement';
import type { UnsignedTransaction } from '../../modules/chains/types';

function MockUnsignedTransaction(
  unsignedTransaction: string
): UnsignedTransaction {
  return {
    unsigned_transaction: unsignedTransaction,
    estimated_fee: '5000',
    fee_currency: 'sol',
    chain_id: null,
    nonce: null,
    to: null,
  };
}

export function CreateMockSettlement(): jest.Mocked<Settlement> {
  return {
    Describe: jest.fn().mockReturnValue({
      rail: 'onchain',
      network: 'solana',
      chain_id: null,
      native_currency: 'sol',
      token_address: 'UsdcMint_test',
    }),
    ExplorerUrl: jest.fn(
      (type: 'tx' | 'address', value: string) =>
        `https://explorer.solana.com/${type}/${value}?cluster=devnet`
    ),
    CheckWalletExists: jest.fn().mockResolvedValue(true),
    GetNativeBalance: jest.fn().mockResolvedValue(1),
    GetUSDCBalance: jest.fn().mockResolvedValue(100),
    GetIncomingDeposits: jest.fn().mockResolvedValue([]),
    BuildBatchPayoutTransaction: jest.fn().mockResolvedValue({
      ...MockUnsignedTransaction('base64tx'),
      recipients_count: 1,
      transaction_type: 'payout',
      batch_id: null,
    }),
    BroadcastSignedTransaction: jest.fn().mockResolvedValue({
      status: 'paid',
      transaction_hash: 'sig123',
      viewer_url: 'https://solscan.io/tx/sig123',
    }),
    BuildCheckoutPaymentTransaction: jest
      .fn()
      .mockResolvedValue(MockUnsignedTransaction('base64tx')),
    ValidateAndBroadcastCheckoutTransaction: jest.fn().mockResolvedValue({
      transaction_hash: 'checkout_sig',
    }),
    VerifyCheckoutPayment: jest.fn().mockResolvedValue({
      verified: true,
      amount_cents: 1000,
      payer_address: 'Payer111',
    }),
    GetPlanOwnerAddress: jest.fn().mockReturnValue('PlanOwner111'),
    CreateSubscriptionPlan: jest.fn().mockResolvedValue('PlanPda_test'),
    BuildSubscribeTransaction: jest
      .fn()
      .mockResolvedValue(MockUnsignedTransaction('base64subscribe')),
    FindExistingSubscription: jest.fn().mockResolvedValue(null),
    VerifySubscribeTransaction: jest.fn().mockResolvedValue({
      verified: true,
      subscriber_address: 'Payer111',
      subscription_onchain_id: 'SubPda_test',
    }),
    CollectSubscriptionPayment: jest.fn().mockResolvedValue({
      transaction_hash: 'collect_sig',
      alreadyCollected: false,
    }),
    BuildInitSubscriptionAuthorityTransaction: jest
      .fn()
      .mockResolvedValue(null),
    WaitForSubscriptionAuthority: jest.fn().mockResolvedValue(undefined),
  };
}
