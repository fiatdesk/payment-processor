import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'zoneless_sdk_preference';
const DEFAULT_SDK = 'node';

@Injectable({
  providedIn: 'root',
})
export class SdkPreferenceService {
  private isBrowser: boolean;

  // Global SDK preference signal - all code snippets will react to changes
  sdkPreference = signal<string>(DEFAULT_SDK);

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.LoadPreference();
  }

  private LoadPreference(): void {
    if (!this.isBrowser) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      this.sdkPreference.set(stored);
    }
  }

  SetPreference(sdkId: string): void {
    this.sdkPreference.set(sdkId);

    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, sdkId);
    }
  }

  GetPreference(): string {
    return this.sdkPreference();
  }
}
