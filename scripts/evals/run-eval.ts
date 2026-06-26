/**
 * LangSmith evaluation suite for cloudless.gr
 *
 * Implements:
 *   - Traceable Anthropic target function
 *   - LLM-as-judge correctness evaluator (anthropic:claude-opus-4-8)
 *   - Conciseness evaluator
 *   - Exact-match evaluator (no LLM cost)
 *   - Multi-evaluator experiment run against ds-advanced-kayak-81
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *   LANGSMITH_API_KEY=lsv2_pt_... \
 *   LANGSMITH_TRACING=true \
 *   pnpm tsx scripts/evals/run-eval.ts
 */

import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";
import {
  createLLMAsJudge,
  exactMatch,
  CORRECTNESS_PROMPT,
  CONCISENESS_PROMPT,
} from "openevals";
import Anthropic from "@anthropic-ai/sdk";
import { evaluate } from "langsmith/evaluation";

// ── Clients ───────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const client = new Client();

// ── Target function ───────────────────────────────────────────────────────────
// traceable() wraps the function so every invocation appears as a traced span
// in LangSmith under the experiment run.

const callClaude = traceable(
  async (question: string): Promise<string> => {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Answer the following question accurately and concisely.\n\n${question}`,
        },
      ],
    });
    return response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
  },
  { name: "claude-opus-4-8", run_type: "llm" }
);

async function target(inputs: { question: string }): Promise<{ answer: string }> {
  const answer = await callClaude(inputs.question);
  return { answer };
}

// ── Evaluators ────────────────────────────────────────────────────────────────

type EvalParams = {
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  referenceOutputs?: Record<string, unknown>;
};

// LLM-as-judge: correctness against reference answer
const correctnessEvaluator = async (params: EvalParams) => {
  const evaluator = createLLMAsJudge({
    prompt: CORRECTNESS_PROMPT,
    model: "anthropic:claude-opus-4-8",
    feedbackKey: "correctness",
  });
  return evaluator({
    inputs: { question: params.inputs.question ?? "" },
    outputs: { answer: params.outputs.answer ?? "" },
    referenceOutputs: { answer: params.referenceOutputs?.answer ?? "" },
  });
};

// LLM-as-judge: conciseness (no reference needed)
const concisenessEvaluator = async (params: EvalParams) => {
  const evaluator = createLLMAsJudge({
    prompt: CONCISENESS_PROMPT,
    model: "anthropic:claude-opus-4-8",
    feedbackKey: "conciseness",
  });
  return evaluator({
    inputs: { question: params.inputs.question ?? "" },
    outputs: { answer: params.outputs.answer ?? "" },
  });
};

// Exact match: cheap string comparison, no LLM cost
const exactMatchEvaluator = (params: EvalParams) =>
  exactMatch({
    outputs: params.outputs,
    referenceOutputs: params.referenceOutputs ?? {},
  });

// ── Experiment ────────────────────────────────────────────────────────────────

async function main() {
  console.log("Starting evaluation against dataset: ds-advanced-kayak-81");

  const results = await evaluate(target, {
    data: "ds-advanced-kayak-81",
    evaluators: [correctnessEvaluator, concisenessEvaluator, exactMatchEvaluator],
    experimentPrefix: "cloudless-gr-claude-opus-4-8",
    maxConcurrency: 2,
    metadata: {
      model: "claude-opus-4-8",
      project: "cloudless.gr",
      evalSuite: "v1",
    },
    client,
  });

  console.log(`\nExperiment complete: ${results.experimentName}`);
  console.log(
    `View at: https://smith.langchain.com/o/609776f8-8d30-4b4a-b870-f04a8fed57f5/datasets/4ddc9bba-aa8e-4f57-ab6e-36a59c3736f7/compare`
  );
}

main().catch(console.error);
