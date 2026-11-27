import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DESKTOP_IPC_CHANNELS } from "../shared/ipc.ts";

describe("Electron IPC contract stays synced across shared/ipc.ts, main.mjs, and preload.cjs", () => {
  const root = resolve(import.meta.dir, "..");
  const preload = readFileSync(resolve(root, "desktop/src/preload.cjs"), "utf8");
  const main = readFileSync(resolve(root, "desktop/src/main.mjs"), "utf8");

  test("every shared IPC channel is allowlisted in preload.cjs and handled in main.mjs", () => {
    for (const channel of DESKTOP_IPC_CHANNELS) {
      expect(preload).toContain(`"${channel}"`);
      expect(main).toContain(`ipcMain.handle("${channel}"`);
    }
  });

  test("main.mjs enforces sandbox, contextIsolation, and mainFrame checks", () => {
    expect(main).toContain("contextIsolation: true");
    expect(main).toContain("sandbox: true");
    expect(main).toContain("nodeIntegration: false");
    expect(main).toContain("event.senderFrame !== mainWindow.webContents.mainFrame");
  });
});
