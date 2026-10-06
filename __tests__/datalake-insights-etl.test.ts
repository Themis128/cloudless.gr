/**
 * Regression tests for scripts/etl/materialize-datalake-insights.mjs.
 *
 * Bug fixed: extractMetrics emitted `<section>.rowCount` as a metric. The
 * LLM read `stripe_revenue.rowCount: 1` (one KPI row) as "1 paid order",
 * producing a Weekly Digest whose executive summary said "1 paid order"
 * while the revenue section said "paid orders: 0".
 */
import { describe, expect, it } from "vitest";

import {
  extractMetrics,
  sectionPack,
  buildPrompt,
  parseInsightJson,
  DOMAINS,
  // @ts-expect-error - untyped .mjs module
} from "../scripts/etl/materialize-datalake-insights.mjs";

const gold = {
  generated_at: "2026-10-05T22:55:46.086Z",
  sections: [
    {
      section: "stripe_revenue",
      rowCount: 1,
      rows: [{ metric: "paid_orders", value: 0, amount_eur: 0 }],
    },
    {
      section: "linkedin_ads",
      rowCount: 2,
      rows: [
        {
          ad_set_name: "Cloudless boost",
          status: "active",
          spend_eur: 50.74,
          impressions: 2564,
          clicks: 97,
        },
        { ad_set_name: "Boost Post Engagement", status: "paused", spend_eur: 19.38 },
      ],
    },
    { section: "espocrm_funnel", rowCount: 0, rows: [] },
    {
      section: "social_leads",
      rowCount: 1,
      rows: [{ dimension: "source", value: "website", leads: 13, espocrm_synced: 0 }],
    },
  ],
};

describe("extractMetrics", () => {
  it("never emits section rowCount as a metric — row counts are not business figures", () => {
    const packs = sectionPack(gold, ["stripe_revenue", "linkedin_ads"]);
    const metrics = extractMetrics(packs);
    expect(metrics.some((m: { key: string }) => m.key.endsWith(".rowCount"))).toBe(false);
    // The KPI row's real values still surface
    expect(metrics).toContainEqual({ key: "stripe_revenue.value", value: 0 });
    expect(metrics).toContainEqual({ key: "stripe_revenue.amount_eur", value: 0 });
  });

  it("emits error entries for missing/errored sections", () => {
    const packs = sectionPack(gold, ["nonexistent_section"]);
    const metrics = extractMetrics(packs);
    expect(metrics).toContainEqual({ key: "nonexistent_section.error", value: "missing from gold" });
  });
});

describe("sectionPack", () => {
  it("flags missing sections with an error pack", () => {
    const packs = sectionPack(gold, ["stripe_revenue", "missing_thing"]);
    expect(packs[1]).toEqual({ section: "missing_thing", error: "missing from gold" });
  });
});

describe("DOMAINS", () => {
  it("crm_funnel includes social_leads so empty funnel is not misread as zero leads", () => {
    const crm = DOMAINS.find((d: { domain: string }) => d.domain === "crm_funnel");
    expect(crm.sections).toContain("social_leads");
  });
});

describe("buildPrompt", () => {
  it("instructs the model not to treat row counts as business figures", () => {
    const prompt = buildPrompt("revenue", [], []);
    expect(prompt).toMatch(/NUMBER OF ROWS/i);
    expect(prompt).toMatch(/status "active"/i);
  });
});

describe("parseInsightJson", () => {
  it("parses fenced/thinking-wrapped model output", () => {
    const parsed = parseInsightJson(
      '<thinking>blah</thinking>```json\n{"summary":"s","bullets":["b"],"confidence":"high"}\n```'
    );
    expect(parsed.summary).toBe("s");
  });
});
