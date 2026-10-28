// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { TestBed } from '@angular/core/testing';
import type {
  ArchivedWalletDeposit,
  BalanceDetails,
} from '@fiatdesk/shared-types';
import { ApiService } from '../../../../core';
import { BalanceService } from '../../../../data';
import { ArchivedDepositBannerComponent } from './archived-deposit-banner.component';

const CURRENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const PREVIOUS = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc';

function Deposit(id: string): ArchivedWalletDeposit {
  return {
    id,
    object: 'archived_wallet_deposit',
    platform_account: 'acct_fd_platform',
    wallet_id: 'wa_fd_previous',
    wallet_address: PREVIOUS,
    transaction_hash: `0x${'ab'.repeat(32)}`,
    log_index: Number(id.slice(-1)),
    amount: 1500,
    block_number: 4500,
    sender_address: null,
    topup: null,
    acknowledged: false,
    created: 1,
  };
}

function Details(deposits: ArchivedWalletDeposit[]): BalanceDetails {
  return {
    object: 'balance_details',
    wallet_usdc: 10,
    wallet_native: 0.1,
    native_currency: 'eth',
    connected_accounts_owed: 0,
    platform_available: 1000,
    platform_pending: 0,
    wallet_address: CURRENT,
    archived_wallet_deposits: deposits,
  };
}

describe('ArchivedDepositBannerComponent', () => {
  let api: { Call: jest.Mock };
  let balances: BalanceService;

  beforeEach(() => {
    api = { Call: jest.fn().mockResolvedValue({}) };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: api }],
    });
    balances = TestBed.inject(BalanceService);
  });

  function Render() {
    const fixture = TestBed.createComponent(ArchivedDepositBannerComponent);
    const text = () => {
      fixture.detectChanges();
      return ((fixture.nativeElement as HTMLElement).textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    return { fixture, text };
  }

  it('shows nothing without unacknowledged deposits', () => {
    balances.balanceDetails.set(Details([]));

    expect(Render().text()).toBe('');
  });

  it('says where the USDC is and where to send it, once per wallet', () => {
    balances.balanceDetails.set(Details([Deposit('awd_1'), Deposit('awd_2')]));

    const text = Render().text();

    expect(text).toContain(
      'USDC arrived at your previous wallet 0x9965...A4dc. Send it to your current wallet 0x7099...79C8 to make it available for payouts.'
    );
    expect(text.match(/USDC arrived/g)).toHaveLength(1);
    expect(text).toContain("I've moved it");
  });

  it("acknowledges every deposit of the wallet on I've moved it, and hides the banner", async () => {
    balances.balanceDetails.set(Details([Deposit('awd_1'), Deposit('awd_2')]));
    const { fixture, text } = Render();
    text();

    (
      (fixture.nativeElement as HTMLElement).querySelector(
        'button'
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    expect(api.Call.mock.calls).toEqual([
      ['POST', 'config/archived-deposits/awd_1/acknowledge'],
      ['POST', 'config/archived-deposits/awd_2/acknowledge'],
    ]);
    expect(text()).toBe('');
  });
});
