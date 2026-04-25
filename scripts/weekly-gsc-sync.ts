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
 * Notion DB schema (matches NOTION_GSC_REPORTS_DB_ID as of 2026-04):
 *   Week              Title       "Week of YYYY-MM-DD"
 *   Date              Date        End date of 28-day window
 *   Clicks            Number
 *   Impressions       Number
 *   CTR %             Number      Whole percent (e.g. 3.5 for 3.5%)
 *   Avg Position      Number
 *   Keywords          Number      Count of organic keywords with impressions
 *   Top Keywords      Rich text   JSON-stringified [{q, clicks, ctr}]
 *   Top Products      Rich text   (left empty — populated by separate ecommerce sync)
 *   Top Country       Rich text   ISO country with most clicks
 *   Mobile %          Number      Share of clicks from mobile devices
 *   CTR Opportunities Number      Count of queries with impressions>=20 and ctr<2%
 *   Product Clicks    Number      (left 0 — populated by separate ecommerce sync)
 *   Report JSON       Rich text   Full raw payload (truncated to 2000 chars)
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

  // Top 20 queries by clicks (also drives Keywords count + CTR opportunities)
  const queriesResp = await gscQuery(token, siteUrl, {
    ...range,
    dimensions: ["query"],
    rowLimit: 1000,
    orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
  });
  const allQueries = queriesResp.rows ?? [];
  const topQueries = allQueries.slice(0, 20).map((r) => ({
    q: r.keys?.[0] ?? "",
    clicks: Math.round(r.clicks),
    ctr: parseFloat((r.ctr * 100).toFixed(2)),
  }));

  // CTR Opportunities — queries with decent impressions but poor CTR.
  const ctrOpportunities = allQueries.filter(
    (r) => r.impressions >= 20 && r.ctr < 0.02,
  ).length;

  // Country breakdown — find the country with most clicks.
  const countryResp = await gscQuery(token, siteUrl, {
    ...range,
    dimensions: ["country"],
    rowLimit: 5,
    orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
  });
  const topCountry = countryResp.rows?.[0]?.keys?.[0]?.toUpperCase() ?? "";

  // Device breakdown — share of mobile clicks.
  const deviceResp = await gscQuery(token, siteUrl, {
    ...range,
    dimensions: ["device"],
    rowLimit: 5,
  });
  const totalDeviceClicks = (deviceResp.rows ?? []).reduce(
    (sum, r) => sum + r.clicks,
    0,
  );
  const mobileClicks =
    deviceResp.rows?.find((r) => r.keys?.[0] === "MOBILE")?.clicks ?? 0;
  const mobilePct =
    totalDeviceClicks > 0
      ? parseFloat(((mobileClicks / totalDeviceClicks) * 100).toFixed(1))
      : 0;

  console.log(
    `[weekly-gsc-sync] clicks=${totals.clicks} impressions=${totals.impressions} ` +
      `topQueries=${topQueries.length} keywords=${allQueries.length} ` +
      `ctrOpps=${ctrOpportunities} country=${topCountry} mobile=${mobilePct}%`,
  );

  const reportJson = JSON.stringify({
    range,
    totals: {
      clicks: Math.round(totals.clicks),
      impressions: Math.round(totals.impressions),
      ctrPct: parseFloat((totals.ctr * 100).toFixed(2)),
      avgPosition: parseFloat(totals.position.toFixed(2)),
    },
    topQueries,
    topCountry,
    mobilePct,
  });

  await notionCreatePage(notionApiKey, notionDbId, {
    Week: { title: [{ text: { content: `Week of ${range.endDate}` } }] },
    Date: { date: { start: range.endDate } },
    Clicks: { number: Math.round(totals.clicks) },
    Impressions: { number: Math.round(totals.impressions) },
    "CTR %": { number: parseFloat((totals.ctr * 100).toFixed(2)) },
    "Avg Position": { number: parseFloat(totals.position.toFixed(2)) },
    Keywords: { number: allQueries.length },
    "Top Keywords": rt(JSON.stringify(topQueries)),
    "Top Country": rt(topCountry),
    "Mobile %": { number: mobilePct },
    "CTR Opportunities": { number: ctrOpportunities },
    "Report JSON": rt(reportJson),
  });

  console.log(`[weekly-gsc-sync] Notion page created in db ${notionDbId}`);
}

main().catch((err) => {
  console.error("[weekly-gsc-sync] FAILED:", err);
  process.exit(1);
});
