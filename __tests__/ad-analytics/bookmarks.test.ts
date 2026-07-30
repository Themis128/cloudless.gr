// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { bookmarkKeyOf, getBookmarkStore, _resetBookmarkStore } from "@/lib/ad-analytics/bookmarks";
import type { AdMetrics } from "@/lib/ad-analytics/types";
import type { AuthDatabase } from "@/lib/auth-d1";

beforeEach(() => {
  delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  _resetBookmarkStore();
});

afterEach(() => {
  delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  _resetBookmarkStore();
});

function snapshot(over: Partial<AdMetrics> = {}): AdMetrics {
  return {
    platform: "linkedin",
    campaignId: "692134846",
    windowStart: "2026-06-19T08:00:00.000Z",
    windowEnd: "2026-06-19T09:00:00.000Z",
    impressions: 386,
    clicks: 2,
    conversions: 0,
    spendEur: 15.57,
    ...over,
  };
}

function createBookmarkDb(): AuthDatabase & {
  rows: Map<string, { pk: string; last_posted_at: string; snapshot_json: string; updated_at: number }>;
} {
  const rows = new Map<
    string,
    { pk: string; last_posted_at: string; snapshot_json: string; updated_at: number }
  >();
  return {
    rows,
    prepare(query: string) {
      const binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds.push(...args);
          return stmt;
        },
        async run() {
          if (query.includes("INSERT OR REPLACE INTO ad_analytics_bookmark")) {
            const [pk, last_posted_at, snapshot_json, updated_at] = binds as [
              string,
              string,
              string,
              number,
            ];
            rows.set(pk, { pk, last_posted_at, snapshot_json, updated_at });
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 0 } };
        },
        async all() {
          return { results: [], success: true };
        },
        async first<T = Record<string, unknown>>() {
          if (query.includes("FROM ad_analytics_bookmark")) {
            return (rows.get(String(binds[0])) as T) ?? null;
          }
          return null;
        },
      };
      return stmt;
    },
  };
}

describe("bookmarkKeyOf", () => {
  it("composes a stable string key from the tuple", () => {
    expect(
      bookmarkKeyOf({
        campaignSlug: "shop-online",
        platform: "linkedin",
        metric: "headline",
        window: "60m",
      })
    ).toBe("ad-analytics:shop-online:linkedin:headline:60m");
  });
});

describe("InMemoryBookmarkStore (fallback when AUTH_DB is unbound)", () => {
  it("returns null when the key has never been written", async () => {
    const store = getBookmarkStore();
    const got = await store.getBookmark("ad-analytics:test:linkedin:headline:60m");
    expect(got).toBeNull();
  });

  it("round-trips a snapshot through put → get", async () => {
    const store = getBookmarkStore();
    const key = "ad-analytics:test:linkedin:headline:60m";
    await store.putBookmark(key, snapshot());
    const got = await store.getBookmark(key);
    expect(got?.key).toBe(key);
    expect(got?.snapshot.impressions).toBe(386);
    expect(typeof got?.lastPostedAt).toBe("string");
  });

  it("does NOT leak state across `_resetBookmarkStore()`", async () => {
    const a = getBookmarkStore();
    await a.putBookmark("k1", snapshot());
    _resetBookmarkStore();
    const b = getBookmarkStore();
    const got = await b.getBookmark("k1");
    expect(got).toBeNull();
  });
});

describe("D1BookmarkStore (when AUTH_DB is bound)", () => {
  it("round-trips a snapshot through D1", async () => {
    const db = createBookmarkDb();
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = db;
    _resetBookmarkStore();
    const store = getBookmarkStore();
    const key = "ad-analytics:d1:linkedin:headline:60m";
    await store.putBookmark(key, snapshot({ impressions: 100 }));
    const got = await store.getBookmark(key);
    expect(got?.snapshot.impressions).toBe(100);
    expect(db.rows.has(key)).toBe(true);
  });
});
