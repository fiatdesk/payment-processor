import { GetDocRoutes } from './docs-catalog';

describe('docs catalog', () => {
  it('exposes the public guide and API slugs', () => {
    const routes = GetDocRoutes().map((route) => route.route);

    expect(routes).toContain('/quickstart');
    expect(routes).toContain('/accounts/create');
    expect(routes).toContain('/checkout-sessions');
  });
});
