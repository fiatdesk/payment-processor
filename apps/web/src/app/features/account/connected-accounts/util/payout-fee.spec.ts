/** @jest-environment node */
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { FormatEth, FormatGwei, PerRecipientFee } from './payout-fee';

describe('payout fee formatting', () => {
  it('shows wei as ETH with 6 decimals, rounding half up', () => {
    expect(FormatEth('0')).toBe('0.000000');
    expect(FormatEth('3000000000000000')).toBe('0.003000');
    expect(FormatEth('499999999999')).toBe('0.000000');
    expect(FormatEth('500000000000')).toBe('0.000001');
    expect(FormatEth('123456789012345678901')).toBe('123.456789');
  });

  it('splits the fee across recipients', () => {
    expect(PerRecipientFee('3000000000000000', 4)).toBe(
      BigInt('750000000000000')
    );
    expect(PerRecipientFee('3000000000000000', 0)).toBe(
      BigInt('3000000000000000')
    );
  });

  it('shows the gas price in gwei with up to 3 significant digits', () => {
    expect(FormatGwei('20000000000')).toBe('20');
    expect(FormatGwei('15123000000')).toBe('15.1');
    expect(FormatGwei('12300000')).toBe('0.0123');
  });
});
