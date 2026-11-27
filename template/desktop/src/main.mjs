import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, ipcMain, net, protocol, shell } from "electron";

const currentDir = dirname(fileURLToPath(import.meta.url));
const APP_PROTOCOL = "app";

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function webRootDir() {
  const packaged = resolve(currentDir, "../web");
  if (existsSync(packaged)) return packaged;
  return resolve(currentDir, "../../dist");
}

function windowStatePath() {
  return join(app.getPath("userData"), "window-state.json");
}

function loadWindowBounds() {
  try {
    const raw = JSON.parse(readFileSync(windowStatePath(), "utf8"));
    if (
      raw &&
      typeof raw.width === "number" &&
      typeof raw.height === "number" &&
      raw.width >= 480 &&
      raw.height >= 360
    ) {
      return {
        width: Math.round(raw.width),
        height: Math.round(raw.height),
        x: typeof raw.x === "number" ? Math.round(raw.x) : undefined,
        y: typeof raw.y === "number" ? Math.round(raw.y) : undefined,
      };
    }
  } catch {
    // First launch or unreadable state file.
  }
  return { width: 1100, height: 760 };
}

function saveWindowBounds(win) {
  if (win.isDestroyed() || win.isMinimized() || win.isMaximized()) return;
  try {
    const file = windowStatePath();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(win.getBounds()), { mode: 0o600 });
  } catch {
    // Non-fatal on read-only paths.
  }
}

function isAllowedExternalUrl(raw) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:";
  } catch {
    return false;
  }
}

function resolveWebFile(root, pathname) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
  const candidate = resolve(root, rel || "index.html");
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return null;
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }
  const fallback = resolve(root, "index.html");
  return existsSync(fallback) ? fallback : null;
}

/** @type {BrowserWindow | null} */
let mainWindow = null;

function assertMainFrame(event) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("Window not ready");
  }
  if (event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error("Unauthorized IPC sender");
  }
}

function registerIpcHandlers() {
  ipcMain.handle("app:info", (event) => {
    assertMainFrame(event);
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
    };
  });

  ipcMain.handle("shell:openExternal", async (event, url) => {
    assertMainFrame(event);
    if (typeof url !== "string" || !isAllowedExternalUrl(url)) {
      return false;
    }
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle("window:minimize", (event) => {
    assertMainFrame(event);
    mainWindow?.minimize();
  });

  ipcMain.handle("window:toggleMaximize", (event) => {
    assertMainFrame(event);
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }
    mainWindow.maximize();
    return true;
  });

  ipcMain.handle("window:close", (event) => {
    assertMainFrame(event);
    mainWindow?.close();
  });
}

function createMainWindow() {
  const bounds = loadWindowBounds();
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 480,
    minHeight: 360,
    backgroundColor: "#09090b",
    show: false,
    webPreferences: {
      preload: join(currentDir, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;
  win.once("ready-to-show", () => win.show());
  win.on("close", () => saveWindowBounds(win));
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const devOrigin = process.env.NAKO_DEV_URL ? new URL(process.env.NAKO_DEV_URL).origin : null;
    const isInApp =
      url.startsWith(`${APP_PROTOCOL}://`) || (devOrigin !== null && url.startsWith(devOrigin));
    if (!isInApp) {
      event.preventDefault();
      if (isAllowedExternalUrl(url)) {
        void shell.openExternal(url);
      }
    }
  });

  const startUrl = process.env.NAKO_DEV_URL || `${APP_PROTOCOL}://index/`;
  void win.loadURL(startUrl);
}

async function boot() {
  await app.whenReady();
  const root = webRootDir();
  protocol.handle(APP_PROTOCOL, (request) => {
    const { pathname } = new URL(request.url);
    const file = resolveWebFile(root, pathname);
    if (!file) {
      return new Response("Not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(file).href);
  });

  registerIpcHandlers();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

void boot();

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
