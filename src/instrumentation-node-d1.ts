/**
 * Node-only AUTH_DB bind for `next dev`. Imported dynamically from
 * instrumentation.ts inside the NEXT_RUNTIME === "nodejs" branch so Edge
 * instrumentation never sees node:sqlite.
 */
import { getLocalAuthDb } from "@/lib/auth-db-local";
import { getAuthDbFromEnv } from "@/lib/auth-d1";

const LOG_PREFIX = "[Instrumentation]";

export async function bindNodeAuthDb(): Promise<void> {
  const existing = (globalThis as { __AUTH_DB__?: { prepare?: unknown } }).__AUTH_DB__;
  if (existing && typeof existing.prepare === "function") {
    console.warn(`${LOG_PREFIX} AUTH_DB already bound`);
    return;
  }

  const local = getLocalAuthDb();
  if (local && typeof local.prepare === "function") {
    (globalThis as { __AUTH_DB__?: typeof local }).__AUTH_DB__ = local;
    console.warn(`${LOG_PREFIX} AUTH_DB bound (local D1)`);
    return;
  }

  const db = getAuthDbFromEnv();
  if (db && typeof db.prepare === "function") {
    (globalThis as { __AUTH_DB__?: typeof db }).__AUTH_DB__ = db;
    console.warn(`${LOG_PREFIX} AUTH_DB bound`);
    return;
  }

  console.error(
    `${LOG_PREFIX} AUTH_DB unbound — D1 must be bound. Run: pnpm d1:migrate:local`
  );
}
