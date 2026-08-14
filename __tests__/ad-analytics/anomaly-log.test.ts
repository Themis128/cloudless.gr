import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetAnomalyLogMemory,
  listAnomalyHistory,
  recordAnomalyEvents,
} from "@/lib/ad-analytics/anomaly-log";
import type { AdMetrics } from "@/lib/ad-analytics/types";

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: () => null,
}));

const snapshot: AdMetrics = {
  platform: "linkedin",
  campaignId: "c1",
  windowStart: "2026-08-14T10:00:00.000Z",
  windowEnd: "2026-08-14T10:15:00.000Z",
  spendEur: 42,
  impressions: 1000,
  clicks: 20,
  conversions: 0,
  cpcEur: 2.1,
  ctr: 0.02,
};

describe("anomaly-log (in-memory)", () => {
  beforeEach(() => {
    _resetAnomalyLogMemory();
  });

  it("records findings and lists newest first", async () => {
    await recordAnomalyEvents({
      campaignSlug: "shop-online",
      platform: "linkedin",
      windowEnd: "2026-08-14T10:15:00.000Z",
      snapshot,
      findings: [
        {
          rule: "ctr_floor",
          severity: "warning",
          message: "CTR below floor",
          detail: { metric: "ctr", observed: 0.001, threshold: 0.003 },
        },
      ],
    });

    const rows = await listAnomalyHistory(10);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.campaignSlug).toBe("shop-online");
    expect(rows[0]?.rule).toBe("ctr_floor");
    expect(rows[0]?.source).toBe("log");
    expect(rows[0]?.id).toContain("ad-analytics:anomaly:shop-online:linkedin:ctr_floor:2026-08-14");
  });

  it("is a no-op for empty findings", async () => {
    await recordAnomalyEvents({
      campaignSlug: "shop-online",
      platform: "linkedin",
      windowEnd: "2026-08-14T10:15:00.000Z",
      snapshot,
      findings: [],
    });
    expect(await listAnomalyHistory()).toEqual([]);
  });
});
