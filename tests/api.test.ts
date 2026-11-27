import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { createApp, type App } from "../server/app.ts";
import { openDatabase } from "../server/database.ts";

describe("Elysia + Eden end-to-end typed API", () => {
  const db = openDatabase(":memory:");
  const app = createApp(db, { version: "0.1.0-test" });
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

  test("full CRUD round-trip with filtering and validation", async () => {
    const client = treaty<App>(baseUrl, { parseDate: false });

    const created = await client.api.items.post({
      title: "Wire Eden client",
      status: "todo",
      tags: ["web", "desktop", "web"],
    });
    expect(created.status).toBe(201);
    expect(created.error).toBeNull();
    const item = created.data!.item;
    expect(item.title).toBe("Wire Eden client");
    expect(item.tags).toEqual(["web", "desktop"]);

    const listed = await client.api.items.get({ query: { q: "eden", status: "todo" } });
    expect(listed.error).toBeNull();
    expect(listed.data!.items.map((row) => row.id)).toContain(item.id);

    const updated = await client.api.items({ id: item.id }).patch({ status: "done" });
    expect(updated.error).toBeNull();
    expect(updated.data!.item.status).toBe("done");

    const missing = await client.api.items({ id: "does-not-exist" }).delete();
    expect(missing.status).toBe(404);

    const removed = await client.api.items({ id: item.id }).delete();
    expect(removed.error).toBeNull();
    expect(removed.data).toEqual({ deleted: true, id: item.id });
  });

  test("rejects blank titles", async () => {
    const client = treaty<App>(baseUrl, { parseDate: false });
    const res = await client.api.items.post({
      title: "   ",
      status: "todo",
      tags: [],
    });
    expect(res.status).toBe(400);
    expect(res.error).not.toBeNull();
  });
});
