import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isAdminAiConfiguredAsync } from "@/lib/admin-ai";
import {
  runAnalyticsAgentOrchestration,
  type AnalyticsConnector,
  type AnalyticsOrchestrationResult,
} from "@/lib/analytics-agent-orchestrator";
import { parseAnalyticsOrchestrationRequestBody } from "@/lib/analytics-orchestration-input";
import {
  getStripeAnalyticsSnapshot,
  type StripeAnalyticsSnapshot,
} from "@/lib/stripe-analytics-read";

export interface PreparedOrchestration {
  snapshot: StripeAnalyticsSnapshot;
  orchestration: AnalyticsOrchestrationResult;
  reportTitle: string;
}

export type PrepareResult =
  { ok: true; data: PreparedOrchestration } | { ok: false; response: NextResponse };

const DEFAULT_CONNECTORS: AnalyticsConnector[] = ["quicksight", "powerbi"];

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

  try {
    ({ windowDays, connectors, goals, reportTitle } = parseAnalyticsOrchestrationRequestBody(
      await request.json()
    ));
  } catch (error) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid input" },
        { status: 400 }
      ),
    };
  }

  if (!(await isAdminAiConfiguredAsync())) {
    return { ok: false, response: NextResponse.json(
      {
        error:
          "Admin AI not configured. Set Cloudflare Workers AI (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN) or GEMINI_API_KEY.",
      },
      { status: 503 }
    ) };
  }

  try {
    const snapshot = await getStripeAnalyticsSnapshot(windowDays);
    const orchestration = await runAnalyticsAgentOrchestration({
      snapshot,
      connectors: [...connectors],
      goals,
    });
    return { ok: true, data: { snapshot, orchestration, reportTitle } };
  } catch (error) {
    console.error("[analytics-orchestration]", failureMessage, error);
    return {
      ok: false,
      response: NextResponse.json({ error: failureMessage }, { status: 500 }),
    };
  }
}
