// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import {
  CheckoutPaymentTransaction,
  CheckoutSession,
  Eip712TypedData,
} from '@zoneless/shared-types';

import { Eip1193Provider, MetaService } from '../../core';
import { CheckoutSessionService } from '../../data/services/checkout-session.service';
import { ConfigService } from '../../data/services/config.service';
import { TEST_WALLET_DATA } from '../../utils/constants/test-data';
import { CheckoutComponent } from './checkout.component';

/** Anvil account #2, the buyer (public test key). */
const PAYER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const OTHER_PAYER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const MERCHANT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const SEPOLIA = 11155111;
const SIGNATURE = `0x${'ab'.repeat(65)}`;
const HASH = `0x${'cd'.repeat(32)}`;
const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

const TYPED_DATA: Eip712TypedData = {
  domain: {
    name: 'USDC',
    version: '2',
    chainId: SEPOLIA,
    verifyingContract: USDC,
  },
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  },
  primaryType: 'TransferWithAuthorization',
  message: {
    from: PAYER,
    to: MERCHANT,
    value: '1000000',
    validAfter: 0,
    validBefore: 1793000000,
    nonce: `0x${'12'.repeat(32)}`,
  },
};

const PREPARED: CheckoutPaymentTransaction = {
  object: 'checkout.payment_transaction',
  checkout_session: 'cs_test',
  amount_total: 100,
  currency: 'usdc',
  merchant_wallet_address: MERCHANT,
  relayed: true,
  method: 'eip3009_transfer',
  typed_data: TYPED_DATA,
  authorization: {
    from: PAYER,
    to: MERCHANT,
    value: '1000000',
    valid_after: 0,
    valid_before: 1793000000,
    nonce: `0x${'12'.repeat(32)}`,
  },
  estimated_fee: '1200000000000000',
  fee_currency: 'eth',
  chain_id: SEPOLIA,
};

const SESSION = {
  id: 'cs_test',
  url_slug: 'test-session',
  mode: 'payment',
  status: 'open',
  livemode: false,
  amount_total: 100,
  amount_subtotal: 100,
  currency: 'usdc',
  line_items: { object: 'list', data: [] },
} as unknown as CheckoutSession;

const COMPLETED = { ...SESSION, status: 'complete' } as CheckoutSession;

/** An error shaped like the ones `ApiService.Call` throws. */
function ApiFailure(status: number, body: Record<string, unknown>): Error {
  return Object.assign(new Error(String(body['message'])), {
    status,
    type: body['type'],
    details: body,
  });
}

function PaymentPending(transactionHash: string | null): Error {
  return ApiFailure(409, {
    code: 'payment_pending',
    type: 'payment_pending',
    transaction_hash: transactionHash,
    message:
      'The payment is waiting for network confirmations. Confirm again with this transaction_hash.',
  });
}

function ResubmitRequired(transactionHash: string): Error {
  return ApiFailure(409, {
    code: 'payment_resubmit_required',
    type: 'payment_resubmit_required',
    transaction_hash: transactionHash,
    message:
      'The network does not know this payment transaction. Confirm again with the signature.',
  });
}

/** A browser wallet on `chainId` holding `account`. */
function FakeWallet(
  options: { chainId?: number; account?: string } = {}
): Eip1193Provider & { request: jest.Mock; chainId: number } {
  const wallet = {
    chainId: options.chainId ?? SEPOLIA,
    request: jest.fn(
      async ({ method, params }: { method: string; params?: unknown }) => {
        switch (method) {
          case 'eth_requestAccounts':
          case 'eth_accounts':
            return [(options.account ?? PAYER).toLowerCase()];
          case 'eth_chainId':
            return `0x${wallet.chainId.toString(16)}`;
          case 'wallet_switchEthereumChain':
            wallet.chainId = Number(
              (params as [{ chainId: string }])[0].chainId
            );
            return null;
          case 'eth_signTypedData_v4':
            return SIGNATURE;
          default:
            throw new Error(`Unexpected method ${method}`);
        }
      }
    ),
  };
  return wallet;
}

/** The requests the wallet received, by method. */
function Calls(wallet: { request: jest.Mock }, method: string): unknown[] {
  return wallet.request.mock.calls
    .map(([request]) => request)
    .filter((request) => request.method === method);
}

/** What the wallet is asked to sign: the typed data, addresses lowercased. */
function SignedTypedData(wallet: { request: jest.Mock }): unknown {
  const [request] = Calls(wallet, 'eth_signTypedData_v4') as {
    params: [string, string];
  }[];
  return {
    account: request.params[0],
    typedData: JSON.parse(request.params[1]),
  };
}

function Lowercased(typedData: Eip712TypedData): unknown {
  return {
    ...typedData,
    domain: {
      ...typedData.domain,
      verifyingContract: typedData.domain.verifyingContract.toLowerCase(),
    },
    message: {
      ...typedData.message,
      from: String(typedData.message['from']).toLowerCase(),
      to: String(typedData.message['to']).toLowerCase(),
    },
  };
}

describe('CheckoutComponent', () => {
  const configService = {
    IsSimulatedSettlement: jest.fn(() => false),
    LoadConfig: jest.fn().mockResolvedValue({}),
    GetChainId: jest.fn((): number | null => SEPOLIA),
    GetExplorerUrl: jest.fn(
      (type: string, value: string) =>
        `https://sepolia.etherscan.io/${type}/${value}`
    ),
  };
  const checkoutSessionService = {
    PreparePayment: jest.fn(),
    ConfirmPayment: jest.fn(),
    GetPublicCheckoutSession: jest.fn(),
  };
  let wallet: ReturnType<typeof FakeWallet>;
  /** False: the browser has no wallet, so discovery finds nothing. */
  let walletInstalled: boolean;
  let announce: () => void;

  /** Renders checkout for an open session once wallet discovery has run. */
  function Render(): {
    fixture: ComponentFixture<CheckoutComponent>;
    component: CheckoutComponent;
  } {
    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.checkoutSession.set(SESSION);
    component.loading.set(false);
    component.email = 'payer@example.com';
    fixture.detectChanges();
    return { fixture, component };
  }

  function Text(fixture: ComponentFixture<CheckoutComponent>): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(() => {
    wallet = FakeWallet();
    walletInstalled = true;
    announce = () =>
      walletInstalled &&
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: {
              uuid: 'fake-wallet',
              name: 'Fake Wallet',
              icon: '',
              rdns: 'com.example.wallet',
            },
            provider: wallet,
          },
        })
      );
    window.addEventListener('eip6963:requestProvider', announce);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => null } } },
        },
        { provide: CheckoutSessionService, useValue: checkoutSessionService },
        { provide: ConfigService, useValue: configService },
        { provide: MetaService, useValue: {} },
      ],
    });
    checkoutSessionService.PreparePayment.mockResolvedValue(PREPARED);
    checkoutSessionService.ConfirmPayment.mockResolvedValue(COMPLETED);
    configService.IsSimulatedSettlement.mockReturnValue(false);
    configService.GetChainId.mockReturnValue(SEPOLIA);
  });

  afterEach(() => {
    window.removeEventListener('eip6963:requestProvider', announce);
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('wallet availability', () => {
    function UseUserAgent(userAgent: string): void {
      jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    }

    it('offers a wallet-app handoff on mobile without an injected wallet', () => {
      jest.useFakeTimers();
      walletInstalled = false;
      UseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)');
      const { component } = Render();
      jest.advanceTimersByTime(300);

      expect(component.NeedsMobileWalletHandoff()).toBe(true);
      expect(component.NeedsWalletSetup()).toBe(false);
    });

    it('keeps the checkout form on mobile when a wallet is injected', () => {
      UseUserAgent('Mozilla/5.0 (Linux; Android 16) Chrome/140 Mobile');
      const { component } = Render();

      expect(component.NeedsMobileWalletHandoff()).toBe(false);
      expect(component.NeedsWalletSetup()).toBe(false);
    });

    it('shows wallet setup guidance on desktop when there is no wallet', () => {
      jest.useFakeTimers();
      walletInstalled = false;
      UseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/140');
      const { component } = Render();
      jest.advanceTimersByTime(300);

      expect(component.NeedsMobileWalletHandoff()).toBe(false);
      expect(component.NeedsWalletSetup()).toBe(true);
    });

    it('waits for wallet discovery before choosing a screen', () => {
      jest.useFakeTimers();
      walletInstalled = false;
      UseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)');
      const { component } = Render();

      // window.ethereum may still appear within the first 300 ms.
      expect(component.IsDetectingWallet()).toBe(true);
      expect(component.NeedsMobileWalletHandoff()).toBe(false);
      expect(component.NeedsWalletSetup()).toBe(false);

      jest.advanceTimersByTime(300);
      expect(component.IsDetectingWallet()).toBe(false);
    });
  });

  describe('on-chain payments', () => {
    it('signs the prepared authorization from the pay button and confirms with the signature', async () => {
      const { fixture, component } = Render();
      const pay = jest.spyOn(component, 'Pay');

      (
        fixture.nativeElement.querySelector(
          'button.checkout-pay-button'
        ) as HTMLButtonElement
      ).click();
      await pay.mock.results[0].value;

      expect(Calls(wallet, 'eth_requestAccounts')).toHaveLength(1);
      expect(checkoutSessionService.PreparePayment).toHaveBeenCalledWith(
        SESSION.url_slug,
        PAYER,
        { email: 'payer@example.com' }
      );
      expect(SignedTypedData(wallet)).toEqual({
        account: PAYER,
        typedData: Lowercased(TYPED_DATA),
      });
      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledTimes(1);
      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledWith(
        SESSION.url_slug,
        { signature: SIGNATURE }
      );
      expect(component.paymentPhase()).toBe('complete');
    });

    it('switches the wallet to the checkout chain before preparing', async () => {
      wallet = FakeWallet({ chainId: 1 });
      const { component } = Render();
      checkoutSessionService.PreparePayment.mockImplementation(async () => {
        expect(wallet.chainId).toBe(SEPOLIA);
        return PREPARED;
      });

      await component.Pay();

      expect(Calls(wallet, 'wallet_switchEthereumChain')).toEqual([
        {
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }],
        },
      ]);
      expect(component.paymentPhase()).toBe('complete');
    });

    it('reuses an already connected wallet', async () => {
      const { component } = Render();
      await component.Pay();
      component.paymentPhase.set('idle');

      await component.Pay();

      expect(Calls(wallet, 'eth_requestAccounts')).toHaveLength(1);
      expect(checkoutSessionService.PreparePayment).toHaveBeenCalledTimes(2);
    });

    it('does not sign typed data for another chain', async () => {
      const { component } = Render();
      checkoutSessionService.PreparePayment.mockResolvedValue({
        ...PREPARED,
        typed_data: {
          ...TYPED_DATA,
          domain: { ...TYPED_DATA.domain, chainId: 1 },
        },
      });

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
      expect(checkoutSessionService.ConfirmPayment).not.toHaveBeenCalled();
      expect(component.paymentError()).toBe(
        'The payment is for a different network than this checkout. Refresh the page and try again.'
      );
      expect(component.paymentPhase()).toBe('idle');
    });

    it('explains a request rejected in the wallet', async () => {
      const { component } = Render();
      wallet.request.mockImplementation(async ({ method }) => {
        if (method === 'eth_signTypedData_v4') {
          throw Object.assign(new Error('User rejected the request.'), {
            code: 4001,
          });
        }
        if (method === 'eth_chainId') return '0xaa36a7';
        return [PAYER];
      });

      await component.Pay();

      expect(component.paymentError()).toBe(
        'The request was rejected in your wallet.'
      );
      expect(checkoutSessionService.ConfirmPayment).not.toHaveBeenCalled();
      expect(component.paymentPhase()).toBe('idle');
    });

    it('shows a 400 confirm error as is without retrying', async () => {
      const { component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValue(
        ApiFailure(400, {
          type: 'invalid_request_error',
          message: 'The USDC authorization cannot be relayed',
        })
      );

      await component.Pay();

      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledTimes(1);
      expect(component.paymentError()).toBe(
        'The USDC authorization cannot be relayed'
      );
      expect(component.paymentPhase()).toBe('idle');
    });

    it('confirms an existing on-chain subscription without signing', async () => {
      const { component } = Render();
      checkoutSessionService.PreparePayment.mockResolvedValue({
        ...PREPARED,
        method: undefined,
        typed_data: null,
        already_subscribed: true,
        subscription_onchain_id: `0x${'34'.repeat(32)}`,
      });

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledWith(
        SESSION.url_slug,
        {
          already_subscribed: true,
          subscription_onchain_id: `0x${'34'.repeat(32)}`,
        }
      );
      expect(component.paymentPhase()).toBe('complete');
    });
  });

  describe('payments that are still confirming', () => {
    beforeEach(() => jest.useFakeTimers());

    it('retries a payment_pending confirm with the same signature until it succeeds', async () => {
      const { fixture, component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        PaymentPending(HASH)
      );

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(0);

      expect(component.paymentPhase()).toBe('confirming');
      expect(component.pendingTransactionHash()).toBe(HASH);
      expect(Text(fixture)).toContain('Waiting for network confirmations');
      const link = fixture.nativeElement.querySelector(
        '.payment-status a'
      ) as HTMLAnchorElement;
      expect(link.href).toBe(`https://sepolia.etherscan.io/tx/${HASH}`);

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      await paying;

      expect(checkoutSessionService.ConfirmPayment.mock.calls).toEqual([
        [SESSION.url_slug, { signature: SIGNATURE }],
        [SESSION.url_slug, { signature: SIGNATURE }],
      ]);
      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(1);
      expect(component.paymentPhase()).toBe('complete');
    });

    it('keeps retrying a payment_pending with no transaction hash yet', async () => {
      const { fixture, component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        PaymentPending(null)
      );

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(0);

      expect(component.paymentPhase()).toBe('confirming');
      expect(component.pendingTransactionHash()).toBeNull();
      expect(Text(fixture)).toContain('Waiting for network confirmations');
      expect(
        fixture.nativeElement.querySelector('.payment-status a')
      ).toBeNull();

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      await paying;

      expect(checkoutSessionService.ConfirmPayment).toHaveBeenLastCalledWith(
        SESSION.url_slug,
        { signature: SIGNATURE }
      );
      expect(component.paymentPhase()).toBe('complete');
    });

    it('re-sends the held signature after payment_resubmit_required', async () => {
      const { component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        ResubmitRequired(HASH)
      );

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      await paying;

      expect(checkoutSessionService.ConfirmPayment.mock.calls).toEqual([
        [SESSION.url_slug, { signature: SIGNATURE }],
        [SESSION.url_slug, { signature: SIGNATURE }],
      ]);
      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(1);
      expect(component.paymentPhase()).toBe('complete');
    });

    it('retries with the signature after a network error or a gateway timeout', async () => {
      const { component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      )
        .mockRejectedValueOnce(
          Object.assign(new Error('API Call failed: Gateway Timeout'), {
            status: 504,
          })
        )
        .mockResolvedValueOnce(COMPLETED);

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(2 * POLL_INTERVAL_MS);
      await paying;

      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledTimes(3);
      expect(
        checkoutSessionService.ConfirmPayment.mock.calls.every(
          ([, body]) => body.signature === SIGNATURE
        )
      ).toBe(true);
      expect(component.paymentPhase()).toBe('complete');
    });

    it('stops after 5 minutes and checks again with the held signature', async () => {
      const { component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValue(
        PaymentPending(HASH)
      );

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(POLL_TIMEOUT_MS + POLL_INTERVAL_MS);
      await paying;

      const attempts = checkoutSessionService.ConfirmPayment.mock.calls.length;
      expect(attempts).toBe(POLL_TIMEOUT_MS / POLL_INTERVAL_MS + 1);
      expect(component.paymentPhase()).toBe('idle');
      expect(component.paymentError()).toBe(
        'Your payment is still confirming. Keep this page open, then check again.'
      );
      expect(component.pendingTransactionHash()).toBe(HASH);
      expect(component.SubmitLabel()).toBe('Check payment status');

      checkoutSessionService.ConfirmPayment.mockResolvedValue(COMPLETED);
      await component.Pay();

      expect(checkoutSessionService.ConfirmPayment).toHaveBeenLastCalledWith(
        SESSION.url_slug,
        { signature: SIGNATURE }
      );
      expect(checkoutSessionService.PreparePayment).toHaveBeenCalledTimes(1);
      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(1);
      expect(component.paymentPhase()).toBe('complete');
    });
  });

  describe('a payment another wallet is confirming', () => {
    beforeEach(() => jest.useFakeTimers());

    function OtherWalletConfirming(transactionHash: string | null): Error {
      return ApiFailure(409, {
        code: 'payment_pending',
        type: 'payment_pending',
        transaction_hash: transactionHash,
        message:
          'A payment from another wallet is confirming for this Checkout Session',
      });
    }

    it('follows it by its transaction hash until the session completes', async () => {
      const { fixture, component } = Render();
      checkoutSessionService.PreparePayment.mockRejectedValue(
        OtherWalletConfirming(HASH)
      );
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        PaymentPending(HASH)
      );

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(0);

      expect(Text(fixture)).toContain(
        'A payment for this checkout is already being confirmed'
      );

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      await paying;

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
      expect(checkoutSessionService.ConfirmPayment.mock.calls).toEqual([
        [SESSION.url_slug, { transaction_hash: HASH }],
        [SESSION.url_slug, { transaction_hash: HASH }],
      ]);
      expect(component.paymentPhase()).toBe('complete');
    });

    it('reads the session for the transaction hash when the 409 has none', async () => {
      const { component } = Render();
      checkoutSessionService.PreparePayment.mockRejectedValue(
        OtherWalletConfirming(null)
      );
      checkoutSessionService.GetPublicCheckoutSession.mockResolvedValue({
        ...SESSION,
        payment_details: { transaction_hash: HASH, payer_wallet: OTHER_PAYER },
      });

      await component.Pay();

      expect(
        checkoutSessionService.GetPublicCheckoutSession
      ).toHaveBeenCalledWith(SESSION.url_slug);
      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledWith(
        SESSION.url_slug,
        { transaction_hash: HASH }
      );
      expect(component.paymentPhase()).toBe('complete');
    });

    it('asks for a new signature when the network lost a payment and no signature is held', async () => {
      const { component } = Render();
      checkoutSessionService.PreparePayment.mockRejectedValueOnce(
        OtherWalletConfirming(HASH)
      );
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        ResubmitRequired(HASH)
      );

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledTimes(1);
      expect(component.paymentError()).toBe(
        'The payment was not sent to the network. Press Pay to sign it again.'
      );
      expect(component.paymentPhase()).toBe('idle');

      // Pay prepares again and signs.
      await component.Pay();

      expect(checkoutSessionService.PreparePayment).toHaveBeenCalledTimes(2);
      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(1);
      expect(checkoutSessionService.ConfirmPayment).toHaveBeenLastCalledWith(
        SESSION.url_slug,
        { signature: SIGNATURE }
      );
      expect(component.paymentPhase()).toBe('complete');
    });
  });

  describe('simulated payments', () => {
    beforeEach(() => configService.IsSimulatedSettlement.mockReturnValue(true));

    it('opens the test wallet instead of connecting a chain wallet', async () => {
      const { component } = Render();

      await component.Pay();

      expect(component.simulatedWalletOpen()).toBe(true);
      expect(wallet.request).not.toHaveBeenCalled();
      expect(component.NeedsMobileWalletHandoff()).toBe(false);
      expect(component.IsDetectingWallet()).toBe(false);
    });

    it('confirms with a simulated reference from the test wallet', async () => {
      const { component } = Render();
      checkoutSessionService.PreparePayment.mockResolvedValue({
        ...PREPARED,
        method: 'simulated',
        typed_data: null,
        authorization: null,
        relayed: false,
        chain_id: null,
      });

      await component.ApproveSimulatedWallet();

      expect(checkoutSessionService.PreparePayment).toHaveBeenCalledWith(
        SESSION.url_slug,
        TEST_WALLET_DATA.walletAddress,
        expect.any(Object)
      );
      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledWith(
        SESSION.url_slug,
        {
          transaction_hash: `sim_sig:cs_test:${TEST_WALLET_DATA.walletAddress}`,
        }
      );
      expect(wallet.request).not.toHaveBeenCalled();
      expect(component.paymentPhase()).toBe('complete');
    });
  });
});
