import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "@/lib/ssm-config";
import { callGemini } from "@/lib/gemini-admin";

/**
 * POST /api/internal/ai/generate — service-to-service text generation.
 *
 * Used by the weekly newsletter draft cron (and any future internal job)
 * to generate text without needing an API key. Tries Cloudflare Workers AI
 * first (free tier covers our usage); falls back to Gemini on any failure
 * so a CF outage or quota exhaustion doesn't kill the Monday draft.
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
 *     model?: string,                        // CF model id (ignored on Gemini fallback)
 *   }
 *
 * Response 200:
 *   { result: string, source: "cloudflare" | "gemini", model: string }
 *
 * NOT in /api/admin/* on purpose: this is machine-to-machine, the secret
 * IS the auth, and we don't want the admin rate limit on cron traffic.
 */

export const runtime = "nodejs";

const DEFAULT_CF_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const FALLBACK_CF_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const GEMINI_MODEL = "gemini-1.5-flash";

/**
 * Strict allowlist for `model` values passed in the request body. The
 * value is interpolated into the Cloudflare Workers AI URL, so anything
 * outside this pattern is rejected — a single AI_GENERATE_SECRET leak
 * must not turn into an arbitrary outbound HTTP request via path
 * traversal or URL re-hosting tricks (CodeQL SSRF, alert #1784).
 *
 * Pattern: @<provider>/<vendor>/<model-name> — only the alphabet that
 * appears in real Cloudflare Workers AI catalog entries, no `.`, `..`,
 * `@`, `/`, or query string. Both segments are length-bounded.
 */
const ALLOWED_MODEL_RE = /^@[a-z]{2,8}\/[a-z0-9][a-z0-9_-]{1,40}\/[a-z0-9][a-z0-9._-]{1,80}$/;

function isAllowedCfModel(m: unknown): m is string {
  return typeof m === "string" && ALLOWED_MODEL_RE.test(m);
}

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
  maxTokens: number
): Promise<string> {
  if (!isAllowedCfModel(model)) {
    throw new Error("Refusing to call Cloudflare with non-allowlisted model id");
  }
  const cfMessages = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    ...messages,
  ];
  const url = new URL(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`
  );
  if (url.host !== "api.cloudflare.com") {
    throw new Error(`Refusing to call non-Cloudflare host: ${url.host}`);
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages: cfMessages, max_tokens: maxTokens }),
  });
  const data = (await res.json()) as any as {
    result?: { response?: unknown };
    errors?: { message?: string }[];
  };
  if (!res.ok) {
    const reason = data.errors?.[0]?.message ?? `status ${res.status}`;
    throw new Error(`Cloudflare Workers AI: ${reason}`);
  }
  const raw = data.result?.response;
  const text = typeof raw === "string" ? raw : raw == null ? "" : JSON.stringify(raw);
  if (!text.trim()) throw new Error("Cloudflare Workers AI returned empty response");
  return text;
}

async function callGeminiFallback(
  system: string | undefined,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const config = await getConfig();
  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  // Build Gemini-compatible message format
  const geminiMessages = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    content: m.content,
  }));

  const prompt = system
    ? `${system}\n\n${geminiMessages.map((m) => m.content).join("\n")}`
    : geminiMessages.map((m) => m.content).join("\n");

  return callGemini(prompt, apiKey, maxTokens);
}

export async function POST(request: NextRequest): Promise<Response> {
  const config = await getConfig();
  const secret = config.AI_GENERATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Internal AI generation is not configured." },
      { status: 503 }
    );
  }
  if (!secretsMatch(request.headers.get("x-internal-secret"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: GenerateBody;
  try {
    body = (await request.json()) as any as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length || !messages.some((m) => m.role === "user" && m.content?.trim())) {
    return NextResponse.json(
      { error: "messages[] with at least one non-empty user turn is required." },
      { status: 400 }
    );
  }
  const maxTokens = Math.min(Math.max(body.maxTokens ?? 4096, 64), 8192);

  if (body.model !== undefined && !isAllowedCfModel(body.model)) {
    return NextResponse.json(
      { error: "Invalid `model`. Expected pattern @<provider>/<vendor>/<name>." },
      { status: 400 }
    );
  }
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
        maxTokens
      );
      return NextResponse.json({ result, source: "cloudflare", model: cfModel });
    } catch (err) {
      console.warn("[internal/ai/generate] Cloudflare failed, trying fallback:", err);
      // Try the fallback CF model once before going to Gemini.
      if (cfModel !== FALLBACK_CF_MODEL) {
        try {
          const result = await callCloudflare(
            accountId,
            apiToken,
            FALLBACK_CF_MODEL,
            body.system,
            messages,
            maxTokens
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

  // Fallback: Gemini (uses GEMINI_API_KEY from config).
  try {
    const result = await callGeminiFallback(body.system, messages, maxTokens);
    return NextResponse.json({ result, source: "gemini", model: GEMINI_MODEL });
  } catch (err) {
    console.error("[internal/ai/generate] Gemini also failed:", err);
    return NextResponse.json(
      {
        error: "All AI providers failed.",
        detail: (err as Error)?.message ?? String(err),
      },
      { status: 502 }
    );
  }
}