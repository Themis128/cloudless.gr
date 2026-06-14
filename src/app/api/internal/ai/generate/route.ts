import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "@/lib/ssm-config";
import {
  getBedrockClient,
  runBedrockTurn,
  joinAssistantText,
  BEDROCK_MODEL_ID,
} from "@/lib/bedrock-shared";

/**
 * POST /api/internal/ai/generate — service-to-service text generation.
 *
 * Used by the weekly newsletter draft cron (and any future internal job)
 * to generate text without needing an Anthropic.com API key. Tries
 * Cloudflare Workers AI first (free tier covers our usage); falls back
 * to AWS Bedrock Claude on any Cloudflare error so a CF outage or quota
 * exhaustion doesn't kill the Monday draft.
 *
 * Auth: shared secret in `x-internal-secret`, compared in constant time
 * with `AI_GENERATE_SECRET` from SSM. Returns 503 if the secret isn't
 * configured (refuses to run open).
 *
 * Body:
 *   {
 *     system?: string,                       // optional system prompt
 *     messages: { role, content: string }[], // required
 *     maxTokens?: number,                    // default 4096
 *     model?: string,                        // CF model id (ignored on Bedrock fallback)
 *   }
 *
 * Response 200:
 *   { result: string, source: "cloudflare" | "bedrock", model: string }
 *
 * NOT in /api/admin/* on purpose: this is machine-to-machine, the secret
 * IS the auth, and we don't want the admin rate limit on cron traffic.
 */

export const runtime = "nodejs";

const DEFAULT_CF_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const FALLBACK_CF_MODEL = "@cf/meta/llama-3-70b-instruct";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface GenerateBody {
  system?: string;
  messages?: ChatMessage[];
  maxTokens?: number;
  model?: string;
}

function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function callCloudflare(
  accountId: string,
  apiToken: string,
  model: string,
  system: string | undefined,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string> {
  const cfMessages = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    ...messages,
  ];
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: cfMessages, max_tokens: maxTokens }),
    },
  );
  const data = (await res.json()) as {
    result?: { response?: string };
    errors?: { message?: string }[];
  };
  if (!res.ok) {
    const reason = data.errors?.[0]?.message ?? `status ${res.status}`;
    throw new Error(`Cloudflare Workers AI: ${reason}`);
  }
  const text = data.result?.response ?? "";
  if (!text.trim()) throw new Error("Cloudflare Workers AI returned empty response");
  return text;
}

async function callBedrock(
  system: string | undefined,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string> {
  const bedrockMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: [{ text: m.content }],
    }));
  const content = await runBedrockTurn({
    client: getBedrockClient(),
    system: system ?? "",
    messages: bedrockMessages,
    toolConfig: { tools: [] },
    maxTokens,
  });
  const text = joinAssistantText(content);
  if (!text) throw new Error("Bedrock returned empty response");
  return text;
}

export async function POST(request: NextRequest): Promise<Response> {
  const config = await getConfig();
  const secret = config.AI_GENERATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Internal AI generation is not configured." },
      { status: 503 },
    );
  }
  if (!secretsMatch(request.headers.get("x-internal-secret"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length || !messages.some((m) => m.role === "user" && m.content?.trim())) {
    return NextResponse.json(
      { error: "messages[] with at least one non-empty user turn is required." },
      { status: 400 },
    );
  }
  const maxTokens = Math.min(Math.max(body.maxTokens ?? 4096, 64), 8192);
  const cfModel = body.model ?? DEFAULT_CF_MODEL;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  // Primary: Cloudflare Workers AI (free tier).
  if (accountId && apiToken) {
    try {
      const result = await callCloudflare(
        accountId,
        apiToken,
        cfModel,
        body.system,
        messages,
        maxTokens,
      );
      return NextResponse.json({ result, source: "cloudflare", model: cfModel });
    } catch (err) {
      console.warn("[internal/ai/generate] Cloudflare failed, trying Bedrock:", err);
      // Try the fallback CF model once before going to Bedrock.
      if (cfModel !== FALLBACK_CF_MODEL) {
        try {
          const result = await callCloudflare(
            accountId,
            apiToken,
            FALLBACK_CF_MODEL,
            body.system,
            messages,
            maxTokens,
          );
          return NextResponse.json({
            result,
            source: "cloudflare",
            model: FALLBACK_CF_MODEL,
          });
        } catch (err2) {
          console.warn("[internal/ai/generate] fallback CF model also failed:", err2);
        }
      }
    }
  }

  // Fallback: Bedrock (uses Lambda IAM, no API key).
  try {
    const result = await callBedrock(body.system, messages, maxTokens);
    return NextResponse.json({ result, source: "bedrock", model: BEDROCK_MODEL_ID });
  } catch (err) {
    console.error("[internal/ai/generate] Bedrock also failed:", err);
    return NextResponse.json(
      {
        error: "All AI providers failed.",
        detail: (err as Error)?.message ?? String(err),
      },
      { status: 502 },
    );
  }
}
