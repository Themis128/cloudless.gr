// @vitest-environment node
import { describe, it, expect } from "vitest";

import { renderDigest } from "@/lib/ad-analytics/digest";
import type { AdMetrics } from "@/lib/ad-analytics/types";

function baseMetrics(over: Partial<AdMetrics> = {}): AdMetrics {
  return {
    platform: "linkedin",
    campaignId: "692134846",
    windowStart: "2026-06-19T08:00:00.000Z",
    windowEnd: "2026-06-19T09:00:00.000Z",
    impressions: 386,
    clicks: 2,
    conversions: 0,
    spendEur: 15.57,
    ctr: 0.0052,
    cpcEur: 7.785,
    ...over,
  };
}

describe("renderDigest", () => {
  it("renders headline metrics without deltas on a cold start", async () => {
    const blocks = renderDigest({
      campaignSlug: "shop-online",
      current: baseMetrics(),
      previous: null,
    });
    const text = JSON.stringify(blocks);
    expect(text).toContain("shop-online");
    expect(text).toContain("386");
    expect(text).toContain("0.52%");
    expect(text).toContain("€15.57");
    // No previous bookmark ⇒ delta math suppressed.
    expect(text).not.toContain("(+");
  });

  it("renders + delta when the snapshot grew over the bookmark", async () => {
    const blocks = renderDigest({
      campaignSlug: "shop-online",
      current: baseMetrics({ impressions: 400, clicks: 3, spendEur: 18.0 }),
      previous: baseMetrics(),
    });
    const text = JSON.stringify(blocks);
    expect(text).toContain("400 (+14)"); // impressions
    expect(text).toContain("3 (+1)"); // clicks
    expect(text).toContain("€18.00 (+€2.43)"); // spend
  });

  it("renders an ICP signal block when demographic pivots are present", async () => {
    const blocks = renderDigest({
      campaignSlug: "shop-online",
      current: baseMetrics({
        demographics: {
          MEMBER_INDUSTRY: [
            { label: "IT Services", clicks: 1 },
            { label: "Marketing", clicks: 1 },
          ],
          MEMBER_SENIORITY: [
            { label: "Owner", clicks: 1 },
            { label: "Manager", clicks: 1 },
          ],
        },
      }),
    });
    const text = JSON.stringify(blocks);
    expect(text).toContain("ICP signal");
    expect(text).toContain("Industry");
    expect(text).toContain("IT Services 1");
    expect(text).toContain("Seniority");
    expect(text).toContain("Owner 1");
  });

  it("skips empty demographic pivots silently (privacy threshold)", async () => {
    const blocks = renderDigest({
      campaignSlug: "shop-online",
      current: baseMetrics({
        demographics: {
          MEMBER_INDUSTRY: [],
          MEMBER_SENIORITY: [{ label: "Manager", clicks: 2 }],
        },
      }),
    });
    const text = JSON.stringify(blocks);
    // Empty pivot is not rendered as an empty bullet — the ICP block only
    // shows seniority.
    expect(text).toContain("Seniority");
    expect(text).not.toContain("Industry:");
  });

  it("renders em-dash when CTR / CPC / CPA are undefined", async () => {
    const blocks = renderDigest({
      campaignSlug: "shop-online",
      current: baseMetrics({
        ctr: undefined,
        cpcEur: undefined,
        cpaEur: undefined,
      }),
    });
    const text = JSON.stringify(blocks);
    expect(text).toContain("—");
  });

  const pacing = {
    creditEur: 136.75,
    lifetimeBudgetEur: 100,
    adsStartAt: "2026-09-24",
    adsEndAt: "2026-10-23",
  };

  it("renders the credit pacing line when pacing config + lifetime spend are present", () => {
    const blocks = renderDigest({
      campaignSlug: "shop-online",
      current: baseMetrics({ lifetimeSpendEur: 52.1 }),
      previous: null,
      pacing,
    });
    const text = JSON.stringify(blocks);
    expect(text).toContain("Credit:");
    expect(text).toContain("€52.10 / €136.75");
    expect(text).toContain("€84.65"); // remaining
    expect(text).toContain("2026-10-23"); // ads end
    // Burn rate derives from lifetime spend ÷ elapsed days — no previous
    // bookmark needed.
    expect(text).toContain("burn ~€");
    // €52.10 over ~3.5 elapsed days ≈ €15/day — projected end spend is
    // capped by the €100 lifetime budget, well under the €136.75 credit.
    expect(text).not.toContain("⚠️");
  });

  it("warns when projected spend would burn the credit before ads end", () => {
    const blocks = renderDigest({
      campaignSlug: "shop-online",
      // €130 already burned with ~26 days left — without a binding
      // lifetime cap the pace would blow past the €136.75 credit.
      current: baseMetrics({ lifetimeSpendEur: 130 }),
      previous: null,
      pacing: { ...pacing, lifetimeBudgetEur: 500 },
    });
    const text = JSON.stringify(blocks);
    expect(text).toContain("⚠️");
    expect(text).toContain("burn ~€");
  });

  it("does not warn when the campaign cap stops spend below the credit", () => {
    const blocks = renderDigest({
      campaignSlug: "shop-online",
      // High burn, but the €100 lifetime cap halts the campaign before the
      // €136.75 credit is exhausted — the card on file stays untouched.
      current: baseMetrics({ lifetimeSpendEur: 74.2 }),
      previous: null,
      pacing,
    });
    const text = JSON.stringify(blocks);
    expect(text).toContain("Credit:");
    expect(text).not.toContain("⚠️");
  });

  it("omits the pacing line without lifetime spend", () => {
    const blocks = renderDigest({
      campaignSlug: "shop-online",
      current: baseMetrics(),
      previous: null,
      pacing,
    });
    expect(JSON.stringify(blocks)).not.toContain("Credit:");
  });

  it("renders the creative leaderboard when present", () => {
    const blocks = renderDigest({
      campaignSlug: "shop-online",
      current: baseMetrics({
        creativeLeaderboard: [
          { creativeId: "111", label: "Carousel A", impressions: 300, clicks: 20, ctr: 0.0667 },
          { creativeId: "222", label: "Doc B", impressions: 86, clicks: 8, ctr: 0.093 },
        ],
      }),
    });
    const text = JSON.stringify(blocks);
    expect(text).toContain("Top creatives:");
    expect(text).toContain("Carousel A — *20* clicks");
    expect(text).toContain("6.67% CTR");
  });
});
