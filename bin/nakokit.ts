#!/usr/bin/env bun
import {
  cancel,
  confirm,
  intro,
  isCancel,
  multiselect,
  note,
  outro,
  spinner,
  text,
} from "@clack/prompts";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { deriveNames, scaffoldProject } from "../src/scaffold.ts";

type CliArgs = {
  help: boolean;
  yes: boolean;
  name?: string;
  desktop?: boolean;
  android?: boolean;
  sqlite?: boolean;
  install?: boolean;
  git?: boolean;
};

export function parseArgs(argv: readonly string[]): CliArgs {
  const parsed: CliArgs = { help: false, yes: false };
  for (const arg of argv) {
    if (arg === "-h" || arg === "--help") parsed.help = true;
    else if (arg === "-y" || arg === "--yes") parsed.yes = true;
    else if (arg === "--desktop") parsed.desktop = true;
    else if (arg === "--no-desktop") parsed.desktop = false;
    else if (arg === "--android") parsed.android = true;
    else if (arg === "--no-android") parsed.android = false;
    else if (arg === "--sqlite") parsed.sqlite = true;
    else if (arg === "--no-sqlite") parsed.sqlite = false;
    else if (arg === "--install") parsed.install = true;
    else if (arg === "--no-install") parsed.install = false;
    else if (arg === "--git") parsed.git = true;
    else if (arg === "--no-git") parsed.git = false;
    else if (!arg.startsWith("-") && !parsed.name) parsed.name = arg;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return parsed;
}

const HELP_TEXT = `nakokit — create a QuillDev full-stack app (Web, Electron, Android)

Usage:
  bunx github:QuillDev/nakokit [app-name] [options]

Options:
  -y, --yes         Skip prompts and use defaults
  --desktop         Include Electron desktop shell (default)
  --no-desktop      Skip Electron desktop shell
  --android         Include Kotlin WebView Android shell (default)
  --no-android      Skip Android shell
  --sqlite          Include bun:sqlite database setup (default)
  --no-sqlite       Skip SQLite setup
  --install         Run bun install after scaffolding (default)
  --no-install      Skip bun install
  --git             Initialize a git repository (default)
  --no-git          Skip git init
  -h, --help        Show this help
`;

function unwrapPrompt<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }
  return value as Exclude<T, symbol>;
}

async function runCommand(cmd: string[], cwd: string): Promise<{ ok: boolean; stderr: string }> {
  const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { ok: code === 0, stderr: stderr.trim() };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  if (cli.help) {
    console.log(HELP_TEXT);
    return;
  }

  const interactive = !cli.yes && Boolean(process.stdin.isTTY);

  if (interactive) {
    intro("nakokit");
  }

  let appName = cli.name;
  if (!appName) {
    if (!interactive) {
      throw new Error("Missing <app-name>. Pass an app name or run interactively in a TTY.");
    }
    appName = unwrapPrompt(
      await text({
        message: "Project name",
        placeholder: "my-app",
        validate(value) {
          try {
            const names = deriveNames(value ?? "");
            const target = resolve(process.cwd(), names.slug);
            if (existsSync(target) && readdirSync(target).length > 0) {
              return `Directory "${names.slug}" already exists and is not empty.`;
            }
            return undefined;
          } catch (error) {
            return error instanceof Error ? error.message : "Invalid project name.";
          }
        },
      }),
    );
  }

  const names = deriveNames(appName ?? "");
  const targetDir = resolve(process.cwd(), names.slug);

  let desktop = cli.desktop;
  let android = cli.android;
  let sqlite = cli.sqlite;

  if (interactive && (desktop === undefined || android === undefined || sqlite === undefined)) {
    const selected = unwrapPrompt(
      await multiselect({
        message: "Select extras (Web + Elysia/Eden + nakomponents always included)",
        required: false,
        initialValues: [
          ...(desktop !== false ? ["desktop"] : []),
          ...(android !== false ? ["android"] : []),
          ...(sqlite !== false ? ["sqlite"] : []),
        ],
        options: [
          { value: "desktop", label: "Electron desktop", hint: "sandboxed shell + typed IPC" },
          { value: "android", label: "Android", hint: "Kotlin WebView shell" },
          { value: "sqlite", label: "SQLite", hint: "bun:sqlite in WAL mode" },
        ],
      }),
    );
    desktop ??= selected.includes("desktop");
    android ??= selected.includes("android");
    sqlite ??= selected.includes("sqlite");
  }

  desktop ??= true;
  android ??= true;
  sqlite ??= true;

  let shouldInstall = cli.install;
  if (shouldInstall === undefined) {
    shouldInstall = interactive
      ? unwrapPrompt(await confirm({ message: "Install dependencies with bun?", initialValue: true }))
      : true;
  }

  let shouldGit = cli.git;
  if (shouldGit === undefined) {
    shouldGit = interactive
      ? unwrapPrompt(await confirm({ message: "Initialize git repository?", initialValue: true }))
      : true;
  }

  const spin = interactive ? spinner() : null;
  spin?.start(`Scaffolding ${names.slug}...`);

  scaffoldProject({
    targetDir,
    appName: names.slug,
    desktop,
    android,
    sqlite,
  });

  if (shouldGit) {
    spin?.message("Initializing git repository...");
    const gitRes = await runCommand(["git", "init", "-q"], targetDir);
    if (!gitRes.ok) {
      spin?.stop("Scaffolded (git init failed).");
      console.error(gitRes.stderr);
    }
  }

  if (shouldInstall) {
    spin?.message("Installing dependencies...");
    const installRes = await runCommand(["bun", "install"], targetDir);
    if (!installRes.ok) {
      spin?.stop("Scaffolded (bun install failed).");
      throw new Error(installRes.stderr || "bun install failed");
    }
  }

  spin?.stop(`Created ${names.slug}`);

  const steps = [
    `cd ${names.slug}`,
    ...(!shouldInstall ? ["bun install"] : []),
    "bun run dev",
    "bun run check",
    ...(desktop ? ["cd desktop && bun install && cd .. && bun run desktop:dev"] : []),
    ...(android ? ["bun run android:build"] : []),
  ];

  if (interactive) {
    note(steps.join("\n"), "Next steps");
    outro("Ready.");
  } else {
    console.log(`Created ${names.slug} in ${targetDir}`);
    for (const step of steps) {
      console.log(`  ${step}`);
    }
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  });
}
