// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  createWalletClient,
  http,
  keccak256,
  maxUint256,
  toBytes,
  zeroAddress,
  type Address,
  type Hex,
  type TransactionReceipt,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import type { Balance, TopUp } from '@zoneless/shared-types';
import type { ChainCursor } from '../../modules/ChainCursorStore';
import { TopUpMonitor } from '../../modules/TopUpMonitor';
import { PAYOUT_BATCH_ABI } from '../../modules/chains/abi/PayoutBatch';
import { USDC_ABI } from '../../modules/chains/abi/Usdc';
import { GetSettlement } from '../../modules/chains/Settlement';
import { MemoryDatabase } from '../mocks/MemoryDatabase';
import { StartAnvil, type AnvilContext } from './Anvil';

jest.mock('../../modules/EventService', () => ({
  EventService: jest.fn().mockImplementation(() => ({
    Emit: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('../../utils/Logger', () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const PLATFORM_ACCOUNT = 'acct_z_platform';
/** A third recipient in the same transaction, who is not the platform. */
const OTHER: Address = privateKeyToAccount(
  keccak256(toBytes('topup-other'))
).address;
/** USDC the harness mints to the platform wallet, in cents. */
const MINTED_CENTS = 100_000_000;

describe('Top-ups on Anvil', () => {
  let anvil: AnvilContext | undefined;
  let memory: MemoryDatabase;
  let monitor: TopUpMonitor;
  let platform: Address;
  let buyer: WalletClient;
  /** The buyer's disperse paying the platform twice in one transaction. */
  let receipt: TransactionReceipt;

  beforeAll(async () => {
    anvil = await StartAnvil();
    const { publicClient, addresses, accounts } = anvil;
    platform = privateKeyToAccount(accounts.platform).address;
    buyer = createWalletClient({
      account: privateKeyToAccount(accounts.buyer),
      chain: foundry,
      transport: http(anvil.rpcUrl),
    });

    const Send = async (hash: Hex) => {
      const mined = await publicClient.waitForTransactionReceipt({ hash });
      if (mined.status !== 'success') throw new Error(`${hash} reverted`);
      return mined;
    };
    await Send(
      await buyer.writeContract({
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [addresses.payoutBatch, maxUint256],
        account: buyer.account ?? null,
        chain: foundry,
      })
    );
    const { timestamp } = await publicClient.getBlock();
    receipt = await Send(
      await buyer.writeContract({
        address: addresses.payoutBatch,
        abi: PAYOUT_BATCH_ABI,
        functionName: 'disperse',
        args: [
          addresses.usdc,
          [platform, OTHER, platform],
          [1_500_000n, 990_000n, 2_250_000n],
          keccak256(toBytes('topup-batch-1')),
          timestamp + 3600n,
        ],
        account: buyer.account ?? null,
        chain: foundry,
      })
    );
    // ETH_CONFIRMATIONS=1: the disperse block is confirmed one block later.
    await anvil.Mine(1);

    memory = new MemoryDatabase();
    memory.UniqueIndex('TopUps', [
      'metadata.blockchain_tx',
      'metadata.log_index',
    ]);
    memory.Seed('Accounts', {
      id: PLATFORM_ACCOUNT,
      platform_account: PLATFORM_ACCOUNT,
      created: 1,
    });
    memory.Seed('ExternalWallets', {
      id: 'wa_z_platform',
      account: PLATFORM_ACCOUNT,
      wallet_address: platform,
      default_for_currency: true,
      status: 'new',
    });
    memory.Seed('Balances', {
      id: 'bal_z_platform',
      account: PLATFORM_ACCOUNT,
      available: [{ amount: 0, currency: 'usdc' }],
      pending: [{ amount: 0, currency: 'usdc' }],
    });
    monitor = new TopUpMonitor(memory.AsDatabase());
  });

  afterAll(async () => {
    await anvil?.Stop();
  });

  function Context(): AnvilContext {
    if (!anvil) throw new Error('Anvil did not start');
    return anvil;
  }

  function Cursor(): number | undefined {
    return memory.All<ChainCursor>('ChainCursors')[0]?.last_scanned_block;
  }

  function Available(): number {
    return memory.Doc<Balance>('Balances', 'bal_z_platform').available[0]
      .amount;
  }

  it('returns two deposits with distinct log indexes for two Transfer logs to the platform in one transaction', async () => {
    const { publicClient } = Context();
    const block = await publicClient.getBlock({
      blockNumber: receipt.blockNumber,
    });

    const deposits = await GetSettlement().GetIncomingDeposits(platform, {
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    expect(deposits).toHaveLength(2);
    expect(deposits).toEqual([
      expect.objectContaining({ amountCents: 150, amount: 1.5 }),
      expect.objectContaining({ amountCents: 225, amount: 2.25 }),
    ]);
    for (const deposit of deposits) {
      expect(deposit).toMatchObject({
        transactionHash: receipt.transactionHash.toLowerCase(),
        senderAddress: buyer.account?.address,
        blockNumber: Number(receipt.blockNumber),
        timestamp: Number(block.timestamp),
      });
    }
    const [first, second] = deposits;
    expect(first.logIndex).not.toBe(second.logIndex);
  });

  it('credits each log as its own top-up, persists the cursor, and finds nothing on the next scan', async () => {
    const { publicClient } = Context();
    const head = await publicClient.getBlockNumber();

    const result = await monitor.CheckDepositsForAccount(PLATFORM_ACCOUNT);

    // The first scan's window includes the harness mint to the platform.
    expect(result).toMatchObject({ processed: 3, errors: 0 });
    expect(
      result.topups.map((topUp: TopUp) => [
        topUp.amount,
        topUp.metadata.sender_address,
      ])
    ).toEqual([
      [MINTED_CENTS, zeroAddress],
      [150, buyer.account?.address],
      [225, buyer.account?.address],
    ]);
    const disperseTopUps = result.topups.slice(1);
    expect(
      disperseTopUps.map((topUp: TopUp) => topUp.metadata.blockchain_tx)
    ).toEqual([
      receipt.transactionHash.toLowerCase(),
      receipt.transactionHash.toLowerCase(),
    ]);
    expect(
      new Set(disperseTopUps.map((topUp: TopUp) => topUp.metadata.log_index))
        .size
    ).toBe(2);
    expect(Available()).toBe(MINTED_CENTS + 375);
    expect(Cursor()).toBe(Number(head) - 1);

    await Context().Mine(3);
    const scan = jest.spyOn(GetSettlement(), 'GetIncomingDeposits');

    const again = await monitor.CheckDepositsForAccount(PLATFORM_ACCOUNT);

    expect(again).toMatchObject({ processed: 0, errors: 0, topups: [] });
    expect(scan).toHaveBeenCalledWith(platform, {
      fromBlock: head,
      toBlock: head + 2n,
    });
    await expect(scan.mock.results[0].value).resolves.toEqual([]);
    expect(Cursor()).toBe(Number(head) + 2);
    expect(memory.All('TopUps')).toHaveLength(3);
    expect(Available()).toBe(MINTED_CENTS + 375);
    scan.mockRestore();
  });
});
