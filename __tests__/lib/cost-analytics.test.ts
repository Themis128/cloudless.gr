import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: vi.fn(() => null),
}));

vi.mock("@/lib/r2-client", () => ({
  getDataLakeBucketFromEnv: vi.fn().mockReturnValue(null),
}));

import {
  getCostSummary,
  getTopServicesByCost,
  getDailyCostTrend,
  getTotal30d,
  getYesterdayCost,
  getLastEtlAt,
} from "@/lib/cost-analytics";

describe("getCostSummary (no D1/R2)", () => {
  it("returns a CostSummary with zero totals", async () => {
    const summary = await getCostSummary();
    expect(summary.total_30d).toBe(0);
    expect(summary.yesterday).toBe(0);
    expect(summary.topServices).toEqual([]);
    expect(summary.lastEtlAt).toBeNull();
  });

  it("returns 30 daily trend entries with zero costs", async () => {
    const summary = await getCostSummary();
    expect(summary.dailyTrend).toHaveLength(30);
    for (const row of summary.dailyTrend) {
      expect(typeof row.cost_date).toBe("string");
      expect(row.total_usd).toBe(0);
    }
  });
});

describe("getTopServicesByCost", () => {
  it("returns empty array when no data", async () => {
    const result = await getTopServicesByCost();
    expect(result).toEqual([]);
  });
});

describe("getDailyCostTrend", () => {
  it("returns 30 zero-filled days", async () => {
    const trend = await getDailyCostTrend();
    expect(trend).toHaveLength(30);
    expect(trend.every((r) => r.total_usd === 0)).toBe(true);
  });
});

describe("getTotal30d", () => {
  it("returns 0 when no data", async () => {
    expect(await getTotal30d()).toBe(0);
  });
});

describe("getYesterdayCost", () => {
  it("returns 0 when no data", async () => {
    expect(await getYesterdayCost()).toBe(0);
  });
});

describe("getLastEtlAt", () => {
  it("returns null when no data", async () => {
    expect(await getLastEtlAt()).toBeNull();
  });
});
