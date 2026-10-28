import { signal } from '@angular/core';
import {
  CheckoutPaymentTransaction,
  CheckoutSession,
} from '@fiatdesk/shared-types';

import {
  ALREADY_CONFIRMING_MESSAGE,
  CONFIRMING_MESSAGE,
  CheckoutErrorMessage,
  CheckoutPaymentConfirmer,
  MERCHANT_WALLET_CHANGED_MESSAGE,
  PayAcrossWalletChange,
  PaymentPhase,
  RequireAuthorizationTypedData,
  ShortAddress,
  SignatureRequiredError,
  StillConfirmingError,
} from './checkout-payment';

const SIGNATURE = `0x${'ab'.repeat(65)}`;
const HASH = `0x${'cd'.repeat(32)}`;
const PAYER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

const SESSION = {
  id: 'cs_test',
  url_slug: 'test-session',
  mode: 'payment',
  status: 'open',
} as unknown as CheckoutSession;
const COMPLETED = { ...SESSION, status: 'complete' } as CheckoutSession;

/** An error shaped like the ones `ApiService.Call` throws. */
function ApiFailure(status: number, body: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(String(body['message'] ?? 'failed')), {
    status,
    type: body['type'],
    details: body,
  });
}

function PaymentPending(
  transactionHash: string | null,
  reason?: string
): Error {
  return ApiFailure(409, {
    code: 'payment_pending',
    type: 'payment_pending',
    transaction_hash: transactionHash,
    ...(reason ? { reason } : {}),
  });
}

function ResubmitRequired(): Error {
  return ApiFailure(409, {
    code: 'payment_resubmit_required',
    type: 'payment_resubmit_required',
    transaction_hash: HASH,
  });
}

describe('CheckoutPaymentConfirmer', () => {
  const api = {
    ConfirmPayment: jest.fn(),
    GetPublicCheckoutSession: jest.fn(),
  };
  const state = {
    phase: signal<PaymentPhase>('idle'),
    notice: signal<string | null>(null),
    transactionHash: signal<string | null>(null),
  };
  let confirmer: CheckoutPaymentConfirmer;

  /** Confirm until settled, letting the poll's timers run. */
  async function Settle(
    knownTransactionHash: string | null = null,
    ms = POLL_INTERVAL_MS
  ): Promise<CheckoutSession | Error> {
    const settling = confirmer
      .ConfirmUntilSettled(SESSION, knownTransactionHash)
      .catch((error: Error) => error);
    await jest.advanceTimersByTimeAsync(ms);
    return settling;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    state.phase.set('idle');
    state.notice.set(null);
    state.transactionHash.set(null);
    api.ConfirmPayment.mockResolvedValue(COMPLETED);
    confirmer = new CheckoutPaymentConfirmer(api, state);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('confirms with the held signature, even when a hash is known', async () => {
    confirmer.Hold(SESSION, SIGNATURE);

    await expect(Settle(HASH)).resolves.toBe(COMPLETED);

    expect(api.ConfirmPayment.mock.calls).toEqual([
      [SESSION.url_slug, { signature: SIGNATURE }],
    ]);
  });

  it('follows a payment by its hash when no signature is held', async () => {
    await expect(Settle(HASH)).resolves.toBe(COMPLETED);

    expect(api.ConfirmPayment).toHaveBeenCalledWith(SESSION.url_slug, {
      transaction_hash: HASH,
    });
  });

  it('holds a signature for its own session only', () => {
    confirmer.Hold(SESSION, SIGNATURE);

    expect(confirmer.Held(SESSION)).toEqual({ signature: SIGNATURE });
    expect(
      confirmer.Held({ ...SESSION, id: 'cs_other' } as CheckoutSession)
    ).toBeNull();
  });

  it('sends held subscribe signatures on every retry and treats them as signed', async () => {
    const signed = {
      permit_signature: SIGNATURE,
      subscribe_signature: `0x${'ef'.repeat(65)}`,
      deadline: 1793106000,
    };
    confirmer.Hold(SESSION, signed);
    api.ConfirmPayment.mockRejectedValueOnce(ResubmitRequired());

    await expect(Settle()).resolves.toBe(COMPLETED);

    expect(api.ConfirmPayment.mock.calls).toEqual([
      [SESSION.url_slug, signed],
      [SESSION.url_slug, signed],
    ]);
    expect(api.GetPublicCheckoutSession).not.toHaveBeenCalled();
    expect(confirmer.CanCheckAgain(SESSION)).toBe(true);
  });

  it('shows the confirming state while the payment is pending', async () => {
    confirmer.Hold(SESSION, SIGNATURE);
    api.ConfirmPayment.mockRejectedValueOnce(PaymentPending(HASH));

    const settling = confirmer.ConfirmUntilSettled(SESSION);
    await jest.advanceTimersByTimeAsync(0);

    expect(state.phase()).toBe('confirming');
    expect(state.notice()).toBe(CONFIRMING_MESSAGE);
    expect(state.transactionHash()).toBe(HASH);
    expect(api.ConfirmPayment).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await expect(settling).resolves.toBe(COMPLETED);
    expect(api.ConfirmPayment).toHaveBeenCalledTimes(2);
  });

  it('keeps a reported hash when a later 409 has none', async () => {
    confirmer.Hold(SESSION, SIGNATURE);
    api.ConfirmPayment.mockRejectedValueOnce(PaymentPending(HASH))
      .mockRejectedValueOnce(PaymentPending(null))
      .mockResolvedValueOnce(COMPLETED);

    const settling = confirmer.ConfirmUntilSettled(SESSION);
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(api.ConfirmPayment).toHaveBeenCalledTimes(2);
    expect(state.transactionHash()).toBe(HASH);

    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await expect(settling).resolves.toBe(COMPLETED);
  });

  it('says another confirmation is at work when the API reports one', async () => {
    confirmer.Hold(SESSION, SIGNATURE);
    api.ConfirmPayment.mockRejectedValueOnce(
      PaymentPending(HASH, 'another_confirmation')
    );

    const settling = confirmer.ConfirmUntilSettled(SESSION);
    await jest.advanceTimersByTimeAsync(0);

    expect(state.notice()).toBe(ALREADY_CONFIRMING_MESSAGE);
    await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await expect(settling).resolves.toBe(COMPLETED);
  });

  it.each([
    ['no answer', new TypeError('Failed to fetch')],
    ['a gateway 502', ApiFailure(502)],
    ['a gateway 503', ApiFailure(503)],
    ['a gateway 504', ApiFailure(504)],
  ])('retries after %s with the same signature', async (_label, error) => {
    confirmer.Hold(SESSION, SIGNATURE);
    api.ConfirmPayment.mockRejectedValueOnce(error);

    await expect(Settle()).resolves.toBe(COMPLETED);

    expect(api.ConfirmPayment.mock.calls).toEqual([
      [SESSION.url_slug, { signature: SIGNATURE }],
      [SESSION.url_slug, { signature: SIGNATURE }],
    ]);
  });

  it('throws other errors without retrying', async () => {
    confirmer.Hold(SESSION, SIGNATURE);
    const failure = ApiFailure(500, { type: 'api_error' });
    api.ConfirmPayment.mockRejectedValueOnce(failure);

    await expect(Settle()).resolves.toBe(failure);

    expect(api.ConfirmPayment).toHaveBeenCalledTimes(1);
  });

  it('re-sends a held signature after payment_resubmit_required', async () => {
    // Defensive: the API answers a signature confirm by relaying again.
    confirmer.Hold(SESSION, SIGNATURE);
    api.ConfirmPayment.mockRejectedValueOnce(ResubmitRequired());

    await expect(Settle()).resolves.toBe(COMPLETED);

    expect(api.ConfirmPayment).toHaveBeenLastCalledWith(SESSION.url_slug, {
      signature: SIGNATURE,
    });
  });

  it('names the payer who must sign again when no signature is held', async () => {
    api.ConfirmPayment.mockRejectedValueOnce(ResubmitRequired());
    api.GetPublicCheckoutSession.mockResolvedValue({
      ...SESSION,
      payment_details: { transaction_hash: HASH, payer_wallet: PAYER },
    });

    const error = await Settle(HASH);

    expect(error).toBeInstanceOf(SignatureRequiredError);
    expect((error as SignatureRequiredError).payerWallet).toBe(PAYER);
    expect(api.ConfirmPayment).toHaveBeenCalledTimes(1);
  });

  it('returns the session when it completed meanwhile', async () => {
    api.ConfirmPayment.mockRejectedValueOnce(ResubmitRequired());
    api.GetPublicCheckoutSession.mockResolvedValue(COMPLETED);

    await expect(Settle(HASH)).resolves.toBe(COMPLETED);
  });

  it('reads the recorded hash from the session when none is known', async () => {
    api.GetPublicCheckoutSession.mockResolvedValue({
      ...SESSION,
      payment_details: { transaction_hash: HASH, payer_wallet: PAYER },
    });

    await expect(Settle()).resolves.toBe(COMPLETED);

    expect(api.ConfirmPayment).toHaveBeenCalledWith(SESSION.url_slug, {
      transaction_hash: HASH,
    });
  });

  it('ends when nothing is recorded any more', async () => {
    api.GetPublicCheckoutSession.mockResolvedValue({
      ...SESSION,
      payment_details: { transaction_hash: null, payer_wallet: null },
    });

    const error = await Settle();

    expect((error as Error).message).toBe(
      'The other payment for this checkout did not go through. You can pay now.'
    );
    expect(api.ConfirmPayment).not.toHaveBeenCalled();
  });

  it('stops after 5 minutes', async () => {
    confirmer.Hold(SESSION, SIGNATURE);
    api.ConfirmPayment.mockRejectedValue(PaymentPending(HASH));

    const error = await Settle(null, POLL_TIMEOUT_MS + POLL_INTERVAL_MS);

    expect(error).toBeInstanceOf(StillConfirmingError);
    expect(api.ConfirmPayment).toHaveBeenCalledTimes(
      POLL_TIMEOUT_MS / POLL_INTERVAL_MS + 1
    );
    expect(confirmer.CanCheckAgain(SESSION)).toBe(true);
  });

  it('stops polling once stopped', async () => {
    confirmer.Hold(SESSION, SIGNATURE);
    api.ConfirmPayment.mockRejectedValue(PaymentPending(HASH));

    const settling = confirmer
      .ConfirmUntilSettled(SESSION)
      .catch((error: Error) => error);
    await jest.advanceTimersByTimeAsync(0);
    confirmer.Stop();
    await jest.advanceTimersByTimeAsync(10 * POLL_INTERVAL_MS);

    expect(await settling).toBeInstanceOf(StillConfirmingError);
    expect(api.ConfirmPayment).toHaveBeenCalledTimes(1);
  });

  it('forgets the signature and the hash', () => {
    confirmer.Hold(SESSION, SIGNATURE);
    state.transactionHash.set(HASH);

    confirmer.Forget();

    expect(confirmer.Held(SESSION)).toBeNull();
    expect(state.transactionHash()).toBeNull();
    expect(confirmer.CanCheckAgain(SESSION)).toBe(false);
  });
});

describe('RequireAuthorizationTypedData', () => {
  const MERCHANT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const prepared = {
    amount_total: 1250,
    merchant_wallet_address: MERCHANT,
    method: 'eip3009_transfer',
    typed_data: {
      domain: {
        name: 'USDC',
        version: '2',
        chainId: 11155111,
        verifyingContract: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      },
      types: {},
      primaryType: 'TransferWithAuthorization',
      message: {
        from: PAYER.toLowerCase(),
        to: MERCHANT,
        value: '12500000',
        validAfter: 0,
        validBefore: 1793000000,
        nonce: `0x${'12'.repeat(32)}`,
      },
    },
  } as unknown as CheckoutPaymentTransaction;
  const OUT_OF_DATE =
    'This payment request is out of date. Reload the page and try again.';

  function With(message: Record<string, unknown>): CheckoutPaymentTransaction {
    return {
      ...prepared,
      typed_data: {
        ...prepared.typed_data,
        message: { ...prepared.typed_data?.message, ...message },
      },
    } as CheckoutPaymentTransaction;
  }

  it('returns typed data that pays this checkout, ignoring address case', () => {
    expect(RequireAuthorizationTypedData(prepared, 11155111, PAYER)).toBe(
      prepared.typed_data
    );
  });

  it('refuses a payment without an authorization to sign', () => {
    expect(() =>
      RequireAuthorizationTypedData(
        { ...prepared, method: undefined, typed_data: null },
        11155111,
        PAYER
      )
    ).toThrow(
      'This checkout cannot be paid from a wallet on this network yet.'
    );
  });

  it('refuses typed data for another chain', () => {
    expect(() => RequireAuthorizationTypedData(prepared, 1, PAYER)).toThrow(
      'The payment is for a different network than this checkout.'
    );
  });

  it.each([
    ['another payer', { from: MERCHANT }],
    ['another merchant', { to: PAYER }],
    ['another amount', { value: '12500001' }],
  ])('refuses an authorization for %s', (_label, message) => {
    expect(() =>
      RequireAuthorizationTypedData(With(message), 11155111, PAYER)
    ).toThrow(OUT_OF_DATE);
  });
});

describe('ShortAddress', () => {
  it('keeps the first 4 and last 4 hex characters', () => {
    expect(ShortAddress(PAYER)).toBe('0x3C44…93BC');
  });
});

describe('PayAcrossWalletChange', () => {
  function WalletChanged(transactionHash?: string): Error {
    return ApiFailure(409, {
      code: 'merchant_wallet_changed',
      type: 'merchant_wallet_changed',
      message: MERCHANT_WALLET_CHANGED_MESSAGE,
      ...(transactionHash ? { transaction_hash: transactionHash } : {}),
    });
  }

  it('says the wallet changed, then prepares and asks for approval again', async () => {
    const pay = jest
      .fn()
      .mockRejectedValueOnce(WalletChanged())
      .mockResolvedValueOnce(COMPLETED);
    const follow = jest.fn();
    const notify = jest.fn();

    await expect(PayAcrossWalletChange(pay, follow, notify)).resolves.toBe(
      COMPLETED
    );
    expect(pay).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(
      "The merchant's receiving wallet changed. Please approve the payment again."
    );
    expect(follow).not.toHaveBeenCalled();
  });

  it('follows a payment to the old wallet that is already on its way', async () => {
    const pay = jest.fn().mockRejectedValueOnce(WalletChanged(HASH));
    const follow = jest.fn().mockResolvedValue(COMPLETED);

    await expect(PayAcrossWalletChange(pay, follow, jest.fn())).resolves.toBe(
      COMPLETED
    );
    expect(follow).toHaveBeenCalledWith(HASH);
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it('asks only once, and passes other errors on', async () => {
    const changed = WalletChanged();
    await expect(
      PayAcrossWalletChange(
        jest.fn().mockRejectedValue(changed),
        jest.fn(),
        jest.fn()
      )
    ).rejects.toBe(changed);

    const other = ApiFailure(400, { type: 'invalid_request_error' });
    await expect(
      PayAcrossWalletChange(
        jest.fn().mockRejectedValue(other),
        jest.fn(),
        jest.fn()
      )
    ).rejects.toBe(other);
  });

  it('tells the customer to approve again when the change ends a payment', () => {
    expect(CheckoutErrorMessage(WalletChanged(), false)).toBe(
      MERCHANT_WALLET_CHANGED_MESSAGE
    );
  });
});
