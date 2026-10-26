import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const CACHE_KEY = 'gh_stars';
const CACHE_TS_KEY = 'gh_stars_ts';
const CACHE_TTL = 300_000; // 5 minutes

@Injectable({ providedIn: 'root' })
export class GithubService {
  readonly repo = 'zonelessdev/zoneless';
  readonly stars = signal<number | null>(null);

  private fetched = false;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  async FetchStars(): Promise<void> {
    if (this.fetched || !this.isBrowser) return;
    this.fetched = true;

    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      const cachedTime = sessionStorage.getItem(CACHE_TS_KEY);
      if (cached && cachedTime && Date.now() - Number(cachedTime) < CACHE_TTL) {
        this.stars.set(Number(cached));
        return;
      }

      const response = await fetch(`https://api.github.com/repos/${this.repo}`);
      if (response.ok) {
        const data = await response.json();
        this.stars.set(data.stargazers_count);
        sessionStorage.setItem(CACHE_KEY, String(data.stargazers_count));
        sessionStorage.setItem(CACHE_TS_KEY, String(Date.now()));
      }
    } catch {
      // Stars are non-critical
    }
  }

  FormatStars(count: number): string {
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return count.toString();
  }
}
