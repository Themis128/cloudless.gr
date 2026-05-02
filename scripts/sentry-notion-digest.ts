/**
 * Sentry → Notion Weekly Error Digest
 *
 * Fetches the top unresolved Sentry issues and writes a weekly digest page
 * into the NOTION_REPORTS_DB_ID database so error trends are visible
 * alongside other business reports inside Notion.
 *
 * Designed to run from .github/workflows/sentry-notion-digest.yml every
 * Monday at 08:00 UTC. Self-contained: reads everything from process.env.
 *
 * Required env:
 *   SENTRY_AUTH_TOKEN        Sentry auth token (scopes: project:read)
 *   NOTION_API_KEY           Notion integration token
 *   NOTION_REPORTS_DB_ID     Destination Notion database ID
 *
 * Optional env:
 *   SENTRY_ORG               Sentry org slug (default: "baltzakisthemiscom")
 *   SENTRY_PROJECT           Sentry project slug (default: "cloudless-gr")
 *   SLACK_WEBHOOK_URL        Slack webhook for success/failure notifications
 *
 * Notion DB schema (NOTION_REPORTS_DB_ID — matches existing notion-reports.ts):
 *   Name        Title       "Sentry Digest YYYY-MM-DD"
 *   ReportID    Rich text   "sentry-digest-YYYY-MM-DD" — deduplication key
 *   Status      Select      "ready" | "error"
 *   DateStart   Date        Start of reporting window (7 days ago)
 *   DateEnd     Rich text   End of reporting window (today)
 *   Sections    Rich text   JSON: { fatal, errors, warnings, total, topIssues }
 *   CreatedAt   Date        Page creation timestamp
 */

const SENTRY_API = "https://sentry.io/api/0";
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[sentry-notion-digest] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

// ---------------------------------------------------------------------------
// Sentry helpers
// ---------------------------------------------------------------------------

interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  level: "fatal" | "error" | "warning" | "info" | "debug";
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  status: string;
  shortId: string;
  permalink: string;
}

interface SentryCountsByLevel {
  fatal: number;
  error: number;
  warning: number;
  total: number;
}

async function fetchIssues(
  token: string,
  org: string,
  project: string,
  limit = 50,
): Promise<SentryIssue[]> {
  const params = new URLSearchParams({
    query: "is:unresolved",
    sort: "freq",
    limit: String(limit),
  });

  const res = await fetch(
    `${SENTRY_API}/projects/${org}/${project}/issues/?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Sentry auth error ${res.status} — check SENTRY_AUTH_TOKEN scopes (requires project:read).`,
    );
  }

  if (!res.ok) {
    throw new Error(`Sentry issues fetch failed: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as SentryIssue[];
}

function countsByLevel(issues: SentryIssue[]): SentryCountsByLevel {
  const counts: SentryCountsByLevel = { fatal: 0, error: 0, warning: 0, total: issues.length };
  for (const issue of issues) {
    if (issue.level === "fatal") counts.fatal++;
    else if (issue.level === "error") counts.error++;
    else if (issue.level === "warning") counts.warning++;
  }
  return counts;
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

/** Returns a rich_text array (pass directly as value of a rich_text property). */
function rtArr(text: string) {
  return [{ text: { content: (text ?? "").slice(0, 2000) } }];
}

async function upsertDigest(
  apiKey: string,
  dbId: string,
  reportId: string,
  title: string,
  dateStart: string,
  dateEnd: string,
  sections: string,
  status: "ready" | "error",
): Promise<"created" | "updated"> {
  const existing = await notionQuery(apiKey, dbId, {
    property: "ReportID",
    rich_text: { equals: reportId },
  });

  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: title } }] },
    ReportID: { rich_text: rtArr(reportId) },
    Status: { select: { name: status } },
    DateStart: { date: { start: dateStart } },
    DateEnd: { rich_text: rtArr(dateEnd) },
    Sections: { rich_text: rtArr(sections) },
    CreatedAt: { date: { start: new Date().toISOString() } },
  };

  if (existing.length > 0) {
    const pageId = existing[0].id;
    await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });
    return "updated";
  }

  await fetch(`${NOTION_API}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  });
  return "created";
}

// ---------------------------------------------------------------------------
// Slack notification
// ---------------------------------------------------------------------------

async function notifySlack(
  url: string,
  success: boolean,
  counts?: SentryCountsByLevel,
  topIssues?: SentryIssue[],
  error?: string,
  runUrl?: string,
): Promise<void> {
  const body = success
    ? {
        text: "🐛 Sentry weekly digest synced to Notion",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🐛 Sentry Weekly Error Digest",
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Unresolved issues:* ${counts!.total}`,
              },
              { type: "mrkdwn", text: `*Fatal:* ${counts!.fatal}` },
              { type: "mrkdwn", text: `*Errors:* ${counts!.error}` },
              { type: "mrkdwn", text: `*Warnings:* ${counts!.warning}` },
            ],
          },
          ...(topIssues && topIssues.length > 0
            ? [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text:
                      "*Top issues:*\n" +
                      topIssues
                        .slice(0, 5)
                        .map(
                          (i) =>
                            `• <${i.permalink}|${i.shortId}> — ${i.title.slice(0, 60)} (×${i.count})`,
                        )
                        .join("\n"),
                  },
                },
              ]
            : []),
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
        text: "❌ Sentry → Notion digest failed",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "❌ Sentry Digest Sync Failed",
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
  const sentryToken = requireEnv("SENTRY_AUTH_TOKEN");
  const notionApiKey = requireEnv("NOTION_API_KEY");
  const notionDbId = requireEnv("NOTION_REPORTS_DB_ID");
  const sentryOrg = optionalEnv("SENTRY_ORG") ?? "baltzakisthemiscom";
  const sentryProject = optionalEnv("SENTRY_PROJECT") ?? "cloudless-gr";
  const slackUrl = optionalEnv("SLACK_WEBHOOK_URL");
  const runUrl = optionalEnv("GITHUB_RUN_URL");

  console.log(
    `[sentry-notion-digest] fetching issues for ${sentryOrg}/${sentryProject}`,
  );

  const issues = await fetchIssues(sentryToken, sentryOrg, sentryProject, 50);
  console.log(`[sentry-notion-digest] found ${issues.length} unresolved issues`);

  const counts = countsByLevel(issues);
  const topIssues = issues.slice(0, 10);

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const reportId = `sentry-digest-${today}`;
  const sections = JSON.stringify({
    fatal: counts.fatal,
    errors: counts.error,
    warnings: counts.warning,
    total: counts.total,
    topIssues: topIssues.map((i) => ({
      id: i.id,
      shortId: i.shortId,
      title: i.title,
      level: i.level,
      count: i.count,
      userCount: i.userCount,
      lastSeen: i.lastSeen,
      permalink: i.permalink,
    })),
    generatedAt: new Date().toISOString(),
  });

  const result = await upsertDigest(
    notionApiKey,
    notionDbId,
    reportId,
    `Sentry Digest ${today}`,
    weekAgo,
    today,
    sections,
    "ready",
  );

  console.log(
    `[sentry-notion-digest] ${result} digest page — fatal=${counts.fatal} error=${counts.error} warning=${counts.warning} total=${counts.total}`,
  );

  if (slackUrl) {
    await notifySlack(slackUrl, true, counts, topIssues, undefined, runUrl);
  }
}

main().catch(async (err: unknown) => {
  console.error("[sentry-notion-digest] FAILED:", err);
  const slackUrl = optionalEnv("SLACK_WEBHOOK_URL");
  if (slackUrl) {
    await notifySlack(
      slackUrl,
      false,
      undefined,
      undefined,
      String(err),
      optionalEnv("GITHUB_RUN_URL"),
    );
  }
  process.exit(1);
});
