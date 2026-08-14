import { describe, expect, it } from "vitest";
import { pipelineFromEspocrmGold } from "@/lib/datalake-serve";

describe("pipelineFromEspocrmGold", () => {
  it("maps lead-source funnel rows into Unified pipeline cards", () => {
    const out = pipelineFromEspocrmGold([
      {
        lifecycle_stage: "contact",
        lead_source: "LinkedIn",
        contact_count: 10,
        closed_won_deals: 2,
        closed_won_revenue: 4000,
      },
      {
        lifecycle_stage: "contact",
        lead_source: "Direct",
        contact_count: 4,
        closed_won_deals: 0,
        closed_won_revenue: 0,
      },
    ]);
    expect(out.totalDeals).toBe(2);
    expect(out.totalValue).toBe(4000);
    expect(out.byStage.LinkedIn).toEqual({ count: 2, value: 4000 });
    expect(out.byStage.Direct).toEqual({ count: 4, value: 0 });
  });

  it("falls back to contact counts when no closed-won deals exist", () => {
    const out = pipelineFromEspocrmGold([
      { lead_source: "Organic", contact_count: 7, closed_won_deals: 0, closed_won_revenue: 0 },
    ]);
    expect(out.totalDeals).toBe(7);
    expect(out.byStage.Organic.count).toBe(7);
  });
});
