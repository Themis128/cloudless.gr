import { beforeEach, describe, expect, it, vi } from "vitest";

const getSeoFromLakeMock = vi.fn();
const getStripeSnapshotFromLakeMock = vi.fn();

vi.mock("@/lib/datalake-serve", () => ({
  getSeoFromLake: (...a: unknown[]) => getSeoFromLakeMock(...a),
  getStripeSnapshotFromLake: (...a: unknown[]) => getStripeSnapshotFromLakeMock(...a),
}));

describe("report-gold-sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a flat GSC section from gold SEO", async () => {
    getSeoFromLakeMock.mockResolvedValue({
      snapshot: { clicks: 100, impressions: 2000, ctr: 0.05, position: 8.2, days: 30 },
      keywords: [
        { query: "cloudless", clicks: 40, impressions: 400, ctr: 0.1, position: 3 },
        { query: "hosting greece", clicks: 20, impressions: 300, ctr: 0.066, position: 9 },
      ],
      fetchedAt: "2026-08-14T00:00:00.000Z",
      source: "datalake-gold",
    });
    const { buildGoldGscReportSection } = await import("@/lib/report-gold-sections");
    const section = await buildGoldGscReportSection("2026-07-15", "2026-08-14");
    expect(section?.id).toBe("gsc");
    expect(section?.data.clicks).toBe(100);
    expect(section?.data.ctrPercent).toBe(5);
    expect(String(section?.data.topKeywords)).toContain("cloudless");
  });

  it("returns null when GSC gold is empty with error", async () => {
    getSeoFromLakeMock.mockResolvedValue({
      snapshot: { clicks: 0, impressions: 0, ctr: 0, position: 0, days: 28 },
      keywords: [],
      fetchedAt: "2026-08-14T00:00:00.000Z",
      source: "datalake-gold",
      error: "missing",
    });
    const { buildGoldGscReportSection } = await import("@/lib/report-gold-sections");
    expect(await buildGoldGscReportSection("2026-07-01", "2026-07-31")).toBeNull();
  });

  it("builds a flat Stripe section from gold snapshot", async () => {
    getStripeSnapshotFromLakeMock.mockResolvedValue({
      windowDays: 30,
      generatedAt: "2026-08-14T00:00:00.000Z",
      totals: { events: 12, revenueMinor: 45000, processed: 12, failed: 0 },
      byCategory: {},
      byStatus: {},
      byCurrency: {},
      dailyTrend: [{ day: "2026-08-01", revenueMinor: 1000, events: 1, processed: 1, failed: 0 }],
      source: "datalake-gold",
    });
    const { buildGoldStripeReportSection } = await import("@/lib/report-gold-sections");
    const section = await buildGoldStripeReportSection("2026-07-15", "2026-08-14");
    expect(section?.id).toBe("stripe");
    expect(section?.data.revenueEur).toBe(450);
    expect(section?.data.dailyPoints).toBe(1);
  });
});
