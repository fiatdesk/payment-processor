import type { NearIntentsQuoteRequest } from './NearIntents';
import {
  ResetSimulatedNearIntentsForTests,
  SimulatedNearIntents,
} from './SimulatedNearIntents';
import { GetNearIntents, IsNearIntentsSimulated } from './index';

const RECIPIENT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

const REQUEST: NearIntentsQuoteRequest = {
  dry: false,
  swapType: 'EXACT_OUTPUT',
  slippageTolerance: 100,
  originAsset: 'nep141:wrap.near',
  depositType: 'ORIGIN_CHAIN',
  destinationAsset:
    'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near',
  amount: '5000000',
  refundTo: 'buyer.near',
  refundType: 'ORIGIN_CHAIN',
  recipient: RECIPIENT,
  recipientType: 'DESTINATION_CHAIN',
  deadline: '2026-11-06T12:00:00.000Z',
};

describe('SimulatedNearIntents', () => {
  const client = new SimulatedNearIntents();

  beforeEach(() => ResetSimulatedNearIntentsForTests());

  it('quotes at 1 NEAR = 2.5 USD', async () => {
    const quote = await client.Quote(REQUEST);

    expect(quote.depositAddress).toBe(`sim_near_deposit:${RECIPIENT}:5000000`);
    expect(quote.amountIn).toBe('2000000000000000000000000');
    expect(quote.amountInFormatted).toBe('2');
    expect(quote.amountOut).toBe('5000000');
    expect(quote.deadline).toBe(REQUEST.deadline);
  });

  it('gives a dry quote no deposit address', async () => {
    const quote = await client.Quote({ ...REQUEST, dry: true });

    expect(quote.depositAddress).toBeNull();
  });

  it('stays pending until the deposit is submitted', async () => {
    const { depositAddress } = await client.Quote(REQUEST);

    expect((await client.GetStatus(depositAddress as string)).status).toBe(
      'PENDING_DEPOSIT'
    );

    await client.SubmitDeposit(depositAddress as string);

    expect(await client.GetStatus(depositAddress as string)).toEqual({
      status: 'SUCCESS',
      originChainTxHashes: [{ hash: `sim_near_tx:${depositAddress}` }],
      destinationChainTxHashes: [{ hash: `sim_eth_tx:${depositAddress}` }],
    });
  });
});

describe('GetNearIntents', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns the simulated client in test mode', () => {
    delete process.env.NEAR_INTENTS_MODE;
    delete process.env.SETTLEMENT_RAIL;
    delete process.env.LIVEMODE;

    expect(IsNearIntentsSimulated()).toBe(true);
    expect(GetNearIntents()).toBeInstanceOf(SimulatedNearIntents);
  });

  it('throws when cross-chain is off', () => {
    process.env.NEAR_INTENTS_MODE = 'off';

    expect(() => GetNearIntents()).toThrow(
      'Cross-chain payments are not enabled'
    );
  });
});
