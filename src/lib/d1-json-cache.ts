/**
 * Generic D1 JSON cache (pk/sk/result_json/cached_at/expires_at).
 * Used by GSC (analytics_cache) and EspoCRM (espocrm_cache).
 *
 * Table names are fixed string literals (whitelist) — never interpolated from input.
 */

import { getAuthDbFromEnv } from "@/lib/auth-d1";
import { allowDiscretionaryD1Write } from "@/lib/d1-write-budget";
import { paramsHash } from "@/lib/d1-params-hash";
import { rowToEntry, type CacheEntry } from "@/lib/d1-cache-entry";

export type { CacheEntry };
export { paramsHash };

export type CacheTable = "analytics_cache" | "espocrm_cache";

const SELECT_BY_PK_SK = {
  analytics_cache:
    "SELECT result_json, cached_at, expires_at FROM analytics_cache WHERE pk = ? AND sk = ?",
  espocrm_cache:
    "SELECT result_json, cached_at, expires_at FROM espocrm_cache WHERE pk = ? AND sk = ?",
} as const;

const UPSERT = {
  analytics_cache:
    "INSERT OR REPLACE INTO analytics_cache (pk, sk, result_json, cached_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  espocrm_cache:
    "INSERT OR REPLACE INTO espocrm_cache (pk, sk, result_json, cached_at, expires_at) VALUES (?, ?, ?, ?, ?)",
} as const;

export async function getCachedFromTable<T = unknown>(
  table: CacheTable,
  logPrefix: string,
  route: string,
  params: Record<string, unknown> = {},
  ttlSeconds = 3600
): Promise<CacheEntry<T> | null> {
  const db = getAuthDbFromEnv();
  if (!db) return null;
  const hash = paramsHash(params);
  try {
    const row = await db.prepare(SELECT_BY_PK_SK[table]).bind(route, hash).first<{
      result_json: string | null;
      cached_at: number | null;
      expires_at: number | null;
    }>();
    if (!row) return null;
    return rowToEntry<T>(row, ttlSeconds);
  } catch (err) {
    console.warn(`[${logPrefix}] getCached failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setCachedToTable<T = unknown>(
  table: CacheTable,
  logPrefix: string,
  route: string,
  params: Record<string, unknown> = {},
  payload: T,
  ttlSeconds = 3600
): Promise<void> {
  if (!allowDiscretionaryD1Write(1)) return;
  const db = getAuthDbFromEnv();
  if (!db) return;
  const hash = paramsHash(params);
  const now = Math.floor(Date.now() / 1000);
  try {
    await db
      .prepare(UPSERT[table])
      .bind(route, hash, JSON.stringify(payload), now, now + ttlSeconds)
      .run();
  } catch (err) {
    console.warn(`[${logPrefix}] setCached failed:`, err instanceof Error ? err.message : err);
  }
}

export async function readThroughTable<T>(
  table: CacheTable,
  logPrefix: string,
  route: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  opts: { ttlSeconds?: number; acceptStaleSeconds?: number } = {}
): Promise<{ value: T; source: "cache" | "live" | "stale"; ageSeconds: number }> {
  const ttlSeconds = opts.ttlSeconds ?? 3600;
  const acceptStaleSeconds = opts.acceptStaleSeconds ?? 24 * 3600;

  const cached = await getCachedFromTable<T>(table, logPrefix, route, params, ttlSeconds);
  if (cached && !cached.stale) {
    return { value: cached.payload, source: "cache", ageSeconds: cached.ageSeconds };
  }

  try {
    const live = await fetcher();
    setCachedToTable(table, logPrefix, route, params, live, ttlSeconds).catch(() => {});
    return { value: live, source: "live", ageSeconds: 0 };
  } catch (err) {
    if (cached && cached.ageSeconds <= acceptStaleSeconds) {
      console.warn(
        `[${logPrefix}] live fetch failed for ${route}, serving stale (age=${cached.ageSeconds}s):`,
        err instanceof Error ? err.message : err
      );
      return { value: cached.payload, source: "stale", ageSeconds: cached.ageSeconds };
    }
    throw err;
  }
}
