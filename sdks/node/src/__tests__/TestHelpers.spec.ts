import { FiatDeskApiError, HttpClient } from '../HttpClient';
import { TestHelpers } from '../resources/TestHelpers';

describe('TestHelpers', () => {
  const originalFetch = global.fetch;
  const testHelpers = new TestHelpers(
    new HttpClient({
      apiKey: 'sk_test_fd_key',
      baseUrl: 'https://api.example.com',
    })
  );

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts crossChainDeposit and returns the session', async () => {
    const session = { id: 'cs_test_fd_1', object: 'checkout.session' };
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => session });
    global.fetch = fetchMock;

    const result = await testHelpers.checkout.sessions.crossChainDeposit(
      'cs_test_fd_1'
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.example.com/v1/test_helpers/checkout/sessions/cs_test_fd_1/cross_chain_deposit'
    );
    expect(init.method).toBe('POST');
    expect(result).toEqual(session);
  });

  it('throws FiatDeskApiError on a 400', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { type: 'invalid_request_error', message: 'No quote' },
      }),
    });

    await expect(
      testHelpers.checkout.sessions.crossChainDeposit('cs_test_fd_1')
    ).rejects.toBeInstanceOf(FiatDeskApiError);
  });
});
