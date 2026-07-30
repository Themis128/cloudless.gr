/**
 * Text embeddings via Cloudflare Workers AI.
 *
 * Primary model: @cf/baai/bge-small-en-v1.5 (384-dim).
 * Fail-closed when CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN are unset.
 * No Bedrock / Titan fallback.
 */

import { callWorkersAiEmbed, isWorkersAiConfigured } from "@/lib/workers-ai-client";

export const WORKERS_AI_EMBED_MODEL =
  process.env.WORKERS_AI_EMBED_MODEL || "@cf/baai/bge-small-en-v1.5";

export const WORKERS_AI_EMBED_DIMENSIONS = Number.parseInt(
  process.env.WORKERS_AI_EMBED_DIMENSIONS || "384",
  10
);

/** @deprecated alias — use WORKERS_AI_EMBED_DIMENSIONS */
export const BEDROCK_EMBED_DIMENSIONS = WORKERS_AI_EMBED_DIMENSIONS;

/** @deprecated alias — use WORKERS_AI_EMBED_MODEL */
export const BEDROCK_TITAN_EMBED_MODEL_ID = WORKERS_AI_EMBED_MODEL;

export function normalizeEmbeddingInput(input: string): string {
  return input.replace(/\s+/g, " ").trim().slice(0, 50_000);
}

export function isEmbeddingsConfigured(): boolean {
  return isWorkersAiConfigured();
}

/**
 * Embed text with Workers AI. Throws when CF credentials are missing or the
 * API returns an unusable payload.
 */
export async function embedTextWithWorkersAi(input: string): Promise<number[]> {
  const inputText = normalizeEmbeddingInput(input);
  if (!inputText) {
    throw new Error("Cannot embed empty text");
  }
  return callWorkersAiEmbed(inputText, { model: WORKERS_AI_EMBED_MODEL });
}

/** @deprecated alias — use embedTextWithWorkersAi */
export const embedTextWithTitan = embedTextWithWorkersAi;
