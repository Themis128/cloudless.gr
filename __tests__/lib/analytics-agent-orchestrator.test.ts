import { describe, it, expect } from "vitest";
import { preprocessStripeAnalyticsSnapshot } from "@/lib/analytics-agent-orchestrator";
import type { StripeAnalyticsSnapshot } from "@/lib/stripe-analytics-read";

function makeEmptySnapshot(windowDays = 7): StripeAnalyticsSnapshot {
  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    totals: { events: 0, processed: 0, failed: 0, revenueMinor: 0, currencies: [] },
    dailyTrend: [],
    byCategory: {},
    byCurrency: {},
  };
}

describe("preprocessStripeAnalyticsSnapshot", () => {
  it("returns hasData=false for an empty snapshot", () => {
    const result = preprocessStripeAnalyticsSnapshot(makeEmptySnapshot());
    expect(result.hasData).toBe(false);
    expect(result.windowDays).toBe(7);
    expect(result.failureRatePct).toBe(0);
  });

  it("returns hasData=true when events > 0", () => {
    const snap = makeEmptySnapshot();
    snap.totals.events = 10;
    snap.totals.processed = 8;
    snap.totals.revenueMinor = 5000;
    snap.dailyTrend = [{ day: "2026-09-01", revenueMinor: 5000, events: 10, processed: 8, failed: 2 }];
    (snap as Record<string, unknown>).byCurrency = {};
    const result = preprocessStripeAnalyticsSnapshot(snap);
    expect(result.hasData).toBe(true);
    expect(typeof result.failureRatePct).toBe("number");
  });
});
