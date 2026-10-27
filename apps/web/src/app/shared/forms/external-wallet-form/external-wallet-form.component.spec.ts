import { TestBed } from '@angular/core/testing';

import { ConfigService } from '../../../data';
import { ExternalWalletFormComponent } from './external-wallet-form.component';

const CHECKSUMMED = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const UPPERCASE = `0x${CHECKSUMMED.slice(2).toUpperCase()}`;

describe('ExternalWalletFormComponent', () => {
  let component: ExternalWalletFormComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: { IsTestMode: () => false } },
      ],
    });
    component = TestBed.createComponent(
      ExternalWalletFormComponent
    ).componentInstance;
  });

  it('submits a lowercase address in its EIP-55 form', () => {
    component.OnWalletAddressChange(` ${CHECKSUMMED.toLowerCase()} `);

    expect(component.IsValid()).toBe(true);
    expect(component.GetFormData()).toEqual({
      walletAddress: CHECKSUMMED,
      network: 'ethereum',
      currency: 'usdc',
    });
  });

  it('emits the normalised address on change', () => {
    const emitted: string[] = [];
    component.formChange.subscribe((data) => emitted.push(data.walletAddress));

    component.OnWalletAddressChange(CHECKSUMMED.toLowerCase());

    expect(emitted).toEqual([CHECKSUMMED]);
  });

  it('rejects an all-uppercase address and leaves it unchanged', () => {
    component.OnWalletAddressChange(UPPERCASE);

    expect(component.IsValid()).toBe(false);
    expect(component.walletAddressError()).toBe(
      'Address checksum is invalid. Paste the address exactly as your wallet shows it.'
    );
    expect(component.GetFormData().walletAddress).toBe(UPPERCASE);
  });
});
