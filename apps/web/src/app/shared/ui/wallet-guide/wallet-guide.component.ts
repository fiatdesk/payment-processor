import {
  ChangeDetectionStrategy,
  Component,
  Input,
  signal,
  WritableSignal,
} from '@angular/core';

@Component({
  selector: 'app-wallet-guide',
  standalone: true,
  templateUrl: './wallet-guide.component.html',
  styleUrls: ['./wallet-guide.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletGuideComponent {
  @Input() title = "Don't have a wallet yet?";
  @Input() mode: 'connect' | 'checkout' = 'connect';

  // We use a setter to initialize the signal from the input
  @Input() set expanded(value: boolean) {
    this.showWalletGuide.set(value);
  }

  showWalletGuide: WritableSignal<boolean> = signal(false);

  ToggleWalletGuide(): void {
    this.showWalletGuide.set(!this.showWalletGuide());
  }
}
