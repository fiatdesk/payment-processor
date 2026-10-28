import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Docs } from './docs';

describe('Docs', () => {
  let component: Docs;
  let fixture: ComponentFixture<Docs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Docs],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Docs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => component.themeService.SetTheme('light'));

  const Logos = () =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.topbar-logo img, .sidebar-logo img'
      )
    );

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the black FiatDesk lockup in the header and sidebar', () => {
    const logos = Logos();

    expect(logos).toHaveLength(2);
    for (const logo of logos) {
      expect(logo.getAttribute('src')).toBe(
        '/assets/brand/fiatdesk-logo-black.svg'
      );
      expect(logo.getAttribute('alt')).toBe('FiatDesk');
    }
  });

  it('switches to the white lockup in the dark theme', () => {
    component.themeService.SetTheme('dark');
    fixture.detectChanges();

    for (const logo of Logos()) {
      expect(logo.getAttribute('src')).toBe(
        '/assets/brand/fiatdesk-logo-white.svg'
      );
    }
  });
});
