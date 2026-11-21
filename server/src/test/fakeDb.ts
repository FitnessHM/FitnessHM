import type { PgTable } from 'drizzle-orm/pg-core';

// A hand-rolled stand-in for the tiny slice of drizzle's fluent query
// builder that server/src/routes/state.ts actually calls -- not a general
// drizzle mock. Used instead of a real Postgres connection so route tests
// never touch a real database (see state.test.ts): this is what makes "run
// a test against the real Neon DB" structurally impossible rather than a
// discipline problem.
//
// Pairs with mocking `eq`/`sql` from 'drizzle-orm' (see state.test.ts) --
// those become plain marker objects (`{ __fakeEq }` / `{ __fakeNow }`) that
// this class knows how to interpret. Column *identity* (not name) is how
// predicates/projections/onConflict targets are resolved back to a plain
// object key, via a reverse map built once per table from the real schema
// module's table objects -- so this only ever needs to know the five
// operations below, not drizzle's actual SQL generation.

type Row = Record<string, unknown>;

export interface FakeEq {
  __fakeEq: true;
  col: unknown;
  val: unknown;
}

export interface FakeNow {
  __fakeNow: true;
}

export function isFakeEq(x: unknown): x is FakeEq {
  return !!x && typeof x === 'object' && (x as FakeEq).__fakeEq === true;
}

function isFakeNow(x: unknown): x is FakeNow {
  return !!x && typeof x === 'object' && (x as FakeNow).__fakeNow === true;
}

function columnPropertyKeys(table: PgTable): Map<unknown, string> {
  const map = new Map<unknown, string>();
  for (const [key, value] of Object.entries(table)) {
    if (value && typeof value === 'object' && 'name' in (value as object)) {
      map.set(value, key);
    }
  }
  return map;
}

function applyNow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[k] = isFakeNow(v) ? new Date() : v;
  if (out.updatedAt === undefined) out.updatedAt = new Date(); // mirrors the real `updated_at` column default
  return out;
}

interface Cascade {
  parent: PgTable;
  parentPk: string;
  child: PgTable;
  childFk: string;
}

export class FakeDb {
  private stores = new Map<PgTable, Row[]>();
  private keysByTable = new Map<PgTable, Map<unknown, string>>();
  private cascades: Cascade[] = [];

  rowsOf(table: PgTable): Row[] {
    if (!this.stores.has(table)) this.stores.set(table, []);
    return this.stores.get(table)!;
  }

  private keysOf(table: PgTable): Map<unknown, string> {
    if (!this.keysByTable.has(table)) this.keysByTable.set(table, columnPropertyKeys(table));
    return this.keysByTable.get(table)!;
  }

  /** On deleting a row from `parent`, also delete every `child` row whose `childFk` matches the deleted row's `parentPk`. */
  addCascade(parent: PgTable, parentPk: string, child: PgTable, childFk: string): void {
    this.cascades.push({ parent, parentPk, child, childFk });
  }

  private matches(table: PgTable, row: Row, predicate: unknown): boolean {
    if (!isFakeEq(predicate)) throw new Error('fakeDb: only eq() predicates are supported');
    const key = this.keysOf(table).get(predicate.col);
    if (!key) throw new Error('fakeDb: predicate references a column not found on this table');
    return row[key] === predicate.val;
  }

  private project(table: PgTable, row: Row, projection: Record<string, unknown>): Row {
    const keys = this.keysOf(table);
    const out: Row = {};
    for (const [outKey, col] of Object.entries(projection)) {
      const propKey = keys.get(col) ?? outKey;
      out[outKey] = row[propKey];
    }
    return out;
  }

  select(projection?: Record<string, unknown>) {
    return {
      from: (table: PgTable) => ({
        where: async (predicate: unknown): Promise<Row[]> => {
          const rows = this.rowsOf(table).filter((r) => this.matches(table, r, predicate));
          return projection ? rows.map((r) => this.project(table, r, projection)) : rows.map((r) => ({ ...r }));
        },
      }),
    };
  }

  insert(table: PgTable) {
    const doInsert = (values: Row | Row[]): Row[] => {
      const rows = (Array.isArray(values) ? values : [values]).map(applyNow);
      this.rowsOf(table).push(...rows);
      return rows;
    };
    return {
      values: (values: Row | Row[]) => {
        let inserted: Row[] | null = null;
        const ensureInserted = () => (inserted ??= doInsert(values));
        return {
          // Scoped to this file's actual usage: always a single-row upsert
          // (the athletes table), never bulk -- see fakeDb's module comment.
          onConflictDoUpdate: ({ target, set }: { target: unknown; set: Row }): Promise<void> => {
            const row = values as Row;
            const key = this.keysOf(table).get(target);
            if (!key) throw new Error('fakeDb: onConflictDoUpdate target column not found');
            const existing = this.rowsOf(table).find((r) => r[key] === row[key]);
            if (existing) {
              Object.assign(existing, applyNow(set));
            } else {
              ensureInserted();
            }
            return Promise.resolve();
          },
          then: (resolve: (v: Row[]) => void, reject?: (e: unknown) => void) =>
            Promise.resolve(ensureInserted()).then(resolve, reject),
        };
      },
    };
  }

  update(table: PgTable) {
    return {
      set: (values: Row) => {
        const applied = applyNow(values);
        return {
          where: (predicate: unknown) => {
            const rows = this.rowsOf(table).filter((r) => this.matches(table, r, predicate));
            for (const r of rows) Object.assign(r, applied);
            return {
              returning: (projection: Record<string, unknown>): Promise<Row[]> =>
                Promise.resolve(rows.map((r) => this.project(table, r, projection))),
              then: (resolve: (v: void) => void) => Promise.resolve().then(() => resolve(undefined)),
            };
          },
        };
      },
    };
  }

  delete(table: PgTable) {
    return {
      where: (predicate: unknown): Promise<void> => {
        const rows = this.rowsOf(table);
        const toDelete = rows.filter((r) => this.matches(table, r, predicate));
        this.stores.set(table, rows.filter((r) => !toDelete.includes(r)));
        for (const cascade of this.cascades) {
          if (cascade.parent !== table) continue;
          const deletedPks = new Set(toDelete.map((r) => r[cascade.parentPk]));
          const childRows = this.rowsOf(cascade.child);
          this.stores.set(cascade.child, childRows.filter((r) => !deletedPks.has(r[cascade.childFk])));
        }
        return Promise.resolve();
      },
    };
  }

  // No real atomicity -- fine for these tests, which never assert
  // rollback-on-error behavior.
  transaction<T>(cb: (tx: FakeDb) => Promise<T>): Promise<T> {
    return cb(this);
  }
}

export function createFakeDb(): FakeDb {
  return new FakeDb();
}
