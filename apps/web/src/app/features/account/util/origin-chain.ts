const ORIGIN_EXPLORER_TX_URLS: Record<string, string> = {
  near: 'https://nearblocks.io/txns/',
};

export function OriginExplorerTxUrl(
  network: string | null | undefined,
  hash: string | null | undefined
): string | null {
  const base = network ? ORIGIN_EXPLORER_TX_URLS[network.toLowerCase()] : null;
  if (!base || !hash || hash.startsWith('sim_')) return null;
  return `${base}${hash}`;
}

export function OriginNetworkLabel(network: string): string {
  return network.toLowerCase() === 'near'
    ? 'NEAR'
    : network.charAt(0).toUpperCase() + network.slice(1);
}
