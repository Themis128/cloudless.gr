/**
 * Booking agent — Phase 2b of docs/AGENTS_ROADMAP.md.
 *
 * Takes a natural-language scheduling intent ("next Tuesday afternoon, 30 min")
 * and returns a single proposed slot. The agent never books on its own — the
 * caller must POST back to /api/agent/book with {confirm: true, start, end}
 * to actually create the calendar event.
 *
 * Differences from the unauth'd chat book_slot tool:
 *   - email is forced to the authenticated Cognito user (no impersonation)
 *   - two-phase (propose → confirm) so the model can't fire the booking solo
 *   - tighter system prompt scoped to scheduling only
 */
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { getAvailableSlots } from "@/lib/google-calendar";
import { isConfiguredAsync } from "@/lib/integrations";
import {
  BEDROCK_MODEL_ID,
  buildBedrockToolConfig,
  getBedrockClient,
  type AnyBlock,
  type BedrockMessage,
  type TextBlock,
  type ToolResultBlock,
  type ToolUseBlock,
} from "@/lib/bedrock-shared";
import {
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
  clampDaysAhead,
  formatAthensSlot,
} from "@/lib/booking-slots";

const MAX_TOKENS = 400;
const MAX_TOOL_ITERATIONS = 4;
const MAX_SLOT_RESULTS = 8;

const SYSTEM_PROMPT = `You are the Cloudless scheduling agent. Your single job is to read the visitor's natural-language scheduling intent and pick ONE specific 30-minute consultation slot that best matches it.

Workflow:
1. Call check_calendar_availability with a reasonable days_ahead (default 7, max 14) to fetch open slots.
2. From the returned slots, pick the SINGLE slot that best matches the intent (preferred day of week, time of day, urgency).
3. Call propose_slot exactly once with that slot's start and end times, copied verbatim from check_calendar_availability output.

Rules:
- Never invent slot times. Only use values returned by check_calendar_availability.
- If no slots match the intent, call propose_slot with start="" and end="" and reasoning explaining why.
- Athens local time. Business hours are 09:00–17:00 weekdays.
- Be concise in reasoning — one or two sentences.`;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const AGENT_TOOLS = [
  {
    name: "check_calendar_availability",
    description:
      "Look up open 30-minute consultation slots in the next N days. Returns up to 8 slots in ISO 8601 with Athens local labels.",
    input_schema: {
      type: "object",
      properties: {
        days_ahead: {
          type: "integer",
          description: "Days ahead to search. Default 7. Max 14.",
          minimum: MIN_DAYS_AHEAD,
          maximum: MAX_DAYS_AHEAD,
        },
      },
      required: [],
    },
  },
  {
    name: "propose_slot",
    description:
      "Final answer. Propose exactly one slot back to the caller. Use start/end verbatim from check_calendar_availability. If no slot fits, pass empty strings and explain in reasoning.",
    input_schema: {
      type: "object",
      properties: {
        start: {
          type: "string",
          description: "Slot start ISO 8601, or empty string if no match.",
        },
        end: {
          type: "string",
          description: "Slot end ISO 8601, or empty string if no match.",
        },
        reasoning: {
          type: "string",
          description:
            "Brief explanation of why this slot was chosen, or why no slot fits.",
        },
      },
      required: ["start", "end", "reasoning"],
    },
  },
] as const;

const AGENT_TOOL_CONFIG = buildBedrockToolConfig(AGENT_TOOLS);

// ---------------------------------------------------------------------------
// Slot fetching for the model
// ---------------------------------------------------------------------------

async function runCheckAvailability(raw: unknown): Promise<string> {
  const input = (typeof raw === "object" && raw !== null ? raw : {}) as {
    days_ahead?: unknown;
  };
  const days = clampDaysAhead(input.days_ahead);
  try {
    const slots = (await getAvailableSlots(days)).slice(0, MAX_SLOT_RESULTS);
    if (slots.length === 0) {
      return `No open slots in the next ${days} day(s).`;
    }
    const lines = slots.map(
      (s) => `- ${formatAthensSlot(s.start, s.end)} [start=${s.start} end=${s.end}]`,
    );
    return `Open slots (next ${days} day(s)):\n${lines.join("\n")}`;
  } catch (err) {
    console.error("[agent-book] getAvailableSlots failed:", err);
    return "Calendar lookup failed.";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ProposedSlot {
  start: string;
  end: string;
  formatted: string;
}

export type ProposeResult =
  | { status: "proposed"; proposed: ProposedSlot; reasoning: string }
  | { status: "no_match"; reasoning: string };

/**
 * Returns true when the slot lib + Bedrock are wired up.
 * Calendar credentials are checked first to fail fast in unconfigured envs.
 */
export async function isAgentBookConfigured(): Promise<boolean> {
  return isConfiguredAsync("GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY");
}

/**
 * Run the booking agent against a natural-language intent.
 * Returns the proposed slot (or no_match) — never books on its own.
 * May throw on Bedrock API errors; caller maps to HTTP status.
 */
export async function proposeBookingSlot(
  intent: string,
): Promise<ProposeResult> {
  const client = getBedrockClient();
  const messages: BedrockMessage[] = [
    { role: "user", content: [{ text: intent }] },
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const cmd = new ConverseCommand({
      modelId: BEDROCK_MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages,
      toolConfig: AGENT_TOOL_CONFIG,
      inferenceConfig: { maxTokens: MAX_TOKENS },
    });

    const response = await client.send(cmd);
    const assistantContent: AnyBlock[] =
      (response.output?.message?.content as AnyBlock[]) ?? [];

    const toolUseBlocks = assistantContent.filter(
      (b): b is ToolUseBlock =>
        "toolUse" in b &&
        typeof (b as ToolUseBlock).toolUse?.toolUseId === "string",
    );

    // Terminal tool — propose_slot. Bind the result and return.
    const proposeBlock = toolUseBlocks.find(
      (b) => b.toolUse.name === "propose_slot",
    );
    if (proposeBlock) {
      const input = proposeBlock.toolUse.input ?? {};
      const start = typeof input.start === "string" ? input.start : "";
      const end = typeof input.end === "string" ? input.end : "";
      const reasoning =
        typeof input.reasoning === "string" ? input.reasoning : "";
      if (!start || !end) {
        return { status: "no_match", reasoning: reasoning || "No matching slot." };
      }
      return {
        status: "proposed",
        proposed: { start, end, formatted: formatAthensSlot(start, end) },
        reasoning,
      };
    }

    if (toolUseBlocks.length === 0) {
      // Model returned plain text without proposing — treat as no_match.
      const textOut = (assistantContent as TextBlock[])
        .filter((b) => typeof b.text === "string")
        .map((b) => b.text)
        .join(" ")
        .trim();
      return {
        status: "no_match",
        reasoning: textOut || "Model did not propose a slot.",
      };
    }

    // Append assistant turn + run pending availability tool calls.
    messages.push({ role: "assistant", content: assistantContent });

    const toolResults: ToolResultBlock[] = await Promise.all(
      toolUseBlocks.map(async (b) => {
        let result: string;
        if (b.toolUse.name === "check_calendar_availability") {
          result = await runCheckAvailability(b.toolUse.input);
        } else {
          result = `Unknown tool: ${b.toolUse.name}`;
        }
        return {
          toolResult: {
            toolUseId: b.toolUse.toolUseId,
            content: [{ text: result }] as [{ text: string }],
          },
        };
      }),
    );

    messages.push({ role: "user", content: toolResults });
  }

  return {
    status: "no_match",
    reasoning: "Agent exceeded its iteration budget without proposing a slot.",
  };
}
