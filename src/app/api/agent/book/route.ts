/**
 * Phase 2b booking agent — auth-gated natural-language booking.
 *
 * Two-step flow (single endpoint, discriminated by body):
 *   1. Propose: POST { intent: string }
 *      → 200 { status: "proposed", proposed: {start, end, formatted}, reasoning }
 *      → 200 { status: "no_match", reasoning }
 *   2. Confirm: POST { confirm: true, start, end, notes? }
 *      → 200 { status: "confirmed", eventId, meetingLink, slot }
 *
 * Auth: requires a valid ID token via Bearer header. The booking is
 * always made on behalf of the authenticated email — the model cannot
 * override it.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isAgentBookConfigured, proposeBookingSlot } from "@/lib/agent-book";
import { MAX_DAYS_AHEAD, formatAthensSlot } from "@/lib/booking-slots";
import { bookConsultation, getAvailableSlots } from "@/lib/google-calendar";
import { slackBookingNotify } from "@/lib/slack-notify";
import { recordNotification } from "@/lib/admin-notifications";
import { sendBookingConfirmation } from "@/lib/email";
import { mapIntegrationError } from "@/lib/api-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROPOSE_LIMIT_PER_WINDOW = 5;
const PROPOSE_WINDOW_MS = 10 * 60_000;
const CONFIRM_LIMIT_PER_WINDOW = 5;
const CONFIRM_WINDOW_MS = 10 * 60_000;
const MAX_INTENT_LENGTH = 500;
const MAX_NOTES_LENGTH = 1_000;
const SLOT_OVERLAP_TOLERANCE_MS = 60_000;

interface ProposeBody {
  intent: string;
}
interface ConfirmBody {
  confirm: true;
  start: string;
  end: string;
  notes?: string;
}

function isProposeBody(b: unknown): b is ProposeBody {
  return (
    typeof b === "object" && b !== null && typeof (b as { intent?: unknown }).intent === "string"
  );
}

function isConfirmBody(b: unknown): b is ConfirmBody {
  if (typeof b !== "object" || b === null) return false;
  const o = b as { confirm?: unknown; start?: unknown; end?: unknown };
  return o.confirm === true && typeof o.start === "string" && typeof o.end === "string";
}

function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

function normalizeNotes(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_NOTES_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveUserName(claim: string | undefined, email: string): string {
  if (claim && claim.length > 0) return claim;
  const localPart = email.split("@")[0];
  if (localPart.length > 0) return localPart;
  return "Cloudless User";
}

async function handlePropose(body: ProposeBody, ip: string): Promise<NextResponse> {
  const rl = rateLimit(`agent-book-propose:${ip}`, PROPOSE_LIMIT_PER_WINDOW, PROPOSE_WINDOW_MS);
  if (!rl.ok) return rl.response as NextResponse;

  const intent = body.intent.trim().slice(0, MAX_INTENT_LENGTH);
  if (!intent) return jsonError(400, "Intent is required.");

  try {
    const result = await proposeBookingSlot(intent);
    return NextResponse.json(result);
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    console.error("[agent-book] propose failed:", err);
    if (name === "AccessDeniedException" || name === "UnauthorizedException") {
      return jsonError(503, "Booking agent is not available right now.");
    }
    return jsonError(502, "Booking agent upstream error.");
  }
}

async function handleConfirm(
  body: ConfirmBody,
  userEmail: string,
  userName: string,
  ip: string
): Promise<NextResponse> {
  const rl = rateLimit(`agent-book-confirm:${ip}`, CONFIRM_LIMIT_PER_WINDOW, CONFIRM_WINDOW_MS);
  if (!rl.ok) return rl.response as NextResponse;

  const startD = new Date(body.start);
  const endD = new Date(body.end);
  if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime())) {
    return jsonError(400, "Invalid date format for start or end.");
  }
  if (startD < new Date()) {
    return jsonError(400, "Cannot book a slot in the past.");
  }
  if (endD <= startD) {
    return jsonError(400, "End time must be after start time.");
  }

  // Re-check availability — the propose step is advisory; another booking
  // could have taken the slot in between. getAvailableSlots only returns
  // currently-free slots, so a hit there is the source of truth.
  const daysAhead = Math.max(1, Math.ceil((startD.getTime() - Date.now()) / 86_400_000) + 1);
  const free = await getAvailableSlots(Math.min(daysAhead, MAX_DAYS_AHEAD));
  const stillFree = free.some((s) => {
    const sStart = new Date(s.start).getTime();
    return Math.abs(sStart - startD.getTime()) <= SLOT_OVERLAP_TOLERANCE_MS;
  });
  if (!stillFree) {
    return jsonError(409, "That slot is no longer available. Please propose a new time.");
  }

  const notes = normalizeNotes(body.notes);

  try {
    const result = await bookConsultation({
      name: userName,
      email: userEmail,
      start: body.start,
      end: body.end,
      notes,
    });
    if (!result) return jsonError(500, "Failed to create booking.");

    const slotLabel = formatAthensSlot(body.start, body.end);

    slackBookingNotify({
      name: userName,
      email: userEmail,
      start: body.start,
      notes,
      meetLink: result.htmlLink,
    }).catch((err) => console.warn("[agent-book] slackBookingNotify failed:", err));

    recordNotification({
      category: "booking",
      type: "success",
      title: `Agent-booked consultation: ${userName}`,
      message: `${userName} (${userEmail}) booked ${slotLabel} via the booking agent`,
      actor: userEmail,
      route: "/api/agent/book",
      metadata: {
        start: body.start,
        end: body.end,
        meetLink: result.htmlLink,
        notes: notes ? String(notes).slice(0, 500) : null,
      },
    });
    sendBookingConfirmation({
      name: userName,
      email: userEmail,
      slotLabel,
      meetLink: result.htmlLink,
      notes,
    }).catch((err) => console.warn("[agent-book] sendBookingConfirmation failed:", err));

    return NextResponse.json({
      status: "confirmed",
      eventId: result.eventId,
      meetingLink: result.htmlLink,
      slot: { start: body.start, end: body.end, formatted: slotLabel },
    });
  } catch (err) {
    const mapped = mapIntegrationError(err);
    if (mapped) return mapped;
    console.error("[agent-book] confirm failed:", err);
    return jsonError(500, "Booking failed.");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const userEmail = auth.user.email?.toLowerCase();
  if (!userEmail) {
    return jsonError(400, "Authenticated token is missing an email claim — cannot book.");
  }
  const userName = resolveUserName(auth.user.preferred_username, userEmail);

  if (!(await isAgentBookConfigured())) {
    return jsonError(503, "Booking is not configured.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const ip = getClientIp(request);

  if (isConfirmBody(body)) {
    return handleConfirm(body, userEmail, userName, ip);
  }
  if (isProposeBody(body)) {
    return handlePropose(body, ip);
  }

  return jsonError(
    400,
    "Body must be either { intent } to propose or { confirm: true, start, end } to confirm."
  );
}
