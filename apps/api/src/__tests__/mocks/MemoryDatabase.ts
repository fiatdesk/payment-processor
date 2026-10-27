// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * In-memory stand-in for `Database` with the Mongo semantics the payout flow
 * relies on: equality and `$in`/`$ne` filters (array fields match by
 * containment), `$set`/`$addToSet`/`$unset` updates with dotted paths,
 * transactions that roll back when the callback throws, and opt-in unique
 * indexes. Pass it where a `Database` is expected with `AsDatabase()`.
 */

import type { QueryParameters } from '@zoneless/shared-types';
import type { Database } from '../../modules/Database';

type Doc = Record<string, unknown>;
type Filter = Record<string, unknown>;

export class MemoryDatabase {
  private collections = new Map<string, Map<string, Doc>>();
  private uniqueIndexes = new Map<string, string[][]>();

  AsDatabase(): Database {
    return this as unknown as Database;
  }

  /**
   * Mirrors a unique compound index that is partial on its fields: only
   * documents holding every field take part. `Set` and `Update` then reject
   * a clashing write with Mongo's duplicate-key error (code 11000).
   */
  UniqueIndex(collection: string, fields: string[]): void {
    const indexes = this.uniqueIndexes.get(collection) ?? [];
    this.uniqueIndexes.set(collection, [...indexes, fields]);
  }

  Seed(collection: string, ...docs: Doc[]): void {
    for (const doc of docs)
      this.Collection(collection).set(String(doc.id), Clone(doc));
  }

  /** Current documents of a collection (copies). */
  All<T>(collection: string): T[] {
    return [...this.Collection(collection).values()].map(
      (doc) => Clone(doc) as T
    );
  }

  Doc<T>(collection: string, id: string): T {
    const doc = this.Collection(collection).get(id);
    if (!doc) throw new Error(`${collection}/${id} does not exist`);
    return Clone(doc) as T;
  }

  async Get<T>(collection: string, id: string): Promise<T | null> {
    const doc = this.Collection(collection).get(id);
    return doc ? (Clone(doc) as T) : null;
  }

  async Set<T>(collection: string, id: string, data: Partial<T>): Promise<T> {
    const doc = Clone(this.Collection(collection).get(id) ?? { id });
    ApplyUpdate(doc, data as Doc);
    return Clone(this.Store(collection, id, doc)) as T;
  }

  async Update<T>(
    collection: string,
    id: string,
    data: Partial<T>
  ): Promise<T | null> {
    const existing = this.Collection(collection).get(id);
    if (!existing) return null;
    const doc = Clone(existing);
    ApplyUpdate(doc, data as Doc);
    return Clone(this.Store(collection, id, doc)) as T;
  }

  async FindOneAndUpdateByFilter<T>(
    collection: string,
    filter: Filter,
    data: Doc
  ): Promise<T | null> {
    const doc = [...this.Collection(collection).values()].find((candidate) =>
      Matches(candidate, filter)
    );
    if (!doc) return null;
    ApplyUpdate(doc, data);
    return Clone(doc) as T;
  }

  async Find<T>(
    collection: string,
    field: string,
    value: unknown
  ): Promise<T[]> {
    return this.Filter<T>(collection, { [field]: value });
  }

  async Find2Custom<T>(
    collection: string,
    field1: string,
    operator1: string,
    value1: unknown,
    field2: string,
    operator2: string,
    value2: unknown
  ): Promise<T[]> {
    return this.Filter<T>(collection, {
      ...OperatorFilter(field1, operator1, value1),
      ...OperatorFilter(field2, operator2, value2),
    });
  }

  async Query<T>(options: QueryParameters): Promise<T[]> {
    const filter: Filter = {};
    for (const { key, operator, value } of options.parameters ?? []) {
      Object.assign(filter, OperatorFilter(key, operator, value));
    }
    const results = this.Filter<T>(options.collection, filter);
    const [order] = options.orderBy ?? [];
    if (order) {
      const sign = order.direction === 'desc' ? -1 : 1;
      results.sort(
        (a, b) =>
          sign *
          (Number((a as Doc)[order.key] ?? 0) -
            Number((b as Doc)[order.key] ?? 0))
      );
    }
    return options.limit ? results.slice(0, options.limit) : results;
  }

  async RunTransaction<T>(fn: (session: never) => Promise<T>): Promise<T> {
    const snapshot = new Map(
      [...this.collections].map(([name, docs]) => [
        name,
        new Map([...docs].map(([id, doc]) => [id, Clone(doc)])),
      ])
    );
    try {
      return await fn({} as never);
    } catch (error) {
      this.collections = snapshot;
      throw error;
    }
  }

  private Store(collection: string, id: string, doc: Doc): Doc {
    const docs = this.Collection(collection);
    for (const fields of this.uniqueIndexes.get(collection) ?? []) {
      const key = fields.map((field) => Read(doc, field));
      if (key.some((value) => value === undefined)) continue;
      const clash = [...docs].some(
        ([otherId, other]) =>
          otherId !== id &&
          fields.every((field, i) => Read(other, field) === key[i])
      );
      if (clash) {
        throw Object.assign(
          new Error(`E11000 duplicate key error collection: ${collection}`),
          { code: 11000 }
        );
      }
    }
    docs.set(id, doc);
    return doc;
  }

  private Filter<T>(collection: string, filter: Filter): T[] {
    return [...this.Collection(collection).values()]
      .filter((doc) => Matches(doc, filter))
      .map((doc) => Clone(doc) as T);
  }

  private Collection(name: string): Map<string, Doc> {
    let docs = this.collections.get(name);
    if (!docs) {
      docs = new Map();
      this.collections.set(name, docs);
    }
    return docs;
  }
}

function Clone<T>(value: T): T {
  return structuredClone(value);
}

function OperatorFilter(
  field: string,
  operator: string,
  value: unknown
): Filter {
  switch (operator) {
    case 'in':
      return { [field]: { $in: value } };
    case '!=':
      return { [field]: { $ne: value } };
    default:
      return { [field]: value };
  }
}

function Matches(doc: Doc, filter: Filter): boolean {
  return Object.entries(filter).every(([path, condition]) => {
    const value = Read(doc, path);
    const values = Array.isArray(value) ? value : [value];
    if (IsOperator(condition)) {
      if ('$in' in condition) {
        return values.some((v) =>
          (condition.$in as unknown[]).includes(v ?? null)
        );
      }
      if ('$ne' in condition) return !values.includes(condition.$ne);
      throw new Error(`Unsupported filter ${JSON.stringify(condition)}`);
    }
    // An array condition matches the whole array exactly, as in Mongo.
    if (Array.isArray(condition)) {
      return JSON.stringify(value ?? null) === JSON.stringify(condition);
    }
    return values.some((v) => (v ?? null) === (condition ?? null));
  });
}

function ApplyUpdate(doc: Doc, update: Doc): void {
  const operators = Object.keys(update).some((key) => key.startsWith('$'));
  const changes = operators ? update : { $set: update };
  for (const [operator, fields] of Object.entries(changes)) {
    for (const [path, value] of Object.entries(fields as Doc)) {
      if (operator === '$set') Write(doc, path, Clone(value));
      else if (operator === '$unset') Write(doc, path, undefined);
      else if (operator === '$addToSet') {
        const list = (Read(doc, path) as unknown[] | undefined) ?? [];
        if (!list.includes(value)) Write(doc, path, [...list, value]);
      } else throw new Error(`Unsupported update operator ${operator}`);
    }
  }
}

function IsOperator(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).some((key) => key.startsWith('$'))
  );
}

function Read(doc: Doc, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((value, key) => (value as Doc | undefined)?.[key], doc);
}

function Write(doc: Doc, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop() as string;
  let target = doc;
  for (const key of keys) {
    target[key] = (target[key] as Doc | undefined) ?? {};
    target = target[key] as Doc;
  }
  if (value === undefined) delete target[last];
  else target[last] = value;
}
