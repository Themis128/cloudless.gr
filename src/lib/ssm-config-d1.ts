/**
 * D1-based configuration store — Cloudflare Workers migration path.
 *
 * Replaces AWS SSM Parameter Store for Workers environment.
 * Reads configuration from D1 app_config table with env var fallback.
 * Sensitive secrets are still expected via Wrangler secrets or process.env.
 */

import type { AuthDatabase } from "@/lib/auth-d1";

// D1 binding interface
interface Env {
  AUTH_DB: AuthDatabase;
}

function getAuthDb(): AuthDatabase | null {
  const env = process.env as unknown as Env;
  return env.AUTH_DB ?? null;
}

// Detect if running in Cloudflare Workers
function isWorkers(): boolean {
  return typeof (globalThis as any).caches !== "undefined" && typeof process === "undefined";
}

// In-memory cache for D1 config (5 minute TTL)
let cached: Record<string, string> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetch all configuration from D1 app_config table.
 */
async function fetchD1Config(): Promise<Record<string, string>> {
  const db = getAuthDb();
  if (!db) {
    throw new Error("AUTH_DB binding not available");
  }

  const rows = await db
    .prepare("SELECT key, value FROM app_config")
    .all<{ key: string; value: string }>();

  const config: Record<string, string> = {};
  for (const row of rows.results) {
    config[row.key] = row.value;
  }

  return config;
}

/**
 * Get a configuration value.
 * Priority:
 * 1. process.env (Wrangler secrets, SSM_DISABLED=1 mode)
 * 2. D1 app_config table (Workers primary)
 * 3. Default values
 */
export async function getConfigValue(key: string, defaultValue?: string): Promise<string> {
  const envKey = key.toUpperCase();

  // 1. Check process.env first (secrets, SSM_DISABLED=1, test mode)
  const envValue = process.env[envKey] || process.env[key];
  if (envValue !== undefined && envValue !== "") {
    return envValue;
  }

  // 2. In Workers environment, try D1
  if (isWorkers()) {
    const now = Date.now();
    if (!cached || now - cachedAt > CACHE_TTL_MS) {
      try {
        cached = await fetchD1Config();
        cachedAt = now;
      } catch (err) {
        console.warn("[ssm-config-d1] D1 fetch failed:", err);
        cached = {};
        cachedAt = now;
      }
    }

    return cached[key] ?? defaultValue ?? "";
  }

  // 3. Lambda environment: SSM will handle (don't use this module directly)
  return defaultValue ?? "";
}

/**
 * Set a configuration value in D1.
 * Used by admin endpoints to update runtime configuration.
 */
export async function setConfigValue(
  key: string,
  value: string,
  description?: string
): Promise<boolean> {
  const db = getAuthDb();
  if (!db) {
    return false;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `INSERT INTO app_config (key, value, description, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           description = excluded.description,
           updated_at = excluded.updated_at`
      )
      .bind(key, value, description ?? null, now)
      .run();

    // Invalidate cache
    cached = null;
    cachedAt = 0;

    return true;
  } catch (err) {
    console.error("[ssm-config-d1] Failed to set config:", err);
    return false;
  }
}

/**
 * Clear the D1 config cache.
 * Used in tests or when configuration is updated.
 */
export function clearConfigCache(): void {
  cached = null;
  cachedAt = 0;
}