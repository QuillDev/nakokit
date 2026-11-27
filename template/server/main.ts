import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app.ts";
import { openDatabase } from "./database.ts";

const port = Number(process.env.PORT ?? "8080");
const hostname = process.env.HOST ?? "127.0.0.1";
const distDir = resolve(process.cwd(), "dist");

const db = openDatabase();
const app = createApp({
  db,
  staticDir: existsSync(distDir) ? distDir : undefined,
});

app.listen({ hostname, port }, (server) => {
  console.log(`nakokit listening on http://${server.hostname}:${server.port}`);
});
