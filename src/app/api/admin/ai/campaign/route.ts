import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { callClaude, getAnthropicApiKey } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let brief: string;
  let budget: string;
  let targetAudience: string;
  try {
    const body = await request.json();
    brief = body.brief;
    budget = body.budget ?? "unspecified";
    targetAudience = body.targetAudience ?? "unspecified";
    if (!brief) throw new Error("brief is required");
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
    const text = await callClaude(prompt, apiKey, { maxTokens: 1_500 });
    let strategy: unknown;
    try {
      strategy = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      strategy = { raw: text };
    }
    return NextResponse.json({ strategy });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI generation failed." },
      { status: 500 },
    );
  }
}
