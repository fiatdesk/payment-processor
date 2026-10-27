/** @jest-environment node */
import {
  GetEthereumAddressError,
  NormalizeEthereumAddress,
  ValidateEthereumAddress,
} from './ethereum';

const CHECKSUMMED = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const LOWERCASE = CHECKSUMMED.toLowerCase();
const UPPERCASE = `0x${CHECKSUMMED.slice(2).toUpperCase()}`;
/** One letter's case flipped, so the EIP-55 checksum no longer matches. */
const BAD_CHECKSUM = '0x70997970c51812dc3A010C7d01b50e0d17dc79C8';
const CHECKSUM_ERROR =
  'Address checksum is invalid. Paste the address exactly as your wallet shows it.';

describe('Ethereum address validation', () => {
  it.each([CHECKSUMMED, LOWERCASE])('accepts %s', (address) => {
    expect(ValidateEthereumAddress(address)).toBe(true);
    expect(GetEthereumAddressError(address)).toBe('');
  });

  it.each([
    ['an all-uppercase address', UPPERCASE],
    ['a wrong checksum', BAD_CHECKSUM],
  ])('rejects %s with the checksum message', (_label, address) => {
    expect(ValidateEthereumAddress(address)).toBe(false);
    expect(GetEthereumAddressError(address)).toBe(CHECKSUM_ERROR);
  });

  it('rejects malformed and empty input', () => {
    expect(GetEthereumAddressError('')).toBe('Please enter a wallet address');
    expect(GetEthereumAddressError('0x1234')).toBe(
      'Enter a 0x address with 40 hex characters'
    );
    expect(ValidateEthereumAddress('')).toBe(false);
  });

  it('normalises a valid address to its EIP-55 form', () => {
    expect(NormalizeEthereumAddress(LOWERCASE)).toBe(CHECKSUMMED);
    expect(NormalizeEthereumAddress(CHECKSUMMED)).toBe(CHECKSUMMED);
  });

  it('returns input it cannot validate unchanged', () => {
    expect(NormalizeEthereumAddress(UPPERCASE)).toBe(UPPERCASE);
    expect(NormalizeEthereumAddress('0x1234')).toBe('0x1234');
  });
});
