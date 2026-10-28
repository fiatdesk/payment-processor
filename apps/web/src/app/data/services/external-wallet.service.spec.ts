// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { TestBed } from '@angular/core/testing';
import type { ExternalWallet } from '@fiatdesk/shared-types';
import { ApiService } from '../../core';
import { ExternalWalletService } from './external-wallet.service';

const ACCOUNT = 'acct_fd_platform';
const OLD = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const NEW = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc';

function Wallet(
  id: string,
  address: string,
  isDefault: boolean | null
): ExternalWallet {
  return {
    id,
    wallet_address: address,
    default_for_currency: isDefault,
  } as ExternalWallet;
}

describe('ExternalWalletService', () => {
  let api: { Call: jest.Mock };
  let service: ExternalWalletService;

  beforeEach(() => {
    api = { Call: jest.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: api }],
    });
    service = TestBed.inject(ExternalWalletService);
  });

  it('replaces the payout wallet in one request that adds the new default and deletes the old one', async () => {
    service.wallets.set([Wallet('wa_fd_old', OLD, true)]);
    api.Call.mockImplementation(async (method: string) =>
      method === 'POST'
        ? Wallet('wa_fd_new', NEW, true)
        : method === 'GET'
        ? { data: [Wallet('wa_fd_new', NEW, true)] }
        : {}
    );

    const wallet = await service.SaveExternalWallet(ACCOUNT, {
      wallet_address: NEW,
    });

    expect(api.Call.mock.calls).toEqual([
      [
        'POST',
        `accounts/${ACCOUNT}/external_accounts`,
        {
          wallet_address: NEW,
          default_for_currency: true,
          archive_previous: true,
        },
      ],
      ['GET', `accounts/${ACCOUNT}/external_accounts`, {}],
    ]);
    expect(wallet.id).toBe('wa_fd_new');
    expect(service.wallet()?.id).toBe('wa_fd_new');
  });

  it('adds the first wallet of an account without replacing anything', async () => {
    api.Call.mockImplementation(async (method: string) =>
      method === 'POST'
        ? Wallet('wa_fd_new', NEW, true)
        : { data: [Wallet('wa_fd_new', NEW, true)] }
    );

    await service.SaveExternalWallet(ACCOUNT, { wallet_address: NEW });

    expect(api.Call.mock.calls[0]).toEqual([
      'POST',
      `accounts/${ACCOUNT}/external_accounts`,
      { wallet_address: NEW, default_for_currency: true },
    ]);
  });

  it("reads each wallet's USDC when asked", async () => {
    api.Call.mockResolvedValue({ data: [] });

    await service.GetExternalWallets(ACCOUNT, { usdcBalance: true });

    expect(api.Call).toHaveBeenCalledWith(
      'GET',
      `accounts/${ACCOUNT}/external_accounts`,
      { include_usdc_balance: 'true' }
    );
  });

  it('keeps the wallet when the address is the same, in any case', async () => {
    service.wallets.set([Wallet('wa_fd_old', OLD, true)]);

    await service.SaveExternalWallet(ACCOUNT, {
      wallet_address: OLD.toLowerCase(),
    });

    expect(api.Call).not.toHaveBeenCalled();
  });

  it('takes the flagged wallet as the default, else the newest', () => {
    service.wallets.set([
      Wallet('wa_fd_newest', NEW, false),
      Wallet('wa_fd_flagged', OLD, true),
    ]);
    expect(service.wallet()?.id).toBe('wa_fd_flagged');

    service.wallets.set([
      Wallet('wa_fd_newest', NEW, null),
      Wallet('wa_fd_older', OLD, null),
    ]);
    expect(service.wallet()?.id).toBe('wa_fd_newest');
  });
});
