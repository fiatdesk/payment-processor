/** @jest-environment node */

import { Injector } from '@angular/core';
import { BalanceService } from './balance.service';
import { ConfigService } from './config.service';
import { ApiService, AuthService } from '../../core';

describe('BalanceService.SyncBalanceOnPageOpen', () => {
  let service: BalanceService;
  const apiCall = jest.fn();
  const isPlatform = jest.fn().mockReturnValue(false);
  const isSimulatedSettlement = jest.fn().mockReturnValue(false);

  beforeEach(() => {
    apiCall.mockReset();
    isPlatform.mockReset().mockReturnValue(false);
    isSimulatedSettlement.mockReset().mockReturnValue(false);
    const injector = Injector.create({
      providers: [
        BalanceService,
        { provide: ApiService, useValue: { Call: apiCall } },
        { provide: AuthService, useValue: { isPlatform } },
        {
          provide: ConfigService,
          useValue: { IsSimulatedSettlement: isSimulatedSettlement },
        },
      ],
    });
    service = injector.get(BalanceService);
  });

  it('syncs the balance when the visitor is a platform account', async () => {
    isPlatform.mockReturnValue(true);
    const details = { platform_available: 1000 };
    apiCall.mockResolvedValueOnce(details).mockResolvedValueOnce({
      available: [{ currency: 'usdc', amount: 1000 }],
      pending: [],
    });

    await service.SyncBalanceOnPageOpen();

    expect(apiCall).toHaveBeenCalledWith('POST', 'balance/sync');
    expect(service.balanceDetails()).toEqual(details);
    expect(service.balance()).toEqual({
      available: [{ currency: 'usdc', amount: 1000 }],
      pending: [],
    });
  });

  it('does not sync for connected (non-platform) accounts', async () => {
    await service.SyncBalanceOnPageOpen();

    expect(apiCall).not.toHaveBeenCalled();
  });

  it('does not sync when settlement is simulated', async () => {
    isPlatform.mockReturnValue(true);
    isSimulatedSettlement.mockReturnValue(true);

    await service.SyncBalanceOnPageOpen();

    expect(apiCall).not.toHaveBeenCalled();
  });

  it('keeps the displayed balance when the sync fails', async () => {
    isPlatform.mockReturnValue(true);
    apiCall.mockRejectedValue(new Error('No wallet configured'));

    await expect(service.SyncBalanceOnPageOpen()).resolves.toBeUndefined();

    expect(apiCall).toHaveBeenCalledWith('POST', 'balance/sync');
    expect(service.balanceDetails()).toBeNull();
    expect(service.balance()).toBeNull();
  });

  it('reuses SyncBalance so the syncing flag is toggled', async () => {
    isPlatform.mockReturnValue(true);
    apiCall.mockResolvedValue({ platform_available: 0 });

    const promise = service.SyncBalanceOnPageOpen();
    expect(service.syncing()).toBe(true);
    await promise;

    expect(service.syncing()).toBe(false);
  });
});
