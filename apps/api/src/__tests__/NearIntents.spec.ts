import {
  NEAR_INTENTS_BASE_URL,
  NEAR_INTENTS_STATUS_VALUES,
  NearIntents,
  ORIGIN_ASSETS,
  USDC_ETHEREUM_ASSET_ID,
  type NearIntentsQuoteRequest,
} from '../modules/intents/NearIntents';
import { AppError } from '../utils/AppError';

const RECIPIENT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const DEPOSIT_ADDRESS = '0x4E2f8bA7c1D3e5F6a7B8c9D0e1F2a3B4c5D6e7F8';
const DEADLINE = '2026-11-06T11:00:00.000Z';
const ORIGIN_TX = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
const DESTINATION_TX = `0x${'cd'.repeat(32)}`;

const QUOTE_REQUEST: NearIntentsQuoteRequest = {
  dry: false,
  swapType: 'EXACT_OUTPUT',
  slippageTolerance: 100,
  originAsset: ORIGIN_ASSETS[0].assetId,
  depositType: 'ORIGIN_CHAIN',
  destinationAsset: USDC_ETHEREUM_ASSET_ID,
  amount: '2000000',
  refundTo: 'buyer.near',
  refundType: 'ORIGIN_CHAIN',
  recipient: RECIPIENT,
  recipientType: 'DESTINATION_CHAIN',
  deadline: DEADLINE,
};

const QUOTE_AMOUNTS = {
  amountIn: '612894051468531973266814',
  amountInFormatted: '0.612894051468531973266814',
  amountInUsd: '2.292223',
  minAmountIn: '606765110953846653534145',
  amountOut: '2000000',
  amountOutFormatted: '2.0',
  timeEstimate: 27,
  withdrawFee: '300000',
};

const REAL_QUOTE_RESPONSE = {
  correlationId: 'b1d0c3a2-6f4e-4c1b-9a8d-2e7f5c3b1a90',
  quote: {
    ...QUOTE_AMOUNTS,
    depositAddress: DEPOSIT_ADDRESS,
    deadline: '2026-11-06T11:00:05.000Z',
  },
  quoteRequest: QUOTE_REQUEST,
};

const DRY_QUOTE_RESPONSE = {
  correlationId: '7c2e9f14-3b8a-4d6e-a1c5-0f9b8e7d6c54',
  quote: QUOTE_AMOUNTS,
  quoteRequest: { ...QUOTE_REQUEST, dry: true },
};

const fetchMock = jest.fn();

function Respond(body: unknown, status = 200): void {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

function LastCall(): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url, init };
}

function LastHeaders(): Record<string, string> {
  return LastCall().init.headers as Record<string, string>;
}

describe('NearIntents', () => {
  const originalFetch = global.fetch;

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    expect(global.fetch).toBe(fetchMock);
  });

  describe('Quote', () => {
    it('posts the exact EXACT_OUTPUT body and returns the deposit address', async () => {
      Respond(REAL_QUOTE_RESPONSE, 201);

      const quote = await new NearIntents().Quote(QUOTE_REQUEST);

      const { url, init } = LastCall();
      expect(url).toBe(`${NEAR_INTENTS_BASE_URL}/quote`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual(QUOTE_REQUEST);
      expect(JSON.parse(init.body as string).swapType).toBe('EXACT_OUTPUT');
      expect(quote).toEqual({
        correlationId: REAL_QUOTE_RESPONSE.correlationId,
        depositAddress: DEPOSIT_ADDRESS,
        amountIn: QUOTE_AMOUNTS.amountIn,
        amountInFormatted: QUOTE_AMOUNTS.amountInFormatted,
        amountOut: '2000000',
        minAmountIn: QUOTE_AMOUNTS.minAmountIn,
        deadline: '2026-11-06T11:00:05.000Z',
        timeEstimate: 27,
      });
    });

    it('returns a null deposit address and the echoed deadline for a dry quote', async () => {
      Respond(DRY_QUOTE_RESPONSE, 201);

      const quote = await new NearIntents().Quote({
        ...QUOTE_REQUEST,
        dry: true,
      });

      expect(quote.depositAddress).toBeNull();
      expect(quote.deadline).toBe(DEADLINE);
    });

    it('rejects a real quote that has no deposit address', async () => {
      Respond(DRY_QUOTE_RESPONSE, 201);

      await expect(
        new NearIntents().Quote(QUOTE_REQUEST)
      ).rejects.toMatchObject({ statusCode: 502, type: 'api_error' });
    });
  });

  describe('X-API-Key', () => {
    it('is sent when a key is configured', async () => {
      Respond(REAL_QUOTE_RESPONSE, 201);

      await new NearIntents({ apiKey: 'nik_live_key' }).Quote(QUOTE_REQUEST);

      expect(LastHeaders()['X-API-Key']).toBe('nik_live_key');
      expect(LastHeaders()['Content-Type']).toBe('application/json');
    });

    it.each([undefined, null, '', '   '])(
      'is omitted when the key is %p',
      async (apiKey) => {
        Respond({ status: 'PENDING_DEPOSIT', swapDetails: {} });

        await new NearIntents({ apiKey }).GetStatus(DEPOSIT_ADDRESS);

        expect(LastHeaders()).not.toHaveProperty('X-API-Key');
      }
    );
  });

  describe('GetStatus', () => {
    it.each(NEAR_INTENTS_STATUS_VALUES)('parses %s', async (status) => {
      Respond({ status, swapDetails: {} });

      const result = await new NearIntents().GetStatus(DEPOSIT_ADDRESS);

      expect(result).toEqual({
        status,
        originChainTxHashes: [],
        destinationChainTxHashes: [],
        amountOut: undefined,
      });
      expect(LastCall().url).toBe(
        `${NEAR_INTENTS_BASE_URL}/status?depositAddress=${DEPOSIT_ADDRESS}`
      );
      expect(LastCall().init.method).toBe('GET');
    });

    it('reads hashes and amountOut from nested swapDetails', async () => {
      Respond({
        correlationId: '0d4c6b2a-9e8f-4a7b-8c6d-5e4f3a2b1c0d',
        status: 'SUCCESS',
        updatedAt: '2026-11-06T10:58:41.000Z',
        swapDetails: {
          intentHashes: ['intent_hash'],
          nearTxHashes: ['near_tx'],
          amountOut: '2000000',
          originChainTxHashes: [
            { hash: ORIGIN_TX, explorerUrl: 'https://nearblocks.io/txns/x' },
          ],
          destinationChainTxHashes: [
            { hash: DESTINATION_TX, explorerUrl: 'https://etherscan.io/tx/x' },
          ],
        },
      });

      const result = await new NearIntents().GetStatus(DEPOSIT_ADDRESS);

      expect(result).toEqual({
        status: 'SUCCESS',
        originChainTxHashes: [{ hash: ORIGIN_TX }],
        destinationChainTxHashes: [{ hash: DESTINATION_TX }],
        amountOut: '2000000',
      });
    });

    it('reads top-level hashes when swapDetails is absent', async () => {
      Respond({
        status: 'PROCESSING',
        originChainTxHashes: [{ hash: ORIGIN_TX }],
        destinationChainTxHashes: [],
      });

      const result = await new NearIntents().GetStatus(DEPOSIT_ADDRESS);

      expect(result.originChainTxHashes).toEqual([{ hash: ORIGIN_TX }]);
    });

    it('rejects an unknown status', async () => {
      Respond({ status: 'EXPIRED', swapDetails: {} });

      await expect(
        new NearIntents().GetStatus(DEPOSIT_ADDRESS)
      ).rejects.toMatchObject({ statusCode: 502 });
    });
  });

  describe('errors', () => {
    it.each([
      [400, { message: 'recipient is not valid' }],
      [404, { message: 'Deposit address not found' }],
      [500, { message: 'Internal server error' }],
      [503, { message: 'Service unavailable' }],
    ])('maps HTTP %i to a 502 AppError', async (status, body) => {
      Respond(body, status);

      const error = await new NearIntents()
        .GetStatus(DEPOSIT_ADDRESS)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        statusCode: 502,
        type: 'api_error',
        message: `NEAR Intents /status failed: ${status} ${JSON.stringify(
          body
        )}`,
      });
    });

    it('maps a network failure to a 502 AppError', async () => {
      fetchMock.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'));

      await expect(new NearIntents().GetTokens()).rejects.toMatchObject({
        statusCode: 502,
        message: 'NEAR Intents /tokens failed: getaddrinfo ENOTFOUND',
      });
    });
  });

  describe('GetTokens', () => {
    it('lists tokens without an API key', async () => {
      Respond([
        {
          assetId: USDC_ETHEREUM_ASSET_ID,
          decimals: 6,
          blockchain: 'eth',
          symbol: 'USDC',
          price: 0.9998,
          priceUpdatedAt: '2026-11-06T10:30:00.000Z',
          contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          coingeckoId: 'usd-coin',
        },
      ]);

      const tokens = await new NearIntents().GetTokens();

      expect(LastCall().url).toBe(`${NEAR_INTENTS_BASE_URL}/tokens`);
      expect(LastHeaders()).not.toHaveProperty('X-API-Key');
      expect(tokens).toEqual([
        {
          assetId: USDC_ETHEREUM_ASSET_ID,
          symbol: 'USDC',
          blockchain: 'eth',
          decimals: 6,
          contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          price: 0.9998,
        },
      ]);
    });
  });

  describe('SubmitDeposit', () => {
    it('posts the deposit address and tx hash', async () => {
      Respond({ status: 'KNOWN_DEPOSIT_TX', swapDetails: {} });

      await new NearIntents({
        baseUrl: 'https://intents.example.test/v0',
      }).SubmitDeposit(DEPOSIT_ADDRESS, ORIGIN_TX);

      const { url, init } = LastCall();
      expect(url).toBe('https://intents.example.test/v0/deposit/submit');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        depositAddress: DEPOSIT_ADDRESS,
        txHash: ORIGIN_TX,
      });
    });
  });
});
