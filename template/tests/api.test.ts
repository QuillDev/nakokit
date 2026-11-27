import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { treaty } from "@elysiajs/eden";
import { sql } from "kysely";
import { z } from "zod";
import { createApp, type App } from "../server/app.ts";
import { openDatabase, queryRows } from "../server/database.ts";

describe("Elysia + Eden + Kysely + Zod", () => {
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
    await db.destroy();
  });

  test("health validates with Zod and returns typed payload via Eden", async () => {
    const client = treaty<App>(baseUrl, { parseDate: false });
    const res = await client.api.health.get();
    expect(res.error).toBeNull();
    expect(res.data).toEqual({
      ok: true,
      name: "nakokit",
      version: "0.1.0-test",
      database: "sqlite",
    });
  });

  test("queryRows parses raw Kysely SQL through a Zod schema", async () => {
    const RowSchema = z.object({ id: z.coerce.number(), label: z.string() });
    const rows = await queryRows(
      db,
      sql`select 1 as id, 'hello' as label union all select 2 as id, 'world' as label`,
      RowSchema,
    );
    expect(rows).toEqual([
      { id: 1, label: "hello" },
      { id: 2, label: "world" },
    ]);
  });
});
