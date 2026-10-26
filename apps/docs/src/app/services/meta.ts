import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';

export interface SeoData {
  title: string;
  description: string;
  url: string;
  image: string;
  noIndex?: boolean;
  type?: 'website' | 'article';
  publishedAt?: string;
  updatedAt?: string;
  author?: string;
  tags?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class MetaService {
  private readonly titleService = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  SetMeta(seo: SeoData): void {
    this.titleService.setTitle(seo.title);
    this.meta.updateTag({ name: 'title', content: seo.title });
    this.meta.updateTag({ name: 'description', content: seo.description });

    this.meta.updateTag({ property: 'og:title', content: seo.title });
    this.meta.updateTag({
      property: 'og:type',
      content: seo.type ?? 'website',
    });
    this.meta.updateTag({ property: 'og:url', content: seo.url });
    this.meta.updateTag({
      property: 'og:description',
      content: seo.description,
    });
    this.meta.updateTag({ property: 'og:image', content: seo.image });
    this.meta.updateTag({ property: 'og:site_name', content: 'Zoneless' });
    this.meta.updateTag({ property: 'og:locale', content: 'en_US' });

    this.meta.updateTag({
      name: 'twitter:card',
      content: 'summary_large_image',
    });
    this.meta.updateTag({ name: 'twitter:site', content: '@zonelessdev' });
    this.meta.updateTag({ name: 'twitter:url', content: seo.url });
    this.meta.updateTag({ name: 'twitter:title', content: seo.title });
    this.meta.updateTag({
      name: 'twitter:description',
      content: seo.description,
    });
    this.meta.updateTag({ name: 'twitter:image', content: seo.image });
    this.RemoveArticleMeta();
    if (seo.type === 'article') {
      if (seo.publishedAt) {
        this.meta.updateTag({
          property: 'article:published_time',
          content: seo.publishedAt,
        });
      }
      if (seo.updatedAt) {
        this.meta.updateTag({
          property: 'article:modified_time',
          content: seo.updatedAt,
        });
      }
      if (seo.author) {
        this.meta.updateTag({
          property: 'article:author',
          content: seo.author,
        });
      }
      seo.tags?.forEach((tag) => {
        this.meta.addTag({ property: 'article:tag', content: tag });
      });
    }
    this.meta.removeTag('name="robots"');
    this.RemoveStructuredData();
    if (seo.noIndex) {
      this.SetNoIndex();
    }
    this.SetCanonical(seo.url);
  }

  SetNoIndex(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
  }

  SetCanonical(url: string): void {
    const head = this.doc.getElementsByTagName('head')[0];
    let element: HTMLLinkElement | null =
      head.querySelector(`link[rel='canonical']`) || null;

    if (element == null) {
      element = this.doc.createElement('link');
      head.appendChild(element);
    }
    element.setAttribute('rel', 'canonical');
    element.setAttribute('href', url);
  }

  RemoveStructuredData(): void {
    const existingStructuredData = this.doc.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    existingStructuredData.forEach((element: Element) => element.remove());
  }

  AddStructuredData(jsonLD: object): void {
    const head = this.doc.getElementsByTagName('head')[0];
    const script = this.doc.createElement('script');
    script.type = 'application/ld+json';
    head.appendChild(script);
    script.textContent = JSON.stringify(jsonLD);
  }

  private RemoveArticleMeta(): void {
    const articleMeta = this.doc.querySelectorAll('meta[property^="article:"]');
    articleMeta.forEach((element: Element) => element.remove());
  }
}
