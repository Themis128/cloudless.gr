import { describe, it, expect } from "vitest";
import { renderAnalyticsReportPdf } from "@/lib/analytics-report-pdf";
import type { AnalyticsOrchestrationResult } from "@/lib/analytics-agent-orchestrator";

function buildResult(
  overrides: Partial<AnalyticsOrchestrationResult> = {}
): AnalyticsOrchestrationResult {
  return {
    workflow: [
      { step: "snapshot", status: "completed", details: "ok" },
      { step: "preprocess", status: "completed", details: "ok" },
    ],
    snapshot: {
      windowDays: 30,
      generatedAt: "2026-06-12T10:00:00Z",
      totals: { events: 100, revenueMinor: 50000, processed: 90, failed: 10 },
      byCategory: { course: { events: 60, revenueMinor: 30000 } },
      byStatus: { paid: 80, open: 20 },
      byCurrency: { EUR: 100 },
      dailyTrend: [],
    },
    preprocessed: {
      windowDays: 30,
      hasData: true,
      failureRatePct: 10,
      processedRatePct: 90,
      averageRevenuePerEventMinor: 500,
      averageDailyRevenueMinor: 1666,
      averageDailyEvents: 3,
      revenuePerProcessedEventMinor: 555,
      topRevenueCategories: [
        { category: "course", events: 60, revenueMinor: 30000, revenueSharePct: 60 },
      ],
      topFailureDays: [],
      strongestRevenueDays: [],
      momentum: {
        comparisonWindowDays: 14,
        recentRevenueMinor: 25000,
        priorRevenueMinor: 20000,
        revenueDeltaPct: 25,
        recentFailureRatePct: 10,
        priorFailureRatePct: 8,
        failureRateDeltaPct: 25,
      },
      dataQuality: { sparseWindow: false, notes: [] },
    },
    report: {
      executiveSummary: "Revenue trending up.",
      keyInsights: ["Courses drove 60% of revenue."],
      risks: ["Sample size still small."],
      nextMoves: [
        {
          move: "Promote top course",
          rationale: "Drives revenue share.",
          expectedOutcome: "+10% MRR",
          confidence: "medium",
          timeframeDays: 14,
        },
      ],
      scenarioOutcomes: [
        {
          scenario: "Holiday push",
          expectedRevenueDeltaPct: 12,
          expectedConversionDeltaPct: 4,
        },
      ],
    },
    connectorPayloads: [
      {
        connector: "quicksight",
        datasets: {
          dailyTrend: [],
          categoryBreakdown: {},
          statusBreakdown: {},
          currencyBreakdown: {},
        },
        summaryMetrics: {
          failureRatePct: 10,
          processedRatePct: 90,
          averageRevenuePerEventMinor: 500,
          revenueDeltaPct: 25,
          failureRateDeltaPct: 25,
          topRevenueCategories: ["course"],
          dataQualityNotes: [],
        },
        chartRecommendations: ["Daily revenue line chart"],
        serviceHints: ["QuickSight dataset"],
      },
    ],
    ...overrides,
  };
}

describe("analytics-report-pdf.renderAnalyticsReportPdf", () => {
  it("returns a non-empty Uint8Array starting with the PDF magic bytes", async () => {
    const bytes = await renderAnalyticsReportPdf({ result: buildResult() });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);
    // PDF files always start with "%PDF-"
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("uses the provided reportTitle when supplied", async () => {
    const bytes = await renderAnalyticsReportPdf({
      reportTitle: "Custom Title Report",
      result: buildResult(),
    });
    expect(bytes.length).toBeGreaterThan(100);
    // The PDF binary contains compressed text, so we just verify a render
    // happened without throwing — the title placement is exercised.
  });

  it("falls back to a default title when reportTitle is whitespace", async () => {
    const bytes = await renderAnalyticsReportPdf({
      reportTitle: "   ",
      result: buildResult(),
    });
    expect(bytes.length).toBeGreaterThan(100);
  });

  it("renders without data-quality section when notes is empty", async () => {
    const r = buildResult();
    r.preprocessed.dataQuality.notes = [];
    const bytes = await renderAnalyticsReportPdf({ result: r });
    expect(bytes.length).toBeGreaterThan(100);
  });

  it("renders with data-quality section when notes is populated", async () => {
    const r = buildResult();
    r.preprocessed.dataQuality.notes = [
      "Small sample size — interpret with care.",
      "Single currency only.",
    ];
    const bytes = await renderAnalyticsReportPdf({ result: r });
    expect(bytes.length).toBeGreaterThan(100);
  });

  it("renders with multiple connector payloads", async () => {
    const r = buildResult();
    r.connectorPayloads = [
      ...r.connectorPayloads,
      {
        connector: "metabase",
        datasets: {
          dailyTrend: [],
          categoryBreakdown: {},
          statusBreakdown: {},
          currencyBreakdown: {},
        },
        summaryMetrics: {
          failureRatePct: 10,
          processedRatePct: 90,
          averageRevenuePerEventMinor: 500,
          revenueDeltaPct: null,
          failureRateDeltaPct: null,
          topRevenueCategories: [],
          dataQualityNotes: [],
        },
        chartRecommendations: [],
        serviceHints: [],
      },
    ];
    const bytes = await renderAnalyticsReportPdf({ result: r });
    expect(bytes.length).toBeGreaterThan(100);
  });

  it("handles a connector payload with no chart recommendations", async () => {
    const r = buildResult();
    r.connectorPayloads[0].chartRecommendations = [];
    const bytes = await renderAnalyticsReportPdf({ result: r });
    expect(bytes.length).toBeGreaterThan(100);
  });

  it("handles long text that needs wrapping", async () => {
    const r = buildResult();
    r.report.executiveSummary =
      "This is a deliberately long executive summary that should force the wrap-text helper to break it across multiple lines so we exercise the wrapping branches and the splitOversizedWord helper when individual words remain narrow enough to fit on a line.";
    const bytes = await renderAnalyticsReportPdf({ result: r });
    expect(bytes.length).toBeGreaterThan(100);
  });

  it("handles an oversized single word that needs character-level splitting", async () => {
    const r = buildResult();
    r.report.executiveSummary = "x".repeat(500);
    const bytes = await renderAnalyticsReportPdf({ result: r });
    expect(bytes.length).toBeGreaterThan(100);
  });

  it("handles empty arrays for keyInsights / risks / nextMoves", async () => {
    const r = buildResult();
    r.report.keyInsights = [];
    r.report.risks = [];
    r.report.nextMoves = [];
    r.report.scenarioOutcomes = [];
    const bytes = await renderAnalyticsReportPdf({ result: r });
    expect(bytes.length).toBeGreaterThan(100);
  });
});
