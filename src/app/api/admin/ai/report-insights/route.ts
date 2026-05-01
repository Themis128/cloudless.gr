import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { callClaude, getAnthropicApiKey } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let metrics: Record<string, unknown>;
  let period: string;
  try {
    const body = await request.json();
    metrics = body.metrics;
    period = body.period ?? "last 30 days";
    if (!metrics) throw new Error("metrics is required");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
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

  const prompt = `You are a marketing analyst. Write concise, insightful commentary on this campaign performance data for a client report.

Period: ${period}
Metrics: ${JSON.stringify(metrics, null, 2)}

Write 3-5 sentences of plain English insights. Mention specific numbers, compare to industry benchmarks where relevant, and end with 1-2 actionable recommendations. Be direct and professional.`;

  try {
    const insights = await callClaude(prompt, apiKey, { maxTokens: 500 }); // NOSONAR
    return NextResponse.json({ insights });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI generation failed." },
      { status: 500 },
    );
  }
}
