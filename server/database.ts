import { Database } from "bun:sqlite";

export type ItemStatus = "todo" | "doing" | "done";

export type ItemRecord = {
  id: string;
  title: string;
  status: ItemStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type ItemRow = {
  id: string;
  title: string;
  status: ItemStatus;
  tags_json: string;
  created_at: string;
  updated_at: string;
};

export function openDatabase(path: string): Database {
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA busy_timeout = 5000");
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      tags_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_items_status_updated ON items (status, updated_at DESC)");
  return db;
}

function rowToItem(row: ItemRow): ItemRecord {
  let tags: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.tags_json);
    if (Array.isArray(parsed)) {
      tags = parsed.filter((v): v is string => typeof v === "string");
    }
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listItems(
  db: Database,
  filter?: { status?: ItemStatus; q?: string },
): ItemRecord[] {
  const clauses: string[] = [];
  const params: string[] = [];
  if (filter?.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  if (filter?.q && filter.q.trim().length > 0) {
    clauses.push("LOWER(title) LIKE ?");
    params.push(`%${filter.q.trim().toLowerCase()}%`);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .query<ItemRow, string[]>(`SELECT * FROM items ${where} ORDER BY updated_at DESC, id DESC`)
    .all(...params);
  return rows.map(rowToItem);
}

export function getItem(db: Database, id: string): ItemRecord | null {
  const row = db.query<ItemRow, [string]>("SELECT * FROM items WHERE id = ?").get(id);
  return row ? rowToItem(row) : null;
}

export function createItem(
  db: Database,
  input: { title: string; status: ItemStatus; tags: string[] },
): ItemRecord {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const tags = [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))];
  db.run(
    "INSERT INTO items (id, title, status, tags_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, input.title.trim(), input.status, JSON.stringify(tags), now, now],
  );
  return { id, title: input.title.trim(), status: input.status, tags, createdAt: now, updatedAt: now };
}

export function updateItem(
  db: Database,
  id: string,
  patch: { title?: string; status?: ItemStatus; tags?: string[] },
): ItemRecord | null {
  const existing = getItem(db, id);
  if (!existing) return null;
  const title = patch.title !== undefined ? patch.title.trim() : existing.title;
  const status = patch.status ?? existing.status;
  const tags =
    patch.tags !== undefined
      ? [...new Set(patch.tags.map((t) => t.trim()).filter(Boolean))]
      : existing.tags;
  const updatedAt = new Date().toISOString();
  db.run(
    "UPDATE items SET title = ?, status = ?, tags_json = ?, updated_at = ? WHERE id = ?",
    [title, status, JSON.stringify(tags), updatedAt, id],
  );
  return { ...existing, title, status, tags, updatedAt };
}

export function deleteItem(db: Database, id: string): boolean {
  const result = db.run("DELETE FROM items WHERE id = ?", [id]);
  return result.changes > 0;
}
