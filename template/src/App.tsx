import { useEffect, useState } from "react";
import { TooltipProvider } from "nakomponents";
import { api } from "./lib/api.ts";

export function App() {
  const [status, setStatus] = useState<"connecting" | "ok" | "offline">("connecting");

  useEffect(() => {
    let cancelled = false;
    async function checkHealth() {
      const res = await api.api.health.get();
      if (cancelled) return;
      setStatus(res.data?.ok ? "ok" : "offline");
    }
    void checkHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TooltipProvider>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-lg font-medium tracking-tight">Nakokit</h1>
        <p className="text-xs text-muted-foreground">
          api: {status}
        </p>
      </main>
    </TooltipProvider>
  );
}
