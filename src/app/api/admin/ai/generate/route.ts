import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

/**
 * POST /api/admin/ai/generate — Cloudflare Workers AI text generation.
 *
 * Body: { prompt: string, model?: string }
 * Returns: { success: true, result, model, usage: { inputTokens, outputTokens } }
 *
 * @auth Requires admin session or Bearer token (401 / 403). Each call costs
 *       Workers AI inference, so this is deliberately NOT a public endpoint;
 *       /api/admin/* also gets the shared admin rate limit from proxy.ts.
 * @returns 503 if CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN are not set.
 */

export const runtime = "nodejs";

const DEFAULT_MODEL = "@cf/meta/llama-3-8b-instruct";
const ALLOWED_MODELS = new Set(["@cf/meta/llama-3-8b-instruct", "@cf/meta/llama-3-70b-instruct"]);

interface GenerateRequest {
  prompt?: string;
  model?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: GenerateRequest;
  try {
    body = (((await request.json()) as any)) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  const model = body.model && ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return NextResponse.json({ error: "Cloudflare Workers AI not configured." }, { status: 503 });
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      }
    );

    const data = (((await response.json()) as any)) as {
      result?: { response?: string; input_tokens?: number; output_tokens?: number };
      errors?: { message?: string }[];
    };

    if (!response.ok) {
      return NextResponse.json(
        { error: `Cloudflare API error: ${data.errors?.[0]?.message ?? "Unknown error"}` },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    return NextResponse.json({
      success: true,
      result: data.result?.response ?? "",
      model,
      usage: {
        inputTokens: data.result?.input_tokens ?? 0,
        outputTokens: data.result?.output_tokens ?? 0,
      },
    });
  } catch (error) {
    console.error("[Workers AI] generate error:", error);
    return NextResponse.json({ error: "Failed to generate AI response" }, { status: 500 });
  }
}
