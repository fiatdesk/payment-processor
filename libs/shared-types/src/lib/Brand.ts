// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Brand tokens, defined once. `scripts/rebrand.sh` rewrites these values and
 * the matching strings across the repo; code reads them from here.
 */
export const BRAND = {
  productName: 'FiatDesk',
  packageScope: '@fiatdesk',
  idInfix: 'fd',
  connectedAccountHeader: 'fiatdesk-account',
  envPrefix: 'FIATDESK',
  cliBin: 'fiatdesk',
} as const;
