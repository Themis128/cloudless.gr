/**
 * Admin AI text generation — priority chain:
 *   1. NVIDIA proxy (nemotron-3.5-lightning-30b-a3b, extended thinking, reasoning stripped)
 *   2. Cloudflare Workers AI (llama-3.1-8b, no thinking)
 *   3. Ollama self-hosted (qwen2.5-coder or OLLAMA_MODEL, Tailscale-reachable)
 *   4. Gemini external API (last resort)
 */

import { callWorkersAiChat, isWorkersAiConfigured } from "@/lib/workers-ai-client";
import { isNvidiaProxyConfigured, callNvidiaProxyChat } from "@/lib/nvidia-proxy-client";
import { isOllamaConfigured, callOllamaChat } from "@/lib/ollama-client";
import { callGemini, getGeminiApiKey } from "@/lib/gemini-admin";

export function isAdminAiConfigured(): boolean {
  return (
    isNvidiaProxyConfigured() ||
    isWorkersAiConfigured() ||
    isOllamaConfigured() ||
    Boolean(process.env.GEMINI_API_KEY)
  );
}

export async function isAdminAiConfiguredAsync(): Promise<boolean> {
  if (isNvidiaProxyConfigured()) return true;
  if (isWorkersAiConfigured()) return true;
  if (isOllamaConfigured()) return true;
  return Boolean(await getGeminiApiKey());
}

export type AdminAiGenerateOpts = {
  maxTokens?: number;
  system?: string;
  /** Workers AI model override (ignored when NVIDIA proxy is active) */
  model?: string;
};

export type AdminAiProvider = "nvidia-proxy" | "workers-ai" | "ollama" | "gemini";

/**
 * Single-turn admin generation.
 * Priority: NVIDIA proxy → Workers AI → Ollama → Gemini.
 * Throws if no backend is configured or all fail.
 */
export async function generateAdminAiText(
  prompt: string,
  opts: AdminAiGenerateOpts = {}
): Promise<{ text: string; provider: AdminAiProvider }> {
  const maxTokens = opts.maxTokens ?? 1000;
  const messages: { role: string; content: string }[] = [];
  if (opts.system?.trim()) {
    messages.push({ role: "system", content: opts.system.trim() });
  }
  messages.push({ role: "user", content: prompt });

  if (isNvidiaProxyConfigured()) {
    try {
      const text = await callNvidiaProxyChat(messages, { maxTokens });
      if (text.trim()) return { text, provider: "nvidia-proxy" };
    } catch (err) {
      console.warn(
        "[admin-ai] NVIDIA proxy failed, trying Workers AI:",
        err instanceof Error ? err.message : err
      );
    }
  }

  if (isWorkersAiConfigured()) {
    try {
      const text = await callWorkersAiChat(messages, { maxTokens, model: opts.model });
      if (text.trim()) return { text, provider: "workers-ai" };
    } catch (err) {
      console.warn(
        "[admin-ai] Workers AI failed, trying Ollama:",
        err instanceof Error ? err.message : err
      );
    }
  }

  if (isOllamaConfigured()) {
    try {
      const text = await callOllamaChat(messages, { maxTokens });
      if (text.trim()) return { text, provider: "ollama" };
    } catch (err) {
      console.warn(
        "[admin-ai] Ollama failed, trying Gemini:",
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
    "Admin AI not configured — set NVIDIA_PROXY_URL+NVIDIA_PROXY_TOKEN, or CLOUDFLARE_ACCOUNT_ID+CLOUDFLARE_API_TOKEN, or OLLAMA_BASE_URL, or GEMINI_API_KEY"
  );
  err.name = "AdminAiNotConfigured";
  throw err;
}

export function adminAiNotConfiguredResponse(): Response {
  return Response.json(
    {
      error:
        "Admin AI not configured. Set NVIDIA_PROXY_URL, CLOUDFLARE_ACCOUNT_ID, OLLAMA_BASE_URL, or GEMINI_API_KEY.",
    },
    { status: 503 }
  );
}
