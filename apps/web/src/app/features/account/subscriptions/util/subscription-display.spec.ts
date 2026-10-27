import type { Invoice, Subscription } from '@fiatdesk/shared-types';

import {
  GetSubscriptionListStatus,
  GetSubscriptionOnchainStatuses,
  IsSubscriptionAllowanceExhausted,
} from './subscription-display';

const ONCHAIN_ID = `0x${'34'.repeat(32)}`;

function OnchainSubscription(
  overrides: Partial<Record<keyof Subscription, unknown>> = {}
): Subscription {
  return {
    id: 'sub_fd_1',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    items: { object: 'list', data: [] },
    subscription_onchain_id: ONCHAIN_ID,
    paused_on_chain: false,
    cancel_pending_on_chain: false,
    cancel_pending_transaction_hash: null,
    latest_invoice: null,
    ...overrides,
  } as unknown as Subscription;
}

/** An open cycle invoice whose last collection failed with `code`. */
function FailedInvoice(code: string, status = 'open'): Invoice {
  return {
    id: 'in_fd_1',
    status,
    metadata: {
      last_payment_error: 'The subscriber has not approved enough USDC',
      last_payment_error_code: code,
    },
  } as unknown as Invoice;
}

describe('subscription on-chain display', () => {
  it('reports no on-chain state for a healthy subscription', () => {
    expect(GetSubscriptionOnchainStatuses(OnchainSubscription())).toEqual([]);
    expect(GetSubscriptionListStatus(OnchainSubscription())).toBe('active');
  });

  it('reports a subscription paused on-chain', () => {
    const subscription = OnchainSubscription({ paused_on_chain: true });

    expect(GetSubscriptionOnchainStatuses(subscription)).toEqual([
      'paused_on_chain',
    ]);
    expect(GetSubscriptionListStatus(subscription)).toBe('paused_on_chain');
  });

  it('reports an on-chain cancel that has not landed, ahead of other states', () => {
    const subscription = OnchainSubscription({
      status: 'canceled',
      cancel_pending_on_chain: true,
      cancel_pending_transaction_hash: `0x${'cd'.repeat(32)}`,
      paused_on_chain: true,
    });

    expect(GetSubscriptionOnchainStatuses(subscription)).toEqual([
      'cancel_pending_on_chain',
      'paused_on_chain',
    ]);
    expect(GetSubscriptionListStatus(subscription)).toBe(
      'cancel_pending_on_chain'
    );
  });

  it('reads an exhausted allowance from the open latest invoice', () => {
    const subscription = OnchainSubscription({
      status: 'past_due',
      latest_invoice: FailedInvoice('collection_failed_allowance'),
    });

    expect(IsSubscriptionAllowanceExhausted(subscription)).toBe(true);
    expect(GetSubscriptionOnchainStatuses(subscription)).toEqual([
      'allowance_exhausted',
    ]);
    expect(GetSubscriptionListStatus(subscription)).toBe('allowance_exhausted');
  });

  it.each([
    [
      'the invoice was paid since',
      FailedInvoice('collection_failed_allowance', 'paid'),
    ],
    [
      'the collection failed for another reason',
      FailedInvoice('insufficient_funds'),
    ],
    ['the latest invoice is not expanded', 'in_fd_1'],
  ])(
    'does not report an exhausted allowance when %s',
    (_label, latestInvoice) => {
      const subscription = OnchainSubscription({
        latest_invoice: latestInvoice,
      });

      expect(IsSubscriptionAllowanceExhausted(subscription)).toBe(false);
    }
  );

  it('keeps showing a scheduled cancel when nothing is wrong on-chain', () => {
    const subscription = OnchainSubscription({
      cancel_at_period_end: true,
      cancel_at: Date.UTC(2026, 10, 3, 12) / 1000,
    });

    expect(GetSubscriptionListStatus(subscription)).toBe('Cancels 3 Nov');
  });

  it('reports nothing on-chain for an off-chain subscription', () => {
    const subscription = OnchainSubscription({
      subscription_onchain_id: null,
      latest_invoice: FailedInvoice('collection_failed_allowance'),
    });

    expect(GetSubscriptionOnchainStatuses(subscription)).toEqual([]);
  });
});
