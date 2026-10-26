import {
  Component,
  signal,
  computed,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Inject,
  PLATFORM_ID,
  HostListener,
  inject,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CodeSnippet } from '../../components/code-snippet/code-snippet';
import { AgentPromptCta } from '../../components/agent-prompt-cta/agent-prompt-cta';
import { marketplaceAgentPrompt } from '../../components/agent-prompt-cta/agent-marketplace-prompt';
import { paymentsAgentPrompt } from '../../components/agent-prompt-cta/agent-payments-prompt';
import { MetaService } from '../../services/meta';
import { ThemeService } from '../../services/theme';
import { SdkPreferenceService } from '../../services/sdk-preference';
import { GithubService } from '../../services/github';

import {
  DocSection,
  DocSubSection,
  DocPage,
  EndpointSummary,
  Attribute,
  GUIDE_SECTIONS,
} from './data';
import {
  docPageGroups,
  docSections,
  docSinglePages,
  DocHref,
} from './docs-catalog';
import { GeneratePageMarkdown, HtmlToText } from './docs-markdown';

interface SearchItem {
  title: string;
  description: string;
  category: string;
  sectionId: string;
  subSectionId?: string;
  headings: string[];
  attributeNames: string[];
  endpointPaths: string[];
  bodyText: string;
}

interface SearchResult extends SearchItem {
  matchContext?: string;
}

@Component({
  selector: 'app-docs',
  imports: [CodeSnippet, NgTemplateOutlet, AgentPromptCta],
  templateUrl: './docs.html',
  styleUrl: './docs.scss',
})
export class Docs implements OnInit, OnDestroy, AfterViewInit {
  themeService = inject(ThemeService);
  private sdkPreference = inject(SdkPreferenceService);
  github = inject(GithubService);
  readonly agentMarketplacePrompt = marketplaceAgentPrompt;
  readonly agentPaymentsPrompt = paymentsAgentPrompt;

  activeSection = signal<string>('payment-link-quickstart');
  activeSubSection = signal<string>('');
  expandedSections = signal<Set<string>>(
    new Set(docSections.map((section) => section.id))
  );
  mobileMenuOpen = signal<boolean>(false);
  expandedAttributes = signal<Set<string>>(new Set());
  expandedMoreAttributes = signal<Set<string>>(new Set());
  copiedPageId = signal<string>('');
  /** Active tab in the object-page Endpoints/Events panel, keyed by page id. */
  private apiNavTabs = signal<Record<string, 'endpoints' | 'events'>>({});

  searchOpen = signal(false);
  searchQuery = signal('');
  selectedSearchIndex = signal(0);
  private searchIndex: SearchItem[] = [];
  private topLevelSearchItems: SearchItem[] = [];

  private isBrowser: boolean;
  private copyTimeout: any = null;
  private scrollTimeout: any = null;
  private scrollingToAnchor = false;

  // Sidebar sections
  sections: DocSection[] = docSections;

  // Guide pages get prose-style layout (no section borders, numbered steps)
  private guideSectionIds = new Set(
    GUIDE_SECTIONS.flatMap(
      (section) => section.children?.map((child) => child.id) ?? []
    )
  );

  // Page groups - pages that belong together and should be shown as one scrollable page
  private pageGroups: Record<string, DocPage[]> = docPageGroups;

  // Single pages
  private singlePages: DocPage[] = docSinglePages;

  // Get all pages for the current section
  activePages = computed<DocPage[]>(() => {
    const section = this.activeSection();
    if (this.pageGroups[section]) {
      return this.pageGroups[section];
    }
    const singlePage = this.singlePages.find((p) => p.id === section);
    if (singlePage) {
      return [singlePage];
    }
    return [];
  });

  filteredSearchResults = computed<SearchResult[]>(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.topLevelSearchItems;
    const scored: { result: SearchResult; score: number }[] = [];
    for (const item of this.searchIndex) {
      const score = this.ScoreSearchItem(item, query);
      if (score > 0) {
        scored.push({
          result: { ...item, matchContext: this.GetMatchContext(item, query) },
          score,
        });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 12).map((s) => s.result);
  });

  AgentGuidePrompt(): { prompt: string; description: string } | null {
    const section = this.activeSection();
    if (
      section === 'quickstart' ||
      section === 'api-quickstart' ||
      section === 'migrate-from-stripe'
    ) {
      return {
        prompt: this.agentMarketplacePrompt,
        description:
          'The easiest way to add Zoneless payouts to your platform. Your existing checkout and payout methods stay in place.',
      };
    }
    if (
      section === 'payment-link-quickstart' ||
      section === 'checkout-api-quickstart'
    ) {
      return {
        prompt: this.agentPaymentsPrompt,
        description:
          'The easiest way to add USDC subscriptions to your app. Your existing billing and checkout stay in place.',
      };
    }
    return null;
  }

  constructor(
    private metaService: MetaService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.BuildSearchIndex();
    this.metaService.SetMeta({
      title: 'Documentation | Zoneless',
      description:
        'Accept USDC payments, run subscriptions, and pay out sellers with Zoneless. API reference, guides, and examples.',
      url: 'https://docs.zoneless.com',
      image: 'https://docs.zoneless.com/assets/images/screenshots/og.png',
    });
  }

  ngOnInit(): void {
    this.github.FetchStars();
    this.route.params.subscribe((params) => {
      if (params['section']) {
        this.activeSection.set(params['section']);
        this.expandParentSections(params['section']);

        if (params['subsection']) {
          this.activeSubSection.set(params['subsection']);
          // Scroll to subsection after view renders
          setTimeout(() => this.scrollToSection(params['subsection']), 100);
        }
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      window.addEventListener('scroll', () => this.onScroll(), {
        passive: true,
      });

      if (window.location.hash) {
        setTimeout(() => {
          const hash = window.location.hash.slice(1);
          let element = document.getElementById(hash);
          if (!element) {
            for (const page of this.activePages()) {
              element = document.getElementById(`${page.id}-${hash}`);
              if (element) break;
            }
          }
          element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      window.removeEventListener('scroll', () => this.onScroll());
    }
  }

  private onScroll(): void {
    if (!this.isBrowser || this.scrollingToAnchor) return;

    const pages = this.activePages();
    if (pages.length <= 1) return;

    // Find which section is currently in view
    for (const page of pages) {
      const element = document.getElementById(page.id);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.top <= 150 && rect.bottom > 150) {
          const newSubSection = page.id;
          if (this.activeSubSection() !== newSubSection) {
            this.activeSubSection.set(newSubSection);

            // Debounce URL update - only update after scrolling stops
            if (this.scrollTimeout) {
              clearTimeout(this.scrollTimeout);
            }
            this.scrollTimeout = setTimeout(() => {
              const section = this.activeSection();
              const currentSub = this.activeSubSection();
              window.history.replaceState(
                null,
                '',
                DocHref(section, currentSub)
              );
            }, 150);
          }
          break;
        }
      }
    }
  }

  private scrollToSection(sectionId: string): void {
    if (!this.isBrowser) return;

    // Try different ID formats
    const possibleIds = [sectionId, `accounts-${sectionId}`];

    for (const id of possibleIds) {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  }

  private expandParentSections(sectionId: string): void {
    for (const section of this.sections) {
      if (section.children) {
        for (const subSection of section.children) {
          if (subSection.id === sectionId) {
            const expandedSections = new Set(this.expandedSections());
            expandedSections.add(section.id);
            this.expandedSections.set(expandedSections);
            return;
          }
        }
      }
    }
  }

  ToggleSection(sectionId: string): void {
    const expanded = new Set(this.expandedSections());
    if (expanded.has(sectionId)) {
      expanded.delete(sectionId);
    } else {
      expanded.add(sectionId);
    }
    this.expandedSections.set(expanded);
  }

  IsSectionExpanded(sectionId: string): boolean {
    return this.expandedSections().has(sectionId);
  }

  // Navigate to a section (like "accounts")
  NavigateToSection(sectionId: string): void {
    this.activeSection.set(sectionId);
    this.expandParentSections(sectionId);
    this.mobileMenuOpen.set(false);
    this.router.navigateByUrl(DocHref(sectionId), { replaceUrl: true });

    // Scroll to top
    if (this.isBrowser) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Navigate to a subsection (like "accounts/create")
  NavigateToSubSection(sectionId: string, subSectionId: string): void {
    this.activeSection.set(sectionId);
    this.activeSubSection.set(subSectionId);
    this.expandParentSections(sectionId);
    this.mobileMenuOpen.set(false);
    this.router.navigateByUrl(DocHref(sectionId, subSectionId), {
      replaceUrl: true,
    });

    // Scroll to the section
    setTimeout(() => this.scrollToSection(subSectionId), 50);
  }

  IsSubSectionActive(sectionId: string, subSectionId: string): boolean {
    return (
      this.activeSection() === sectionId &&
      this.activeSubSection() === subSectionId
    );
  }

  IsSectionLinkActive(sectionId: string): boolean {
    return this.activeSection() === sectionId;
  }

  HasChildren(subSection: DocSubSection): boolean {
    return !!(subSection.children && subSection.children.length > 0);
  }

  IsGuidePage(): boolean {
    return this.guideSectionIds.has(this.activeSection());
  }

  /** Parent sidebar section title for the active page (e.g. "Get started"). */
  GetBreadcrumbCategory(): string {
    const active = this.activeSection();
    for (const section of this.sections) {
      if (section.children?.some((child) => child.id === active)) {
        return section.title;
      }
    }
    return '';
  }

  /** Leading step number of a guide heading like "3. Add a product", or null. */
  GetStepNumber(text: string): string | null {
    const match = text.match(/^(\d+)\.\s+/);
    return match ? match[1] : null;
  }

  GetStepTitle(text: string): string {
    return text.replace(/^\d+\.\s+/, '');
  }

  ToggleMobileMenu(): void {
    this.mobileMenuOpen.set(!this.mobileMenuOpen());
  }

  ToggleAttribute(attributeName: string): void {
    const expanded = new Set(this.expandedAttributes());
    if (expanded.has(attributeName)) {
      expanded.delete(attributeName);
    } else {
      expanded.add(attributeName);
    }
    this.expandedAttributes.set(expanded);
  }

  IsAttributeExpanded(attributeName: string): boolean {
    return this.expandedAttributes().has(attributeName);
  }

  GetEnumValue(
    enumVal: string | { value: string; description?: string }
  ): string {
    return typeof enumVal === 'string' ? enumVal : enumVal.value;
  }

  GetEnumDescription(
    enumVal: string | { value: string; description?: string }
  ): string | null {
    return typeof enumVal === 'string' ? null : enumVal.description || null;
  }

  ToggleMoreAttribute(attributeName: string): void {
    const expanded = new Set(this.expandedMoreAttributes());
    if (expanded.has(attributeName)) {
      expanded.delete(attributeName);
    } else {
      expanded.add(attributeName);
    }
    this.expandedMoreAttributes.set(expanded);
  }

  IsMoreAttributeExpanded(attributeName: string): boolean {
    return this.expandedMoreAttributes().has(attributeName);
  }

  ExpandAllMoreAttributes(attributes: { name: string }[]): void {
    const expanded = new Set(this.expandedMoreAttributes());
    const allExpanded = attributes.every((attr) => expanded.has(attr.name));

    if (allExpanded) {
      // Collapse all
      attributes.forEach((attr) => expanded.delete(attr.name));
    } else {
      // Expand all
      attributes.forEach((attr) => expanded.add(attr.name));
    }
    this.expandedMoreAttributes.set(expanded);
  }

  AreAllMoreAttributesExpanded(attributes: { name: string }[]): boolean {
    const expanded = this.expandedMoreAttributes();
    return attributes.every((attr) => expanded.has(attr.name));
  }

  // Get page ID for anchor
  GetPageAnchorId(page: DocPage): string {
    return page.id;
  }

  /** Object overview panels with titled endpoints and/or an Events tab. */
  HasApiNavPanel(page: DocPage): boolean {
    return !!(
      page.events?.length ||
      page.endpoints?.some((endpoint) => endpoint.title || endpoint.pageId)
    );
  }

  GetApiNavTab(pageId: string): 'endpoints' | 'events' {
    return this.apiNavTabs()[pageId] ?? 'endpoints';
  }

  SetApiNavTab(pageId: string, tab: 'endpoints' | 'events'): void {
    this.apiNavTabs.update((tabs) => ({ ...tabs, [pageId]: tab }));
  }

  GetEndpointHref(endpoint: EndpointSummary): string {
    if (!endpoint.pageId) return '';
    return DocHref(this.activeSection(), endpoint.pageId);
  }

  NavigateToEndpoint(event: Event, endpoint: EndpointSummary): void {
    event.preventDefault();
    if (!endpoint.pageId) return;
    this.NavigateToSubSection(this.activeSection(), endpoint.pageId);
  }

  NavigateToEventTypes(event: Event): void {
    event.preventDefault();
    this.NavigateToSubSection('events', 'types');
  }

  GetAnchorId(pageId: string, text: string): string {
    const slug = text
      .toLowerCase()
      .replace(/^\d+\.\s+/, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_.-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) return pageId;
    const section = this.activeSection();
    return section === pageId ? slug : `${pageId}-${slug}`;
  }

  GetAnchorHref(pageId: string, anchorId: string): string {
    const section = this.activeSection();
    const basePath =
      section === pageId ? DocHref(section) : DocHref(section, pageId);
    const prefix = `${pageId}-`;
    const hash =
      section !== pageId && anchorId.startsWith(prefix)
        ? anchorId.slice(prefix.length)
        : anchorId;
    return `${basePath}#${hash}`;
  }

  ScrollToAnchor(event: Event, anchorId: string): void {
    event.preventDefault();
    if (!this.isBrowser) return;
    const element = document.getElementById(anchorId);
    if (element) {
      this.scrollingToAnchor = true;
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const href = (event.currentTarget as HTMLAnchorElement).getAttribute(
        'href'
      );
      if (href) history.pushState(null, '', href);
      setTimeout(() => {
        this.scrollingToAnchor = false;
      }, 500);
    }
  }

  CopyForLlm(page: DocPage): void {
    if (!this.isBrowser) return;
    const markdown = GeneratePageMarkdown(page, {
      preferredCodeTab: this.sdkPreference.GetPreference(),
    });
    navigator.clipboard.writeText(markdown).then(() => {
      if (this.copyTimeout) clearTimeout(this.copyTimeout);
      this.copiedPageId.set(page.id);
      this.copyTimeout = setTimeout(() => {
        if (this.copiedPageId() === page.id) {
          this.copiedPageId.set('');
        }
      }, 2000);
    });
  }

  // ============================================
  // Search
  // ============================================
  @HostListener('document:keydown', ['$event'])
  OnGlobalKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.OpenSearch();
      return;
    }
    if (
      event.key === '/' &&
      !this.searchOpen() &&
      !(event.target instanceof HTMLInputElement) &&
      !(event.target instanceof HTMLTextAreaElement)
    ) {
      event.preventDefault();
      this.OpenSearch();
    }
  }

  OpenSearch(): void {
    this.searchOpen.set(true);
    this.searchQuery.set('');
    this.selectedSearchIndex.set(0);
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        (document.querySelector('.search-input') as HTMLInputElement)?.focus();
      });
    }
  }

  CloseSearch(): void {
    this.searchOpen.set(false);
    this.searchQuery.set('');
    if (this.isBrowser) {
      document.body.style.overflow = '';
    }
  }

  OnSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.selectedSearchIndex.set(0);
  }

  OnSearchKeydown(event: KeyboardEvent): void {
    const results = this.filteredSearchResults();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedSearchIndex.set(
          Math.min(this.selectedSearchIndex() + 1, results.length - 1)
        );
        this.ScrollSelectedIntoView();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedSearchIndex.set(
          Math.max(this.selectedSearchIndex() - 1, 0)
        );
        this.ScrollSelectedIntoView();
        break;
      case 'Enter': {
        event.preventDefault();
        const selected = results[this.selectedSearchIndex()];
        if (selected) this.SelectSearchResult(selected);
        break;
      }
      case 'Escape':
        this.CloseSearch();
        break;
    }
  }

  SelectSearchResult(item: SearchItem): void {
    this.CloseSearch();
    if (item.subSectionId) {
      this.NavigateToSubSection(item.sectionId, item.subSectionId);
    } else {
      this.NavigateToSection(item.sectionId);
    }
  }

  private ScrollSelectedIntoView(): void {
    setTimeout(() => {
      document
        .querySelectorAll('.search-result-item')
        [this.selectedSearchIndex()]?.scrollIntoView({ block: 'nearest' });
    });
  }

  private BuildSearchIndex(): void {
    this.searchIndex = [];
    this.topLevelSearchItems = [];

    for (const section of this.sections) {
      if (!section.children) continue;
      for (const subSection of section.children) {
        const pages = this.pageGroups[subSection.id];
        const singlePage = this.singlePages.find((p) => p.id === subSection.id);
        const allPages = pages || (singlePage ? [singlePage] : []);
        const firstPage = allPages[0];
        const aggregated = this.AggregatePageSearchData(allPages);

        const item: SearchItem = {
          title: subSection.title,
          description: firstPage?.description || '',
          category: section.title,
          sectionId: subSection.id,
          ...aggregated,
        };
        this.searchIndex.push(item);
        this.topLevelSearchItems.push(item);

        if (subSection.children) {
          for (const child of subSection.children) {
            const page = pages?.find((p) => p.id === child.id);
            const pageData = page
              ? this.ExtractPageSearchData(page)
              : {
                  headings: [],
                  attributeNames: [],
                  endpointPaths: [],
                  bodyText: '',
                };
            this.searchIndex.push({
              title: child.title,
              description: page?.description || '',
              category: subSection.title,
              sectionId: subSection.id,
              subSectionId: child.id,
              ...pageData,
            });
          }
        }
      }
    }
  }

  private ExtractPageSearchData(page: DocPage): {
    headings: string[];
    attributeNames: string[];
    endpointPaths: string[];
    bodyText: string;
  } {
    const headings: string[] = [];
    const attributeNames: string[] = [];
    const endpointPaths: string[] = [];
    const bodyParts: string[] = [];

    if (page.endpoints) {
      for (const ep of page.endpoints)
        endpointPaths.push(`${ep.method} ${ep.path}`);
    }

    for (const section of page.sections) {
      for (const block of section.left) {
        switch (block.type) {
          case 'heading':
            headings.push(block.text);
            break;
          case 'paragraph':
            bodyParts.push(HtmlToText(block.text));
            break;
          case 'list':
            for (const item of block.items)
              bodyParts.push(HtmlToText(item.text));
            break;
          case 'callout':
            bodyParts.push(HtmlToText(block.text));
            break;
          case 'attributes':
            this.ExtractAttributeSearchData(
              block.attributes,
              attributeNames,
              bodyParts
            );
            if (block.moreAttributes)
              this.ExtractAttributeSearchData(
                block.moreAttributes,
                attributeNames,
                bodyParts
              );
            break;
        }
      }
    }

    return {
      headings,
      attributeNames,
      endpointPaths,
      bodyText: bodyParts.join(' '),
    };
  }

  private AggregatePageSearchData(pages: DocPage[]): {
    headings: string[];
    attributeNames: string[];
    endpointPaths: string[];
    bodyText: string;
  } {
    const headings: string[] = [];
    const attributeNames: string[] = [];
    const endpointPaths: string[] = [];
    const bodyParts: string[] = [];

    for (const page of pages) {
      const data = this.ExtractPageSearchData(page);
      headings.push(...data.headings);
      attributeNames.push(...data.attributeNames);
      endpointPaths.push(...data.endpointPaths);
      bodyParts.push(data.bodyText);
    }

    return {
      headings,
      attributeNames,
      endpointPaths,
      bodyText: bodyParts.join(' '),
    };
  }

  private ExtractAttributeSearchData(
    attrs: Attribute[],
    names: string[],
    bodyParts: string[]
  ): void {
    for (const attr of attrs) {
      names.push(attr.name);
      bodyParts.push(HtmlToText(attr.description));
      if (attr.children)
        this.ExtractAttributeSearchData(attr.children, names, bodyParts);
    }
  }

  private ScoreSearchItem(item: SearchItem, query: string): number {
    const title = item.title.toLowerCase();
    let score = 0;

    if (title === query) score += 100;
    else if (title.startsWith(query)) score += 80;
    else if (title.includes(query)) score += 60;

    if (item.headings.some((h) => h.toLowerCase().includes(query))) score += 40;
    if (item.attributeNames.some((a) => a.toLowerCase().includes(query)))
      score += 35;
    if (item.endpointPaths.some((e) => e.toLowerCase().includes(query)))
      score += 35;
    if (item.description.toLowerCase().includes(query)) score += 25;
    if (item.bodyText.toLowerCase().includes(query)) score += 10;

    return score;
  }

  private GetMatchContext(item: SearchItem, query: string): string | undefined {
    if (item.title.toLowerCase().includes(query)) return undefined;

    for (const h of item.headings) {
      if (h.toLowerCase().includes(query)) return h;
    }
    for (const a of item.attributeNames) {
      if (a.toLowerCase().includes(query)) return `Attribute: ${a}`;
    }
    for (const e of item.endpointPaths) {
      if (e.toLowerCase().includes(query)) return e;
    }
    if (item.description.toLowerCase().includes(query))
      return this.ExtractSnippet(item.description, query);
    if (item.bodyText.toLowerCase().includes(query))
      return this.ExtractSnippet(item.bodyText, query);

    return undefined;
  }

  private ExtractSnippet(text: string, query: string): string {
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text.slice(0, 100);
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + query.length + 60);
    let snippet = text.slice(start, end).trim();
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet += '...';
    return snippet;
  }

  HighlightSyntax(code: string): string {
    let result = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const strings = new Map<string, string>();
    let counter = 0;

    const getKey = () => {
      let key = '';
      let n = counter++;
      do {
        key = String.fromCharCode(65 + (n % 26)) + key;
        n = Math.floor(n / 26) - 1;
      } while (n >= 0);
      return `§${key}§`;
    };

    result = result.replace(/"([^"\\]|\\.)*"\s*:/g, (match) => {
      const key = getKey();
      strings.set(key, match);
      return key;
    });

    result = result.replace(/"([^"\\]|\\.)*"/g, (match) => {
      const key = getKey();
      strings.set(key, `<span class="syn-string">${match}</span>`);
      return key;
    });

    result = result.replace(
      /\b(true|false)\b/g,
      '<span class="syn-boolean">$1</span>'
    );
    result = result.replace(/\b(null)\b/g, '<span class="syn-null">$1</span>');
    result = result.replace(/\b(\d+)\b/g, '<span class="syn-number">$1</span>');

    strings.forEach((value, key) => {
      result = result.replace(key, value);
    });

    return result;
  }
}
