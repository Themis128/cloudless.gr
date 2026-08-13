import { describe, it, expect } from "vitest";
import {
  INSIGHT_DOMAINS,
  INSIGHTS_INDEX_KEY,
  insightObjectKey,
  isInsightDomain,
  INSIGHT_SECTION_MAP,
} from "@/lib/datalake-insights";

describe("datalake-insights contract", () => {
  it("lists expected domains", () => {
    expect(INSIGHT_DOMAINS).toContain("seo");
    expect(INSIGHT_DOMAINS).toContain("revenue");
    expect(INSIGHT_DOMAINS).toContain("orchestration");
    expect(INSIGHT_DOMAINS).toContain("executive");
  });

  it("builds object keys under lake/snapshots/insights", () => {
    expect(insightObjectKey("seo")).toBe("lake/snapshots/insights/seo.json");
    expect(INSIGHTS_INDEX_KEY).toBe("lake/snapshots/insights/insights-index.json");
  });

  it("validates domain names", () => {
    expect(isInsightDomain("seo")).toBe(true);
    expect(isInsightDomain("nope")).toBe(false);
  });

  it("maps domains to gold sections", () => {
    expect(INSIGHT_SECTION_MAP.revenue).toContain("stripe_revenue");
    expect(INSIGHT_SECTION_MAP.seo).toContain("top_keywords");
  });
});
