// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { ChainCursorStore } from '../modules/ChainCursorStore';
import { MemoryDatabase } from './mocks/MemoryDatabase';
import { GetFixedTimestamp } from './Setup';

jest.mock('../utils/Timestamp', () => ({
  Now: jest.fn(() => GetFixedTimestamp()),
}));

const SEPOLIA = 11155111;

describe('ChainCursorStore', () => {
  let memory: MemoryDatabase;
  let store: ChainCursorStore;

  beforeEach(() => {
    memory = new MemoryDatabase();
    store = new ChainCursorStore(memory.AsDatabase());
  });

  it('has no cursor before a wallet is first scanned', async () => {
    await expect(store.Get('wa_z_platform', SEPOLIA)).resolves.toBeNull();
  });

  it('stores the last scanned block under the wallet id', async () => {
    await store.Set('wa_z_platform', SEPOLIA, 4998);

    await expect(store.Get('wa_z_platform', SEPOLIA)).resolves.toEqual({
      id: 'wa_z_platform',
      chain_id: SEPOLIA,
      last_scanned_block: 4998,
      updated: GetFixedTimestamp(),
    });
    expect(memory.All('ChainCursors')).toEqual([
      expect.objectContaining({
        id: 'wa_z_platform',
        last_scanned_block: 4998,
      }),
    ]);
  });

  it('replaces the cursor on the next scan', async () => {
    await store.Set('wa_z_platform', SEPOLIA, 4998);
    await store.Set('wa_z_platform', SEPOLIA, 6998);

    await expect(store.Get('wa_z_platform', SEPOLIA)).resolves.toMatchObject({
      last_scanned_block: 6998,
    });
    expect(memory.All('ChainCursors')).toHaveLength(1);
  });

  it('ignores a cursor recorded on another chain', async () => {
    await store.Set('wa_z_platform', 31337, 40);

    await expect(store.Get('wa_z_platform', SEPOLIA)).resolves.toBeNull();
  });

  it('propagates a failed read instead of reporting no cursor', async () => {
    jest
      .spyOn(memory, 'Query')
      .mockRejectedValue(new Error('connection reset'));

    await expect(store.Get('wa_z_platform', SEPOLIA)).rejects.toThrow(
      'connection reset'
    );
  });
});
