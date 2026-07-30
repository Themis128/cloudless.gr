/**
 * Unit tests for src/lib/gsc-cache.ts — D1 analytics_cache read-through.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AuthDatabase } from "@/lib/auth-d1";

type CacheRow = {
  pk: string;
  sk: string;
  result_json: string;
  cached_at: number;
  expires_at: number;
};

function createCacheDb(): AuthDatabase & {
  rows: Map<string, CacheRow>;
  failNext: boolean;
} {
  const rows = new Map<string, CacheRow>();
  const state = { rows, failNext: false };
  return {
    get rows() {
      return state.rows;
    },
    get failNext() {
      return state.failNext;
    },
    set failNext(v: boolean) {
      state.failNext = v;
    },
    prepare(query: string) {
      const binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds.push(...args);
          return stmt;
        },
        async run() {
          if (state.failNext) {
            state.failNext = false;
            throw new Error("d1 down");
          }
          if (query.includes("INSERT OR REPLACE INTO analytics_cache")) {
            const [pk, sk, result_json, cached_at, expires_at] = binds as [
              string,
              string,
              string,
              number,
              number,
            ];
            state.rows.set(`${pk}|${sk}`, { pk, sk, result_json, cached_at, expires_at });
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 0 } };
        },
        async all() {
          return { results: [], success: true };
        },
        async first<T = CacheRow>() {
          if (state.failNext) {
            state.failNext = false;
            throw new Error("d1 down");
          }
          if (query.includes("FROM analytics_cache")) {
            const key = `${binds[0]}|${binds[1]}`;
            return (state.rows.get(key) as T) ?? null;
          }
          return null;
        },
      };
      return stmt;
    },
  };
}

describe("gsc-cache", () => {
  beforeEach(() => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    vi.resetModules();
  });
  afterEach(() => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  });

  describe("paramsHash", () => {
    it("returns 'default' for empty params", async () => {
      const { paramsHash } = await import("@/lib/gsc-cache");
      expect(paramsHash()).toBe("default");
      expect(paramsHash({})).toBe("default");
    });

    it("is property-order invariant", async () => {
      const { paramsHash } = await import("@/lib/gsc-cache");
      expect(paramsHash({ a: 1, b: 2 })).toBe(paramsHash({ b: 2, a: 1 }));
    });

    it("ignores undefined and null values", async () => {
      const { paramsHash } = await import("@/lib/gsc-cache");
      expect(paramsHash({ a: 1, b: undefined, c: null })).toBe(paramsHash({ a: 1 }));
    });

    it("changes when values change", async () => {
      const { paramsHash } = await import("@/lib/gsc-cache");
      expect(paramsHash({ days: 7 })).not.toBe(paramsHash({ days: 28 }));
    });

    it("returns a 16-char hex string for non-empty params", async () => {
      const { paramsHash } = await import("@/lib/gsc-cache");
      const h = paramsHash({ days: 7, limit: 20 });
      expect(h).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe("getCached", () => {
    it("returns null when AUTH_DB is unbound", async () => {
      const { getCached } = await import("@/lib/gsc-cache");
      const r = await getCached("seo", {});
      expect(r).toBeNull();
    });

    it("returns null when no item exists", async () => {
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = createCacheDb();
      const { getCached } = await import("@/lib/gsc-cache");
      const r = await getCached("seo", {});
      expect(r).toBeNull();
    });

    it("returns parsed payload with ageSeconds when present + fresh", async () => {
      const db = createCacheDb();
      const cachedAt = Math.floor(Date.now() / 1000) - 60;
      db.rows.set("seo|default", {
        pk: "seo",
        sk: "default",
        result_json: JSON.stringify({ clicks: 42 }),
        cached_at: cachedAt,
        expires_at: cachedAt + 3600,
      });
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
      const { getCached } = await import("@/lib/gsc-cache");
      const r = await getCached<{ clicks: number }>("seo", {}, 3600);
      expect(r).not.toBeNull();
      expect(r!.payload.clicks).toBe(42);
      expect(r!.ageSeconds).toBeGreaterThanOrEqual(60);
      expect(r!.ageSeconds).toBeLessThan(120);
      expect(r!.stale).toBe(false);
    });

    it("marks entry stale when older than ttlSeconds", async () => {
      const db = createCacheDb();
      const cachedAt = Math.floor(Date.now() / 1000) - 7200;
      db.rows.set("seo|default", {
        pk: "seo",
        sk: "default",
        result_json: JSON.stringify({ x: 1 }),
        cached_at: cachedAt,
        expires_at: cachedAt + 3600,
      });
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
      const { getCached } = await import("@/lib/gsc-cache");
      const r = await getCached("seo", {}, 3600);
      expect(r!.stale).toBe(true);
    });

    it("returns null on malformed JSON payload", async () => {
      const db = createCacheDb();
      const cachedAt = Math.floor(Date.now() / 1000);
      db.rows.set("seo|default", {
        pk: "seo",
        sk: "default",
        result_json: "{not-json",
        cached_at: cachedAt,
        expires_at: cachedAt + 3600,
      });
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
      const { getCached } = await import("@/lib/gsc-cache");
      const r = await getCached("seo", {});
      expect(r).toBeNull();
    });

    it("returns null and swallows error on D1 failure", async () => {
      const db = createCacheDb();
      db.failNext = true;
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
      const { getCached } = await import("@/lib/gsc-cache");
      const r = await getCached("seo", {});
      expect(r).toBeNull();
    });
  });

  describe("setCached", () => {
    it("is a no-op when AUTH_DB is unbound", async () => {
      const { setCached } = await import("@/lib/gsc-cache");
      await expect(setCached("seo", {}, { clicks: 1 })).resolves.toBeUndefined();
    });

    it("writes serialized payload with cached_at + expires_at", async () => {
      const db = createCacheDb();
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
      const { setCached, paramsHash } = await import("@/lib/gsc-cache");
      await setCached("seo", { days: 7 }, { clicks: 123 }, 1800);
      const sk = paramsHash({ days: 7 });
      const row = db.rows.get(`seo|${sk}`);
      expect(row).toBeDefined();
      expect(JSON.parse(row!.result_json).clicks).toBe(123);
      expect(typeof row!.cached_at).toBe("number");
      expect(row!.expires_at - row!.cached_at).toBe(1800);
    });

    it("swallows D1 errors silently (best-effort)", async () => {
      const db = createCacheDb();
      db.failNext = true;
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
      const { setCached } = await import("@/lib/gsc-cache");
      await expect(setCached("seo", {}, { x: 1 })).resolves.toBeUndefined();
    });
  });

  describe("readThrough", () => {
    it("serves from cache when fresh, never calls fetcher", async () => {
      const db = createCacheDb();
      const cachedAt = Math.floor(Date.now() / 1000) - 60;
      db.rows.set("seo|default", {
        pk: "seo",
        sk: "default",
        result_json: JSON.stringify({ clicks: 9 }),
        cached_at: cachedAt,
        expires_at: cachedAt + 3600,
      });
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
      const { readThrough } = await import("@/lib/gsc-cache");
      const fetcher = vi.fn().mockResolvedValue({ clicks: 999 });
      const r = await readThrough("seo", {}, fetcher, { ttlSeconds: 3600 });
      expect(r.source).toBe("cache");
      expect((r.value as { clicks: number }).clicks).toBe(9);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it("calls fetcher and writes back when no cache entry exists", async () => {
      const db = createCacheDb();
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
      const { readThrough } = await import("@/lib/gsc-cache");
      const fetcher = vi.fn().mockResolvedValue({ clicks: 50 });
      const r = await readThrough("seo", {}, fetcher);
      expect(r.source).toBe("live");
      expect((r.value as { clicks: number }).clicks).toBe(50);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(db.rows.size).toBe(1);
    });

    it("calls fetcher when entry is stale", async () => {
      const db = createCacheDb();
      const cachedAt = Math.floor(Date.now() / 1000) - 7200;
      db.rows.set("seo|default", {
        pk: "seo",
        sk: "default",
        result_json: JSON.stringify({ clicks: 1 }),
        cached_at: cachedAt,
        expires_at: cachedAt + 3600,
      });
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
      const { readThrough } = await import("@/lib/gsc-cache");
      const fetcher = vi.fn().mockResolvedValue({ clicks: 2 });
      const r = await readThrough("seo", {}, fetcher, { ttlSeconds: 3600 });
      expect(r.source).toBe("live");
      expect((r.value as { clicks: number }).clicks).toBe(2);
    });

    it("falls back to stale cache when fetcher throws and stale is within window", async () => {
      const db = createCacheDb();
      const cachedAt = Math.floor(Date.now() / 1000) - 7200;
      db.rows.set("seo|default", {
        pk: "seo",
        sk: "default",
        result_json: JSON.stringify({ clicks: 5 }),
        cached_at: cachedAt,
        expires_at: cachedAt + 3600,
      });
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
      const { readThrough } = await import("@/lib/gsc-cache");
      const fetcher = vi.fn().mockRejectedValue(new Error("quota"));
      const r = await readThrough("seo", {}, fetcher, {
        ttlSeconds: 3600,
        acceptStaleSeconds: 24 * 3600,
      });
      expect(r.source).toBe("stale");
      expect((r.value as { clicks: number }).clicks).toBe(5);
    });

    it("re-throws when fetcher fails and no acceptable stale cache exists", async () => {
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = createCacheDb();
      const { readThrough } = await import("@/lib/gsc-cache");
      const fetcher = vi.fn().mockRejectedValue(new Error("quota"));
      await expect(readThrough("seo", {}, fetcher)).rejects.toThrow("quota");
    });

    it("re-throws when stale cache is past acceptStaleSeconds", async () => {
      const db = createCacheDb();
      const cachedAt = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;
      db.rows.set("seo|default", {
        pk: "seo",
        sk: "default",
        result_json: JSON.stringify({ clicks: 5 }),
        cached_at: cachedAt,
        expires_at: cachedAt + 3600,
      });
      (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
      const { readThrough } = await import("@/lib/gsc-cache");
      const fetcher = vi.fn().mockRejectedValue(new Error("quota"));
      await expect(
        readThrough("seo", {}, fetcher, { ttlSeconds: 3600, acceptStaleSeconds: 24 * 3600 })
      ).rejects.toThrow("quota");
    });
  });
});
