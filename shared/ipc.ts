export type DesktopAppInfo = {
  readonly name: string;
  readonly version: string;
  readonly platform: string;
};

/**
 * Single source of truth for Electron main <-> renderer IPC.
 * Both desktop/src/main.mjs (handlers) and src/lib/platform.ts (caller)
 * enforce this contract.
 */
export type DesktopIpcContract = {
  "app:info": {
    args: [];
    result: DesktopAppInfo;
  };
  "shell:openExternal": {
    args: [url: string];
    result: boolean;
  };
  "window:minimize": {
    args: [];
    result: void;
  };
  "window:toggleMaximize": {
    args: [];
    result: boolean;
  };
  "window:close": {
    args: [];
    result: void;
  };
};

export type DesktopIpcChannel = keyof DesktopIpcContract;

export const DESKTOP_IPC_CHANNELS = [
  "app:info",
  "shell:openExternal",
  "window:minimize",
  "window:toggleMaximize",
  "window:close",
] as const satisfies readonly DesktopIpcChannel[];

export type DesktopBridge = {
  readonly isElectron: true;
  readonly apiOrigin?: string;
  invoke<K extends DesktopIpcChannel>(
    channel: K,
    ...args: DesktopIpcContract[K]["args"]
  ): Promise<DesktopIpcContract[K]["result"]>;
};

declare global {
  interface Window {
    nakoDesktop?: DesktopBridge;
  }
}
