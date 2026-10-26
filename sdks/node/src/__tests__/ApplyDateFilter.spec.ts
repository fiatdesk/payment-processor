import { ApplyDateFilter } from '../utils/ApplyDateFilter';

describe('ApplyDateFilter', () => {
  it('writes Stripe-style range query params', () => {
    const query: Record<string, string | number | boolean | undefined> = {
      limit: 10,
    };
    ApplyDateFilter(query, 'created', { gte: 100, lt: 200 });
    expect(query).toEqual({
      limit: 10,
      'created[gte]': 100,
      'created[lt]': 200,
    });
  });

  it('leaves the query unchanged when no filter is given', () => {
    const query: Record<string, string | number | boolean | undefined> = {};
    ApplyDateFilter(query, 'created');
    expect(query).toEqual({});
  });
});
