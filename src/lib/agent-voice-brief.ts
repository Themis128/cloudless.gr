/**
 * Voice-brief agent — Phase 3 of docs/AGENTS_ROADMAP.md.
 *
 * Replaces the linear `Promise.all(getSeoSnapshot, getPipelineStats, …)`
 * pipeline in /api/cron/voice-brief with a Bedrock tool-use loop. The agent:
 *
 *   1. Decides which data sources to query (skips ones that are not
 *      configured, or that previous tool calls have made unnecessary).
 *   2. Retries each tool up to twice with exponential backoff before giving
 *      up on a source.
 *   3. Calls `emit_brief` exactly once with a polished TTS-friendly narrative.
 */
import {
  fetchSeoMetrics,
  fetchPipelineMetrics,
  fetchEmailMetrics,
  fetchStripeMetrics,
} from "@/lib/voice-brief-sources";
import {
  buildBedrockToolConfig,
  getBedrockClient,
  joinAssistantText,
  pickToolUseBlocks,
  runBedrockTurn,
  type BedrockMessage,
  type ToolResultBlock,
  type ToolUseBlock,
} from "@/lib/bedrock-shared";

const MAX_TOKENS = 600;
const MAX_TOOL_ITERATIONS = 8;
const TOOL_MAX_RETRIES = 2;
const TOOL_BACKOFF_BASE_MS = 200;

type ToolStatus = "ok" | "failed" | "skipped";

interface ToolOutcome {
  name: string;
  status: ToolStatus;
  detail?: string;
}

export interface VoiceBriefResult {
  text: string;
  sources: ToolOutcome[];
}

const SYSTEM_PROMPT = `You are the Cloudless weekly-brief agent.

Your job: gather the metrics that are relevant THIS WEEK, then narrate a 3–5
sentence spoken brief that an admin can listen to over coffee. The brief is
played through TTS, so write it as if you were reading it aloud — clear,
conversational, factual.

Workflow:
1. Decide which of the data tools you actually need this week. Each tool returns
   either real numbers or a "not configured" / "no data" string. Call only the
   tools that will plausibly contribute to the brief.
2. After each tool result, decide what to do next. Skip a source if it returns
   no data twice — don't keep retrying.
3. When you have enough material (or have exhausted the useful tools), call
   emit_brief exactly once with the final narrative.

Rules:
- Never invent metrics. Use only numbers that came back from a tool call.
- If every source returned no usable data, still call emit_brief with a short
  honest paragraph noting that this week's data sources were unavailable.
- Never call emit_brief more than once. Never re-call a tool that succeeded.
- Keep the narrative under 100 words. No headings, no markdown, no lists.`;

// ---------------------------------------------------------------------------
// Tool definitions — 4 data sources + 1 terminal emit.
// ---------------------------------------------------------------------------

const AGENT_TOOLS = [
  {
    name: "get_seo_metrics",
    description:
      "Fetch this week's Google Search Console snapshot: clicks, impressions, average CTR. Returns plain text suitable for inclusion in a narration, or a 'not configured' note.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_pipeline_stats",
    description: "Fetch EspoCRM open-deal pipeline totals (deal count + total value in euros).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_email_metrics",
    description:
      "Fetch the size of the newsletter subscriber list (EspoCRM contacts with newsletter opt-in).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_stripe_revenue",
    description:
      "Fetch the count of paid Stripe checkout sessions in the last 50 sessions and their total revenue in euros.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "emit_brief",
    description:
      "Final answer. Emit the polished 3–5 sentence spoken brief. Call this exactly once when you have enough material — the conversation ends here.",
    input_schema: {
      type: "object",
      properties: {
        narrative: {
          type: "string",
          description:
            "The TTS-friendly brief, 3–5 sentences, no markdown. Used verbatim as the spoken text.",
        },
      },
      required: ["narrative"],
    },
  },
] as const;

const AGENT_TOOL_CONFIG = buildBedrockToolConfig(AGENT_TOOLS);

// ---------------------------------------------------------------------------
// Retry helper — exponential backoff, used per tool call.
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withRetry<T>(fn: () => Promise<T>, retries = TOOL_MAX_RETRIES): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(TOOL_BACKOFF_BASE_MS * 2 ** attempt);
      }
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Tool implementations — each returns a short plain-text string that the
// model reads back. Failures are returned as "no data" strings so the model
// can decide whether to skip the source rather than crashing the loop.
// ---------------------------------------------------------------------------

interface ToolSpec<T> {
  toolName: string;
  fetch: () => Promise<T | null>;
  format: (data: T) => string;
  emptyMessage: string;
  failMessage: string;
}

function makeToolHandler<T>(spec: ToolSpec<T>): () => Promise<string> {
  return async () => {
    try {
      const data = await withRetry(spec.fetch);
      return data ? spec.format(data) : spec.emptyMessage;
    } catch (err) {
      console.warn(`[agent-voice-brief] ${spec.toolName} failed:`, err);
      return spec.failMessage;
    }
  };
}

const TOOL_HANDLERS: Record<string, () => Promise<string>> = {
  get_seo_metrics: makeToolHandler({
    toolName: "get_seo_metrics",
    fetch: fetchSeoMetrics,
    format: (s) =>
      `GSC: ${s.clicks.toLocaleString()} clicks, ${s.impressions.toLocaleString()} impressions, avg CTR ${s.ctr.toFixed(1)}%.`,
    emptyMessage: "GSC returned no data this period.",
    failMessage: "GSC lookup failed after retries.",
  }),
  get_pipeline_stats: makeToolHandler({
    toolName: "get_pipeline_stats",
    fetch: fetchPipelineMetrics,
    format: (p) =>
      `EspoCRM pipeline: ${p.totalDeals} open deals worth €${p.totalValueEuros.toFixed(0)}.`,
    emptyMessage: "EspoCRM not configured.",
    failMessage: "EspoCRM pipeline lookup failed after retries.",
  }),
  get_email_metrics: makeToolHandler({
    toolName: "get_email_metrics",
    fetch: fetchEmailMetrics,
    format: (e) => `Newsletter: ${e.totalContacts.toLocaleString()} subscribers.`,
    emptyMessage: "EspoCRM not configured.",
    failMessage: "Newsletter lookup failed after retries.",
  }),
  get_stripe_revenue: makeToolHandler({
    toolName: "get_stripe_revenue",
    fetch: fetchStripeMetrics,
    format: (s) => `Stripe: ${s.orders} paid orders, €${s.revenueEuros.toFixed(0)} revenue.`,
    emptyMessage: "Stripe returned no data.",
    failMessage: "Stripe lookup failed after retries.",
  }),
};

function classifyOutcome(name: string, detail: string): ToolOutcome {
  const lower = detail.toLowerCase();
  if (lower.includes("not configured") || lower.includes("no data")) {
    return { name, status: "skipped", detail };
  }
  if (lower.includes("failed")) {
    return { name, status: "failed", detail };
  }
  return { name, status: "ok", detail };
}

async function runPendingTool(
  block: ToolUseBlock,
  outcomes: ToolOutcome[]
): Promise<ToolResultBlock> {
  const handler = TOOL_HANDLERS[block.toolUse.name];
  const result = handler ? await handler() : `Unknown tool: ${block.toolUse.name}`;
  outcomes.push(classifyOutcome(block.toolUse.name, result));
  return {
    toolResult: {
      toolUseId: block.toolUse.toolUseId,
      content: [{ text: result }] as [{ text: string }],
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Run the voice-brief agent loop. Returns the polished narrative plus a
 * per-source outcome list (used by the route handler to post a Slack summary).
 *
 * Throws on Bedrock infrastructure errors so the route handler can surface
 * a 5xx instead of writing a half-broken brief to SSM.
 */
export async function runVoiceBriefAgent(opts?: { dateLabel?: string }): Promise<VoiceBriefResult> {
  const client = getBedrockClient();
  const dateLabel = opts?.dateLabel ?? new Date().toISOString().slice(0, 10);
  const outcomes: ToolOutcome[] = [];

  const messages: BedrockMessage[] = [
    {
      role: "user",
      content: [
        {
          text: `Generate this week's Cloudless brief. Date: ${dateLabel}. Decide which sources to query, gather what you can, and emit the narration.`,
        },
      ],
    },
  ];

  for (let attempt = 0; attempt < MAX_TOOL_ITERATIONS; attempt++) {
    const assistantContent = await runBedrockTurn({
      client,
      system: SYSTEM_PROMPT,
      messages,
      toolConfig: AGENT_TOOL_CONFIG,
      maxTokens: MAX_TOKENS,
    });
    const toolUseBlocks = pickToolUseBlocks(assistantContent);

    const emitBlock = toolUseBlocks.find((b) => b.toolUse.name === "emit_brief");
    if (emitBlock) {
      const narrative = asString(emitBlock.toolUse.input?.narrative).trim();
      return {
        text:
          narrative.length > 0
            ? narrative
            : "No brief produced this week — every data source was unavailable.",
        sources: outcomes,
      };
    }

    if (toolUseBlocks.length === 0) {
      const textOut = joinAssistantText(assistantContent);
      return {
        text: textOut.length > 0 ? textOut : "Agent produced no narrative this week.",
        sources: outcomes,
      };
    }

    messages.push({ role: "assistant", content: assistantContent });
    const toolResults = await Promise.all(toolUseBlocks.map((b) => runPendingTool(b, outcomes)));
    messages.push({ role: "user", content: toolResults });
  }

  return {
    text: "Agent exceeded its iteration budget without producing a final brief.",
    sources: outcomes,
  };
}
