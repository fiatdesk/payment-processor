import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import type { Customer } from '@fiatdesk/shared-types';

import { MetaService } from '../../../../../core';
import { CustomerService } from '../../../../../data';
import { PaginatedListComponent } from '../../../../../shared';
import { EventsListComponent } from '../../../components';
import { CustomerActionsHostComponent } from '../../components/customer-actions-host/customer-actions-host.component';
import { CustomerActionsService } from '../../services/customer-actions.service';
import { CustomerDetailComponent } from './customer-detail.component';

describe('CustomerDetailComponent', () => {
  const customerService = { GetCustomer: jest.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        CustomerActionsService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'cus_fd_1' } } },
        },
        { provide: CustomerService, useValue: customerService },
        { provide: MetaService, useValue: { SetMetaTitle: jest.fn() } },
      ],
    }).overrideComponent(CustomerDetailComponent, {
      remove: {
        imports: [
          CustomerActionsHostComponent,
          EventsListComponent,
          PaginatedListComponent,
        ],
      },
      add: { schemas: [CUSTOM_ELEMENTS_SCHEMA] },
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('shows "Customer since" from the Unix timestamp in seconds', async () => {
    customerService.GetCustomer.mockResolvedValue({
      id: 'cus_fd_1',
      object: 'customer',
      name: 'Amara Okafor',
      email: 'amara@lumenstudio.example',
      // 2026-10-28T10:44:00Z
      created: 1793184240,
      metadata: {},
    } as unknown as Customer);
    const fixture = TestBed.createComponent(CustomerDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Customer since');
    expect(text).toMatch(/Oct 28, 2026/);
    expect(text).not.toContain('1970');
  });
});
