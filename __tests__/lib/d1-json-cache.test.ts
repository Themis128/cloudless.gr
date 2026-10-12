/**
 * d1-json-cache.ts — D1-backed read-through cache: no-db no-ops,
 * hit/miss/stale behavior, budget gate, error soft-fails.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = { prepare: vi.fn(), run: vi.fn() };
let dbInstance: unknown = mockDb;
const mockBudget = vi.fn().mockReturnValue(true);

vi.mock("@/lib/auth-d1", () => ({ getAuthDbFromEnv: () => dbInstance }));
vi.mock("@/lib/d1-write-budget", () => ({ allowDiscretionaryD1Write: (...a: unknown[]) => mockBudget(...a) }));

import { getCachedFromTable, setCachedToTable, readThroughTable } from "@/lib/d1-json-cache";

const now = Math.floor(Date.now() / 1000);

function rowFor(payload: unknown, cachedAt = now - 10, ttl = 3600) {
  return {
    result_json: JSON.stringify(payload),
    cached_at: cachedAt,
    expires_at: cachedAt + ttl,
  };
}

function bindRow(row: unknown) {
  mockDb.prepare.mockReturnValue({ bind: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue(row) }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbInstance = mockDb;
  mockBudget.mockReturnValue(true);
});

describe("getCachedFromTable", () => {
  it("null without db; row → entry; miss → null; throw → null", async () => {
    dbInstance = null;
    expect(await getCachedFromTable("analytics_cache", "p", "/r", {})).toBeNull();

    dbInstance = mockDb;
    bindRow(rowFor({ hits: 5 }));
    const e = await getCachedFromTable<{ hits: number }>("analytics_cache", "p", "/r", { a: 1 });
    expect(e?.payload).toEqual({ hits: 5 });
    expect(e?.stale).toBe(false);

    bindRow(null);
    expect(await getCachedFromTable("espocrm_cache", "p", "/r")).toBeNull();

    mockDb.prepare.mockImplementation(() => { throw new Error("d1 down"); });
    expect(await getCachedFromTable("espocrm_cache", "p", "/r")).toBeNull();
  });

  it("expired row → stale entry", async () => {
    bindRow(rowFor({ x: 1 }, now - 7200)); // expired
    const e = await getCachedFromTable("analytics_cache", "p", "/r", {}, 3600);
    expect(e?.stale).toBe(true);
  });
});

describe("setCachedToTable", () => {
  it("budget-denied → no db write; no db → no-op; success binds upsert; throw swallowed", async () => {
    mockBudget.mockReturnValue(false);
    await setCachedToTable("espocrm_cache", "p", "/r", {}, { v: 1 });
    expect(mockDb.prepare).not.toHaveBeenCalled();

    mockBudget.mockReturnValue(true);
    dbInstance = null;
    await setCachedToTable("espocrm_cache", "p", "/r"); // no throw

    dbInstance = mockDb;
    const bind = vi.fn().mockReturnValue({ run: vi.fn().mockResolvedValue({}) });
    mockDb.prepare.mockReturnValue({ bind });
    await setCachedToTable("analytics_cache", "p", "/r", { k: "v" }, { v: 1 }, 60);
    expect(bind).toHaveBeenCalledWith("/r", expect.any(String), '{"v":1}', expect.any(Number), expect.any(Number));

    mockDb.prepare.mockImplementation(() => { throw new Error("d1 down"); });
    await setCachedToTable("analytics_cache", "p", "/r"); // swallowed
  });
});

describe("readThroughTable", () => {
  it("cache hit → source cache, fetcher not called", async () => {
    bindRow(rowFor({ cached: true }));
    const fetcher = vi.fn();
    const r = await readThroughTable("analytics_cache", "p", "/r", {}, fetcher);
    expect(r.source).toBe("cache");
    expect(r.value).toEqual({ cached: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("miss → live fetch + async write", async () => {
    bindRow(null);
    const bind = vi.fn().mockReturnValue({ run: vi.fn().mockResolvedValue({}), first: vi.fn().mockResolvedValue(null) });
    mockDb.prepare.mockReturnValue({ bind });
    const r = await readThroughTable("analytics_cache", "p", "/r", {}, async () => ({ live: 1 }));
    expect(r.source).toBe("live");
    expect(r.value).toEqual({ live: 1 });
    await new Promise((r2) => setTimeout(r2, 0));
  });

  it("fetch fail + stale-within-window → serves stale", async () => {
    bindRow(rowFor({ old: true }, now - 7200)); // stale but within 24h accept window
    const r = await readThroughTable("analytics_cache", "p", "/r", {}, async () => {
      throw new Error("live down");
    });
    expect(r.source).toBe("stale");
    expect(r.value).toEqual({ old: true });
  });

  it("fetch fail + no cache → rethrows", async () => {
    bindRow(null);
    await expect(
      readThroughTable("analytics_cache", "p", "/r", {}, async () => { throw new Error("live down"); })
    ).rejects.toThrow("live down");
  });
});
