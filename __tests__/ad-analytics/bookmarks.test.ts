// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { bookmarkKeyOf, getBookmarkStore, _resetBookmarkStore } from "@/lib/ad-analytics/bookmarks";
import type { AdMetrics } from "@/lib/ad-analytics/types";

beforeEach(() => {
  delete process.env.AD_ANALYTICS_BOOKMARKS_TABLE;
  _resetBookmarkStore();
});

afterEach(() => {
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

describe("InMemoryBookmarkStore (fallback when AD_ANALYTICS_BOOKMARKS_TABLE is unset)", () => {
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
