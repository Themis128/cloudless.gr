import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AuthDatabase } from "@/lib/auth-d1";

function createAnalyticsAuthDb(rows: Array<Record<string, unknown>>): AuthDatabase {
  return {
    prepare(query: string) {
      const binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds.push(...args);
          return stmt;
        },
        async run() {
          return { success: true, meta: { changes: 0 } };
        },
        async all<T = Record<string, unknown>>() {
          if (!query.includes("FROM stripe_transaction")) {
            return { results: [] as T[], success: true };
          }
          const startDay = String(binds[0] ?? "");
          const endDay = String(binds[1] ?? "");
          const filtered = rows.filter((row) => {
            const day = String(row.event_day ?? "");
            return day >= startDay && day <= endDay;
          });
          return { results: filtered as T[], success: true };
        },
        async first() {
          return null;
        },
      };
      return stmt;
    },
  };
}

describe("getStripeAnalyticsSnapshot()", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  });

  afterEach(() => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
  });

  it("throws when AUTH_DB is unbound", async () => {
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    await expect(getStripeAnalyticsSnapshot()).rejects.toThrow("AUTH_DB is not configured");
  });

  it("returns an empty snapshot when D1 returns no rows", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = createAnalyticsAuthDb([]);
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(7);
    expect(result.totals.events).toBe(0);
    expect(result.totals.revenueMinor).toBe(0);
    expect(result.windowDays).toBe(7);
    expect(result.dailyTrend).toHaveLength(7);
  });

  it("aggregates totals correctly from D1 rows", async () => {
    const today = new Date().toISOString().slice(0, 10);
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = createAnalyticsAuthDb([
      {
        event_day: today,
        tag_category: "checkout",
        processing_status: "processed",
        currency: "eur",
        amount_minor: 1000,
        received_at: Date.now(),
        payload_json: null,
      },
      {
        event_day: today,
        tag_category: "checkout",
        processing_status: "processed",
        currency: "eur",
        amount_minor: 2000,
        received_at: Date.now(),
        payload_json: null,
      },
      {
        event_day: today,
        tag_category: "checkout",
        processing_status: "handler_failed",
        currency: "eur",
        amount_minor: 500,
        received_at: Date.now(),
        payload_json: null,
      },
    ]);
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.totals.events).toBe(3);
    expect(result.totals.revenueMinor).toBe(3500);
    expect(result.totals.processed).toBe(2);
    expect(result.totals.failed).toBe(1);
  });

  it("groups events by category", async () => {
    const today = new Date().toISOString().slice(0, 10);
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = createAnalyticsAuthDb([
      {
        event_day: today,
        tag_category: "checkout",
        processing_status: "processed",
        currency: "eur",
        amount_minor: 1000,
        received_at: Date.now(),
        payload_json: null,
      },
      {
        event_day: today,
        tag_category: "subscription",
        processing_status: "processed",
        currency: "eur",
        amount_minor: 2000,
        received_at: Date.now(),
        payload_json: null,
      },
      {
        event_day: today,
        tag_category: "checkout",
        processing_status: "processed",
        currency: "eur",
        amount_minor: 500,
        received_at: Date.now(),
        payload_json: null,
      },
    ]);
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.byCategory.checkout.events).toBe(2);
    expect(result.byCategory.checkout.revenueMinor).toBe(1500);
    expect(result.byCategory.subscription.events).toBe(1);
    expect(result.byCategory.subscription.revenueMinor).toBe(2000);
  });

  it("groups events by status", async () => {
    const today = new Date().toISOString().slice(0, 10);
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = createAnalyticsAuthDb([
      {
        event_day: today,
        tag_category: "checkout",
        processing_status: "processed",
        currency: "eur",
        amount_minor: 0,
        received_at: Date.now(),
        payload_json: null,
      },
      {
        event_day: today,
        tag_category: "checkout",
        processing_status: "processed",
        currency: "eur",
        amount_minor: 0,
        received_at: Date.now(),
        payload_json: null,
      },
      {
        event_day: today,
        tag_category: "checkout",
        processing_status: "handler_failed",
        currency: "eur",
        amount_minor: 0,
        received_at: Date.now(),
        payload_json: null,
      },
    ]);
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.byStatus.processed).toBe(2);
    expect(result.byStatus.handler_failed).toBe(1);
  });

  it("groups events by currency", async () => {
    const today = new Date().toISOString().slice(0, 10);
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = createAnalyticsAuthDb([
      {
        event_day: today,
        tag_category: "checkout",
        processing_status: "processed",
        currency: "eur",
        amount_minor: 1000,
        received_at: Date.now(),
        payload_json: null,
      },
      {
        event_day: today,
        tag_category: "checkout",
        processing_status: "processed",
        currency: "usd",
        amount_minor: 2000,
        received_at: Date.now(),
        payload_json: null,
      },
    ]);
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.byCurrency.eur).toBe(1000);
    expect(result.byCurrency.usd).toBe(2000);
  });

  it("clamps days to [1, 365]", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = createAnalyticsAuthDb([]);
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");

    const resultMin = await getStripeAnalyticsSnapshot(0);
    expect(resultMin.windowDays).toBe(1);
    expect(resultMin.dailyTrend).toHaveLength(1);

    const resultMax = await getStripeAnalyticsSnapshot(1000);
    expect(resultMax.windowDays).toBe(365);
    expect(resultMax.dailyTrend).toHaveLength(365);
  });

  it("derives amount/currency from payload_json when columns are null", async () => {
    const today = new Date().toISOString().slice(0, 10);
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = createAnalyticsAuthDb([
      {
        event_day: today,
        tag_category: "subscription",
        processing_status: "handler_failed",
        currency: null,
        amount_minor: null,
        received_at: Date.now(),
        payload_json: JSON.stringify({ amount_total: 2500, currency: "usd" }),
      },
    ]);
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.totals.events).toBe(1);
    expect(result.totals.revenueMinor).toBe(2500);
    expect(result.byCurrency.usd).toBe(2500);
  });

  it("handles rows with unknown category defaulting to 'other'", async () => {
    const today = new Date().toISOString().slice(0, 10);
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = createAnalyticsAuthDb([
      {
        event_day: today,
        tag_category: null,
        processing_status: "processed",
        currency: "eur",
        amount_minor: 1000,
        received_at: Date.now(),
        payload_json: null,
      },
    ]);
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);
    expect(result.byCategory.other).toBeDefined();
    expect(result.byCategory.other.events).toBe(1);
  });

  it("includes generatedAt as an ISO timestamp string", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = createAnalyticsAuthDb([]);
    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(7);
    expect(typeof result.generatedAt).toBe("string");
    expect(new Date(result.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("aggregates mixed D1 rows with payload fallback", async () => {
    const today = new Date().toISOString().slice(0, 10);
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = createAnalyticsAuthDb([
      {
        event_day: today,
        tag_category: "checkout",
        processing_status: "processed",
        currency: "eur",
        amount_minor: 1500,
        received_at: Date.now(),
        payload_json: null,
      },
      {
        event_day: today,
        tag_category: "subscription",
        processing_status: "handler_failed",
        currency: "usd",
        amount_minor: null,
        received_at: Date.now(),
        payload_json: JSON.stringify({ amount_total: 2500, currency: "usd" }),
      },
    ]);

    const { getStripeAnalyticsSnapshot } = await import("@/lib/stripe-analytics-read");
    const result = await getStripeAnalyticsSnapshot(1);

    expect(result.totals.events).toBe(2);
    expect(result.totals.revenueMinor).toBe(4000);
    expect(result.totals.processed).toBe(1);
    expect(result.totals.failed).toBe(1);
    expect(result.byCategory.checkout.revenueMinor).toBe(1500);
    expect(result.byCategory.subscription.revenueMinor).toBe(2500);
    expect(result.byCurrency.eur).toBe(1500);
    expect(result.byCurrency.usd).toBe(2500);
  });
});
