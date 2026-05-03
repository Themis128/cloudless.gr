import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAnthropicApiKey } from "@/lib/anthropic";
import {
  runAnalyticsAgentOrchestration,
  type AnalyticsConnector,
} from "@/lib/analytics-agent-orchestrator";
import { parseAnalyticsOrchestrationRequestBody } from "@/lib/analytics-orchestration-input";
import { getStripeAnalyticsSnapshot } from "@/lib/stripe-analytics-read";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let windowDays = 30;
  let connectors: AnalyticsConnector[] = ["quicksight", "powerbi"];
  let goals: string[] = [];

  try {
    ({ windowDays, connectors, goals } = parseAnalyticsOrchestrationRequestBody(
      await request.json(),
    ));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid input" },
      { status: 400 },
    );
  }

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured." },
      { status: 503 },
    );
  }

  try {
    const snapshot = await getStripeAnalyticsSnapshot(windowDays);
    const orchestration = await runAnalyticsAgentOrchestration({
      snapshot,
      connectors: [...connectors],
      apiKey,
      goals,
    });

    return NextResponse.json(orchestration);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Analytics orchestration failed.",
      },
      { status: 500 },
    );
  }
}
