import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { callClaude, getAnthropicApiKey } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let service: string;
  let platform: string;
  let objective: string;
  let language: string;
  try {
    const body = await request.json();
    service = body.service;
    platform = body.platform ?? "Meta";
    objective = body.objective ?? "awareness";
    language = body.language ?? "English";
    if (!service) throw new Error("service is required");
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

  const CHAR_LIMITS: Record<string, { headline: number; body: number }> = {
    Meta: { headline: 40, body: 125 }, // NOSONAR — platform-defined character limits
    LinkedIn: { headline: 70, body: 150 }, // NOSONAR
    TikTok: { headline: 50, body: 100 }, // NOSONAR
    X: { headline: 0, body: 280 }, // NOSONAR
    Google: { headline: 30, body: 90 }, // NOSONAR
  };
  const DEFAULT_CHAR_LIMIT = { headline: 50, body: 150 }; // NOSONAR
  const limits = CHAR_LIMITS[platform] ?? DEFAULT_CHAR_LIMIT;

  const prompt = `Generate 5 ad copy variants for this service:

Service: ${service}
Platform: ${platform}
Objective: ${objective}
Language: ${language}
Character limits: Headline ${limits.headline > 0 ? limits.headline : "N/A"} chars, Body ${limits.body} chars

Respond with raw JSON only (no markdown fences):
{
  "variants": [
    {
      "headline": "string",
      "body": "string",
      "cta": "string",
      "tone": "professional|playful|urgent|emotional"
    }
  ]
}`;

  try {
    const text = await callClaude(prompt, apiKey, { maxTokens: 1_000 });
    let variants: unknown;
    try {
      variants = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      variants = { raw: text };
    }
    return NextResponse.json({ variants });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI generation failed." },
      { status: 500 },
    );
  }
}
