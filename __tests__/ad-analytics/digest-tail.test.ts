// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";

import {
  renderConversionBlocks,
  renderDigest,
  renderAnomalyBlocks,
} from "@/lib/ad-analytics/digest";
import type { AdMetrics } from "@/lib/ad-analytics/types";
import type { AnomalyFinding } from "@/lib/ad-analytics/anomaly";

const text = (blocks: Array<{ type: string; text?: string }>) =>
  blocks.map((b) => b.text ?? "").join("\n");

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ESPOCRM_BASE_URL;
});

describe("renderConversionBlocks edges", () => {
  it("skips CAPI line + customer when absent; no flag/url/creative", () => {
    const blocks = renderConversionBlocks({
      campaign: "c1",
      tier: null,
      orderId: null,
      conversionId: null,
    });
    const t = text(blocks);
    expect(t).toContain("*CAPI:* ⏭️ skipped");
    expect(t).not.toContain("👤");
    expect(t).not.toContain("*Creative:*");
    expect(t).not.toContain("*Page:*");
    expect(t).toContain("*Tier:* `—`");
    expect(t).toContain("*Order:* `—`");
  });

  it("renders CAPI accepted/rejected details, customer fields, email order link, flag + utm creative", () => {
    process.env.NEXT_PUBLIC_ESPOCRM_BASE_URL = "https://crm.example/";
    const blocks = renderConversionBlocks(
      {
        campaign: "c1",
        tier: "pro",
        orderId: "o-9",
        conversionId: null,
        country: "ZZ",
        url: "https://cloudless.gr/x",
        customer: { name: "N*a<m>e", email: "e@x.gr", phone: "+30" },
        utm: { content: "hero_v2", source: "li", medium: "cpc", campaign: "fall" },
      },
      [
        { platform: "linkedin", accepted: true, status: 201 },
        { platform: "meta", accepted: false, status: 400, message: "bad pixel" },
      ]
    );
    const t = text(blocks);
    expect(t).toContain("*CAPI linkedin:* ✅ 201");
    expect(t).toContain("*CAPI meta:* ❌ 400 — bad pixel");
    expect(t).toContain("👤 *N*a&lt;m&gt;e*  ·  e@x.gr  ·  +30");
    expect(t).toContain("https://crm.example/#Contact/list/&search=e%40x.gr");
    expect(t).toContain("ZZ");
    expect(t).toContain("*Creative:* *hero_v2* (li / cpc) · fall");
    expect(t).toContain("*Page:* <https://cloudless.gr/x|");

    // customer with no fields → no 👤 line
    const b2 = renderConversionBlocks({
      campaign: "c",
      tier: null,
      orderId: null,
      conversionId: null,
      customer: {},
    });
    expect(text(b2)).not.toContain("👤");
  });
});

describe("renderDigest edges", () => {
  const base: AdMetrics = {
    platform: "linkedin",
    campaignId: "c1",
    windowStart: "t0",
    windowEnd: "t1",
    impressions: 100,
    clicks: 5,
    conversions: 1,
    spendEur: 10,
    ctr: 0.05,
    cpcEur: 2,
    cpaEur: 10,
  };

  it("renders 'By ad set' when >1 non-empty breakdown rows", () => {
    const blocks = renderDigest({
      campaignSlug: "s",
      current: {
        ...base,
        campaignBreakdown: [
          { campaignId: "a", impressions: 60, clicks: 3, spendEur: 6 },
          { campaignId: "b", impressions: 40, clicks: 2, spendEur: 4 },
          { campaignId: "empty", impressions: 0, clicks: 0, spendEur: 0 },
        ],
      },
    });
    const t = text(blocks);
    expect(t).toContain("*By ad set:*");
    expect(t).toContain("• a — 60 imp · 3 clicks · €6.00");
    expect(t).not.toContain("empty");
  });

  it("pacing: credit exhausted branch", () => {
    const blocks = renderDigest({
      campaignSlug: "s",
      current: { ...base, lifetimeSpendEur: 150 },
      pacing: {
        creditEur: 100,
        lifetimeBudgetEur: 200,
        adsStartAt: new Date(Date.now() - 86400000).toISOString(),
        adsEndAt: "2026-12-31",
      },
    });
    expect(text(blocks)).toContain("CREDIT EXHAUSTED");
  });

  it("pacing: under-credit + under-cap → 'credit lasts ~Nd'", () => {
    const blocks = renderDigest({
      campaignSlug: "s",
      current: { ...base, lifetimeSpendEur: 5 },
      pacing: {
        creditEur: 1000,
        lifetimeBudgetEur: 10000,
        adsStartAt: new Date(Date.now() - 86400000).toISOString(),
        adsEndAt: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
      },
    });
    expect(text(blocks)).toContain("credit lasts ~");
  });

  it("delta signs on spend + negative click delta", () => {
    const blocks = renderDigest({
      campaignSlug: "s",
      current: base,
      previous: { ...base, spendEur: 12, clicks: 8 },
    });
    const t = text(blocks);
    expect(t).toContain("€10.00 (€-2.00)");
    expect(t).toContain("*Clicks:* 5 (-3)");
    expect(t).toContain("*Impressions:* 100");
  });
});

describe("renderAnomalyBlocks", () => {
  const finding = (over: Partial<AnomalyFinding> = {}): AnomalyFinding => ({
    rule: "cpc_spike",
    severity: "warning",
    message: "msg",
    detail: { metric: "cpcEur", observed: 4, threshold: 2, baseline: 1 },
    ...over,
  });

  it("empty → []", () => {
    expect(
      renderAnomalyBlocks({ campaignSlug: "s", platform: "linkedin", findings: [] })
    ).toEqual([]);
  });

  it("single finding: header count, warning dot, baseline line, euro metric", () => {
    const blocks = renderAnomalyBlocks({
      campaignSlug: "shop",
      platform: "linkedin",
      findings: [finding()],
    });
    expect(blocks[0].text).toContain("1 anomaly on shop (linkedin)");
    expect(blocks[1].text).toContain("🟡 *cpc spike*");
    expect(blocks[1].text).toContain("observed €4.00 · threshold €2.00 · baseline €1.00");
    expect(blocks.at(-1)!.type).toBe("context");
  });

  it("critical dot, ctr metric formatting, no baseline, multi count", () => {
    const blocks = renderAnomalyBlocks({
      campaignSlug: "s",
      platform: "x",
      findings: [
        finding({
          rule: "ctr_floor",
          severity: "critical",
          detail: { metric: "ctr", observed: 0.001, threshold: 0.003 },
        }),
        finding({
          rule: "zero_conversions",
          severity: "critical",
          detail: { metric: "conversions", observed: 0, threshold: 1 },
        }),
      ],
    });
    expect(blocks[0].text).toContain("2 anomalies");
    expect(blocks[1].text).toContain("🔴 *ctr floor*");
    expect(blocks[1].text).toContain("observed 0.10% · threshold 0.30%");
    expect(blocks[2].text).toContain("observed 0 · threshold 1");
  });
});
