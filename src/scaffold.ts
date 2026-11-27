import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TEMPLATE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "template");

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".gradle",
  ".kotlin",
  "build",
]);

const BINARY_EXTS = new Set([
  ".jar",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".ico",
  ".icns",
  ".sqlite",
  ".lockb",
]);

export type DerivedNames = {
  slug: string;
  displayName: string;
  androidSegment: string;
  envPrefix: string;
};

export type ScaffoldOptions = {
  targetDir: string;
  appName: string;
  desktop?: boolean;
  android?: boolean;
  sqlite?: boolean;
  templateRoot?: string;
};

export function deriveNames(rawName: string): DerivedNames {
  const cleaned = rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!cleaned || !/^[a-z]/.test(cleaned)) {
    throw new Error(
      `Invalid app name "${rawName}". Start with a letter and use letters, numbers, or hyphens.`,
    );
  }
  const displayName = cleaned
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const androidSegment = cleaned.replace(/-/g, "");
  const envPrefix = cleaned.replace(/-/g, "_").toUpperCase();
  return { slug: cleaned, displayName, androidSegment, envPrefix };
}

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkFiles(full, out);
    } else if (st.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function isBinary(file: string): boolean {
  const lower = file.toLowerCase();
  for (const ext of BINARY_EXTS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function replaceTokensInFile(file: string, names: DerivedNames): void {
  if (isBinary(file)) return;
  const original = readFileSync(file, "utf8");
  const updated = original
    .replaceAll("moe.nakode.nakokit", `moe.nakode.${names.androidSegment}`)
    .replaceAll("NAKOKIT_", `${names.envPrefix}_`)
    .replaceAll("Theme.Nakokit", `Theme.${names.displayName.replaceAll(" ", "")}`)
    .replaceAll("Nakokit", names.displayName)
    .replaceAll("nakokit", names.slug);
  if (updated !== original) {
    writeFileSync(file, updated, "utf8");
  }
}

const NO_DESKTOP_PLATFORM_TS = `export type PlatformKind = "android" | "web";

export function detectPlatform(): PlatformKind {
  if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)) {
    return "android";
  }
  return "web";
}

export function getApiOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin.startsWith("http")) {
    return window.location.origin;
  }
  return "http://127.0.0.1:8080";
}
`;

const NO_SQLITE_APP_TS = `import { existsSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { Elysia, t } from "elysia";

function resolveStaticFile(staticDir: string, pathname: string): string | null {
  const root = resolve(staticDir);
  const rel = pathname.replace(/^\\/+/, "");
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

export function createApp(options?: { staticDir?: string; version?: string }) {
  const version = options?.version ?? "0.1.0";
  const staticDir = options?.staticDir;

  const app = new Elysia({ name: "nakokit" }).get(
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
`;

const NO_SQLITE_MAIN_TS = `import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? "8080");
const hostname = process.env.HOST ?? "127.0.0.1";
const distDir = resolve(process.cwd(), "dist");

const app = createApp({
  staticDir: existsSync(distDir) ? distDir : undefined,
});

app.listen({ hostname, port }, (server) => {
  console.log(\`nakokit listening on http://\${server.hostname}:\${server.port}\`);
});
`;

const NO_SQLITE_API_TEST_TS = `import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { createApp, type App } from "../server/app.ts";

describe("Elysia + Eden typed API", () => {
  const app = createApp({ version: "0.1.0-test" });
  let baseUrl = "";

  beforeAll(() => {
    const server = app.listen({ hostname: "127.0.0.1", port: 0 });
    const port = server.server?.port;
    if (!port) throw new Error("Server did not bind a port");
    baseUrl = \`http://127.0.0.1:\${port}\`;
  });

  afterAll(async () => {
    await app.stop();
  });

  test("health returns typed payload via Eden", async () => {
    const client = treaty<App>(baseUrl, { parseDate: false });
    const res = await client.api.health.get();
    expect(res.error).toBeNull();
    expect(res.data).toEqual({
      ok: true,
      name: "nakokit",
      version: "0.1.0-test",
    });
  });
});
`;

export function scaffoldProject(options: ScaffoldOptions): DerivedNames {
  const names = deriveNames(options.appName);
  const desktop = options.desktop ?? true;
  const android = options.android ?? true;
  const sqlite = options.sqlite ?? true;
  const templateRoot = resolve(options.templateRoot ?? DEFAULT_TEMPLATE_ROOT);
  const targetDir = resolve(options.targetDir);

  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    throw new Error(`Target directory "${targetDir}" already exists and is not empty.`);
  }

  mkdirSync(targetDir, { recursive: true });
  cpSync(templateRoot, targetDir, {
    recursive: true,
    filter: (src) => {
      const name = basename(src);
      return !SKIP_DIRS.has(name);
    },
  });

  // Restore dotfiles packaged with underscore prefixes.
  for (const [srcName, dstName] of [
    ["_gitignore", ".gitignore"],
    ["_oxlintrc.json", ".oxlintrc.json"],
  ] as const) {
    const srcPath = join(targetDir, srcName);
    const dstPath = join(targetDir, dstName);
    if (existsSync(srcPath) && !existsSync(dstPath)) {
      renameSync(srcPath, dstPath);
    }
  }

  // Strip optional desktop target.
  if (!desktop) {
    rmSync(join(targetDir, "desktop"), { recursive: true, force: true });
    rmSync(join(targetDir, "shared"), { recursive: true, force: true });
    rmSync(join(targetDir, "tests", "ipc.test.ts"), { force: true });
    writeFileSync(join(targetDir, "src", "lib", "platform.ts"), NO_DESKTOP_PLATFORM_TS, "utf8");
  }

  // Strip or rename optional Android target.
  if (!android) {
    rmSync(join(targetDir, "android"), { recursive: true, force: true });
  } else {
    for (const srcSet of ["main", "test"]) {
      const oldPkgDir = join(
        targetDir,
        "android",
        "app",
        "src",
        srcSet,
        "kotlin",
        "moe",
        "nakode",
        "nakokit",
      );
      const newPkgDir = join(
        targetDir,
        "android",
        "app",
        "src",
        srcSet,
        "kotlin",
        "moe",
        "nakode",
        names.androidSegment,
      );
      if (existsSync(oldPkgDir) && oldPkgDir !== newPkgDir) {
        renameSync(oldPkgDir, newPkgDir);
      }
    }
  }

  // Strip optional SQLite setup.
  if (!sqlite) {
    rmSync(join(targetDir, "server", "database.ts"), { force: true });
    writeFileSync(join(targetDir, "server", "app.ts"), NO_SQLITE_APP_TS, "utf8");
    writeFileSync(join(targetDir, "server", "main.ts"), NO_SQLITE_MAIN_TS, "utf8");
    writeFileSync(join(targetDir, "tests", "api.test.ts"), NO_SQLITE_API_TEST_TS, "utf8");
  }

  // Update package.json metadata and scripts to match selected targets.
  const pkgPath = join(targetDir, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      name: string;
      description: string;
      scripts?: Record<string, string>;
    };
    const targets = ["web", ...(desktop ? ["Electron"] : []), ...(android ? ["Android"] : [])];
    pkg.name = names.slug;
    pkg.description = `${names.displayName} (${targets.join(", ")}).`;
    if (pkg.scripts) {
      if (!desktop) {
        delete pkg.scripts["desktop:dev"];
        delete pkg.scripts["desktop:build"];
      }
      if (!android) {
        delete pkg.scripts["android:test"];
        delete pkg.scripts["android:build"];
      }
    }
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }

  // Keep tsconfig.json include clean when shared/ is omitted.
  if (!desktop) {
    const tsconfigPath = join(targetDir, "tsconfig.json");
    if (existsSync(tsconfigPath)) {
      const ts = JSON.parse(readFileSync(tsconfigPath, "utf8")) as { include?: string[] };
      if (Array.isArray(ts.include)) {
        ts.include = ts.include.filter((item) => item !== "shared");
        writeFileSync(tsconfigPath, `${JSON.stringify(ts, null, 2)}\n`, "utf8");
      }
    }
  }

  for (const file of walkFiles(targetDir)) {
    replaceTokensInFile(file, names);
  }

  return names;
}
