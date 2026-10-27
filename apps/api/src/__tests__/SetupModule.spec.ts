// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { SetupModule, ValidateSetupRequest } from '../modules/Setup';
import { AccountModule } from '../modules/Account';
import { ApiKeyModule } from '../modules/ApiKey';
import { ExternalWalletModule } from '../modules/ExternalWallet';
import { SetupRequest } from '@fiatdesk/shared-types';
import { CreateMockDatabase } from './Setup';

jest.mock('../modules/Database');
jest.mock('../modules/Account');
jest.mock('../modules/ApiKey');
jest.mock('../modules/Person');
jest.mock('../modules/Balance');
jest.mock('../modules/ExternalWallet');
jest.mock('../modules/AppConfig', () => ({
  GetJwtSecret: jest.fn(() => 'test-jwt-secret'),
}));
jest.mock('../utils/Token', () => ({
  SignToken: jest.fn(() => 'login_token_test'),
}));

const WALLET_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

function BuildRequest(overrides: Partial<SetupRequest> = {}): SetupRequest {
  return {
    platform_name: 'Test Platform',
    wallet_address: WALLET_ADDRESS,
    ...overrides,
  };
}

describe('SetupModule', () => {
  let module: SetupModule;

  beforeEach(() => {
    jest.clearAllMocks();
    module = new SetupModule(CreateMockDatabase());
  });

  describe('ValidateSetupRequest', () => {
    it('should accept a request with a wallet_address', () => {
      expect(() => ValidateSetupRequest(BuildRequest())).not.toThrow();
    });

    it('should accept an all-lowercase wallet_address', () => {
      expect(() =>
        ValidateSetupRequest(
          BuildRequest({ wallet_address: WALLET_ADDRESS.toLowerCase() })
        )
      ).not.toThrow();
    });

    it.each([
      ['a short value', 'short'],
      ['a non-hex address', 'D8VMZCmmTUUfhejNhNQKAmqvZCKfUq1qU6RqQKxQwXyX'],
      ['a bad checksum', '0x70997970c51812dc3A010C7d01b50e0d17dc79C8'],
    ])('should reject %s', (_label, walletAddress) => {
      expect(() =>
        ValidateSetupRequest(BuildRequest({ wallet_address: walletAddress }))
      ).toThrow('wallet_address must be a valid Ethereum address');
    });
  });

  describe('CreatePlatformAccount', () => {
    it('should reject a missing wallet_address', async () => {
      await expect(
        module.CreatePlatformAccount(BuildRequest({ wallet_address: '' }))
      ).rejects.toThrow('wallet_address is required');
      expect(AccountModule.prototype.CreateAccount).not.toHaveBeenCalled();
    });

    it('should store the wallet and return it as wallet_address', async () => {
      jest
        .mocked(AccountModule.prototype.CreateAccount)
        .mockResolvedValue({ id: 'acct_fd_platform' } as never);
      jest
        .mocked(ExternalWalletModule.prototype.CreateExternalWallet)
        .mockResolvedValue({ wallet_address: WALLET_ADDRESS } as never);
      jest
        .mocked(ApiKeyModule.prototype.CreateApiKey)
        .mockResolvedValue({ plaintext_token: 'sk_test_fd_1' } as never);

      const response = await module.CreatePlatformAccount(
        BuildRequest({ wallet_address: `  ${WALLET_ADDRESS.toLowerCase()}  ` })
      );

      const walletInput = jest.mocked(
        ExternalWalletModule.prototype.CreateExternalWallet
      ).mock.calls[0][1];
      expect(
        ExternalWalletModule.prototype.CreateExternalWallet
      ).toHaveBeenCalledWith(
        'acct_fd_platform',
        expect.objectContaining({ wallet_address: WALLET_ADDRESS })
      );
      // The wallet module picks the network from the active rail.
      expect(walletInput).not.toHaveProperty('network');
      expect(response).toEqual({
        object: 'setup_response',
        success: true,
        api_key: 'sk_test_fd_1',
        platform_account_id: 'acct_fd_platform',
        wallet_address: WALLET_ADDRESS,
        login_token: 'login_token_test',
      });
    });
  });
});
