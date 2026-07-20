/**
 * Tool definitions for the Cloudless Assistant chat agent.
 *
 * Tools wired into /api/chat:
 *   - lookup_product:           query the live Stripe / default catalog.
 *   - search_documentation:     semantic search via Cloudflare AI Search.
 *   - check_calendar_availability: query open consultation slots.
 *   - book_slot:                confirm a consultation booking.
 *
 * Tool execution returns a plain-text string the model consumes as
 * tool_result content. Errors are converted to user-friendly messages —
 * we never throw out of runTool, otherwise the chat loop dies.
 */

import { getProducts } from "@/lib/store-products";
import { getAvailableSlots, bookConsultation } from "@/lib/google-calendar";
import { isConfiguredAsync } from "@/lib/integrations";
import { formatPrice } from "@/lib/format-price";
import { slackBookingNotify } from "@/lib/slack-notify";
import { sendBookingConfirmation } from "@/lib/email";
import { searchAiDocs } from "@/lib/ai-search";
import {
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
  clampDaysAhead,
  formatAthensSlot,
} from "@/lib/booking-slots";

const SITE_BASE_URL = "https://cloudless.gr";
const MAX_PRODUCT_RESULTS = 3;
const MAX_SLOT_RESULTS = 5;

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
    name: "search_documentation",
    description:
      "Search the Cloudless documentation and technical articles using semantic search. Use this when the visitor asks about technical topics, deployment guides, architecture patterns, or how-to questions that might be covered in our knowledge base.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query for documentation content, e.g. 'workers ai setup', 'cloudflare tunnel', 'nextjs deployment', 'aws migration'.",
        },
        namespace: {
          type: "string",
          description: "Optional namespace to search (default: docs).",
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
          description: "How many days ahead to search. Defaults to 7. Capped at 14.",
          minimum: MIN_DAYS_AHEAD,
          maximum: MAX_DAYS_AHEAD,
        },
      },
      required: [],
    },
  },
  {
    name: "book_slot",
    description:
      "Confirm a consultation booking. Call this ONLY after the visitor has chosen a specific slot from check_calendar_availability and provided their name and email. Creates a Google Calendar event with a Google Meet link and emails a calendar invite to the visitor.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Full name of the person booking the consultation.",
        },
        email: {
          type: "string",
          description: "Email address for the calendar invite and Google Meet link.",
        },
        start: {
          type: "string",
          description:
            "Slot start time in ISO 8601 format, exactly as returned by check_calendar_availability.",
        },
        end: {
          type: "string",
          description:
            "Slot end time in ISO 8601 format, exactly as returned by check_calendar_availability.",
        },
        notes: {
          type: "string",
          description: "Optional notes or context the visitor shared about their needs.",
        },
      },
      required: ["name", "email", "start", "end"],
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

interface SearchDocumentationInput {
  query?: unknown;
  namespace?: unknown;
}

interface CheckCalendarInput {
  days_ahead?: unknown;
}

interface BookSlotInput {
  name?: unknown;
  email?: unknown;
  start?: unknown;
  end?: unknown;
  notes?: unknown;
}

async function runLookupProduct(input: LookupProductInput): Promise<string> {
  const query = typeof input.query === "string" ? input.query.trim().toLowerCase() : "";
  if (!query) return "No query provided.";

  const products = await getProducts();
  const matches = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        (p.features ?? []).some((f) => f.toLowerCase().includes(query))
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

async function runSearchDocumentation(input: SearchDocumentationInput): Promise<string> {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (!query) return "No search query provided.";

  const namespace = typeof input.namespace === "string" ? input.namespace.trim() : undefined;

  const result = await searchAiDocs(query, namespace);

  if (!result) {
    return "Documentation search is not yet configured. Suggest the visitor use the Contact page for technical questions.";
  }

  if (result.answer) {
    return `Documentation search result: ${result.answer}`;
  }

  if (result.results && result.results.length > 0) {
    const lines = result.results
      .slice(0, 5)
      .map((r, i) => `${i + 1}. ${r.text.slice(0, 150)}${r.text.length > 150 ? "..." : ""} (score: ${r.score.toFixed(2)})`);
    return `Found ${result.results.length} relevant documents:\n${lines.join("\n")}`;
  }

  return `No documentation found for "${query}". Suggest checking the docs at https://docs.cloudless.gr or using the Contact page.`;
}

async function runCheckCalendarAvailability(input: CheckCalendarInput): Promise<string> {
  if (!(await isConfiguredAsync("GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY"))) {
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
    .map((s) => `- ${formatAthensSlot(s.start, s.end)} [start=${s.start} end=${s.end}]`);
  return `Available slots (next ${days} day(s)):\n${lines.join("\n")}\nAsk the visitor which slot they prefer, then collect their name and email to call book_slot. They can also book directly at https://cloudless.gr/book.`;
}

async function runBookSlot(input: BookSlotInput): Promise<string> {
  if (!(await isConfiguredAsync("GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY"))) {
    return "Booking is not yet configured. Suggest the visitor use the Contact page to request a time.";
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const start = typeof input.start === "string" ? input.start.trim() : "";
  const end = typeof input.end === "string" ? input.end.trim() : "";
  const notes =
    typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : undefined;

  if (!name) return "Missing visitor name. Ask them for their full name first.";
  if (!email || !email.includes("@"))
    return "Missing or invalid email address. Ask the visitor for a valid email.";
  if (!start || !end)
    return "Missing slot times. Call check_calendar_availability first and let the visitor pick a slot.";

  const result = await bookConsultation({ name, email, start, end, notes });
  if (!result) {
    return "Booking failed — the slot may no longer be available. Call check_calendar_availability again and ask the visitor to pick another slot.";
  }

  const slotLabel = formatAthensSlot(start, end);

  // Fire-and-forget notifications — never block or fail the booking confirmation
  slackBookingNotify({
    name,
    email,
    start,
    notes,
    meetLink: result.htmlLink,
  }).catch((err) => console.warn("[chat-tools] slackBookingNotify failed:", err));
  sendBookingConfirmation({
    name,
    email,
    slotLabel,
    meetLink: result.htmlLink,
    notes,
  }).catch((err) => console.warn("[chat-tools] sendBookingConfirmation failed:", err));

  return [
    `Booking confirmed!`,
    `Slot: ${slotLabel}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `Google Meet: ${result.htmlLink}`,
    `A calendar invite and confirmation email have been sent to ${email}.`,
  ].join("\n");
}

/**
 * Dispatch a tool call. Always resolves to a string — never throws —
 * because a thrown tool result would crash the chat loop.
 */
export async function runTool(name: string, input: unknown): Promise<string> {
  const safeInput = (typeof input === "object" && input !== null ? input : {}) as
    LookupProductInput | SearchDocumentationInput | CheckCalendarInput | BookSlotInput;
  try {
    if (name === "lookup_product") {
      return await runLookupProduct(safeInput as LookupProductInput);
    }
    if (name === "search_documentation") {
      return await runSearchDocumentation(safeInput as SearchDocumentationInput);
    }
    if (name === "check_calendar_availability") {
      return await runCheckCalendarAvailability(safeInput as CheckCalendarInput);
    }
    if (name === "book_slot") {
      return await runBookSlot(safeInput as BookSlotInput);
    }
    return `Unknown tool: ${name}`;
  } catch (err) {
    console.error(`[chat-tools] ${name} threw:`, err);
    return `Tool ${name} failed. Suggest the visitor use the Contact page.`;
  }
}