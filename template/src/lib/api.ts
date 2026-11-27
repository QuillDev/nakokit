import { treaty } from "@elysiajs/eden";
import type { App } from "../../server/app.ts";
import { getApiOrigin } from "./platform.ts";

export const api = treaty<App>(getApiOrigin(), { parseDate: false });

export function extractErrorMessage(error: unknown, fallback = "Request failed"): string {
  if (error && typeof error === "object" && "value" in error) {
    const val = (error as { value: unknown }).value;
    if (val && typeof val === "object" && "error" in val && typeof val.error === "string") {
      return val.error;
    }
    if (typeof val === "string" && val.length > 0) return val;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
