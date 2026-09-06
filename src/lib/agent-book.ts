/**
 * Booking agent — Phase 2b of docs/AGENTS_ROADMAP.md.
 *
 * Takes a natural-language scheduling intent ("next Tuesday afternoon, 30 min")
 * and returns a single proposed slot. The agent never books on its own — the
 * caller must POST back to /api/agent/book with {confirm: true, start, end}
 * to actually create the calendar event.
 *
 * Uses Cloudflare Workers AI (JSON tool protocol). Requires
 * CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.
 *
 * Differences from the unauth'd chat book_slot tool:
 *   - email is forced to the authenticated user (no impersonation)
 *   - two-phase (propose → confirm) so the model can't fire the booking solo
 *   - tighter system prompt scoped to scheduling only
 */
import { getAvailableSlots } from "@/lib/cal-com";
import { isConfiguredAsync } from "@/lib/integrations";
import {
  buildWorkersAiToolProtocol,
  callWorkersAiChat,
  parseWorkersAiToolCall,
} from "@/lib/workers-ai-client";
import {
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
  clampDaysAhead,
  formatAthensSlot,
} from "@/lib/booking-slots";

const MAX_TOKENS = 400;
const MAX_TOOL_ITERATIONS = 4;
const MAX_SLOT_RESULTS = 8;

const STATUS_PROPOSED = "proposed" as const;
const STATUS_NO_MATCH = "no_match" as const;

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
      required: [] as string[],
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
          description: "Brief explanation of why this slot was chosen, or why no slot fits.",
        },
      },
      required: ["start", "end", "reasoning"],
    },
  },
] as const;

async function runCheckAvailability(raw: Record<string, unknown>): Promise<string> {
  const days = clampDaysAhead(raw.days_ahead);
  try {
    const slots = (await getAvailableSlots(days)).slice(0, MAX_SLOT_RESULTS);
    if (slots.length === 0) {
      return `No open slots in the next ${days} day(s).`;
    }
    const lines = slots.map(
      (s) => `- ${formatAthensSlot(s.start, s.end)} [start=${s.start} end=${s.end}]`
    );
    return `Open slots (next ${days} day(s)):\n${lines.join("\n")}`;
  } catch (err) {
    console.error("[agent-book] getAvailableSlots failed:", err);
    return "Calendar lookup failed.";
  }
}

function asStringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function resolveProposeArgs(args: Record<string, unknown>): ProposeResult {
  const start = asStringField(args.start);
  const end = asStringField(args.end);
  const reasoning = asStringField(args.reasoning);
  if (!start || !end) {
    return {
      status: STATUS_NO_MATCH,
      reasoning: reasoning.length > 0 ? reasoning : "No matching slot.",
    };
  }
  return {
    status: STATUS_PROPOSED,
    proposed: { start, end, formatted: formatAthensSlot(start, end) },
    reasoning,
  };
}

export interface ProposedSlot {
  start: string;
  end: string;
  formatted: string;
}

export type ProposeResult =
  | {
      status: typeof STATUS_PROPOSED;
      proposed: ProposedSlot;
      reasoning: string;
    }
  | { status: typeof STATUS_NO_MATCH; reasoning: string };

/**
 * Returns true when Google Calendar credentials are wired up.
 * Workers AI credentials are checked at propose time (fail closed).
 */
export async function isAgentBookConfigured(): Promise<boolean> {
  return isConfiguredAsync("CAL_API_KEY");
}

/**
 * Run the booking agent against a natural-language intent.
 * Returns the proposed slot (or no_match) — never books on its own.
 * May throw on Workers AI API errors; caller maps to HTTP status.
 */
export async function proposeBookingSlot(intent: string): Promise<ProposeResult> {
  const messages: { role: string; content: string }[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n${buildWorkersAiToolProtocol(AGENT_TOOLS)}`,
    },
    { role: "user", content: intent },
  ];

  for (let attempt = 0; attempt < MAX_TOOL_ITERATIONS; attempt++) {
    const reply = await callWorkersAiChat(messages, { maxTokens: MAX_TOKENS });
    const toolCall = parseWorkersAiToolCall(reply);

    if (!toolCall) {
      return {
        status: STATUS_NO_MATCH,
        reasoning: reply.length > 0 ? reply : "Model did not propose a slot.",
      };
    }

    if (toolCall.name === "propose_slot") {
      return resolveProposeArgs(toolCall.args);
    }

    if (toolCall.name === "check_calendar_availability") {
      messages.push({ role: "assistant", content: reply });
      const result = await runCheckAvailability(toolCall.args);
      messages.push({
        role: "user",
        content: `TOOL_RESULT for ${toolCall.name}:\n${result}`,
      });
      continue;
    }

    messages.push({ role: "assistant", content: reply });
    messages.push({
      role: "user",
      content: `TOOL_RESULT for ${toolCall.name}:\nUnknown tool: ${toolCall.name}`,
    });
  }

  return {
    status: STATUS_NO_MATCH,
    reasoning: "Agent exceeded its iteration budget without proposing a slot.",
  };
}
