/**
 * Tool definitions for the Cloudless Assistant chat agent.
 *
 * Two read-only tools wired into /api/chat (Phase 2a of AGENTS_ROADMAP):
 *   - lookup_product:           query the live Stripe / default catalog.
 *   - check_calendar_availability: query open consultation slots.
 *
 * Tool execution returns a plain-text string the model consumes as
 * tool_result content. Errors are converted to user-friendly messages —
 * we never throw out of runTool, otherwise the chat loop dies.
 */

import { getProducts } from "@/lib/store-products";
import { getAvailableSlots } from "@/lib/google-calendar";
import { isConfigured } from "@/lib/integrations";
import { formatPrice } from "@/lib/format-price";

const SITE_BASE_URL = "https://cloudless.gr";
const MAX_PRODUCT_RESULTS = 3;
const MAX_SLOT_RESULTS = 5;
const MIN_DAYS_AHEAD = 1;
const MAX_DAYS_AHEAD = 14;
const DEFAULT_DAYS_AHEAD = 7;

// ---------------------------------------------------------------------------
// Schemas — what the model sees when deciding to call a tool
// ---------------------------------------------------------------------------

export const CHAT_TOOLS = [
  {
    name: "lookup_product",
    description:
      "Search the Cloudless storefront for products and services matching a free-text query. Returns up to 3 matches with name, price, category, and URL. Use this when the visitor asks about a specific service, package, course, or product, or wants pricing details.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Free-text search query, e.g. 'serverless course', 'cloud audit', 'monthly retainer'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "check_calendar_availability",
    description:
      "Look up available 30-minute consultation slots in the next N days. Use this when the visitor asks to book a call, see availability, or schedule an audit. Returns up to 5 upcoming slots in Athens local time.",
    input_schema: {
      type: "object",
      properties: {
        days_ahead: {
          type: "integer",
          description:
            "How many days ahead to search. Defaults to 7. Capped at 14.",
          minimum: MIN_DAYS_AHEAD,
          maximum: MAX_DAYS_AHEAD,
        },
      },
      required: [],
    },
  },
] as const;

export type ChatToolName = (typeof CHAT_TOOLS)[number]["name"];

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

interface LookupProductInput {
  query?: unknown;
}

interface CheckCalendarInput {
  days_ahead?: unknown;
}

async function runLookupProduct(input: LookupProductInput): Promise<string> {
  const query =
    typeof input.query === "string" ? input.query.trim().toLowerCase() : "";
  if (!query) return "No query provided.";

  const products = await getProducts();
  const matches = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        (p.features ?? []).some((f) => f.toLowerCase().includes(query)),
    )
    .slice(0, MAX_PRODUCT_RESULTS);

  if (matches.length === 0) {
    return `No products matched "${query}". Suggest the visitor browse ${SITE_BASE_URL}/store or describe what they're trying to solve.`;
  }

  const lines = matches.map((p) => {
    const price = formatPrice(p.price, p.currency);
    const recurring = p.recurring ? ` per ${p.interval ?? "month"}` : "";
    return `- ${p.name} (${p.category}) — ${price}${recurring}. URL: ${SITE_BASE_URL}/store/${p.id}. ${p.description}`;
  });
  return `Found ${matches.length} match(es):\n${lines.join("\n")}`;
}

function clampDaysAhead(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : DEFAULT_DAYS_AHEAD;
  return Math.max(MIN_DAYS_AHEAD, Math.min(MAX_DAYS_AHEAD, Math.trunc(n)));
}

const ATHENS_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: "Europe/Athens",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function formatSlot(start: string, end: string): string {
  const startD = new Date(start);
  const endD = new Date(end);
  const startStr = startD.toLocaleString("en-IE", ATHENS_FORMAT);
  const endTimeFmt: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Athens",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  const endStr = endD.toLocaleTimeString("en-IE", endTimeFmt);
  return `${startStr}–${endStr} Athens`;
}

async function runCheckCalendarAvailability(
  input: CheckCalendarInput,
): Promise<string> {
  if (!isConfigured("GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY")) {
    return "Calendar booking is not yet wired up. Suggest the visitor use the Contact page to request a time.";
  }

  const days = clampDaysAhead(input.days_ahead);
  let slots: { start: string; end: string }[];
  try {
    slots = await getAvailableSlots(days);
  } catch (err) {
    console.error("[chat-tools] getAvailableSlots failed:", err);
    return "Calendar lookup failed. Suggest the visitor use the Contact page or retry later.";
  }

  if (slots.length === 0) {
    return `No open 30-minute slots in the next ${days} day(s). Suggest the visitor use the Contact page or check back tomorrow.`;
  }

  const lines = slots
    .slice(0, MAX_SLOT_RESULTS)
    .map((s) => `- ${formatSlot(s.start, s.end)}`);
  return `Available slots (next ${days} day(s)):\n${lines.join("\n")}\nBook via ${SITE_BASE_URL}/book.`;
}

/**
 * Dispatch a tool call. Always resolves to a string — never throws —
 * because a thrown tool result would crash the chat loop.
 */
export async function runTool(name: string, input: unknown): Promise<string> {
  const safeInput = (typeof input === "object" && input !== null ? input : {}) as
    | LookupProductInput
    | CheckCalendarInput;
  try {
    if (name === "lookup_product") {
      return await runLookupProduct(safeInput as LookupProductInput);
    }
    if (name === "check_calendar_availability") {
      return await runCheckCalendarAvailability(safeInput as CheckCalendarInput);
    }
    return `Unknown tool: ${name}`;
  } catch (err) {
    console.error(`[chat-tools] ${name} threw:`, err);
    return `Tool ${name} failed. Suggest the visitor use the Contact page.`;
  }
}
