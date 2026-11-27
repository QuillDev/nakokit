# nakokit

Multi-platform full-stack starter template for QuillDev apps: **Web + Electron + Android**, unified around end-to-end TypeScript safety and `nakomponents`.

## What's Inside

- **Frontend:** React 19, Vite 8, TypeScript (strict), Tailwind CSS v4, `nakomponents` (near-black `#09090b` theme + light mode + shared primitives), Lucide icons, Inter font.
- **Backend + End-to-End Types:** Bun + SQLite (`bun:sqlite`) + **Elysia** (`elysia`) with TypeBox schemas + **Eden** (`@elysiajs/eden`) typed client shared across Web, Electron, and Android.
- **Desktop (`desktop/`):** Electron shell with `contextIsolation`, `sandbox`, strict `mainFrame` IPC validation, persisted window bounds, `electron-builder` packaging, and a shared TypeScript IPC contract (`shared/ipc.ts`).
- **Android (`android/`):** Kotlin WebView shell (Gradle 9 / AGP 9) with edge-to-edge near-black chrome, Custom Tabs external link handling, cookie persistence, back-button navigation, and unit tests.
- **Quality Gate (`bun run check`):** `tsc --noEmit`, `oxlint --deny-warnings` (extending `nakomponents/oxlint.json`), `react-doctor`, `bun test`, and `vite build`.

## Quick Start

Create a new app in one command:

```bash
bunx github:QuillDev/nakokit my-app
cd my-app
bun install
bun run check
bun run dev
```

Or click **Use this template** on GitHub, clone your repo, and rename it in place:

```bash
bun run init my-app
bun install
bun run check
```

## Targets

- Web + API dev: `bun run dev`
- Production server: `bun run build && bun run start`
- Desktop (Electron): `cd desktop && bun install && cd .. && bun run desktop:dev`
- Android (Kotlin WebView): `bun run android:test` / `bun run android:build`
