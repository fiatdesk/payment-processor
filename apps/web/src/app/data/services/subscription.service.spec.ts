import { TestBed } from '@angular/core/testing';

import { ApiService, type ApiError } from '../../core';
import {
  ONCHAIN_PLAN_AMOUNT_EXCEEDED_MESSAGE,
  SubscriptionService,
} from './subscription.service';

/** An error shaped like the ones `ApiService.Call` throws. */
function ApiFailure(status: number, body: Record<string, unknown>): ApiError {
  return Object.assign(new Error(String(body['message'])), {
    status,
    type: body['type'] as string,
    details: body,
  });
}

const AMOUNT_EXCEEDED = ApiFailure(400, {
  code: 'onchain_plan_amount_exceeded',
  type: 'invalid_request_error',
  message:
    'An on-chain subscription bills exactly one price at quantity 1: its plan cannot collect more per period',
});

describe('SubscriptionService', () => {
  const api = { Call: jest.fn() };
  let service: SubscriptionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: api }],
    });
    service = TestBed.inject(SubscriptionService);
  });

  afterEach(() => jest.resetAllMocks());

  it.each([
    [
      'an update',
      () =>
        service.UpdateSubscription('sub_fd_1', {
          items: [{ id: 'si_fd_1', quantity: 2 }],
        }),
    ],
    [
      'a create',
      () =>
        service.CreateSubscription({
          customer: 'cus_fd_1',
          items: [{ price: 'price_fd_1', quantity: 2 }],
        }),
    ],
  ])(
    'explains an amount an on-chain plan cannot collect on %s, in fixed words',
    async (_label, send) => {
      api.Call.mockRejectedValue(AMOUNT_EXCEEDED);

      const error = (await send().catch((failure) => failure)) as ApiError;

      expect(error.message).toBe(ONCHAIN_PLAN_AMOUNT_EXCEEDED_MESSAGE);
      expect(error.status).toBe(400);
      expect(error.details?.['code']).toBe('onchain_plan_amount_exceeded');
      expect(service.loading()).toBe(false);
    }
  );

  it('leaves other errors as the API sent them', async () => {
    const failure = ApiFailure(400, {
      type: 'invalid_request_error',
      message: 'No such price: price_fd_9',
    });
    api.Call.mockRejectedValue(failure);

    await expect(
      service.UpdateSubscription('sub_fd_1', { metadata: {} })
    ).rejects.toBe(failure);
  });
});
