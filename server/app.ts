import type { Database } from "bun:sqlite";
import { existsSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { Elysia, status, t } from "elysia";
import { createItem, deleteItem, listItems, updateItem } from "./database.ts";

const ItemStatusSchema = t.Union([t.Literal("todo"), t.Literal("doing"), t.Literal("done")]);

const ItemSchema = t.Object({
  id: t.String(),
  title: t.String(),
  status: ItemStatusSchema,
  tags: t.Array(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

function resolveStaticFile(staticDir: string, pathname: string): string | null {
  const root = resolve(staticDir);
  const rel = pathname.replace(/^\/+/, "");
  const candidate = resolve(root, rel || "index.html");
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return null;
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }
  if (!pathname.startsWith("/api/") && !pathname.includes(".")) {
    const indexHtml = resolve(root, "index.html");
    if (existsSync(indexHtml)) return indexHtml;
  }
  return null;
}

export function createApp(db: Database, options?: { staticDir?: string; version?: string }) {
  const version = options?.version ?? "0.1.0";
  const staticDir = options?.staticDir;

  const app = new Elysia({ name: "nakokit" })
    .get(
      "/api/health",
      () => ({
        ok: true as const,
        name: "nakokit",
        version,
      }),
      {
        response: t.Object({
          ok: t.Literal(true),
          name: t.String(),
          version: t.String(),
        }),
      },
    )
    .get(
      "/api/items",
      ({ query }) => ({
        items: listItems(db, { status: query.status, q: query.q }),
      }),
      {
        query: t.Object({
          status: t.Optional(ItemStatusSchema),
          q: t.Optional(t.String()),
        }),
        response: t.Object({
          items: t.Array(ItemSchema),
        }),
      },
    )
    .post(
      "/api/items",
      ({ body }) => {
        const title = body.title.trim();
        if (!title) {
          return status(400, { error: "Title cannot be empty" });
        }
        const item = createItem(db, {
          title,
          status: body.status ?? "todo",
          tags: body.tags ?? [],
        });
        return status(201, { item });
      },
      {
        body: t.Object({
          title: t.String({ minLength: 1, maxLength: 200 }),
          status: t.Optional(ItemStatusSchema),
          tags: t.Optional(t.Array(t.String({ minLength: 1, maxLength: 40 }), { maxItems: 12 })),
        }),
        response: {
          201: t.Object({ item: ItemSchema }),
          400: t.Object({ error: t.String() }),
        },
      },
    )
    .patch(
      "/api/items/:id",
      ({ params, body }) => {
        if (body.title !== undefined && body.title.trim().length === 0) {
          return status(400, { error: "Title cannot be empty" });
        }
        const item = updateItem(db, params.id, body);
        if (!item) {
          return status(404, { error: "Item not found" });
        }
        return { item };
      },
      {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
        body: t.Object({
          title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
          status: t.Optional(ItemStatusSchema),
          tags: t.Optional(t.Array(t.String({ minLength: 1, maxLength: 40 }), { maxItems: 12 })),
        }),
        response: {
          200: t.Object({ item: ItemSchema }),
          400: t.Object({ error: t.String() }),
          404: t.Object({ error: t.String() }),
        },
      },
    )
    .delete(
      "/api/items/:id",
      ({ params }) => {
        const deleted = deleteItem(db, params.id);
        if (!deleted) {
          return status(404, { error: "Item not found" });
        }
        return { deleted: true as const, id: params.id };
      },
      {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
        response: {
          200: t.Object({ deleted: t.Literal(true), id: t.String() }),
          404: t.Object({ error: t.String() }),
        },
      },
    );

  if (staticDir) {
    app.get("/*", ({ request }) => {
      const pathname = new URL(request.url).pathname;
      const file = resolveStaticFile(staticDir, pathname);
      if (!file) {
        return new Response("Not found", { status: 404 });
      }
      return Bun.file(file);
    });
  }

  return app;
}

export type App = ReturnType<typeof createApp>;
