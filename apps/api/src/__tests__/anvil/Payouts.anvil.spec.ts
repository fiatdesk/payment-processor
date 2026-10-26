// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  createWalletClient,
  http,
  keccak256,
  maxUint256,
  parseAbi,
  parseTransaction,
  toBytes,
  type Address,
  type Hex,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import type { Balance, Payout, PayoutBatch } from '@zoneless/shared-types';
import { PAYOUT_BATCH_ABI } from '../../modules/chains/abi/PayoutBatch';
import { USDC_ABI } from '../../modules/chains/abi/Usdc';
import { ComputeBatchId } from '../../modules/chains/PayoutEncoding';
import { PayoutModule } from '../../modules/Payout';
import { MemoryDatabase } from '../mocks/MemoryDatabase';
import { StartAnvil, type AnvilContext } from './Anvil';

jest.mock('../../modules/identity/IdentityLite', () => ({
  IdentityLiteModule: jest.fn().mockImplementation(() => ({
    EvaluateAndApply: jest.fn().mockResolvedValue(undefined),
  })),
}));

const BLACKLIST_ABI = parseAbi([
  'function blacklist(address account, bool blacklisted)',
]);

/** Fresh recipients with no USDC, one per payout. */
const RECIPIENTS: Address[] = Array.from(
  { length: 8 },
  (_, i) =>
    privateKeyToAccount(keccak256(toBytes(`payout-recipient-${i + 1}`))).address
);
const AMOUNTS = [1050, 2000, 1, 700, 900, 1200, 300, 450];
const IDS = AMOUNTS.map((_, i) => `po_z_${i + 1}`);

describe('Payouts on Anvil', () => {
  let anvil: AnvilContext | undefined;
  let memory: MemoryDatabase;
  let module: PayoutModule;
  let platform: Address;
  let platformWallet: WalletClient;
  let deployer: WalletClient;
  /** Unsigned transactions of batches built below, for wallet replays. */
  const unsigned: Record<string, Hex> = {};

  beforeAll(async () => {
    anvil = await StartAnvil();
    platform = privateKeyToAccount(anvil.accounts.platform).address;
    platformWallet = createWalletClient({
      account: privateKeyToAccount(anvil.accounts.platform),
      chain: foundry,
      transport: http(anvil.rpcUrl),
    });
    deployer = createWalletClient({
      account: privateKeyToAccount(anvil.accounts.deployer),
      chain: foundry,
      transport: http(anvil.rpcUrl),
    });

    memory = new MemoryDatabase();
    memory.Seed(
      'Accounts',
      { id: 'acct_z_platform', platform_account: 'acct_z_platform' },
      { id: 'acct_z_seller', platform_account: 'acct_z_platform' }
    );
    memory.Seed(
      'ExternalWallets',
      {
        id: 'wa_z_platform',
        account: 'acct_z_platform',
        wallet_address: platform,
        default_for_currency: true,
        status: 'new',
      },
      ...RECIPIENTS.map((address, i) => ({
        id: `wa_z_${i + 1}`,
        account: 'acct_z_seller',
        wallet_address: address,
        status: 'new',
      }))
    );
    memory.Seed('Balances', {
      id: 'bal_z_seller',
      account: 'acct_z_seller',
      available: [{ amount: 0, currency: 'usdc' }],
      pending: [],
    });
    memory.Seed(
      'Payouts',
      ...IDS.map((id, i) => ({
        id,
        object: 'payout',
        account: 'acct_z_seller',
        platform_account: 'acct_z_platform',
        amount: AMOUNTS[i],
        currency: 'usdc',
        destination: `wa_z_${i + 1}`,
        status: 'pending',
        metadata: {},
      }))
    );
    module = new PayoutModule(memory.AsDatabase());
  });

  afterAll(async () => {
    await anvil?.Stop();
  });

  function Context(): AnvilContext {
    if (!anvil) throw new Error('Anvil did not start');
    return anvil;
  }

  function Sign(unsigned: string): Promise<Hex> {
    return privateKeyToAccount(Context().accounts.platform).signTransaction(
      parseTransaction(unsigned as Hex)
    );
  }

  function UsdcBalance(owner: Address): Promise<bigint> {
    const { publicClient, addresses } = Context();
    return publicClient.readContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [owner],
    });
  }

  async function Blacklist(account: Address): Promise<void> {
    const hash = await deployer.writeContract({
      address: Context().addresses.usdc,
      abi: BLACKLIST_ABI,
      functionName: 'blacklist',
      args: [account, true],
      account: deployer.account ?? null,
      chain: foundry,
    });
    await Context().publicClient.waitForTransactionReceipt({ hash });
  }

  function Payout(id: string): Payout {
    return memory.Doc<Payout>('Payouts', id);
  }

  function Batch(id: string): PayoutBatch {
    return memory.Doc<PayoutBatch>('PayoutBatches', id);
  }

  function Available(): number {
    return memory.Doc<Balance>('Balances', 'bal_z_seller').available[0].amount;
  }

  const Build = (payouts: string[]) =>
    module.BuildPayoutsBatch('acct_z_platform', { payouts });

  it('returns the one-time approval for a wallet that never approved PayoutBatch', async () => {
    const { publicClient, addresses } = Context();

    const approval = await Build(IDS.slice(0, 3));

    expect(approval).toMatchObject({
      transaction_type: 'approval',
      to: addresses.usdc,
      chain_id: 31337,
      nonce: await publicClient.getTransactionCount({ address: platform }),
      batch_id: null,
      payouts: [],
    });
    expect(
      parseTransaction(approval.unsigned_transaction as Hex)
    ).toMatchObject({ chainId: 31337, type: 'eip1559' });
  });

  it('settles the signed approval as paid and grants the allowance', async () => {
    const { publicClient, addresses } = Context();
    const [approvalBatch] = memory.All<PayoutBatch>('PayoutBatches');

    const result = await module.BroadcastPayoutsBatch('acct_z_platform', {
      signed_transaction: await Sign(approvalBatch.unsigned_transaction),
      payouts: [],
    });

    expect(result).toMatchObject({
      status: 'paid',
      transaction_type: 'approval',
      payouts: [],
    });
    await expect(
      publicClient.readContract({
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'allowance',
        args: [platform, addresses.payoutBatch],
      })
    ).resolves.toBe(maxUint256);
    expect(Batch(approvalBatch.id).status).toBe('paid');
  });

  it('builds the payout batch, then pays each recipient the exact amount', async () => {
    const { addresses } = Context();

    const built = await Build(IDS.slice(0, 3));
    unsigned.paid = built.unsigned_transaction as Hex;
    expect(built).toMatchObject({
      transaction_type: 'payout',
      to: addresses.payoutBatch,
      batch_id: ComputeBatchId(IDS.slice(0, 3)),
      recipients_count: 3,
      total_amount: 3051,
      gas_limit: expect.stringMatching(/^\d+$/),
      max_fee_per_gas: expect.stringMatching(/^\d+$/),
    });
    const before = await Promise.all(RECIPIENTS.slice(0, 3).map(UsdcBalance));

    const result = await module.BroadcastPayoutsBatch('acct_z_platform', {
      signed_transaction: await Sign(built.unsigned_transaction),
      payouts: IDS.slice(0, 3),
    });

    expect(result).toMatchObject({
      status: 'paid',
      transaction_type: 'payout',
    });
    const after = await Promise.all(RECIPIENTS.slice(0, 3).map(UsdcBalance));
    expect(after.map((balance, i) => balance - before[i])).toEqual([
      10_500_000n,
      20_000_000n,
      10_000n,
    ]);
    for (const id of IDS.slice(0, 3)) {
      expect(Payout(id)).toMatchObject({
        status: 'paid',
        metadata: expect.objectContaining({
          blockchain_tx: result.transaction_hash,
          network: 'ethereum',
        }),
      });
    }
    expect(Batch(built.payout_batch).status).toBe('paid');
  });

  it('reverts a wallet replay of a paid batch with BatchAlreadyPaid, paying nothing twice', async () => {
    const { publicClient, addresses } = Context();
    const before = await Promise.all(RECIPIENTS.slice(0, 3).map(UsdcBalance));
    const { to, data } = parseTransaction(unsigned.paid);
    const replay = await platformWallet.sendTransaction({
      to,
      data,
      gas: 500_000n,
      account: platformWallet.account ?? null,
      chain: foundry,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: replay,
    });
    expect(receipt.status).toBe('reverted');
    await expect(
      publicClient.readContract({
        address: addresses.payoutBatch,
        abi: PAYOUT_BATCH_ABI,
        functionName: 'paid',
        args: [platform, ComputeBatchId(IDS.slice(0, 3))],
      })
    ).resolves.toBe(true);
    await expect(
      Promise.all(RECIPIENTS.slice(0, 3).map(UsdcBalance))
    ).resolves.toEqual(before);
    await expect(
      module.BroadcastPayoutsBatch('acct_z_platform', {
        transaction_hash: replay,
        payouts: IDS.slice(0, 3),
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(IDS.slice(0, 3).map((id) => Payout(id).status)).toEqual([
      'paid',
      'paid',
      'paid',
    ]);
    expect(Available()).toBe(0);
  });

  it('refuses to build for a blacklisted recipient', async () => {
    await Blacklist(RECIPIENTS[3]);

    await expect(Build([IDS[3]])).rejects.toMatchObject({
      statusCode: 400,
      type: 'account_frozen',
      message: expect.stringContaining(RECIPIENTS[3]),
    });
    expect(Payout(IDS[3]).status).toBe('pending');
  });

  it('fails a batch whose recipient was blacklisted after build, refunding it', async () => {
    const built = await Build([IDS[4]]);
    await Blacklist(RECIPIENTS[4]);

    const result = await module.BroadcastPayoutsBatch('acct_z_platform', {
      signed_transaction: await Sign(built.unsigned_transaction),
      payouts: [IDS[4]],
    });

    expect(result).toMatchObject({
      status: 'failed',
      failure_code: 'account_frozen',
      failure_message: expect.stringMatching(/blacklisted/),
    });
    expect(Payout(IDS[4])).toMatchObject({
      status: 'failed',
      failure_code: 'account_frozen',
    });
    expect(Available()).toBe(AMOUNTS[4]);
    expect(Batch(built.payout_batch).status).toBe('failed');
    await expect(UsdcBalance(RECIPIENTS[4])).resolves.toBe(0n);
  });

  it('settles a batch the wallet broadcast itself from its hash', async () => {
    const built = await Build([IDS[5]]);
    const { to, data } = parseTransaction(built.unsigned_transaction as Hex);
    const hash = await platformWallet.sendTransaction({
      to,
      data,
      account: platformWallet.account ?? null,
      chain: foundry,
    });

    const result = await module.BroadcastPayoutsBatch('acct_z_platform', {
      transaction_hash: hash,
      payouts: [IDS[5]],
    });

    expect(result).toMatchObject({ status: 'paid', transaction_hash: hash });
    await expect(UsdcBalance(RECIPIENTS[5])).resolves.toBe(12_000_000n);
    expect(Batch(built.payout_batch)).toMatchObject({
      status: 'paid',
      broadcast_mode: 'transaction_hash',
    });
  });

  it('reconcile replaces a built batch whose nonce another transaction used', async () => {
    const built = await Build([IDS[6]]);
    unsigned.replaced = built.unsigned_transaction as Hex;
    const hash = await platformWallet.sendTransaction({
      to: platform,
      value: 0n,
      account: platformWallet.account ?? null,
      chain: foundry,
    });
    await Context().publicClient.waitForTransactionReceipt({ hash });
    await Context().Mine(1);

    await expect(
      module.ReconcilePayoutBatches('acct_z_platform')
    ).resolves.toMatchObject({ reconciled: 1, failed: 1 });
    expect(Batch(built.payout_batch).status).toBe('replaced');
    expect(Payout(IDS[6]).status).toBe('pending');
    await expect(UsdcBalance(RECIPIENTS[6])).resolves.toBe(0n);
  });

  it('refuses to build payouts the chain already shows paid', async () => {
    // A wallet sends the released batch anyway, at a nonce of its choosing.
    const { to, data } = parseTransaction(unsigned.replaced);
    const hash = await platformWallet.sendTransaction({
      to,
      data,
      account: platformWallet.account ?? null,
      chain: foundry,
    });
    await Context().publicClient.waitForTransactionReceipt({ hash });

    await expect(Build([IDS[6]])).rejects.toMatchObject({
      statusCode: 400,
      type: 'payout_batch_already_paid',
    });
    await expect(UsdcBalance(RECIPIENTS[6])).resolves.toBe(3_000_000n);
  });

  it('reconcile settles a built batch the wallet sent without broadcasting, from its BatchPaid log', async () => {
    const { publicClient } = Context();
    const built = await Build([IDS[7]]);
    const hash = await publicClient.sendRawTransaction({
      serializedTransaction: await Sign(built.unsigned_transaction),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await Context().Mine(1);

    await expect(
      module.ReconcilePayoutBatches('acct_z_platform')
    ).resolves.toMatchObject({ reconciled: 1, paid: 1 });
    expect(Payout(IDS[7])).toMatchObject({
      status: 'paid',
      metadata: expect.objectContaining({ blockchain_tx: hash }),
    });
    await expect(UsdcBalance(RECIPIENTS[7])).resolves.toBe(4_500_000n);
  });
});
