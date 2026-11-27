import type { DesktopAppInfo } from "../../shared/ipc.ts";

export type PlatformKind = "electron" | "android" | "web";

export function detectPlatform(): PlatformKind {
  if (typeof window !== "undefined" && window.nakoDesktop?.isElectron) {
    return "electron";
  }
  if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)) {
    return "android";
  }
  return "web";
}

export function getApiOrigin(): string {
  if (typeof window !== "undefined") {
    const desktopOrigin = window.nakoDesktop?.apiOrigin;
    if (desktopOrigin) return desktopOrigin;
    if (window.location.origin.startsWith("http")) {
      return window.location.origin;
    }
  }
  return "http://127.0.0.1:8080";
}

export async function getAppInfo(): Promise<DesktopAppInfo> {
  if (typeof window !== "undefined" && window.nakoDesktop) {
    return window.nakoDesktop.invoke("app:info");
  }
  return {
    name: "nakokit",
    version: "0.1.0",
    platform: detectPlatform(),
  };
}

export async function openExternalUrl(url: string): Promise<void> {
  if (typeof window !== "undefined" && window.nakoDesktop) {
    await window.nakoDesktop.invoke("shell:openExternal", url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
