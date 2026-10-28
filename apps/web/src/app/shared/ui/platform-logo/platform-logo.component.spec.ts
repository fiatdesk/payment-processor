// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { TestBed } from '@angular/core/testing';

import { ConfigService } from '../../../data';
import { PlatformLogoComponent } from './platform-logo.component';

function Render(
  config: { logoUrl?: string; name?: string },
  theme: 'light' | 'dark' = 'light'
): HTMLElement {
  const name = config.name ?? 'FiatDesk';
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ConfigService,
        useValue: {
          GetPlatformLogoUrl: () => config.logoUrl ?? '',
          HasLogo: () => Boolean(config.logoUrl),
          GetPlatformName: () => name,
          GetPlatformInitials: () => name.substring(0, 2).toUpperCase(),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(PlatformLogoComponent);
  fixture.componentInstance.theme = theme;
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PlatformLogoComponent', () => {
  it('falls back to the FiatDesk icon when the operator has set no logo or name', () => {
    const img = Render({}).querySelector('img');

    expect(img?.getAttribute('src')).toBe(
      'assets/brand/fiatdesk-icon-black.svg'
    );
    expect(img?.getAttribute('alt')).toBe('FiatDesk');
  });

  it('uses the white FiatDesk icon on dark surfaces', () => {
    const img = Render({}, 'dark').querySelector('img');

    expect(img?.getAttribute('src')).toBe(
      'assets/brand/fiatdesk-icon-white.svg'
    );
  });

  it("keeps the operator's own logo", () => {
    const img = Render({
      logoUrl: 'https://acme.example.com/logo.png',
      name: 'Acme Market',
    }).querySelector('img');

    expect(img?.getAttribute('src')).toBe('https://acme.example.com/logo.png');
    expect(img?.getAttribute('alt')).toBe('Acme Market');
  });

  it("shows the operator's initials, not the FiatDesk icon, when only a name is set", () => {
    const host = Render({ name: 'Acme Market' });

    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent?.trim()).toBe('AC');
  });
});
