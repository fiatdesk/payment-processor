import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import type { Subscription } from '@fiatdesk/shared-types';

import { ApiService, MetaService } from '../../../../../core';
import { ConfigService, SubscriptionService } from '../../../../../data';
import { SubscriptionActionsService } from '../../services/subscription-actions.service';
import { SubscriptionDetailComponent } from './subscription-detail.component';

const ONCHAIN_ID = `0x${'34'.repeat(32)}`;
/** Anvil account #2, the subscriber (public test key). */
const WALLET = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const CANCEL_HASH = `0x${'cd'.repeat(32)}`;
const EXPLORER = 'https://sepolia.etherscan.io';

function OnchainSubscription(
  overrides: Partial<Record<keyof Subscription, unknown>> = {}
): Subscription {
  return {
    id: 'sub_fd_1',
    object: 'subscription',
    status: 'active',
    created: 1793000000,
    start_date: 1793000000,
    livemode: true,
    customer: { id: 'cus_fd_1', name: 'Ada', email: 'ada@example.com' },
    items: {
      object: 'list',
      data: [
        {
          id: 'si_fd_1',
          quantity: 1,
          current_period_start: 1793000000,
          current_period_end: 1795592000,
          price: {
            id: 'price_fd_1',
            unit_amount: 1000,
            recurring: { interval: 'month', interval_count: 1 },
            product: { id: 'prod_fd_1', name: 'Pro' },
          },
        },
      ],
    },
    metadata: {},
    discounts: [],
    cancel_at_period_end: false,
    cancel_at: null,
    collection_method: 'charge_automatically',
    billing_mode: { type: 'flexible' },
    default_payment_method: WALLET,
    subscription_onchain_id: ONCHAIN_ID,
    paused_on_chain: false,
    cancel_pending_on_chain: false,
    cancel_pending_transaction_hash: null,
    latest_invoice: null,
    ...overrides,
  } as unknown as Subscription;
}

describe('SubscriptionDetailComponent', () => {
  const subscriptionService = { GetSubscription: jest.fn() };
  const configService = { GetExplorerUrl: jest.fn() };

  /** Renders the detail page once the subscription has loaded. */
  async function Render(subscription: Subscription): Promise<HTMLElement> {
    subscriptionService.GetSubscription.mockResolvedValue(subscription);
    const fixture = TestBed.createComponent(SubscriptionDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function Text(element: HTMLElement): string {
    return (element.textContent ?? '').replace(/\s+/g, ' ');
  }

  /** The status chips in the page header. */
  function Chips(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('.chip')).map((chip) =>
      (chip.textContent ?? '').trim()
    );
  }

  function Link(element: HTMLElement, text: string): HTMLAnchorElement | null {
    return (
      Array.from(element.querySelectorAll('a')).find((link) =>
        (link.textContent ?? '').includes(text)
      ) ?? null
    );
  }

  beforeEach(() => {
    configService.GetExplorerUrl.mockImplementation(
      (type: string, value: string) =>
        value ? `${EXPLORER}/${type}/${value}` : ''
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        SubscriptionActionsService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'sub_fd_1' } } },
        },
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: ConfigService, useValue: configService },
        { provide: MetaService, useValue: { SetMetaTitle: jest.fn() } },
        {
          provide: ApiService,
          useValue: {
            Call: jest.fn().mockResolvedValue({
              object: 'list',
              data: [],
              has_more: false,
            }),
          },
        },
      ],
    });
  });

  afterEach(() => jest.resetAllMocks());

  it('loads the latest invoice with the subscription', async () => {
    await Render(OnchainSubscription());

    expect(subscriptionService.GetSubscription).toHaveBeenCalledWith(
      'sub_fd_1',
      ['customer', 'items.data.price.product', 'latest_invoice']
    );
  });

  it('shows the on-chain subscription id and links the subscriber wallet on the explorer', async () => {
    const element = await Render(OnchainSubscription());

    expect(Text(element)).toContain('On-chain subscription');
    expect(Text(element)).toContain('0x34343434…34343434');
    expect(Link(element, 'Subscriber wallet on explorer')?.href).toBe(
      `${EXPLORER}/address/${WALLET}`
    );
  });

  it('shows the on-chain id without a link when the chain has no explorer', async () => {
    configService.GetExplorerUrl.mockReturnValue('');

    const element = await Render(OnchainSubscription());

    expect(Text(element)).toContain('0x34343434…34343434');
    expect(Link(element, 'Subscriber wallet on explorer')).toBeNull();
  });

  it('shows no on-chain details for an off-chain subscription', async () => {
    const element = await Render(
      OnchainSubscription({ subscription_onchain_id: null })
    );

    expect(Text(element)).not.toContain('On-chain subscription');
  });

  it('shows a cancel pending on-chain and links its transaction on the explorer', async () => {
    const element = await Render(
      OnchainSubscription({
        status: 'canceled',
        cancel_pending_on_chain: true,
        cancel_pending_transaction_hash: CANCEL_HASH,
      })
    );

    expect(Chips(element)).toEqual(['Canceled', 'Cancel pending on-chain']);
    expect(Text(element)).toContain(
      'The on-chain cancel was sent and is not confirmed yet.'
    );
    expect(Link(element, '0xcdcdcdcd…cdcdcdcd')?.href).toBe(
      `${EXPLORER}/tx/${CANCEL_HASH}`
    );
  });

  it('shows a subscription the subscriber paused on-chain', async () => {
    const element = await Render(
      OnchainSubscription({ paused_on_chain: true })
    );

    expect(Chips(element)).toEqual(['Active', 'Paused on-chain']);
    expect(Text(element)).toContain(
      'The subscriber paused this subscription on-chain.'
    );
  });

  it('shows no on-chain chips while nothing is wrong on-chain', async () => {
    const element = await Render(OnchainSubscription());

    expect(Chips(element)).toEqual(['Active']);
  });

  it('shows a renewal allowance that ran out', async () => {
    const element = await Render(
      OnchainSubscription({
        status: 'past_due',
        latest_invoice: {
          id: 'in_fd_1',
          status: 'open',
          metadata: { last_payment_error_code: 'collection_failed_allowance' },
        },
      })
    );

    expect(Chips(element)).toEqual(['Past Due', 'Allowance exhausted']);
    expect(Text(element)).toContain('Renewal authorization exhausted');
    expect(Text(element)).toContain(
      'They need to re-authorize by approving more USDC for the contract'
    );
  });
});
