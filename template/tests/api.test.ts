import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { createApp, type App } from "../server/app.ts";
import { openDatabase } from "../server/database.ts";

describe("Elysia + Eden typed API", () => {
  const db = openDatabase(":memory:");
  const app = createApp({ db, version: "0.1.0-test" });
  let baseUrl = "";

  beforeAll(() => {
    const server = app.listen({ hostname: "127.0.0.1", port: 0 });
    const port = server.server?.port;
    if (!port) throw new Error("Server did not bind a port");
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.stop();
    db.close();
  });

  test("health returns typed payload via Eden", async () => {
    const client = treaty<App>(baseUrl, { parseDate: false });
    const res = await client.api.health.get();
    expect(res.error).toBeNull();
    expect(res.data).toEqual({
      ok: true,
      name: "nakokit",
      version: "0.1.0-test",
    });
  });
});
