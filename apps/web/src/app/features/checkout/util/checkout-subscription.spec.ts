import type { CheckoutSession, Eip712TypedData } from '@fiatdesk/shared-types';

import {
  CheckoutTrialSummary,
  DescribeSubscribeTerms,
  FormatUsdcUnits,
  PeriodLabel,
  PlanPermitValue,
  TrialPeriodDays,
} from './checkout-subscription';

const DAY = 86400;
const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

/** A `Subscribe` for `amount` USDC base units every `periodSeconds`. */
function Subscribe(
  amount: string,
  periodSeconds: number,
  extra: Record<string, string | number> = {}
): Eip712TypedData {
  return {
    domain: {
      name: 'Subscriptions',
      version: '1',
      chainId: 11155111,
      verifyingContract: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    },
    types: {},
    primaryType: 'Subscribe',
    message: {
      token: USDC,
      amount,
      periodSeconds: String(periodSeconds),
      ...extra,
    },
  };
}

function Session(recurring: Record<string, unknown>): CheckoutSession {
  return {
    mode: 'subscription',
    amount_total: 1250,
    line_items: {
      object: 'list',
      data: [{ price: { id: 'price_1', unit_amount: 1250, recurring } }],
    },
  } as unknown as CheckoutSession;
}

describe('PlanPermitValue', () => {
  it.each([
    // ceil(365 / 7) = 53 weeks
    ['a weekly plan covers 53 periods', 7 * DAY, 53],
    // ceil(365 / 30) = 13 months
    ['a monthly plan covers 13 periods', 30 * DAY, 13],
    // ceil(365 / 365) = 1, raised to the 12-period minimum
    ['a yearly plan covers 12 periods', 365 * DAY, 12],
    ['an hourly plan covers a year of hours', 3600, 8760],
  ])('%s', (_label, periodSeconds, periods) => {
    expect(PlanPermitValue(Subscribe('10000000', periodSeconds))).toEqual({
      periods: BigInt(periods),
      value: BigInt(10_000_000) * BigInt(periods),
    });
  });

  it('is null for a period that is not a positive integer', () => {
    expect(PlanPermitValue(Subscribe('10000000', 0))).toBeNull();
    expect(
      PlanPermitValue({
        ...Subscribe('10000000', 30 * DAY),
        message: { amount: '1.5', periodSeconds: '2592000' },
      })
    ).toBeNull();
  });
});

describe('PeriodLabel', () => {
  it.each([
    [3600, 'hour'],
    [DAY, 'day'],
    [7 * DAY, 'week'],
    [14 * DAY, '2 weeks'],
    [30 * DAY, 'month'],
    [90 * DAY, '3 months'],
    [365 * DAY, 'year'],
    [730 * DAY, '2 years'],
    [90, '90 seconds'],
  ])('labels %i seconds as %s', (seconds, label) => {
    expect(PeriodLabel(seconds)).toBe(label);
  });
});

describe('FormatUsdcUnits', () => {
  it.each([
    ['0', '0.00'],
    ['10000000', '10.00'],
    ['10500000', '10.50'],
    ['1234567', '1.234567'],
    ['1000001', '1.000001'],
    ['1234567890000', '1,234,567.89'],
  ])('formats %s base units as %s', (units, formatted) => {
    expect(FormatUsdcUnits(BigInt(units))).toBe(formatted);
  });
});

describe('DescribeSubscribeTerms', () => {
  it('describes a weekly plan with 6-decimal amounts and the allowance its permit sets', () => {
    const subscribe = Subscribe('1234567', 14 * DAY);
    const terms = DescribeSubscribeTerms({
      subscribe,
      permit: {
        ...subscribe,
        primaryType: 'Permit',
        message: { value: '33333309' },
      },
      deadline: 1793106000,
    });

    expect(terms).toEqual({
      recurring: '1.234567 USDC every 2 weeks',
      token: 'USDC (0x1c7D…7238)',
      firstCharge: 'First charge today',
      firstChargeAt: null,
      allowance: {
        // ceil(365 / 14) = 27 periods
        added: '33.333309 USDC (27 charges)',
        total: '33.333309 USDC',
      },
    });
  });

  it('reads a signed first charge time', () => {
    const terms = DescribeSubscribeTerms({
      subscribe: Subscribe('10000000', 30 * DAY, {
        firstChargeAt: '1793707200',
      }),
      permit: null,
      deadline: 1793106000,
    });

    expect(terms.firstCharge).toBe('First charge on 3 Nov 2026');
    expect(terms.firstChargeAt).toBe(1793707200);
    expect(terms.allowance).toBeNull();
  });
});

describe('trials', () => {
  // 27 Oct 2026, 12:00 UTC
  const NOW = 1793102400;

  it('reads the trial length from the price', () => {
    expect(
      TrialPeriodDays(Session({ interval: 'month', trial_period_days: 7 }))
    ).toBe(7);
    expect(
      TrialPeriodDays(Session({ interval: 'month', trial_period_days: 0 }))
    ).toBe(0);
    expect(TrialPeriodDays(Session({ interval: 'month' }))).toBe(0);
  });

  it('estimates the first charge from the trial length until it is signed', () => {
    const session = Session({ interval: 'month', trial_period_days: 7 });

    expect(CheckoutTrialSummary(session, null, NOW)).toEqual({
      label: '7-day free trial',
      firstCharge: 'First charge around 3 Nov 2026 (estimated)',
      amount: 'US$12.50',
    });
    expect(CheckoutTrialSummary(session, NOW + DAY, NOW)?.firstCharge).toBe(
      'First charge on 28 Oct 2026'
    );
  });

  it('shows no trial for a price without one', () => {
    expect(
      CheckoutTrialSummary(Session({ interval: 'month' }), null, NOW)
    ).toBeNull();
  });
});
