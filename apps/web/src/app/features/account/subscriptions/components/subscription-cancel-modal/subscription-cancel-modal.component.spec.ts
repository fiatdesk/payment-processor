import { TestBed } from '@angular/core/testing';
import type { Subscription } from '@fiatdesk/shared-types';

import { SubscriptionCancelModalComponent } from './subscription-cancel-modal.component';

describe('SubscriptionCancelModalComponent', () => {
  function OpenFor(subscriptionOnchainId: string | null): string {
    const fixture = TestBed.createComponent(SubscriptionCancelModalComponent);
    fixture.componentRef.setInput('subscription', {
      id: 'sub_fd_1',
      items: { object: 'list', data: [] },
      subscription_onchain_id: subscriptionOnchainId,
    } as unknown as Subscription);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    return ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(
      /\s+/g,
      ' '
    );
  }

  it('says an on-chain subscription is canceled on-chain and that revoking the allowance also stops pulls', () => {
    const text = OpenFor(`0x${'34'.repeat(32)}`);

    expect(text).toContain(
      'Canceling also cancels this subscription on the Subscriptions contract, so no further USDC is pulled.'
    );
    expect(text).toContain(
      'The customer can also stop every pull by canceling on-chain or by revoking their USDC allowance to the contract.'
    );
  });

  it('says nothing about the chain for an off-chain subscription', () => {
    const text = OpenFor(null);

    expect(text).toContain('End of the current period');
    expect(text).not.toContain('Subscriptions contract');
  });
});
