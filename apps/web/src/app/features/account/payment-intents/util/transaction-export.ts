import type {
  BalanceTransaction,
  ListResponse,
  PaymentIntent,
} from '@zoneless/shared-types';
import type { ApiService } from '../../../../core';

export const EXPORT_PAGE_SIZE = 100;

export const EXPORT_MAX_PAGES = 50;

const CRLF = '\r\n';

const BOM = '\uFEFF';

const FORMULA_PREFIXES = ['=', '+', '@', '\t', '\r'];

type CsvValue = string | number | null | undefined;

export interface ExportDataset {
  endpoint: string;
  queryParams: Record<string, string>;
  filenameStem: string;
  tabLabel: string;
  headers: string[];
  row: (item: unknown) => CsvValue[];
}

export function EscapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);

  const guarded = NeedsFormulaGuard(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded)
    ? `"${guarded.replace(/"/g, '""')}"`
    : guarded;
}

export function BuildCsv(dataset: ExportDataset, items: unknown[]): string {
  const lines = [dataset.headers.map(EscapeCsvValue).join(',')];
  for (const item of items) {
    lines.push(dataset.row(item).map(EscapeCsvValue).join(','));
  }
  return `${BOM}${lines.join(CRLF)}${CRLF}`;
}

export async function FetchAllPages<T extends { id: string; created: number }>(
  api: ApiService,
  endpoint: string,
  queryParams: Record<string, string> = {}
): Promise<T[]> {
  const items = new Map<string, T>();
  let oldest: number | undefined;

  for (let page = 0; page < EXPORT_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      limit: String(EXPORT_PAGE_SIZE),
      ...queryParams,
    });
    // An inclusive window re-fetches a second that a page boundary cuts in half.
    if (oldest !== undefined) params.set('created[lte]', String(oldest));

    const response = await api.Call<ListResponse<T>>(
      'GET',
      `${endpoint}?${params}`
    );

    for (const item of response.data) items.set(item.id, item);

    const lastItem = response.data[response.data.length - 1];
    if (!response.has_more || !lastItem) return [...items.values()];

    // No progress means one second holds more rows than a page can carry.
    if (lastItem.created === oldest) {
      throw new Error('Too many transactions share one timestamp to export.');
    }
    oldest = lastItem.created;
  }

  throw new Error(
    `This export covers at most ${
      EXPORT_MAX_PAGES * EXPORT_PAGE_SIZE
    } transactions. Narrow the filters and try again.`
  );
}

export function BuildExportFilename(stem: string, now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${stem}_${year}${month}${day}.csv`;
}

export function DownloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const BALANCE_TRANSACTION_TABS: Record<
  string,
  { stem: string; label: string }
> = {
  payout: { stem: 'payouts', label: 'payouts' },
  topup: { stem: 'topups', label: 'top-ups' },
  transfer: { stem: 'transfers', label: 'transfers' },
};

export function BalanceTransactionExportDataset(
  queryParams: Record<string, string> = {}
): ExportDataset {
  const tab = BALANCE_TRANSACTION_TABS[queryParams['type'] ?? ''];
  return {
    endpoint: 'balance_transactions',
    queryParams,
    filenameStem: tab?.stem ?? 'balance_transactions',
    tabLabel: tab?.label ?? 'transactions',
    headers: [
      'balance_transaction_id',
      'created_utc',
      'available_on_utc',
      'currency',
      'amount',
      'fee',
      'net',
      'type',
      'reporting_category',
      'status',
      'description',
      'source_id',
    ],
    row: BalanceTransactionRow,
  };
}

export function PaymentIntentExportDataset(
  queryParams: Record<string, string> = {}
): ExportDataset {
  return {
    endpoint: 'payment_intents',
    queryParams,
    filenameStem: 'payment_intents',
    tabLabel: 'payments',
    headers: [
      'id',
      'created_utc',
      'currency',
      'amount',
      'status',
      'payment_method_types',
      'description',
      'customer',
    ],
    row: PaymentIntentRow,
  };
}

function BalanceTransactionRow(item: unknown): CsvValue[] {
  const transaction = item as BalanceTransaction;
  return [
    transaction.id,
    FormatUtc(transaction.created),
    FormatUtc(transaction.available_on),
    transaction.currency,
    MajorUnits(transaction.amount),
    MajorUnits(transaction.fee),
    MajorUnits(transaction.net),
    transaction.type,
    transaction.reporting_category,
    transaction.status,
    transaction.description,
    transaction.source,
  ];
}

function PaymentIntentRow(item: unknown): CsvValue[] {
  const paymentIntent = item as PaymentIntent;
  return [
    paymentIntent.id,
    FormatUtc(paymentIntent.created),
    paymentIntent.currency,
    MajorUnits(paymentIntent.amount),
    paymentIntent.status,
    (paymentIntent.payment_method_types ?? []).join(','),
    paymentIntent.description,
    CustomerId(paymentIntent.customer),
  ];
}

function CustomerId(customer: PaymentIntent['customer']): string {
  if (!customer) return '';
  return typeof customer === 'string' ? customer : customer.id;
}

function FormatUtc(timestamp: number): string {
  return new Date(timestamp * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

function MajorUnits(cents: number): string {
  return (cents / 100).toFixed(2);
}

function NeedsFormulaGuard(value: string): boolean {
  const first = value.charAt(0);
  if (FORMULA_PREFIXES.includes(first)) return true;
  return first === '-' && Number.isNaN(Number(value));
}
