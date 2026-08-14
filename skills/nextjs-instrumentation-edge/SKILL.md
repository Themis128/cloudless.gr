---
name: nextjs-instrumentation-edge
description: Keep Next.js instrumentation.ts Edge-safe so /api/health does not 500 and the dev console is not flooded with node:fs / node:sqlite / useSyncExternalStore errors. Use when health is 500, Edge Instrumentation traces auth-db-local or theme-pref, or when editing src/instrumentation.ts, instrumentation.node.ts, or instrumentation-flags.ts.
---

# Next.js instrumentation — Edge split

Turbopack **always compiles** `instrumentation.edge` even when `register()` only runs on Node ([vercel/next.js#86479](https://github.com/vercel/next.js/issues/86479)). Node APIs in `instrumentation.ts` itself become Edge errors ([#85938](https://github.com/vercel/next.js/issues/85938)). Do **not** wrap the runtime check in a helper ([#61728](https://github.com/vercel/next.js/issues/61728)).

Official pattern: [Importing runtime-specific code](https://nextjs.org/docs/app/guides/instrumentation#importing-runtime-specific-code).

## Required layout

```
src/instrumentation.ts          # Edge-safe: inline NEXT_RUNTIME check only
src/instrumentation-flags.ts    # no node:fs / sqlite / React hooks
src/instrumentation.node.ts     # Node-only: Sentry server, D1 bind, Slack
```

`register()` must look like:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation.node");
    await registerNode();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    if (process.env.NODE_ENV === "development") return;
    await import("../sentry.edge.config");
  }
}
```

## Forbidden in `instrumentation.ts`

- `node:fs`, `node:sqlite`, `node:path`
- `from "@/lib/auth-db-local"` or `require("./auth-db-local")`
- `from "@/lib/theme-pref"` (React hooks → RSC error)
- `from "@/lib/slack-notify"` (pulls admin-notifications → auth-d1)
- `typeof import("./auth-db-local")` (statically traced)

Local D1 in `instrumentation.node.ts` must use a **computed specifier** `require()`, not a literal `import`/`require("./lib/auth-db-local")`.

Client modules that mix hooks with helpers (e.g. `theme-pref.ts`) must start with `"use client"` so a mistaken Edge trace does not 500 `/api/health`.

## Tool

```bash
pnpm instrumentation:doctor
```

Runs `scripts/instrumentation-edge-doctor.mjs`. Exit 0 = Edge-safe. Fix every FAIL in production code (do not weaken the doctor).

## When `/api/health` is 500 in `pnpm dev`

1. Read the `[browser] ./src/lib/... Import trace: Instrumentation:` block in the terminal.
2. Run the doctor.
3. Move the Node import into `instrumentation.node.ts` or break the chain (opaque require / `"use client"`).
4. Confirm `curl -sS http://127.0.0.1:4000/api/health` is 200 without Edge traces.
