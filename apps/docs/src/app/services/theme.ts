import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'zoneless-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private isBrowser: boolean;
  theme = signal<Theme>('light');

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (saved === 'dark' || saved === 'light') {
        this.theme.set(saved);
      }
      this.ApplyTheme();
    }
  }

  ToggleTheme(): void {
    this.SetTheme(this.theme() === 'light' ? 'dark' : 'light');
  }

  SetTheme(theme: Theme): void {
    this.theme.set(theme);
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, theme);
      this.ApplyTheme();
    }
  }

  IsDark(): boolean {
    return this.theme() === 'dark';
  }

  private ApplyTheme(): void {
    document.documentElement.setAttribute('data-theme', this.theme());
  }
}
