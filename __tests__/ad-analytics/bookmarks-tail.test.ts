// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const libs = vi.hoisted(() => ({
  db: null as unknown,
  allowWrite: vi.fn(() => true),
}));
vi.mock("@/lib/auth-d1", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-d1")>();
  return { ...actual, getAuthDbFromEnv: () => libs.db };
});
vi.mock("@/lib/d1-write-budget", () => ({
  allowDiscretionaryD1Write: (n: number) => libs.allowWrite(n),
}));

import { getBookmarkStore, _resetBookmarkStore } from "@/lib/ad-analytics/bookmarks";
import type { AdMetrics } from "@/lib/ad-analytics/types";

const snap: AdMetrics = {
  platform: "linkedin",
  campaignId: "c",
  windowStart: "a",
  windowEnd: "b",
  impressions: 1,
  clicks: 0,
  conversions: 0,
  spendEur: 0,
};

const dbWith = (firstResult: unknown, runThrows = false, firstThrows = false) => ({
  prepare: vi.fn(() => ({
    bind: () => ({
      first: async () => {
        if (firstThrows) throw new Error("d1 read fail");
        return firstResult;
      },
      run: async () => {
        if (runThrows) throw new Error("d1 write fail");
      },
    }),
  })),
});

beforeEach(() => _resetBookmarkStore());
afterEach(() => {
  libs.db = null;
  _resetBookmarkStore();
});

describe("D1BookmarkStore edge paths", () => {
  it("row with missing fields → null (reseed)", async () => {
    libs.db = dbWith({ pk: "k", last_posted_at: null, snapshot_json: "{}" });
    expect(await getBookmarkStore().getBookmark("k")).toBeNull();
    libs.db = dbWith({ pk: "k", last_posted_at: "t", snapshot_json: null });
    _resetBookmarkStore();
    expect(await getBookmarkStore().getBookmark("k")).toBeNull();
  });

  it("corrupt snapshot_json → null", async () => {
    libs.db = dbWith({ pk: "k", last_posted_at: "t", snapshot_json: "{bad" });
    expect(await getBookmarkStore().getBookmark("k")).toBeNull();
  });

  it("D1 read throw → null", async () => {
    libs.db = dbWith(null, false, true);
    expect(await getBookmarkStore().getBookmark("k")).toBeNull();
  });

  it("write budget denied → no-op; D1 write throw → tolerated", async () => {
    libs.allowWrite.mockReturnValueOnce(false);
    libs.db = dbWith(null);
    await getBookmarkStore().putBookmark("k", snap);
    expect(libs.db.prepare).not.toHaveBeenCalled();

    libs.db = dbWith(null, true);
    _resetBookmarkStore();
    libs.db = dbWith(null, true);
    await expect(getBookmarkStore().putBookmark("k", snap)).resolves.toBeUndefined();
  });

  it("round-trips a valid row", async () => {
    libs.db = dbWith({
      pk: "k",
      last_posted_at: "2026-01-01",
      snapshot_json: JSON.stringify(snap),
    });
    const bm = await getBookmarkStore().getBookmark("k");
    expect(bm).toEqual({ key: "k", lastPostedAt: "2026-01-01", snapshot: snap });
  });
});
