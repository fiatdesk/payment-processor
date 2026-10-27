// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { TestBed } from '@angular/core/testing';
import type { PayoutBatchBuildResponse } from '@zoneless/shared-types';
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
} from '../../../../../data';
import { WalletService } from '../../../../../core';
import { ConnectedAccountActionsService } from '../../services/connected-account-actions.service';
import { FormatClockTime } from '../../util/payout-fee';
import { PayoutModalComponent } from './payout-modal.component';

const PLATFORM_WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const HASH = `0x${'cd'.repeat(32)}`;
const DEADLINE = 1761600600;
const RELEASE_AFTER = 1761600624;

function PayoutBuild(
  overrides: Partial<PayoutBatchBuildResponse> = {}
): PayoutBatchBuildResponse {
  return {
    object: 'payout_batch_build',
    payout_batch: 'pob_z_1',
    replaced_payout_batch: null,
    unsigned_transaction: '0x02',
    estimated_fee: '3000000000000000',
    fee_currency: 'eth',
    chain_id: 11155111,
    nonce: 4,
    to: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    gas_limit: '150000',
    max_fee_per_gas: '20000000000',
    max_priority_fee_per_gas: '1000000000',
    deadline: DEADLINE,
    release_after: RELEASE_AFTER,
    transaction_type: 'payout',
    batch_id: `0x${'11'.repeat(32)}`,
    payouts: [],
    total_amount: 2500,
    recipients_count: 2,
    ...overrides,
  };
}

describe('PayoutModalComponent', () => {
  let actions: ConnectedAccountActionsService;

  function Render(): {
    text: string;
    buttons: () => HTMLButtonElement[];
    element: HTMLElement;
  } {
    const fixture = TestBed.createComponent(PayoutModalComponent);
    actions.payoutOpen.set(true);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return {
      text: (element.textContent ?? '').replace(/\s+/g, ' '),
      buttons: () => Array.from(element.querySelectorAll('button')),
      element,
    };
  }

  /** Labelled buttons only (the header close button is an icon). */
  function ButtonLabels(buttons: HTMLButtonElement[]): string[] {
    return buttons
      .map((button) => (button.textContent ?? '').trim())
      .filter(Boolean);
  }

  /** The fee summary as label/value pairs. */
  function FeeRows(element: HTMLElement): [string, string][] {
    const cells = Array.from(
      element.querySelectorAll('.fee-summary dt, .fee-summary dd')
    ).map((cell) => (cell.textContent ?? '').trim());
    const rows: [string, string][] = [];
    for (let i = 0; i < cells.length; i += 2)
      rows.push([cells[i], cells[i + 1]]);
    return rows;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PayoutModalComponent],
      providers: [
        ConnectedAccountActionsService,
        {
          provide: WalletService,
          useValue: { GetAddress: () => PLATFORM_WALLET, Connect: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            IsSimulatedSettlement: () => false,
            GetChainId: () => 11155111,
            GetExplorerUrl: (type: string, value: string) =>
              value ? `https://sepolia.etherscan.io/${type}/${value}` : '',
          },
        },
        { provide: PayoutService, useValue: {} },
        { provide: BalanceService, useValue: {} },
        { provide: ExternalWalletService, useValue: {} },
        { provide: TopupService, useValue: {} },
        { provide: AccountService, useValue: {} },
        { provide: AccountLinkService, useValue: {} },
        { provide: TransferService, useValue: {} },
        { provide: IdentityService, useValue: {} },
      ],
    });
    actions = TestBed.inject(ConnectedAccountActionsService);
    actions.payoutPlatformWalletAddress.set(PLATFORM_WALLET);
    actions.payoutCreatedId.set('po_z_1');
  });

  it('shows the fee in ETH, per recipient and as a gas price before signing', () => {
    actions.payoutStep.set('review');
    actions.payoutBuildResult.set(PayoutBuild());

    const { text, buttons, element } = Render();

    expect(FeeRows(element)).toEqual([
      ['Network fee', 'Up to 0.003000 ETH'],
      ['Per recipient', '0.001500 ETH'],
      ['Gas price', 'Up to 20 gwei'],
    ]);
    expect(text).toContain(
      'Network gas is paid in ETH from the platform wallet; see the gas guide.'
    );
    expect(text).not.toContain('%');
    expect(text).toContain(`Sign before ${FormatClockTime(DEADLINE)}.`);
    expect(text).toContain(
      `Closing keeps this payout reserved until ${FormatClockTime(
        RELEASE_AFTER
      )}; it can be canceled from the payouts list after that.`
    );
    expect(ButtonLabels(buttons())).toEqual(
      expect.arrayContaining(['Close', 'Sign and pay out'])
    );
  });

  it('shows the one-time approval step with its fee', () => {
    actions.payoutStep.set('approval');
    actions.payoutBuildResult.set(
      PayoutBuild({
        estimated_fee: '920000000000000',
        transaction_type: 'approval',
        deadline: null,
        release_after: null,
        recipients_count: 0,
      })
    );

    const { text, buttons, element } = Render();

    expect(text).toContain('One-time approval');
    expect(FeeRows(element)).toEqual([
      ['Network fee', 'Up to 0.000920 ETH'],
      ['Gas price', 'Up to 20 gwei'],
    ]);
    expect(text).not.toContain('Sign before');
    expect(ButtonLabels(buttons())).toContain('Approve USDC');
  });

  it('only offers Reconcile once submitted, with an explorer link', () => {
    actions.payoutStep.set('submitted');
    actions.payoutNotice.set('Submitted, waiting for confirmations.');
    actions.payoutSubmittedHash.set(HASH);
    actions.payoutBuildResult.set(PayoutBuild());

    const { text, buttons, element } = Render();

    expect(text).toContain('Submitted, waiting for confirmations.');
    expect(text).not.toContain('Sign payout');
    expect(
      element.querySelector('.submitted-hash a')?.getAttribute('href')
    ).toBe(`https://sepolia.etherscan.io/tx/${HASH}`);
    expect(ButtonLabels(buttons())).toEqual(['Close', 'Reconcile']);
  });

  it('offers Reconcile and Replace after a batch conflict', () => {
    actions.payoutRecovery.set('reconcile_or_replace');
    const replace = jest
      .spyOn(actions, 'ReplaceOutstandingBatch')
      .mockResolvedValue();
    const reconcile = jest
      .spyOn(actions, 'ReconcilePayout')
      .mockResolvedValue();

    const { buttons } = Render();
    const byLabel = (label: string) =>
      buttons().find((button) => button.textContent?.trim() === label);
    byLabel('Replace outstanding batch')?.click();
    byLabel('Reconcile')?.click();

    expect(replace).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledTimes(1);
  });
});
