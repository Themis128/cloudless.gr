/**
 * Unit tests for src/lib/gsc-cache.ts — the read-through cache for Google
 * Search Console responses.
 *
 * AWS SDK Dynamo client is mocked with the regular-function constructor
 * pattern used by every other Dynamo-backed lib in this repo
 * (admin-notifications.test.ts, client-portals.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSend, getCalls, putCalls } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  getCalls: [] as Record<string, unknown>[],
  putCalls: [] as Record<string, unknown>[],
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn().mockImplementation(function () {
    return { send: mockSend };
  }),
  GetItemCommand: vi.fn().mockImplementation(function (input: Record<string, unknown>) {
    getCalls.push(input);
    return { __cmd: "Get", input };
  }),
  PutItemCommand: vi.fn().mockImplementation(function (input: Record<string, unknown>) {
    putCalls.push(input);
    return { __cmd: "Put", input };
  }),
}));

vi.mock("@/lib/stripe-transactions", () => ({
  resolveDynamoEndpoint: () => undefined,
}));

describe("gsc-cache", () => {
  beforeEach(() => {
    mockSend.mockReset();
    getCalls.length = 0;
    putCalls.length = 0;
    process.env.ANALYTICS_CACHE_TABLE = "TestCache";
  });
  afterEach(() => {
    delete process.env.ANALYTICS_CACHE_TABLE;
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
    it("returns null when ANALYTICS_CACHE_TABLE is unset", async () => {
      delete process.env.ANALYTICS_CACHE_TABLE;
      const { getCached } = await import("@/lib/gsc-cache");
      const r = await getCached("seo", {});
      expect(r).toBeNull();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("returns null when no item exists", async () => {
      mockSend.mockResolvedValueOnce({});
      const { getCached } = await import("@/lib/gsc-cache");
      const r = await getCached("seo", {});
      expect(r).toBeNull();
    });

    it("returns parsed payload with ageSeconds when present + fresh", async () => {
      const storedAt = new Date(Date.now() - 60_000).toISOString();
      mockSend.mockResolvedValueOnce({
        Item: {
          storedAt: { S: storedAt },
          payload: { S: JSON.stringify({ clicks: 42 }) },
        },
      });
      const { getCached } = await import("@/lib/gsc-cache");
      const r = await getCached<{ clicks: number }>("seo", { days: 28 }, 3600);
      expect(r).not.toBeNull();
      expect(r!.payload.clicks).toBe(42);
      expect(r!.ageSeconds).toBeGreaterThanOrEqual(60);
      expect(r!.ageSeconds).toBeLessThan(120);
      expect(r!.stale).toBe(false);
    });

    it("marks entry stale when older than ttlSeconds", async () => {
      const storedAt = new Date(Date.now() - 7200_000).toISOString();
      mockSend.mockResolvedValueOnce({
        Item: {
          storedAt: { S: storedAt },
          payload: { S: JSON.stringify({ x: 1 }) },
        },
      });
      const { getCached } = await import("@/lib/gsc-cache");
      const r = await getCached("seo", {}, 3600);
      expect(r!.stale).toBe(true);
    });

    it("returns null on malformed JSON payload", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          storedAt: { S: new Date().toISOString() },
          payload: { S: "{not-json" },
        },
      });
      const { getCached } = await import("@/lib/gsc-cache");
      const r = await getCached("seo", {});
      expect(r).toBeNull();
    });

    it("returns null and swallows error on Dynamo failure", async () => {
      mockSend.mockRejectedValueOnce(new Error("dynamo down"));
      const { getCached } = await import("@/lib/gsc-cache");
      const r = await getCached("seo", {});
      expect(r).toBeNull();
    });
  });

  describe("setCached", () => {
    it("is a no-op when table is unset", async () => {
      delete process.env.ANALYTICS_CACHE_TABLE;
      const { setCached } = await import("@/lib/gsc-cache");
      await setCached("seo", {}, { clicks: 1 });
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("writes serialized payload with storedAt + ttlSeconds", async () => {
      mockSend.mockResolvedValueOnce({});
      const { setCached } = await import("@/lib/gsc-cache");
      await setCached("seo", { days: 7 }, { clicks: 123 }, 1800);
      expect(putCalls).toHaveLength(1);
      const item = (putCalls[0] as { Item: Record<string, { S?: string; N?: string }> }).Item;
      expect(item.pk.S).toBe("seo");
      expect(item.sk.S).toMatch(/^[0-9a-f]{16}$/);
      expect(JSON.parse(item.payload.S!).clicks).toBe(123);
      expect(typeof item.storedAt.S).toBe("string");
      expect(item.ttlSeconds.N).toBe("1800");
    });

    it("swallows Dynamo errors silently (best-effort)", async () => {
      mockSend.mockRejectedValueOnce(new Error("boom"));
      const { setCached } = await import("@/lib/gsc-cache");
      await expect(setCached("seo", {}, { x: 1 })).resolves.toBeUndefined();
    });
  });

  describe("readThrough", () => {
    it("serves from cache when fresh, never calls fetcher", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          storedAt: { S: new Date(Date.now() - 60_000).toISOString() },
          payload: { S: JSON.stringify({ clicks: 9 }) },
        },
      });
      const { readThrough } = await import("@/lib/gsc-cache");
      const fetcher = vi.fn().mockResolvedValue({ clicks: 999 });
      const r = await readThrough("seo", {}, fetcher, { ttlSeconds: 3600 });
      expect(r.source).toBe("cache");
      expect((r.value as { clicks: number }).clicks).toBe(9);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it("calls fetcher and writes back when no cache entry exists", async () => {
      mockSend.mockResolvedValueOnce({}); // empty get
      mockSend.mockResolvedValueOnce({}); // put
      const { readThrough } = await import("@/lib/gsc-cache");
      const fetcher = vi.fn().mockResolvedValue({ clicks: 50 });
      const r = await readThrough("seo", {}, fetcher);
      expect(r.source).toBe("live");
      expect((r.value as { clicks: number }).clicks).toBe(50);
      expect(fetcher).toHaveBeenCalledTimes(1);
      // The put should have been issued via send (2 calls total).
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("calls fetcher when entry is stale", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          storedAt: { S: new Date(Date.now() - 7200_000).toISOString() },
          payload: { S: JSON.stringify({ clicks: 1 }) },
        },
      });
      mockSend.mockResolvedValueOnce({}); // put
      const { readThrough } = await import("@/lib/gsc-cache");
      const fetcher = vi.fn().mockResolvedValue({ clicks: 2 });
      const r = await readThrough("seo", {}, fetcher, { ttlSeconds: 3600 });
      expect(r.source).toBe("live");
      expect((r.value as { clicks: number }).clicks).toBe(2);
    });

    it("falls back to stale cache when fetcher throws and stale is within window", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          storedAt: { S: new Date(Date.now() - 7200_000).toISOString() },
          payload: { S: JSON.stringify({ clicks: 5 }) },
        },
      });
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
      mockSend.mockResolvedValueOnce({}); // empty get
      const { readThrough } = await import("@/lib/gsc-cache");
      const fetcher = vi.fn().mockRejectedValue(new Error("quota"));
      await expect(readThrough("seo", {}, fetcher)).rejects.toThrow("quota");
    });

    it("re-throws when stale cache is past acceptStaleSeconds", async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          storedAt: { S: new Date(Date.now() - 7 * 24 * 3600_000).toISOString() },
          payload: { S: JSON.stringify({ clicks: 5 }) },
        },
      });
      const { readThrough } = await import("@/lib/gsc-cache");
      const fetcher = vi.fn().mockRejectedValue(new Error("quota"));
      await expect(
        readThrough("seo", {}, fetcher, { ttlSeconds: 3600, acceptStaleSeconds: 24 * 3600 })
      ).rejects.toThrow("quota");
    });
  });
});
