/**
 * Simple in-memory cache for Notion API responses.
 *
 * Avoids redundant Notion API calls within the same ISR revalidation window.
 * Each entry has a TTL (default 60s) — short enough to stay fresh,
 * long enough to deduplicate calls within a single page render.
 *
 * The cache is per-process (not shared across serverless instances),
 * which is fine for Next.js since ISR renders happen in a single process.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Get-or-fetch: returns cached data if fresh, otherwise calls `fetcher`
 * and caches the result.
 *
 * @param key   Unique cache key (e.g. "blog:posts", "docs:all")
 * @param fetcher  Async function that fetches fresh data
 * @param ttlMs    Cache TTL in milliseconds (default 60s)
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  const data = await fetcher();
  cache.set(key, { data, expiresAt: now + ttlMs });
  return data;
}

/**
 * Invalidate a specific cache key or all keys matching a prefix.
 */
export function invalidateCache(keyOrPrefix?: string): void {
  if (!keyOrPrefix) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
      cache.delete(key);
    }
  }
}
