// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * The on-chain Ethereum rail (mainnet, Sepolia or Anvil). Rail description,
 * explorer links, address checks and balance reads work today; money flows
 * reject with `not_supported` until they are implemented.
 *
 * @module chains/Ethereum
 */

import {
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  type Address,
} from 'viem';
import { AppError } from '../../utils/AppError';
import { USDC_ABI } from './abi/Usdc';
import { GetChainConfig, GetPublicClient } from './Chain';
import type { Settlement } from './Settlement';
import type {
  BroadcastResult,
  CheckoutPaymentVerification,
  CheckoutSubscribeVerification,
  IncomingDeposit,
  RailDescription,
  UnsignedPayoutBatch,
  UnsignedTransaction,
} from './types';

const USDC_DECIMALS = 6;

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

  GetPlanOwnerAddress(): string {
    throw NotSupported('GetPlanOwnerAddress');
  }

  async GetIncomingDeposits(): Promise<IncomingDeposit[]> {
    throw NotSupported('GetIncomingDeposits');
  }

  async BuildBatchPayoutTransaction(): Promise<UnsignedPayoutBatch> {
    throw NotSupported('BuildBatchPayoutTransaction');
  }

  async BroadcastSignedTransaction(): Promise<BroadcastResult> {
    throw NotSupported('BroadcastSignedTransaction');
  }

  async BuildCheckoutPaymentTransaction(): Promise<UnsignedTransaction> {
    throw NotSupported('BuildCheckoutPaymentTransaction');
  }

  async ValidateAndBroadcastCheckoutTransaction(): Promise<{
    transaction_hash: string;
  }> {
    throw NotSupported('ValidateAndBroadcastCheckoutTransaction');
  }

  async VerifyCheckoutPayment(): Promise<CheckoutPaymentVerification> {
    throw NotSupported('VerifyCheckoutPayment');
  }

  async CreateSubscriptionPlan(): Promise<string> {
    throw NotSupported('CreateSubscriptionPlan');
  }

  async BuildSubscribeTransaction(): Promise<UnsignedTransaction> {
    throw NotSupported('BuildSubscribeTransaction');
  }

  async FindExistingSubscription(): Promise<string | null> {
    throw NotSupported('FindExistingSubscription');
  }

  async VerifySubscribeTransaction(): Promise<CheckoutSubscribeVerification> {
    throw NotSupported('VerifySubscribeTransaction');
  }

  async CollectSubscriptionPayment(): Promise<{
    transaction_hash: string;
    alreadyCollected: boolean;
  }> {
    throw NotSupported('CollectSubscriptionPayment');
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
