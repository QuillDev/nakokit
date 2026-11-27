import { Database as BunSqlite, type SQLQueryBindings } from "bun:sqlite";
import { resolve } from "node:path";
import {
  CompiledQuery,
  type DatabaseConnection,
  type Driver,
  Kysely,
  type QueryResult,
  type RawBuilder,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from "kysely";
import type { z } from "zod";

/**
 * Add table row types here as your schema grows.
 * Tip: define each row with Zod in server/schemas.ts and use `z.infer<typeof RowSchema>`.
 */
export type Database = Record<never, never>;

class BunSqliteConnection implements DatabaseConnection {
  readonly #db: BunSqlite;

  constructor(db: BunSqlite) {
    this.#db = db;
  }

  executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const stmt = this.#db.query(compiledQuery.sql);
    const params = compiledQuery.parameters as SQLQueryBindings[];
    if (stmt.columnNames.length > 0) {
      const rows = stmt.all(...params) as R[];
      return Promise.resolve({ rows });
    }
    const result = stmt.run(...params);
    return Promise.resolve({
      numAffectedRows: BigInt(result.changes),
      insertId: BigInt(result.lastInsertRowid),
      rows: [],
    });
  }

  async *streamQuery<R>(compiledQuery: CompiledQuery): AsyncIterableIterator<QueryResult<R>> {
    const stmt = this.#db.query(compiledQuery.sql);
    const params = compiledQuery.parameters as SQLQueryBindings[];
    for (const row of stmt.iterate(...params)) {
      yield { rows: [row as R] };
    }
  }
}

class BunSqliteDriver implements Driver {
  readonly #db: BunSqlite;
  readonly #connection: BunSqliteConnection;
  #lock: Promise<void> = Promise.resolve();
  #releaseLock: (() => void) | null = null;

  constructor(path: string) {
    this.#db = new BunSqlite(path, { create: true });
    this.#db.run("PRAGMA journal_mode = WAL");
    this.#db.run("PRAGMA foreign_keys = ON");
    this.#connection = new BunSqliteConnection(this.#db);
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    const previous = this.#lock;
    let release!: () => void;
    this.#lock = new Promise<void>((res) => {
      release = res;
    });
    await previous;
    this.#releaseLock = release;
    return this.#connection;
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("begin"));
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("commit"));
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw("rollback"));
  }

  releaseConnection(): Promise<void> {
    const release = this.#releaseLock;
    this.#releaseLock = null;
    release?.();
    return Promise.resolve();
  }

  destroy(): Promise<void> {
    this.#db.close();
    return Promise.resolve();
  }
}

export function openDatabase(
  path = process.env.DB_PATH ?? resolve(process.cwd(), "nakokit.sqlite"),
): Kysely<Database> {
  return new Kysely<Database>({
    dialect: {
      createAdapter: () => new SqliteAdapter(),
      createDriver: () => new BunSqliteDriver(path),
      createIntrospector: (db) => new SqliteIntrospector(db),
      createQueryCompiler: () => new SqliteQueryCompiler(),
    },
  });
}

/** Run a raw Kysely SQL query and parse every row with a Zod schema. */
export async function queryRows<T extends z.ZodType>(
  db: Kysely<Database>,
  query: RawBuilder<unknown>,
  schema: T,
): Promise<z.infer<T>[]> {
  const { rows } = await query.execute(db);
  return rows.map((row) => schema.parse(row));
}

/** Run a raw Kysely SQL query and parse the first row with a Zod schema (or null). */
export async function queryOne<T extends z.ZodType>(
  db: Kysely<Database>,
  query: RawBuilder<unknown>,
  schema: T,
): Promise<z.infer<T> | null> {
  const { rows } = await query.execute(db);
  const first = rows[0];
  return first === undefined ? null : schema.parse(first);
}
