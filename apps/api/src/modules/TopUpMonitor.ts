// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * @fileOverview TopUp Monitor - Detects incoming USDC deposits on-chain
 *
 * A deposit is a USDC `Transfer` log to a platform wallet. Each scan reads
 * the chain head once, then walks the blocks after the wallet's cursor
 * (ChainCursors) up to `latest - ETH_CONFIRMATIONS`, in chunks of at most
 * 2000 blocks and at most 10 chunks per scan. A wallet's first scan starts
 * 1000 blocks before the head. The cursor moves past a chunk only once every
 * deposit in it has been credited, so a failure is retried by the next scan.
 * Each log credits once: scans skip logs that already have a top-up, and a
 * unique index on the deposit key stops a concurrent scan from crediting
 * the same log again.
 *
 * IMPORTANT: The TopUpMonitor is DISABLED by default. In multi-instance
 * deployments (e.g., Cloud Run) every instance would scan the same wallets.
 * For production deployments, use the POST /v1/topups/check-deposits endpoint
 * instead, which is triggered on-demand when users confirm they've sent funds.
 * Both run the same scan.
 *
 * To enable the monitor (e.g., for single-instance development), set:
 *   TOPUP_MONITOR_ENABLED=true
 *
 * In multi-tenant mode, the monitor polls all platform wallets.
 *
 * Only the default wallet's deposits are credited. A platform's other
 * wallets (non-default ones, and ones removed in the last 30 days) are
 * scanned the same way, each with its own cursor and before the default,
 * but a deposit to one is recorded in ArchivedWalletDeposits and logged as
 * a warning instead: the payout signer cannot spend it.
 *
 * The ledger counts each cent once:
 * - A deposit whose transaction is a checkout or invoice payment is not
 *   credited; the payment already is (see TopUpModule).
 * - USDC moved to the default from another of the platform's wallets is
 *   credited only for that wallet's recorded deposits it carries: those
 *   not credited yet, not payments, and not themselves moves between the
 *   platform's wallets, oldest first while they fit in the amount moved.
 *   The rest was counted while that wallet was the default. A move is
 *   credited only once the sender's own scan has reached its block.
 * - When a wallet becomes the default, its recorded deposits that are
 *   still uncredited and not dismissed are credited where they sit.
 *
 *
 * @module TopUpMonitor
 */

import { Database } from './Database';
import { DepositIsPaymentError, DepositKey, TopUpModule } from './TopUp';
import { AccountModule } from './Account';
import { ArchivedWalletDepositStore } from './ArchivedWalletDeposits';
import { ChainCursorStore } from './ChainCursorStore';
import { ExternalWalletModule } from './ExternalWallet';
import { GetChainConfig } from './chains/Chain';
import type { IncomingDeposit } from './chains/types';
import {
  SameAddress,
  type ArchivedWalletDeposit,
} from '@fiatdesk/shared-types';
import {
  GetSettlement,
  IsSimulatedSettlement,
  type Settlement,
} from './chains/Settlement';
import { EventService } from './EventService';
import { TopUp, CheckDepositsResponse } from '@fiatdesk/shared-types';
import { Logger } from '../utils/Logger';
import { Now } from '../utils/Timestamp';

// Hardcoded TopUp settings
const TOPUP_POLL_INTERVAL_MS = parseInt(
  process.env.TOPUP_POLL_INTERVAL_MS || '30000',
  10
);
// DISABLED by default; see the module comment
const TOPUP_MONITOR_ENABLED = process.env.TOPUP_MONITOR_ENABLED === 'true';

/** Most blocks in one log request. */
const SCAN_CHUNK_BLOCKS = 2000n;
/** Most log requests per scan; a wallet further behind catches up later. */
const MAX_SCAN_CHUNKS = 10;
/** How far before the head a wallet's first scan starts. */
const FIRST_SCAN_LOOKBACK_BLOCKS = 1000n;
const DUPLICATE_KEY = 11000;
/** How long a removed platform wallet is watched for incoming USDC. */
const REMOVED_WALLET_WATCH_SECONDS = 30 * 24 * 3600;

/**
 * Internal representation of a platform wallet for polling.
 */
interface PlatformWalletInfo {
  /** The wallet ID */
  id: string;
  /** The platform account ID that owns this wallet */
  account: string;
  /** The wallet address */
  address: string;
  /** The default wallet's deposits are credited; others are only alerted */
  credit: boolean;
  /** When the wallet was added: a watched wallet's earlier USDC is not alerted */
  since: number;
  /** Every wallet the platform ever added: transfers between them are moves */
  ownAddresses: string[];
  /** The platform's watched wallets; set on the default only */
  watched: PlatformWalletInfo[];
}

interface ScanResult {
  processed: number;
  errors: number;
  topUps: TopUp[];
  /** First confirmed block this scan left unscanned; null when caught up */
  nextBlock: bigint | null;
}

export class TopUpMonitor {
  private readonly db: Database;
  private readonly topUpModule: TopUpModule;
  private readonly accountModule: AccountModule;
  private readonly externalWalletModule: ExternalWalletModule;
  private readonly cursorStore: ChainCursorStore;
  private readonly archivedDeposits: ArchivedWalletDepositStore;
  private readonly settlement: Settlement;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(db: Database) {
    this.db = db;
    const eventService = new EventService(db);
    this.topUpModule = new TopUpModule(db, eventService);
    this.accountModule = new AccountModule(db);
    this.externalWalletModule = new ExternalWalletModule(db);
    this.cursorStore = new ChainCursorStore(db);
    this.archivedDeposits = new ArchivedWalletDepositStore(db);
    this.settlement = GetSettlement();
  }

  /**
   * Check if the TopUp monitor is enabled via configuration.
   */
  static IsEnabled(): boolean {
    return TOPUP_MONITOR_ENABLED && !IsSimulatedSettlement();
  }

  /**
   * Get the configured poll interval.
   */
  static GetPollInterval(): number {
    return TOPUP_POLL_INTERVAL_MS;
  }

  /**
   * Start the TopUp monitor.
   * Runs an initial check immediately, then polls at the configured interval.
   * In multi-tenant mode, polls all platform wallets.
   */
  Start(): void {
    if (this.isRunning) {
      Logger.warn('TopUpMonitor is already running');
      return;
    }

    if (!TopUpMonitor.IsEnabled()) {
      Logger.info('TopUpMonitor is disabled via configuration');
      return;
    }

    this.isRunning = true;
    Logger.info('TopUpMonitor started', {
      pollInterval: TOPUP_POLL_INTERVAL_MS,
      mode: 'multi-tenant',
    });

    // Run initial check
    this.Poll().catch((error) => {
      Logger.error('TopUpMonitor initial poll failed', error);
    });

    // Set up recurring poll
    this.intervalId = setInterval(() => {
      this.Poll().catch((error) => {
        Logger.error('TopUpMonitor poll failed', error);
      });
    }, TOPUP_POLL_INTERVAL_MS);
  }

  /**
   * Stop the TopUp monitor.
   */
  Stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    Logger.info('TopUpMonitor stopped');
  }

  /** Every platform's wallets to scan (see `GetPlatformWallets`). */
  private async GetAllPlatformWallets(): Promise<PlatformWalletInfo[]> {
    const platformAccounts = await this.accountModule.GetPlatformAccounts();
    const wallets: PlatformWalletInfo[] = [];
    for (const account of platformAccounts) {
      wallets.push(...(await this.GetPlatformWallets(account.id)));
    }
    return wallets;
  }

  /**
   * The platform's watched wallets (active non-default wallets, and wallets
   * removed in the last 30 days), then its default wallet (credited), so a
   * move between them is seen by the sender's scan first. An address is
   * scanned once, so the default's address is never alerted.
   */
  private async GetPlatformWallets(
    platformAccountId: string
  ): Promise<PlatformWalletInfo[]> {
    const primary = await this.externalWalletModule.GetDefaultWallet(
      platformAccountId
    );
    if (!primary) return [];
    const all = await this.externalWalletModule.GetExternalWalletsByAccount(
      platformAccountId,
      true
    );
    const ownAddresses = [
      ...new Set(
        [primary, ...all].map((wallet) => wallet.wallet_address.toLowerCase())
      ),
    ];
    const watched: PlatformWalletInfo[] = [];
    const watchedSince = Now() - REMOVED_WALLET_WATCH_SECONDS;
    const scanned = new Set([primary.wallet_address.toLowerCase()]);
    for (const wallet of all) {
      const address = wallet.wallet_address.toLowerCase();
      if (scanned.has(address)) continue;
      if (
        wallet.status === 'archived' &&
        (wallet.archived_at ?? 0) < watchedSince
      ) {
        continue;
      }
      scanned.add(address);
      watched.push({
        id: wallet.id,
        account: platformAccountId,
        address: wallet.wallet_address,
        credit: false,
        since: wallet.created ?? 0,
        ownAddresses,
        watched: [],
      });
    }
    return [
      ...watched,
      {
        id: primary.id,
        account: platformAccountId,
        address: primary.wallet_address,
        credit: true,
        since: 0,
        ownAddresses,
        watched,
      },
    ];
  }

  /**
   * Poll for new incoming transfers across all platform wallets.
   */
  async Poll(): Promise<void> {
    try {
      Logger.debug('TopUpMonitor polling for new deposits...');

      const wallets = await this.GetAllPlatformWallets();

      if (wallets.length === 0) {
        Logger.debug('No platform wallets configured');
        return;
      }

      Logger.debug(`Polling ${wallets.length} platform wallet(s)`);

      for (const wallet of wallets) {
        try {
          await this.PollWallet(wallet);
        } catch (error) {
          Logger.error('Failed to poll platform wallet', error as Error, {
            walletId: wallet.id,
            account: wallet.account,
          });
        }
      }
    } catch (error) {
      Logger.error('TopUpMonitor poll error', error as Error);
      throw error;
    }
  }

  /**
   * Check for new deposits for a specific platform account.
   * This is the primary method for on-demand deposit detection via the API.
   *
   * @param platformAccountId - The platform account ID to check deposits for
   * @returns CheckDepositsResponse with processed count and created TopUps
   */
  async CheckDepositsForAccount(
    platformAccountId: string
  ): Promise<CheckDepositsResponse> {
    Logger.info('Checking deposits for account', { platformAccountId });

    const wallets = await this.GetPlatformWallets(platformAccountId);
    const wallet = wallets.find((candidate) => candidate.credit);

    if (!wallet) {
      Logger.warn('No wallet found for account', { platformAccountId });
      return {
        object: 'check_deposits_result',
        processed: 0,
        errors: 0,
        topups: [],
        message: 'No wallet configured for this account',
      };
    }

    // Alerts only: a watched wallet that cannot be scanned now is retried
    // on the next check, and holds up only a move it sent to the default.
    for (const other of wallet.watched) {
      try {
        await this.PollWallet(other);
      } catch (error) {
        Logger.error(
          'Failed to scan a watched platform wallet',
          error as Error,
          {
            walletId: other.id,
            account: other.account,
          }
        );
      }
    }
    const result = await this.PollWallet(wallet);

    return {
      object: 'check_deposits_result',
      processed: result.processed,
      errors: result.errors,
      topups: result.topUps,
      message: DescribeScan(result),
    };
  }

  /**
   * Scan a platform wallet's next confirmed blocks for deposits and credit
   * them. Throws, leaving the cursor before the failed range, when the head
   * or a range cannot be read.
   *
   * @param wallet - The platform wallet info to poll
   * @returns Credited top-ups and counts, and where the scan stopped
   */
  private async PollWallet(wallet: PlatformWalletInfo): Promise<ScanResult> {
    const result: ScanResult = {
      processed: 0,
      errors: 0,
      topUps: [],
      nextBlock: null,
    };
    // The simulated rail has no chain to scan.
    if (IsSimulatedSettlement()) return result;
    if (wallet.credit) await this.CreditDepositsAtDefault(wallet, result);

    const { chainId, confirmations } = GetChainConfig();
    // One head read per scan: no chunk may end past this confirmed block.
    const latest = await this.settlement.GetLatestBlockNumber();
    const confirmedBlock = latest - BigInt(confirmations);
    const cursor = await this.cursorStore.Get(wallet.id, chainId);
    let fromBlock = cursor
      ? BigInt(cursor.last_scanned_block) + 1n
      : MaxBlock(latest - FIRST_SCAN_LOOKBACK_BLOCKS, 0n);

    for (
      let chunk = 0;
      chunk < MAX_SCAN_CHUNKS && fromBlock <= confirmedBlock;
      chunk++
    ) {
      const toBlock = MinBlock(
        fromBlock + SCAN_CHUNK_BLOCKS - 1n,
        confirmedBlock
      );
      Logger.debug('Scanning wallet for deposits', {
        walletId: wallet.id,
        address: wallet.address,
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
      });
      const deposits = await this.settlement.GetIncomingDeposits(
        wallet.address,
        { fromBlock, toBlock }
      );
      const errorsBefore = result.errors;
      await this.ProcessDeposits(deposits, wallet, result);
      // Rescan this chunk next time, so the failed deposit is retried.
      if (result.errors > errorsBefore) break;
      await this.cursorStore.Set(wallet.id, chainId, Number(toBlock));
      fromBlock = toBlock + 1n;
    }

    result.nextBlock = fromBlock <= confirmedBlock ? fromBlock : null;
    return result;
  }

  /** Credits the deposits of one scanned range that have no top-up yet. */
  private async ProcessDeposits(
    deposits: IncomingDeposit[],
    wallet: PlatformWalletInfo,
    result: ScanResult
  ): Promise<void> {
    if (deposits.length === 0) return;
    if (!wallet.credit) {
      await this.AlertDeposits(deposits, wallet, result);
      return;
    }

    Logger.info(`Found ${deposits.length} deposit log(s) to check`, {
      walletId: wallet.id,
      account: wallet.account,
    });
    const processedKeys = await this.topUpModule.GetProcessedDepositKeys(
      deposits.map((deposit) => deposit.transactionHash)
    );

    for (const deposit of deposits) {
      if (
        processedKeys.has(DepositKey(deposit.transactionHash, deposit.logIndex))
      ) {
        continue;
      }
      try {
        const topUp = wallet.ownAddresses.includes(
          deposit.senderAddress.toLowerCase()
        )
          ? await this.CreditMove(deposit, wallet)
          : await this.ProcessDeposit(deposit, wallet.account);
        if (topUp) {
          result.processed++;
          result.topUps.push(topUp);
        }
      } catch (error) {
        Logger.error('Failed to process deposit', error as Error, {
          transactionHash: deposit.transactionHash,
          logIndex: deposit.logIndex,
        });
        result.errors++;
      }
    }
  }

  /**
   * Credits USDC moved to the default from another platform wallet, for
   * the uncredited deposits it carries (see the module comment). Throws,
   * so the range is scanned again, while the sender's scan is behind.
   */
  private async CreditMove(
    deposit: IncomingDeposit,
    wallet: PlatformWalletInfo
  ): Promise<TopUp | null> {
    if (SameAddress(deposit.senderAddress, wallet.address)) return null;
    const sender = wallet.watched.find((watched) =>
      SameAddress(watched.address, deposit.senderAddress)
    );
    if (sender) {
      const cursor = await this.cursorStore.Get(
        sender.id,
        GetChainConfig().chainId
      );
      if (!cursor || cursor.last_scanned_block < deposit.blockNumber) {
        throw new Error(
          'The sending wallet is not scanned up to this move yet; retrying'
        );
      }
    }

    const carried: ArchivedWalletDeposit[] = [];
    let amount = 0;
    for (const recorded of await this.archivedDeposits.ListUncredited(
      wallet.account,
      deposit.senderAddress,
      wallet.ownAddresses
    )) {
      if (
        recorded.block_number > deposit.blockNumber ||
        amount + recorded.amount > deposit.amountCents ||
        (await this.topUpModule.IsPaidOnLedger(
          recorded.transaction_hash,
          wallet.account
        ))
      ) {
        continue;
      }
      carried.push(recorded);
      amount += recorded.amount;
    }
    if (amount === 0) {
      Logger.info(
        'USDC moved from another platform wallet; the ledger already counts it',
        {
          transactionHash: deposit.transactionHash,
          logIndex: deposit.logIndex,
          sender: deposit.senderAddress,
          amountCents: deposit.amountCents,
        }
      );
      return null;
    }
    return this.ProcessDeposit(
      { ...deposit, amount: amount / 100, amountCents: amount },
      wallet.account,
      carried
    );
  }

  /**
   * Credits the deposits recorded at the default wallet while it was not
   * the default, each where it sits, unless the platform dismissed them.
   * One that cannot be credited now is counted and tried on the next scan.
   */
  private async CreditDepositsAtDefault(
    wallet: PlatformWalletInfo,
    result: ScanResult
  ): Promise<void> {
    const recorded = await this.archivedDeposits.ListUncredited(
      wallet.account,
      wallet.address,
      wallet.ownAddresses
    );
    for (const deposit of recorded.filter((each) => !each.acknowledged)) {
      try {
        const topUp = await this.ProcessDeposit(
          {
            transactionHash: deposit.transaction_hash,
            logIndex: deposit.log_index,
            amount: deposit.amount / 100,
            amountCents: deposit.amount,
            senderAddress: deposit.sender_address ?? deposit.wallet_address,
            timestamp: deposit.created,
            blockNumber: deposit.block_number,
          },
          wallet.account,
          [deposit]
        );
        if (topUp) {
          result.processed++;
          result.topUps.push(topUp);
        }
      } catch (error) {
        Logger.error(
          'Failed to credit a deposit recorded before its wallet became the default',
          error as Error,
          { archivedWalletDepositId: deposit.id }
        );
        result.errors++;
      }
    }
  }

  /**
   * Records deposits to a wallet that is not the default, once each, and
   * logs a warning; nothing is credited. USDC the address received before
   * the wallet was added is not the platform's. A deposit that could not be
   * recorded counts as an error, so its range is scanned again.
   */
  private async AlertDeposits(
    deposits: IncomingDeposit[],
    wallet: PlatformWalletInfo,
    result: ScanResult
  ): Promise<void> {
    for (const deposit of deposits) {
      if (deposit.timestamp < wallet.since) continue;
      try {
        const alert = await this.archivedDeposits.Record(deposit, wallet);
        if (!alert) continue;
        Logger.warn(
          'USDC arrived at a platform wallet that is not the default; it is not credited',
          {
            walletId: wallet.id,
            walletAddress: wallet.address,
            platformAccountId: wallet.account,
            transactionHash: deposit.transactionHash,
            logIndex: deposit.logIndex,
            amountCents: deposit.amountCents,
          }
        );
      } catch (error) {
        Logger.error(
          'Failed to record a deposit to a watched wallet',
          error as Error,
          {
            transactionHash: deposit.transactionHash,
            logIndex: deposit.logIndex,
          }
        );
        result.errors++;
      }
    }
  }

  /**
   * Process a single incoming deposit.
   * Creates a TopUp and emits webhook events.
   *
   * @param deposit - The deposit to process
   * @param platformAccountId - The platform account to credit
   * @param carried - Recorded deposits this credit covers
   * @returns The created TopUp, or null if skipped or already processed
   */
  private async ProcessDeposit(
    deposit: IncomingDeposit,
    platformAccountId: string,
    carried: ArchivedWalletDeposit[] = []
  ): Promise<TopUp | null> {
    const logContext = {
      transactionHash: deposit.transactionHash,
      logIndex: deposit.logIndex,
    };

    if (deposit.amountCents < 1) {
      Logger.debug('Skipping a transfer worth less than one cent', logContext);
      return null;
    }

    // Narrows the race with a concurrent scan; the unique index closes it.
    if (
      await this.topUpModule.IsDepositProcessed(
        deposit.transactionHash,
        deposit.logIndex
      )
    ) {
      Logger.debug('Skipping an already processed deposit', logContext);
      return null;
    }

    Logger.info('Processing incoming deposit', {
      ...logContext,
      amount: deposit.amount,
      amountCents: deposit.amountCents,
      sender: deposit.senderAddress,
      platformAccountId,
    });

    let topUp: TopUp;
    try {
      // Creates the BalanceTransaction, updates the balance and emits events
      topUp = await this.topUpModule.CreateFromDeposit(
        deposit,
        platformAccountId,
        (created, session) =>
          this.archivedDeposits.MarkCredited(
            carried.map((recorded) => recorded.id),
            created.id,
            session
          )
      );
    } catch (error) {
      if ((error as { code?: number })?.code === DUPLICATE_KEY) {
        Logger.info('Deposit was credited by a concurrent scan', logContext);
        return null;
      }
      if (error instanceof DepositIsPaymentError) {
        Logger.debug(
          'Skipping a payment the ledger already counts',
          logContext
        );
        return null;
      }
      throw error;
    }

    // Detailed audit log for the created TopUp
    Logger.info('TopUp processed successfully', {
      topUpId: topUp.id,
      amount: topUp.amount,
      currency: topUp.currency,
      status: topUp.status,
      blockchain_tx: topUp.metadata.blockchain_tx,
      log_index: topUp.metadata.log_index,
      sender: topUp.metadata.sender_address,
      explorer_url: topUp.metadata.explorer_url,
      balance_transaction: topUp.balance_transaction,
      arrival_date: topUp.arrival_date,
      platformAccountId,
    });

    return topUp;
  }

  /**
   * Manually trigger a poll (useful for testing or API endpoint).
   * Polls all platform wallets.
   */
  async ManualPoll(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      const wallets = await this.GetAllPlatformWallets();

      for (const wallet of wallets) {
        try {
          const result = await this.PollWallet(wallet);
          processed += result.processed;
          errors += result.errors;
        } catch (error) {
          Logger.error('Manual poll failed for wallet', error as Error, {
            walletId: wallet.id,
          });
          errors++;
        }
      }
    } catch (error) {
      Logger.error('Manual poll failed', error as Error);
      throw error;
    }

    return { processed, errors };
  }

  /**
   * Check if the monitor is currently running.
   */
  IsRunning(): boolean {
    return this.isRunning;
  }
}

function MinBlock(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function MaxBlock(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/** The check-deposits message: what was credited and what is left. */
function DescribeScan(result: ScanResult): string {
  const parts = [
    result.processed > 0
      ? `Found and processed ${result.processed} new deposit(s)`
      : 'No new deposits found',
  ];
  if (result.errors > 0) {
    parts.push(
      `${result.errors} deposit(s) could not be credited and will be retried`
    );
  }
  if (result.nextBlock !== null) {
    parts.push(
      `blocks from ${result.nextBlock} on are not scanned yet; call again`
    );
  }
  return parts.join('; ');
}

// Singleton instance for the monitor
let monitorInstance: TopUpMonitor | null = null;

/**
 * Get or create the TopUpMonitor singleton.
 */
export function GetTopUpMonitor(db: Database): TopUpMonitor {
  if (!monitorInstance) {
    monitorInstance = new TopUpMonitor(db);
  }
  return monitorInstance;
}
