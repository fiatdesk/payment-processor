import { TestBed } from '@angular/core/testing';

import {
  CheckoutSessionService,
  ReadConfirmRetry,
} from './checkout-session.service';

const SIGNATURE = `0x${'ab'.repeat(65)}`;
const HASH = `0x${'cd'.repeat(32)}`;

/** A fetch response as `ApiService` reads it. */
function JsonResponse(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    statusText: status === 409 ? 'Conflict' : 'OK',
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('CheckoutSessionService', () => {
  let service: CheckoutSessionService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
    service = TestBed.inject(CheckoutSessionService);
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  describe('ConfirmPayment', () => {
    it('posts the signature to the public confirm endpoint', async () => {
      fetchMock.mockResolvedValue(
        JsonResponse(200, { id: 'cs_test', status: 'complete' })
      );

      await expect(
        service.ConfirmPayment('test-session', { signature: SIGNATURE })
      ).resolves.toEqual({ id: 'cs_test', status: 'complete' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/v1/payment_pages/test-session/confirm');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ signature: SIGNATURE });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('waits out the server long-poll before timing out', async () => {
      jest.useFakeTimers();
      let signal: AbortSignal | undefined;
      fetchMock.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            signal = init.signal ?? undefined;
            signal?.addEventListener('abort', () =>
              reject(
                Object.assign(new Error('aborted'), { name: 'AbortError' })
              )
            );
          })
      );

      const confirming = service
        .ConfirmPayment('test-session', { signature: SIGNATURE })
        .catch((error: Error) => error);
      // The API waits up to CHECKOUT_CONFIRM_TIMEOUT_MS (90 s by default).
      await jest.advanceTimersByTimeAsync(119_999);
      expect(signal?.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);

      expect(signal?.aborted).toBe(true);
      const error = await confirming;
      expect(error).toBeInstanceOf(Error);
      expect(ReadConfirmRetry(error)).toEqual({
        reason: 'unreachable',
        transactionHash: null,
        anotherConfirmation: false,
      });
    });

    it('surfaces the code and transaction hash of a 409', async () => {
      fetchMock.mockResolvedValue(
        JsonResponse(409, {
          error: {
            code: 'payment_pending',
            transaction_hash: HASH,
            message: 'The payment is waiting for network confirmations.',
            type: 'payment_pending',
          },
        })
      );

      const error = await service
        .ConfirmPayment('test-session', { signature: SIGNATURE })
        .catch((e: Error) => e);

      expect((error as Error).message).toBe(
        'The payment is waiting for network confirmations.'
      );
      expect(ReadConfirmRetry(error)).toEqual({
        reason: 'payment_pending',
        transactionHash: HASH,
        anotherConfirmation: false,
      });
    });
  });

  describe('ReadConfirmRetry', () => {
    function ApiFailure(
      status: number | undefined,
      details: Record<string, unknown> = {}
    ): Error {
      return Object.assign(new Error('failed'), {
        status,
        type: details['type'],
        details,
      });
    }

    it('reads payment_pending with or without a hash', () => {
      expect(
        ReadConfirmRetry(
          ApiFailure(409, { type: 'payment_pending', transaction_hash: null })
        )
      ).toEqual({
        reason: 'payment_pending',
        transactionHash: null,
        anotherConfirmation: false,
      });
    });

    it('reads a pending payment another confirm is recording', () => {
      expect(
        ReadConfirmRetry(
          ApiFailure(409, {
            type: 'payment_pending',
            transaction_hash: HASH,
            reason: 'another_confirmation',
          })
        )
      ).toEqual({
        reason: 'payment_pending',
        transactionHash: HASH,
        anotherConfirmation: true,
      });
    });

    it('reads payment_resubmit_required', () => {
      expect(
        ReadConfirmRetry(
          ApiFailure(409, {
            type: 'payment_resubmit_required',
            transaction_hash: HASH,
          })
        )
      ).toEqual({
        reason: 'payment_resubmit_required',
        transactionHash: HASH,
        anotherConfirmation: false,
      });
    });

    it.each([
      ['a network error', new TypeError('Failed to fetch')],
      ['a gateway 502', ApiFailure(502)],
      ['a gateway 503', ApiFailure(503)],
      ['a gateway 504', ApiFailure(504)],
      ["the API's own 502", ApiFailure(502, { type: 'blockchain_error' })],
    ])('treats %s as unreachable', (_label, error) => {
      expect(ReadConfirmRetry(error)).toEqual({
        reason: 'unreachable',
        transactionHash: null,
        anotherConfirmation: false,
      });
    });

    it('does not retry other API errors', () => {
      expect(
        ReadConfirmRetry(ApiFailure(400, { type: 'invalid_request_error' }))
      ).toBeNull();
      expect(
        ReadConfirmRetry(ApiFailure(500, { type: 'api_error' }))
      ).toBeNull();
      expect(ReadConfirmRetry('not an error')).toBeNull();
    });
  });
});
