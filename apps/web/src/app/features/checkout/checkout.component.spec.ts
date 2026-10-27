// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import {
  CheckoutPaymentTransaction,
  CheckoutSession,
  CheckoutSubscribeAuthorization,
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

/** The Subscriptions contract (any checksummed address). */
const SUBSCRIPTIONS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const PLAN_KEY = `0x${'5a'.repeat(32)}`;
const PERMIT_SIGNATURE = `0x${'11'.repeat(65)}`;
const SUBSCRIBE_SIGNATURE = `0x${'22'.repeat(65)}`;
const DEADLINE = 1793106000;
/** 3 Nov 2026, 12:00 UTC: the same calendar day in every test timezone. */
const TRIAL_END = 1793707200;

const DOMAIN_TYPE = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

/**
 * 10 USDC every 30 days with no trial, as `BuildSubscribeTypedData`
 * prepares it: `firstChargeAt` is signed, and 0 means now.
 */
const SUBSCRIBE_TYPED_DATA: Eip712TypedData = {
  domain: {
    name: 'Subscriptions',
    version: '1',
    chainId: SEPOLIA,
    verifyingContract: SUBSCRIPTIONS,
  },
  types: {
    EIP712Domain: DOMAIN_TYPE,
    Subscribe: [
      { name: 'planKey', type: 'bytes32' },
      { name: 'subscriber', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'periodSeconds', type: 'uint64' },
      { name: 'firstChargeAt', type: 'uint64' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'Subscribe',
  message: {
    planKey: PLAN_KEY,
    subscriber: PAYER,
    token: USDC,
    amount: '10000000',
    periodSeconds: '2592000',
    firstChargeAt: '0',
    nonce: '0',
    deadline: DEADLINE,
  },
};

/** The `Subscribe` with a first charge at `firstChargeAt` (a trial's end). */
function WithFirstChargeAt(firstChargeAt: number): Eip712TypedData {
  return {
    ...SUBSCRIBE_TYPED_DATA,
    message: {
      ...SUBSCRIBE_TYPED_DATA.message,
      firstChargeAt: String(firstChargeAt),
    },
  };
}

/** The `Subscribe` without the `firstChargeAt` field at all. */
function WithoutFirstChargeAt(): Eip712TypedData {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { firstChargeAt: _dropped, ...message } = SUBSCRIBE_TYPED_DATA.message;
  return {
    ...SUBSCRIBE_TYPED_DATA,
    types: {
      ...SUBSCRIBE_TYPED_DATA.types,
      Subscribe: SUBSCRIBE_TYPED_DATA.types['Subscribe'].filter(
        (field) => field.name !== 'firstChargeAt'
      ),
    },
    message,
  };
}

/** Sets the allowance to 5 USDC already granted plus this plan's 130 USDC. */
const PERMIT_TYPED_DATA: Eip712TypedData = {
  domain: {
    name: 'USDC',
    version: '2',
    chainId: SEPOLIA,
    verifyingContract: USDC,
  },
  types: {
    EIP712Domain: DOMAIN_TYPE,
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'Permit',
  message: {
    owner: PAYER,
    spender: SUBSCRIPTIONS,
    value: '135000000',
    nonce: '0',
    deadline: DEADLINE,
  },
};

/** A first-time subscriber: the allowance is short, so a permit is needed. */
const SUBSCRIBE_AUTHORIZATION: CheckoutSubscribeAuthorization = {
  plan_id: PLAN_KEY,
  needs_permit: true,
  permit_typed_data: PERMIT_TYPED_DATA,
  subscribe_typed_data: SUBSCRIBE_TYPED_DATA,
  deadline: DEADLINE,
  first_charge_at: 0,
  already_subscribed: false,
  subscription_onchain_id: null,
};

const SUBSCRIPTION_PREPARED: CheckoutPaymentTransaction = {
  object: 'checkout.payment_transaction',
  checkout_session: 'cs_test',
  amount_total: 1000,
  currency: 'usdc',
  merchant_wallet_address: MERCHANT,
  relayed: true,
  estimated_fee: '3000000000000000',
  fee_currency: 'eth',
  chain_id: SEPOLIA,
  already_subscribed: false,
  subscription: SUBSCRIBE_AUTHORIZATION,
};

/** The prepared subscription with `changes` applied to its `subscription`. */
function PreparedSubscription(
  changes: Partial<CheckoutSubscribeAuthorization>
): CheckoutPaymentTransaction {
  return {
    ...SUBSCRIPTION_PREPARED,
    subscription: { ...SUBSCRIBE_AUTHORIZATION, ...changes },
  };
}

const SUBSCRIPTION_SESSION = {
  ...SESSION,
  mode: 'subscription',
  amount_total: 1000,
  amount_subtotal: 1000,
  merchant_wallet: {
    wallet_address: MERCHANT,
    network: 'ethereum',
    currency: 'usdc',
    token_address: USDC,
  },
  line_items: {
    object: 'list',
    data: [
      {
        id: 'li_1',
        description: 'Pro plan',
        quantity: 1,
        amount_subtotal: 1000,
        amount_total: 1000,
        price: {
          id: 'price_1',
          object: 'price',
          type: 'recurring',
          unit_amount: 1000,
          recurring: { interval: 'month', interval_count: 1 },
          subscription_plan_id: PLAN_KEY,
        },
      },
    ],
  },
} as unknown as CheckoutSession;

const TRIAL_DAYS = 7;
/** 27 Oct 2026, 12:00 UTC: a 7-day trial from here ends at `TRIAL_END`. */
const TRIAL_NOW = TRIAL_END - TRIAL_DAYS * 86400;

/** The subscription session, its price with a 7-day trial. */
const TRIAL_SESSION = {
  ...SUBSCRIPTION_SESSION,
  line_items: {
    object: 'list',
    data: [
      {
        ...SUBSCRIPTION_SESSION.line_items?.data[0],
        price: {
          ...SUBSCRIPTION_SESSION.line_items?.data[0].price,
          recurring: {
            interval: 'month',
            interval_count: 1,
            trial_period_days: TRIAL_DAYS,
          },
        },
      },
    ],
  },
} as unknown as CheckoutSession;

/** An error shaped like the ones `ApiService.Call` throws. */
function ApiFailure(status: number, body: Record<string, unknown>): Error {
  return Object.assign(new Error(String(body['message'])), {
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

type FakeWalletProvider = Eip1193Provider & {
  request: jest.Mock;
  chainId: number;
  /** Fires an EIP-1193 event the way a wallet does. */
  Emit(event: string, ...args: unknown[]): void;
};

/**
 * A browser wallet on `chainId` holding `account`. A permit and a
 * `Subscribe` get their own signatures; anything else gets `SIGNATURE`.
 */
function FakeWallet(
  options: { chainId?: number; account?: string } = {}
): FakeWalletProvider {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const wallet: FakeWalletProvider = {
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
          case 'eth_signTypedData_v4': {
            const { primaryType } = JSON.parse((params as [string, string])[1]);
            if (primaryType === 'Permit') return PERMIT_SIGNATURE;
            if (primaryType === 'Subscribe') return SUBSCRIBE_SIGNATURE;
            return SIGNATURE;
          }
          default:
            throw new Error(`Unexpected method ${method}`);
        }
      }
    ),
    on: (event: string, listener: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)?.add(listener);
    },
    removeListener: (event: string, listener: (...args: unknown[]) => void) =>
      listeners.get(event)?.delete(listener),
    Emit: (event, ...args) =>
      listeners.get(event)?.forEach((listener) => listener(...args)),
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
function SignedTypedData(wallet: { request: jest.Mock }, index = 0): unknown {
  const request = Calls(wallet, 'eth_signTypedData_v4')[index] as {
    params: [string, string];
  };
  return {
    account: request.params[0],
    typedData: JSON.parse(request.params[1]),
  };
}

/** `typedData` as viem sends it: every `address` field lowercased. */
function Lowercased(typedData: Eip712TypedData): unknown {
  const addressFields = typedData.types[typedData.primaryType]
    .filter((field) => field.type === 'address')
    .map((field) => field.name);
  return {
    ...typedData,
    domain: {
      ...typedData.domain,
      verifyingContract: typedData.domain.verifyingContract.toLowerCase(),
    },
    message: Object.fromEntries(
      Object.entries(typedData.message).map(([name, value]) => [
        name,
        addressFields.includes(name) ? String(value).toLowerCase() : value,
      ])
    ),
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
  /** The `checkoutSessionId` route parameter; null skips loading. */
  let routeSlug: string | null;

  /** Renders checkout for an open session once wallet discovery has run. */
  function Render(session: CheckoutSession = SESSION): {
    fixture: ComponentFixture<CheckoutComponent>;
    component: CheckoutComponent;
  } {
    const fixture = TestBed.createComponent(CheckoutComponent);
    const component = fixture.componentInstance;
    component.checkoutSession.set(session);
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
    routeSlug = null;
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
          useValue: { snapshot: { paramMap: { get: () => routeSlug } } },
        },
        { provide: CheckoutSessionService, useValue: checkoutSessionService },
        { provide: ConfigService, useValue: configService },
        { provide: MetaService, useValue: { SetMetaTitle: jest.fn() } },
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

    it.each([
      ['from another wallet', { from: OTHER_PAYER }],
      ['to another merchant', { to: OTHER_PAYER }],
      ['for another amount', { value: '2000000' }],
    ])(
      'does not sign a payment request %s',
      async (_label, message: Record<string, string>) => {
        const { component } = Render();
        checkoutSessionService.PreparePayment.mockResolvedValue({
          ...PREPARED,
          typed_data: {
            ...TYPED_DATA,
            message: { ...TYPED_DATA.message, ...message },
          },
        });

        await component.Pay();

        expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
        expect(checkoutSessionService.ConfirmPayment).not.toHaveBeenCalled();
        expect(component.paymentError()).toBe(
          'This payment request is out of date. Reload the page and try again.'
        );
      }
    );

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

    it('drops the held signature after a 500', async () => {
      const { component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        ApiFailure(500, { type: 'api_error', message: 'Internal error' })
      );

      await component.Pay();

      expect(component.paymentError()).toBe('Internal error');
      expect(component.SubmitLabel()).not.toBe('Check payment status');

      await component.Pay();

      expect(checkoutSessionService.PreparePayment).toHaveBeenCalledTimes(2);
      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(2);
      expect(component.paymentPhase()).toBe('complete');
    });

    it('does not sign once the wallet switches accounts after prepare', async () => {
      const { component } = Render();
      checkoutSessionService.PreparePayment.mockImplementation(async () => {
        wallet.Emit('accountsChanged', [OTHER_PAYER.toLowerCase()]);
        return PREPARED;
      });

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
      expect(checkoutSessionService.ConfirmPayment).not.toHaveBeenCalled();
      expect(component.paymentError()).toBe(
        'Your wallet switched accounts. Press Pay to start again.'
      );
    });
  });

  describe('on-chain subscriptions', () => {
    const ONCHAIN_ID = `0x${'34'.repeat(32)}`;

    beforeEach(() => {
      checkoutSessionService.PreparePayment.mockResolvedValue(
        SUBSCRIPTION_PREPARED
      );
      checkoutSessionService.ConfirmPayment.mockResolvedValue({
        ...SUBSCRIPTION_SESSION,
        status: 'complete',
      });
    });

    it('signs the USDC permit, then the Subscribe, and confirms both with the deadline in one call', async () => {
      const { component } = Render(SUBSCRIPTION_SESSION);

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(2);
      expect(SignedTypedData(wallet, 0)).toEqual({
        account: PAYER,
        typedData: Lowercased(PERMIT_TYPED_DATA),
      });
      expect(SignedTypedData(wallet, 1)).toEqual({
        account: PAYER,
        typedData: Lowercased(SUBSCRIBE_TYPED_DATA),
      });
      expect(checkoutSessionService.ConfirmPayment.mock.calls).toEqual([
        [
          SESSION.url_slug,
          {
            permit_signature: PERMIT_SIGNATURE,
            subscribe_signature: SUBSCRIBE_SIGNATURE,
            deadline: DEADLINE,
          },
        ],
      ]);
      expect(component.paymentPhase()).toBe('complete');
    });

    it('signs only the Subscribe when the allowance already covers the plan', async () => {
      const { component } = Render(SUBSCRIPTION_SESSION);
      checkoutSessionService.PreparePayment.mockResolvedValue(
        PreparedSubscription({ needs_permit: false, permit_typed_data: null })
      );

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(1);
      expect(SignedTypedData(wallet)).toEqual({
        account: PAYER,
        typedData: Lowercased(SUBSCRIBE_TYPED_DATA),
      });
      expect(checkoutSessionService.ConfirmPayment.mock.calls).toEqual([
        [
          SESSION.url_slug,
          { subscribe_signature: SUBSCRIBE_SIGNATURE, deadline: DEADLINE },
        ],
      ]);
      expect(component.paymentPhase()).toBe('complete');
    });

    it('says first-time wallets approve twice', () => {
      const { fixture } = Render(SUBSCRIPTION_SESSION);

      expect(Text(fixture)).toContain('First-time wallets approve twice.');
    });

    describe('what the customer is shown while the wallet signs', () => {
      /** The page text at the moment the wallet is asked to sign. */
      async function TextWhileSigning(
        prepared: CheckoutPaymentTransaction,
        session: CheckoutSession = SUBSCRIPTION_SESSION
      ): Promise<string[]> {
        const { fixture, component } = Render(session);
        checkoutSessionService.PreparePayment.mockResolvedValue(prepared);
        const seen: string[] = [];
        const sign = wallet.request.getMockImplementation();
        wallet.request.mockImplementation(async (request) => {
          if (request.method === 'eth_signTypedData_v4') {
            seen.push(Text(fixture));
          }
          return sign?.(request);
        });

        await component.Pay();
        return seen;
      }

      it('shows the amount, period and token, the allowance this plan adds and the total the permit sets', async () => {
        const [text] = await TextWhileSigning(SUBSCRIPTION_PREPARED);

        expect(text).toMatch(/Recurring charge\s*10\.00 USDC every month/);
        expect(text).toMatch(/Token\s*USDC \(0x1c7D…7238\)/);
        expect(text).toMatch(/Allowance added\s*130\.00 USDC \(13 charges\)/);
        expect(text).toMatch(/Total allowance after signing\s*135\.00 USDC/);
        expect(text).toContain('First charge today');
      });

      it('says the existing allowance covers the plan when no permit is needed', async () => {
        const [text] = await TextWhileSigning(
          PreparedSubscription({ needs_permit: false, permit_typed_data: null })
        );

        expect(text).toContain('10.00 USDC every month');
        expect(text).toContain(
          'Your USDC allowance already covers this subscription'
        );
        expect(text).not.toContain('Allowance added');
      });

      it('shows the first charge of a trial on the date firstChargeAt sets', async () => {
        jest.useFakeTimers({ now: TRIAL_NOW * 1000 });
        const [text] = await TextWhileSigning(
          PreparedSubscription({
            subscribe_typed_data: WithFirstChargeAt(TRIAL_END),
          }),
          TRIAL_SESSION
        );

        expect(text).toContain('First charge on 3 Nov 2026.');
        expect(text).not.toContain('First charge today');
        expect(SignedTypedData(wallet, 1)).toEqual({
          account: PAYER,
          typedData: Lowercased(WithFirstChargeAt(TRIAL_END)),
        });
      });

      it('reads a Subscribe without firstChargeAt as a first charge today', async () => {
        const [text] = await TextWhileSigning(
          PreparedSubscription({ subscribe_typed_data: WithoutFirstChargeAt() })
        );

        expect(text).toContain('First charge today');
      });
    });

    describe('what a trial charges today', () => {
      beforeEach(() => jest.useFakeTimers({ now: TRIAL_NOW * 1000 }));

      it('shows nothing due today, the trial and an estimated first charge before signing', () => {
        const { fixture } = Render(TRIAL_SESSION);

        const text = Text(fixture);
        expect(text).toMatch(/7-day free trial\s*US\$0\.00/);
        expect(text).toMatch(
          /First charge around 3 Nov 2026 \(estimated\)\s*US\$10\.00/
        );
        expect(text).toMatch(/Total due today\s*US\$0\.00/);
      });

      it('shows the signed first charge date once prepared', async () => {
        // A first charge a day from now: inside the window, and not the
        // date the trial length would give.
        const firstChargeAt = TRIAL_NOW + 86400;
        const { fixture, component } = Render(TRIAL_SESSION);
        checkoutSessionService.PreparePayment.mockResolvedValue(
          PreparedSubscription({
            subscribe_typed_data: WithFirstChargeAt(firstChargeAt),
          })
        );
        let text = '';
        const sign = wallet.request.getMockImplementation();
        wallet.request.mockImplementation(async (request) => {
          if (request.method === 'eth_signTypedData_v4') text = Text(fixture);
          return sign?.(request);
        });

        await component.Pay();

        expect(text).toMatch(/First charge on 28 Oct 2026\s*US\$10\.00/);
        expect(text).not.toContain('(estimated)');
        expect(text).toMatch(/Total due today\s*US\$0\.00/);
      });

      it('shows the full amount due today without a trial', () => {
        const { fixture } = Render(SUBSCRIPTION_SESSION);

        const text = Text(fixture);
        expect(text).toMatch(/Total due today\s*US\$10\.00/);
        expect(text).not.toContain('free trial');
        expect(text).not.toContain('First charge');
      });
    });

    it.each([
      ['a first charge without a trial', SUBSCRIPTION_SESSION, TRIAL_END],
      ['a trial charging now', TRIAL_SESSION, 0],
      ['a trial with no first charge', TRIAL_SESSION, undefined],
      ['a trial charging in the past', TRIAL_SESSION, TRIAL_NOW - 1],
      ['a trial charging right now', TRIAL_SESSION, TRIAL_NOW],
      [
        'a trial charging later than its length allows',
        TRIAL_SESSION,
        TRIAL_END + 3601,
      ],
      ['a trial with a non-numeric first charge', TRIAL_SESSION, 'soon'],
    ])(
      'does not sign %s',
      async (
        _label,
        session: CheckoutSession,
        firstChargeAt: number | string | undefined
      ) => {
        jest.useFakeTimers({ now: TRIAL_NOW * 1000 });
        const { component } = Render(session);
        const subscribe =
          firstChargeAt === undefined
            ? WithoutFirstChargeAt()
            : WithFirstChargeAt(firstChargeAt as number);
        checkoutSessionService.PreparePayment.mockResolvedValue(
          PreparedSubscription({ subscribe_typed_data: subscribe })
        );

        await component.Pay();

        expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
        expect(checkoutSessionService.ConfirmPayment).not.toHaveBeenCalled();
        expect(component.paymentError()).toBe(
          'This subscription request is out of date. Reload the page and try again.'
        );
      }
    );

    it('signs a trial whose first charge is at the end of its allowed window', async () => {
      jest.useFakeTimers({ now: TRIAL_NOW * 1000 });
      const { component } = Render(TRIAL_SESSION);
      checkoutSessionService.PreparePayment.mockResolvedValue(
        PreparedSubscription({
          subscribe_typed_data: WithFirstChargeAt(TRIAL_END + 3600),
        })
      );

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(2);
      expect(component.paymentPhase()).toBe('complete');
    });

    it.each([
      [
        'for another subscriber',
        { subscribe: { subscriber: OTHER_PAYER } },
        'This subscription request is out of date. Reload the page and try again.',
      ],
      [
        'for another plan',
        { subscribe: { planKey: `0x${'6b'.repeat(32)}` } },
        'This subscription request is out of date. Reload the page and try again.',
      ],
      [
        'for another amount',
        { subscribe: { amount: '20000000' } },
        'This subscription request is out of date. Reload the page and try again.',
      ],
      [
        'for another period',
        { subscribe: { periodSeconds: '604800' } },
        'This subscription request is out of date. Reload the page and try again.',
      ],
      [
        'for another token',
        { subscribe: { token: MERCHANT } },
        'This subscription request is out of date. Reload the page and try again.',
      ],
      [
        'with another deadline',
        { subscribe: { deadline: DEADLINE + 1 } },
        'This subscription request is out of date. Reload the page and try again.',
      ],
      [
        'whose permit is from another owner',
        { permit: { owner: OTHER_PAYER } },
        'This subscription request is out of date. Reload the page and try again.',
      ],
      [
        'whose permit is for another spender',
        { permit: { spender: MERCHANT } },
        'This subscription request is out of date. Reload the page and try again.',
      ],
      [
        'whose permit sets less than the plan adds',
        { permit: { value: '129999999' } },
        'This subscription request is out of date. Reload the page and try again.',
      ],
    ])(
      'does not sign a subscription request %s',
      async (
        _label,
        changes: {
          subscribe?: Record<string, string | number>;
          permit?: Record<string, string | number>;
        },
        message: string
      ) => {
        const { component } = Render(SUBSCRIPTION_SESSION);
        checkoutSessionService.PreparePayment.mockResolvedValue(
          PreparedSubscription({
            subscribe_typed_data: {
              ...SUBSCRIBE_TYPED_DATA,
              message: {
                ...SUBSCRIBE_TYPED_DATA.message,
                ...changes.subscribe,
              },
            },
            permit_typed_data: {
              ...PERMIT_TYPED_DATA,
              message: { ...PERMIT_TYPED_DATA.message, ...changes.permit },
            },
          })
        );

        await component.Pay();

        expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
        expect(checkoutSessionService.ConfirmPayment).not.toHaveBeenCalled();
        expect(component.paymentError()).toBe(message);
        expect(component.paymentPhase()).toBe('idle');
      }
    );

    it.each([
      [
        'a Subscribe for another chain',
        PreparedSubscription({
          subscribe_typed_data: {
            ...SUBSCRIBE_TYPED_DATA,
            domain: { ...SUBSCRIBE_TYPED_DATA.domain, chainId: 1 },
          },
        }),
      ],
      [
        'a permit for another chain',
        PreparedSubscription({
          permit_typed_data: {
            ...PERMIT_TYPED_DATA,
            domain: { ...PERMIT_TYPED_DATA.domain, chainId: 1 },
          },
        }),
      ],
    ])('does not sign %s', async (_label, prepared) => {
      const { component } = Render(SUBSCRIPTION_SESSION);
      checkoutSessionService.PreparePayment.mockResolvedValue(prepared);

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
      expect(component.paymentError()).toBe(
        'The subscription is for a different network than this checkout. Refresh the page and try again.'
      );
    });

    it('does not sign a permit for a token the plan does not pull', async () => {
      const { component } = Render(SUBSCRIPTION_SESSION);
      checkoutSessionService.PreparePayment.mockResolvedValue(
        PreparedSubscription({
          permit_typed_data: {
            ...PERMIT_TYPED_DATA,
            domain: {
              ...PERMIT_TYPED_DATA.domain,
              verifyingContract: MERCHANT,
            },
          },
        })
      );

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
      expect(component.paymentError()).toBe(
        'This subscription request is out of date. Reload the page and try again.'
      );
    });

    it("does not sign a prepare for another plan than the checkout price's", async () => {
      const otherPlan = `0x${'6b'.repeat(32)}`;
      const { component } = Render(SUBSCRIPTION_SESSION);
      checkoutSessionService.PreparePayment.mockResolvedValue(
        PreparedSubscription({
          plan_id: otherPlan,
          subscribe_typed_data: {
            ...SUBSCRIBE_TYPED_DATA,
            message: { ...SUBSCRIBE_TYPED_DATA.message, planKey: otherPlan },
          },
        })
      );

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
      expect(component.paymentError()).toBe(
        'This subscription request is out of date. Reload the page and try again.'
      );
    });

    it('does not sign when a permit is needed but none was prepared', async () => {
      const { component } = Render(SUBSCRIPTION_SESSION);
      checkoutSessionService.PreparePayment.mockResolvedValue(
        PreparedSubscription({ permit_typed_data: null })
      );

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
      expect(component.paymentError()).toBe(
        'This subscription request is out of date. Reload the page and try again.'
      );
    });

    it('stops after a rejected permit without asking for the Subscribe', async () => {
      const { component } = Render(SUBSCRIPTION_SESSION);
      const sign = wallet.request.getMockImplementation();
      wallet.request.mockImplementation(async (request) => {
        if (request.method === 'eth_signTypedData_v4') {
          throw Object.assign(new Error('User rejected the request.'), {
            code: 4001,
          });
        }
        return sign?.(request);
      });

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(1);
      expect(checkoutSessionService.ConfirmPayment).not.toHaveBeenCalled();
      expect(component.paymentError()).toBe(
        'The request was rejected in your wallet.'
      );
      expect(component.subscribeTerms()).toBeNull();
    });

    it('retries a pending subscribe with the same signatures until it completes', async () => {
      jest.useFakeTimers();
      const { component } = Render(SUBSCRIPTION_SESSION);
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        PaymentPending(HASH)
      );

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(0);
      expect(component.paymentPhase()).toBe('confirming');
      expect(component.pendingTransactionHash()).toBe(HASH);

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      await paying;

      const signed = {
        permit_signature: PERMIT_SIGNATURE,
        subscribe_signature: SUBSCRIBE_SIGNATURE,
        deadline: DEADLINE,
      };
      expect(checkoutSessionService.ConfirmPayment.mock.calls).toEqual([
        [SESSION.url_slug, signed],
        [SESSION.url_slug, signed],
      ]);
      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(2);
      expect(component.paymentPhase()).toBe('complete');
    });

    it('words the confirm and its 5-minute stop as a subscription', async () => {
      jest.useFakeTimers();
      const { fixture, component } = Render(SUBSCRIPTION_SESSION);
      checkoutSessionService.ConfirmPayment.mockRejectedValue(
        PaymentPending(HASH, 'another_confirmation')
      );

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(0);

      expect(Text(fixture)).toContain(
        'A subscription for this checkout is already being confirmed'
      );
      expect(component.BusyLabel()).toBe('Confirming subscription');

      await jest.advanceTimersByTimeAsync(POLL_TIMEOUT_MS + POLL_INTERVAL_MS);
      await paying;

      expect(component.paymentError()).toBe(
        'Your subscription is still confirming. Keep this page open, then check again.'
      );
      expect(component.SubmitLabel()).toBe('Check subscription status');
    });

    it('signs nothing more once the wallet switches accounts after the permit', async () => {
      const { component } = Render(SUBSCRIPTION_SESSION);
      const sign = wallet.request.getMockImplementation();
      wallet.request.mockImplementation(async (request) => {
        const answer = await sign?.(request);
        if (request.method === 'eth_signTypedData_v4') {
          wallet.Emit('accountsChanged', [OTHER_PAYER.toLowerCase()]);
        }
        return answer;
      });

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(1);
      expect(checkoutSessionService.ConfirmPayment).not.toHaveBeenCalled();
      expect(component.paymentError()).toBe(
        'Your wallet switched accounts. Press Subscribe to start again.'
      );
    });

    it('asks for new signatures when the API says the signed ones went stale', async () => {
      const { component } = Render(SUBSCRIPTION_SESSION);
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        ApiFailure(409, {
          code: 'subscription_authorization_stale',
          type: 'subscription_authorization_stale',
          message:
            'The subscription signature can no longer be used. Prepare the subscription again and sign the new request.',
        })
      );

      await component.Pay();

      expect(component.paymentError()).toBe(
        'This subscription request expired before it was sent. Press Subscribe to sign a new one.'
      );
      expect(component.SubmitLabel()).toBe('Subscribe');

      await component.Pay();

      expect(checkoutSessionService.PreparePayment).toHaveBeenCalledTimes(2);
      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(4);
      expect(component.paymentPhase()).toBe('complete');
    });

    it('explains a period that was already collected without this checkout, in fixed words', async () => {
      const { component } = Render(SUBSCRIPTION_SESSION);
      checkoutSessionService.ConfirmPayment.mockRejectedValue(
        ApiFailure(409, {
          code: 'period_already_collected',
          type: 'period_already_collected',
          message:
            'This on-chain subscription period is already collected; this checkout did not pay it',
        })
      );

      await component.Pay();

      expect(component.paymentError()).toBe(
        "This billing period was already charged to your wallet outside this checkout, so this checkout didn't start a subscription. Contact the merchant for help."
      );
      expect(component.paymentPhase()).toBe('idle');
    });

    it('explains a quantity an on-chain plan cannot collect, in fixed words', async () => {
      const { component } = Render(SUBSCRIPTION_SESSION);
      checkoutSessionService.PreparePayment.mockRejectedValue(
        ApiFailure(400, {
          code: 'onchain_plan_amount_exceeded',
          type: 'invalid_request_error',
          message:
            'Subscription checkout takes quantity 1: an on-chain plan collects one price per period',
        })
      );

      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
      expect(component.paymentError()).toBe(
        'This subscription can only be bought with a quantity of 1. Contact the merchant for a new checkout link.'
      );
    });

    describe('an existing on-chain subscription', () => {
      const EXISTING = {
        already_subscribed: true,
        subscription_onchain_id: ONCHAIN_ID,
      };

      beforeEach(() =>
        checkoutSessionService.PreparePayment.mockResolvedValue({
          ...PreparedSubscription({
            needs_permit: false,
            permit_typed_data: null,
            subscribe_typed_data: null,
            deadline: null,
            first_charge_at: null,
            already_subscribed: true,
            subscription_onchain_id: ONCHAIN_ID,
          }),
          estimated_fee: '0',
          already_subscribed: true,
          subscription_onchain_id: ONCHAIN_ID,
        })
      );

      it('is confirmed without signing', async () => {
        const { component } = Render(SUBSCRIPTION_SESSION);

        await component.Pay();

        expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
        expect(checkoutSessionService.ConfirmPayment.mock.calls).toEqual([
          [SESSION.url_slug, EXISTING],
        ]);
        expect(component.paymentPhase()).toBe('complete');
      });

      it.each([
        ['its first charge is pending', PaymentPending(null)],
        [
          'a gateway 504',
          Object.assign(new Error('API Call failed: Gateway Timeout'), {
            status: 504,
          }),
        ],
      ])(
        'is confirmed again until it settles when %s',
        async (_label, failure) => {
          jest.useFakeTimers();
          const { component } = Render(SUBSCRIPTION_SESSION);
          checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(failure);

          const paying = component.Pay();
          await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
          await paying;

          expect(checkoutSessionService.ConfirmPayment.mock.calls).toEqual([
            [SESSION.url_slug, EXISTING],
            [SESSION.url_slug, EXISTING],
          ]);
          expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
          expect(component.paymentError()).toBeNull();
          expect(component.paymentPhase()).toBe('complete');
        }
      );
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
      // Defensive: the API sends this code only to a confirm by hash.
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

    it.each([
      ['a network error', new TypeError('Failed to fetch')],
      [
        'a gateway 502',
        Object.assign(new Error('API Call failed: Bad Gateway'), {
          status: 502,
        }),
      ],
      [
        'a gateway 503',
        Object.assign(new Error('API Call failed: Service Unavailable'), {
          status: 503,
        }),
      ],
      [
        'a gateway 504',
        Object.assign(new Error('API Call failed: Gateway Timeout'), {
          status: 504,
        }),
      ],
    ])('retries with the held signature after %s', async (_label, failure) => {
      const { component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(failure);

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      await paying;

      expect(checkoutSessionService.ConfirmPayment.mock.calls).toEqual([
        [SESSION.url_slug, { signature: SIGNATURE }],
        [SESSION.url_slug, { signature: SIGNATURE }],
      ]);
      expect(component.paymentError()).toBeNull();
      expect(component.paymentPhase()).toBe('complete');
    });

    it('keeps a reported hash when a later 409 has none', async () => {
      const { fixture, component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        PaymentPending(HASH)
      ).mockRejectedValueOnce(PaymentPending(null));

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledTimes(2);
      expect(component.pendingTransactionHash()).toBe(HASH);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('.payment-status a')
      ).not.toBeNull();

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      await paying;
      expect(component.paymentPhase()).toBe('complete');
    });

    it('says when another confirmation is recording the payment', async () => {
      const { fixture, component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        PaymentPending(HASH, 'another_confirmation')
      );

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(0);

      expect(Text(fixture)).toContain(
        'A payment for this checkout is already being confirmed'
      );
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      await paying;
      expect(component.paymentPhase()).toBe('complete');
    });

    it('links only a well-formed transaction hash', async () => {
      const { fixture, component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        PaymentPending('0x1234')
      );

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(0);

      expect(Text(fixture)).toContain('0x1234');
      expect(
        fixture.nativeElement.querySelector('.payment-status a')
      ).toBeNull();
      expect(configService.GetExplorerUrl).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      await paying;
    });

    it('stops polling when the page is destroyed', async () => {
      const { fixture, component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValue(
        PaymentPending(HASH)
      );

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(0);
      fixture.destroy();
      await jest.advanceTimersByTimeAsync(10 * POLL_INTERVAL_MS);
      await paying;

      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledTimes(1);
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
    /** The 409 the API answers prepare with for any wallet but the payer's. */
    function OtherWalletConfirming(): Error {
      return ApiFailure(409, {
        code: 'payment_pending',
        type: 'payment_pending',
        transaction_hash: HASH,
        message:
          'A payment from another wallet is confirming for this Checkout Session',
      });
    }

    beforeEach(() => {
      jest.useFakeTimers();
      checkoutSessionService.PreparePayment.mockRejectedValue(
        OtherWalletConfirming()
      );
      checkoutSessionService.GetPublicCheckoutSession.mockResolvedValue({
        ...SESSION,
        payment_details: { transaction_hash: HASH, payer_wallet: OTHER_PAYER },
      });
    });

    it('follows it by its transaction hash until the session completes', async () => {
      const { fixture, component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        PaymentPending(HASH)
      );

      const paying = component.Pay();
      await jest.advanceTimersByTimeAsync(0);

      expect(Text(fixture)).toContain(
        'A payment for this checkout is already being confirmed. It was started from 0x90F7…b906, and only that wallet can finish it.'
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

    it('names the wallet that must sign again when the network lost the payment, without a Pay that loops', async () => {
      const { fixture, component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValue(
        ResubmitRequired(HASH)
      );

      await component.Pay();

      expect(component.paymentError()).toBe(
        "The payment from 0x90F7…b906 did not reach the network. Open this checkout with that wallet to sign it again. Another wallet can't pay this checkout until it expires."
      );
      expect(component.paymentPhase()).toBe('idle');
      fixture.detectChanges();
      expect(
        (
          fixture.nativeElement.querySelector(
            'button.checkout-pay-button'
          ) as HTMLButtonElement
        ).disabled
      ).toBe(true);

      await component.Pay();

      expect(checkoutSessionService.PreparePayment).toHaveBeenCalledTimes(1);
      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledTimes(1);
      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(0);
    });

    it('turns Pay back on when the wallet switches to the payer that must sign again', async () => {
      const { fixture, component } = Render();
      checkoutSessionService.ConfirmPayment.mockRejectedValue(
        ResubmitRequired(HASH)
      );
      const payButton = (): HTMLButtonElement =>
        fixture.nativeElement.querySelector('button.checkout-pay-button');

      await component.Pay();
      expect(component.blockedByWallet()).toBe(OTHER_PAYER);

      // Another account that is still not the payer keeps Pay off.
      wallet.Emit('accountsChanged', [MERCHANT.toLowerCase()]);
      fixture.detectChanges();
      expect(component.blockedByWallet()).toBe(OTHER_PAYER);
      expect(payButton().disabled).toBe(true);

      wallet.Emit('accountsChanged', [OTHER_PAYER.toLowerCase()]);
      fixture.detectChanges();

      expect(component.blockedByWallet()).toBeNull();
      expect(component.paymentError()).toBeNull();
      expect(payButton().disabled).toBe(false);
    });

    it("signs here when the confirming payment is this wallet's own", async () => {
      // A prepare that raced this wallet's relay in another tab.
      checkoutSessionService.PreparePayment.mockRejectedValueOnce(
        ApiFailure(409, {
          code: 'payment_pending',
          type: 'payment_pending',
          transaction_hash: HASH,
          message: 'A payment is confirming for this Checkout Session',
        })
      ).mockResolvedValue(PREPARED);
      checkoutSessionService.GetPublicCheckoutSession.mockResolvedValue({
        ...SESSION,
        payment_details: { transaction_hash: HASH, payer_wallet: PAYER },
      });
      const { component } = Render();

      await component.Pay();

      expect(checkoutSessionService.PreparePayment).toHaveBeenCalledTimes(2);
      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(1);
      expect(checkoutSessionService.ConfirmPayment.mock.calls).toEqual([
        [SESSION.url_slug, { signature: SIGNATURE }],
      ]);
      expect(component.paymentPhase()).toBe('complete');
    });
  });

  describe('a payment recorded before the page loaded', () => {
    const RECORDED = {
      ...SESSION,
      payment_details: { transaction_hash: HASH, payer_wallet: PAYER },
    } as CheckoutSession;

    beforeEach(() => {
      jest.useFakeTimers();
      routeSlug = SESSION.url_slug;
      checkoutSessionService.GetPublicCheckoutSession.mockResolvedValue(
        RECORDED
      );
    });

    /** Opens the checkout page; Angular runs `ngOnInit` once. */
    async function Load(): Promise<CheckoutComponent> {
      const fixture = TestBed.createComponent(CheckoutComponent);
      fixture.detectChanges();
      await jest.advanceTimersByTimeAsync(0);
      return fixture.componentInstance;
    }

    it('resumes confirming by its hash without the wallet', async () => {
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        PaymentPending(HASH)
      );
      const component = await Load();

      expect(component.paymentPhase()).toBe('confirming');
      expect(component.pendingTransactionHash()).toBe(HASH);

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(checkoutSessionService.ConfirmPayment.mock.calls).toEqual([
        [SESSION.url_slug, { transaction_hash: HASH }],
        [SESSION.url_slug, { transaction_hash: HASH }],
      ]);
      expect(wallet.request).not.toHaveBeenCalled();
      expect(component.paymentPhase()).toBe('complete');
    });

    it('asks the payer to sign again when the network lost it, then signs on Pay', async () => {
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        ResubmitRequired(HASH)
      );
      const component = await Load();

      expect(component.paymentError()).toBe(
        'The payment from 0x3C44…93BC did not reach the network. Press Pay and sign it again with that wallet.'
      );
      expect(component.IsPayBlocked()).toBe(false);
      expect(wallet.request).not.toHaveBeenCalled();

      component.email = 'payer@example.com';
      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(1);
      expect(checkoutSessionService.ConfirmPayment).toHaveBeenLastCalledWith(
        SESSION.url_slug,
        { signature: SIGNATURE }
      );
      expect(component.paymentPhase()).toBe('complete');
    });

    it('leaves a session with nothing recorded alone', async () => {
      checkoutSessionService.GetPublicCheckoutSession.mockResolvedValue(
        SESSION
      );
      const component = await Load();

      expect(checkoutSessionService.ConfirmPayment).not.toHaveBeenCalled();
      expect(component.paymentPhase()).toBe('idle');
    });
  });

  describe('a subscription recorded before the page loaded', () => {
    /** A relayed subscribe, recorded after the session's `expires_at`. */
    const RECORDED = {
      ...SUBSCRIPTION_SESSION,
      expires_at: 1700000000,
      payment_details: { transaction_hash: HASH, payer_wallet: PAYER },
    } as CheckoutSession;

    beforeEach(() => {
      jest.useFakeTimers();
      routeSlug = SESSION.url_slug;
      checkoutSessionService.GetPublicCheckoutSession.mockResolvedValue(
        RECORDED
      );
      checkoutSessionService.PreparePayment.mockResolvedValue(
        SUBSCRIPTION_PREPARED
      );
    });

    async function Load(): Promise<CheckoutComponent> {
      const fixture = TestBed.createComponent(CheckoutComponent);
      fixture.detectChanges();
      await jest.advanceTimersByTimeAsync(0);
      return fixture.componentInstance;
    }

    it('confirms by its hash, even past expiry, without asking for signatures', async () => {
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        PaymentPending(HASH)
      );
      const component = await Load();

      expect(component.paymentPhase()).toBe('confirming');
      expect(component.BusyLabel()).toBe('Confirming subscription');

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(checkoutSessionService.ConfirmPayment.mock.calls).toEqual([
        [SESSION.url_slug, { transaction_hash: HASH }],
        [SESSION.url_slug, { transaction_hash: HASH }],
      ]);
      expect(checkoutSessionService.PreparePayment).not.toHaveBeenCalled();
      expect(wallet.request).not.toHaveBeenCalled();
      expect(component.paymentPhase()).toBe('complete');
    });

    it('asks for both signatures again when the network lost the subscribe', async () => {
      checkoutSessionService.ConfirmPayment.mockRejectedValueOnce(
        ResubmitRequired(HASH)
      );
      const component = await Load();

      expect(component.paymentError()).toBe(
        'The subscription from 0x3C44…93BC did not reach the network. Press Subscribe and sign it again with that wallet.'
      );
      expect(wallet.request).not.toHaveBeenCalled();

      component.email = 'payer@example.com';
      await component.Pay();

      expect(Calls(wallet, 'eth_signTypedData_v4')).toHaveLength(2);
      expect(checkoutSessionService.ConfirmPayment).toHaveBeenLastCalledWith(
        SESSION.url_slug,
        {
          permit_signature: PERMIT_SIGNATURE,
          subscribe_signature: SUBSCRIBE_SIGNATURE,
          deadline: DEADLINE,
        }
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
