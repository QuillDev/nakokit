import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { scaffoldProject } from "../src/scaffold.ts";

const REPO_ROOT = resolve(import.meta.dir, "..");
const TEMPLATE_ROOT = join(REPO_ROOT, "template");

async function run(cmd: string[], cwd: string) {
  const proc = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`Command failed (${code}): ${cmd.join(" ")} in ${cwd}`);
  }
}

const cases = [
  { name: "full-stack-app", desktop: true, android: true, sqlite: true },
  { name: "web-only-app", desktop: false, android: false, sqlite: false },
];

const workdir = mkdtempSync(join(tmpdir(), "nakokit-e2e-"));
try {
  for (const c of cases) {
    console.log(`\n=== E2E SCAFFOLD: ${c.name} ===`);
    const target = join(workdir, c.name);
    scaffoldProject({
      targetDir: target,
      appName: c.name,
      desktop: c.desktop,
      android: c.android,
      sqlite: c.sqlite,
      templateRoot: TEMPLATE_ROOT,
    });
    await run(["bun", "install"], target);
    await run(["bun", "run", "check"], target);
  }
  console.log("\nAll scaffolded variants passed bun run check.");
} finally {
  rmSync(workdir, { recursive: true, force: true });
}
