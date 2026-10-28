// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Storage for `ArchivedWalletDeposits`, the internal record of USDC that
 * reached a platform wallet other than the default (a non-default wallet, or
 * one removed in the last 30 days). Such funds are not credited while they
 * sit there: only the default wallet's funds can be paid out (Fable Q13 #2).
 * They are credited once, by the top-up that sees them reach the default
 * (`topup`). Each transfer log is recorded once; a unique index on
 * (`transaction_hash`, `log_index`) stops a concurrent scan from recording it
 * again.
 *
 * @module ArchivedWalletDeposits
 */

import {
  QueryOperators,
  SameAddress,
  type ArchivedWalletDeposit,
} from '@fiatdesk/shared-types';
import type { ClientSession } from 'mongoose';
import type { Database } from './Database';
import type { IncomingDeposit } from './chains/types';
import { AppError } from '../utils/AppError';
import { GenerateId } from '../utils/IdGenerator';
import { Now } from '../utils/Timestamp';

const COLLECTION = 'ArchivedWalletDeposits';
const DUPLICATE_KEY = 11000;

/** The watched wallet a deposit arrived at. */
export interface WatchedWallet {
  id: string;
  /** The platform account that owns the wallet */
  account: string;
  address: string;
}

export class ArchivedWalletDepositStore {
  constructor(private readonly db: Database) {}

  /** Records the transfer; null when it is recorded already or under a cent. */
  async Record(
    deposit: IncomingDeposit,
    wallet: WatchedWallet
  ): Promise<ArchivedWalletDeposit | null> {
    if (deposit.amountCents < 1) return null;
    const [existing] = await this.db.Query<ArchivedWalletDeposit>({
      collection: COLLECTION,
      method: 'READ',
      parameters: [
        {
          key: 'transaction_hash',
          operator: QueryOperators['=='],
          value: deposit.transactionHash,
        },
        {
          key: 'log_index',
          operator: QueryOperators['=='],
          value: deposit.logIndex,
        },
      ],
    });
    if (existing) return null;
    const record: ArchivedWalletDeposit = {
      id: GenerateId('awd'),
      object: 'archived_wallet_deposit',
      platform_account: wallet.account,
      wallet_id: wallet.id,
      wallet_address: wallet.address,
      transaction_hash: deposit.transactionHash,
      log_index: deposit.logIndex,
      amount: deposit.amountCents,
      block_number: deposit.blockNumber,
      sender_address: deposit.senderAddress,
      topup: null,
      acknowledged: false,
      created: Now(),
    };
    try {
      await this.db.Set(COLLECTION, record.id, record);
    } catch (error) {
      if ((error as { code?: number })?.code === DUPLICATE_KEY) return null;
      throw error;
    }
    return record;
  }

  /**
   * The platform's alerts still to dismiss, oldest first. Transfers to the
   * current default wallet are left out: those funds already sit there.
   */
  async ListUnacknowledged(
    platformAccountId: string,
    defaultWalletAddress: string | null
  ): Promise<ArchivedWalletDeposit[]> {
    const deposits = await this.db.Query<ArchivedWalletDeposit>({
      collection: COLLECTION,
      method: 'READ',
      parameters: [
        {
          key: 'platform_account',
          operator: QueryOperators['=='],
          value: platformAccountId,
        },
        { key: 'acknowledged', operator: QueryOperators['=='], value: false },
      ],
      orderBy: [{ key: 'created', direction: 'asc' }],
    });
    return deposits.filter(
      (deposit) => !SameAddress(deposit.wallet_address, defaultWalletAddress)
    );
  }

  /**
   * The platform's transfers to `walletAddress` that no top-up credited yet,
   * oldest first. Transfers from the platform's own wallets (`ownAddresses`)
   * moved funds the ledger already counts, so they are left out.
   */
  async ListUncredited(
    platformAccountId: string,
    walletAddress: string,
    ownAddresses: string[]
  ): Promise<ArchivedWalletDeposit[]> {
    const deposits = await this.db.Query<ArchivedWalletDeposit>({
      collection: COLLECTION,
      method: 'READ',
      parameters: [
        {
          key: 'platform_account',
          operator: QueryOperators['=='],
          value: platformAccountId,
        },
      ],
      orderBy: [{ key: 'created', direction: 'asc' }],
    });
    return deposits.filter(
      (deposit) =>
        !deposit.topup &&
        SameAddress(deposit.wallet_address, walletAddress) &&
        !ownAddresses.some((own) => SameAddress(own, deposit.sender_address))
    );
  }

  /**
   * Records the top-up that credited the transfers, and dismisses their
   * alerts. Throws when one was credited meanwhile, so the caller's
   * transaction rolls back instead of crediting it twice.
   */
  async MarkCredited(
    ids: string[],
    topUpId: string,
    session?: ClientSession
  ): Promise<void> {
    for (const id of ids) {
      const marked = await this.db.FindOneAndUpdateByFilter(
        COLLECTION,
        { id, topup: { $in: [null] } },
        { topup: topUpId, acknowledged: true },
        session
      );
      if (!marked) {
        throw new Error(`Archived wallet deposit ${id} is already credited`);
      }
    }
  }

  /** Transfers in the transaction that a top-up credited. */
  async ListCreditedIn(
    platformAccountId: string,
    transactionHash: string
  ): Promise<ArchivedWalletDeposit[]> {
    const deposits = await this.db.Query<ArchivedWalletDeposit>({
      collection: COLLECTION,
      method: 'READ',
      parameters: [
        {
          key: 'platform_account',
          operator: QueryOperators['=='],
          value: platformAccountId,
        },
        {
          key: 'transaction_hash',
          operator: QueryOperators['=='],
          value: transactionHash,
        },
      ],
    });
    return deposits.filter((deposit) => deposit.topup);
  }

  /** Dismisses the platform's alert; 404 for another platform's. */
  async Acknowledge(
    platformAccountId: string,
    id: string
  ): Promise<ArchivedWalletDeposit> {
    const deposit = await this.db.Get<ArchivedWalletDeposit>(COLLECTION, id);
    if (!deposit || deposit.platform_account !== platformAccountId) {
      throw new AppError(
        `No such archived wallet deposit: '${id}'`,
        404,
        'resource_missing'
      );
    }
    if (deposit.acknowledged) return deposit;
    return (
      (await this.db.Update<ArchivedWalletDeposit>(COLLECTION, id, {
        acknowledged: true,
      })) ?? { ...deposit, acknowledged: true }
    );
  }
}
