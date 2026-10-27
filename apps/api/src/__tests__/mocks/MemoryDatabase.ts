// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * In-memory stand-in for `Database` with the Mongo semantics the payout and
 * billing flows rely on: equality, `$in`/`$ne`, range and top-level `$or`
 * filters (array fields match by containment), `$set`/`$setOnInsert`/`$inc`/
 * `$addToSet`/`$unset` updates with dotted paths, upserts by `id`, ordered
 * queries with `startAt` /
 * `startAfter` cursors, transactions that roll back when the callback
 * throws, and opt-in unique (optionally partial) indexes. Pass it where a
 * `Database` is expected with `AsDatabase()`.
 */

import type { QueryParameters } from '@fiatdesk/shared-types';
import type { Database } from '../../modules/Database';

type Doc = Record<string, unknown>;
type Filter = Record<string, unknown>;

interface UniqueIndexSpec {
  fields: string[];
  /** Mongo's `partialFilterExpression`: only matching documents take part */
  partial?: Filter;
}

export class MemoryDatabase {
  private collections = new Map<string, Map<string, Doc>>();
  private uniqueIndexes = new Map<string, UniqueIndexSpec[]>();

  AsDatabase(): Database {
    return this as unknown as Database;
  }

  /**
   * Mirrors a unique compound index. Only documents holding every field,
   * and matching `partial` when given, take part. Writes that clash fail
   * with Mongo's duplicate-key error (code 11000).
   */
  UniqueIndex(collection: string, fields: string[], partial?: Filter): void {
    const indexes = this.uniqueIndexes.get(collection) ?? [];
    this.uniqueIndexes.set(collection, [...indexes, { fields, partial }]);
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

  /** An upsert by `id`; `$setOnInsert` applies only when it inserts. */
  async Set<T>(collection: string, id: string, data: Partial<T>): Promise<T> {
    const existing = this.Collection(collection).get(id);
    const doc = Clone(existing ?? { id });
    ApplyUpdate(doc, data as Doc, !existing);
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
    const updated = Clone(doc);
    ApplyUpdate(updated, data);
    return Clone(this.Store(collection, String(doc.id), updated)) as T;
  }

  async Find<T>(
    collection: string,
    field: string,
    value: unknown
  ): Promise<T[]> {
    return this.Filter<T>(collection, { [field]: value });
  }

  async FindCustom<T>(
    collection: string,
    field: string,
    operator: string,
    value: unknown
  ): Promise<T[]> {
    return this.Filter<T>(collection, OperatorFilter(field, operator, value));
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
      Merge(filter, OperatorFilter(key, operator, value));
    }
    const [order] = options.orderBy ?? [];
    const orderKey = order?.key ?? 'created';
    const descending = (order?.direction ?? 'desc') === 'desc';
    // Cursors bound the first order key, as Database.Query does.
    if (options.startAfter !== undefined) {
      Merge(filter, {
        [orderKey]: { [descending ? '$lt' : '$gt']: options.startAfter },
      });
    }
    if (options.startAt !== undefined) {
      Merge(filter, {
        [orderKey]: { [descending ? '$lte' : '$gte']: options.startAt },
      });
    }
    const results = this.Filter<T>(options.collection, filter);
    if (order) {
      const sign = descending ? -1 : 1;
      results.sort(
        (a, b) =>
          sign *
          (Number((a as Doc)[order.key] ?? 0) -
            Number((b as Doc)[order.key] ?? 0))
      );
    }
    return options.limit ? results.slice(0, options.limit) : results;
  }

  async Delete(
    collection: string,
    id: string
  ): Promise<{ deletedCount: number }> {
    return { deletedCount: this.Collection(collection).delete(id) ? 1 : 0 };
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
    for (const { fields, partial } of this.uniqueIndexes.get(collection) ??
      []) {
      const Indexed = (candidate: Doc) =>
        fields.every((field) => Read(candidate, field) !== undefined) &&
        (!partial || Matches(candidate, partial));
      if (!Indexed(doc)) continue;
      const clash = [...docs].some(
        ([otherId, other]) =>
          otherId !== id &&
          Indexed(other) &&
          fields.every((field) => Read(other, field) === Read(doc, field))
      );
      if (clash) throw DuplicateKey(collection);
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

function DuplicateKey(collection: string): Error {
  return Object.assign(
    new Error(`E11000 duplicate key error collection: ${collection}`),
    { code: 11000 }
  );
}

const RANGE_OPERATORS: Record<string, string> = {
  '<': '$lt',
  '<=': '$lte',
  '>': '$gt',
  '>=': '$gte',
};

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
    case 'exists':
      return { [field]: { $exists: value === true } };
    default:
      return RANGE_OPERATORS[operator]
        ? { [field]: { [RANGE_OPERATORS[operator]]: value } }
        : { [field]: value };
  }
}

/** Adds `extra` to `filter`, combining operator conditions on one field. */
function Merge(filter: Filter, extra: Filter): void {
  for (const [path, condition] of Object.entries(extra)) {
    const existing = filter[path];
    filter[path] =
      IsOperator(existing) && IsOperator(condition)
        ? { ...existing, ...condition }
        : condition;
  }
}

/** A range bound; null and missing values never satisfy one, as in Mongo. */
function InRange(value: unknown, operator: string, bound: unknown): boolean {
  if (value === null || value === undefined) return false;
  const a = value as number;
  const b = bound as number;
  switch (operator) {
    case '$lt':
      return a < b;
    case '$lte':
      return a <= b;
    case '$gt':
      return a > b;
    default:
      return a >= b;
  }
}

function Matches(doc: Doc, filter: Filter): boolean {
  return Object.entries(filter).every(([path, condition]) => {
    if (path === '$or') {
      return (condition as Filter[]).some((branch) => Matches(doc, branch));
    }
    const value = Read(doc, path);
    const values = Array.isArray(value) ? value : [value];
    if (IsOperator(condition)) {
      return Object.entries(condition).every(([operator, operand]) => {
        switch (operator) {
          case '$in':
            return values.some((v) =>
              (operand as unknown[]).includes(v ?? null)
            );
          case '$ne':
            return !values.includes(operand);
          case '$exists':
            return (value !== undefined) === operand;
          case '$type':
            return typeof value === operand;
          case '$lt':
          case '$lte':
          case '$gt':
          case '$gte':
            return values.some((v) => InRange(v, operator, operand));
          default:
            throw new Error(`Unsupported filter ${JSON.stringify(condition)}`);
        }
      });
    }
    // An array condition matches the whole array exactly, as in Mongo.
    if (Array.isArray(condition)) {
      return JSON.stringify(value ?? null) === JSON.stringify(condition);
    }
    return values.some((v) => (v ?? null) === (condition ?? null));
  });
}

function ApplyUpdate(doc: Doc, update: Doc, inserting = false): void {
  const operators = Object.keys(update).some((key) => key.startsWith('$'));
  const changes = operators ? update : { $set: update };
  for (const [operator, fields] of Object.entries(changes)) {
    for (const [path, value] of Object.entries(fields as Doc)) {
      if (operator === '$set') Write(doc, path, Clone(value));
      else if (operator === '$setOnInsert') {
        if (inserting) Write(doc, path, Clone(value));
      } else if (operator === '$unset') Write(doc, path, undefined);
      else if (operator === '$inc') {
        Write(doc, path, Number(Read(doc, path) ?? 0) + Number(value));
      } else if (operator === '$addToSet') {
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
