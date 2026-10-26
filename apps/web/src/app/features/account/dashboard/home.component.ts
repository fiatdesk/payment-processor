import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { AuthService } from '../../../core';
import { BalanceService } from '../../../data';
import { ExpressHomeComponent } from './express-home/express-home.component';
import { FullHomeComponent } from './full-home/full-home.component';

@Component({
  selector: 'app-home',
  imports: [ExpressHomeComponent, FullHomeComponent],
  template: `
    @if (isFull()) {
    <app-full-home />
    } @else {
    <app-express-home />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly balanceService = inject(BalanceService);

  isFull = computed(() => this.authService.dashboardType() === 'full');

  ngOnInit(): void {
    void this.balanceService.SyncBalanceOnPageOpen();
  }
}
