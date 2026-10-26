import { Zoneless } from '../index';

describe('Zoneless', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('requires an API key and base URL', () => {
    expect(() => new Zoneless('', 'https://api.example.com')).toThrow(
      /API key is required/
    );
    expect(() => new Zoneless('sk_test_z_key', '')).toThrow(
      /base URL is required/
    );
  });

  it('posts a platform billing run through the shared client', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        object: 'billing.run',
        processed: 1,
        succeeded: 1,
        failed: 0,
        skipped: 0,
        errors: [],
      }),
    });
    global.fetch = fetchMock;

    const zoneless = new Zoneless('sk_test_z_key', 'https://api.example.com');
    const result = await zoneless.billing.runForPlatform({ batch_size: 10 });

    expect(result.object).toBe('billing.run');
    expect(result.processed).toBe(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/billing/run_for_platform');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ batch_size: 10 });
  });
});
