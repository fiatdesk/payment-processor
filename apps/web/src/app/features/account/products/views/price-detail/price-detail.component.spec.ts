import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import type { Price } from '@zoneless/shared-types';

import { MetaService } from '../../../../../core';
import { PriceService } from '../../../../../data';
import { EventsListComponent } from '../../../components';
import { PriceActionsHostComponent } from '../../components/price-actions-host/price-actions-host.component';
import { PriceActionsService } from '../../services/price-actions.service';
import { PriceDetailComponent } from './price-detail.component';

const PLAN_ID = `0x${'5a'.repeat(32)}`;

function TestPrice(overrides: Partial<Record<keyof Price, unknown>>): Price {
  return {
    id: 'price_z_1',
    object: 'price',
    active: true,
    currency: 'usdc',
    unit_amount: 1000,
    type: 'recurring',
    recurring: { interval: 'month', interval_count: 1 },
    product: 'prod_z_1',
    metadata: {},
    subscription_plan_id: PLAN_ID,
    ...overrides,
  } as unknown as Price;
}

describe('PriceDetailComponent', () => {
  const priceService = { GetPrice: jest.fn() };

  /** The Pricing table as label/value pairs (a copyable value by its label). */
  async function PricingRows(price: Price): Promise<[string, string][]> {
    priceService.GetPrice.mockResolvedValue(price);
    const fixture = TestBed.createComponent(PriceDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return Array.from(element.querySelectorAll('tr')).map(
      (row) =>
        Array.from(row.querySelectorAll('td')).map((cell) =>
          ((cell.querySelector('.copy-text-label') ?? cell).textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim()
        ) as [string, string]
    );
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        PriceActionsService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'price_z_1' } } },
        },
        { provide: PriceService, useValue: priceService },
        { provide: MetaService, useValue: { SetMetaTitle: jest.fn() } },
      ],
    }).overrideComponent(PriceDetailComponent, {
      remove: { imports: [PriceActionsHostComponent, EventsListComponent] },
      add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
  });

  afterEach(() => jest.clearAllMocks());

  it("shows a recurring price's on-chain plan id", async () => {
    const rows = await PricingRows(TestPrice({}));

    expect(rows).toContainEqual(['On-chain plan', '0x5a5a5a5a…5a5a5a5a']);
  });

  it('says when the on-chain plan is not created yet', async () => {
    const rows = await PricingRows(TestPrice({ subscription_plan_id: null }));

    expect(rows).toContainEqual(['On-chain plan', 'Not created yet']);
  });

  it('shows no on-chain plan for a one-time price', async () => {
    const rows = await PricingRows(
      TestPrice({
        type: 'one_time',
        recurring: null,
        subscription_plan_id: null,
      })
    );

    expect(rows.map(([label]) => label)).not.toContain('On-chain plan');
  });
});
