import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MetadataEditModalComponent } from '../../../components';
import { ConfirmDialogComponent } from '../../../../../shared';
import { PaymentIntentActionsService } from '../../services/payment-intent-actions.service';

@Component({
  selector: 'app-payment-intent-actions-host',
  imports: [MetadataEditModalComponent, ConfirmDialogComponent],
  templateUrl: './payment-intent-actions-host.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentIntentActionsHostComponent {
  readonly actions = inject(PaymentIntentActionsService);
}
