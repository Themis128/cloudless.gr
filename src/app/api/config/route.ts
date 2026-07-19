/**
 * Configuration endpoint for ETL scripts to read non-secret config from D1.
 * Replaces AWS SSM Parameter Store for Workers environment.
 *
 * Used by: scripts/etl/*-to-r2.mjs scripts
 * Endpoint: GET /api/config?key=keyname
 */

import type { AuthDatabase } from "@/lib/auth-d1";

interface Env {
  AUTH_DB: AuthDatabase;
}

interface ConfigResponse {
  key: string;
  value: string | null;
  description: string | null;
}

/**
 * Detect if running in Cloudflare Workers
 */
function isWorkers(): boolean {
  return typeof (globalThis as any).caches !== "undefined" && typeof process === "undefined";
}

/**
 * Get D1 binding (available in Workers)
 */
function getD1Binding(): AuthDatabase | null {
  if (isWorkers()) {
    const db = (process as any).env?.AUTH_DB || (globalThis as any).__AUTH_DB__;
    if (db && typeof db.prepare === "function") return db as AuthDatabase;
  }
  return null;
}

/**
 * GET /api/config?key=keyname
 * Returns configuration value from D1 app_config table.
 * ETL scripts use this to read non-secret configuration like pending clients lists.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return Response.json({ error: "Missing required query parameter: key" }, { status: 400 });
  }

  const db = getD1Binding();
  if (!db) {
    return Response.json({ error: "D1 not available in this environment" }, { status: 503 });
  }

  try {
    const config = await db
      .prepare("SELECT key, value, description FROM app_config WHERE key = ?")
      .bind(key)
      .first<ConfigResponse>();

    if (!config) {
      return Response.json({ key, value: null, description: null });
    }

    return Response.json(config);
  } catch (err) {
    console.error("[api/config] D1 query failed:", err);
    return Response.json({ error: "Database query failed" }, { status: 500 });
  }
}