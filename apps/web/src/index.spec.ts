// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SRC = __dirname;
const TAGLINE = 'Stablecoin payment processing platform.';

function ReadHead(): Document {
  const html = readFileSync(join(SRC, 'index.html'), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('index.html', () => {
  const head = ReadHead();
  const Href = (selector: string) =>
    head.querySelector(selector)?.getAttribute('href');

  it('links the FiatDesk favicons, the dark set and the manifest', () => {
    expect(Href('link[rel="icon"][sizes="48x48"]')).toBe(
      'assets/favicon/favicon.ico'
    );
    expect(
      Href('link[rel="icon"][type="image/svg+xml"]:not([media*="dark"])')
    ).toBe('assets/favicon/favicon.svg');
    expect(Href('link[rel="icon"][media="(prefers-color-scheme: dark)"]')).toBe(
      'assets/favicon/dark/favicon.svg'
    );
    expect(Href('link[rel="apple-touch-icon"]')).toBe(
      'assets/favicon/apple-touch-icon.png'
    );
    expect(Href('link[rel="manifest"]')).toBe(
      'assets/favicon/site.webmanifest'
    );

    const local = Array.from(
      head.querySelectorAll(
        'link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]'
      )
    ).map((link) => link.getAttribute('href') as string);
    for (const href of local) {
      expect(existsSync(join(SRC, href))).toBe(true);
    }
  });

  it('has a FiatDesk manifest on black', () => {
    const manifest = JSON.parse(
      readFileSync(join(SRC, 'assets/favicon/site.webmanifest'), 'utf8')
    );
    expect(manifest).toMatchObject({
      name: 'FiatDesk',
      short_name: 'FiatDesk',
      theme_color: '#000000',
      background_color: '#000000',
    });
    for (const icon of manifest.icons) {
      expect(existsSync(join(SRC, 'assets/favicon', icon.src))).toBe(true);
    }
  });

  it('carries the FiatDesk title, tagline and OG image', () => {
    const Meta = (selector: string) =>
      head.querySelector(selector)?.getAttribute('content');

    expect(head.querySelector('title')?.textContent).toBe('FiatDesk');
    expect(Meta('meta[name="description"]')).toBe(TAGLINE);
    expect(Meta('meta[property="og:title"]')).toBe('FiatDesk');
    expect(Meta('meta[property="og:description"]')).toBe(TAGLINE);
    expect(Meta('meta[property="og:image"]')).toBe(
      '/assets/brand/fiatdesk-og.png'
    );
    expect(existsSync(join(SRC, 'assets/brand/fiatdesk-og.png'))).toBe(true);
    expect(Meta('meta[name="theme-color"]')).toBe('#000000');
  });

  it('loads Be Vietnam Pro 300 to 600 from Google Fonts', () => {
    expect(
      Href('link[rel="preconnect"][href="https://fonts.gstatic.com"]')
    ).toBe('https://fonts.gstatic.com');
    expect(Href('link[rel="stylesheet"][href*="fonts.googleapis.com"]')).toBe(
      'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap'
    );
  });
});
