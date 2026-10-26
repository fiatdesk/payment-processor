import { privateKeyToAccount } from 'viem/accounts';
import { CreateWalletBackup } from './Wallet';

/** Anvil default account #0 (public test key). */
const PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

describe('Wallet backup', () => {
  it('exports the address and an SDK-compatible private key', () => {
    const backup = CreateWalletBackup(ADDRESS, PRIVATE_KEY);

    expect(backup).toEqual({
      address: ADDRESS,
      privateKey: PRIVATE_KEY,
      version: 3,
    });
    expect(privateKeyToAccount(backup.privateKey).address).toBe(backup.address);
  });

  it('rejects malformed stored wallet keys', () => {
    expect(() =>
      CreateWalletBackup(ADDRESS, Buffer.alloc(64).toString('base64'))
    ).toThrow('The stored wallet key is invalid.');
  });

  it('rejects a stored key that belongs to another wallet', () => {
    expect(() =>
      CreateWalletBackup(
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        PRIVATE_KEY
      )
    ).toThrow('The stored wallet key does not match the wallet address.');
  });
});
