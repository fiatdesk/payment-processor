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
 *
 * @module TopUpMonitor
 */

import { Database } from './Database';
import { DepositKey, TopUpModule } from './TopUp';
import { AccountModule } from './Account';
import { ChainCursorStore } from './ChainCursorStore';
import { ExternalWalletModule } from './ExternalWallet';
import { GetChainConfig } from './chains/Chain';
import type { IncomingDeposit } from './chains/types';
import {
  GetSettlement,
  IsSimulatedSettlement,
  type Settlement,
} from './chains/Settlement';
import { EventService } from './EventService';
import { TopUp, CheckDepositsResponse } from '@zoneless/shared-types';
import { Logger } from '../utils/Logger';

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

  /**
   * Get all platform wallets for monitoring.
   * Returns the default/primary ExternalWallet for each platform account.
   */
  private async GetAllPlatformWallets(): Promise<PlatformWalletInfo[]> {
    const platformAccounts = await this.accountModule.GetPlatformAccounts();
    const wallets: PlatformWalletInfo[] = [];

    for (const account of platformAccounts) {
      const accountWallets =
        await this.externalWalletModule.GetExternalWalletsByAccount(account.id);
      const primaryWallet =
        accountWallets.find((w) => w.default_for_currency) || accountWallets[0];

      if (primaryWallet) {
        wallets.push({
          id: primaryWallet.id,
          account: account.id,
          address: primaryWallet.wallet_address,
        });
      }
    }

    return wallets;
  }

  /**
   * Get the primary wallet for a specific platform account.
   */
  private async GetPlatformWallet(
    platformAccountId: string
  ): Promise<PlatformWalletInfo | null> {
    const wallets = await this.externalWalletModule.GetExternalWalletsByAccount(
      platformAccountId
    );
    const primaryWallet =
      wallets.find((w) => w.default_for_currency) || wallets[0];

    if (!primaryWallet) {
      return null;
    }

    return {
      id: primaryWallet.id,
      account: platformAccountId,
      address: primaryWallet.wallet_address,
    };
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

    const wallet = await this.GetPlatformWallet(platformAccountId);

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
        const topUp = await this.ProcessDeposit(deposit, wallet.account);
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
   * Process a single incoming deposit.
   * Creates a TopUp and emits webhook events.
   *
   * @param deposit - The deposit to process
   * @param platformAccountId - The platform account to credit
   * @returns The created TopUp, or null if skipped or already processed
   */
  private async ProcessDeposit(
    deposit: IncomingDeposit,
    platformAccountId: string
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
        platformAccountId
      );
    } catch (error) {
      if ((error as { code?: number })?.code === DUPLICATE_KEY) {
        Logger.info('Deposit was credited by a concurrent scan', logContext);
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
