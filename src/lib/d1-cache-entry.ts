/** Shared D1 JSON cache row → typed entry (GSC + EspoCRM caches). */

export interface CacheEntry<T> {
  payload: T;
  storedAt: string;
  ageSeconds: number;
  stale: boolean;
}

export interface CacheRow {
  result_json: string | null;
  cached_at: number | null;
  expires_at: number | null;
}

export function rowToEntry<T>(row: CacheRow, ttlSeconds: number): CacheEntry<T> | null {
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
