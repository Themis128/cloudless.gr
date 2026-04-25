import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createReport, updateReport, type ReportSection } from "@/lib/reports";
import { isHubSpotConfigured, getPipelineStats } from "@/lib/hubspot";
import {
  isActiveCampaignConfigured,
  getEmailStats,
} from "@/lib/activecampaign";
import { getConfig } from "@/lib/ssm-config";

async function generateInsights(
  data: Record<string, unknown>,
  section: string,
  period: string,
  apiKey: string,
): Promise<string> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Write 2-3 sentence plain English insights for this ${section} data from ${period}: ${JSON.stringify(data)}. Be specific with numbers and professional.`,
          },
        ],
      }),
    });
    if (!res.ok) return "";
    const d = await res.json();
    return d.content?.[0]?.text ?? "";
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let clientName: string;
  let dateStart: string;
  let dateEnd: string;
  let includeSections: string[];

  try {
    const body = await request.json();
    clientName = body.clientName;
    dateStart = body.dateStart;
    dateEnd = body.dateEnd;
    includeSections = body.includeSections ?? ["pipeline", "email"];
    if (!clientName || !dateStart || !dateEnd)
      throw new Error("clientName, dateStart, dateEnd required");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 },
    );
  }

  const report = await createReport({
    clientName,
    dateStart,
    dateEnd,
    includeSections,
  });

  const cfg = await getConfig();
  const anthropicKey =
    cfg.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "";
  const period = `${dateStart} to ${dateEnd}`;

  const sections: ReportSection[] = [];

  if (includeSections.includes("pipeline") && (await isHubSpotConfigured())) {
    const pipelineData = await getPipelineStats();
    const insights = anthropicKey
      ? await generateInsights(
          pipelineData as unknown as Record<string, unknown>,
          "Lead Pipeline",
          period,
          anthropicKey,
        )
      : "";
    sections.push({
      id: "pipeline",
      title: "Lead Pipeline",
      data: pipelineData as unknown as Record<string, unknown>,
      insights,
    });
  }

  if (
    includeSections.includes("email") &&
    (await isActiveCampaignConfigured())
  ) {
    const emailData = await getEmailStats();
    const insights = anthropicKey
      ? await generateInsights(
          emailData as unknown as Record<string, unknown>,
          "Email Marketing",
          period,
          anthropicKey,
        )
      : "";
    sections.push({
      id: "email",
      title: "Email Marketing",
      data: emailData as unknown as Record<string, unknown>,
      insights,
    });
  }

  const updated = await updateReport(report.id, { sections, status: "ready" });
  return NextResponse.json({ report: updated }, { status: 201 });
}
