import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isAdminAiConfiguredAsync } from "@/lib/admin-ai";
import {
  preprocessStripeAnalyticsSnapshot,
  runAnalyticsAgentOrchestration,
  type AnalyticsConnector,
  type AnalyticsOrchestrationResult,
} from "@/lib/analytics-agent-orchestrator";
import { parseAnalyticsOrchestrationRequestBody } from "@/lib/analytics-orchestration-input";
import type { StripeAnalyticsSnapshot } from "@/lib/stripe-analytics-read";
import { getInsight, getStripeSnapshotFromLake } from "@/lib/datalake-serve";
import { getDataLakeBucketFromEnv } from "@/lib/r2-client";
import { insightObjectKey } from "@/lib/datalake-insights";

const DATALAKE_GOLD_SOURCE = "datalake-gold" as const;
const ORCHESTRATION_DOMAIN = "orchestration";

export interface PreparedOrchestration {
  snapshot: StripeAnalyticsSnapshot;
  orchestration: AnalyticsOrchestrationResult;
  reportTitle: string;
  source: typeof DATALAKE_GOLD_SOURCE | "live_llm";
}

export type PrepareResult =
  { ok: true; data: PreparedOrchestration } | { ok: false; response: NextResponse };

const DEFAULT_CONNECTORS: AnalyticsConnector[] = ["quicksight", "powerbi"];

function orchestrationFromInsight(
  snapshot: StripeAnalyticsSnapshot,
  summary: string,
  bullets: string[],
  details: string
): AnalyticsOrchestrationResult {
  const preprocessed = preprocessStripeAnalyticsSnapshot(snapshot);
  return {
    workflow: [
      {
        step: "collect_data",
        status: "completed",
        details: "Loaded stripe_revenue gold from datalake.",
      },
      {
        step: "preprocess_data",
        status: "completed",
        details: `Preprocessed ${snapshot.totals.events} lake events.`,
      },
      {
        step: "generate_insights",
        status: "completed",
        details,
      },
    ],
    snapshot,
    preprocessed,
    report: {
      executiveSummary: summary,
      keyInsights: bullets.slice(0, 8),
      risks: snapshot.totals.events === 0 ? ["Sparse or missing stripe_revenue gold."] : [],
      nextMoves: bullets.slice(0, 5).map((move) => ({
        move,
        rationale: "Derived from datalake gold insight snapshot.",
        expectedOutcome: "Improved decisions from lake-backed metrics.",
        confidence: "medium" as const,
        timeframeDays: 14,
      })),
      scenarioOutcomes: [],
    },
    connectorPayloads: [],
  };
}

/**
 * Prefer cached gold insight orchestration.json.
 * Live LLM only when ?live_llm=1 (or body.live_llm) AND AI is configured.
 */
export async function prepareOrchestration(
  request: NextRequest,
  failureMessage: string
): Promise<PrepareResult> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return { ok: false, response: auth.response };

  let windowDays = 30;
  let connectors: AnalyticsConnector[] = DEFAULT_CONNECTORS;
  let goals: string[] = [];
  let reportTitle = "Stripe Analytics Report";
  let liveLlm = request.nextUrl.searchParams.get("live_llm") === "1";

  try {
    const body = (await request.json()) as Record<string, unknown>;
    ({ windowDays, connectors, goals, reportTitle } = parseAnalyticsOrchestrationRequestBody(body));
    if (body.live_llm === true || body.live_llm === "1") liveLlm = true;
  } catch {
    // Empty or invalid body → keep defaults (POST with {} is common in e2e).
  }

  const lakeSnap = await getStripeSnapshotFromLake(windowDays);
  const snapshot: StripeAnalyticsSnapshot = {
    windowDays: lakeSnap.windowDays,
    generatedAt: lakeSnap.generatedAt,
    totals: lakeSnap.totals,
    byCategory: lakeSnap.byCategory,
    byStatus: lakeSnap.byStatus,
    byCurrency: lakeSnap.byCurrency,
    dailyTrend: lakeSnap.dailyTrend,
  };

  if (!liveLlm) {
    const cached = await getInsight(ORCHESTRATION_DOMAIN);
    if (cached && !cached.error && (cached.summary || cached.bullets?.length)) {
      return {
        ok: true,
        data: {
          snapshot,
          orchestration: orchestrationFromInsight(
            snapshot,
            cached.summary,
            cached.bullets ?? [],
            "Served lake/snapshots/insights/orchestration.json (no live LLM)."
          ),
          reportTitle,
          source: DATALAKE_GOLD_SOURCE,
        },
      };
    }

    if (!(await isAdminAiConfiguredAsync())) {
      return {
        ok: true,
        data: {
          snapshot,
          orchestration: orchestrationFromInsight(
            snapshot,
            lakeSnap.error ||
              "Revenue gold loaded; run ETL: Materialize datalake insights for LLM narrative.",
            [
              "Trigger workflow etl-materialize-insights.yml",
              "Or POST /api/admin/insights/refresh",
            ],
            "Insight snapshot missing and Admin AI not configured."
          ),
          reportTitle,
          source: DATALAKE_GOLD_SOURCE,
        },
      };
    }
    liveLlm = true;
  }

  if (!(await isAdminAiConfiguredAsync())) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Admin AI not configured. Set Cloudflare Workers AI (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN) or GEMINI_API_KEY.",
        },
        { status: 503 }
      ),
    };
  }

  try {
    const revenueInsight = await getInsight("revenue");
    const executiveInsight = await getInsight("executive");
    const enrichedGoals = [
      ...goals,
      revenueInsight?.summary ? `Lake revenue insight: ${revenueInsight.summary}` : "",
      executiveInsight?.summary ? `Lake executive insight: ${executiveInsight.summary}` : "",
    ].filter(Boolean);

    const orchestration = await runAnalyticsAgentOrchestration({
      snapshot,
      connectors: [...connectors],
      goals: enrichedGoals,
    });

    try {
      const bucket = getDataLakeBucketFromEnv();
      if (bucket && typeof bucket.put === "function") {
        const insightDoc = {
          domain: ORCHESTRATION_DOMAIN,
          generated_at: new Date().toISOString(),
          inputs_ref: {
            gold_generated_at: snapshot.generatedAt,
            sections: ["stripe_revenue", "acquisition_funnel", "attribution"],
          },
          summary: orchestration.report.executiveSummary,
          bullets: orchestration.report.keyInsights,
          metrics_cited: [
            { key: "events", value: snapshot.totals.events },
            { key: "revenueMinor", value: snapshot.totals.revenueMinor },
          ],
          confidence: "medium",
          freshness: snapshot.generatedAt,
        };
        await bucket.put(insightObjectKey(ORCHESTRATION_DOMAIN), JSON.stringify(insightDoc, null, 2), {
          httpMetadata: { contentType: "application/json" },
        });
      }
    } catch (err) {
      console.warn(
        "[analytics-orchestration] failed to cache insight:",
        err instanceof Error ? err.message : err
      );
    }

    return {
      ok: true,
      data: { snapshot, orchestration, reportTitle, source: "live_llm" },
    };
  } catch (error) {
    console.error("[analytics-orchestration]", failureMessage, error);
    return {
      ok: false,
      response: NextResponse.json({ error: failureMessage }, { status: 500 }),
    };
  }
}
