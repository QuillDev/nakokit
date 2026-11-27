#!/usr/bin/env bun
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

const TEMPLATE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

export function deriveNames(rawName: string): DerivedNames {
  const cleaned = rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!cleaned || !/^[a-z]/.test(cleaned)) {
    throw new Error(`Invalid app name "${rawName}". Start with a letter and use letters/numbers/hyphens.`);
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

export function scaffoldProject(options: {
  targetDir: string;
  appName: string;
  inPlace?: boolean;
  templateRoot?: string;
}): DerivedNames {
  const names = deriveNames(options.appName);
  const templateRoot = resolve(options.templateRoot ?? TEMPLATE_ROOT);
  const targetDir = resolve(options.targetDir);

  if (!options.inPlace) {
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
  }

  // Rename Android Kotlin package directories from nakokit -> <androidSegment>.
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

  // Remove template-only scaffolder files from the newly generated project.
  rmSync(join(targetDir, "bin"), { recursive: true, force: true });
  rmSync(join(targetDir, "tests", "scaffold.test.ts"), { force: true });

  // Strip template-only bin/init entries from package.json and mark private.
  const pkgPath = join(targetDir, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      name: string;
      description: string;
      private?: boolean;
      bin?: unknown;
      scripts?: Record<string, string>;
    };
    pkg.name = names.slug;
    pkg.description = `${names.displayName} — multi-platform web, Electron, and Android app.`;
    pkg.private = true;
    delete pkg.bin;
    if (pkg.scripts) {
      delete pkg.scripts.init;
    }
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }

  // Remove bin from tsconfig include if present.
  const tsconfigPath = join(targetDir, "tsconfig.json");
  if (existsSync(tsconfigPath)) {
    const ts = JSON.parse(readFileSync(tsconfigPath, "utf8")) as { include?: string[] };
    if (Array.isArray(ts.include)) {
      ts.include = ts.include.filter((item) => item !== "bin");
      writeFileSync(tsconfigPath, `${JSON.stringify(ts, null, 2)}\n`, "utf8");
    }
  }

  for (const file of walkFiles(targetDir)) {
    replaceTokensInFile(file, names);
  }

  return names;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const inPlace = args.includes("--in-place");
  const nameArg = args.find((a) => !a.startsWith("--"));

  if (!nameArg) {
    console.error("Usage: nakokit <app-name> [--in-place]");
    process.exit(1);
  }

  const targetDir = inPlace ? process.cwd() : resolve(process.cwd(), nameArg);
  const names = scaffoldProject({ targetDir, appName: nameArg, inPlace });
  console.log(`Initialized ${names.displayName} (${names.slug}) in ${targetDir}`);
  console.log("Next steps:");
  if (!inPlace) console.log(`  cd ${names.slug}`);
  console.log("  bun install");
  console.log("  bun run check");
  console.log("  bun run dev");
}
