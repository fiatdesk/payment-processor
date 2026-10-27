// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Deep links that reopen hosted checkout inside a mobile wallet's in-app
 * browser, where the wallet injects its provider. Formats checked on
 * 2026-10-27:
 *
 * - MetaMask: `https://link.metamask.io/dapp/{dappUrl}`, the dapp URL
 *   without its scheme (example `https://link.metamask.io/dapp/app.uniswap.org`).
 *   Source: https://docs.metamask.io/metamask-connect/evm/guides/metamask-exclusive/use-deeplinks/
 *   ("Open a dapp inside the MetaMask in-app browser") and
 *   https://docs.metamask.io/metamask-connect/supported-platforms/. The
 *   older `metamask.app.link` host is no longer in MetaMask's docs.
 * - Coinbase Wallet: `https://go.cb-w.com/dapp?cb_url={percent-encoded URL}`.
 *   Source: https://docs.cdp.coinbase.com/wallet-sdk/docs/deep-link
 *   ("Mobile Dapp integration via Deep Linking", formerly
 *   docs.cloud.coinbase.com). That page now redirects to the Coinbase Wallet
 *   overview, so the format was read from its indexed copy; Coinbase lists
 *   no replacement.
 */
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
 * Links that open `currentUrl` in each wallet's in-app browser: MetaMask
 * takes the URL without its scheme, Coinbase Wallet the encoded URL.
 */
export function BuildMobileWalletOptions(
  currentUrl: string
): MobileWalletOption[] {
  const withoutScheme = currentUrl.replace(/^https?:\/\//, '');
  return [
    {
      name: 'MetaMask',
      url: `https://link.metamask.io/dapp/${withoutScheme}`,
    },
    {
      name: 'Coinbase Wallet',
      url: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(currentUrl)}`,
    },
  ];
}
