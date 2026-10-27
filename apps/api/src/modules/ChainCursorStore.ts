// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Storage for `ChainCursors`, the internal record of how far deposit
 * detection has scanned each platform wallet. One cursor per wallet
 * (`id` = the wallet's ExternalWallet id); a cursor recorded on another chain
 * does not count, so switching chains starts a fresh scan.
 *
 * @module ChainCursorStore
 */

import { QueryOperators } from '@fiatdesk/shared-types';
import { Now } from '../utils/Timestamp';
import type { Database } from './Database';

const COLLECTION = 'ChainCursors';

export interface ChainCursor {
  /** ExternalWallet id of the scanned platform wallet */
  id: string;
  chain_id: number;
  /** Every block up to and including this one has been scanned */
  last_scanned_block: number;
  updated: number;
}

export class ChainCursorStore {
  constructor(private readonly db: Database) {}

  /**
   * The wallet's cursor on `chainId`, or null before its first scan there.
   * A failed read throws: Database.Get would return null, and a first scan
   * from that would move the cursor past blocks never scanned.
   */
  async Get(walletId: string, chainId: number): Promise<ChainCursor | null> {
    const [cursor] = await this.db.Query<ChainCursor>({
      method: 'READ',
      collection: COLLECTION,
      parameters: [
        { key: 'id', operator: QueryOperators['=='], value: walletId },
      ],
    });
    return cursor?.chain_id === chainId ? cursor : null;
  }

  async Set(
    walletId: string,
    chainId: number,
    lastScannedBlock: number
  ): Promise<ChainCursor> {
    const cursor: ChainCursor = {
      id: walletId,
      chain_id: chainId,
      last_scanned_block: lastScannedBlock,
      updated: Now(),
    };
    await this.db.Set(COLLECTION, walletId, cursor);
    return cursor;
  }
}
