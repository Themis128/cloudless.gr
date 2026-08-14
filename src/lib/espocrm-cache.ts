import { createHash } from "crypto";
import { getAuthDbFromEnv } from "@/lib/auth-d1";

/**
 * Read-through D1 cache for EspoCRM admin latency (not a second CRM).
 *
 * Table: AUTH_DB.espocrm_cache (migration 0017)
 * Soft-fails when AUTH_DB is unbound — callers always get a live (or empty) result.
 */

export function paramsHash(params: Record<string, unknown> = {}): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "default";
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex").slice(0, 16);
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

  const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - cachedAt);
  const staleByTtl = ageSeconds > ttlSeconds;
  const staleByExpiry =
    typeof row.expires_at === "number" ? Math.floor(Date.now() / 1000) > row.expires_at : false;

  return {
    payload,
    storedAt: new Date(cachedAt * 1000).toISOString(),
    ageSeconds,
    stale: staleByTtl || staleByExpiry,
  };
}

export async function getCached<T = unknown>(
  route: string,
  params: Record<string, unknown> = {},
  ttlSeconds = 45
): Promise<CacheEntry<T> | null> {
  const db = getAuthDbFromEnv();
  if (!db) return null;
  const hash = paramsHash(params);
  try {
    const row = await db
      .prepare(
        "SELECT result_json, cached_at, expires_at FROM espocrm_cache WHERE pk = ? AND sk = ?"
      )
      .bind(route, hash)
      .first<CacheRow>();
    if (!row) return null;
    return rowToEntry<T>(row, ttlSeconds);
  } catch (err) {
    console.warn("[espocrm-cache] getCached failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setCached<T = unknown>(
  route: string,
  params: Record<string, unknown> = {},
  payload: T,
  ttlSeconds = 45
): Promise<void> {
  const db = getAuthDbFromEnv();
  if (!db) return;
  const hash = paramsHash(params);
  const now = Math.floor(Date.now() / 1000);
  try {
    await db
      .prepare(
        `INSERT OR REPLACE INTO espocrm_cache (pk, sk, result_json, cached_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(route, hash, JSON.stringify(payload), now, now + ttlSeconds)
      .run();
  } catch (err) {
    console.warn("[espocrm-cache] setCached failed:", err instanceof Error ? err.message : err);
  }
}

export async function readThrough<T>(
  route: string,
  params: Record<string, unknown>,
  fetcher: () => Promise<T>,
  opts: { ttlSeconds?: number; acceptStaleSeconds?: number } = {}
): Promise<{ value: T; source: "cache" | "live" | "stale"; ageSeconds: number }> {
  const ttlSeconds = opts.ttlSeconds ?? 45;
  const acceptStaleSeconds = opts.acceptStaleSeconds ?? 300;

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
        `[espocrm-cache] live fetch failed for ${route}, serving stale (age=${cached.ageSeconds}s):`,
        err instanceof Error ? err.message : err
      );
      return { value: cached.payload, source: "stale", ageSeconds: cached.ageSeconds };
    }
    throw err;
  }
}

/** Best-effort delete of all keys whose pk equals or starts with prefix. */
export async function invalidatePrefix(pkPrefix: string): Promise<void> {
  const db = getAuthDbFromEnv();
  if (!db) return;
  try {
    await db
      .prepare("DELETE FROM espocrm_cache WHERE pk = ? OR pk LIKE ?")
      .bind(pkPrefix, `${pkPrefix}%`)
      .run();
  } catch (err) {
    console.warn(
      "[espocrm-cache] invalidatePrefix failed:",
      err instanceof Error ? err.message : err
    );
  }
}

export async function invalidateKey(
  route: string,
  params: Record<string, unknown> = {}
): Promise<void> {
  const db = getAuthDbFromEnv();
  if (!db) return;
  try {
    await db
      .prepare("DELETE FROM espocrm_cache WHERE pk = ? AND sk = ?")
      .bind(route, paramsHash(params))
      .run();
  } catch (err) {
    console.warn("[espocrm-cache] invalidateKey failed:", err instanceof Error ? err.message : err);
  }
}

/** Clear list + pipeline aggregates after mutating writes. */
export async function invalidateEspoListCaches(): Promise<void> {
  await Promise.all([
    invalidatePrefix("espocrm:listContacts"),
    invalidatePrefix("espocrm:listCompanies"),
    invalidatePrefix("espocrm:listTickets"),
    invalidatePrefix("espocrm:listDeals"),
    invalidatePrefix("espocrm:getDealsByStage"),
    invalidatePrefix("espocrm:getPipelineStats"),
  ]);
}

export async function invalidateEspoContactCaches(contactId: string): Promise<void> {
  await Promise.all([
    invalidateKey("espocrm:getContact", { id: contactId }),
    invalidateKey("espocrm:listContactOpportunities", { id: contactId }),
    invalidateKey("espocrm:listContactCases", { id: contactId }),
    invalidateKey("espocrm:listContactNotes", { id: contactId }),
    invalidateEspoListCaches(),
  ]);
}

export const ESPO_CACHE_TTL = {
  list: 45,
  contact: 45,
  pipeline: 60,
} as const;
