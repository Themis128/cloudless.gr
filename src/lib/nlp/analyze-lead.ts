import { z } from "zod";
import { callWorkersAiChat, isWorkersAiConfigured } from "@/lib/workers-ai-client";
import { extractLeadEntities } from "./entities";
import { classifyIntentLocal, detectLeadLocale } from "./language";
import { LEAD_INTENTS, type AnalyzeLeadInput, type LeadIntent, type LeadNlpResult } from "./types";

const NLP_MODEL =
  process.env.WORKERS_AI_NLP_MODEL?.trim() || "@cf/meta/llama-3.2-3b-instruct";

const LeadNlpSchema = z.object({
  intent: z.enum(LEAD_INTENTS as [LeadIntent, ...LeadIntent[]]),
  locale: z.enum(["en", "el"]),
  confidence: z.number().min(0).max(1),
  entities: z
    .object({
      budget: z.string().optional(),
      timeline: z.string().optional(),
      product: z.string().optional(),
    })
    .optional(),
  reasons: z.array(z.string()).optional(),
});

function shouldSkipLlm(): boolean {
  if (process.env.NEXT_PUBLIC_E2E === "1") return true;
  if (process.env.NLP_LEAD_LLM === "0") return true;
  if (!isWorkersAiConfigured()) return true;
  return false;
}

function localAnalyze(input: AnalyzeLeadInput): LeadNlpResult {
  const locale = detectLeadLocale(input.message, input.pageLocale);
  const classified = classifyIntentLocal(input.message, input.service);
  const entities = extractLeadEntities(input.message);
  return {
    intent: classified.intent,
    locale,
    entities,
    confidence: classified.confidence,
    reasons: classified.reasons,
    source: "local",
  };
}

function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

async function workersAiAnalyze(input: AnalyzeLeadInput): Promise<LeadNlpResult | null> {
  const prompt = [
    "Classify this contact-form message. Reply with JSON only:",
    '{"intent":"quote_request|booking|support|partnership|spam_or_noise|general_inquiry",',
    '"locale":"en|el","confidence":0-1,',
    '"entities":{"budget":"","timeline":"","product":""},"reasons":["..."]}',
    "",
    `pageLocale=${input.pageLocale ?? "en"}`,
    `service=${input.service ?? ""}`,
    `message=${input.message.slice(0, 1500)}`,
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    // callWorkersAiChat has no AbortSignal — race with timeout instead.
    const text = await Promise.race([
      callWorkersAiChat(
        [
          {
            role: "system",
            content:
              "You are a lead classifier for a Greek/English cloud consulting site. Output JSON only.",
          },
          { role: "user", content: prompt },
        ],
        { maxTokens: 220, model: NLP_MODEL }
      ),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error("nlp timeout")));
      }),
    ]);
    const raw = extractJsonObject(text);
    if (!raw) return null;
    const parsed = LeadNlpSchema.safeParse(raw);
    if (!parsed.success) return null;
    const localEntities = extractLeadEntities(input.message);
    return {
      intent: parsed.data.intent,
      locale: parsed.data.locale,
      confidence: parsed.data.confidence,
      entities: { ...localEntities, ...parsed.data.entities },
      reasons: parsed.data.reasons?.length
        ? parsed.data.reasons
        : [`workers-ai intent:${parsed.data.intent}`],
      source: "workers-ai",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Analyze a contact message: local heuristics first; Workers AI when confidence
 * is low and credentials exist. Never throws — contact API must stay up.
 */
export async function analyzeLeadMessage(input: AnalyzeLeadInput): Promise<LeadNlpResult> {
  const local = localAnalyze(input);
  if (shouldSkipLlm()) return local;
  if (local.confidence >= 0.85 && local.intent !== "general_inquiry") {
    return local;
  }
  const ai = await workersAiAnalyze(input);
  if (!ai) {
    return { ...local, source: "fallback", reasons: [...local.reasons, "llm unavailable"] };
  }
  return ai;
}
