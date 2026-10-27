/** @jest-environment node */
// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { Injector } from '@angular/core';
import {
  parseTransaction,
  recoverTransactionAddress,
  serializeTransaction,
  type Hex,
  type TransactionSerialized,
} from 'viem';
import type {
  Account,
  PayoutBatchBroadcastResponse,
  PayoutBatchBuildResponse,
} from '@zoneless/shared-types';
import {
  AccountLinkService,
  AccountService,
  BalanceService,
  ConfigService,
  ExternalWalletService,
  IdentityService,
  PayoutService,
  TopupService,
  TransferService,
} from '../../../../data';
import { Eip1193Provider, WalletService } from '../../../../core';
import { ConnectedAccountActionsService } from './connected-account-actions.service';

/** Anvil default account #1 (public test key): the platform wallet. */
const PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const PLATFORM_WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const PAYOUT_BATCH = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const USDC = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const CHAIN_ID = 11155111;
const WALLET_HASH = `0x${'cd'.repeat(32)}`;

const ACCOUNT = {
  id: 'acct_z_1',
  payouts_enabled: true,
  settings: {},
} as unknown as Account;

function Unsigned(to: Hex, data: Hex): string {
  return serializeTransaction({
    type: 'eip1559',
    chainId: CHAIN_ID,
    nonce: 4,
    to,
    data,
    value: BigInt(0),
    gas: BigInt(150000),
    maxFeePerGas: BigInt(20000000000),
    maxPriorityFeePerGas: BigInt(1000000000),
  });
}

function PayoutBuild(): PayoutBatchBuildResponse {
  return {
    object: 'payout_batch_build',
    payout_batch: 'pob_z_1',
    replaced_payout_batch: null,
    unsigned_transaction: Unsigned(PAYOUT_BATCH, '0x1234'),
    estimated_fee: '3000000000000000',
    fee_currency: 'eth',
    chain_id: CHAIN_ID,
    nonce: 4,
    to: PAYOUT_BATCH,
    gas_limit: '150000',
    max_fee_per_gas: '20000000000',
    max_priority_fee_per_gas: '1000000000',
    deadline: Math.floor(Date.now() / 1000) + 300,
    release_after: Math.floor(Date.now() / 1000) + 324,
    transaction_type: 'payout',
    batch_id: `0x${'11'.repeat(32)}`,
    payouts: [{ id: 'po_z_1', amount: 2500 }] as never,
    total_amount: 2500,
    recipients_count: 1,
  };
}

function ApprovalBuild(): PayoutBatchBuildResponse {
  return {
    ...PayoutBuild(),
    payout_batch: 'pob_z_approval',
    unsigned_transaction: Unsigned(USDC, '0x095ea7b3'),
    to: USDC,
    deadline: null,
    release_after: null,
    transaction_type: 'approval',
    batch_id: null,
    payouts: [],
    total_amount: 0,
    recipients_count: 0,
  };
}

function Broadcast(
  overrides: Partial<PayoutBatchBroadcastResponse> = {}
): PayoutBatchBroadcastResponse {
  return {
    object: 'payout_batch_broadcast',
    transaction_hash: WALLET_HASH,
    status: 'paid',
    transaction_type: 'payout',
    viewer_url: '',
    payouts: [],
    ...overrides,
  };
}

function ApiFailure(message: string, status: number, type: string): Error {
  return Object.assign(new Error(message), { status, type });
}

class FakeWindow extends EventTarget {
  location = { origin: 'https://pay.example.com' };
}

/** Browser wallet on Sepolia holding the platform account. */
function FakeWallet(
  send: () => unknown = () => WALLET_HASH
): Eip1193Provider & { request: jest.Mock } {
  return {
    request: jest.fn(async ({ method }: { method: string }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [PLATFORM_WALLET.toLowerCase()];
        case 'eth_chainId':
          return '0xaa36a7';
        case 'eth_sendTransaction':
          return send();
        default:
          throw new Error(`Unexpected method ${method}`);
      }
    }),
  };
}

function Sent(provider: {
  request: jest.Mock;
}): { to: string; data: string }[] {
  return provider.request.mock.calls
    .map(([request]) => request)
    .filter((request) => request.method === 'eth_sendTransaction')
    .map((request) => request.params[0]);
}

describe('ConnectedAccountActionsService payouts', () => {
  const payoutService = {
    CreatePayoutForConnectedAccount: jest.fn(),
    BuildPayoutsBatch: jest.fn(),
    BroadcastPayoutsBatch: jest.fn(),
    Reconcile: jest.fn(),
    GetPayout: jest.fn(),
    CancelPayout: jest.fn(),
  };
  const configService = {
    LoadConfig: jest.fn().mockResolvedValue({}),
    IsSimulatedSettlement: jest.fn(() => false),
    GetChainId: jest.fn(() => CHAIN_ID),
    GetExplorerUrl: jest.fn(() => ''),
  };
  let provider: ReturnType<typeof FakeWallet>;
  let service: ConnectedAccountActionsService;

  function Create(wallet: Eip1193Provider = FakeWallet()): void {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: new FakeWindow(),
    });
    const walletService = new WalletService();
    walletService.wallet.set({
      info: { uuid: 'fake', name: 'Fake', icon: '', rdns: '' },
      provider: wallet,
    });
    const injector = Injector.create({
      providers: [
        ConnectedAccountActionsService,
        { provide: WalletService, useValue: walletService },
        { provide: PayoutService, useValue: payoutService },
        { provide: ConfigService, useValue: configService },
        {
          provide: BalanceService,
          useValue: {
            GetBalance: jest.fn().mockResolvedValue({
              available: [{ currency: 'usdc', amount: 100000 }],
              pending: [],
            }),
          },
        },
        {
          provide: ExternalWalletService,
          useValue: {
            GetExternalWallets: jest.fn().mockResolvedValue([
              {
                id: 'wa_z_1',
                default_for_currency: true,
                last4: '9abc',
                network: 'ethereum',
              },
            ]),
          },
        },
        {
          provide: TopupService,
          useValue: {
            GetDepositInfo: jest
              .fn()
              .mockResolvedValue({ wallet_address: PLATFORM_WALLET }),
          },
        },
        { provide: AccountService, useValue: {} },
        { provide: AccountLinkService, useValue: {} },
        { provide: TransferService, useValue: {} },
        { provide: IdentityService, useValue: {} },
      ],
    });
    service = injector.get(ConnectedAccountActionsService);
  }

  async function OpenReadyPayout(): Promise<void> {
    await service.OpenPayout(ACCOUNT);
    service.payoutAmount.set('25.00');
    service.payoutConfirmed.set(true);
  }

  beforeEach(() => {
    // WalletService's window.ethereum fallback timer must not outlive a test.
    jest.useFakeTimers();
    for (const mock of Object.values(payoutService)) mock.mockReset();
    payoutService.CreatePayoutForConnectedAccount.mockResolvedValue({
      id: 'po_z_1',
    });
    configService.IsSimulatedSettlement.mockReturnValue(false);
    provider = FakeWallet();
    Create(provider);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete (globalThis as { window?: unknown }).window;
  });

  describe('wallet path', () => {
    beforeEach(async () => {
      await OpenReadyPayout();
      await service.ConnectPayoutWallet();
    });

    it('builds with a 300 s deadline, then sends from the wallet and posts the transaction_hash', async () => {
      payoutService.BuildPayoutsBatch.mockResolvedValue(PayoutBuild());
      payoutService.BroadcastPayoutsBatch.mockResolvedValue(Broadcast());

      await service.ConfirmPayout();

      expect(payoutService.BuildPayoutsBatch).toHaveBeenCalledWith({
        payouts: ['po_z_1'],
        deadline_seconds: 300,
      });
      expect(service.payoutStep()).toBe('review');
      expect(Sent(provider)).toEqual([]);

      await service.ConfirmPayout();

      expect(Sent(provider)).toEqual([
        expect.objectContaining({
          from: PLATFORM_WALLET,
          to: PAYOUT_BATCH,
          data: '0x1234',
        }),
      ]);
      expect(payoutService.BroadcastPayoutsBatch).toHaveBeenCalledTimes(1);
      expect(
        payoutService.BroadcastPayoutsBatch.mock.calls[0][0]
      ).toStrictEqual({ transaction_hash: WALLET_HASH, payouts: ['po_z_1'] });
      expect(service.payoutOpen()).toBe(false);
      expect(payoutService.CancelPayout).not.toHaveBeenCalled();
    });

    it('signs the approval first, then builds the payout for a second confirmation', async () => {
      payoutService.BuildPayoutsBatch.mockResolvedValueOnce(
        ApprovalBuild()
      ).mockResolvedValueOnce(PayoutBuild());
      payoutService.BroadcastPayoutsBatch.mockResolvedValue(
        Broadcast({ transaction_type: 'approval' })
      );

      await service.ConfirmPayout();
      expect(service.payoutStep()).toBe('approval');

      await service.ConfirmPayout();

      expect(Sent(provider)).toEqual([
        expect.objectContaining({ to: USDC, data: '0x095ea7b3' }),
      ]);
      expect(
        payoutService.BroadcastPayoutsBatch.mock.calls[0][0]
      ).toStrictEqual({ transaction_hash: WALLET_HASH, payouts: [] });
      expect(payoutService.BuildPayoutsBatch).toHaveBeenCalledTimes(2);
      expect(service.payoutStep()).toBe('review');
      expect(service.payoutBuildResult()?.transaction_type).toBe('payout');
    });

    it('never offers the spent approval again when the payout build fails', async () => {
      payoutService.BuildPayoutsBatch.mockResolvedValueOnce(
        ApprovalBuild()
      ).mockRejectedValueOnce(new Error('Request timeout after 30000ms'));
      payoutService.BroadcastPayoutsBatch.mockResolvedValue(
        Broadcast({ transaction_type: 'approval' })
      );

      await service.ConfirmPayout();
      await service.ConfirmPayout();

      expect(service.payoutStep()).toBe('details');
      expect(service.payoutBuildResult()).toBeNull();
      expect(service.payoutError()).toBe('Request timeout after 30000ms');

      payoutService.BuildPayoutsBatch.mockResolvedValueOnce(PayoutBuild());
      await service.ConfirmPayout();

      expect(service.payoutStep()).toBe('review');
      expect(Sent(provider)).toHaveLength(1);
      expect(
        payoutService.CreatePayoutForConnectedAccount
      ).toHaveBeenCalledTimes(1);
    });

    it('waits for confirmations on a pending broadcast and only offers Reconcile', async () => {
      payoutService.BuildPayoutsBatch.mockResolvedValue(PayoutBuild());
      payoutService.BroadcastPayoutsBatch.mockResolvedValue(
        Broadcast({ status: 'pending' })
      );
      payoutService.Reconcile.mockResolvedValue({
        object: 'payout_reconcile',
        reconciled: 1,
        paid: 1,
        failed: 0,
        pending: 0,
      });
      payoutService.GetPayout.mockResolvedValue({
        id: 'po_z_1',
        status: 'paid',
      });

      await service.ConfirmPayout();
      await service.ConfirmPayout();

      expect(service.payoutStep()).toBe('submitted');
      expect(service.payoutNotice()).toBe(
        'Submitted, waiting for confirmations.'
      );
      expect(service.payoutSubmitLabel()).toBe('Reconcile');

      await service.ConfirmPayout();

      expect(payoutService.Reconcile).toHaveBeenCalledTimes(1);
      expect(payoutService.GetPayout).toHaveBeenCalledWith('po_z_1');
      expect(Sent(provider)).toHaveLength(1);
      expect(payoutService.BroadcastPayoutsBatch).toHaveBeenCalledTimes(1);
      expect(service.payoutOpen()).toBe(false);
    });

    it('treats transaction_not_found as submitted and never resends', async () => {
      payoutService.BuildPayoutsBatch.mockResolvedValue(PayoutBuild());
      payoutService.BroadcastPayoutsBatch.mockRejectedValue(
        ApiFailure(
          'Transaction is not visible yet',
          409,
          'transaction_not_found'
        )
      );

      await service.ConfirmPayout();
      await service.ConfirmPayout();

      expect(service.payoutStep()).toBe('submitted');
      expect(service.payoutSubmittedHash()).toBe(WALLET_HASH);
      expect(service.payoutError()).toBe('Transaction is not visible yet');
      expect(Sent(provider)).toHaveLength(1);
    });

    it('treats a wallet error after the prompt as submitted, without broadcasting', async () => {
      provider = FakeWallet(() => {
        throw Object.assign(new Error('RPC endpoint returned an error'), {
          code: -32603,
        });
      });
      Create(provider);
      await OpenReadyPayout();
      await service.ConnectPayoutWallet();
      payoutService.BuildPayoutsBatch.mockResolvedValue(PayoutBuild());

      await service.ConfirmPayout();
      await service.ConfirmPayout();

      expect(service.payoutStep()).toBe('submitted');
      expect(payoutService.BroadcastPayoutsBatch).not.toHaveBeenCalled();
      expect(service.payoutSubmitLabel()).toBe('Reconcile');
    });

    it('lets the user sign again after rejecting the wallet prompt', async () => {
      let rejections = 1;
      provider = FakeWallet(() => {
        if (rejections-- > 0) {
          throw Object.assign(new Error('User rejected the request.'), {
            code: 4001,
          });
        }
        return WALLET_HASH;
      });
      Create(provider);
      await OpenReadyPayout();
      await service.ConnectPayoutWallet();
      payoutService.BuildPayoutsBatch.mockResolvedValue(PayoutBuild());
      payoutService.BroadcastPayoutsBatch.mockResolvedValue(Broadcast());

      await service.ConfirmPayout();
      await service.ConfirmPayout();

      expect(service.payoutStep()).toBe('review');
      expect(service.payoutError()).toMatch(/rejected in the wallet/);

      await service.ConfirmPayout();

      expect(payoutService.BuildPayoutsBatch).toHaveBeenCalledTimes(1);
      expect(payoutService.BroadcastPayoutsBatch).toHaveBeenCalledTimes(1);
      expect(service.payoutOpen()).toBe(false);
    });

    it('does not cancel a payout its built batch holds when the modal closes', async () => {
      payoutService.BuildPayoutsBatch.mockResolvedValue(PayoutBuild());

      await service.ConfirmPayout();
      await service.ClosePayout();

      expect(payoutService.CancelPayout).not.toHaveBeenCalled();
    });
  });

  describe('private-key path', () => {
    it('signs locally, posts the signed_transaction and clears the key', async () => {
      await OpenReadyPayout();
      service.SetPayoutSignerMethod('private_key');
      service.SetPayoutPrivateKey(PRIVATE_KEY);
      await service.ValidatePayoutPrivateKey();
      payoutService.BuildPayoutsBatch.mockResolvedValue(PayoutBuild());
      payoutService.BroadcastPayoutsBatch.mockResolvedValue(Broadcast());

      await service.ConfirmPayout();
      await service.ConfirmPayout();

      const body = payoutService.BroadcastPayoutsBatch.mock.calls[0][0];
      expect(Object.keys(body).sort()).toEqual([
        'payouts',
        'signed_transaction',
      ]);
      expect(body.payouts).toEqual(['po_z_1']);
      await expect(
        recoverTransactionAddress({
          serializedTransaction:
            body.signed_transaction as TransactionSerialized,
        })
      ).resolves.toBe(PLATFORM_WALLET);
      expect(parseTransaction(body.signed_transaction).to).toBe(
        PAYOUT_BATCH.toLowerCase()
      );
      expect(service.payoutPrivateKey()).toBe('');
      expect(Sent(provider)).toEqual([]);
    });

    it('clears the key after the approval signature and asks for it again', async () => {
      await OpenReadyPayout();
      service.SetPayoutSignerMethod('private_key');
      service.SetPayoutPrivateKey(PRIVATE_KEY);
      await service.ValidatePayoutPrivateKey();
      payoutService.BuildPayoutsBatch.mockResolvedValueOnce(
        ApprovalBuild()
      ).mockResolvedValueOnce(PayoutBuild());
      payoutService.BroadcastPayoutsBatch.mockResolvedValue(
        Broadcast({ transaction_type: 'approval' })
      );

      await service.ConfirmPayout();
      await service.ConfirmPayout();

      expect(service.payoutStep()).toBe('review');
      expect(service.payoutPrivateKey()).toBe('');
      expect(service.canSubmitPayout()).toBe(false);
    });
  });

  describe('batch conflicts', () => {
    it('offers Reconcile or Replace when another batch holds the wallet', async () => {
      await OpenReadyPayout();
      await service.ConnectPayoutWallet();
      payoutService.BuildPayoutsBatch.mockRejectedValueOnce(
        ApiFailure(
          'Payout batch pob_z_9 for wallet 0x7099 is built',
          409,
          'payout_batch_in_progress'
        )
      ).mockResolvedValueOnce(PayoutBuild());

      await service.ConfirmPayout();

      expect(service.payoutStep()).toBe('details');
      expect(service.payoutRecovery()).toBe('reconcile_or_replace');

      await service.ReplaceOutstandingBatch();

      expect(
        payoutService.CreatePayoutForConnectedAccount
      ).toHaveBeenCalledTimes(1);
      expect(payoutService.BuildPayoutsBatch).toHaveBeenLastCalledWith({
        payouts: ['po_z_1'],
        deadline_seconds: 300,
        replace: true,
      });
      expect(service.payoutStep()).toBe('review');
    });

    it('cancels the unheld payout when the modal closes after a failed build', async () => {
      await OpenReadyPayout();
      await service.ConnectPayoutWallet();
      payoutService.BuildPayoutsBatch.mockRejectedValue(
        ApiFailure('Recipients are blacklisted', 400, 'account_frozen')
      );

      await service.ConfirmPayout();
      await service.ClosePayout();

      expect(payoutService.CancelPayout).toHaveBeenCalledWith('po_z_1');
    });
  });

  describe('simulated rail', () => {
    it('builds and broadcasts the sim_tx in one step', async () => {
      configService.IsSimulatedSettlement.mockReturnValue(true);
      await OpenReadyPayout();
      payoutService.BuildPayoutsBatch.mockResolvedValue({
        ...PayoutBuild(),
        unsigned_transaction: 'sim_tx',
        chain_id: null,
        to: null,
      });
      payoutService.BroadcastPayoutsBatch.mockResolvedValue(Broadcast());

      await service.ConfirmPayout();

      expect(payoutService.BuildPayoutsBatch).toHaveBeenCalledWith({
        payouts: ['po_z_1'],
        deadline_seconds: 300,
      });
      expect(
        payoutService.BroadcastPayoutsBatch.mock.calls[0][0]
      ).toStrictEqual({ signed_transaction: 'sim_tx', payouts: ['po_z_1'] });
      expect(service.payoutOpen()).toBe(false);
    });
  });
});
