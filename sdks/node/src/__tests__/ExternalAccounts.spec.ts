// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { ExternalAccounts } from '../resources/ExternalAccounts';
import { HttpClient } from '../HttpClient';

describe('ExternalAccounts Resource', () => {
  let client: jest.Mocked<HttpClient>;
  let externalAccounts: ExternalAccounts;

  beforeEach(() => {
    client = {
      Get: jest.fn(),
      Post: jest.fn(),
      Delete: jest.fn(),
    } as unknown as jest.Mocked<HttpClient>;
    externalAccounts = new ExternalAccounts(client);
  });

  it('replaces the default wallet in one request with archive_previous', async () => {
    const params = {
      wallet_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      default_for_currency: true,
      archive_previous: true,
    };

    await externalAccounts.create('acct_fd_1', params);

    expect(client.Post).toHaveBeenCalledWith(
      '/accounts/acct_fd_1/external_accounts',
      params
    );
  });

  it('asks for each wallet’s on-chain USDC when listing with include_usdc_balance', async () => {
    await externalAccounts.list('acct_fd_1', { include_usdc_balance: true });

    expect(client.Get).toHaveBeenCalledWith(
      '/accounts/acct_fd_1/external_accounts',
      {
        limit: undefined,
        starting_after: undefined,
        ending_before: undefined,
        include_usdc_balance: 'true',
      }
    );
  });
});
