/**
 * Weekly Newsletter Subscriber Report
 *
 * Queries HubSpot for subscriber stats, posts a summary to Slack (#subscribers),
 * and logs the week's numbers in a Notion "Newsletter Reports" database
 * (auto-created on first run if the integration has workspace-level access).
 *
 * Designed to run from .github/workflows/weekly-subscriber-report.yml on
 * Mondays at 10:00 UTC, one hour after the newsletter send.
 *
 * Self-contained: reads env directly, no src/lib/* imports.
 *
 * Required env:
 *   HUBSPOT_API_KEY     HubSpot private-app token
 *   NOTION_API_KEY      Notion integration token
 *   SLACK_WEBHOOK_URL   (optional) Slack incoming-webhook URL
 *
 * Note: "New this week" counts contacts whose HubSpot record was created in
 * the last 7 days AND who have lead_source = "newsletter_signup". Contacts
 * who were already in HubSpot before subscribing this week are not counted;
 * use the HubSpot contacts view for full trend data.
 *
 * Exit codes: 0 success, 1 hard failure
 */

const HUBSPOT_SEARCH = "https://api.hubapi.com/crm/v3/objects/contacts/search";
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const REPORTS_DB_TITLE = "Newsletter Reports";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[weekly-subscriber-report] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

// ── HubSpot ───────────────────────────────────────────────────────────────────

interface HubSpotFilter {
  propertyName: string;
  operator: string;
  value: string;
}

async function countHubSpotContacts(filters: HubSpotFilter[]): Promise<number> {
  const token = requireEnv("HUBSPOT_API_KEY");
  const res = await fetch(HUBSPOT_SEARCH, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filterGroups: [{ filters }],
      properties: ["email"],
      limit: 1,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `HubSpot search failed: ${res.status} ${await res.text().catch(() => "")}`,
    );
  }
  const data = (await res.json()) as { total: number };
  return data.total;
}

async function fetchSubscriberStats(week: string): Promise<{
  total: number;
  newThisWeek: number;
  totalUnsubscribed: number;
  week: string;
}> {
  const signupFilter: HubSpotFilter = {
    propertyName: "lead_source",
    operator: "EQ",
    value: "newsletter_signup",
  };
  const unsubFilter: HubSpotFilter = {
    propertyName: "lead_source",
    operator: "EQ",
    value: "newsletter_unsubscribed",
  };
  const newThisWeekFilter: HubSpotFilter = {
    propertyName: "createdate",
    operator: "GTE",
    value: String(Date.now() - SEVEN_DAYS_MS),
  };

  const [total, newThisWeek, totalUnsubscribed] = await Promise.all([
    countHubSpotContacts([signupFilter]),
    countHubSpotContacts([signupFilter, newThisWeekFilter]),
    countHubSpotContacts([unsubFilter]),
  ]);

  return { total, newThisWeek, totalUnsubscribed, week };
}

// ── Notion ────────────────────────────────────────────────────────────────────

async function notionFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = requireEnv("NOTION_API_KEY");
  return fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function findReportsDb(): Promise<string | null> {
  const res = await notionFetch("/search", {
    method: "POST",
    body: JSON.stringify({
      query: REPORTS_DB_TITLE,
      filter: { value: "database", property: "object" },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results: Array<{ id: string; title?: Array<{ plain_text?: string }> }>;
  };
  const match = data.results.find((r) =>
    (r.title ?? []).some(
      (t) => (t.plain_text ?? "").trim() === REPORTS_DB_TITLE,
    ),
  );
  return match?.id ?? null;
}

async function createReportsDb(): Promise<string | null> {
  const res = await notionFetch("/databases", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "workspace", workspace: true },
      title: [{ type: "text", text: { content: REPORTS_DB_TITLE } }],
      properties: {
        Name: { title: {} },
        Week: { date: {} },
        "Total Subscribers": { number: {} },
        "New This Week": { number: {} },
        "Total Unsubscribed": { number: {} },
      },
    }),
  });
  if (!res.ok) {
    console.warn(
      `[weekly-subscriber-report] Notion DB create failed: ${res.status} — skipping Notion insert`,
    );
    return null;
  }
  const db = (await res.json()) as { id: string };
  console.log(`[weekly-subscriber-report] created Notion database: ${db.id}`);
  return db.id;
}

async function insertNotionRow(
  dbId: string,
  stats: {
    total: number;
    newThisWeek: number;
    totalUnsubscribed: number;
    week: string;
  },
): Promise<void> {
  const res = await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties: {
        Name: {
          title: [{ text: { content: `Newsletter Report — ${stats.week}` } }],
        },
        Week: { date: { start: stats.week } },
        "Total Subscribers": { number: stats.total },
        "New This Week": { number: stats.newThisWeek },
        "Total Unsubscribed": { number: stats.totalUnsubscribed },
      },
    }),
  });
  if (!res.ok) {
    console.warn(
      `[weekly-subscriber-report] Notion row insert failed: ${res.status}`,
    );
  }
}

async function saveToNotion(stats: {
  total: number;
  newThisWeek: number;
  totalUnsubscribed: number;
  week: string;
}): Promise<void> {
  try {
    const existingId = await findReportsDb();
    const dbId = existingId ?? (await createReportsDb());
    if (!dbId) return;
    await insertNotionRow(dbId, stats);
    console.log("[weekly-subscriber-report] Notion row saved");
  } catch (err) {
    console.warn("[weekly-subscriber-report] Notion save failed:", err);
  }
}

// ── Slack ─────────────────────────────────────────────────────────────────────

async function postSlackReport(stats: {
  total: number;
  newThisWeek: number;
  totalUnsubscribed: number;
  week: string;
}): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  const text = [
    `:bar_chart: *Newsletter Subscriber Report — ${stats.week}*`,
    `• Total active subscribers: *${stats.total}*`,
    `• New this week: *${stats.newThisWeek}*`,
    `• Total unsubscribed: *${stats.totalUnsubscribed}*`,
  ].join("\n");
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `Newsletter Report — ${stats.week}`,
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Total active*\n${stats.total}` },
              { type: "mrkdwn", text: `*New this week*\n${stats.newThisWeek}` },
              {
                type: "mrkdwn",
                text: `*Total unsubscribed*\n${stats.totalUnsubscribed}`,
              },
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "cloudless.gr newsletter · via HubSpot",
              },
            ],
          },
        ],
      }),
    });
    console.log("[weekly-subscriber-report] Slack report sent");
  } catch (err) {
    console.warn("[weekly-subscriber-report] Slack send failed:", err);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("[weekly-subscriber-report] starting");
  const week = new Date().toISOString().slice(0, 10);

  const stats = await fetchSubscriberStats(week);
  console.log("[weekly-subscriber-report] stats:", JSON.stringify(stats));

  await Promise.all([saveToNotion(stats), postSlackReport(stats)]);
  console.log("[weekly-subscriber-report] done");
}

main().catch((err) => {
  console.error("[weekly-subscriber-report] FAILED:", err);
  process.exit(1);
});
