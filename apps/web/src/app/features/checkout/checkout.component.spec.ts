// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { CheckoutSession } from '@zoneless/shared-types';

import { MetaService, WalletService } from '../../core';
import {
  CheckoutPaymentTransaction,
  CheckoutSessionService,
} from '../../data/services/checkout-session.service';
import { ConfigService } from '../../data/services/config.service';
import { TEST_WALLET_DATA } from '../../utils/constants/test-data';
import { CheckoutComponent } from './checkout.component';

const PAYER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

describe('CheckoutComponent', () => {
  const walletService = {
    HasWallet: jest.fn(),
    GetAddress: jest.fn(),
    Connect: jest.fn(),
  };
  const configService = {
    IsSimulatedSettlement: jest.fn(() => false),
    LoadConfig: jest.fn().mockResolvedValue({}),
  };
  const checkoutSessionService = {
    PreparePayment: jest.fn(),
    ConfirmPayment: jest.fn(),
  };
  const checkoutSession = {
    id: 'cs_test',
    url_slug: 'test-session',
    mode: 'payment',
    status: 'open',
    livemode: false,
    amount_total: 100,
    amount_subtotal: 100,
    currency: 'usdc',
    line_items: [],
  } as unknown as CheckoutSession;
  const preparedPayment = {
    object: 'checkout.payment_transaction',
    checkout_session: 'cs_test',
    amount_total: 100,
    currency: 'usdc',
    merchant_wallet_address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    unsigned_transaction: 'sim_tx',
    estimated_fee: '0',
    fee_currency: 'none',
    chain_id: null,
    nonce: null,
    to: null,
  } satisfies CheckoutPaymentTransaction;
  const completedSession = {
    ...checkoutSession,
    status: 'complete',
  } as CheckoutSession;
  let component: CheckoutComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => null } } },
        },
        { provide: CheckoutSessionService, useValue: checkoutSessionService },
        { provide: ConfigService, useValue: configService },
        { provide: MetaService, useValue: {} },
        { provide: WalletService, useValue: walletService },
      ],
    });
    component = TestBed.runInInjectionContext(() => new CheckoutComponent());
    component.checkoutSession.set(checkoutSession);
    component.email = 'payer@example.com';
    walletService.HasWallet.mockReturnValue(true);
    walletService.GetAddress.mockReturnValue('');
    walletService.Connect.mockResolvedValue(PAYER);
    checkoutSessionService.PreparePayment.mockResolvedValue(preparedPayment);
    checkoutSessionService.ConfirmPayment.mockResolvedValue(completedSession);
    configService.IsSimulatedSettlement.mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('wallet availability', () => {
    it('offers a wallet-app handoff on mobile without an injected wallet', () => {
      jest
        .spyOn(navigator, 'userAgent', 'get')
        .mockReturnValue(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)'
        );
      walletService.HasWallet.mockReturnValue(false);

      expect(component.NeedsMobileWalletHandoff()).toBe(true);
      expect(component.NeedsWalletSetup()).toBe(false);
    });

    it('keeps the checkout form on mobile when a wallet is injected', () => {
      jest
        .spyOn(navigator, 'userAgent', 'get')
        .mockReturnValue('Mozilla/5.0 (Linux; Android 16) Chrome/140 Mobile');

      expect(component.NeedsMobileWalletHandoff()).toBe(false);
    });

    it('shows wallet setup guidance on desktop when there is no wallet', () => {
      jest
        .spyOn(navigator, 'userAgent', 'get')
        .mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/140');
      walletService.HasWallet.mockReturnValue(false);

      expect(component.NeedsMobileWalletHandoff()).toBe(false);
      expect(component.NeedsWalletSetup()).toBe(true);
    });

    it('does not show wallet setup guidance if a wallet exists', () => {
      jest
        .spyOn(navigator, 'userAgent', 'get')
        .mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/140');

      expect(component.NeedsWalletSetup()).toBe(false);
    });
  });

  describe('on-chain payments', () => {
    it('connects the wallet and prepares the payment with its address', async () => {
      checkoutSessionService.PreparePayment.mockRejectedValue(
        new Error(
          'BuildCheckoutPaymentTransaction is not available on this settlement rail yet'
        )
      );

      await component.Pay();

      expect(walletService.Connect).toHaveBeenCalledTimes(1);
      expect(checkoutSessionService.PreparePayment).toHaveBeenCalledWith(
        checkoutSession.url_slug,
        PAYER,
        { email: 'payer@example.com' }
      );
      expect(checkoutSessionService.ConfirmPayment).not.toHaveBeenCalled();
      expect(component.paymentError()).toBe(
        'BuildCheckoutPaymentTransaction is not available on this settlement rail yet'
      );
      expect(component.paymentPhase()).toBe('idle');
    });

    it('reuses an already connected wallet', async () => {
      walletService.GetAddress.mockReturnValue(PAYER);
      checkoutSessionService.PreparePayment.mockRejectedValue(
        new Error('not available')
      );

      await component.Pay();

      expect(walletService.Connect).not.toHaveBeenCalled();
      expect(checkoutSessionService.PreparePayment).toHaveBeenCalledWith(
        checkoutSession.url_slug,
        PAYER,
        expect.any(Object)
      );
    });

    it('does not sign a prepared payment until wallet signing exists', async () => {
      await component.Pay();

      expect(checkoutSessionService.ConfirmPayment).not.toHaveBeenCalled();
      expect(component.paymentError()).toMatch(/not available/);
      expect(component.paymentPhase()).toBe('idle');
    });

    it('confirms an existing on-chain subscription without signing', async () => {
      checkoutSessionService.PreparePayment.mockResolvedValue({
        ...preparedPayment,
        already_subscribed: true,
        subscription_onchain_id: 'sub_onchain_1',
      });

      await component.Pay();

      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledWith(
        checkoutSession.url_slug,
        { already_subscribed: true, subscription_onchain_id: 'sub_onchain_1' }
      );
      expect(component.paymentPhase()).toBe('complete');
    });
  });

  describe('simulated payments', () => {
    it('opens a simulated wallet instead of connecting a chain wallet', async () => {
      configService.IsSimulatedSettlement.mockReturnValue(true);

      await component.Pay();

      expect(component.simulatedWalletOpen()).toBe(true);
      expect(walletService.Connect).not.toHaveBeenCalled();
      expect(component.NeedsMobileWalletHandoff()).toBe(false);
    });

    it('confirms with a simulated signature from the test wallet', async () => {
      configService.IsSimulatedSettlement.mockReturnValue(true);

      await component.ApproveSimulatedWallet();

      expect(checkoutSessionService.PreparePayment).toHaveBeenCalledWith(
        checkoutSession.url_slug,
        TEST_WALLET_DATA.walletAddress,
        expect.any(Object)
      );
      expect(checkoutSessionService.ConfirmPayment).toHaveBeenCalledWith(
        checkoutSession.url_slug,
        {
          transaction_hash: `sim_sig:cs_test:${TEST_WALLET_DATA.walletAddress}`,
        }
      );
      expect(component.paymentPhase()).toBe('complete');
    });
  });
});
