import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AuthDatabase } from "@/lib/auth-d1";

function makeDb(rows: Array<Record<string, unknown>>): AuthDatabase {
  return {
    prepare() {
      const stmt = {
        bind() {
          return stmt;
        },
        async run() {
          return { success: true, meta: { changes: 0 } };
        },
        async all<T = Record<string, unknown>>() {
          return { results: rows as T[], success: true };
        },
        async first() {
          return null;
        },
      };
      return stmt;
    },
  };
}

describe("getCostSummary Cloudflare-first", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    delete (globalThis as { __DATALAKE_BUCKET__?: unknown }).__DATALAKE_BUCKET__;
  });

  afterEach(() => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    delete (globalThis as { __DATALAKE_BUCKET__?: unknown }).__DATALAKE_BUCKET__;
  });

  it("aggregates from D1 aws_cost_daily when AUTH_DB is bound", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = makeDb([
      {
        cost_date: today,
        service: "AmazonCloudFront",
        amount_usd: 1.25,
        currency: "USD",
        synced_at: 1_700_000_000_000,
      },
      {
        cost_date: yesterday,
        service: "AmazonCloudFront",
        amount_usd: 2.5,
        currency: "USD",
        synced_at: 1_700_000_000_000,
      },
      {
        cost_date: yesterday,
        service: "AWSLambda",
        amount_usd: 0.4,
        currency: "USD",
        synced_at: 1_700_000_000_000,
      },
    ]);

    const { getCostSummary } = await import("@/lib/cost-analytics");
    const summary = await getCostSummary();
    expect(summary.total_30d).toBe(4.15);
    expect(summary.yesterday).toBe(2.9);
    expect(summary.topServices[0].service).toBe("AmazonCloudFront");
    expect(summary.lastEtlAt).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it("falls back to R2 cost.json when D1 has no rows", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = makeDb([]);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    (globalThis as {
      __DATALAKE_BUCKET__?: { get: (key: string) => Promise<unknown> };
    }).__DATALAKE_BUCKET__ = {
      get: async (key: string) => {
        if (key !== "lake/aws-cost/cost.json") return null;
        return {
          uploaded: new Date("2026-07-29T12:00:00.000Z"),
          text: async () =>
            JSON.stringify({
              generated_at: "2026-07-29T12:00:00.000Z",
              rows: [
                {
                  cost_date: yesterday,
                  service: "AmazonS3",
                  amount_usd: 3.1,
                  currency: "USD",
                },
              ],
            }),
        };
      },
    };

    const { getCostSummary } = await import("@/lib/cost-analytics");
    const summary = await getCostSummary();
    expect(summary.yesterday).toBe(3.1);
    expect(summary.topServices[0].service).toBe("AmazonS3");
    expect(summary.lastEtlAt).toBe("2026-07-29T12:00:00.000Z");
  });
});
