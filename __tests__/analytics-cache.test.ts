/**
 * Unit tests for analytics caching layer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock D1 database
const mockPrepare = vi.fn();
const mockDb = {
  prepare: mockPrepare,
};

const mockFirst = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: mockFirst,
    all: mockAll,
    run: mockRun,
  });
});

describe("analytics-cache exports", () => {
  it("exports cacheKey function", async () => {
    const mod = await import("@/lib/analytics-cache");
    expect(typeof mod.cacheKey).toBe("function");
  });

  it("exports getCachedAnalytics function", async () => {
    const mod = await import("@/lib/analytics-cache");
    expect(typeof mod.getCachedAnalytics).toBe("function");
  });

  it("exports setCachedAnalytics function", async () => {
    const mod = await import("@/lib/analytics-cache");
    expect(typeof mod.setCachedAnalytics).toBe("function");
  });

  it("exports withCache function", async () => {
    const mod = await import("@/lib/analytics-cache");
    expect(typeof mod.withCache).toBe("function");
  });

  it("exports cleanupExpiredCache function", async () => {
    const mod = await import("@/lib/analytics-cache");
    expect(typeof mod.cleanupExpiredCache).toBe("function");
  });

  it("exports getCacheStats function", async () => {
    const mod = await import("@/lib/analytics-cache");
    expect(typeof mod.getCacheStats).toBe("function");
  });

  it("exports invalidateCache function", async () => {
    const mod = await import("@/lib/analytics-cache");
    expect(typeof mod.invalidateCache).toBe("function");
  });

  it("exports invalidateAllAnalyticsCache function", async () => {
    const mod = await import("@/lib/analytics-cache");
    expect(typeof mod.invalidateAllAnalyticsCache).toBe("function");
  });

  it("exports ANALYTICS_CACHE_KEYS constant", async () => {
    const mod = await import("@/lib/analytics-cache");
    expect(mod.ANALYTICS_CACHE_KEYS).toBeDefined();
    expect(mod.ANALYTICS_CACHE_KEYS.SEO_SNAPSHOT).toBe("seo-snapshot");
    expect(mod.ANALYTICS_CACHE_KEYS.TOP_KEYWORDS).toBe("top-keywords");
    expect(mod.ANALYTICS_CACHE_KEYS.TOP_PAGES).toBe("top-pages");
  });

  it("exports getCacheTTLForEndpoint function", async () => {
    const mod = await import("@/lib/analytics-cache");
    expect(typeof mod.getCacheTTLForEndpoint).toBe("function");
  });
});

describe("cacheKey", () => {
  it("generates consistent cache key from params", async () => {
    const mod = await import("@/lib/analytics-cache");
    const key1 = mod.cacheKey("test", { a: 1, b: 2 });
    const key2 = mod.cacheKey("test", { b: 2, a: 1 });
    expect(key1).toBe(key2); // Order-independent
  });

  it("includes endpoint key in cache key", async () => {
    const mod = await import("@/lib/analytics-cache");
    const key = mod.cacheKey("seo-snapshot", { days: 28 });
    expect(key).toContain("seo-snapshot");
    expect(key).toContain("days=28");
  });
});

describe("getCacheTTLForEndpoint", () => {
  it("returns longer TTL for SEO snapshot", async () => {
    const mod = await import("@/lib/analytics-cache");
    const ttl = mod.getCacheTTLForEndpoint("seo-snapshot");
    expect(ttl).toBe(12 * 60 * 60); // 12 hours
  });

  it("returns longer TTL for performance history", async () => {
    const mod = await import("@/lib/analytics-cache");
    const ttl = mod.getCacheTTLForEndpoint("performance-history");
    expect(ttl).toBe(6 * 60 * 60); // 6 hours
  });

  it("returns default TTL for other endpoints", async () => {
    const mod = await import("@/lib/analytics-cache");
    const ttl = mod.getCacheTTLForEndpoint("unknown-endpoint");
    expect(ttl).toBe(60 * 60); // 1 hour default
  });
});

describe("getCachedAnalytics", () => {
  it("returns null when cache is empty", async () => {
    mockFirst.mockResolvedValue(null);

    const mod = await import("@/lib/analytics-cache");
    const result = await mod.getCachedAnalytics(mockDb as any, "test", { foo: "bar" });

    expect(result).toBeNull();
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("SELECT result_json FROM analytics_cache"),
    );
  });

  it("returns parsed JSON when cache hit", async () => {
    const cachedData = { clicks: 100, impressions: 1000 };
    mockFirst.mockResolvedValue({ result_json: JSON.stringify(cachedData) });

    const mod = await import("@/lib/analytics-cache");
    const result = await mod.getCachedAnalytics(mockDb as any, "test", { foo: "bar" });

    expect(result).toEqual(cachedData);
  });

  it("returns null when JSON parsing fails", async () => {
    mockFirst.mockResolvedValue({ result_json: "invalid-json" });

    const mod = await import("@/lib/analytics-cache");
    const result = await mod.getCachedAnalytics(mockDb as any, "test", { foo: "bar" });

    expect(result).toBeNull();
  });
});

describe("setCachedAnalytics", () => {
  it("inserts cache entry with TTL", async () => {
    mockRun.mockResolvedValue({ success: true });

    const mod = await import("@/lib/analytics-cache");
    await mod.setCachedAnalytics(mockDb as any, "test", { days: 28 }, { clicks: 100 }, 3600);

    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO analytics_cache"),
    );
  });
});

describe("withCache", () => {
  it("returns cached result when available", async () => {
    const cachedData = { clicks: 100 };
    mockFirst.mockResolvedValue({ result_json: JSON.stringify(cachedData) });

    const mod = await import("@/lib/analytics-cache");
    const result = await mod.withCache(
      mockDb as any,
      "test",
      { foo: "bar" },
      async () => ({ clicks: 999 }), // Should not be called
    );

    expect(result).toEqual(cachedData);
  });

  it("calls fetch function when cache miss", async () => {
    mockFirst.mockResolvedValue(null);
    const freshData = { clicks: 999 };

    const mod = await import("@/lib/analytics-cache");
    const result = await mod.withCache(
      mockDb as any,
      "test",
      { foo: "bar" },
      async () => freshData,
    );

    expect(result).toEqual(freshData);
  });
});

describe("cleanupExpiredCache", () => {
  it("deletes expired entries", async () => {
    mockRun.mockResolvedValue({ success: true, meta: { changes: 5 } });

    const mod = await import("@/lib/analytics-cache");
    const count = await mod.cleanupExpiredCache(mockDb as any);

    expect(count).toBe(5);
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM analytics_cache WHERE expires_at < ?"),
    );
  });
});

describe("getCacheStats", () => {
  it("returns cache statistics", async () => {
    mockFirst
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 10 });

    const mod = await import("@/lib/analytics-cache");
    const stats = await mod.getCacheStats(mockDb as any);

    expect(stats.totalEntries).toBe(100);
    expect(stats.expiredEntries).toBe(10);
  });
});