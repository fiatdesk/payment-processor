import { PersonFormData } from '../../shared/forms/person-form/person-form.component';
import { ExternalWalletFormData } from '../../shared/forms/external-wallet-form/external-wallet-form.component';
import { ETHEREUM_NETWORK, ETHEREUM_CURRENCY } from '../validation/ethereum';

export const TEST_PERSON_DATA: PersonFormData = {
  firstName: 'Tom',
  lastName: 'Jones',
  email: 'tom.jones@example.com',
  phone: '+1 4155552671',
  dobDay: 1,
  dobMonth: 1,
  dobYear: 1990,
  addressLine1: '123 Test Street',
  addressLine2: '',
  addressCity: 'San Francisco',
  addressState: 'CA',
  addressPostalCode: '94111',
  addressCountry: 'US',
};

export const TEST_WALLET_DATA: ExternalWalletFormData = {
  walletAddress: '0x1111111111111111111111111111111111111111',
  network: ETHEREUM_NETWORK,
  currency: ETHEREUM_CURRENCY,
};
