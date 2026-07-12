/**
 * Analytics caching layer for Cloudflare Free Tier migration.
 *
 * Uses D1's analytics_cache table to cache expensive GSC queries.
 * Provides a TTL-based caching mechanism for admin analytics endpoints.
 *
 * Cache behavior:
 * - Cache miss: Fetch from GSC API, store in D1, return result
 * - Cache hit: Return cached result if not expired
 * - TTL: Configurable per endpoint (default 1 hour)
 */

// Cache TTL constants
const DEFAULT_CACHE_TTL_SECONDS = 60 * 60; // 1 hour
const PERFORMANCE_CACHE_TTL_SECONDS = 60 * 60 * 6; // 6 hours
const SNAPSHOT_CACHE_TTL_SECONDS = 60 * 60 * 12; // 12 hours

// D1 binding interface
export interface AnalyticsDatabase {
  prepare: (query: string) => D1PreparedStatement;
}

interface D1PreparedStatement {
  bind: (...args: unknown[]) => D1PreparedStatement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[]; success: boolean }>;
  run: () => Promise<{ success: boolean; meta?: { changes: number } }>;
  first: <T = Record<string, unknown>>(col?: string) => Promise<T | null>;
}

// Cache key generators for different query types
export function cacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `${prefix}:${sorted}`;
}

// Get cached analytics result
export async function getCachedAnalytics<T = Record<string, unknown>>(
  db: AnalyticsDatabase,
  endpointKey: string,
  params: Record<string, unknown>,
): Promise<T | null> {
  const sk = cacheKey(endpointKey, params);
  const now = Math.floor(Date.now() / 1000);

  const cached = await db
    .prepare("SELECT result_json FROM analytics_cache WHERE pk = ? AND sk = ? AND expires_at > ?")
    .bind("analytics", sk, now)
    .first<{ result_json: string }>();

  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached.result_json) as T;
  } catch {
    return null;
  }
}

// Set cached analytics result
export async function setCachedAnalytics(
  db: AnalyticsDatabase,
  endpointKey: string,
  params: Record<string, unknown>,
  result: unknown,
  ttlSeconds = DEFAULT_CACHE_TTL_SECONDS,
): Promise<void> {
  const sk = cacheKey(endpointKey, params);
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      "INSERT OR REPLACE INTO analytics_cache (pk, sk, result_json, cached_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind("analytics", sk, JSON.stringify(result), now, now + ttlSeconds)
    .run();
}

// Cache wrapper for async fetch functions
export async function withCache<T>(
  db: AnalyticsDatabase,
  endpointKey: string,
  params: Record<string, unknown>,
  fetchFn: () => Promise<T>,
  ttlSeconds = DEFAULT_CACHE_TTL_SECONDS,
): Promise<T> {
  // Try cache first
  const cached = await getCachedAnalytics<T>(db, endpointKey, params);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch fresh data
  const result = await fetchFn();

  // Store in cache (fire and forget - don't block response)
  setCachedAnalytics(db, endpointKey, params, result, ttlSeconds).catch(() => {
    // Ignore cache errors - not critical
  });

  return result;
}

// Clean up expired cache entries
export async function cleanupExpiredCache(db: AnalyticsDatabase): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db.prepare("DELETE FROM analytics_cache WHERE expires_at < ?").bind(now).run();
  return result.meta?.changes ?? 0;
}

// Get cache statistics for monitoring
export async function getCacheStats(db: AnalyticsDatabase): Promise<{
  totalEntries: number;
  expiredEntries: number;
  cacheHitRate?: number;
}> {
  const now = Math.floor(Date.now() / 1000);

  const total = await db
    .prepare("SELECT COUNT(*) as count FROM analytics_cache WHERE pk = ?")
    .bind("analytics")
    .first<{ count: number }>();

  const expired = await db
    .prepare("SELECT COUNT(*) as count FROM analytics_cache WHERE pk = ? AND expires_at < ?")
    .bind("analytics", now)
    .first<{ count: number }>();

  return {
    totalEntries: total?.count ?? 0,
    expiredEntries: expired?.count ?? 0,
  };
}

// Invalidate specific cache entry
export async function invalidateCache(
  db: AnalyticsDatabase,
  endpointKey: string,
  params: Record<string, unknown>,
): Promise<void> {
  const sk = cacheKey(endpointKey, params);
  await db.prepare("DELETE FROM analytics_cache WHERE pk = ? AND sk = ?").bind("analytics", sk).run();
}

// Invalidate all analytics cache
export async function invalidateAllAnalyticsCache(db: AnalyticsDatabase): Promise<void> {
  await db.prepare("DELETE FROM analytics_cache WHERE pk = ?").bind("analytics").run();
}

// Pre-defined cache keys for common analytics endpoints
export const ANALYTICS_CACHE_KEYS = {
  SEO_SNAPSHOT: "seo-snapshot",
  TOP_KEYWORDS: "top-keywords",
  TOP_PAGES: "top-pages",
  PERFORMANCE_HISTORY: "performance-history",
  DEVICE_BREAKDOWN: "device-breakdown",
  TRAFFIC_BY_COUNTRY: "traffic-by-country",
  CTR_OPPORTUNITIES: "ctr-opportunities",
  QUERY_PAGE_MAPPING: "query-page-mapping",
  SEARCH_INTENT: "search-intent",
  PRODUCT_PAGES: "product-pages",
} as const;

// Helper to get appropriate TTL for different analytics types
export function getCacheTTLForEndpoint(endpointKey: string): number {
  switch (endpointKey) {
    case ANALYTICS_CACHE_KEYS.PERFORMANCE_HISTORY:
      return PERFORMANCE_CACHE_TTL_SECONDS;
    case ANALYTICS_CACHE_KEYS.SEO_SNAPSHOT:
    case ANALYTICS_CACHE_KEYS.DEVICE_BREAKDOWN:
    case ANALYTICS_CACHE_KEYS.TRAFFIC_BY_COUNTRY:
      return SNAPSHOT_CACHE_TTL_SECONDS;
    default:
      return DEFAULT_CACHE_TTL_SECONDS;
  }
}