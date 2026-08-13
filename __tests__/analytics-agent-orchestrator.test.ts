import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateAdminAiTextMock } = vi.hoisted(() => ({
  generateAdminAiTextMock: vi.fn(),
}));

vi.mock("@/lib/admin-ai", () => ({
  generateAdminAiText: generateAdminAiTextMock,
}));

describe("analytics-agent-orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preprocesses trend and category metrics before orchestration", async () => {
    const { preprocessStripeAnalyticsSnapshot } =
      await import("@/lib/analytics-agent-orchestrator");

    const result = preprocessStripeAnalyticsSnapshot({
      windowDays: 7,
      generatedAt: "2026-05-03T12:00:00.000Z",
      totals: { events: 10, revenueMinor: 10000, processed: 8, failed: 2 },
      byCategory: {
        checkout: { events: 6, revenueMinor: 7000 },
        subscription: { events: 4, revenueMinor: 3000 },
      },
      byStatus: { processed: 8, handler_failed: 2 },
      byCurrency: { eur: 10000 },
      dailyTrend: [
        {
          day: "2026-04-27",
          revenueMinor: 1000,
          events: 1,
          processed: 1,
          failed: 0,
        },
        {
          day: "2026-04-28",
          revenueMinor: 500,
          events: 1,
          processed: 0,
          failed: 1,
        },
        {
          day: "2026-04-29",
          revenueMinor: 1500,
          events: 2,
          processed: 2,
          failed: 0,
        },
        {
          day: "2026-04-30",
          revenueMinor: 2000,
          events: 2,
          processed: 2,
          failed: 0,
        },
        {
          day: "2026-05-01",
          revenueMinor: 2500,
          events: 2,
          processed: 2,
          failed: 0,
        },
        {
          day: "2026-05-02",
          revenueMinor: 1000,
          events: 1,
          processed: 0,
          failed: 1,
        },
        {
          day: "2026-05-03",
          revenueMinor: 1500,
          events: 1,
          processed: 1,
          failed: 0,
        },
      ],
    });

    expect(result.failureRatePct).toBe(20);
    expect(result.processedRatePct).toBe(80);
    expect(result.averageRevenuePerEventMinor).toBe(1000);
    expect(result.topRevenueCategories[0]).toMatchObject({
      category: "checkout",
      revenueMinor: 7000,
      revenueSharePct: 70,
    });
    expect(result.topFailureDays[0]).toMatchObject({
      day: "2026-04-28",
      failed: 1,
    });
  });

  it("falls back to deterministic insights when AI returns invalid JSON", async () => {
    generateAdminAiTextMock.mockResolvedValue({ text: "not json", provider: "workers-ai" });
    const { runAnalyticsAgentOrchestration } = await import("@/lib/analytics-agent-orchestrator");

    const result = await runAnalyticsAgentOrchestration({
      snapshot: {
        windowDays: 14,
        generatedAt: "2026-05-03T12:00:00.000Z",
        totals: { events: 4, revenueMinor: 8000, processed: 3, failed: 1 },
        byCategory: {
          checkout: { events: 3, revenueMinor: 7000 },
          subscription: { events: 1, revenueMinor: 1000 },
        },
        byStatus: { processed: 3, handler_failed: 1 },
        byCurrency: { eur: 8000 },
        dailyTrend: [
          {
            day: "2026-04-30",
            revenueMinor: 2000,
            events: 1,
            processed: 1,
            failed: 0,
          },
          {
            day: "2026-05-01",
            revenueMinor: 1000,
            events: 1,
            processed: 0,
            failed: 1,
          },
          {
            day: "2026-05-02",
            revenueMinor: 2500,
            events: 1,
            processed: 1,
            failed: 0,
          },
          {
            day: "2026-05-03",
            revenueMinor: 2500,
            events: 1,
            processed: 1,
            failed: 0,
          },
        ],
      },
      connectors: ["quicksight", "metabase"],
      goals: ["Reduce payment failures"],
    });

    expect(generateAdminAiTextMock).toHaveBeenCalledOnce();
    expect(result.workflow.map((step) => step.step)).toEqual([
      "collect_data",
      "preprocess_data",
      "generate_insights",
      "prepare_connectors",
    ]);
    expect(result.preprocessed.failureRatePct).toBe(25);
    expect(result.report.executiveSummary).toContain("Processed 3 of 4 events");
    expect(result.connectorPayloads).toHaveLength(2);
    expect(result.connectorPayloads[0].summaryMetrics.topRevenueCategories[0]).toBe("checkout");
  });
});
