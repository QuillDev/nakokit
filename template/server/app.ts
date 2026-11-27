import { existsSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { Elysia } from "elysia";
import { sql, type Kysely } from "kysely";
import { queryOne, type Database } from "./database.ts";
import { HealthResponseSchema, PingRowSchema } from "./schemas.ts";

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

export function createApp(options: { db: Kysely<Database>; staticDir?: string; version?: string }) {
  const version = options.version ?? "0.1.0";
  const staticDir = options.staticDir;

  const app = new Elysia({ name: "nakokit" })
    .decorate("db", options.db)
    .get(
      "/api/health",
      async ({ db }) => {
        await queryOne(db, sql`select 1 as ok`, PingRowSchema);
        return {
          ok: true as const,
          name: "nakokit",
          version,
          database: "sqlite" as const,
        };
      },
      {
        response: HealthResponseSchema,
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
