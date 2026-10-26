import { Component, Input, computed, inject } from '@angular/core';
import { SdkPreferenceService } from '../../services/sdk-preference';

export interface CodeTab {
  id: string;
  label: string;
  code: string;
}

export interface CodeEndpoint {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
}

export type CodeTheme = 'light' | 'dark';

@Component({
  selector: 'app-code-snippet',
  imports: [],
  templateUrl: './code-snippet.html',
  styleUrl: './code-snippet.scss',
  host: { '[class.dark]': 'theme === "dark"' },
})
export class CodeSnippet {
  @Input() tabs: CodeTab[] = [];
  @Input() filename?: string;
  @Input() title?: string;
  @Input() endpoint?: CodeEndpoint;
  @Input() theme: CodeTheme = 'light';

  private sdkPreference = inject(SdkPreferenceService);

  // Computed active tab - uses global preference if available, otherwise first tab
  activeTab = computed(() => {
    const preference = this.sdkPreference.GetPreference();
    const hasPreferredTab = this.tabs.some((t) => t.id === preference);

    if (hasPreferredTab) {
      return preference;
    }

    // Fallback to first tab if preferred SDK not available
    return this.tabs.length > 0 ? this.tabs[0].id : '';
  });

  SetActiveTab(tabId: string): void {
    this.sdkPreference.SetPreference(tabId);
  }

  GetActiveCode(): string {
    const tab = this.tabs.find((t) => t.id === this.activeTab());
    return tab?.code || '';
  }

  GetHighlightedCode(): string {
    const code = this.GetActiveCode();
    return this.HighlightSyntax(code);
  }

  private HighlightSyntax(code: string): string {
    // Escape HTML entities first
    let result = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Store strings/comments in map with unique letter-based keys
    const stored = new Map<string, string>();
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

    // Strings first (to protect URLs and other content containing // from being treated as comments)
    result = result.replace(/'(?:[^'\\]|\\.)*'/g, (match) => {
      const key = getKey();
      stored.set(key, `<span class="syn-string">${match}</span>`);
      return key;
    });
    result = result.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
      const key = getKey();
      stored.set(key, `<span class="syn-string">${match}</span>`);
      return key;
    });
    result = result.replace(/`(?:[^`\\]|\\.)*`/g, (match) => {
      const key = getKey();
      stored.set(key, `<span class="syn-string">${match}</span>`);
      return key;
    });

    const resolveStoredPlaceholders = (text: string): string => {
      let resolved = text;
      stored.forEach((value, key) => {
        if (resolved.includes(key)) {
          resolved = resolved
            .split(key)
            .join(value.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, ''));
        }
      });
      return resolved;
    };

    result = result.replace(/(?<!:)(\/\/.*)$/gm, (match) => {
      const key = getKey();
      stored.set(
        key,
        `<span class="syn-comment">${resolveStoredPlaceholders(match)}</span>`
      );
      return key;
    });
    result = result.replace(/^(\s*#.*)$/gm, (match) => {
      const key = getKey();
      stored.set(
        key,
        `<span class="syn-comment">${resolveStoredPlaceholders(match)}</span>`
      );
      return key;
    });

    // Keywords - red
    result = result.replace(
      /\b(const|let|var|function|async|await|return|if|else|for|while|new|class|export|import|from|require)\b/g,
      '<span class="syn-keyword">$1</span>'
    );

    // Booleans - blue
    result = result.replace(
      /\b(true|false)\b/g,
      '<span class="syn-boolean">$1</span>'
    );

    // Null/undefined - blue
    result = result.replace(
      /\b(null|undefined)\b/g,
      '<span class="syn-null">$1</span>'
    );

    // Numbers - red
    result = result.replace(/\b(\d+)\b/g, '<span class="syn-number">$1</span>');

    // curl flags - purple
    result = result.replace(
      /(\s)(-[A-Za-z]+|--[a-z-]+)(?=\s|$)/g,
      '$1<span class="syn-flag">$2</span>'
    );

    // Restore stored items
    stored.forEach((value, key) => {
      result = result.replace(key, value);
    });

    return result;
  }

  async CopyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.GetActiveCode());
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  }
}
