/**
 * NEAR Intents 1Click API client. Buyers pay from another chain; 1Click swaps
 * the deposit and delivers USDC on Ethereum to the merchant wallet.
 *
 * 1Click (checked 2026-11-06): GET /v0/tokens and POST /v0/quote (dry) answer without an API key; GET /v0/status 404s on unknown addresses keyless (401 only on a bad key), real-address behaviour unverified.
 * Assets: USDC on Ethereum = nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near (6 dp); NEAR chain native = nep141:wrap.near (wNEAR, 24 dp), no native entry exists.
 * EXACT_OUTPUT amount is destination minor units; quote.amountIn is origin minor units, minAmountIn is ~1% lower at slippageTolerance 100.
 * Dry quotes return no depositAddress and no quote.deadline (deadline is echoed in quoteRequest); dry:false is needed for them.
 * No minimum amount found (1 minor unit quotes); a fixed withdrawFee of 300000 (0.30 USDC) and a default 20 bps appFee are applied; recipient 0x...dEaD is rejected as invalid.
 *
 * @see https://docs.near-intents.org
 *
 * @module NearIntents
 */

import { AppError } from '../../utils/AppError';

export const NEAR_INTENTS_BASE_URL = 'https://1click.chaindefuser.com/v0';

export const USDC_ETHEREUM_ASSET_ID =
  'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near';

export interface NearIntentsOriginAsset {
  key: string;
  label: string;
  network: string;
  assetId: string;
  decimals: number;
  explorerTxUrl: string;
}

/** Assets a buyer can pay with. 1Click lists no native NEAR, so NEAR is wNEAR. */
export const ORIGIN_ASSETS: readonly NearIntentsOriginAsset[] = [
  {
    key: 'near',
    label: 'NEAR',
    network: 'near',
    assetId: 'nep141:wrap.near',
    decimals: 24,
    explorerTxUrl: 'https://nearblocks.io/txns/',
  },
];

export const NEAR_INTENTS_STATUS_VALUES = [
  'PENDING_DEPOSIT',
  'KNOWN_DEPOSIT_TX',
  'INCOMPLETE_DEPOSIT',
  'PROCESSING',
  'SUCCESS',
  'REFUNDED',
  'FAILED',
] as const;

export type NearIntentsStatusValue =
  (typeof NEAR_INTENTS_STATUS_VALUES)[number];

export interface NearIntentsToken {
  assetId: string;
  symbol: string;
  blockchain: string;
  decimals: number;
  contractAddress?: string;
  price?: number;
}

export interface NearIntentsQuoteRequest {
  dry: boolean;
  swapType: 'EXACT_OUTPUT';
  slippageTolerance: number;
  originAsset: string;
  depositType: 'ORIGIN_CHAIN';
  destinationAsset: string;
  /** Destination minor units (USDC: 6 decimals, so $2.00 is "2000000"). */
  amount: string;
  refundTo: string;
  refundType: 'ORIGIN_CHAIN';
  recipient: string;
  recipientType: 'DESTINATION_CHAIN';
  /** ISO 8601 */
  deadline: string;
}

export interface NearIntentsQuote {
  correlationId: string;
  /** Null for a dry quote; 1Click only assigns an address when `dry` is false. */
  depositAddress: string | null;
  /** Origin minor units the buyer sends. */
  amountIn: string;
  amountInFormatted: string;
  amountOut: string;
  minAmountIn?: string;
  /** `quote.deadline`, or the requested deadline when 1Click omits it (dry). */
  deadline: string;
  /** Seconds */
  timeEstimate: number;
}

export interface NearIntentsTxHash {
  hash: string;
}

export interface NearIntentsStatus {
  status: NearIntentsStatusValue;
  originChainTxHashes: NearIntentsTxHash[];
  destinationChainTxHashes: NearIntentsTxHash[];
  amountOut?: string;
}

/** Implemented by the live client and the simulated client. */
export interface NearIntentsClient {
  GetTokens(): Promise<NearIntentsToken[]>;
  Quote(request: NearIntentsQuoteRequest): Promise<NearIntentsQuote>;
  GetStatus(depositAddress: string): Promise<NearIntentsStatus>;
  SubmitDeposit(depositAddress: string, txHash: string): Promise<void>;
}

export interface NearIntentsOptions {
  baseUrl?: string;
  apiKey?: string | null;
}

interface RawTxHashes {
  originChainTxHashes?: NearIntentsTxHash[];
  destinationChainTxHashes?: NearIntentsTxHash[];
  amountOut?: string;
}

interface RawStatusResponse extends RawTxHashes {
  status?: string;
  swapDetails?: RawTxHashes;
}

interface RawQuoteResponse {
  correlationId: string;
  quote: Omit<
    NearIntentsQuote,
    'correlationId' | 'depositAddress' | 'deadline'
  > & {
    depositAddress?: string;
    deadline?: string;
  };
  quoteRequest?: { deadline?: string };
}

const ERROR_BODY_LIMIT = 300;

function ToHashes(
  hashes: NearIntentsTxHash[] | undefined
): NearIntentsTxHash[] {
  return (hashes ?? []).map(({ hash }) => ({ hash }));
}

function IsStatusValue(value: unknown): value is NearIntentsStatusValue {
  return NEAR_INTENTS_STATUS_VALUES.includes(value as NearIntentsStatusValue);
}

function ProviderError(endpoint: string, detail: string): AppError {
  return new AppError(
    `NEAR Intents ${endpoint} failed: ${detail}`,
    502,
    'api_error'
  );
}

export class NearIntents implements NearIntentsClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;

  constructor(options: NearIntentsOptions = {}) {
    this.baseUrl = options.baseUrl ?? NEAR_INTENTS_BASE_URL;
    this.apiKey = options.apiKey?.trim() || null;
  }

  async GetTokens(): Promise<NearIntentsToken[]> {
    const tokens = await this.Request<NearIntentsToken[]>('/tokens');
    return tokens.map(
      ({ assetId, symbol, blockchain, decimals, contractAddress, price }) => ({
        assetId,
        symbol,
        blockchain,
        decimals,
        contractAddress,
        price,
      })
    );
  }

  async Quote(request: NearIntentsQuoteRequest): Promise<NearIntentsQuote> {
    const { correlationId, quote, quoteRequest } =
      await this.Request<RawQuoteResponse>('/quote', request);
    const depositAddress = quote.depositAddress ?? null;
    if (!request.dry && !depositAddress) {
      throw ProviderError('/quote', 'response has no depositAddress');
    }
    return {
      correlationId,
      depositAddress,
      amountIn: quote.amountIn,
      amountInFormatted: quote.amountInFormatted,
      amountOut: quote.amountOut,
      minAmountIn: quote.minAmountIn,
      deadline: quote.deadline ?? quoteRequest?.deadline ?? request.deadline,
      timeEstimate: quote.timeEstimate,
    };
  }

  async GetStatus(depositAddress: string): Promise<NearIntentsStatus> {
    const response = await this.Request<RawStatusResponse>(
      `/status?depositAddress=${encodeURIComponent(depositAddress)}`
    );
    if (!IsStatusValue(response.status)) {
      throw ProviderError(
        '/status',
        `unknown status ${String(response.status)}`
      );
    }
    const details = response.swapDetails ?? response;
    return {
      status: response.status,
      originChainTxHashes: ToHashes(details.originChainTxHashes),
      destinationChainTxHashes: ToHashes(details.destinationChainTxHashes),
      amountOut: details.amountOut ?? response.amountOut,
    };
  }

  async SubmitDeposit(depositAddress: string, txHash: string): Promise<void> {
    await this.Request('/deposit/submit', { depositAddress, txHash });
  }

  private async Request<T>(path: string, body?: unknown): Promise<T> {
    const endpoint = path.split('?')[0];
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers['X-API-Key'] = this.apiKey;

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch((error: Error) => {
      throw ProviderError(endpoint, error.message);
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw ProviderError(
        endpoint,
        `${response.status} ${text.slice(0, ERROR_BODY_LIMIT)}`.trim()
      );
    }
    return (await response.json()) as T;
  }
}
