import { HttpClient, ZonelessApiError } from '../HttpClient';

describe('HttpClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends API requests under /v1 with auth and platform headers', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'acct_1', object: 'account' }),
    });
    global.fetch = fetchMock;

    const client = new HttpClient({
      apiKey: 'sk_test_z_key',
      baseUrl: 'https://api.example.com/',
    });

    await client.Post(
      '/accounts',
      { email: 'seller@example.com' },
      { idempotencyKey: 'key_1', zonelessAccount: 'acct_platform' }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/accounts');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual(
      expect.objectContaining({
        'x-api-key': 'sk_test_z_key',
        'idempotency-key': 'key_1',
        'zoneless-account': 'acct_platform',
      })
    );
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'seller@example.com',
    });
  });

  it('throws ZonelessApiError for JSON error responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          type: 'invalid_request_error',
          message: 'Email is required',
          code: 'parameter_missing',
          param: 'email',
        },
      }),
    });

    const client = new HttpClient({
      apiKey: 'sk_test_z_key',
      baseUrl: 'https://api.example.com',
    });

    await expect(client.Get('/accounts/acct_1')).rejects.toMatchObject({
      name: 'ZonelessApiError',
      type: 'invalid_request_error',
      message: 'Email is required',
      code: 'parameter_missing',
      param: 'email',
      statusCode: 400,
    });
    await expect(client.Get('/accounts/acct_1')).rejects.toBeInstanceOf(
      ZonelessApiError
    );
  });
});
