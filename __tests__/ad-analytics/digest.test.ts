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
});
