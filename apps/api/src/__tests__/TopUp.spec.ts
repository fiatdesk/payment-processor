// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import type { Balance, TopUp } from '@zoneless/shared-types';
import type { EventService } from '../modules/EventService';
import { TopUpModule } from '../modules/TopUp';
import type { IncomingDeposit } from '../modules/chains/types';
import { MemoryDatabase } from './mocks/MemoryDatabase';
import { CreateMockSettlement } from './mocks/Settlement';
import {
  DeterministicId,
  DeterministicToken,
  GetFixedTimestamp,
  ResetIdCounter,
} from './Setup';

jest.mock('../utils/IdGenerator', () => ({
  GenerateId: jest.fn((prefix: string) => DeterministicId(prefix)),
  GenerateToken: jest.fn((prefix: string) => DeterministicToken(prefix)),
}));
jest.mock('../utils/Timestamp', () => ({
  Now: jest.fn(() => GetFixedTimestamp()),
}));
jest.mock('../modules/AppConfig', () => ({
  GetAppConfig: jest.fn(() => ({ livemode: false })),
}));
const mockSettlement = CreateMockSettlement();
jest.mock('../modules/chains/Settlement', () => ({
  GetSettlement: () => mockSettlement,
  SIMULATED_TEST_WALLET: jest.requireActual('../modules/chains/Settlement')
    .SIMULATED_TEST_WALLET,
}));

const PLATFORM = 'acct_z_platform';
const BUYER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const TX = `0x${'ab'.repeat(32)}`;

function Deposit(overrides: Partial<IncomingDeposit> = {}): IncomingDeposit {
  return {
    transactionHash: TX,
    logIndex: 0,
    amount: 15,
    amountCents: 1500,
    senderAddress: BUYER,
    timestamp: 1_700_000_000,
    blockNumber: 120,
    ...overrides,
  };
}

/** The unique index Database declares on TopUps (see Database.GetModel). */
const DEPOSIT_KEY_INDEX = ['metadata.blockchain_tx', 'metadata.log_index'];

describe('TopUpModule deposits', () => {
  let memory: MemoryDatabase;
  let emit: jest.Mock;
  let module: TopUpModule;

  beforeEach(() => {
    ResetIdCounter();
    memory = new MemoryDatabase();
    memory.UniqueIndex('TopUps', DEPOSIT_KEY_INDEX);
    memory.Seed('Balances', {
      id: 'bal_z_platform',
      account: PLATFORM,
      available: [{ amount: 0, currency: 'usdc' }],
      pending: [{ amount: 0, currency: 'usdc' }],
    });
    emit = jest.fn().mockResolvedValue(undefined);
    module = new TopUpModule(memory.AsDatabase(), {
      Emit: emit,
    } as unknown as EventService);
  });

  function Available(): number {
    return memory.Doc<Balance>('Balances', 'bal_z_platform').available[0]
      .amount;
  }

  it('creates two top-ups for two Transfer logs of one transaction', async () => {
    const first = await module.CreateFromDeposit(Deposit(), PLATFORM);
    const second = await module.CreateFromDeposit(
      Deposit({ logIndex: 3, amount: 22.5, amountCents: 2250 }),
      PLATFORM
    );

    expect(first.id).not.toBe(second.id);
    expect(memory.All<TopUp>('TopUps').map((topUp) => topUp.metadata)).toEqual([
      expect.objectContaining({ blockchain_tx: TX, log_index: '0' }),
      expect.objectContaining({ blockchain_tx: TX, log_index: '3' }),
    ]);
    expect(Available()).toBe(3750);
    await expect(module.IsDepositProcessed(TX, 0)).resolves.toBe(true);
    await expect(module.IsDepositProcessed(TX, 3)).resolves.toBe(true);
    await expect(module.IsDepositProcessed(TX, 1)).resolves.toBe(false);
  });

  it('records the deposit on the top-up and credits the balance once', async () => {
    const topUp = await module.CreateFromDeposit(Deposit(), PLATFORM);

    expect(topUp).toMatchObject({
      amount: 1500,
      currency: 'usdc',
      status: 'succeeded',
      account: PLATFORM,
      source: { type: 'crypto_deposit' },
      metadata: {
        blockchain_tx: TX,
        log_index: '0',
        network: 'ethereum',
        sender_address: BUYER,
        explorer_url: `https://sepolia.etherscan.io/tx/${TX}`,
      },
    });
    expect(emit.mock.calls.map(([type]) => type)).toEqual([
      'topup.created',
      'topup.succeeded',
    ]);
  });

  it('refuses a second top-up for the same log with a duplicate key, crediting once', async () => {
    await module.CreateFromDeposit(Deposit(), PLATFORM);

    await expect(
      module.CreateFromDeposit(Deposit(), PLATFORM)
    ).rejects.toMatchObject({ code: 11000 });
    expect(memory.All<TopUp>('TopUps')).toHaveLength(1);
    expect(memory.All('BalanceTransactions')).toHaveLength(1);
    expect(Available()).toBe(1500);
  });

  it('returns the keys of processed logs among the given transactions', async () => {
    const other = `0x${'cd'.repeat(32)}`;
    await module.CreateFromDeposit(Deposit(), PLATFORM);
    await module.CreateFromDeposit(Deposit({ logIndex: 4 }), PLATFORM);
    await module.CreateFromDeposit(
      Deposit({ transactionHash: other }),
      PLATFORM
    );

    await expect(module.GetProcessedDepositKeys([TX])).resolves.toEqual(
      new Set([`${TX}:0`, `${TX}:4`])
    );
    await expect(module.GetProcessedDepositKeys([])).resolves.toEqual(
      new Set()
    );
  });

  it('credits simulated deposits from the simulated test wallet', async () => {
    const topUp = await module.CreateSimulatedDeposit(500, PLATFORM);

    expect(topUp.metadata).toMatchObject({
      sender_address: '0x1111111111111111111111111111111111111111',
      log_index: '0',
    });
    expect(Available()).toBe(500);
  });

  describe('deposit keys in API metadata', () => {
    it('refuses to create a top-up that claims a deposit key', async () => {
      for (const key of ['blockchain_tx', 'log_index']) {
        await expect(
          module.Create(
            { amount: 100, currency: 'usdc', metadata: { [key]: '0' } },
            PLATFORM
          )
        ).rejects.toMatchObject({
          statusCode: 400,
          type: 'invalid_request_error',
          message: expect.stringContaining(`metadata.${key}`),
        });
      }
      expect(memory.All('TopUps')).toHaveLength(0);
    });

    it('refuses to change or unset the deposit key of a top-up', async () => {
      const topUp = await module.CreateFromDeposit(Deposit(), PLATFORM);

      const edits: Record<string, string>[] = [
        { blockchain_tx: '' },
        { log_index: '7' },
        { blockchain_tx: `0x${'ef'.repeat(32)}` },
      ];
      for (const metadata of edits) {
        await expect(
          module.UpdateTopUp(topUp.id, { metadata })
        ).rejects.toMatchObject({ statusCode: 400 });
      }
      await expect(
        module.UpdateTopUp(topUp.id, { metadata: { order_id: '6735' } })
      ).resolves.toMatchObject({
        metadata: { blockchain_tx: TX, log_index: '0', order_id: '6735' },
      });
    });
  });
});

describe('Database TopUps index', () => {
  it('declares the deposit dedupe key: one top-up per transaction hash and log index', () => {
    const { Database: RealDatabase } = jest.requireActual<
      typeof import('../modules/Database')
    >('../modules/Database');
    const model = (
      new RealDatabase() as unknown as {
        GetModel(name: string): {
          schema: { indexes(): [Record<string, number>, object][] };
        };
      }
    ).GetModel('TopUps');

    expect(model.schema.indexes()).toContainEqual([
      { 'metadata.blockchain_tx': 1, 'metadata.log_index': 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: {
          'metadata.blockchain_tx': { $exists: true },
          'metadata.log_index': { $exists: true },
        },
      }),
    ]);
  });
});
