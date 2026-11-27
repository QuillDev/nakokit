# nakokit

Interactive CLI scaffolder for QuillDev full-stack apps (Web, Electron, Android).

## Usage

```bash
bunx github:QuillDev/nakokit
```

Or pass a name and flags directly:

```bash
bunx github:QuillDev/nakokit my-app --yes
bunx github:QuillDev/nakokit my-app --yes --db postgres --no-android --no-desktop
```

## What It Scaffolds

- **Web + API (always included):** React 19, Vite 8, TypeScript (strict), Tailwind CSS v4, `nakomponents`, Elysia + `@elysiajs/eden` + **Zod** end-to-end validation and typed client, `bun run check` (`tsc`, `oxlint`, `react-doctor`, `bun test`, `vite build`).
- **Database (`--db sqlite|postgres|none`):** **Kysely** query builder over **SQLite** (`bun:sqlite` WAL) or **Postgres** (`pg`) with `queryRows` / `queryOne` helpers that parse raw SQL results through Zod schemas.
- **Electron desktop (optional):** Sandboxed Electron shell with a shared typed IPC contract (`shared/ipc.ts`), persisted window bounds, and `electron-builder` packaging.
- **Android (optional):** Kotlin WebView shell (Gradle 9 / AGP 9) with edge-to-edge dark chrome, Custom Tabs, cookie persistence, and unit tests.
