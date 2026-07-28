/**
 * Google Gemini AI integration for admin routes.
 * Replaces Anthropic/Claude for campaign strategy, ad copy, and admin assistant.
 */

import { getConfig } from "@/lib/ssm-config";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-1.5-flash";
const VERIFY_TIMEOUT_MS = 8_000;

export type GeminiTokenStatus = "valid" | "rejected" | "not_configured" | "error";

// ---------------------------------------------------------------------------
// Key loading
// ---------------------------------------------------------------------------

export async function getGeminiApiKey(): Promise<string | null> {
  const config = await getConfig();
  return config.GEMINI_API_KEY || null;
}

export async function isGeminiConfigured(): Promise<boolean> {
  return Boolean(await getGeminiApiKey());
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export async function verifyGeminiKey(): Promise<{
  status: GeminiTokenStatus;
  message?: string;
}> {
  const key = await getGeminiApiKey();
  if (!key) return { status: "not_configured" };

  try {
    const res = await fetch(`${GEMINI_API}/${GEMINI_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 1 },
      }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      return { status: "rejected", message: `API key rejected (${res.status})` };
    }
    if (!res.ok) return { status: "error", message: `API returned ${res.status}` };
    return { status: "valid" };
  } catch {
    return { status: "error", message: "Connection failed." };
  }
}

// ---------------------------------------------------------------------------
// Non-streaming call (admin AI routes)
// ---------------------------------------------------------------------------

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export async function callGemini(
  prompt: string,
  apiKey: string,
  maxTokens: number = 1000
): Promise<string> {
  const response = await fetch(`${GEMINI_API}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
