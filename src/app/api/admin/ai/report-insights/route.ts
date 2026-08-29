import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  adminAiNotConfiguredResponse,
  generateAdminAiText,
  isAdminAiConfiguredAsync,
} from "@/lib/admin-ai";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let metrics: Record<string, unknown>;
  let period: string;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    metrics = body.metrics as Record<string, unknown>;
    period = String(body.period ?? "last 30 days").slice(0, 100);
    if (!metrics || typeof metrics !== "object") throw new Error("metrics is required");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 }
    );
  }

  if (!(await isAdminAiConfiguredAsync())) {
    return adminAiNotConfiguredResponse();
  }

  const prompt = `You are a marketing analyst. Write concise, insightful commentary on this campaign performance data for a client report.
Period: ${period}
Metrics: ${JSON.stringify(metrics, null, 2)}
Write 3-5 sentences of plain English insights. Mention specific numbers, compare to industry benchmarks where relevant, and end with 1-2 actionable recommendations. Be direct and professional.`;

  try {
    const { text: insights, provider } = await generateAdminAiText(prompt, { maxTokens: 500 });
    return NextResponse.json({ insights, provider });
  } catch (e) {
    console.error("[ai/report-insights] generation failed:", e);
    if (e instanceof Error && e.name === "AdminAiNotConfigured")
      return adminAiNotConfiguredResponse();
    return NextResponse.json({ error: "AI generation failed." }, { status: 500 });
  }
}
