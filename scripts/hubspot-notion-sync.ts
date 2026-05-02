/**
 * HubSpot → Notion CRM Sync
 *
 * Pulls contacts updated in the last 24 h from HubSpot and upserts them
 * into the NOTION_CRM_SYNC_DB_ID Notion database so the team has a
 * unified CRM view inside Notion.
 *
 * Designed to run from .github/workflows/hubspot-notion-sync.yml on the
 * daily 06:00 UTC cron. Self-contained: reads everything from process.env.
 *
 * Required env:
 *   HUBSPOT_API_KEY          HubSpot private-app token
 *   NOTION_API_KEY           Notion integration token
 *   NOTION_CRM_SYNC_DB_ID    Destination Notion database ID
 *
 * Optional env:
 *   SLACK_WEBHOOK_URL        Slack webhook for success/failure notifications
 *
 * Notion DB schema (NOTION_CRM_SYNC_DB_ID):
 *   Name           Title       Full name (firstname + lastname)
 *   Email          Email       Contact email address
 *   Company        Rich text   Company name from HubSpot
 *   LeadStatus     Select      hs_lead_status value from HubSpot
 *   HubSpotID      Rich text   HubSpot contact ID (used for deduplication)
 *   CreatedAt      Date        Contact created date (ISO 8601)
 *   UpdatedAt      Date        Contact last updated date (ISO 8601)
 */

const HUBSPOT_API = "https://api.hubapi.com";
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[hubspot-notion-sync] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

// ---------------------------------------------------------------------------
// HubSpot helpers
// ---------------------------------------------------------------------------

interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
    hs_lead_status?: string;
    createdate?: string;
    lastmodifieddate?: string;
  };
}

interface HubSpotSearchResponse {
  results: HubSpotContact[];
  paging?: { next?: { after: string } };
}

async function fetchRecentContacts(
  token: string,
  since: string,
): Promise<HubSpotContact[]> {
  const all: HubSpotContact[] = [];
  let after: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "lastmodifieddate",
              operator: "GTE",
              value: since,
            },
          ],
        },
      ],
      properties: [
        "email",
        "firstname",
        "lastname",
        "company",
        "hs_lead_status",
        "createdate",
        "lastmodifieddate",
      ],
      limit: 100,
    };
    if (after) body.after = after;

    const res = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(
        `HubSpot search failed: ${res.status} ${await res.text()}`,
      );
    }

    const data = (await res.json()) as HubSpotSearchResponse;
    all.push(...data.results);
    after = data.paging?.next?.after;
  } while (after);

  return all;
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
  return { rich_text: [{ text: { content: (text ?? "").slice(0, 2000) } }] };
}

async function upsertContact(
  apiKey: string,
  dbId: string,
  contact: HubSpotContact,
): Promise<"created" | "updated" | "skipped"> {
  const p = contact.properties;
  const fullName = [p.firstname, p.lastname].filter(Boolean).join(" ") || "—";
  const email = p.email ?? "";

  // Check for existing page by HubSpotID
  const existing = await notionQuery(apiKey, dbId, {
    property: "HubSpotID",
    rich_text: { equals: contact.id },
  });

  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: fullName } }] },
    ...(email ? { Email: { email } } : {}),
    Company: rt(p.company ?? ""),
    ...(p.hs_lead_status
      ? { LeadStatus: { select: { name: p.hs_lead_status } } }
      : {}),
    HubSpotID: rt(contact.id),
    ...(p.createdate ? { CreatedAt: { date: { start: p.createdate } } } : {}),
    ...(p.lastmodifieddate
      ? { UpdatedAt: { date: { start: p.lastmodifieddate } } }
      : {}),
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
        `[hubspot-notion-sync] update failed for ${contact.id}: ${res.status}`,
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
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties,
    }),
  });

  if (!res.ok) {
    console.warn(
      `[hubspot-notion-sync] create failed for ${contact.id}: ${res.status}`,
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
        text: "🔗 HubSpot → Notion CRM sync complete",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🔗 HubSpot → Notion CRM Sync",
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Total contacts:* ${stats!.total}` },
              { type: "mrkdwn", text: `*Created:* ${stats!.created}` },
              { type: "mrkdwn", text: `*Updated:* ${stats!.updated}` },
              { type: "mrkdwn", text: `*Skipped:* ${stats!.skipped}` },
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
        text: "❌ HubSpot → Notion CRM sync failed",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "❌ HubSpot → Notion CRM Sync Failed",
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
  const hubspotToken = requireEnv("HUBSPOT_API_KEY");
  const notionApiKey = requireEnv("NOTION_API_KEY");
  const notionDbId = requireEnv("NOTION_CRM_SYNC_DB_ID");
  const slackUrl = optionalEnv("SLACK_WEBHOOK_URL");
  const runUrl = optionalEnv("GITHUB_RUN_URL");

  // Sync contacts updated in the last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  console.log(`[hubspot-notion-sync] fetching contacts updated since ${since}`);

  const contacts = await fetchRecentContacts(hubspotToken, since);
  console.log(`[hubspot-notion-sync] found ${contacts.length} contacts`);

  const stats = { created: 0, updated: 0, skipped: 0, total: contacts.length };

  for (const contact of contacts) {
    const result = await upsertContact(notionApiKey, notionDbId, contact);
    stats[result]++;
    console.log(
      `[hubspot-notion-sync] ${result}: ${contact.properties.email ?? contact.id}`,
    );
  }

  console.log(
    `[hubspot-notion-sync] done — created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`,
  );

  if (slackUrl) {
    await notifySlack(slackUrl, true, stats, undefined, runUrl);
  }
}

main().catch(async (err: unknown) => {
  console.error("[hubspot-notion-sync] FAILED:", err);
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
