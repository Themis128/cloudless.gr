/**
 * analytics-agent-orchestrator residual branches: prior-window momentum
 * (up / down / zero prior revenue), category ties, the fallback report's
 * momentum and failure-delta wording and default risk, and parseClaudeJson's
 * handling of wrong-typed fields, null moves and sparse scenarios.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StripeAnalyticsSnapshot } from "@/lib/stripe-analytics-read";

const { aiMock } = vi.hoisted(() => ({ aiMock: vi.fn() }));
vi.mock("@/lib/admin-ai", () => ({ generateAdminAiText: aiMock }));

import {
  preprocessStripeAnalyticsSnapshot,
  runAnalyticsAgentOrchestration,
} from "@/lib/analytics-agent-orchestrator";

type Day = { revenueMinor: number; events: number; failed: number };

/** 14 consecutive days: the first 7 are the prior window, the last 7 the recent one. */
function snapshot(prior: Day, recent: Day, byCategory: StripeAnalyticsSnapshot["byCategory"] = {}) {
  const dailyTrend = Array.from({ length: 14 }, (_, i) => {
    const d = i < 7 ? prior : recent;
    return {
      day: `2026-09-${String(i + 1).padStart(2, "0")}`,
      revenueMinor: d.revenueMinor,
      events: d.events,
      processed: d.events - d.failed,
      failed: d.failed,
    };
  });
  const sum = (k: keyof Day) => dailyTrend.reduce((n, p) => n + p[k], 0);
  return {
    windowDays: 14,
    generatedAt: "2026-09-15T00:00:00Z",
    totals: {
      events: sum("events"),
      processed: sum("events") - sum("failed"),
      failed: sum("failed"),
      revenueMinor: sum("revenueMinor"),
      currencies: ["eur"],
    },
    dailyTrend: dailyTrend.reverse(), // unsorted input: the orchestrator sorts by day
    byCategory,
    byStatus: {},
    byCurrency: { eur: sum("revenueMinor") },
  } as unknown as StripeAnalyticsSnapshot;
}

const goodMove = {
  move: "m",
  rationale: "r",
  expectedOutcome: "o",
  confidence: "HIGH",
  timeframeDays: 3.7,
};

beforeEach(() => aiMock.mockReset());

describe("momentum", () => {
  it("compares the last 7 days with the 7 before them", () => {
    const p = preprocessStripeAnalyticsSnapshot(
      snapshot(
        { revenueMinor: 100, events: 10, failed: 1 },
        { revenueMinor: 200, events: 10, failed: 0 }
      )
    );
    expect(p.momentum).toEqual({
      comparisonWindowDays: 7,
      recentRevenueMinor: 1400,
      priorRevenueMinor: 700,
      revenueDeltaPct: 100,
      recentFailureRatePct: 0,
      priorFailureRatePct: 10,
      failureRateDeltaPct: -10,
    });
  });

  it("zero prior revenue leaves the revenue delta null but still compares failures", () => {
    const p = preprocessStripeAnalyticsSnapshot(
      snapshot(
        { revenueMinor: 0, events: 10, failed: 0 },
        { revenueMinor: 50, events: 10, failed: 2 }
      )
    );
    expect(p.momentum.priorRevenueMinor).toBe(0);
    expect(p.momentum.revenueDeltaPct).toBeNull();
    expect(p.momentum.failureRateDeltaPct).toBe(20);
  });

  it("categories with equal revenue are ranked by event count", () => {
    const p = preprocessStripeAnalyticsSnapshot(
      snapshot(
        { revenueMinor: 10, events: 1, failed: 0 },
        { revenueMinor: 10, events: 1, failed: 0 },
        {
          few: { events: 1, revenueMinor: 70 },
          many: { events: 5, revenueMinor: 70 },
        }
      )
    );
    expect(p.topRevenueCategories.map((c) => c.category)).toEqual(["many", "few"]);
  });
});

describe("fallback report wording", () => {
  beforeEach(() => aiMock.mockResolvedValue({ text: "not json" }));

  it("rising revenue and falling failures; no data-quality notes → default risk", async () => {
    const { report } = await runAnalyticsAgentOrchestration({
      snapshot: snapshot(
        { revenueMinor: 100, events: 10, failed: 1 },
        { revenueMinor: 200, events: 10, failed: 0 }
      ),
      connectors: [],
    });
    expect(report.executiveSummary).toContain(
      "Revenue momentum is up 100% versus the prior comparison window."
    );
    expect(report.keyInsights[2]).toBe(
      "Recent failure rate is 0%, a drop of 10 points versus the prior window."
    );
    expect(report.risks).toEqual([
      "The current dataset is narrow enough that operational changes should be validated against another window before broad rollout.",
    ]);
  });

  it("falling revenue and rising failures", async () => {
    const { report, workflow } = await runAnalyticsAgentOrchestration({
      snapshot: snapshot(
        { revenueMinor: 200, events: 10, failed: 0 },
        { revenueMinor: 100, events: 10, failed: 1 }
      ),
      connectors: ["metabase"],
    });
    expect(report.executiveSummary).toContain(
      "Revenue momentum is down 50% versus the prior comparison window."
    );
    expect(report.keyInsights[2]).toBe(
      "Recent failure rate is 10%, a rise of 10 points versus the prior window."
    );
    expect(workflow.at(-1)!.details).toBe("Prepared 1 connector payload.");
  });
});

describe("AI JSON parsing", () => {
  const snap = () =>
    snapshot(
      { revenueMinor: 100, events: 10, failed: 0 },
      { revenueMinor: 100, events: 10, failed: 0 }
    );
  const run = async (json: unknown) => {
    aiMock.mockResolvedValue({ text: "```json\n" + JSON.stringify(json) + "\n```" });
    return (await runAnalyticsAgentOrchestration({ snapshot: snap(), connectors: [] })).report;
  };

  it("drops null moves and moves missing text; normalises confidence and timeframe", async () => {
    const report = await run({
      executiveSummary: "  Summary  ",
      keyInsights: ["a", " ", 7],
      risks: "not a list",
      nextMoves: [null, "str", { confidence: "low" }, { ...goodMove, move: undefined }, goodMove],
      scenarioOutcomes: [null, { scenario: "S" }, { expectedRevenueDeltaPct: 1 }],
    });
    expect(report.executiveSummary).toBe("Summary");
    expect(report.keyInsights).toEqual(["a", "7"]);
    expect(report.risks).toEqual([]);
    expect(report.nextMoves).toEqual([
      { move: "m", rationale: "r", expectedOutcome: "o", confidence: "high", timeframeDays: 3 },
    ]);
    expect(report.scenarioOutcomes).toEqual([
      { scenario: "S", expectedRevenueDeltaPct: 0, expectedConversionDeltaPct: 0 },
    ]);
  });

  it("non-numeric scenario deltas round to 0", async () => {
    const report = await run({
      executiveSummary: "s",
      keyInsights: ["k"],
      nextMoves: [goodMove],
      scenarioOutcomes: [
        { scenario: "S", expectedRevenueDeltaPct: "lots", expectedConversionDeltaPct: 2.345 },
      ],
    });
    expect(report.scenarioOutcomes).toEqual([
      { scenario: "S", expectedRevenueDeltaPct: 0, expectedConversionDeltaPct: 2.35 },
    ]);
  });

  it.each([
    ["a non-string summary", { executiveSummary: 5, keyInsights: ["k"], nextMoves: [goodMove] }],
    ["non-array insights", { executiveSummary: "s", keyInsights: "k", nextMoves: [goodMove] }],
    ["non-array moves", { executiveSummary: "s", keyInsights: ["k"], nextMoves: {} }],
  ])("%s falls back to the default report", async (_label, json) => {
    const report = await run(json);
    expect(report.executiveSummary).toMatch(/^Processed 140 of 140 events across 14 days\./);
  });
});
