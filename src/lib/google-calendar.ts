import { createGoogleAuth } from "@/lib/google-auth";
import { getConfig } from "@/lib/ssm-config";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;
const BUSINESS_OPEN_HOUR = 9;
const BUSINESS_CLOSE_HOUR = 17;
const SLOT_DURATION_MINUTES = 30;
const LOOKBACK_DAYS = 90;
const LOOKAHEAD_DAYS = 30;
const MAX_CALENDAR_RESULTS = 50;
const CALENDAR_TIMEZONE = "Europe/Athens";
const DEFAULT_CALENDAR_ID = "primary";
const DATE_PART_2_DIGIT = "2-digit";

const getAccessToken = createGoogleAuth(
  "https://www.googleapis.com/auth/calendar",
);

/**
 * Returns the UTC offset for Europe/Athens at the given instant, in ms.
 * Handles DST correctly (Athens is UTC+2 EET in winter, UTC+3 EEST in summer).
 */
function athensOffsetMs(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CALENDAR_TIMEZONE,
    year: "numeric",
    month: DATE_PART_2_DIGIT,
    day: DATE_PART_2_DIGIT,
    hour: DATE_PART_2_DIGIT,
    minute: DATE_PART_2_DIGIT,
    second: DATE_PART_2_DIGIT,
    hour12: false,
  });
  const p = Object.fromEntries(
    fmt.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  const localMs = Date.UTC(
    +p.year,
    +p.month - 1,
    +p.day,
    +p.hour % 24,
    +p.minute,
    +p.second,
  );
  return localMs - date.getTime();
}

async function calendarFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${CALENDAR_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

interface TimeSlot {
  start: string;
  end: string;
}

/**
 * Get free/busy info for the next N days and return available 30-min slots
 * during business hours (09:00-17:00 Athens time, weekdays only).
 */
export async function getAvailableSlots(daysAhead = 7): Promise<TimeSlot[]> {
  const { GOOGLE_CALENDAR_ID } = await getConfig();
  const calendarId = GOOGLE_CALENDAR_ID ?? DEFAULT_CALENDAR_ID;

  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * MS_PER_DAY);

  const freeBusyRes = await calendarFetch("/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      items: [{ id: calendarId }],
    }),
  });

  if (!freeBusyRes.ok) return [];
  const freeBusyData = await freeBusyRes.json();
  const busySlots: TimeSlot[] =
    freeBusyData.calendars?.[calendarId]?.busy ?? [];

  // Generate 30-min slots during business hours (09:00-17:00 Europe/Athens).
  // Athens is UTC+2 (EET) in winter and UTC+3 (EEST) in summer; the offset
  // is computed per-day so DST transitions are handled correctly.
  const slots: TimeSlot[] = [];

  for (let d = 0; d < daysAhead; d++) {
    const day = new Date(now.getTime() + d * MS_PER_DAY);
    const dayOfWeek = day.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

    for (let hour = BUSINESS_OPEN_HOUR; hour < BUSINESS_CLOSE_HOUR; hour++) {
      for (const minute of [0, SLOT_DURATION_MINUTES]) {
        const slotStart = new Date(day);
        slotStart.setUTCHours(0, 0, 0, 0);
        const offset = athensOffsetMs(slotStart);
        slotStart.setTime(
          slotStart.getTime() + hour * MS_PER_HOUR + minute * MS_PER_MINUTE - offset,
        );
        const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * MS_PER_MINUTE);

        if (slotStart < now) continue;

        const isBusy = busySlots.some((busy) => {
          const bs = new Date(busy.start);
          const be = new Date(busy.end);
          return slotStart < be && slotEnd > bs;
        });

        if (!isBusy) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
          });
        }
      }
    }
  }

  return slots;
}

/** Book a consultation by creating a calendar event */
export async function bookConsultation(data: {
  name: string;
  email: string;
  start: string;
  end: string;
  notes?: string;
}): Promise<{ eventId: string; htmlLink: string } | null> {
  const { GOOGLE_CALENDAR_ID } = await getConfig();
  const calendarId = GOOGLE_CALENDAR_ID ?? DEFAULT_CALENDAR_ID;

  try {
    const res = await calendarFetch(
      `/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
      {
        method: "POST",
        body: JSON.stringify({
          summary: `Cloudless Consultation \u2014 ${data.name}`,
          description: [
            `Client: ${data.name}`,
            `Email: ${data.email}`,
            data.notes ? `\nNotes: ${data.notes}` : "",
          ].join("\n"),
          start: { dateTime: data.start, timeZone: CALENDAR_TIMEZONE },
          end: { dateTime: data.end, timeZone: CALENDAR_TIMEZONE },
          attendees: [{ email: data.email }],
          reminders: {
            useDefault: false,
            overrides: [
              { method: "email", minutes: 60 }, // NOSONAR — reminder minutes are semantic config values
              { method: "popup", minutes: 15 }, // NOSONAR
            ],
          },
          conferenceData: {
            createRequest: {
              requestId: `cloudless-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }),
      },
    );

    if (!res.ok) {
      console.error("[GCal] Create event failed:", res.status);
      return null;
    }

    const event = await res.json();
    return { eventId: event.id, htmlLink: event.htmlLink };
  } catch (err) {
    console.error("[GCal] Error:", err);
    return null;
  }
}

interface Consultation {
  id: string;
  title: string;
  start: string;
  end: string;
  meetLink?: string;
  status: "upcoming" | "past";
}

/**
 * Find consultation events for a specific attendee email.
 * Searches from 90 days ago to 30 days ahead.
 */
export async function getConsultationsByEmail(
  email: string,
): Promise<Consultation[]> {
  const { GOOGLE_CALENDAR_ID } = await getConfig();
  const calendarId = GOOGLE_CALENDAR_ID ?? DEFAULT_CALENDAR_ID;

  const now = new Date();
  const timeMin = new Date(now.getTime() - LOOKBACK_DAYS * MS_PER_DAY).toISOString();
  const timeMax = new Date(now.getTime() + LOOKAHEAD_DAYS * MS_PER_DAY).toISOString();

  try {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      q: email,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(MAX_CALENDAR_RESULTS),
    });

    const res = await calendarFetch(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    );

    if (!res.ok) return [];
    const data = await res.json();
    const items = data.items ?? [];

    return items
      .filter(
        (evt: Record<string, unknown>) =>
          typeof evt.summary === "string" &&
          (evt.summary as string).toLowerCase().includes("consultation"),
      )
      .map((evt: Record<string, unknown>) => {
        const start = (evt.start as { dateTime?: string })?.dateTime ?? "";
        return {
          id: evt.id as string,
          title: evt.summary as string,
          start,
          end: (evt.end as { dateTime?: string })?.dateTime ?? "",
          meetLink: (
            evt.conferenceData as { entryPoints?: Array<{ uri?: string }> }
          )?.entryPoints?.[0]?.uri,
          status: new Date(start) > now ? "upcoming" : "past",
        } satisfies Consultation;
      });
  } catch (err) {
    console.error("[GCal] getConsultationsByEmail error:", err);
    return [];
  }
}
