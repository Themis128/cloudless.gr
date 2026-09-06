import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/r2-client", () => ({
  getDataLakeBucketFromEnv: vi.fn().mockReturnValue(null),
}));

import { assertInsightDomain, pipelineFromEspocrmGold } from "@/lib/datalake-serve";

describe("assertInsightDomain", () => {
  it("returns the domain when valid", () => {
    const result = assertInsightDomain("seo");
    expect(result).toBe("seo");
  });

  it("returns null for invalid domain", () => {
    expect(assertInsightDomain("totally-fake-domain")).toBeNull();
  });
});

describe("pipelineFromEspocrmGold", () => {
  it("returns zeroed result for empty rows", () => {
    const result = pipelineFromEspocrmGold([]);
    expect(result.totalDeals).toBe(0);
    expect(result.totalValue).toBe(0);
    expect(result.byStage).toEqual({});
  });

  it("aggregates rows correctly", () => {
    const rows = [
      { lead_source: "organic", closed_won_deals: 2, closed_won_revenue: 1000, contact_count: 5 },
      { lead_source: "paid", closed_won_deals: 1, closed_won_revenue: 500, contact_count: 3 },
    ];
    const result = pipelineFromEspocrmGold(rows);
    expect(result.totalDeals).toBe(3);
    expect(result.totalValue).toBe(1500);
    expect(Object.keys(result.byStage)).toContain("organic");
    expect(Object.keys(result.byStage)).toContain("paid");
  });
});
