// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
export type MobileWalletOption = {
  name: string;
  url: string;
};

export function IsMobileBrowser(
  userAgent: string,
  maxTouchPoints = 0
): boolean {
  return (
    /Android|iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  );
}

/**
 * Deep links that reopen this checkout inside a wallet's in-app browser:
 * MetaMask takes the URL without its scheme, Coinbase Wallet the encoded URL.
 */
export function BuildMobileWalletOptions(
  currentUrl: string
): MobileWalletOption[] {
  const withoutScheme = currentUrl.replace(/^https?:\/\//, '');
  return [
    {
      name: 'MetaMask',
      url: `https://metamask.app.link/dapp/${withoutScheme}`,
    },
    {
      name: 'Coinbase Wallet',
      url: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(currentUrl)}`,
    },
  ];
}
