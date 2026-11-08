import { generateObject } from "ai";
import {
  createAI,
  type CloudflareLanguageModelId,
} from "agents/models/ai-sdk";
import { z } from "zod";

export const StructuredPatchSchema = z.object({
  summary: z.string(),
  evidence: z.array(z.string()),
  proposedChanges: z.array(z.string()),
  unifiedDiff: z.string(),
  commandsToRun: z.array(z.string()),
  verificationPlan: z.array(z.string()),
  risks: z.array(z.string()),
  safeToApply: z.boolean(),
});

export type StructuredPatch = z.infer<typeof StructuredPatchSchema>;

export async function generateStructuredPatch(
  env: Env,
  model: CloudflareLanguageModelId,
  prompt: string
): Promise<StructuredPatch> {
  if (!env.AI) {
    throw new Error("AI binding not configured");
  }

  const ai = createAI({ binding: env.AI });

  const result = await generateObject({
    model: ai(model),
    schema: StructuredPatchSchema,
    prompt,
  });

  return result.object;
}
