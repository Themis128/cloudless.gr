/**
 * Stripe → Notion Orders Sync
 *
 * Pulls checkout sessions completed in the last 24 h from Stripe and
 * upserts them into the NOTION_ORDERS_DB_ID Notion database for
 * centralised order tracking alongside other business data.
 *
 * Designed to run from .github/workflows/stripe-notion-sync.yml on the
 * daily 06:30 UTC cron. Self-contained: reads everything from process.env.
 *
 * Required env:
 *   STRIPE_SECRET_KEY        Stripe secret key (sk_live_... or sk_test_...)
 *   NOTION_API_KEY           Notion integration token
 *   NOTION_ORDERS_DB_ID      Destination Notion database ID
 *
 * Optional env:
 *   SLACK_WEBHOOK_URL        Slack webhook for success/failure notifications
 *
 * Notion DB schema (NOTION_ORDERS_DB_ID):
 *   Name           Title       "Order {short-session-id}"
 *   Email          Email       Customer email address
 *   Amount         Number      Order total in the order's currency (e.g. 4900 = €49.00)
 *   Currency       Select      ISO currency code (EUR, USD, …)
 *   Status         Select      complete | expired
 *   PaymentStatus  Select      paid | unpaid | no_payment_required
 *   Mode           Select      payment | subscription | setup
 *   OrderDate      Date        Stripe session created timestamp (ISO 8601)
 *   StripeID       Rich text   Full Stripe session ID (cs_live_…) — deduplication key
 *   LineItems      Rich text   JSON summary of purchased line items
 */

const STRIPE_API = "https://api.stripe.com/v1";
const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[stripe-notion-sync] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

// ---------------------------------------------------------------------------
// Stripe helpers
// ---------------------------------------------------------------------------

interface StripeLineItem {
  description?: string;
  quantity?: number;
  amount_total?: number;
}

interface StripeSession {
  id: string;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  amount_total?: number | null;
  currency?: string | null;
  status?: string | null;
  payment_status?: string | null;
  mode?: string | null;
  created: number;
  line_items?: { data: StripeLineItem[] };
}

interface StripeListResponse {
  data: StripeSession[];
  has_more: boolean;
  url: string;
}

async function fetchRecentSessions(
  secretKey: string,
  since: number,
): Promise<StripeSession[]> {
  const all: StripeSession[] = [];
  let startingAfter: string | undefined;

  do {
    const params = new URLSearchParams({
      "created[gte]": String(since),
      limit: "100",
      expand: ["data.line_items"].join(","),
    });
    if (startingAfter) params.set("starting_after", startingAfter);

    const res = await fetch(
      `${STRIPE_API}/checkout/sessions?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Stripe-Version": "2025-02-24.acacia",
        },
      },
    );

    if (!res.ok) {
      throw new Error(
        `Stripe sessions list failed: ${res.status} ${await res.text()}`,
      );
    }

    const data = (await res.json()) as StripeListResponse;
    all.push(...data.data);

    if (data.has_more && data.data.length > 0) {
      startingAfter = data.data[data.data.length - 1].id;
    } else {
      startingAfter = undefined;
    }
  } while (startingAfter);

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

async function upsertSession(
  apiKey: string,
  dbId: string,
  session: StripeSession,
): Promise<"created" | "updated" | "skipped"> {
  const email =
    session.customer_email ?? session.customer_details?.email ?? "";
  const shortId = session.id.slice(-12);
  const lineItemsSummary = JSON.stringify(
    (session.line_items?.data ?? []).map((li) => ({
      description: li.description ?? "",
      quantity: li.quantity ?? 1,
      amount_total: li.amount_total ?? 0,
    })),
  );

  const existing = await notionQuery(apiKey, dbId, {
    property: "StripeID",
    rich_text: { equals: session.id },
  });

  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: `Order ${shortId}` } }] },
    ...(email ? { Email: { email } } : {}),
    Amount: { number: session.amount_total ?? 0 },
    ...(session.currency
      ? {
          Currency: {
            select: { name: (session.currency ?? "eur").toUpperCase() },
          },
        }
      : {}),
    ...(session.status
      ? { Status: { select: { name: session.status } } }
      : {}),
    ...(session.payment_status
      ? { PaymentStatus: { select: { name: session.payment_status } } }
      : {}),
    ...(session.mode
      ? { Mode: { select: { name: session.mode } } }
      : {}),
    OrderDate: {
      date: { start: new Date(session.created * 1000).toISOString() },
    },
    StripeID: rt(session.id),
    LineItems: rt(lineItemsSummary),
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
        `[stripe-notion-sync] update failed for ${session.id}: ${res.status}`,
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
      `[stripe-notion-sync] create failed for ${session.id}: ${res.status}`,
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
  stats?: {
    created: number;
    updated: number;
    skipped: number;
    total: number;
    revenue: number;
  },
  error?: string,
  runUrl?: string,
): Promise<void> {
  const body = success
    ? {
        text: "💳 Stripe → Notion orders sync complete",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "💳 Stripe → Notion Orders Sync",
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Total sessions:* ${stats!.total}` },
              { type: "mrkdwn", text: `*Created:* ${stats!.created}` },
              { type: "mrkdwn", text: `*Updated:* ${stats!.updated}` },
              {
                type: "mrkdwn",
                text: `*Revenue (24h):* ${(stats!.revenue / 100).toFixed(2)}`,
              },
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
        text: "❌ Stripe → Notion orders sync failed",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "❌ Stripe → Notion Orders Sync Failed",
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
  const stripeKey = requireEnv("STRIPE_SECRET_KEY");
  const notionApiKey = requireEnv("NOTION_API_KEY");
  const notionDbId = requireEnv("NOTION_ORDERS_DB_ID");
  const slackUrl = optionalEnv("SLACK_WEBHOOK_URL");
  const runUrl = optionalEnv("GITHUB_RUN_URL");

  // Sync sessions created in the last 24 hours
  const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  console.log(
    `[stripe-notion-sync] fetching sessions since ${new Date(since * 1000).toISOString()}`,
  );

  const sessions = await fetchRecentSessions(stripeKey, since);
  console.log(`[stripe-notion-sync] found ${sessions.length} sessions`);

  const stats = {
    created: 0,
    updated: 0,
    skipped: 0,
    total: sessions.length,
    revenue: 0,
  };

  for (const session of sessions) {
    const result = await upsertSession(notionApiKey, notionDbId, session);
    stats[result]++;
    if (session.payment_status === "paid") {
      stats.revenue += session.amount_total ?? 0;
    }
    console.log(`[stripe-notion-sync] ${result}: ${session.id}`);
  }

  console.log(
    `[stripe-notion-sync] done — created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} revenue=${(stats.revenue / 100).toFixed(2)}`,
  );

  if (slackUrl) {
    await notifySlack(slackUrl, true, stats, undefined, runUrl);
  }
}

main().catch(async (err: unknown) => {
  console.error("[stripe-notion-sync] FAILED:", err);
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
