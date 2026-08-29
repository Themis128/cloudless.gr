import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  adminAiNotConfiguredResponse,
  generateAdminAiText,
  isAdminAiConfiguredAsync,
} from "@/lib/admin-ai";

interface CampaignRequest {
  brief?: string;
  budget?: string;
  targetAudience?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let brief: string;
  let budget: string;
  let targetAudience: string;
  try {
    const body = (await request.json()) as CampaignRequest;
    brief = String(body.brief ?? "").slice(0, 2000);
    budget = String(body.budget ?? "unspecified").slice(0, 200);
    targetAudience = String(body.targetAudience ?? "unspecified").slice(0, 500);
    if (!brief) throw new Error("brief is required");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 }
    );
  }

  if (!(await isAdminAiConfiguredAsync())) {
    return adminAiNotConfiguredResponse();
  }

  const prompt = `You are a digital marketing expert for Cloudless.gr, a Greek digital agency specialising in AI-powered marketing services.

Given this campaign brief, generate a detailed campaign strategy:

Brief: ${brief}
Budget: ${budget}
Target Audience: ${targetAudience}

Respond with a JSON object (no markdown fences, just the raw JSON) with this structure:
{
  "recommended_platforms": ["Meta", "LinkedIn", "TikTok", "X", "Google"],
  "campaign_objective": "string",
  "budget_split": { "platform": percentage },
  "audience": {
    "platform": { "targeting": "description", "age": "range", "geo": "location" }
  },
  "ad_formats": ["format"],
  "copy_suggestions": {
    "headline": ["3 variants"],
    "body": ["3 variants"],
    "cta": ["3 variants"]
  },
  "estimated_results": {
    "platform": { "reach": "estimate", "cpc": "estimate", "leads": "estimate" }
  },
  "timeline": "recommended campaign duration"
}`;

  try {
    const { text, provider } = await generateAdminAiText(prompt, { maxTokens: 1_500 });
    let strategy: unknown;
    try {
      strategy = JSON.parse(text.replaceAll(/```json\n?|\n?```/g, "").trim());
    } catch {
      strategy = { raw: text };
    }
    return NextResponse.json({ strategy, provider });
  } catch (e) {
    console.error("[ai/campaign] generation failed:", e);
    if (e instanceof Error && e.name === "AdminAiNotConfigured")
      return adminAiNotConfiguredResponse();
    return NextResponse.json({ error: "AI generation failed." }, { status: 500 });
  }
}
