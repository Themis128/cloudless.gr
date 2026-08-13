/**
 * Admin AI text generation — Workers AI primary, Gemini fallback.
 * Used by Marketing Hub routes that previously required ANTHROPIC_API_KEY.
 */

import { callWorkersAiChat, isWorkersAiConfigured } from "@/lib/workers-ai-client";
import { callGemini, getGeminiApiKey } from "@/lib/gemini-admin";

export function isAdminAiConfigured(): boolean {
  return isWorkersAiConfigured() || Boolean(process.env.GEMINI_API_KEY);
}

export async function isAdminAiConfiguredAsync(): Promise<boolean> {
  if (isWorkersAiConfigured()) return true;
  return Boolean(await getGeminiApiKey());
}

export type AdminAiGenerateOpts = {
  maxTokens?: number;
  system?: string;
  /** Prefer Workers AI model override */
  model?: string;
};

/**
 * Single-turn admin generation. Tries Workers AI first, then Gemini.
 * Throws if neither backend is configured or both fail.
 */
export async function generateAdminAiText(
  prompt: string,
  opts: AdminAiGenerateOpts = {}
): Promise<{ text: string; provider: "workers-ai" | "gemini" }> {
  const maxTokens = opts.maxTokens ?? 1000;
  const messages: { role: string; content: string }[] = [];
  if (opts.system?.trim()) {
    messages.push({ role: "system", content: opts.system.trim() });
  }
  messages.push({ role: "user", content: prompt });

  if (isWorkersAiConfigured()) {
    try {
      const text = await callWorkersAiChat(messages, {
        maxTokens,
        model: opts.model,
      });
      if (text.trim()) return { text, provider: "workers-ai" };
    } catch (err) {
      console.warn(
        "[admin-ai] Workers AI failed, trying Gemini:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const geminiKey = (await getGeminiApiKey()) || process.env.GEMINI_API_KEY || "";
  if (geminiKey) {
    const fullPrompt = opts.system?.trim() ? `${opts.system.trim()}\n\n${prompt}` : prompt;
    const text = await callGemini(fullPrompt, geminiKey, maxTokens);
    return { text, provider: "gemini" };
  }

  const err = new Error(
    "Admin AI not configured — set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (Workers AI) or GEMINI_API_KEY"
  );
  err.name = "AdminAiNotConfigured";
  throw err;
}

export function adminAiNotConfiguredResponse(): Response {
  return Response.json(
    {
      error:
        "Admin AI not configured. Set Cloudflare Workers AI (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN) or GEMINI_API_KEY.",
    },
    { status: 503 }
  );
}
