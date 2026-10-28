// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import type {
  ArchivedWalletDeposit,
  Balance,
  BalanceTransaction,
  TopUp,
} from '@fiatdesk/shared-types';
import { RecordOnchainPayment } from '../modules/PaymentLedger';
import { DepositIsPaymentError, TopUpModule } from '../modules/TopUp';
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
jest.mock('../utils/Logger', () => ({
  Logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock('../modules/AppConfig', () => ({
  GetAppConfig: jest.fn(() => ({ livemode: false })),
}));
const mockSettlement = CreateMockSettlement();
jest.mock('../modules/chains/Settlement', () => ({
  GetSettlement: () => mockSettlement,
}));
const mockEmit = jest.fn();
jest.mock('../modules/EventService', () => ({
  EventService: jest.fn().mockImplementation(() => ({ Emit: mockEmit })),
}));

const PLATFORM = 'acct_fd_platform';
const BUYER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const OLD_WALLET = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const TX = `0x${'ab'.repeat(32)}`;

function Deposit(overrides: Partial<IncomingDeposit> = {}): IncomingDeposit {
  return {
    transactionHash: TX,
    logIndex: 3,
    amount: 25,
    amountCents: 2500,
    senderAddress: BUYER,
    timestamp: 1_700_000_000,
    blockNumber: 120,
    ...overrides,
  };
}

describe('RecordOnchainPayment', () => {
  let memory: MemoryDatabase;

  beforeEach(() => {
    ResetIdCounter();
    mockEmit.mockReset().mockResolvedValue(undefined);
    memory = new MemoryDatabase();
    memory.Seed('Balances', {
      id: 'bal_fd_platform',
      account: PLATFORM,
      available: [{ amount: 0, currency: 'usdc' }],
      pending: [{ amount: 0, currency: 'usdc' }],
    });
  });

  function Available(): number {
    return memory.Doc<Balance>('Balances', 'bal_fd_platform').available[0]
      .amount;
  }

  function Pay(source = 'cs_fd_paid') {
    return RecordOnchainPayment(memory.AsDatabase(), mockSettlement, {
      source,
      description: `Payment for Checkout Session ${source}`,
      account: PLATFORM,
      amountCents: 2500,
      currency: 'usdc',
      payerWallet: BUYER,
      transactionHash: TX,
    });
  }

  function OfType(type: string): BalanceTransaction[] {
    return memory
      .All<BalanceTransaction>('BalanceTransactions')
      .filter((transaction) => transaction.type === type);
  }

  it('credits the payment once per source', async () => {
    const first = await Pay();
    const again = await Pay();

    expect(again.id).toBe(first.id);
    expect(first).toMatchObject({
      type: 'payment',
      amount: 2500,
      source: 'cs_fd_paid',
      metadata: { blockchain_tx: TX },
    });
    expect(Available()).toBe(2500);
    expect(OfType('topup_reversal')).toHaveLength(0);
  });

  it('reverses the top-up the scan credited for the same transaction first', async () => {
    const topUp = await new TopUpModule(memory.AsDatabase()).CreateFromDeposit(
      Deposit(),
      PLATFORM
    );
    expect(Available()).toBe(2500);

    await Pay();

    expect(Available()).toBe(2500);
    expect(memory.Doc<TopUp>('TopUps', topUp.id).status).toBe('reversed');
    expect(OfType('topup_reversal')).toEqual([
      expect.objectContaining({
        amount: -2500,
        source: topUp.id,
        metadata: { blockchain_tx: TX },
      }),
    ]);
    expect(mockEmit).toHaveBeenCalledWith(
      'topup.reversed',
      PLATFORM,
      expect.objectContaining({ id: topUp.id, status: 'reversed' })
    );
  });

  it('debits a move that credited the payment it carried from an old wallet', async () => {
    memory.Seed('ArchivedWalletDeposits', {
      id: 'awd_fd_1',
      platform_account: PLATFORM,
      wallet_address: OLD_WALLET,
      transaction_hash: TX,
      log_index: 3,
      amount: 2500,
      topup: 'tu_fd_move',
      acknowledged: true,
    } satisfies Partial<ArchivedWalletDeposit>);

    await Pay();

    expect(Available()).toBe(0);
    expect(OfType('topup_reversal')).toEqual([
      expect.objectContaining({ amount: -2500, source: 'tu_fd_move' }),
    ]);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('stops the scan from crediting a transaction already recorded as a payment', async () => {
    await Pay();

    await expect(
      new TopUpModule(memory.AsDatabase()).CreateFromDeposit(
        Deposit(),
        PLATFORM
      )
    ).rejects.toBeInstanceOf(DepositIsPaymentError);
    expect(memory.All('TopUps')).toHaveLength(0);
    expect(Available()).toBe(2500);
  });

  it('leaves top-ups of another platform alone', async () => {
    memory.Seed('Balances', {
      id: 'bal_fd_other',
      account: 'acct_fd_other',
      available: [{ amount: 0, currency: 'usdc' }],
      pending: [],
    });
    await new TopUpModule(memory.AsDatabase()).CreateFromDeposit(
      Deposit(),
      'acct_fd_other'
    );

    await Pay();

    expect(Available()).toBe(2500);
    expect(OfType('topup_reversal')).toHaveLength(0);
  });
});
