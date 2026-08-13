/**
 * Low-level Cloudflare Workers AI REST client (account + API token).
 * Shared by chat, agents, and embeddings — no AWS Bedrock dependency.
 *
 * When CLOUDFLARE_AI_GATEWAY_ID is set, requests go through AI Gateway
 * (free caching, rate limits, request logs).
 */

import { recordAdminAiCall } from "@/lib/admin-ai-usage";

const DEFAULT_CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export function isWorkersAiConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

export function isAiGatewayConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_API_TOKEN &&
    process.env.CLOUDFLARE_AI_GATEWAY_ID
  );
}

export function requireWorkersAiConfig(): { accountId: string; apiToken: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    const err = new Error("Workers AI not configured");
    err.name = "UnauthorizedException";
    throw err;
  }
  return { accountId, apiToken };
}

/** Build Workers AI run URL — AI Gateway when configured, else direct. */
export function workersAiRunUrl(accountId: string, model: string): string {
  const gatewayId = process.env.CLOUDFLARE_AI_GATEWAY_ID?.trim();
  if (gatewayId) {
    return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/workers-ai/${model}`;
  }
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
}

interface CfAiResult {
  result?: { response?: string; data?: number[][]; shape?: number[] };
  errors?: { message?: string }[];
  success?: boolean;
}

const THINKING_TAG_RE = /<thinking>[\s\S]*?<\/thinking>\s*/gi;

export function stripThinkingTags(text: string): string {
  return text.replace(THINKING_TAG_RE, "").trim();
}

/**
 * Run a chat-completions-style Workers AI model and return assistant text.
 */
export async function callWorkersAiChat(
  messages: { role: string; content: string }[],
  opts?: { maxTokens?: number; model?: string }
): Promise<string> {
  const { accountId, apiToken } = requireWorkersAiConfig();
  const model = opts?.model || process.env.WORKERS_AI_CHAT_MODEL || DEFAULT_CHAT_MODEL;
  const viaGateway = Boolean(process.env.CLOUDFLARE_AI_GATEWAY_ID?.trim());
  const started = Date.now();

  try {
    const response = await fetch(workersAiRunUrl(accountId, model), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        max_tokens: opts?.maxTokens ?? 600,
      }),
    });

    const data = (await response.json()) as CfAiResult;
    if (!response.ok) {
      const message = data.errors?.[0]?.message ?? `Workers AI HTTP ${response.status}`;
      recordAdminAiCall({
        ok: false,
        model,
        viaGateway,
        latencyMs: Date.now() - started,
        error: message,
      });
      const err = new Error(message);
      err.name =
        response.status === 401 || response.status === 403 ? "UnauthorizedException" : "AiError";
      throw err;
    }

    const text = stripThinkingTags(data.result?.response ?? "");
    recordAdminAiCall({
      ok: true,
      model,
      viaGateway,
      latencyMs: Date.now() - started,
    });
    return text;
  } catch (err) {
    if (err instanceof Error && (err.name === "UnauthorizedException" || err.name === "AiError")) {
      throw err;
    }
    recordAdminAiCall({
      ok: false,
      model,
      viaGateway,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "Workers AI request failed",
    });
    throw err;
  }
}

export type WorkersAiToolCall = { name: string; args: Record<string, unknown> };

/**
 * Parse a single JSON tool-call object from a model reply.
 * Expected shape: {"tool":"<name>","args":{...}}
 */
export function parseWorkersAiToolCall(text: string): WorkersAiToolCall | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*"tool"[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      tool?: string;
      args?: Record<string, unknown>;
    };
    if (!parsed.tool || typeof parsed.tool !== "string") return null;
    return { name: parsed.tool, args: parsed.args ?? {} };
  } catch {
    return null;
  }
}

export function buildWorkersAiToolProtocol(
  tools: ReadonlyArray<{
    name: string;
    description: string;
    input_schema: unknown;
  }>
): string {
  const catalog = tools
    .map((t) => `- ${t.name}: ${t.description}\n  args schema: ${JSON.stringify(t.input_schema)}`)
    .join("\n");
  return `
When you need a tool, reply with ONLY a single JSON object (no markdown):
{"tool":"<name>","args":{...}}
After you receive tool results in the conversation, either call another tool the same way or answer in plain text.
Never invent tool results. Available tools:
${catalog}
`;
}

/**
 * Embed text via Workers AI (@cf/baai/bge-small-en-v1.5 → 384-dim).
 */
export async function callWorkersAiEmbed(
  text: string,
  opts?: { model?: string }
): Promise<number[]> {
  const { accountId, apiToken } = requireWorkersAiConfig();
  const model = opts?.model || process.env.WORKERS_AI_EMBED_MODEL || "@cf/baai/bge-small-en-v1.5";

  const response = await fetch(workersAiRunUrl(accountId, model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: [text] }),
  });

  const data = (await response.json()) as CfAiResult;
  if (!response.ok) {
    const err = new Error(data.errors?.[0]?.message ?? `Workers AI embed HTTP ${response.status}`);
    err.name =
      response.status === 401 || response.status === 403 ? "UnauthorizedException" : "AiError";
    throw err;
  }

  const vector = data.result?.data?.[0];
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("Workers AI embedding response did not include data[0]");
  }
  return vector.map((v) => Number(v));
}
