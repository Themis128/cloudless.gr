import { beforeEach, describe, expect, it, vi } from "vitest";

const getDatalakeDashboardMock = vi.fn();

vi.mock("@/lib/datalake-r2", () => ({
  getDatalakeDashboard: (...a: unknown[]) => getDatalakeDashboardMock(...a),
  loadDatalakeSnapshotFromR2: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/r2-client", () => ({
  getDataLakeBucketFromEnv: vi.fn().mockReturnValue(null),
}));

describe("getRoiFromLake honesty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDatalakeDashboardMock.mockResolvedValue({
      generated_at: "2026-08-14T00:00:00.000Z",
      cache: "cloudflare",
      source: "gold",
      sections: [
        {
          section: "linkedin_ads",
          rows: [
            { day: "2026-08-10", spend: 12.5, impressions: 100, clicks: 4, conversions: 1 },
            { day: "2026-06-01", spend: 99, impressions: 999, clicks: 50, conversions: 0 },
          ],
          rowCount: 2,
        },
        {
          section: "stripe_revenue",
          rows: [{ metric: "paid_orders", amount_eur: 50 }],
          rowCount: 1,
        },
      ],
    });
  });

  it("marks Google/TikTok/X/Meta as not_in_gold and keeps LinkedIn gold", async () => {
    const { getRoiFromLake } = await import("@/lib/datalake-serve");
    const roi = await getRoiFromLake(30);
    const channels = roi.channels as Array<{
      channel: string;
      configured: boolean;
      status: string;
      inGold: boolean;
      spendCents: number;
    }>;
    expect(channels.find((c) => c.channel === "linkedin")?.configured).toBe(true);
    expect(channels.find((c) => c.channel === "linkedin")?.status).toBe("gold");
    // Old June row excluded from 30d window; only Aug 10 spend remains.
    expect(channels.find((c) => c.channel === "linkedin")?.spendCents).toBe(1250);
    for (const name of ["google", "tiktok", "x", "meta"]) {
      const ch = channels.find((c) => c.channel === name);
      expect(ch?.configured).toBe(false);
      expect(ch?.status).toBe("not_in_gold");
      expect(ch?.inGold).toBe(false);
    }
    expect(roi.goldSections).toEqual(["linkedin_ads", "stripe_revenue"]);
    expect(String(roi.notes)).toContain("not_in_gold");
  });

  it("widening the window includes older LinkedIn gold days", async () => {
    const { getRoiFromLake } = await import("@/lib/datalake-serve");
    const narrow = await getRoiFromLake(30);
    const wide = await getRoiFromLake(120);
    const spend = (roi: Record<string, unknown>) =>
      (roi.channels as Array<{ channel: string; spendCents: number }>).find(
        (c) => c.channel === "linkedin"
      )?.spendCents;
    expect(spend(narrow)).toBe(1250);
    expect(spend(wide)).toBe(1250 + 9900);
  });
});
