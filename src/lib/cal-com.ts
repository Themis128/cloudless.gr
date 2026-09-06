/**
 * Cal.com v2 API client — drop-in replacement for google-calendar.ts.
 *
 * Exports the same four functions (getAvailableSlots, bookConsultation,
 * getUpcomingConsultations, getConsultationsByEmail) with identical return
 * types so every caller can swap the import without other changes.
 *
 * Runtime secret: CAL_API_KEY in SSM / env.
 * Event type:     CAL_EVENT_TYPE_ID (default 4923747 = "30 min meeting").
 */

import { getConfig } from "@/lib/ssm-config";
import { APP_TIMEZONE } from "@/lib/timezone";

const CAL_API = "https://api.cal.com/v2";
const CAL_API_VERSION = "2024-08-13";
const DEFAULT_EVENT_TYPE_ID = 4923747;
const CAL_TIMEOUT_MS = 10_000;
const DEFAULT_DAYS_AHEAD = 7;

// ---------------------------------------------------------------------------
// Shared types (mirror google-calendar.ts so callers need no changes)
// ---------------------------------------------------------------------------

export interface TimeSlot {
  start: string;
  end: string;
}

export interface Consultation {
  id: string;
  title: string;
  start: string;
  end: string;
  meetLink?: string;
  status: "upcoming" | "past";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getApiKey(): Promise<string> {
  if (process.env.CAL_API_KEY) return process.env.CAL_API_KEY;
  const cfg = await getConfig();
  return cfg.CAL_API_KEY ?? "";
}

async function calFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = await getApiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CAL_TIMEOUT_MS);
  try {
    return await fetch(`${CAL_API}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": CAL_API_VERSION,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function eventTypeId(): number {
  const env = process.env.CAL_EVENT_TYPE_ID;
  return env ? parseInt(env, 10) : DEFAULT_EVENT_TYPE_ID;
}

// ---------------------------------------------------------------------------
// getAvailableSlots
// ---------------------------------------------------------------------------

/**
 * Returns free 30-min slots in the next daysAhead days, as ISO strings.
 * Cal.com handles availability rules, buffers, and time-zone conversion.
 */
export async function getAvailableSlots(daysAhead = DEFAULT_DAYS_AHEAD): Promise<TimeSlot[]> {
  if (!process.env.CAL_API_KEY) {
    const cfg = await getConfig();
    if (!cfg.CAL_API_KEY) throw new Error("Cal.com API key not configured");
  }

  const now = new Date();
  const startTime = now.toISOString();
  const endTime = new Date(now.getTime() + daysAhead * 86_400_000).toISOString();

  const params = new URLSearchParams({
    eventTypeId: String(eventTypeId()),
    startTime,
    endTime,
    timeZone: APP_TIMEZONE,
  });

  const res = await calFetch(`/slots/available?${params}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[cal.com] getAvailableSlots failed:", res.status, detail.slice(0, 300));
    throw new Error(`Cal.com slots failed (${res.status})`);
  }

  const body = (await res.json()) as {
    status: string;
    data?: { slots?: Record<string, { time: string }[]> };
  };

  const slotsByDay = body.data?.slots ?? {};
  const slots: TimeSlot[] = [];
  const slotDurationMs = 30 * 60_000;

  for (const day of Object.keys(slotsByDay).sort()) {
    for (const entry of slotsByDay[day]) {
      const start = entry.time;
      const end = new Date(new Date(start).getTime() + slotDurationMs).toISOString();
      slots.push({ start, end });
    }
  }

  return slots;
}

// ---------------------------------------------------------------------------
// bookConsultation
// ---------------------------------------------------------------------------

/**
 * Creates a cal.com booking. Returns { eventId, htmlLink, meetLink } on
 * success, or null on any error (same contract as google-calendar.ts).
 */
export async function bookConsultation(data: {
  name: string;
  email: string;
  start: string;
  end: string;
  notes?: string;
}): Promise<{ eventId: string; htmlLink: string; meetLink?: string } | null> {
  try {
    const res = await calFetch("/bookings", {
      method: "POST",
      body: JSON.stringify({
        eventTypeId: eventTypeId(),
        start: data.start,
        attendee: {
          name: data.name,
          email: data.email,
          timeZone: APP_TIMEZONE,
          language: "en",
        },
        guests: ["tbaltzakis@cloudless.gr"],
        metadata: {},
        bookingFieldsResponses: data.notes ? { notes: data.notes } : undefined,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[cal.com] bookConsultation failed:", res.status, detail.slice(0, 300));
      return null;
    }

    const body = (await res.json()) as {
      status: string;
      data?: {
        uid?: string;
        id?: number;
        meetingUrl?: string;
        status?: string;
      };
    };

    const booking = body.data;
    if (!booking?.uid) return null;

    const uid = booking.uid;
    return {
      eventId: uid,
      htmlLink: `https://cal.com/booking/${uid}`,
      meetLink: booking.meetingUrl,
    };
  } catch (err) {
    console.error("[cal.com] bookConsultation error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// getUpcomingConsultations
// ---------------------------------------------------------------------------

interface CalBooking {
  uid?: string;
  id?: number;
  title?: string;
  start?: string;
  end?: string;
  meetingUrl?: string;
  status?: string;
}

function toConsultation(b: CalBooking): Consultation {
  const start = b.start ?? "";
  const now = new Date();
  return {
    id: b.uid ?? String(b.id ?? ""),
    title: b.title ?? "Cloudless Consultation",
    start,
    end: b.end ?? "",
    meetLink: b.meetingUrl,
    status: start && new Date(start) > now ? "upcoming" : "past",
  };
}

export async function getUpcomingConsultations(): Promise<Consultation[]> {
  try {
    const params = new URLSearchParams({
      eventTypeId: String(eventTypeId()),
      status: "upcoming",
    });
    const res = await calFetch(`/bookings?${params}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { status: string; data?: CalBooking[] };
    return (body.data ?? []).map(toConsultation);
  } catch (err) {
    console.error("[cal.com] getUpcomingConsultations error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getConsultationsByEmail
// ---------------------------------------------------------------------------

export async function getConsultationsByEmail(email: string): Promise<Consultation[]> {
  try {
    const params = new URLSearchParams({
      eventTypeId: String(eventTypeId()),
      attendeeEmail: email,
    });
    const res = await calFetch(`/bookings?${params}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { status: string; data?: CalBooking[] };
    return (body.data ?? []).map(toConsultation);
  } catch (err) {
    console.error("[cal.com] getConsultationsByEmail error:", err);
    return [];
  }
}
