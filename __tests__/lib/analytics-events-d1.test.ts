/**
 * Tests for src/lib/analytics-events-d1.ts
 *
 * Covers:
 *  - getWeeklyAnalyticsRollup() — no db, success, partial (no byType), db error
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
const { mockGetDb } = vi.hoisted(() => ({ mockGetDb: vi.fn() }));
vi.mock("@/lib/auth-d1", () => ({ getAuthDbFromEnv: mockGetDb }));

import { getWeeklyAnalyticsRollup } from "@/lib/analytics-events-d1";

// ---------------------------------------------------------------------------
function makeDb(
  totalN: number | undefined,
  typeRows: { k: string; n: number }[]
) {
  const firstStmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(totalN !== undefined ? { n: totalN } : null),
  };
  const allStmt = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: typeRows }),
  };
  let callCount = 0;
  return {
    prepare: vi.fn().mockImplementation(() => {
      // First prepare call → COUNT query; second → GROUP BY query
      return callCount++ === 0 ? firstStmt : allStmt;
    }),
  };
}

beforeEach(() => {
  mockGetDb.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
describe("getWeeklyAnalyticsRollup", () => {
  it("returns bound:false when no db is available", async () => {
    mockGetDb.mockReturnValue(null);
    const result = await getWeeklyAnalyticsRollup();
    expect(result).toEqual({ bound: false, eventCount: 0, byType: {} });
  });

  it("returns correct counts from db", async () => {
    mockGetDb.mockReturnValue(
      makeDb(42, [
        { k: "page_view", n: 30 },
        { k: "contact_submit", n: 12 },
      ])
    );
    const result = await getWeeklyAnalyticsRollup(7);
    expect(result.bound).toBe(true);
    expect(result.eventCount).toBe(42);
    expect(result.byType).toEqual({ page_view: 30, contact_submit: 12 });
  });

  it("handles null total gracefully", async () => {
    mockGetDb.mockReturnValue(makeDb(undefined, []));
    const result = await getWeeklyAnalyticsRollup();
    expect(result.eventCount).toBe(0);
  });

  it("skips row with falsy key", async () => {
    mockGetDb.mockReturnValue(
      makeDb(5, [
        { k: "", n: 3 },
        { k: "blog_view", n: 5 },
      ])
    );
    const result = await getWeeklyAnalyticsRollup();
    expect(Object.keys(result.byType)).not.toContain("");
    expect(result.byType.blog_view).toBe(5);
  });

  it("returns bound:true with zero counts on db error", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockRejectedValue(new Error("D1 error")),
      }),
    };
    mockGetDb.mockReturnValue(db);
    const result = await getWeeklyAnalyticsRollup();
    expect(result.bound).toBe(true);
    expect(result.eventCount).toBe(0);
    expect(result.byType).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("weekly rollup failed"),
      "D1 error"
    );
  });

  it("uses default of 7 days", async () => {
    const db = makeDb(0, []);
    mockGetDb.mockReturnValue(db);
    const before = Math.floor(Date.now() / 1000);
    await getWeeklyAnalyticsRollup();
    const after = Math.floor(Date.now() / 1000);

    // The first bind call should pass a timestamp in the last 7 days
    const firstPrepare = (db.prepare as ReturnType<typeof vi.fn>).mock.results[0].value;
    const boundValue = firstPrepare.bind.mock.calls[0][0] as number;
    expect(boundValue).toBeGreaterThanOrEqual(before - 7 * 86400 - 1);
    expect(boundValue).toBeLessThanOrEqual(after - 7 * 86400 + 1);
  });
});
