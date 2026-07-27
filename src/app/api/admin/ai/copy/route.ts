import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { callClaude, getAnthropicApiKey } from "@/lib/anthropic";

interface CopyRequest {
  service?: string;
  platform?: string;
  objective?: string;
  language?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let service: string;
  let platform: string;
  let objective: string;
  let language: string;
  try {
    const body = (await request.json()) as CopyRequest;
    service = String(body.service ?? "").slice(0, 2000);
    platform = String(body.platform ?? "Meta").slice(0, 50);
    objective = String(body.objective ?? "awareness").slice(0, 200);
    language = String(body.language ?? "English").slice(0, 50);
    if (!service) throw new Error("service is required");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 }
    );
  }

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured." }, { status: 503 });
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
      variants = JSON.parse(text.replaceAll(/```json\n?|\n?```/g, "").trim());
    } catch {
      variants = { raw: text };
    }
    return NextResponse.json({ variants });
  } catch (e) {
    console.error("[ai/copy] Claude call failed:", e);
    return NextResponse.json({ error: "AI generation failed." }, { status: 500 });
  }
}
