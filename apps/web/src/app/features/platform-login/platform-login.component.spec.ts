// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService, MetaService } from '../../core';
import { PlatformLoginComponent } from './platform-login.component';

describe('PlatformLoginComponent', () => {
  it('shows the FiatDesk lockup in its header', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MetaService, useValue: { SetMetaTitle: jest.fn() } },
        { provide: AuthService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(PlatformLoginComponent);
    fixture.detectChanges();

    const logo = (fixture.nativeElement as HTMLElement).querySelector(
      '.login-header img'
    );
    expect(logo?.getAttribute('src')).toBe(
      'assets/brand/fiatdesk-logo-black.svg'
    );
    expect(logo?.getAttribute('alt')).toBe('FiatDesk');
  });
});
