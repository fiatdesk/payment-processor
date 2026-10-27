// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import mongoose from 'mongoose';
import { Database } from '../modules/Database';
import {
  CycleClaimId,
  SubscriptionCycleClaims,
} from '../modules/SubscriptionCycleClaims';
import { MemoryDatabase } from './mocks/MemoryDatabase';

const SUB_ID = `0x${'5b'.repeat(32)}`;
const DUE_AT = 1_700_000_000;
const CLAIM_ID = CycleClaimId(SUB_ID, DUE_AT);
const CHARGE = `0x${'c4'.repeat(32)}`;

describe('SubscriptionCycleClaims', () => {
  it('cannot be stored as a mongoose document of the API schema: its `id` is dropped', () => {
    // Why claims are written by an upsert: the flexible schema has mongoose's
    // `id` virtual, which swallows a document's own `id` (mongoose 9).
    const model = (
      new Database() as unknown as {
        GetModel(name: string): mongoose.Model<Record<string, unknown>>;
      }
    ).GetModel('SubscriptionCycleClaims');

    const document = new model({ id: CLAIM_ID, owner: 'cs_z_1' });

    expect(document.toObject()).not.toHaveProperty('id');
    expect(document.toObject()).toMatchObject({ owner: 'cs_z_1' });
  });

  it('claims through Database.Set with $setOnInsert, the filter supplying the id', async () => {
    const db = {
      Set: jest.fn<
        Promise<{ id: string; owner: string }>,
        [string, string, unknown]
      >(async (_collection, id) => ({ id, owner: 'cs_z_1' })),
    };

    const { owned } = await new SubscriptionCycleClaims(
      db as unknown as Database
    ).Claim(SUB_ID, DUE_AT, 'cs_z_1');

    expect(owned).toBe(true);
    expect(db.Set).toHaveBeenCalledWith('SubscriptionCycleClaims', CLAIM_ID, {
      $setOnInsert: expect.objectContaining({
        owner: 'cs_z_1',
        due_at: DUE_AT,
        charge_hashes: [],
      }),
    });
    expect(db.Set.mock.calls[0][2]).not.toHaveProperty('$setOnInsert.id');
  });

  it('gives a cycle to its first collector only, keeps its id and compare-and-sets its charges', async () => {
    const memory = new MemoryDatabase();
    const claims = new SubscriptionCycleClaims(memory.AsDatabase());

    await expect(claims.Claim(SUB_ID, DUE_AT, 'cs_z_1')).resolves.toMatchObject(
      { owned: true, claim: { id: CLAIM_ID } }
    );
    await expect(claims.Claim(SUB_ID, DUE_AT, 'in_z_1')).resolves.toMatchObject(
      { owned: false, claim: { owner: 'cs_z_1' } }
    );
    await expect(claims.Claim(SUB_ID, DUE_AT, 'cs_z_1')).resolves.toMatchObject(
      { owned: true }
    );
    await expect(
      claims.SetChargeHash(CLAIM_ID, CHARGE, null, { nonce: 4 })
    ).resolves.toBe(true);
    await expect(claims.Get(CLAIM_ID)).resolves.toMatchObject({
      charge_hash: CHARGE,
      charge_hashes: [CHARGE],
      charge_nonce: 4,
    });
  });
});

// Opt-in: MONGODB_TEST_URI=mongodb://localhost:27017 runs the claim against a
// real MongoDB, in a database of its own that it drops afterwards.
const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI;
(MONGODB_TEST_URI ? describe : describe.skip)(
  'SubscriptionCycleClaims on a real MongoDB',
  () => {
    const database = `cycle_claims_spec_${process.pid}`;
    let claims: SubscriptionCycleClaims;

    beforeAll(async () => {
      await mongoose.connect(MONGODB_TEST_URI as string, {
        dbName: database,
      });
      const db = new Database();
      await db.EnsureCollections();
      claims = new SubscriptionCycleClaims(db);
    });

    afterAll(async () => {
      await mongoose.connection.db?.dropDatabase();
      await mongoose.disconnect();
    });

    it('stores the claim under its id, once, and compare-and-sets its charges', async () => {
      await expect(
        claims.Claim(SUB_ID, DUE_AT, 'cs_z_1')
      ).resolves.toMatchObject({ owned: true, claim: { id: CLAIM_ID } });
      await expect(
        claims.Claim(SUB_ID, DUE_AT, 'in_z_1')
      ).resolves.toMatchObject({ owned: false });
      await expect(
        claims.SetChargeHash(CLAIM_ID, CHARGE, null, { nonce: 4 })
      ).resolves.toBe(true);
      await expect(claims.Get(CLAIM_ID)).resolves.toMatchObject({
        owner: 'cs_z_1',
        charge_hash: CHARGE,
        charge_hashes: [CHARGE],
        charge_nonce: 4,
      });
      await expect(claims.FindByChargeHash(CHARGE)).resolves.toEqual([
        expect.objectContaining({ id: CLAIM_ID }),
      ]);
    });
  }
);
