import { createGoogleAuth } from "@/lib/google-auth";
import { getConfig } from "@/lib/ssm-config";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const getAccessToken = createGoogleAuth(
  "https://www.googleapis.com/auth/calendar",
);

/**
 * Returns the UTC offset for Europe/Athens at the given instant, in ms.
 * Handles DST correctly (Athens is UTC+2 EET in winter, UTC+3 EEST in summer).
 */
function athensOffsetMs(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Athens",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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
  const calendarId = GOOGLE_CALENDAR_ID || "primary";

  const now = new Date();
  const end = new Date(now.getTime() + daysAhead * 86400000);

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
    const day = new Date(now.getTime() + d * 86400000);
    const dayOfWeek = day.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends

    for (let hour = 9; hour < 17; hour++) {
      for (const minute of [0, 30]) {
        const slotStart = new Date(day);
        slotStart.setUTCHours(0, 0, 0, 0);
        const offset = athensOffsetMs(slotStart);
        slotStart.setTime(
          slotStart.getTime() + hour * 3600000 + minute * 60000 - offset,
        );
        const slotEnd = new Date(slotStart.getTime() + 30 * 60000);

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
  const calendarId = GOOGLE_CALENDAR_ID || "primary";

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
          start: { dateTime: data.start, timeZone: "Europe/Athens" },
          end: { dateTime: data.end, timeZone: "Europe/Athens" },
          attendees: [{ email: data.email }],
          reminders: {
            useDefault: false,
            overrides: [
              { method: "email", minutes: 60 },
              { method: "popup", minutes: 15 },
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
  const calendarId = GOOGLE_CALENDAR_ID || "primary";

  const now = new Date();
  const timeMin = new Date(now.getTime() - 90 * 86400000).toISOString();
  const timeMax = new Date(now.getTime() + 30 * 86400000).toISOString();

  try {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      q: email,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
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
