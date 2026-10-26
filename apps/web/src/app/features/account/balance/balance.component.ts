import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { AuthService } from '../../../core';
import { BalanceService } from '../../../data';
import { ExpressBalanceComponent } from './views/express-balance/express-balance.component';
import { FullBalanceComponent } from './views/full-balance/full-balance.component';

@Component({
  selector: 'app-balance',
  imports: [ExpressBalanceComponent, FullBalanceComponent],
  template: `
    @if (isFull()) {
    <app-full-balance />
    } @else {
    <app-express-balance />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanceComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly balanceService = inject(BalanceService);

  isFull = computed(() => this.authService.dashboardType() === 'full');

  ngOnInit(): void {
    void this.balanceService.SyncBalanceOnPageOpen();
  }
}
