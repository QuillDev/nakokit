import type { Database } from "bun:sqlite";
import { existsSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { Elysia, t } from "elysia";

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

export function createApp(options: { db: Database; staticDir?: string; version?: string }) {
  const version = options.version ?? "0.1.0";
  const staticDir = options.staticDir;

  const app = new Elysia({ name: "nakokit" })
    .decorate("db", options.db)
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
