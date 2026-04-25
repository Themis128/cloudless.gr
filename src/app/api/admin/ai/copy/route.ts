import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getConfig } from "@/lib/ssm-config";

async function callClaude(
  prompt: string,
  apiKey: string,
  maxTokens = 1000,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

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

  const cfg = await getConfig();
  const apiKey = cfg.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured." },
      { status: 503 },
    );
  }

  const charLimits: Record<string, { headline: number; body: number }> = {
    Meta: { headline: 40, body: 125 },
    LinkedIn: { headline: 70, body: 150 },
    TikTok: { headline: 50, body: 100 },
    X: { headline: 0, body: 280 },
    Google: { headline: 30, body: 90 },
  };
  const limits = charLimits[platform] ?? { headline: 50, body: 150 };

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
    const text = await callClaude(prompt, apiKey);
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
