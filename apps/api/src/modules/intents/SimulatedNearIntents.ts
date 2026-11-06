/**
 * Simulated NEAR Intents client for test mode: fixed rate, no network, and a
 * deposit that settles as soon as SubmitDeposit is called for its address.
 *
 * @module SimulatedNearIntents
 */

import { randomUUID } from 'crypto';

import type {
  NearIntentsClient,
  NearIntentsQuote,
  NearIntentsQuoteRequest,
  NearIntentsStatus,
} from './NearIntents';

const NEAR_DECIMALS = 24;
/** 1 NEAR = 2.5 USD: one USDC minor unit (1e-6 USD) is 4e17 yoctoNEAR (1e-24 NEAR). */
const YOCTO_PER_USDC_MINOR = 4n * 10n ** 17n;

const submittedDeposits = new Set<string>();

function FormatNear(yocto: bigint): string {
  const unit = 10n ** BigInt(NEAR_DECIMALS);
  const fraction = (yocto % unit)
    .toString()
    .padStart(NEAR_DECIMALS, '0')
    .replace(/0+$/, '');
  return fraction ? `${yocto / unit}.${fraction}` : `${yocto / unit}`;
}

export class SimulatedNearIntents implements NearIntentsClient {
  async Quote(request: NearIntentsQuoteRequest): Promise<NearIntentsQuote> {
    const amountIn = BigInt(request.amount) * YOCTO_PER_USDC_MINOR;
    return {
      correlationId: `sim_corr_${request.recipient}_${request.amount}`,
      depositAddress: request.dry ? null : `sim_near_deposit:${randomUUID()}`,
      amountIn: amountIn.toString(),
      amountInFormatted: FormatNear(amountIn),
      amountOut: request.amount,
      deadline: request.deadline,
      timeEstimate: 10,
    };
  }

  async GetStatus(depositAddress: string): Promise<NearIntentsStatus> {
    if (!submittedDeposits.has(depositAddress)) {
      return {
        status: 'PENDING_DEPOSIT',
        originChainTxHashes: [],
        destinationChainTxHashes: [],
      };
    }
    return {
      status: 'SUCCESS',
      originChainTxHashes: [{ hash: `sim_near_tx:${depositAddress}` }],
      destinationChainTxHashes: [{ hash: `sim_eth_tx:${depositAddress}` }],
    };
  }

  async SubmitDeposit(depositAddress: string): Promise<void> {
    submittedDeposits.add(depositAddress);
  }
}

export function ResetSimulatedNearIntentsForTests(): void {
  submittedDeposits.clear();
}
