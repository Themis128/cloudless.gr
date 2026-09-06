/**
 * Tests for src/lib/analytics-cache.ts
 */
import { describe, it, expect, vi } from "vitest";
import {
  cacheKey,
  getCachedAnalytics,
  setCachedAnalytics,
  withCache,
  cleanupExpiredCache,
  getCacheStats,
  invalidateCache,
  invalidateAllAnalyticsCache,
  ANALYTICS_CACHE_KEYS,
  getCacheTTLForEndpoint,
  type AnalyticsDatabase,
} from "@/lib/analytics-cache";

function makeDb(firstResult?: unknown, changes = 0) {
  const mockRun = vi.fn().mockResolvedValue({ meta: { changes }, success: true });
  const mockFirst = vi.fn().mockResolvedValue(firstResult ?? null);
  const mockBind = vi.fn().mockReturnValue({ run: mockRun, first: mockFirst });
  const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
  return {
    db: { prepare: mockPrepare } as unknown as AnalyticsDatabase,
    mockPrepare,
    mockBind,
    mockRun,
    mockFirst,
  };
}

describe("cacheKey", () => {
  it("produces stable key regardless of param insertion order", () => {
    const k1 = cacheKey("seo", { b: 2, a: 1 });
    const k2 = cacheKey("seo", { a: 1, b: 2 });
    expect(k1).toBe(k2);
  });

  it("starts with the prefix", () => {
    expect(cacheKey("myprefix", {})).toMatch(/^myprefix:/);
  });

  it("includes serialized param values", () => {
    const k = cacheKey("x", { days: 7, type: "gsc" });
    expect(k).toContain("days=7");
    expect(k).toContain("type=gsc");
  });

  it("handles empty params", () => {
    expect(cacheKey("p", {})).toBe("p:");
  });
});

describe("getCachedAnalytics", () => {
  it("returns null when no cached row found", async () => {
    const { db } = makeDb(null);
    expect(await getCachedAnalytics(db, "seo", { days: 7 })).toBeNull();
  });

  it("parses and returns JSON from cache", async () => {
    const { db } = makeDb({ result_json: JSON.stringify({ total: 100 }) });
    const result = await getCachedAnalytics<{ total: number }>(db, "seo", {});
    expect(result).toEqual({ total: 100 });
  });

  it("returns null when cached JSON is malformed", async () => {
    const { db } = makeDb({ result_json: "bad{json" });
    expect(await getCachedAnalytics(db, "x", {})).toBeNull();
  });
});

describe("setCachedAnalytics", () => {
  it("calls INSERT OR REPLACE with analytics pk and serialized result", async () => {
    const { db, mockBind } = makeDb();
    await setCachedAnalytics(db, "top-keywords", { days: 30 }, { data: [1, 2] });
    const args = mockBind.mock.calls[0];
    expect(args[0]).toBe("analytics");
    expect(args[2]).toBe(JSON.stringify({ data: [1, 2] }));
  });

  it("stores expiry as now + ttl", async () => {
    const { db, mockBind } = makeDb();
    const before = Math.floor(Date.now() / 1000);
    await setCachedAnalytics(db, "x", {}, {}, 120);
    const args = mockBind.mock.calls[0];
    const expiresAt = args[4] as number;
    expect(expiresAt).toBeGreaterThanOrEqual(before + 120);
    expect(expiresAt).toBeLessThanOrEqual(before + 130);
  });
});

describe("withCache", () => {
  it("returns cached value without calling fetchFn", async () => {
    const { db } = makeDb({ result_json: JSON.stringify({ cached: true }) });
    const fetchFn = vi.fn();
    const result = await withCache(db, "seo", {}, fetchFn);
    expect(result).toEqual({ cached: true });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("calls fetchFn on cache miss and returns fresh result", async () => {
    let firstCallCount = 0;
    const mockFirst = vi.fn().mockImplementation(() => {
      firstCallCount++;
      return Promise.resolve(null);
    });
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
    const mockBind = vi.fn().mockReturnValue({ first: mockFirst, run: mockRun });
    const db = { prepare: vi.fn().mockReturnValue({ bind: mockBind }) } as unknown as AnalyticsDatabase;

    const fetchFn = vi.fn().mockResolvedValue({ fresh: true });
    const result = await withCache(db, "seo", {}, fetchFn);
    expect(result).toEqual({ fresh: true });
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

describe("cleanupExpiredCache", () => {
  it("returns count of deleted entries", async () => {
    const { db } = makeDb(null, 8);
    expect(await cleanupExpiredCache(db)).toBe(8);
  });

  it("returns 0 when meta is absent", async () => {
    const mockRun = vi.fn().mockResolvedValue({});
    const db = {
      prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({ run: mockRun }) }),
    } as unknown as AnalyticsDatabase;
    expect(await cleanupExpiredCache(db)).toBe(0);
  });
});

describe("getCacheStats", () => {
  it("returns total and expired entry counts", async () => {
    let callCount = 0;
    const mockFirst = vi.fn().mockImplementation(() => {
      return Promise.resolve({ count: callCount++ === 0 ? 10 : 3 });
    });
    const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
    const db = { prepare: vi.fn().mockReturnValue({ bind: mockBind }) } as unknown as AnalyticsDatabase;
    const stats = await getCacheStats(db);
    expect(stats.totalEntries).toBe(10);
    expect(stats.expiredEntries).toBe(3);
  });

  it("defaults to 0 when rows are null", async () => {
    const { db } = makeDb(null);
    const stats = await getCacheStats(db);
    expect(stats.totalEntries).toBe(0);
    expect(stats.expiredEntries).toBe(0);
  });
});

describe("invalidateCache", () => {
  it("deletes by pk=analytics and the correct sk", async () => {
    const { db, mockPrepare, mockBind } = makeDb();
    await invalidateCache(db, "top-keywords", { days: 7 });
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("DELETE FROM analytics_cache");
    expect(mockBind.mock.calls[0][0]).toBe("analytics");
  });
});

describe("invalidateAllAnalyticsCache", () => {
  it("deletes all entries with pk=analytics", async () => {
    const { db, mockBind } = makeDb();
    await invalidateAllAnalyticsCache(db);
    expect(mockBind.mock.calls[0][0]).toBe("analytics");
  });
});

describe("ANALYTICS_CACHE_KEYS", () => {
  it("has SEO_SNAPSHOT key", () => expect(ANALYTICS_CACHE_KEYS.SEO_SNAPSHOT).toBe("seo-snapshot"));
  it("has TOP_KEYWORDS key", () => expect(ANALYTICS_CACHE_KEYS.TOP_KEYWORDS).toBe("top-keywords"));
  it("has PERFORMANCE_HISTORY key", () => expect(ANALYTICS_CACHE_KEYS.PERFORMANCE_HISTORY).toBe("performance-history"));
  it("has all 10 entries", () => expect(Object.keys(ANALYTICS_CACHE_KEYS)).toHaveLength(10));
});

describe("getCacheTTLForEndpoint", () => {
  it("returns 6h for PERFORMANCE_HISTORY", () => {
    expect(getCacheTTLForEndpoint("performance-history")).toBe(60 * 60 * 6);
  });

  it("returns 12h for SEO_SNAPSHOT", () => {
    expect(getCacheTTLForEndpoint("seo-snapshot")).toBe(60 * 60 * 12);
  });

  it("returns 12h for DEVICE_BREAKDOWN", () => {
    expect(getCacheTTLForEndpoint("device-breakdown")).toBe(60 * 60 * 12);
  });

  it("returns 12h for TRAFFIC_BY_COUNTRY", () => {
    expect(getCacheTTLForEndpoint("traffic-by-country")).toBe(60 * 60 * 12);
  });

  it("returns 1h for unrecognised keys", () => {
    expect(getCacheTTLForEndpoint("unknown")).toBe(60 * 60);
    expect(getCacheTTLForEndpoint("top-keywords")).toBe(60 * 60);
  });
});
