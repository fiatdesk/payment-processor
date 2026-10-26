import {
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  PLATFORM_ID,
  inject,
  input,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type CopyStatus = 'idle' | 'copied' | 'error';

@Component({
  selector: 'app-agent-prompt-cta',
  standalone: true,
  templateUrl: './agent-prompt-cta.html',
  styleUrl: './agent-prompt-cta.scss',
})
export class AgentPromptCta implements OnDestroy {
  prompt = input.required<string>();
  variant = input<'card' | 'compact' | 'note'>('card');
  /** Compact-variant caption shown beneath the prompt before it is copied. */
  caption = input(
    'Paste into Cursor, Claude Code, or any coding agent to add USDC payouts.'
  );
  /** Card-variant heading and supporting copy. */
  eyebrow = input('Add Zoneless with a coding agent');
  description = input(
    'The easiest way to add Zoneless payouts to your platform. Your existing checkout and payout methods stay in place.'
  );

  copyStatus = signal<CopyStatus>('idle');
  previewScrolling = signal(false);

  private host = inject(ElementRef<HTMLElement>);
  private isBrowser: boolean;
  private copyTimeout?: ReturnType<typeof setTimeout>;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnDestroy(): void {
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
  }

  StartPreviewScroll(event: Event): void {
    if (!this.isBrowser || this.copyStatus() !== 'idle') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const track = this.PreviewTrack(event);
    if (!track) return;
    track.style.animation = '';
    track.style.transition = '';
    track.style.transform = '';
    this.previewScrolling.set(true);
  }

  RewindPreviewScroll(event: Event): void {
    const track = this.PreviewTrack(event);
    if (!track || !this.previewScrolling()) {
      this.previewScrolling.set(false);
      return;
    }

    const raw = getComputedStyle(track).transform;
    const x = raw === 'none' ? 0 : new DOMMatrix(raw).m41;
    track.style.animation = 'none';
    track.style.transition = 'none';
    track.style.transform = `translateX(${x}px)`;
    this.previewScrolling.set(false);
    if (Math.abs(x) < 1) {
      track.style.animation = '';
      track.style.transition = '';
      track.style.transform = '';
      return;
    }

    const duration = Math.min(1800, Math.max(900, Math.abs(x) * 1.15));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.previewScrolling()) return;
        track.style.transition = `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;
        track.style.transform = 'translateX(0)';
        track.addEventListener(
          'transitionend',
          () => {
            if (this.previewScrolling()) return;
            track.style.animation = '';
            track.style.transition = '';
            track.style.transform = '';
          },
          { once: true }
        );
      });
    });
  }

  OnPreviewFocusOut(event: FocusEvent): void {
    const cluster = event.currentTarget;
    if (!(cluster instanceof HTMLElement)) return;
    if (
      event.relatedTarget instanceof Node &&
      cluster.contains(event.relatedTarget)
    )
      return;
    this.RewindPreviewScroll(event);
  }

  async CopyPrompt(): Promise<void> {
    if (!this.isBrowser) return;

    try {
      await navigator.clipboard.writeText(this.prompt());
      this.SetCopyStatus('copied');
    } catch (error) {
      console.error('Failed to copy agent prompt:', error);
      this.SetCopyStatus('error');
    }
  }

  private SetCopyStatus(status: CopyStatus): void {
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }

    this.copyStatus.set(status);
    if (status !== 'idle') this.ResetPreviewTrack();
    // The copied state shows a follow-up instruction, so give it time to read.
    const duration = status === 'copied' ? 4000 : 2000;
    this.copyTimeout = setTimeout(() => {
      this.copyStatus.set('idle');
      this.ResumePreviewIfHovered();
    }, duration);
  }

  private ResetPreviewTrack(): void {
    this.previewScrolling.set(false);
    const track = this.Cluster()?.querySelector('.compact-prompt-track');
    if (!(track instanceof HTMLElement)) return;
    track.style.animation = '';
    track.style.transition = '';
    track.style.transform = '';
  }

  private ResumePreviewIfHovered(): void {
    const cluster = this.Cluster();
    if (!cluster?.matches(':hover')) {
      this.ResetPreviewTrack();
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const track = cluster.querySelector('.compact-prompt-track');
    if (!(track instanceof HTMLElement)) return;
    track.style.animation = '';
    track.style.transition = '';
    track.style.transform = '';
    this.previewScrolling.set(true);
  }

  private Cluster(): HTMLElement | null {
    const cluster = this.host.nativeElement.querySelector(
      '.compact-copy-cluster'
    );
    return cluster instanceof HTMLElement ? cluster : null;
  }

  private PreviewTrack(event: Event): HTMLElement | null {
    const cluster = event.currentTarget;
    if (!(cluster instanceof HTMLElement)) return null;
    return cluster.querySelector('.compact-prompt-track');
  }
}
