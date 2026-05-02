/**
 * Anthropic / Claude AI integration — cloudless.gr
 *
 * Shared client used by:
 *  - /api/chat              — public streaming chatbot (Cloudless Assistant)
 *  - /api/admin/ai/copy     — ad copy generation
 *  - /api/admin/ai/campaign — campaign strategy
 *  - /api/admin/ai/audience — audience targeting
 *  - /api/admin/ai/report-insights — report commentary
 *
 * Configuration:
 *   ANTHROPIC_API_KEY — Anthropic API key (SSM SecureString or .env.local)
 *   ANTHROPIC_CHAT_MODEL — Optional chatbot model override
 */

import { getConfig } from "@/lib/ssm-config";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const VERIFY_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_TOKENS = 1_000;
const DEFAULT_CHAT_MODEL = "claude-3-5-haiku-latest";

export type AnthropicTokenStatus =
  | "valid"
  | "rejected"
  | "not_configured"
  | "error";

const ERROR_STATUS: AnthropicTokenStatus = "error";

// ---------------------------------------------------------------------------
// Key loading
// ---------------------------------------------------------------------------

export async function getAnthropicApiKey(): Promise<string | null> {
  const config = await getConfig();
  return config.ANTHROPIC_API_KEY || null;
}

export async function isAnthropicConfigured(): Promise<boolean> {
  return Boolean(await getAnthropicApiKey());
}

export async function getAnthropicChatModel(): Promise<string> {
  const config = await getConfig();
  return (
    config.ANTHROPIC_CHAT_MODEL?.trim() ||
    process.env.ANTHROPIC_CHAT_MODEL?.trim() ||
    DEFAULT_CHAT_MODEL
  );
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * Pings the Anthropic API with a 1-token request to verify the key is valid.
 * Returns a fine-grained status for the admin integrations health panel.
 */
export async function verifyAnthropicKey(): Promise<{
  status: AnthropicTokenStatus;
  message?: string;
}> {
  const key = await getAnthropicApiKey();
  if (!key) return { status: "not_configured" };

  const model = await getAnthropicChatModel();

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        status: "rejected",
        message: `API key rejected (${res.status}) — check key validity or billing.`,
      };
    }
    if (!res.ok)
      return { status: ERROR_STATUS, message: `API returned ${res.status}` };
    return { status: "valid" };
  } catch {
    return { status: ERROR_STATUS, message: "Connection failed." };
  }
}

// ---------------------------------------------------------------------------
// Non-streaming call (admin AI routes)
// ---------------------------------------------------------------------------

export interface CallClaudeOptions {
  /** Defaults to claude-sonnet-4-6 */
  model?: string;
  /** Defaults to 1000 */
  maxTokens?: number;
  /** Optional system prompt */
  system?: string;
}

/**
 * Single-turn, non-streaming call to the Claude Messages API.
 * Returns the text of the first content block.
 * Throws on API errors — callers should catch and return 500.
 */
export async function callClaude(
  prompt: string,
  apiKey: string,
  options: CallClaudeOptions = {},
): Promise<string> {
  const {
    model = "claude-sonnet-4-6",
    maxTokens = DEFAULT_MAX_TOKENS,
    system,
  } = options;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (system) body.system = system;

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text ?? "";
}
