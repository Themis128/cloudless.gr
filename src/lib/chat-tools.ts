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
import { getAvailableSlots, bookConsultation } from "@/lib/google-calendar";
import { invalidateConsultationCache } from "@/lib/content-calendar";
import { isConfiguredAsync } from "@/lib/integrations";
import { formatPrice } from "@/lib/format-price";
import { slackBookingNotify } from "@/lib/slack-notify";
import { sendBookingConfirmation, notifyTeam } from "@/lib/email";
import { recordNotification } from "@/lib/admin-notifications";
import {
  MIN_DAYS_AHEAD,
  MAX_DAYS_AHEAD,
  clampDaysAhead,
  formatAthensSlot,
  formatAthensSlotsTable,
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
    name: "check_calendar_availability",
    description:
      "Look up available 30-minute consultation slots in the next N days. Use this when the visitor asks to book a call, see availability, or schedule an audit. Returns up to 5 upcoming slots as a markdown table (Day | Time, Athens local).",
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
      "Confirm a consultation booking. Use this after the visitor has picked a slot and provided their name and email. Prefer the `row` number from the most recent check_calendar_availability table. Creates a Google Calendar event with a Google Meet link and emails a calendar invite to the visitor.",
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
        row: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          description:
            "Row number the visitor picked from the latest check_calendar_availability table (1-indexed). Use this instead of start/end for a better user experience.",
        },
        start: {
          type: "string",
          description:
            "Optional: slot start time in ISO 8601 format. Use only if the visitor gives exact times instead of a row number.",
        },
        end: {
          type: "string",
          description:
            "Optional: slot end time in ISO 8601 format. Use only if the visitor gives exact times instead of a row number.",
        },
        notes: {
          type: "string",
          description: "Optional notes or context the visitor shared about their needs.",
        },
      },
      required: ["name", "email"],
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

interface BookSlotInput {
  name?: unknown;
  email?: unknown;
  row?: unknown;
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

  const capped = slots.slice(0, MAX_SLOT_RESULTS);
  const table = formatAthensSlotsTable(capped, { includeRefs: false });
  // Machine-readable JSON so the model can copy exact ISO values into book_slot
  const isoData = JSON.stringify(
    capped.map((s, i) => ({ row: i + 1, start: s.start, end: s.end }))
  );
  return [
    `Available consultation slots (Athens time):\n\n${table}`,
    `BOOKING_ISO_DATA:${isoData}`,
    `ASK THE VISITOR: "Which row would you like? Please reply with your row number, full name, and email all at once — e.g. '1, Jane Smith, jane@example.com'." Then call book_slot with row=<number>, name, and email. Only use start/end from BOOKING_ISO_DATA if the visitor gives exact times instead of a row.`,
  ].join("\n\n");
}

async function runBookSlot(input: BookSlotInput): Promise<string> {
  if (!(await isConfiguredAsync("GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY"))) {
    return "Booking is not yet configured. Suggest the visitor use the Contact page to request a time.";
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const rawRow = typeof input.row === "number" ? Math.trunc(input.row) : undefined;
  let start = typeof input.start === "string" ? input.start.trim() : "";
  let end = typeof input.end === "string" ? input.end.trim() : "";
  const notes =
    typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : undefined;

  if (!name) return "Missing visitor name. Ask them for their full name first.";
  if (!email || !email.includes("@"))
    return "Missing or invalid email address. Ask the visitor for a valid email.";

  if (rawRow && rawRow >= 1 && rawRow <= MAX_SLOT_RESULTS) {
    let slots: { start: string; end: string }[];
    try {
      slots = await getAvailableSlots();
    } catch {
      return "Could not re-check the calendar. Ask the visitor to use the Contact page or try again in a moment.";
    }
    const slot = slots[rawRow - 1];
    if (!slot) {
      return `Row ${rawRow} is not a valid slot. Call check_calendar_availability again and ask the visitor to pick a new row.`;
    }
    start = slot.start;
    end = slot.end;
  }

  if (!start || !end) {
    return "Missing slot. Call check_calendar_availability first, then ask the visitor to pick a row (e.g., '1, Jane Smith, jane@example.com') or provide the exact start/end ISO times.";
  }

  const result = await bookConsultation({ name, email, start, end, notes });
  if (!result) {
    return `That slot was just taken. Call check_calendar_availability again to get the latest open slots and ask the visitor to pick a new row.`;
  }

  invalidateConsultationCache();

  const slotLabel = formatAthensSlot(start, end);
  const meetLink = result.meetLink;

  // Fire-and-forget notifications — never block or fail the booking confirmation
  slackBookingNotify({
    name,
    email,
    start,
    notes,
    meetLink,
  }).catch((err) => console.warn("[chat-tools] slackBookingNotify failed:", err));
  sendBookingConfirmation({
    name,
    email,
    slotLabel,
    meetLink,
    notes,
  }).catch((err) => console.warn("[chat-tools] sendBookingConfirmation failed:", err));
  notifyTeam(
    `New consultation booked — ${name}`,
    [
      `<p><strong>Name:</strong> ${name}</p>`,
      `<p><strong>Email:</strong> ${email}</p>`,
      `<p><strong>Slot:</strong> ${slotLabel}</p>`,
      meetLink ? `<p><strong>Google Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>` : "",
      notes ? `<p><strong>Notes:</strong> ${notes}</p>` : "",
    ]
      .filter(Boolean)
      .join("\n")
  ).catch((err) => console.warn("[chat-tools] notifyTeam failed:", err));

  recordNotification({
    category: "booking",
    type: "success",
    title: `New consultation booked: ${name}`,
    message: `${name} (${email}) booked ${slotLabel}`,
    actor: email,
    route: "/api/chat",
    metadata: { start, meetLink, notes: notes ? notes.slice(0, 500) : null },
  }).catch((err) => console.warn("[chat-tools] recordNotification failed:", err));

  return [
    `Booking confirmed!`,
    `Slot: ${slotLabel}`,
    `Name: ${name}`,
    `Email: ${email}`,
    meetLink ? `Google Meet: ${meetLink}` : "",
    `A calendar invite and confirmation email have been sent to ${email}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Dispatch a tool call. Always resolves to a string — never throws —
 * because a thrown tool result would crash the chat loop.
 */
export async function runTool(name: string, input: unknown): Promise<string> {
  const safeInput = (typeof input === "object" && input !== null ? input : {}) as
    LookupProductInput | CheckCalendarInput | BookSlotInput;
  try {
    if (name === "lookup_product") {
      return await runLookupProduct(safeInput as LookupProductInput);
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
