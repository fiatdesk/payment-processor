import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import type { PaymentIntent } from '@zoneless/shared-types';
import { Subject } from 'rxjs';
import { PaymentIntentService } from '../../../../data';
import { ApiService } from '../../../../core';
import {
  BuildCsv,
  BuildExportFilename,
  DownloadCsv,
  ExportDataset,
  FetchAllPages,
} from '../util/transaction-export';

export type PaymentIntentActionEvent = {
  type: 'updated';
  paymentIntent: PaymentIntent;
};

@Injectable()
export class PaymentIntentActionsService {
  private readonly paymentIntentService = inject(PaymentIntentService);
  private readonly api = inject(ApiService);

  metadataDialogOpen: WritableSignal<boolean> = signal(false);
  metadataSaving: WritableSignal<boolean> = signal(false);
  metadataTarget: WritableSignal<PaymentIntent | null> = signal(null);
  metadataDraft: WritableSignal<Record<string, string>> = signal({});

  readonly events$ = new Subject<PaymentIntentActionEvent>();

  exportDialogOpen: WritableSignal<boolean> = signal(false);
  exporting: WritableSignal<boolean> = signal(false);
  exportError: WritableSignal<string> = signal('');
  exportTabLabel: WritableSignal<string> = signal('');
  private readonly exportDataset: WritableSignal<ExportDataset | null> =
    signal(null);

  OpenExport(dataset: ExportDataset): void {
    this.exportDataset.set(dataset);
    this.exportTabLabel.set(dataset.tabLabel);
    this.exportError.set('');
    this.exportDialogOpen.set(true);
  }

  CloseExport(): void {
    this.exportDialogOpen.set(false);
    this.exportError.set('');
    this.exportTabLabel.set('');
    this.exportDataset.set(null);
  }

  async ConfirmExport(): Promise<void> {
    const dataset = this.exportDataset();
    if (!dataset) return;

    this.exporting.set(true);
    this.exportError.set('');
    try {
      const items = await FetchAllPages(
        this.api,
        dataset.endpoint,
        dataset.queryParams
      );

      if (items.length === 0) {
        this.exportError.set(`No ${dataset.tabLabel} to export.`);
        return;
      }

      DownloadCsv(
        BuildExportFilename(dataset.filenameStem),
        BuildCsv(dataset, items)
      );
      this.CloseExport();
    } catch (error) {
      this.exportError.set(
        error instanceof Error ? error.message : 'Export failed.'
      );
    } finally {
      this.exporting.set(false);
    }
  }

  OpenEditMetadata(paymentIntent: PaymentIntent): void {
    this.metadataTarget.set(paymentIntent);
    this.metadataDraft.set({ ...(paymentIntent.metadata ?? {}) });
    this.metadataDialogOpen.set(true);
  }

  OnMetadataChange(metadata: Record<string, string>): void {
    this.metadataDraft.set(metadata);
  }

  async ConfirmEditMetadata(): Promise<void> {
    const paymentIntent = this.metadataTarget();
    if (!paymentIntent) return;
    this.metadataSaving.set(true);
    try {
      const updated = await this.paymentIntentService.UpdatePaymentIntent(
        paymentIntent.id,
        { metadata: this.metadataDraft() }
      );
      this.events$.next({ type: 'updated', paymentIntent: updated });
      this.metadataDialogOpen.set(false);
    } finally {
      this.metadataSaving.set(false);
    }
  }
}
