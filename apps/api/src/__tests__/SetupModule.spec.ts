// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { SetupModule, ValidateSetupRequest } from '../modules/Setup';
import { AccountModule } from '../modules/Account';
import { ApiKeyModule } from '../modules/ApiKey';
import { ExternalWalletModule } from '../modules/ExternalWallet';
import { SetupRequest } from '@zoneless/shared-types';
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

const WALLET_ADDRESS = 'D8VMZCmmTUUfhejNhNQKAmqvZCKfUq1qU6RqQKxQwXyX';

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

    it('should reject an invalid wallet_address', () => {
      expect(() =>
        ValidateSetupRequest(BuildRequest({ wallet_address: 'short' }))
      ).toThrow(/^wallet_address must be/);
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
        .mockResolvedValue({ id: 'acct_z_platform' } as never);
      jest
        .mocked(ExternalWalletModule.prototype.CreateExternalWallet)
        .mockResolvedValue({ wallet_address: WALLET_ADDRESS } as never);
      jest
        .mocked(ApiKeyModule.prototype.CreateApiKey)
        .mockResolvedValue({ plaintext_token: 'sk_test_z_1' } as never);

      const response = await module.CreatePlatformAccount(
        BuildRequest({ wallet_address: `  ${WALLET_ADDRESS}  ` })
      );

      expect(
        ExternalWalletModule.prototype.CreateExternalWallet
      ).toHaveBeenCalledWith(
        'acct_z_platform',
        expect.objectContaining({ wallet_address: WALLET_ADDRESS })
      );
      expect(response).toEqual({
        object: 'setup_response',
        success: true,
        api_key: 'sk_test_z_1',
        platform_account_id: 'acct_z_platform',
        wallet_address: WALLET_ADDRESS,
        login_token: 'login_token_test',
      });
    });
  });
});
