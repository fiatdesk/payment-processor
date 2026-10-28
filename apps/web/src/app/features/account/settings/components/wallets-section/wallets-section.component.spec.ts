// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ExternalWallet, Price } from '@fiatdesk/shared-types';
import { ApiService } from '../../../../../core';
import {
  AccountService,
  ConfigService,
  ExternalWalletService,
  PriceService,
} from '../../../../../data';
import { WalletsSectionComponent } from './wallets-section.component';

const ACCOUNT = 'acct_fd_platform';
const DEFAULT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const OTHER = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc';
const ADDED = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const PLAN_KEY = `0x${'a1'.repeat(32)}`;

function Wallet(
  id: string,
  address: string,
  isDefault: boolean
): ExternalWallet {
  return {
    id,
    object: 'wallet',
    account: ACCOUNT,
    wallet_address: address,
    default_for_currency: isDefault,
    status: 'new',
    network: 'ethereum',
    currency: 'usdc',
  } as ExternalWallet;
}

function PlanPrice(id: string, overrides: Partial<Price> = {}): Price {
  return {
    id,
    object: 'price',
    type: 'recurring',
    active: true,
    subscription_plan_id: PLAN_KEY,
    subscription_plan_destination: DEFAULT,
    subscription_plan_destination_change: null,
    ...overrides,
  } as Price;
}

describe('WalletsSectionComponent', () => {
  let api: { Call: jest.Mock };
  let stored: ExternalWallet[];
  let prices: { ListPlanPrices: jest.Mock };

  beforeEach(() => {
    stored = [
      { ...Wallet('wa_fd_other', OTHER, false), usdc_balance: 0 },
      { ...Wallet('wa_fd_default', DEFAULT, true), usdc_balance: 1250.5 },
    ];
    api = {
      Call: jest.fn(async (method: string, endpoint: string) => {
        if (method === 'GET') return { data: stored };
        if (method === 'POST' && endpoint.endsWith('external_accounts')) {
          return Wallet('wa_fd_added', ADDED, false);
        }
        return {};
      }),
    };
    prices = {
      ListPlanPrices: jest.fn().mockResolvedValue([
        PlanPrice('price_fd_a'),
        PlanPrice('price_fd_b'),
        // Simulated plans have nothing to update on-chain.
        PlanPrice('price_fd_sim', { subscription_plan_id: 'sim_plan_x' }),
      ]),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: PriceService, useValue: prices },
        { provide: ConfigService, useValue: { IsTestMode: () => false } },
        {
          provide: AccountService,
          useValue: { account: signal({ id: ACCOUNT }) },
        },
      ],
    });
    TestBed.inject(ExternalWalletService).wallets.set(stored);
  });

  async function Render(): Promise<{
    fixture: ComponentFixture<WalletsSectionComponent>;
    component: WalletsSectionComponent;
    text: () => string;
    rows: () => HTMLElement[];
  }> {
    const fixture = TestBed.createComponent(WalletsSectionComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      component: fixture.componentInstance,
      text: () => {
        fixture.detectChanges();
        return (element.textContent ?? '').replace(/\s+/g, ' ');
      },
      rows: () => {
        fixture.detectChanges();
        return Array.from(
          element.querySelectorAll<HTMLElement>('[data-test="wallet-row"]')
        );
      },
    };
  }

  function Buttons(row: HTMLElement): string[] {
    return Array.from(row.querySelectorAll('.wallet-actions button')).map(
      (button) => (button.textContent ?? '').trim()
    );
  }

  it('lists the default first with its badge and copyable address; only other wallets can be set as default or removed', async () => {
    const { rows } = await Render();

    const [first, second] = rows();
    expect(first.textContent).toContain(DEFAULT);
    expect(first.querySelector('app-status-chip')?.textContent).toContain(
      'Default'
    );
    expect(first.querySelector('app-copy-text')).not.toBeNull();
    expect(Buttons(first)).toEqual([]);
    expect(second.textContent).toContain(OTHER);
    expect(second.querySelector('app-status-chip')).toBeNull();
    expect(Buttons(second)).toEqual(['Set as default', 'Remove']);
  });

  it('lists each wallet with its on-chain USDC, read in one list request', async () => {
    const { rows } = await Render();

    expect(api.Call).toHaveBeenCalledWith(
      'GET',
      `accounts/${ACCOUNT}/external_accounts`,
      { include_usdc_balance: 'true' }
    );
    expect(rows()[0].textContent).toContain('1,250.50 USDC');
    expect(rows()[1].textContent).toContain('0.00 USDC');
  });

  it('adds a wallet that is not the default without a confirm', async () => {
    const { component } = await Render();
    component.OpenAddPanel();
    component.addWalletForm?.OnWalletAddressChange(ADDED);

    await component.SubmitAdd();

    expect(api.Call).toHaveBeenCalledWith(
      'POST',
      `accounts/${ACCOUNT}/external_accounts`,
      expect.objectContaining({
        wallet_address: ADDED,
        default_for_currency: false,
      })
    );
    expect(component.addPanelOpen()).toBe(false);
  });

  it('adds a wallet as the default only after the switch confirm, which says where the USDC stays', async () => {
    const { component, text } = await Render();
    component.OpenAddPanel();
    component.addWalletForm?.OnWalletAddressChange(ADDED);
    component.makeDefault.set(true);

    await component.SubmitAdd();

    expect(api.Call).not.toHaveBeenCalledWith(
      'POST',
      expect.anything(),
      expect.anything()
    );
    expect(text()).toContain(
      'Checkouts, top-ups, payouts and subscription plans move to 0x90F7...b906. 2 plans will be updated on-chain. Your USDC stays in 0x7099...79C8 (1,250.50 USDC). Send it to 0x90F7...b906 after switching. Until then, your available balance counts only the new wallet, and payouts above that amount will fail.'
    );

    await component.ConfirmSetDefault();

    expect(api.Call).toHaveBeenCalledWith(
      'POST',
      `accounts/${ACCOUNT}/external_accounts`,
      expect.objectContaining({
        wallet_address: ADDED,
        default_for_currency: true,
      })
    );
    expect(component.addPanelOpen()).toBe(false);
    expect(component.setDefaultTarget()).toBeNull();
  });

  it('sets a wallet as the default after a confirm that says what moves', async () => {
    const { component, text } = await Render();

    component.AskSetDefault(stored[0]);

    expect(text()).toContain(
      'Checkouts, top-ups, payouts and subscription plans move to 0x9965...A4dc. 2 plans will be updated on-chain. Your USDC stays in 0x7099...79C8 (1,250.50 USDC). Send it to 0x9965...A4dc after switching. Until then, your available balance counts only the new wallet, and payouts above that amount will fail.'
    );
    expect(api.Call).not.toHaveBeenCalledWith(
      'POST',
      expect.stringContaining('wa_fd_other'),
      expect.anything()
    );

    await component.ConfirmSetDefault();

    expect(api.Call).toHaveBeenCalledWith(
      'POST',
      `accounts/${ACCOUNT}/external_accounts/wa_fd_other`,
      { default_for_currency: true }
    );
    expect(component.setDefaultTarget()).toBeNull();
  });

  it('shows why a switch was refused', async () => {
    const { component, text } = await Render();
    api.Call.mockRejectedValueOnce(
      new Error(
        'Wallet 0x7099… has a payout batch awaiting broadcast or confirmation.'
      )
    );

    component.AskSetDefault(stored[0]);
    await component.ConfirmSetDefault();

    expect(component.setDefaultTarget()?.wallet).toEqual(stored[0]);
    expect(text()).toContain('has a payout batch awaiting broadcast');
  });

  it('removes a wallet after a confirm', async () => {
    const { component, text } = await Render();

    component.AskRemove(stored[0]);
    expect(text()).toContain('0x9965...A4dc will no longer be used.');
    await component.ConfirmRemove();

    expect(api.Call).toHaveBeenCalledWith(
      'DELETE',
      `accounts/${ACCOUNT}/external_accounts/wa_fd_other`
    );
  });

  it("shows the plans still moving to a wallet, and the ones that can't", async () => {
    const change = {
      destination: OTHER,
      transaction_hash: null,
      created: 1,
      failure_message: null,
      sent_at: null,
    };
    prices.ListPlanPrices.mockResolvedValue([
      PlanPrice('price_fd_a', {
        subscription_plan_destination_change: { ...change, status: 'pending' },
      }),
    ]);
    const { rows, component } = await Render();

    expect(rows()[1].textContent).toContain('Updating 1 plan on-chain');

    prices.ListPlanPrices.mockResolvedValue([
      PlanPrice('price_fd_a', {
        subscription_plan_destination_change: {
          ...change,
          status: 'failed',
          failure_message: 'plan_owner_mismatch',
        },
      }),
    ]);
    await component.LoadPlans();
    expect(rows()[1].textContent).toContain(
      '1 plan could not move: the operator key does not own them'
    );
  });

  it('counts only the plans that do not already pay the new default', async () => {
    prices.ListPlanPrices.mockResolvedValue([
      PlanPrice('price_fd_a'),
      PlanPrice('price_fd_b', { subscription_plan_destination: OTHER }),
    ]);
    const { component, text } = await Render();

    component.AskSetDefault(stored[0]);

    expect(text()).toContain('1 plan will be updated on-chain.');
  });

  it('reads the plan statuses again after a switch until none is pending', async () => {
    jest.useFakeTimers();
    try {
      const pending = PlanPrice('price_fd_a', {
        subscription_plan_destination_change: {
          destination: OTHER,
          transaction_hash: null,
          status: 'pending',
          created: 1,
          failure_message: null,
          sent_at: null,
        },
      });
      prices.ListPlanPrices.mockResolvedValue([]);
      const { component, rows } = await Render();
      prices.ListPlanPrices.mockResolvedValue([pending]);

      component.AskSetDefault(stored[0]);
      await component.ConfirmSetDefault();
      expect(rows()[1].textContent).toContain('Updating 1 plan on-chain');
      const reads = prices.ListPlanPrices.mock.calls.length;

      prices.ListPlanPrices.mockResolvedValue([
        PlanPrice('price_fd_a', { subscription_plan_destination: OTHER }),
      ]);
      await jest.advanceTimersByTimeAsync(5_000);

      expect(prices.ListPlanPrices.mock.calls.length).toBe(reads + 1);
      expect(rows()[1].textContent).not.toContain('Updating');

      // Nothing is pending any more: no further reads.
      await jest.advanceTimersByTimeAsync(60_000);
      expect(prices.ListPlanPrices.mock.calls.length).toBe(reads + 1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('says a removed wallet still holds USDC', async () => {
    stored[0] = { ...stored[0], usdc_balance: 40 };
    TestBed.inject(ExternalWalletService).wallets.set(stored);
    api.Call.mockImplementation(async (method: string) =>
      method === 'GET' ? { data: stored } : {}
    );
    const { component, text } = await Render();

    component.AskRemove(stored[0]);

    expect(text()).toContain(
      'It still holds 40.00 USDC: send it to your default wallet first.'
    );
  });
});
