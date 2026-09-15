import {
  getCachedFromTable,
  setCachedToTable,
  readThroughTable,
  paramsHash,
  type CacheEntry,
} from "@/lib/d1-json-cache";

export type { CacheEntry };
export { paramsHash };

const TABLE = "analytics_cache" as const;
const LOG = "gsc-cache";

/**
 * Read-through cache for slow third-party data (Google Search Console).
 * Backed by AUTH_DB.analytics_cache — see `d1-json-cache.ts`.
 */

export async function getCached<T = unknown>(
  route: string,
  params: Record<string, unknown> = {},
  ttlSeconds = 3600
): Promise<CacheEntry<T> | null> {
  return getCachedFromTable<T>(TABLE, LOG, route, params, ttlSeconds);
}

export async function setCached<T = unknown>(
  route: string,
  params: Record<string, unknown> = {},
  payload: T,
  ttlSeconds = 3600
): Promise<void> {
  await setCachedToTable(TABLE, LOG, route, params, payload, ttlSeconds);
}

export async function readThrough<T>(
  route: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  opts: { ttlSeconds?: number; acceptStaleSeconds?: number } = {}
): Promise<{ value: T; source: "cache" | "live" | "stale"; ageSeconds: number }> {
  return readThroughTable(TABLE, LOG, route, params, fetcher, {
    ttlSeconds: opts.ttlSeconds ?? 3600,
    acceptStaleSeconds: opts.acceptStaleSeconds ?? 24 * 3600,
  });
}
