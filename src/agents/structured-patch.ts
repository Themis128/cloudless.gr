import { generateObject } from "ai";
import { createWorkersAI } from "workers-ai-provider";
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
  model: string,
  prompt: string
): Promise<StructuredPatch> {
  if (!env.AI) {
    throw new Error("AI binding not configured");
  }

  const workersai = createWorkersAI({
    binding: env.AI,
  });

  const result = await generateObject({
    model: workersai(model),
    schema: StructuredPatchSchema,
    prompt,
  });

  return result.object;
}
