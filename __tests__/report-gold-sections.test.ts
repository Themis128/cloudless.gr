/** report-gold-sections.ts — stripe section error/null path. */
import { describe, it, expect, vi } from "vitest";

const { mockStripeSnap } = vi.hoisted(() => ({ mockStripeSnap: vi.fn() }));

vi.mock("@/lib/datalake-serve", () => ({
  getStripeSnapshotFromLake: mockStripeSnap,
  getSeoFromLake: vi.fn(),
}));

import { buildGoldStripeReportSection } from "@/lib/report-gold-sections";

describe("buildGoldStripeReportSection", () => {
  it("returns null when the lake snapshot is an empty error", async () => {
    mockStripeSnap.mockResolvedValue({
      error: "lake empty",
      windowDays: 30,
      generatedAt: "2026-10-14T00:00:00Z",
      totals: { events: 0, revenueMinor: 0, processed: 0, failed: 0 },
      byCategory: {},
      byStatus: {},
      byCurrency: {},
      dailyTrend: [],
    });
    await expect(buildGoldStripeReportSection("2026-09-14", "2026-10-14")).resolves.toBeNull();
  });

  it("maps a populated snapshot into the section data shape", async () => {
    mockStripeSnap.mockResolvedValue({
      windowDays: 30,
      generatedAt: "2026-10-14T00:00:00Z",
      totals: { events: 9, revenueMinor: 12345, processed: 8, failed: 1 },
      byCategory: { order: { events: 9, revenueMinor: 12345 } },
      byStatus: { processed: 8 },
      byCurrency: { eur: 12345 },
      dailyTrend: [{ day: "2026-10-13", revenueMinor: 5000, events: 3 }],
    });
    const r = await buildGoldStripeReportSection("2026-09-14", "2026-10-14");
    expect(r?.id).toBe("stripe");
    const data = r!.data as Record<string, unknown>;
    expect(data.revenueEur).toBe(123.45);
    expect(data.events).toBe(9);
  });
});
