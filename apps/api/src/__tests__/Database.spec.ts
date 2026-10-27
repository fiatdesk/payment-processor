// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  Database,
  DUPLICATE_ONCHAIN_SUBSCRIPTIONS_MESSAGE,
} from '../modules/Database';

jest.mock('../utils/Logger', () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Database.EnsureCollections', () => {
  const DRIVER_TEXT =
    'E11000 duplicate key error collection: app.subscriptions index: subscription_onchain_id_1 dup key';

  /** Every collection builds its indexes, except `failing`. */
  function Models(failing: string, error: unknown) {
    const database = new Database();
    jest
      .spyOn(
        database as unknown as { GetModel(name: string): unknown },
        'GetModel'
      )
      .mockImplementation((name: string) => ({
        createCollection: jest.fn().mockResolvedValue(undefined),
        ensureIndexes:
          name === failing
            ? jest.fn().mockRejectedValue(error)
            : jest.fn().mockResolvedValue(undefined),
      }));
    return database;
  }

  it('stops startup with a fixed message when live Subscriptions share an on-chain id', async () => {
    const database = Models(
      'Subscriptions',
      Object.assign(new Error(DRIVER_TEXT), { code: 11000 })
    );

    const error = await database
      .EnsureCollections()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      DUPLICATE_ONCHAIN_SUBSCRIPTIONS_MESSAGE
    );
    expect((error as Error).message).toContain(
      'Subscriptions.subscription_onchain_id'
    );
    expect((error as Error).message).toContain(
      'Dedupe live Subscriptions per subscription_onchain_id'
    );
    expect((error as Error).message).not.toContain('E11000');
  });

  it('passes other index errors on unchanged', async () => {
    const other = Object.assign(new Error(DRIVER_TEXT), { code: 11000 });
    const database = Models('TopUps', other);

    await expect(database.EnsureCollections()).rejects.toBe(other);
  });
});
