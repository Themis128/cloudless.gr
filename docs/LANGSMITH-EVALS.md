# LangSmith Evaluations

End-to-end evaluation suite for cloudless.gr AI features using LangSmith + openevals + Anthropic.

## Quick start

```bash
# 1. Seed datasets into LangSmith (idempotent — safe to re-run)
LANGSMITH_API_KEY=<your-langsmith-api-key> \
pnpm evals:seed

# 2. Run the full experiment
ANTHROPIC_API_KEY=$(aws ssm get-parameter \
  --name /cloudless/production/ANTHROPIC_API_KEY \
  --with-decryption --query Parameter.Value --output text) \
LANGSMITH_API_KEY=<your-langsmith-api-key> \
LANGSMITH_TRACING=true \
pnpm evals:run
```

Results: https://smith.langchain.com → Datasets → compare experiments.

## Prerequisites

```bash
pnpm add langsmith openevals @anthropic-ai/sdk
```

| Package | Purpose |
|---------|---------|
| `langsmith` | Dataset management, experiment runner, tracing |
| `openevals` | Pre-built evaluator prompts (CORRECTNESS, CONCISENESS, exactMatch…) |
| `@anthropic-ai/sdk` | Target LLM + LLM-as-judge (`claude-opus-4-8`) |

## Environment variables

Set in `.env.local`:

```bash
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=<your-langsmith-api-key>
# ANTHROPIC_API_KEY — fetch from SSM: /cloudless/production/ANTHROPIC_API_KEY
```

> No `OPENAI_API_KEY` needed — judge and target both use `anthropic:claude-opus-4-8`.

## Files

| File | Purpose |
|------|---------|
| `scripts/evals/seed-datasets.mts` | Idempotent dataset seeder |
| `scripts/evals/run-eval.ts` | Full experiment: target + 3 evaluators |
| `scripts/evals/create-dataset.mts` | One-off quickstart dataset creation |

## Architecture

### 1. Datasets (`seed-datasets.mts`)

Two datasets in LangSmith:

| Dataset | ID | Purpose |
|---------|----|---------|
| `ds-advanced-kayak-81` | `4ddc9bba-aa8e-4f57-ab6e-36a59c3736f7` | General knowledge Q&A (geography, science) |
| `cloudless-gr-product-qa` | `7bea978a-3277-4da5-98e6-1d95e2dc4ba0` | cloudless.gr product Q&A |

Add examples programmatically:

```ts
await client.createExamples([
  {
    inputs: { question: "What is cloudless.gr?" },
    outputs: { answer: "A Greek cloud hosting provider." },
    dataset_id: "<dataset-id>",
  },
]);
```

### 2. Target function (`run-eval.ts`)

Wrapped with `traceable()` so every invocation appears as a named span in LangSmith:

```ts
const callClaude = traceable(
  async (question: string): Promise<string> => {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [{ role: "user", content: `Answer accurately...\n\n${question}` }],
    });
    return response.content.filter(b => b.type === "text").map(b => b.text).join("");
  },
  { name: "claude-opus-4-8", run_type: "llm" }
);

async function target(inputs: { question: string }): Promise<{ answer: string }> {
  return { answer: await callClaude(inputs.question) };
}
```

### 3. Evaluators

Three evaluators run per example:

| Evaluator | Type | Cost | feedbackKey |
|-----------|------|------|-------------|
| `correctnessEvaluator` | LLM-as-judge (`CORRECTNESS_PROMPT`) | ~1 LLM call | `correctness` |
| `concisenessEvaluator` | LLM-as-judge (`CONCISENESS_PROMPT`) | ~1 LLM call | `conciseness` |
| `exactMatchEvaluator` | String comparison | Free | `exact_match` |

```ts
const correctnessEvaluator = async (params) => {
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
```

### 4. Experiment runner

```ts
await evaluate(target, {
  data: "ds-advanced-kayak-81",
  evaluators: [correctnessEvaluator, concisenessEvaluator, exactMatchEvaluator],
  experimentPrefix: "cloudless-gr-claude-opus-4-8",
  maxConcurrency: 2,
  metadata: { model: "claude-opus-4-8", project: "cloudless.gr", evalSuite: "v1" },
  client,
});
```

`metadata` tags experiments so you can filter/compare across model versions in the LangSmith UI.

## Available openevals prompts

```ts
import {
  CORRECTNESS_PROMPT,     // Is the answer factually correct vs reference?
  CONCISENESS_PROMPT,     // Is the answer appropriately brief?
  HALLUCINATION_PROMPT,   // Does the answer invent facts?
  ANSWER_RELEVANCE_PROMPT, // Does it address the question?
  RAG_GROUNDEDNESS_PROMPT, // Is it grounded in retrieved context?
  CODE_CORRECTNESS_PROMPT, // Is generated code correct?
  exactMatch,             // Cheap string equality, no LLM needed
} from "openevals";
```

## Python / VIBE tracing

The VIBE agent (`/home/tbaltzakis/VIBE/agent/`) has `configure_claude_agent_sdk()` wired:

```bash
cd /home/tbaltzakis/VIBE/agent
pip install -U 'langsmith[claude-agent-sdk]' anthropic
python -m src.claude_agent "explain the auth flow in cloudless.gr"
# → traces appear in LangSmith project: cloudless.gr
```

Key: `ANTHROPIC_API_KEY` + `LANGSMITH_API_KEY` must be set in `/home/tbaltzakis/VIBE/agent/.env`.
