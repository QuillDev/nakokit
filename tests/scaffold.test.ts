import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveNames, scaffoldProject } from "../bin/nakokit.ts";

describe("nakokit scaffolder", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("derives clean identifiers from app names", () => {
    expect(deriveNames("My Cool App")).toEqual({
      slug: "my-cool-app",
      displayName: "My Cool App",
      androidSegment: "mycoolapp",
      envPrefix: "MY_COOL_APP",
    });
    expect(() => deriveNames("123bad")).toThrow();
  });

  test("scaffolds a standalone renamed project for web, electron, and android", () => {
    const scratch = mkdtempSync(join(tmpdir(), "nakokit-test-"));
    dirs.push(scratch);
    const out = join(scratch, "star-tracker");

    scaffoldProject({ targetDir: out, appName: "star-tracker" });

    const pkg = JSON.parse(readFileSync(join(out, "package.json"), "utf8")) as {
      name: string;
      private: boolean;
      bin?: unknown;
      scripts: Record<string, string>;
    };
    expect(pkg.name).toBe("star-tracker");
    expect(pkg.private).toBe(true);
    expect(pkg.bin).toBeUndefined();
    expect(pkg.scripts.init).toBeUndefined();
    expect(existsSync(join(out, "bin"))).toBe(false);

    const desktopPkg = JSON.parse(
      readFileSync(join(out, "desktop/package.json"), "utf8"),
    ) as { build: { appId: string; productName: string } };
    expect(desktopPkg.build.appId).toBe("moe.nakode.startracker");
    expect(desktopPkg.build.productName).toBe("Star Tracker");

    const kotlinMain = join(
      out,
      "android/app/src/main/kotlin/moe/nakode/startracker/shell/MainActivity.kt",
    );
    expect(existsSync(kotlinMain)).toBe(true);
    expect(readFileSync(kotlinMain, "utf8")).toContain("package moe.nakode.startracker.shell");
    expect(readFileSync(join(out, "android/app/build.gradle.kts"), "utf8")).toContain(
      'applicationId = "moe.nakode.startracker"',
    );
  });
});
