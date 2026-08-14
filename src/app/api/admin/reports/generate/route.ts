import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createReport, updateReport, type ReportSection } from "@/lib/reports";
import { isEspoCRMConfigured, getPipelineStats } from "@/lib/espocrm";
import {
  isActiveCampaignConfigured,
  getEmailStats,
} from "@/lib/activecampaign";
import {
  buildGoldGscReportSection,
  buildGoldStripeReportSection,
} from "@/lib/report-gold-sections";
import { getConfig } from "@/lib/ssm-config";
import { mapIntegrationError } from "@/lib/api-errors";

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
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return "";
    const d = await res.json() as { content?: Array<{ text?: string }> };
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
    const body = await request.json() as { clientName?: string; dateStart?: string; dateEnd?: string; includeSections?: string[] };
    clientName = body.clientName!;
    dateStart = body.dateStart!;
    dateEnd = body.dateEnd!;
    includeSections = body.includeSections ?? ["pipeline", "email"];
    if (!clientName || !dateStart || !dateEnd)
      throw new Error("clientName, dateStart, dateEnd required");
  } catch (e) {
    const _r = mapIntegrationError(e); if (_r) return _r;
    // Surface only our own validation message; genericise anything else (e.g.
    // a JSON.parse error) so raw exception text is never reflected to clients.
    const isValidation = e instanceof Error && e.message.includes("required");
    return NextResponse.json(
      { error: isValidation ? (e as Error).message : "Invalid input" },
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

  if (includeSections.includes("pipeline") && (await isEspoCRMConfigured())) {
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

  if (includeSections.includes("gsc")) {
    const gsc = await buildGoldGscReportSection(dateStart, dateEnd);
    if (gsc) {
      const insights = anthropicKey
        ? await generateInsights(gsc.data, "Organic Search (GSC gold)", period, anthropicKey)
        : "";
      sections.push({ ...gsc, insights });
    }
  }

  if (includeSections.includes("stripe")) {
    const stripe = await buildGoldStripeReportSection(dateStart, dateEnd);
    if (stripe) {
      const insights = anthropicKey
        ? await generateInsights(stripe.data, "Revenue (Stripe gold)", period, anthropicKey)
        : "";
      sections.push({ ...stripe, insights });
    }
  }

  const updated = await updateReport(report.id, { sections, status: "ready" });
  return NextResponse.json({ report: updated }, { status: 201 });
}
