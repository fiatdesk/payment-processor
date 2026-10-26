import type { BalanceTransaction, PaymentIntent } from '@zoneless/shared-types';

import type { ApiService } from '../../../../core';
import {
  BalanceTransactionExportDataset,
  BuildCsv,
  BuildExportFilename,
  EscapeCsvValue,
  EXPORT_MAX_PAGES,
  EXPORT_PAGE_SIZE,
  FetchAllPages,
  PaymentIntentExportDataset,
} from './transaction-export';
import type { ExportDataset } from './transaction-export';

interface TestItem {
  id: string;
  created: number;
}

function MockApi(pages: { data: TestItem[]; has_more: boolean }[]): {
  api: ApiService;
  call: jest.Mock;
} {
  const call = jest.fn();
  for (const page of pages) {
    call.mockResolvedValueOnce({ object: 'list', url: '/v1', ...page });
  }
  return { api: { Call: call } as unknown as ApiService, call };
}

const SmallDataset: ExportDataset = {
  endpoint: 'test',
  queryParams: {},
  filenameStem: 'test',
  tabLabel: 'tests',
  headers: ['id', 'amount'],
  row: (item) => {
    const row = item as { id: string; amount: number };
    return [row.id, row.amount];
  },
};

describe('EscapeCsvValue', () => {
  it('leaves plain values untouched', () => {
    expect(EscapeCsvValue('payout')).toBe('payout');
  });

  it('quotes separators and doubles embedded quotes', () => {
    expect(EscapeCsvValue('payout, topup')).toBe('"payout, topup"');
    expect(EscapeCsvValue('He said "hi"')).toBe('"He said ""hi"""');
    expect(EscapeCsvValue('two\nlines')).toBe('"two\nlines"');
  });

  it('renders null and undefined as empty', () => {
    expect(EscapeCsvValue(null)).toBe('');
    expect(EscapeCsvValue(undefined)).toBe('');
  });

  it('negates spreadsheet formulas without touching numbers', () => {
    expect(EscapeCsvValue('=1+1')).toBe("'=1+1");
    expect(EscapeCsvValue('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(EscapeCsvValue('+cmd|calc')).toBe("'+cmd|calc");
    expect(EscapeCsvValue('-2+3')).toBe("'-2+3");
    expect(EscapeCsvValue('-12.34')).toBe('-12.34');
    expect(EscapeCsvValue(-12.34)).toBe('-12.34');
  });
});

describe('BuildCsv', () => {
  it('writes a UTF-8 BOM, a header row, and CRLF line endings', () => {
    const csv = BuildCsv(SmallDataset, [{ id: 'bt_1', amount: 12.34 }]);
    expect(csv).toBe('\uFEFFid,amount\r\nbt_1,12.34\r\n');
  });

  it('writes only the header when there is nothing to export', () => {
    expect(BuildCsv(SmallDataset, [])).toBe('\uFEFFid,amount\r\n');
  });
});

describe('BalanceTransactionExportDataset', () => {
  it('exports the transaction fields in major units and UTC', () => {
    const transaction: BalanceTransaction = {
      id: 'bt_1',
      object: 'balance_transaction',
      amount: 10000,
      available_on: 1789000000,
      balance_type: 'payments',
      created: 1789000000,
      currency: 'usdc',
      description: null,
      fee: 290,
      fee_details: [],
      net: 9710,
      reporting_category: 'charge',
      source: 'pi_1',
      status: 'available',
      type: 'payment',
      account: 'acct_1',
      platform_account: 'acct_1',
    };

    const csv = BuildCsv(BalanceTransactionExportDataset({ type: 'payout' }), [
      transaction,
    ]);

    const [header, row] = csv.replace('\uFEFF', '').trim().split('\r\n');
    expect(header).toBe(
      'balance_transaction_id,created_utc,available_on_utc,currency,amount,fee,net,type,reporting_category,status,description,source_id'
    );
    expect(row).toBe(
      'bt_1,2026-09-10 00:26:40,2026-09-10 00:26:40,usdc,100.00,2.90,97.10,payment,charge,available,,pi_1'
    );
  });

  it('names the file and the dialog after the tab dataset', () => {
    expect(BalanceTransactionExportDataset({ type: 'topup' })).toMatchObject({
      filenameStem: 'topups',
      tabLabel: 'top-ups',
    });
    expect(BalanceTransactionExportDataset()).toMatchObject({
      filenameStem: 'balance_transactions',
      tabLabel: 'transactions',
    });
  });
});

describe('PaymentIntentExportDataset', () => {
  it('exports the payment fields, quoting the payment method list', () => {
    const paymentIntent = {
      id: 'pi_1',
      created: 1789000000,
      currency: 'usdc',
      amount: 5200,
      status: 'succeeded',
      payment_method_types: ['crypto', 'card'],
      description: 'Local export check',
      customer: { id: 'cus_1' },
    } as unknown as PaymentIntent;

    const csv = BuildCsv(PaymentIntentExportDataset({ status: 'succeeded' }), [
      paymentIntent,
    ]);

    const [header, row] = csv.replace('\uFEFF', '').trim().split('\r\n');
    expect(header).toBe(
      'id,created_utc,currency,amount,status,payment_method_types,description,customer'
    );
    expect(row).toBe(
      'pi_1,2026-09-10 00:26:40,usdc,52.00,succeeded,"crypto,card",Local export check,cus_1'
    );
  });
});

describe('BuildExportFilename', () => {
  it('dates the download with the UTC date', () => {
    expect(
      BuildExportFilename(
        'balance_transactions',
        new Date('2026-09-16T23:30:00Z')
      )
    ).toBe('balance_transactions_20260916.csv');
  });
});

describe('FetchAllPages', () => {
  it('requests the page size and the active filters', async () => {
    const { api, call } = MockApi([
      { data: [{ id: 'bt_1', created: 5 }], has_more: false },
    ]);

    await FetchAllPages(api, 'balance_transactions', { type: 'payout' });

    expect(call).toHaveBeenCalledWith(
      'GET',
      `balance_transactions?limit=${EXPORT_PAGE_SIZE}&type=payout`
    );
  });

  it('pages on the created window, keeping rows a cursor would drop at a second boundary', async () => {
    const { api, call } = MockApi([
      {
        data: [
          { id: 'bt_5', created: 9 },
          { id: 'bt_4', created: 5 },
          { id: 'bt_3', created: 5 },
        ],
        has_more: true,
      },
      {
        data: [
          { id: 'bt_3', created: 5 },
          { id: 'bt_2', created: 5 },
          { id: 'bt_1', created: 4 },
        ],
        has_more: false,
      },
    ]);

    const items = await FetchAllPages(api, 'balance_transactions');

    expect(items.map((item) => item.id)).toEqual([
      'bt_5',
      'bt_4',
      'bt_3',
      'bt_2',
      'bt_1',
    ]);
    expect(call).toHaveBeenLastCalledWith(
      'GET',
      `balance_transactions?limit=${EXPORT_PAGE_SIZE}&created%5Blte%5D=5`
    );
  });

  it('stops at the page cap instead of returning a partial export', async () => {
    let page = 0;
    const call = jest.fn().mockImplementation(() => {
      page += 1;
      return Promise.resolve({
        object: 'list',
        url: '/v1',
        data: [{ id: `bt_${page}`, created: 1000 - page }],
        has_more: true,
      });
    });

    await expect(
      FetchAllPages(
        { Call: call } as unknown as ApiService,
        'balance_transactions'
      )
    ).rejects.toThrow(String(EXPORT_MAX_PAGES * EXPORT_PAGE_SIZE));

    expect(call).toHaveBeenCalledTimes(EXPORT_MAX_PAGES);
  });

  it('reports a second that holds more rows than one page', async () => {
    const call = jest.fn().mockResolvedValue({
      object: 'list',
      url: '/v1',
      data: [{ id: 'bt_1', created: 5 }],
      has_more: true,
    });

    await expect(
      FetchAllPages(
        { Call: call } as unknown as ApiService,
        'balance_transactions'
      )
    ).rejects.toThrow('share one timestamp');
  });
});
