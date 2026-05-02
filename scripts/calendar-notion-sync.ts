/**
 * Google Calendar → Notion Consultations Sync
 *
 * Fetches events for the next 14 days from the configured Google Calendar
 * and upserts them into the NOTION_CALENDAR_DB_ID database so consultations
 * are visible inside the Notion content calendar.
 *
 * Designed to run from .github/workflows/calendar-notion-sync.yml on the
 * daily 07:00 UTC cron. Self-contained: reads everything from process.env.
 * Uses the same Google service-account JWT auth pattern as weekly-gsc-sync.ts.
 *
 * Required env:
 *   GOOGLE_CLIENT_EMAIL      Service-account email with Calendar read access
 *   GOOGLE_PRIVATE_KEY       PEM private key (literal \n → replaced before signing)
 *   GOOGLE_CALENDAR_ID       Calendar ID (e.g. "primary" or email address)
 *   NOTION_API_KEY           Notion integration token
 *   NOTION_CALENDAR_DB_ID    Destination Notion database ID
 *
 * Optional env:
 *   SLACK_WEBHOOK_URL        Slack webhook for success/failure notifications
 *
 * Notion DB schema (NOTION_CALENDAR_DB_ID — matches existing notion-calendar.ts):
 *   Name      Title       Event summary (title)
 *   CalID     Rich text   Google Calendar event ID — deduplication key
 *   Type      Select      Always "consultation"
 *   Platform  Select      Always "google"
 *   Date      Date        Start + end timestamps (ISO 8601)
 *   Status    Select      "scheduled" | "cancelled"
 *   URL       URL         Google Meet link or event htmlLink
 *   Notes     Rich text   Event description (truncated to 2000 chars)
 */

import { SignJWT, importPKCS8 } from "jose";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[calendar-notion-sync] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

// ---------------------------------------------------------------------------
// Google OAuth helpers (service account JWT)
// ---------------------------------------------------------------------------

async function getGoogleAccessToken(): Promise<string> {
  const email = requireEnv("GOOGLE_CLIENT_EMAIL");
  const rawKey = requireEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const privateKey = await importPKCS8(rawKey, "RS256");
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    iss: email,
    scope: CALENDAR_SCOPE,
    aud: TOKEN_URL,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Google token exchange failed: ${res.status} ${await res.text()}`,
    );
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Google Calendar helpers
// ---------------------------------------------------------------------------

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  htmlLink?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri: string }>;
  };
}

interface CalendarListResponse {
  items?: CalendarEvent[];
  nextPageToken?: string;
}

async function fetchUpcomingEvents(
  token: string,
  calendarId: string,
  days = 14,
): Promise<CalendarEvent[]> {
  const all: CalendarEvent[] = [];
  const timeMin = new Date().toISOString();
  const timeMax = new Date(
    Date.now() + days * 24 * 60 * 60 * 1000,
  ).toISOString();
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      maxResults: "100",
      singleEvents: "true",
      orderBy: "startTime",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const encodedId = encodeURIComponent(calendarId);
    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodedId}/events?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!res.ok) {
      throw new Error(
        `Calendar events fetch failed: ${res.status} ${await res.text()}`,
      );
    }

    const data = (await res.json()) as CalendarListResponse;
    all.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return all;
}

function getMeetLink(event: CalendarEvent): string {
  if (event.hangoutLink) return event.hangoutLink;
  const entry = event.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === "video",
  );
  return entry?.uri ?? event.htmlLink ?? "";
}

// ---------------------------------------------------------------------------
// Notion helpers
// ---------------------------------------------------------------------------

async function notionQuery(
  apiKey: string,
  dbId: string,
  filter: Record<string, unknown>,
): Promise<{ id: string }[]> {
  const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filter, page_size: 1 }),
  });

  if (!res.ok) {
    throw new Error(`Notion query failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { results: { id: string }[] };
  return data.results;
}

function rt(text: string) {
  return [{ text: { content: (text ?? "").slice(0, 2000) } }];
}

async function upsertEvent(
  apiKey: string,
  dbId: string,
  event: CalendarEvent,
): Promise<"created" | "updated" | "skipped"> {
  const startDt = event.start?.dateTime ?? event.start?.date ?? "";
  const endDt = event.end?.dateTime ?? event.end?.date ?? "";
  const meetLink = getMeetLink(event);

  const existing = await notionQuery(apiKey, dbId, {
    property: "CalID",
    rich_text: { equals: event.id },
  });

  const properties: Record<string, unknown> = {
    Name: {
      title: [{ text: { content: (event.summary ?? "Consultation").slice(0, 100) } }],
    },
    CalID: { rich_text: rt(event.id) },
    Type: { select: { name: "consultation" } },
    Platform: { select: { name: "google" } },
    ...(startDt
      ? {
          Date: {
            date: {
              start: startDt,
              ...(endDt ? { end: endDt } : {}),
            },
          },
        }
      : {}),
    Status: {
      select: {
        name: event.status === "cancelled" ? "cancelled" : "scheduled",
      },
    },
    ...(meetLink ? { URL: { url: meetLink } } : {}),
    Notes: { rich_text: rt(event.description ?? "") },
  };

  if (existing.length > 0) {
    const pageId = existing[0].id;
    const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });
    if (!res.ok) {
      console.warn(
        `[calendar-notion-sync] update failed for ${event.id}: ${res.status}`,
      );
      return "skipped";
    }
    return "updated";
  }

  const res = await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  });

  if (!res.ok) {
    console.warn(
      `[calendar-notion-sync] create failed for ${event.id}: ${res.status}`,
    );
    return "skipped";
  }
  return "created";
}

// ---------------------------------------------------------------------------
// Slack notification
// ---------------------------------------------------------------------------

async function notifySlack(
  url: string,
  success: boolean,
  stats?: { created: number; updated: number; skipped: number; total: number },
  error?: string,
  runUrl?: string,
): Promise<void> {
  const body = success
    ? {
        text: "📅 Google Calendar → Notion sync complete",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "📅 Calendar → Notion Sync",
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Upcoming events:* ${stats!.total}`,
              },
              { type: "mrkdwn", text: `*Created:* ${stats!.created}` },
              { type: "mrkdwn", text: `*Updated:* ${stats!.updated}` },
            ],
          },
          ...(runUrl
            ? [
                {
                  type: "context",
                  elements: [
                    { type: "mrkdwn", text: `<${runUrl}|View run>` },
                  ],
                },
              ]
            : []),
        ],
      }
    : {
        text: "❌ Google Calendar → Notion sync failed",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "❌ Calendar → Notion Sync Failed",
              emoji: true,
            },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: error ?? "Unknown error" },
          },
          ...(runUrl
            ? [
                {
                  type: "context",
                  elements: [
                    { type: "mrkdwn", text: `<${runUrl}|View logs>` },
                  ],
                },
              ]
            : []),
        ],
      };

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const calendarId = requireEnv("GOOGLE_CALENDAR_ID");
  const notionApiKey = requireEnv("NOTION_API_KEY");
  const notionDbId = requireEnv("NOTION_CALENDAR_DB_ID");
  const slackUrl = optionalEnv("SLACK_WEBHOOK_URL");
  const runUrl = optionalEnv("GITHUB_RUN_URL");

  console.log(
    `[calendar-notion-sync] fetching upcoming events for calendar=${calendarId}`,
  );

  const token = await getGoogleAccessToken();
  console.log(`[calendar-notion-sync] obtained Google access token`);

  const events = await fetchUpcomingEvents(token, calendarId, 14);
  console.log(`[calendar-notion-sync] found ${events.length} events`);

  const stats = { created: 0, updated: 0, skipped: 0, total: events.length };

  for (const event of events) {
    const result = await upsertEvent(notionApiKey, notionDbId, event);
    stats[result]++;
    console.log(
      `[calendar-notion-sync] ${result}: ${event.id} "${event.summary ?? "untitled"}"`,
    );
  }

  console.log(
    `[calendar-notion-sync] done — created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`,
  );

  if (slackUrl) {
    await notifySlack(slackUrl, true, stats, undefined, runUrl);
  }
}

main().catch(async (err: unknown) => {
  console.error("[calendar-notion-sync] FAILED:", err);
  const slackUrl = optionalEnv("SLACK_WEBHOOK_URL");
  if (slackUrl) {
    await notifySlack(
      slackUrl,
      false,
      undefined,
      String(err),
      optionalEnv("GITHUB_RUN_URL"),
    );
  }
  process.exit(1);
});
