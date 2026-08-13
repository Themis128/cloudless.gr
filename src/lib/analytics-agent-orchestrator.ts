import { generateAdminAiText } from "@/lib/admin-ai";
import type { StripeAnalyticsSnapshot } from "@/lib/stripe-analytics-read";

export type AnalyticsConnector = "quicksight" | "powerbi" | "tableau" | "lookerstudio" | "metabase";

export interface RecommendedMove {
  move: string;
  rationale: string;
  expectedOutcome: string;
  confidence: "low" | "medium" | "high";
  timeframeDays: number;
}

export interface AnalyticsNarrativeReport {
  executiveSummary: string;
  keyInsights: string[];
  risks: string[];
  nextMoves: RecommendedMove[];
  scenarioOutcomes: Array<{
    scenario: string;
    expectedRevenueDeltaPct: number;
    expectedConversionDeltaPct: number;
  }>;
}

export interface PreprocessedAnalyticsSummary {
  windowDays: number;
  hasData: boolean;
  failureRatePct: number;
  processedRatePct: number;
  averageRevenuePerEventMinor: number;
  averageDailyRevenueMinor: number;
  averageDailyEvents: number;
  revenuePerProcessedEventMinor: number;
  topRevenueCategories: Array<{
    category: string;
    events: number;
    revenueMinor: number;
    revenueSharePct: number;
  }>;
  topFailureDays: Array<{
    day: string;
    failed: number;
    events: number;
    failureRatePct: number;
  }>;
  strongestRevenueDays: Array<{
    day: string;
    revenueMinor: number;
    events: number;
  }>;
  momentum: {
    comparisonWindowDays: number;
    recentRevenueMinor: number;
    priorRevenueMinor: number | null;
    revenueDeltaPct: number | null;
    recentFailureRatePct: number;
    priorFailureRatePct: number | null;
    failureRateDeltaPct: number | null;
  };
  dataQuality: {
    sparseWindow: boolean;
    notes: string[];
  };
}

export interface ConnectorPayload {
  connector: AnalyticsConnector;
  datasets: {
    dailyTrend: StripeAnalyticsSnapshot["dailyTrend"];
    categoryBreakdown: StripeAnalyticsSnapshot["byCategory"];
    statusBreakdown: StripeAnalyticsSnapshot["byStatus"];
    currencyBreakdown: StripeAnalyticsSnapshot["byCurrency"];
  };
  summaryMetrics: {
    failureRatePct: number;
    processedRatePct: number;
    averageRevenuePerEventMinor: number;
    revenueDeltaPct: number | null;
    failureRateDeltaPct: number | null;
    topRevenueCategories: string[];
    dataQualityNotes: string[];
  };
  chartRecommendations: string[];
  serviceHints: string[];
}

export interface AnalyticsOrchestrationResult {
  workflow: Array<{
    step: string;
    status: "completed";
    details: string;
  }>;
  snapshot: StripeAnalyticsSnapshot;
  preprocessed: PreprocessedAnalyticsSummary;
  report: AnalyticsNarrativeReport;
  connectorPayloads: ConnectorPayload[];
}

function round(value: number, digits: number = 2): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return round((numerator / denominator) * 100);
}

function buildSystemPrompt(): string {
  return [
    "You are an executive analytics copilot for cloudless.gr.",
    "You must output strict JSON only, no markdown, no prose outside JSON.",
    "Focus on business outcomes, causal insight hypotheses, risk-adjusted recommendations, and concrete next moves.",
    "Use only the supplied data and derived metrics.",
    "If uncertainty exists or the sample is sparse, surface that in risks instead of inventing certainty.",
  ].join(" ");
}

function buildDataQualityNotes(
  snapshot: StripeAnalyticsSnapshot,
  hasData: boolean
): { sparseWindow: boolean; notes: string[] } {
  const notes: string[] = [];
  if (!hasData) {
    notes.push("No events were recorded in the selected window.");
  }

  const sparseWindow =
    snapshot.totals.events > 0 && snapshot.totals.events < Math.max(5, snapshot.windowDays / 2);
  if (sparseWindow) {
    notes.push(
      "Sample size is sparse for the selected window, so directionally useful trends may be noisier than usual."
    );
  }

  const currencies = Object.keys(snapshot.byCurrency);
  if (currencies.length > 1) {
    notes.push(
      "Revenue spans multiple currencies, so totals should be treated as ledger totals rather than FX-normalized business revenue."
    );
  }

  if (snapshot.totals.processed === 0 && snapshot.totals.events > 0) {
    notes.push(
      "No processed events were recorded, which likely indicates either a live issue or a partial ingest window."
    );
  }

  return { sparseWindow, notes };
}

function sumTrend(points: StripeAnalyticsSnapshot["dailyTrend"]): {
  revenueMinor: number;
  events: number;
  failed: number;
} {
  return points.reduce(
    (accumulator, point) => ({
      revenueMinor: accumulator.revenueMinor + point.revenueMinor,
      events: accumulator.events + point.events,
      failed: accumulator.failed + point.failed,
    }),
    { revenueMinor: 0, events: 0, failed: 0 }
  );
}

export function preprocessStripeAnalyticsSnapshot(
  snapshot: StripeAnalyticsSnapshot
): PreprocessedAnalyticsSummary {
  const hasData = snapshot.totals.events > 0;
  const sortedTrend = [...snapshot.dailyTrend].sort((left, right) =>
    left.day.localeCompare(right.day)
  );
  const comparisonWindowDays = Math.min(7, sortedTrend.length);
  const recentWindow = comparisonWindowDays > 0 ? sortedTrend.slice(-comparisonWindowDays) : [];
  const priorWindow =
    comparisonWindowDays > 0
      ? sortedTrend.slice(-comparisonWindowDays * 2, -comparisonWindowDays)
      : [];
  const recentTotals = sumTrend(recentWindow);
  const priorTotals = sumTrend(priorWindow);
  const recentFailureRatePct = percentage(recentTotals.failed, recentTotals.events);
  const priorFailureRatePct =
    priorWindow.length > 0 ? percentage(priorTotals.failed, priorTotals.events) : null;
  const topRevenueCategories = Object.entries(snapshot.byCategory)
    .map(([category, metrics]) => ({
      category,
      events: metrics.events,
      revenueMinor: metrics.revenueMinor,
      revenueSharePct: percentage(metrics.revenueMinor, snapshot.totals.revenueMinor),
    }))
    .sort((left, right) => right.revenueMinor - left.revenueMinor || right.events - left.events)
    .slice(0, 5);
  const topFailureDays = sortedTrend
    .filter((point) => point.failed > 0)
    .map((point) => ({
      day: point.day,
      failed: point.failed,
      events: point.events,
      failureRatePct: percentage(point.failed, point.events),
    }))
    .sort((left, right) => right.failed - left.failed || right.failureRatePct - left.failureRatePct)
    .slice(0, 5);
  const strongestRevenueDays = sortedTrend
    .filter((point) => point.revenueMinor > 0)
    .sort((left, right) => right.revenueMinor - left.revenueMinor || right.events - left.events)
    .slice(0, 5)
    .map((point) => ({
      day: point.day,
      revenueMinor: point.revenueMinor,
      events: point.events,
    }));
  const dataQuality = buildDataQualityNotes(snapshot, hasData);

  return {
    windowDays: snapshot.windowDays,
    hasData,
    failureRatePct: percentage(snapshot.totals.failed, snapshot.totals.events),
    processedRatePct: percentage(snapshot.totals.processed, snapshot.totals.events),
    averageRevenuePerEventMinor:
      snapshot.totals.events > 0 ? round(snapshot.totals.revenueMinor / snapshot.totals.events) : 0,
    averageDailyRevenueMinor:
      snapshot.dailyTrend.length > 0
        ? round(snapshot.totals.revenueMinor / snapshot.dailyTrend.length)
        : 0,
    averageDailyEvents:
      snapshot.dailyTrend.length > 0
        ? round(snapshot.totals.events / snapshot.dailyTrend.length)
        : 0,
    revenuePerProcessedEventMinor:
      snapshot.totals.processed > 0
        ? round(snapshot.totals.revenueMinor / snapshot.totals.processed)
        : 0,
    topRevenueCategories,
    topFailureDays,
    strongestRevenueDays,
    momentum: {
      comparisonWindowDays,
      recentRevenueMinor: recentTotals.revenueMinor,
      priorRevenueMinor: priorWindow.length > 0 ? priorTotals.revenueMinor : null,
      revenueDeltaPct:
        priorWindow.length > 0 && priorTotals.revenueMinor > 0
          ? percentage(
              recentTotals.revenueMinor - priorTotals.revenueMinor,
              priorTotals.revenueMinor
            )
          : null,
      recentFailureRatePct,
      priorFailureRatePct,
      failureRateDeltaPct:
        priorFailureRatePct !== null ? round(recentFailureRatePct - priorFailureRatePct) : null,
    },
    dataQuality,
  };
}

function buildUserPrompt(
  snapshot: StripeAnalyticsSnapshot,
  preprocessed: PreprocessedAnalyticsSummary,
  goals: string[]
): string {
  const promptPayload = {
    goals:
      goals.length > 0
        ? goals
        : [
            "Increase qualified revenue",
            "Reduce payment failures",
            "Surface next best operational moves",
          ],
    preprocessed,
    totals: snapshot.totals,
    byCategory: snapshot.byCategory,
    byStatus: snapshot.byStatus,
    byCurrency: snapshot.byCurrency,
    recentDailyTrend: snapshot.dailyTrend.slice(-14),
  };

  return `Analyze this Stripe transaction analytics package and produce strategic guidance.

Return strict JSON with this exact shape:
{
  "executiveSummary": "string",
  "keyInsights": ["string", "string"],
  "risks": ["string", "string"],
  "nextMoves": [
    {
      "move": "string",
      "rationale": "string",
      "expectedOutcome": "string",
      "confidence": "low|medium|high",
      "timeframeDays": 7
    }
  ],
  "scenarioOutcomes": [
    {
      "scenario": "string",
      "expectedRevenueDeltaPct": 0,
      "expectedConversionDeltaPct": 0
    }
  ]
}

Analytics package:
${JSON.stringify(promptPayload, null, 2)}`;
}

function defaultReport(
  snapshot: StripeAnalyticsSnapshot,
  preprocessed: PreprocessedAnalyticsSummary
): AnalyticsNarrativeReport {
  const topCategory = preprocessed.topRevenueCategories[0]?.category ?? "checkout";
  const revenueDelta = preprocessed.momentum.revenueDeltaPct;
  const deltaSummary =
    revenueDelta === null
      ? "Recent momentum is still stabilizing because there is not enough prior-window history for a clean comparison."
      : revenueDelta >= 0
        ? `Revenue momentum is up ${revenueDelta}% versus the prior comparison window.`
        : `Revenue momentum is down ${Math.abs(revenueDelta)}% versus the prior comparison window.`;

  return {
    executiveSummary: `Processed ${snapshot.totals.processed} of ${snapshot.totals.events} events across ${snapshot.windowDays} days. Failure rate is ${preprocessed.failureRatePct}%. ${deltaSummary}`,
    keyInsights: [
      `Top revenue category is ${topCategory}${preprocessed.topRevenueCategories[0] ? ` at ${preprocessed.topRevenueCategories[0].revenueSharePct}% of tracked revenue` : ""}.`,
      `Average revenue per event is ${preprocessed.averageRevenuePerEventMinor} minor units, with ${preprocessed.averageDailyEvents} events per day on average.`,
      `Recent failure rate is ${preprocessed.momentum.recentFailureRatePct}%${preprocessed.momentum.failureRateDeltaPct !== null ? `, a ${preprocessed.momentum.failureRateDeltaPct >= 0 ? "rise" : "drop"} of ${Math.abs(preprocessed.momentum.failureRateDeltaPct)} points versus the prior window` : ""}.`,
    ],
    risks:
      preprocessed.dataQuality.notes.length > 0
        ? preprocessed.dataQuality.notes
        : [
            "The current dataset is narrow enough that operational changes should be validated against another window before broad rollout.",
          ],
    nextMoves: [
      {
        move: "Triage failed-payment spikes by day and recovery path",
        rationale:
          "Failure concentration by day usually points to a recoverable operational issue in billing, retries, or fraud rules.",
        expectedOutcome:
          "Lower failed event share and faster recovered revenue within the next cycle.",
        confidence: "high",
        timeframeDays: 7,
      },
      {
        move: `Scale acquisition and retention effort around ${topCategory}`,
        rationale:
          "The strongest category signal should receive the next budget or funnel optimization pass before weaker cohorts.",
        expectedOutcome:
          "Higher revenue efficiency and stronger conversion mix in the next planning window.",
        confidence: "medium",
        timeframeDays: 14,
      },
    ],
    scenarioOutcomes: [
      {
        scenario: "Reduce failed events by 15%",
        expectedRevenueDeltaPct: 3,
        expectedConversionDeltaPct: 2,
      },
      {
        scenario: `Improve ${topCategory} conversion flow by 10%`,
        expectedRevenueDeltaPct: 5,
        expectedConversionDeltaPct: 3,
      },
    ],
  };
}

function parseClaudeJson(text: string): AnalyticsNarrativeReport | null {
  const cleaned = text.replaceAll(/```json\n?|\n?```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const executiveSummary =
      typeof parsed.executiveSummary === "string" ? parsed.executiveSummary.trim() : "";
    const keyInsights = Array.isArray(parsed.keyInsights)
      ? parsed.keyInsights.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const risks = Array.isArray(parsed.risks)
      ? parsed.risks.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const nextMoves = Array.isArray(parsed.nextMoves)
      ? parsed.nextMoves
          .map((value) => {
            if (!value || typeof value !== "object") return null;
            const candidate = value as Record<string, unknown>;
            const confidence = String(candidate.confidence ?? "medium").toLowerCase();
            if (confidence !== "low" && confidence !== "medium" && confidence !== "high") {
              return null;
            }

            const timeframeDays = Number(candidate.timeframeDays);
            return {
              move: String(candidate.move ?? "").trim(),
              rationale: String(candidate.rationale ?? "").trim(),
              expectedOutcome: String(candidate.expectedOutcome ?? "").trim(),
              confidence,
              timeframeDays: Number.isFinite(timeframeDays)
                ? Math.max(1, Math.trunc(timeframeDays))
                : 7,
            } satisfies RecommendedMove;
          })
          .filter((value): value is RecommendedMove =>
            Boolean(value?.move && value?.rationale && value?.expectedOutcome)
          )
      : [];
    const scenarioOutcomes = Array.isArray(parsed.scenarioOutcomes)
      ? parsed.scenarioOutcomes
          .map((value) => {
            if (!value || typeof value !== "object") return null;
            const candidate = value as Record<string, unknown>;
            return {
              scenario: String(candidate.scenario ?? "").trim(),
              expectedRevenueDeltaPct: round(Number(candidate.expectedRevenueDeltaPct ?? 0)),
              expectedConversionDeltaPct: round(Number(candidate.expectedConversionDeltaPct ?? 0)),
            };
          })
          .filter((value): value is AnalyticsNarrativeReport["scenarioOutcomes"][number] =>
            Boolean(value?.scenario)
          )
      : [];

    if (!executiveSummary || keyInsights.length === 0 || nextMoves.length === 0) {
      return null;
    }

    return {
      executiveSummary,
      keyInsights,
      risks,
      nextMoves,
      scenarioOutcomes,
    };
  } catch {
    return null;
  }
}

function buildConnectorPayload(
  connector: AnalyticsConnector,
  snapshot: StripeAnalyticsSnapshot,
  preprocessed: PreprocessedAnalyticsSummary
): ConnectorPayload {
  const chartRecommendationsByConnector: Record<AnalyticsConnector, string[]> = {
    quicksight: [
      "Line chart: daily revenue and failed events trend",
      "Stacked bar: category revenue contribution",
      "KPI tiles: processed %, failed %, total revenue",
    ],
    powerbi: [
      "Combo chart: daily events vs revenue",
      "Treemap: category share by revenue",
      "Funnel: processed vs failed event flow",
    ],
    tableau: [
      "Dual-axis time series for revenue and failures",
      "Heatmap of day-of-week vs category volume",
      "Pareto chart of category impact",
    ],
    lookerstudio: [
      "Scorecards for totals and fail rate",
      "Time series for revenue trajectory",
      "Pie chart for category split",
    ],
    metabase: [
      "Dashboard cards for weekly KPIs",
      "Area chart for volume and revenue",
      "Bar chart for processing status breakdown",
    ],
  };

  const serviceHintsByConnector: Record<AnalyticsConnector, string[]> = {
    quicksight: [
      "Use SPICE ingestion for daily snapshots.",
      "Schedule refresh every 15 minutes for near-real-time ops.",
    ],
    powerbi: [
      "Use incremental refresh by eventDay.",
      "Publish a semantic model for executive and ops views.",
    ],
    tableau: [
      "Create an extract partitioned by eventDay.",
      "Publish the datasource for finance and growth teams.",
    ],
    lookerstudio: [
      "Materialize daily aggregates to reduce query load.",
      "Blend the dataset with acquisition sources for CAC-to-revenue views.",
    ],
    metabase: [
      "Persist model questions for weekly reviews.",
      "Set alerts on fail-rate threshold breaches.",
    ],
  };

  return {
    connector,
    datasets: {
      dailyTrend: snapshot.dailyTrend,
      categoryBreakdown: snapshot.byCategory,
      statusBreakdown: snapshot.byStatus,
      currencyBreakdown: snapshot.byCurrency,
    },
    summaryMetrics: {
      failureRatePct: preprocessed.failureRatePct,
      processedRatePct: preprocessed.processedRatePct,
      averageRevenuePerEventMinor: preprocessed.averageRevenuePerEventMinor,
      revenueDeltaPct: preprocessed.momentum.revenueDeltaPct,
      failureRateDeltaPct: preprocessed.momentum.failureRateDeltaPct,
      topRevenueCategories: preprocessed.topRevenueCategories.map((entry) => entry.category),
      dataQualityNotes: preprocessed.dataQuality.notes,
    },
    chartRecommendations: chartRecommendationsByConnector[connector],
    serviceHints: serviceHintsByConnector[connector],
  };
}

export async function runAnalyticsAgentOrchestration(params: {
  snapshot: StripeAnalyticsSnapshot;
  connectors: AnalyticsConnector[];
  goals?: string[];
}): Promise<AnalyticsOrchestrationResult> {
  const { snapshot, connectors } = params;
  const goals = params.goals ?? [];
  const preprocessed = preprocessStripeAnalyticsSnapshot(snapshot);
  const workflow: AnalyticsOrchestrationResult["workflow"] = [
    {
      step: "collect_data",
      status: "completed",
      details: `Collected ${snapshot.totals.events} events across ${snapshot.windowDays} days.`,
    },
    {
      step: "preprocess_data",
      status: "completed",
      details: `Computed failure rate ${preprocessed.failureRatePct}% and ranked ${preprocessed.topRevenueCategories.length} revenue categories.`,
    },
  ];

  const { text: raw } = await generateAdminAiText(
    buildUserPrompt(snapshot, preprocessed, goals),
    {
      maxTokens: 1500,
      system: buildSystemPrompt(),
    }
  );

  const report = parseClaudeJson(raw) ?? defaultReport(snapshot, preprocessed);
  workflow.push({
    step: "generate_insights",
    status: "completed",
    details: "Generated executive narrative, next moves, and scenario outcomes.",
  });

  const connectorPayloads = connectors.map((connector) =>
    buildConnectorPayload(connector, snapshot, preprocessed)
  );
  workflow.push({
    step: "prepare_connectors",
    status: "completed",
    details: `Prepared ${connectorPayloads.length} connector payload${connectorPayloads.length === 1 ? "" : "s"}.`,
  });

  return {
    workflow,
    snapshot,
    preprocessed,
    report,
    connectorPayloads,
  };
}
