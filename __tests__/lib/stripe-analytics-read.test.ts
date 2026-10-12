import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn().mockReturnValue(null),
}));

import { getStripeAnalyticsSnapshot } from "@/lib/stripe-analytics-read";

describe("getStripeAnalyticsSnapshot (no D1)", () => {
  it("throws when AUTH_DB is not configured", async () => {
    await expect(getStripeAnalyticsSnapshot()).rejects.toThrow("AUTH_DB is not configured");
  });
});

describe("getStripeAnalyticsSnapshot (D1 rows)", () => {
  const dbWithRows = (rows: unknown[]) => ({
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: rows }),
      }),
    }),
  });

  it("aggregates rows with payload fallbacks and corrupt payloads", async () => {
    const { getAuthDbFromEnv } = await import("@/lib/auth-d1");
    const dayMs = Date.now();
    vi.mocked(getAuthDbFromEnv).mockReturnValueOnce(
      dbWithRows([
        // no event_day → receivedAt fallback; amount+currency from payload
        {
          event_day: null,
          tag_category: "checkout",
          processing_status: "processed",
          currency: null,
          amount_minor: null,
          received_at: dayMs,
          payload_json: JSON.stringify({ amount_total: 4900, currency: "eur" }),
        },
        // corrupt payload → JSON.parse catch → no currency/amount
        {
          event_day: null,
          tag_category: "invoice",
          processing_status: "handler_failed",
          currency: "usd",
          amount_minor: 1200,
          received_at: dayMs,
          payload_json: "{broken",
        },
      ]) as never
    );
    const snap = await getStripeAnalyticsSnapshot(7);
    expect(snap.totals.events).toBe(2);
    expect(snap.totals.revenueMinor).toBe(6100);
    expect(snap.totals.processed).toBe(1);
    expect(snap.totals.failed).toBe(1);
    expect(snap.byCurrency.eur).toBe(4900);
    expect(snap.byCurrency.usd).toBe(1200);
    expect(snap.byCategory.checkout.revenueMinor).toBe(4900);
    // receivedAt-derived day lands inside the trend window
    expect(snap.dailyTrend.some((d) => d.events === 2)).toBe(true);
  });
});
