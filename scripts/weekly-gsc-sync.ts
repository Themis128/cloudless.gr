/**
 * Weekly GSC → Notion Sync
 *
 * Pulls a 28-day Google Search Console summary plus top-20 queries / pages
 * for the configured site, then writes one new page into the
 * NOTION_GSC_REPORTS_DB_ID database.
 *
 * Designed to run from .github/workflows/weekly-gsc-sync.yml on the standard
 * Monday-morning cron. Self-contained: reads everything from process.env so
 * it does not depend on src/lib/* (which require SSM + the @/ alias).
 *
 * Required env:
 *   GSC_SITE_URL                 e.g. "sc-domain:cloudless.gr"
 *   GOOGLE_CLIENT_EMAIL          service-account email with GSC access
 *   GOOGLE_PRIVATE_KEY           PEM with literal "\n" — replaced before signing
 *   NOTION_API_KEY               Notion integration token
 *   NOTION_GSC_REPORTS_DB_ID     destination database id
 *
 * Notion DB schema (matches what the workflow expects):
 *   Title           Title           "Week of YYYY-MM-DD"
 *   WeekStart       Date            ISO date (start of 28-day window)
 *   WeekEnd         Date            ISO date (end of 28-day window — today)
 *   Clicks          Number
 *   Impressions     Number
 *   CTR             Number          0..1 (Notion percent column expects fraction)
 *   AvgPosition     Number
 *   TopQueries      Rich text       JSON-stringified array of {q, clicks, ctr}
 *   TopPages        Rich text       JSON-stringified array of {p, clicks, ctr}
 *   GeneratedAt     Date            ISO timestamp at run time
 */

import { SignJWT, importPKCS8 } from "jose";

const GSC_API = "https://searchconsole.googleapis.com/webmasters/v3/sites";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[weekly-gsc-sync] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function dateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 28);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

async function getGoogleAccessToken(): Promise<string> {
  const email = requireEnv("GOOGLE_CLIENT_EMAIL");
  const rawKey = requireEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const privateKey = await importPKCS8(rawKey, "RS256");
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({ iss: email, scope: SCOPE, aud: TOKEN_URL })
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
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

interface GscRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function gscQuery(
  token: string,
  siteUrl: string,
  body: object,
): Promise<{ rows?: GscRow[] }> {
  const encoded = encodeURIComponent(siteUrl);
  const res = await fetch(`${GSC_API}/${encoded}/searchAnalytics/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GSC query failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<{ rows?: GscRow[] }>;
}

async function notionCreatePage(
  apiKey: string,
  dbId: string,
  properties: Record<string, unknown>,
): Promise<void> {
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
    throw new Error(`Notion create page failed: ${res.status} ${await res.text()}`);
  }
}

function rt(text: string) {
  return { rich_text: [{ text: { content: text.slice(0, 2000) } }] };
}

async function main(): Promise<void> {
  const siteUrl = requireEnv("GSC_SITE_URL");
  const notionApiKey = requireEnv("NOTION_API_KEY");
  const notionDbId = requireEnv("NOTION_GSC_REPORTS_DB_ID");

  console.log(`[weekly-gsc-sync] site=${siteUrl}`);

  const range = dateRange();
  console.log(`[weekly-gsc-sync] range=${range.startDate}..${range.endDate}`);

  const token = await getGoogleAccessToken();
  console.log(`[weekly-gsc-sync] obtained Google access token`);

  // Totals (no dimensions → single summary row)
  const totalsResp = await gscQuery(token, siteUrl, {
    ...range,
    dimensions: [],
    rowLimit: 1,
  });
  const totals = totalsResp.rows?.[0] ?? {
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
  };

  // Top 20 queries by clicks
  const queriesResp = await gscQuery(token, siteUrl, {
    ...range,
    dimensions: ["query"],
    rowLimit: 20,
    orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
  });
  const topQueries = (queriesResp.rows ?? []).map((r) => ({
    q: r.keys?.[0] ?? "",
    clicks: Math.round(r.clicks),
    ctr: parseFloat((r.ctr * 100).toFixed(2)),
  }));

  // Top 20 pages by clicks
  const pagesResp = await gscQuery(token, siteUrl, {
    ...range,
    dimensions: ["page"],
    rowLimit: 20,
    orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
  });
  const topPages = (pagesResp.rows ?? []).map((r) => ({
    p: r.keys?.[0] ?? "",
    clicks: Math.round(r.clicks),
    ctr: parseFloat((r.ctr * 100).toFixed(2)),
  }));

  console.log(
    `[weekly-gsc-sync] clicks=${totals.clicks} impressions=${totals.impressions} ` +
      `topQueries=${topQueries.length} topPages=${topPages.length}`,
  );

  await notionCreatePage(notionApiKey, notionDbId, {
    Title: { title: [{ text: { content: `Week of ${range.endDate}` } }] },
    WeekStart: { date: { start: range.startDate } },
    WeekEnd: { date: { start: range.endDate } },
    Clicks: { number: Math.round(totals.clicks) },
    Impressions: { number: Math.round(totals.impressions) },
    CTR: { number: parseFloat((totals.ctr).toFixed(4)) },
    AvgPosition: { number: parseFloat(totals.position.toFixed(2)) },
    TopQueries: rt(JSON.stringify(topQueries)),
    TopPages: rt(JSON.stringify(topPages)),
    GeneratedAt: { date: { start: new Date().toISOString() } },
  });

  console.log(`[weekly-gsc-sync] Notion page created in db ${notionDbId}`);
}

main().catch((err) => {
  console.error("[weekly-gsc-sync] FAILED:", err);
  process.exit(1);
});
