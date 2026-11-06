import { signal } from '@angular/core';
import {
  CheckoutSession,
  CrossChainPaymentStatus,
} from '@fiatdesk/shared-types';

import {
  CROSS_CHAIN_POLL_INTERVAL_MS,
  CROSS_CHAIN_POLL_TIMEOUT_MS,
  CrossChainFailedError,
  CrossChainPoller,
  CrossChainTimeoutError,
  DeadlineSeconds,
  FormatOriginAmount,
  OriginExplorerTxUrl,
} from './checkout-cross-chain';

const SESSION = {
  id: 'cs_test_xchain',
  url_slug: 'xchain-session',
  mode: 'payment',
  status: 'open',
} as unknown as CheckoutSession;

function WithStatus(
  status: CrossChainPaymentStatus,
  sessionStatus: CheckoutSession['status'] = 'open'
): CheckoutSession {
  return {
    ...SESSION,
    status: sessionStatus,
    payment_details: { cross_chain: { status } },
  } as unknown as CheckoutSession;
}

const COMPLETED = WithStatus('SUCCESS', 'complete');

/** An error shaped like the ones `ApiService.Call` throws. */
function ApiFailure(status: number): Error {
  return Object.assign(new Error('failed'), { status, details: {} });
}

describe('CrossChainPoller', () => {
  const api = { GetCrossChainPayment: jest.fn() };
  const state = { status: signal<CrossChainPaymentStatus | null>(null) };
  let poller: CrossChainPoller;

  /** Poll until settled, letting the poll's timers run. */
  async function Settle(
    ms = CROSS_CHAIN_POLL_INTERVAL_MS
  ): Promise<CheckoutSession | Error> {
    const settling = poller
      .PollUntilSettled(SESSION)
      .catch((error: Error) => error);
    await jest.advanceTimersByTimeAsync(ms);
    return settling;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    state.status.set(null);
    api.GetCrossChainPayment.mockResolvedValue(COMPLETED);
    poller = new CrossChainPoller(api, state);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('returns the session once it completes', async () => {
    await expect(Settle(0)).resolves.toBe(COMPLETED);

    expect(api.GetCrossChainPayment).toHaveBeenCalledWith(SESSION.url_slug);
    expect(state.status()).toBe('SUCCESS');
  });

  it('writes each status while the swap runs', async () => {
    api.GetCrossChainPayment.mockResolvedValueOnce(
      WithStatus('PENDING_DEPOSIT')
    )
      .mockResolvedValueOnce(WithStatus('PROCESSING'))
      .mockResolvedValueOnce(COMPLETED);

    const settling = poller.PollUntilSettled(SESSION);
    await jest.advanceTimersByTimeAsync(0);
    expect(state.status()).toBe('PENDING_DEPOSIT');

    await jest.advanceTimersByTimeAsync(CROSS_CHAIN_POLL_INTERVAL_MS);
    expect(state.status()).toBe('PROCESSING');

    await jest.advanceTimersByTimeAsync(CROSS_CHAIN_POLL_INTERVAL_MS);
    await expect(settling).resolves.toBe(COMPLETED);
    expect(api.GetCrossChainPayment).toHaveBeenCalledTimes(3);
  });

  it.each(['REFUNDED', 'FAILED'] as const)(
    'throws when the swap is %s',
    async (status) => {
      api.GetCrossChainPayment.mockResolvedValue(WithStatus(status));

      const error = await Settle(0);

      expect(error).toBeInstanceOf(CrossChainFailedError);
      expect((error as CrossChainFailedError).status).toBe(status);
      expect(state.status()).toBe(status);
      expect(api.GetCrossChainPayment).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    ['no answer', new TypeError('Failed to fetch')],
    ['a gateway 503', ApiFailure(503)],
  ])('polls again on the next tick after %s', async (_label, error) => {
    api.GetCrossChainPayment.mockRejectedValueOnce(error);

    const settling = poller.PollUntilSettled(SESSION);
    await jest.advanceTimersByTimeAsync(0);
    expect(api.GetCrossChainPayment).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(CROSS_CHAIN_POLL_INTERVAL_MS);
    await expect(settling).resolves.toBe(COMPLETED);
    expect(api.GetCrossChainPayment).toHaveBeenCalledTimes(2);
  });

  it('throws other API errors without polling again', async () => {
    const failure = ApiFailure(404);
    api.GetCrossChainPayment.mockRejectedValue(failure);

    await expect(Settle()).resolves.toBe(failure);

    expect(api.GetCrossChainPayment).toHaveBeenCalledTimes(1);
  });

  it('stops polling once stopped', async () => {
    api.GetCrossChainPayment.mockResolvedValue(WithStatus('PENDING_DEPOSIT'));

    const settling = poller
      .PollUntilSettled(SESSION)
      .catch((error: Error) => error);
    await jest.advanceTimersByTimeAsync(0);
    poller.Stop();
    await jest.advanceTimersByTimeAsync(10 * CROSS_CHAIN_POLL_INTERVAL_MS);

    expect(await settling).toBeInstanceOf(CrossChainTimeoutError);
    expect(api.GetCrossChainPayment).toHaveBeenCalledTimes(1);
  });

  it('gives up after 30 minutes', async () => {
    api.GetCrossChainPayment.mockResolvedValue(WithStatus('PROCESSING'));

    const error = await Settle(
      CROSS_CHAIN_POLL_TIMEOUT_MS + CROSS_CHAIN_POLL_INTERVAL_MS
    );

    expect(error).toBeInstanceOf(CrossChainTimeoutError);
    expect(api.GetCrossChainPayment).toHaveBeenCalledTimes(
      CROSS_CHAIN_POLL_TIMEOUT_MS / CROSS_CHAIN_POLL_INTERVAL_MS + 1
    );
  });
});

describe('FormatOriginAmount', () => {
  it.each([
    ['1.434451061468531973266814', '1.434452 wNEAR'],
    ['2.5', '2.5 wNEAR'],
    ['5.000000', '5 wNEAR'],
    ['10', '10 wNEAR'],
    ['0.0000001', '0.000001 wNEAR'],
    ['0.9999999', '1 wNEAR'],
  ])('shows %s as %s, rounded up', (amount, expected) => {
    expect(FormatOriginAmount(amount, 'wNEAR')).toBe(expected);
  });

  it('passes through an amount it cannot read', () => {
    expect(FormatOriginAmount('n/a', 'wNEAR')).toBe('n/a wNEAR');
  });
});

describe('DeadlineSeconds', () => {
  it('counts whole seconds down to the deadline, then stays at 0', () => {
    expect(DeadlineSeconds(1_793_200_600, 1_793_200_000_500)).toBe(600);
    expect(DeadlineSeconds(1_793_200_600, 1_793_200_700_000)).toBe(0);
  });
});

describe('OriginExplorerTxUrl', () => {
  it.each([
    [
      'a NEAR transaction',
      'near',
      '9Xq3vK2mPzR7tY5wB8nC1dF4hJ6kL0sA',
      'https://nearblocks.io/txns/9Xq3vK2mPzR7tY5wB8nC1dF4hJ6kL0sA',
    ],
    ['a simulated hash', 'near', 'sim_near_tx:sim_near_deposit:abc', null],
    ['an unknown network', 'solana', '5VERv8NMvzbJMEkV8xnrLkEaWRtSz', null],
    ['no hash', 'near', null, null],
  ])('links %s', (_label, network, hash, expected) => {
    expect(OriginExplorerTxUrl(network, hash)).toBe(expected);
  });
});
