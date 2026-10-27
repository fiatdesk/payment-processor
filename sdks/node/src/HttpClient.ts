import { BRAND } from '@fiatdesk/shared-types';

export interface HttpClientConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: object;
  query?: Record<
    string,
    string | number | undefined | boolean | string[] | object
  >;
  headers?: Record<string, string>;
  /** Idempotency key for POST requests to prevent duplicate operations */
  idempotencyKey?: string;
  /** Connected account ID to act on behalf of (for platform operations) */
  fiatdeskAccount?: string;
  /** Milliseconds before this request is aborted (default: the client timeout) */
  timeout?: number;
}

/**
 * Extra options that can be passed to API requests.
 */
export interface RequestExtraOptions {
  /** Additional headers to include in the request */
  headers?: Record<string, string>;
  /** Idempotency key for POST requests to prevent duplicate operations */
  idempotencyKey?: string;
  /** Connected account ID to act on behalf of (for platform operations) */
  fiatdeskAccount?: string;
  /**
   * Milliseconds before this request is aborted. Defaults to the client's
   * `timeout`; payout broadcasts wait at least 90 s (150 s for a hash).
   */
  timeout?: number;
}

export interface FiatDeskError {
  type: string;
  message: string;
  code?: string;
  param?: string;
  statusCode: number;
}

export class FiatDeskApiError extends Error {
  readonly type: string;
  readonly code?: string;
  readonly param?: string;
  readonly statusCode: number;

  constructor(error: FiatDeskError) {
    super(error.message);
    this.name = 'FiatDeskApiError';
    this.type = error.type;
    this.code = error.code;
    this.param = error.param;
    this.statusCode = error.statusCode;
  }
}

/** Codes the payout build and broadcast endpoints return for 400 and 409s. */
export const PAYOUT_BATCH_ERROR_CODES = [
  /** Another batch holds the wallet's nonce lock: let it settle, or build with `replace: true` */
  'payout_batch_in_progress',
  /** A batch whose transaction may still be mined holds these payouts; reconcile first */
  'payout_batch_in_flight',
  /** The chain shows this payout set paid already; reconcile instead */
  'payout_batch_already_paid',
  /** The transaction or payout ids differ from the built batch */
  'payout_batch_mismatch',
  /** The reported hash is not visible yet; it is kept, so reconcile later */
  'transaction_not_found',
  /** A wallet broadcast the batch; speed it up in the wallet instead */
  'use_wallet_speed_up',
  /**
   * Set by the SDK, not the API: broadcast got no answer in time (statusCode
   * 0). The transaction may still be mined; reconcile later, never re-sign.
   */
  'broadcast_timeout',
  'account_frozen',
  'sanctioned_address',
  'insufficient_funds',
  'blockchain_error',
] as const;

export type PayoutBatchErrorCode = (typeof PAYOUT_BATCH_ERROR_CODES)[number];

/**
 * A payout batch error from the API, with its code in `code`. The API sends
 * these codes as the error `type`, which is kept as well.
 */
export class FiatDeskPayoutBatchError extends FiatDeskApiError {
  declare readonly code: PayoutBatchErrorCode;

  constructor(error: FiatDeskError & { code: PayoutBatchErrorCode }) {
    super(error);
    this.name = 'FiatDeskPayoutBatchError';
  }

  /** The typed form of `error` when it carries a payout batch code. */
  static From(error: unknown): unknown {
    if (!(error instanceof FiatDeskApiError)) return error;
    const code = [error.code, error.type].find(IsPayoutBatchErrorCode);
    if (!code) return error;
    return new FiatDeskPayoutBatchError({
      type: error.type,
      message: error.message,
      code,
      param: error.param,
      statusCode: error.statusCode,
    });
  }
}

function IsPayoutBatchErrorCode(
  value: string | undefined
): value is PayoutBatchErrorCode {
  return (PAYOUT_BATCH_ERROR_CODES as readonly string[]).includes(value ?? '');
}

/**
 * HTTP client for making requests to the FiatDesk API.
 * Uses native fetch API (Node 18+).
 */
export class HttpClient {
  private readonly config: Required<HttpClientConfig>;

  constructor(config: HttpClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout ?? 30000,
    };
  }

  /**
   * Makes a request to the FiatDesk API.
   */
  /** Default request timeout in milliseconds. */
  GetTimeout(): number {
    return this.config.timeout;
  }

  async Request<T>(options: RequestOptions): Promise<T> {
    const url = this.BuildUrl(options.path, options.query);

    const headers: Record<string, string> = {
      'x-api-key': this.config.apiKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add idempotency key for POST requests
    if (options.idempotencyKey) {
      headers['idempotency-key'] = options.idempotencyKey;
    }

    // Add connected account header for platform operations
    if (options.fiatdeskAccount) {
      headers[BRAND.connectedAccountHeader] = options.fiatdeskAccount;
    }

    const fetchOptions: RequestInit = {
      method: options.method,
      headers,
      signal: AbortSignal.timeout(options.timeout ?? this.config.timeout),
    };

    if (options.body && options.method !== 'GET') {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);

    // Handle non-JSON responses gracefully
    let data: Record<string, unknown>;
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new FiatDeskApiError({
        type: 'api_error',
        message: `Invalid response from API: ${response.status} ${response.statusText}`,
        statusCode: response.status,
      });
    }

    if (!response.ok) {
      const errorData = data['error'] as Record<string, unknown> | undefined;
      throw new FiatDeskApiError({
        type: (errorData?.['type'] as string) || 'api_error',
        message:
          (errorData?.['message'] as string) ||
          (data['message'] as string) ||
          'An error occurred',
        code: errorData?.['code'] as string | undefined,
        param: errorData?.['param'] as string | undefined,
        statusCode: response.status,
      });
    }

    return data as T;
  }

  /**
   * Makes a GET request.
   */
  async Get<T>(
    path: string,
    query?: Record<
      string,
      string | number | undefined | boolean | string[] | object
    >,
    options?: RequestExtraOptions
  ): Promise<T> {
    return this.Request<T>({
      method: 'GET',
      path,
      query,
      headers: options?.headers,
      fiatdeskAccount: options?.fiatdeskAccount,
      timeout: options?.timeout,
    });
  }

  /**
   * Makes a POST request.
   */
  async Post<T>(
    path: string,
    body?: object,
    options?: RequestExtraOptions
  ): Promise<T> {
    return this.Request<T>({
      method: 'POST',
      path,
      body,
      headers: options?.headers,
      idempotencyKey: options?.idempotencyKey,
      fiatdeskAccount: options?.fiatdeskAccount,
      timeout: options?.timeout,
    });
  }

  /**
   * Makes a DELETE request.
   */
  async Delete<T>(
    path: string,
    body?: object,
    options?: RequestExtraOptions
  ): Promise<T> {
    return this.Request<T>({
      method: 'DELETE',
      path,
      body,
      headers: options?.headers,
      fiatdeskAccount: options?.fiatdeskAccount,
      timeout: options?.timeout,
    });
  }

  /**
   * Builds the full URL with query parameters.
   */
  private BuildUrl(
    path: string,
    query?: Record<
      string,
      string | number | undefined | boolean | string[] | object
    >
  ): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    const url = new URL(`${baseUrl}/v1${path}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }
}
