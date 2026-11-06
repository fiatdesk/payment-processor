import { OriginExplorerTxUrl, OriginNetworkLabel } from './origin-chain';

describe('origin-chain', () => {
  it('builds a NEAR explorer link for a real hash', () => {
    expect(OriginExplorerTxUrl('near', 'abc123')).toBe(
      'https://nearblocks.io/txns/abc123'
    );
  });

  it('returns null for simulated hashes, unknown networks and missing hashes', () => {
    expect(OriginExplorerTxUrl('near', 'sim_abc')).toBeNull();
    expect(OriginExplorerTxUrl('solana', 'abc')).toBeNull();
    expect(OriginExplorerTxUrl('near', null)).toBeNull();
  });

  it('keeps NEAR upper case and title-cases other networks', () => {
    expect(OriginNetworkLabel('near')).toBe('NEAR');
    expect(OriginNetworkLabel('solana')).toBe('Solana');
  });
});
