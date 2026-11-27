const { contextBridge, ipcRenderer } = require("electron");

// Must stay 1:1 with DESKTOP_IPC_CHANNELS in shared/ipc.ts (verified by tests/ipc.test.ts).
const ALLOWED_CHANNELS = new Set([
  "app:info",
  "shell:openExternal",
  "window:minimize",
  "window:toggleMaximize",
  "window:close",
]);

contextBridge.exposeInMainWorld("nakoDesktop", {
  isElectron: true,
  apiOrigin: process.env.NAKO_API_ORIGIN || "http://127.0.0.1:8080",
  invoke(channel, ...args) {
    if (!ALLOWED_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`Blocked IPC channel: ${String(channel)}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
});
