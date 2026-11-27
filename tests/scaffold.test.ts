import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "../bin/nakokit.ts";
import { deriveNames, scaffoldProject } from "../src/scaffold.ts";

const REPO_ROOT = resolve(import.meta.dir, "..");
const CLI_PATH = join(REPO_ROOT, "bin", "nakokit.ts");
const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("deriveNames", () => {
  test("normalizes slug, display name, android package, and env prefix", () => {
    expect(deriveNames("Star Tracker")).toEqual({
      slug: "star-tracker",
      displayName: "Star Tracker",
      androidSegment: "startracker",
      envPrefix: "STAR_TRACKER",
    });
  });

  test("rejects names not starting with a letter", () => {
    expect(() => deriveNames("123-app")).toThrow();
    expect(() => deriveNames("   ")).toThrow();
  });
});

describe("parseArgs", () => {
  test("parses positional name and toggle flags", () => {
    expect(parseArgs(["my-app", "-y", "--no-android", "--no-sqlite", "--no-install"])).toEqual({
      help: false,
      yes: true,
      name: "my-app",
      android: false,
      sqlite: false,
      install: false,
    });
  });

  test("throws on unknown flags", () => {
    expect(() => parseArgs(["--bogus"])).toThrow();
  });
});

describe("scaffoldProject", () => {
  test("scaffolds full-stack project with web, Electron, Android, and SQLite", () => {
    const parent = mkdtempSync(join(tmpdir(), "nakokit-full-"));
    tempDirs.push(parent);
    const target = join(parent, "star-tracker");

    const names = scaffoldProject({
      targetDir: target,
      appName: "star-tracker",
      desktop: true,
      android: true,
      sqlite: true,
    });

    expect(names.slug).toBe("star-tracker");
    expect(existsSync(join(target, "desktop", "src", "main.mjs"))).toBe(true);
    expect(existsSync(join(target, "shared", "ipc.ts"))).toBe(true);
    expect(existsSync(join(target, "server", "database.ts"))).toBe(true);
    expect(existsSync(join(target, "tests", "ipc.test.ts"))).toBe(true);
    expect(
      existsSync(
        join(target, "android/app/src/main/kotlin/moe/nakode/startracker/shell/MainActivity.kt"),
      ),
    ).toBe(true);

    const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8")) as {
      name: string;
      scripts: Record<string, string>;
    };
    expect(pkg.name).toBe("star-tracker");
    expect(pkg.scripts["desktop:dev"]).toBeDefined();
    expect(pkg.scripts["android:build"]).toBeDefined();

    const gradle = readFileSync(join(target, "android/app/build.gradle.kts"), "utf8");
    expect(gradle).toContain('applicationId = "moe.nakode.startracker"');
    expect(gradle).toContain("STAR_TRACKER_ANDROID_VERSION_CODE");
  });

  test("scaffolds minimal web-only project when desktop, android, and sqlite are disabled", () => {
    const parent = mkdtempSync(join(tmpdir(), "nakokit-web-"));
    tempDirs.push(parent);
    const target = join(parent, "tiny-app");

    scaffoldProject({
      targetDir: target,
      appName: "tiny-app",
      desktop: false,
      android: false,
      sqlite: false,
    });

    expect(existsSync(join(target, "desktop"))).toBe(false);
    expect(existsSync(join(target, "android"))).toBe(false);
    expect(existsSync(join(target, "shared"))).toBe(false);
    expect(existsSync(join(target, "server", "database.ts"))).toBe(false);
    expect(existsSync(join(target, "tests", "ipc.test.ts"))).toBe(false);

    const pkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8")) as {
      name: string;
      scripts: Record<string, string>;
    };
    expect(pkg.name).toBe("tiny-app");
    expect(pkg.scripts["desktop:dev"]).toBeUndefined();
    expect(pkg.scripts["android:build"]).toBeUndefined();

    const appTs = readFileSync(join(target, "server", "app.ts"), "utf8");
    expect(appTs).not.toContain("bun:sqlite");
    expect(appTs).toContain('name: "tiny-app"');
  });

  test("CLI runs non-interactively with --yes --no-install --no-git", async () => {
    const parent = mkdtempSync(join(tmpdir(), "nakokit-cli-"));
    tempDirs.push(parent);

    const proc = Bun.spawn(
      ["bun", CLI_PATH, "demo-app", "--yes", "--no-install", "--no-git"],
      { cwd: parent, stdout: "pipe", stderr: "pipe" },
    );
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;

    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Created demo-app");
    expect(existsSync(join(parent, "demo-app", "src", "App.tsx"))).toBe(true);
  });
});
