import { createHash } from "crypto";
import { getAuthDbFromEnv } from "@/lib/auth-d1";

/**
 * Read-through cache for slow third-party data (Google Search Console).
 *
 * GSC has per-minute, per-day, and 50k-row-per-day quotas. Every admin tab
 * open used to hit the API fresh. This cache lets each route serve from
 * D1 `analytics_cache` if a fresh-enough entry exists, falling back to the
 * live API when not. The hourly /api/cron/gsc-cache-refresh job pre-warms
 * the common queries so admin users see instant responses.
 *
 * Schema (AUTH_DB.analytics_cache):
 *   pk = "<route>"                e.g. "seo", "keywords", "ctr-opportunities"
 *   sk = "<params-hash>"          deterministic for a given query-string
 *   result_json                   the cached response body
 *   cached_at (unix seconds)      when we wrote it
 *   expires_at (unix seconds)     cached_at + ttlSeconds
 *
 * Failure model: safe. If AUTH_DB is unbound, or any D1 operation throws,
 * helpers return null / undefined and callers fall back to the live API path.
 * The cache is never on the critical path.
 */

/**
 * Hash an arbitrary params object into a short deterministic key suffix.
 * Same input → same hash, regardless of property order.
 */
export function paramsHash(params: Record<string, unknown> = {}): string {
  // Sort keys so {a:1, b:2} and {b:2, a:1} hash to the same value.
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "default";
  const canonical = JSON.stringify(entries);
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export interface CacheEntry<T> {
  payload: T;
  storedAt: string;
  ageSeconds: number;
  stale: boolean;
}

interface CacheRow {
  result_json: string | null;
  cached_at: number | null;
  expires_at: number | null;
}

function rowToEntry<T>(row: CacheRow, ttlSeconds: number): CacheEntry<T> | null {
  const raw = row.result_json;
  const cachedAt = row.cached_at;
  if (!raw || typeof cachedAt !== "number") return null;

  let payload: T;
  try {
    payload = JSON.parse(raw) as T;
  } catch {
    return null;
  }

  const storedAt = new Date(cachedAt * 1000).toISOString();
  const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - cachedAt);
  const staleByTtl = ageSeconds > ttlSeconds;
  const staleByExpiry =
    typeof row.expires_at === "number" ? Math.floor(Date.now() / 1000) > row.expires_at : false;

  return {
    payload,
    storedAt,
    ageSeconds,
    stale: staleByTtl || staleByExpiry,
  };
}

/**
 * Read a cached entry. Returns null if:
 *   - AUTH_DB is not bound
 *   - no entry exists for (route, hash)
 *   - the entry is malformed
 * The caller decides whether a stale entry is acceptable; both fresh and
 * stale entries are returned with their `ageSeconds` filled in.
 */
export async function getCached<T = unknown>(
  route: string,
  params: Record<string, unknown> = {},
  ttlSeconds = 3600
): Promise<CacheEntry<T> | null> {
  const db = getAuthDbFromEnv();
  if (!db) return null;
  const hash = paramsHash(params);
  try {
    const row = await db
      .prepare(
        "SELECT result_json, cached_at, expires_at FROM analytics_cache WHERE pk = ? AND sk = ?"
      )
      .bind(route, hash)
      .first<CacheRow>();
    if (!row) return null;
    return rowToEntry<T>(row, ttlSeconds);
  } catch (err) {
    console.warn("[gsc-cache] getCached failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Write a payload to the cache. Best-effort — failures are logged and
 * swallowed because cache writes must never break the user-facing path.
 */
export async function setCached<T = unknown>(
  route: string,
  params: Record<string, unknown> = {},
  payload: T,
  ttlSeconds = 3600
): Promise<void> {
  const db = getAuthDbFromEnv();
  if (!db) return;
  const hash = paramsHash(params);
  const now = Math.floor(Date.now() / 1000);
  try {
    await db
      .prepare(
        `INSERT OR REPLACE INTO analytics_cache (pk, sk, result_json, cached_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(route, hash, JSON.stringify(payload), now, now + ttlSeconds)
      .run();
  } catch (err) {
    console.warn("[gsc-cache] setCached failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Read-through helper: serve from cache if fresh; otherwise call `fetcher`,
 * write the result back, return it. Always returns the live (or freshly
 * fetched) value. Pass `acceptStaleSeconds` to keep serving slightly-stale
 * data when the live API fails (degraded-mode pattern from the GSC quota
 * best practices).
 */
export async function readThrough<T>(
  route: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  opts: { ttlSeconds?: number; acceptStaleSeconds?: number } = {}
): Promise<{ value: T; source: "cache" | "live" | "stale"; ageSeconds: number }> {
  const ttlSeconds = opts.ttlSeconds ?? 3600;
  const acceptStaleSeconds = opts.acceptStaleSeconds ?? 24 * 3600;

  const cached = await getCached<T>(route, params, ttlSeconds);
  if (cached && !cached.stale) {
    return { value: cached.payload, source: "cache", ageSeconds: cached.ageSeconds };
  }

  try {
    const live = await fetcher();
    void setCached(route, params, live, ttlSeconds);
    return { value: live, source: "live", ageSeconds: 0 };
  } catch (err) {
    if (cached && cached.ageSeconds <= acceptStaleSeconds) {
      console.warn(
        `[gsc-cache] live fetch failed for ${route}, serving stale (age=${cached.ageSeconds}s):`,
        err instanceof Error ? err.message : err
      );
      return { value: cached.payload, source: "stale", ageSeconds: cached.ageSeconds };
    }
    throw err;
  }
}
