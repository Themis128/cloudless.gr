import { describe, expect, it } from "vitest";
import {
  FUNNEL_VARIANT_NONE,
  buildFunnelAbCompare,
  formatFunnelRate,
  variantLabel,
} from "@/lib/funnel-ab-compare";

describe("variantLabel", () => {
  it("maps empty/null to (none)", () => {
    expect(variantLabel(null)).toBe(FUNNEL_VARIANT_NONE);
    expect(variantLabel("")).toBe(FUNNEL_VARIANT_NONE);
    expect(variantLabel("  ")).toBe(FUNNEL_VARIANT_NONE);
    expect(variantLabel("a")).toBe("a");
  });
});

describe("buildFunnelAbCompare", () => {
  it("pivots counts and computes conversion rates per variant", () => {
    const compare = buildFunnelAbCompare([
      { event_type: "rec_impression", ab_variant: "a", count: 100 },
      { event_type: "rec_click", ab_variant: "a", count: 10 },
      { event_type: "rec_impression", ab_variant: "b", count: 80 },
      { event_type: "rec_click", ab_variant: "b", count: 16 },
      { event_type: "search_query", ab_variant: null, count: 5 },
    ]);

    expect(compare.variants).toEqual(["a", "b", FUNNEL_VARIANT_NONE]);
    expect(compare.eventTypes).toEqual(["search_query", "rec_impression", "rec_click"]);
    expect(compare.counts.rec_impression?.a).toBe(100);
    expect(compare.counts.rec_click?.b).toBe(16);

    const recRate = compare.rates.find((r) => r.from === "rec_impression" && r.to === "rec_click");
    expect(recRate?.byVariant.a).toBeCloseTo(0.1);
    expect(recRate?.byVariant.b).toBeCloseTo(0.2);
    expect(recRate?.byVariant[FUNNEL_VARIANT_NONE]).toBeNull();
  });

  it("sums duplicate event×variant rows", () => {
    const compare = buildFunnelAbCompare([
      { event_type: "search_click", ab_variant: "a", count: 3 },
      { event_type: "search_click", ab_variant: "a", count: 2 },
    ]);
    expect(compare.counts.search_click?.a).toBe(5);
  });
});

describe("formatFunnelRate", () => {
  it("formats percent or em dash", () => {
    expect(formatFunnelRate(0.1234)).toBe("12.3%");
    expect(formatFunnelRate(null)).toBe("—");
  });
});
