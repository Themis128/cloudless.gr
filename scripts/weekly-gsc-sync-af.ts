/**
 * Weekly GSC → AppFlowy Sync
 *
 * Pulls a 28-day Google Search Console summary plus top-20 queries / pages
 * for the configured site, then writes one new page into AppFlowy for reporting.
 *
 * Designed to run from .github/workflows/cron-free-tier.yml on the standard
 * daily cron. Self-contained: reads everything from process.env so
 * it does not depend on src/lib/* (which require SSM + the @/ alias).
 *
 * Required env:
 *   GSC_SITE_URL                 e.g. "sc-domain:cloudless.gr"
 *   GOOGLE_CLIENT_EMAIL          service-account email with GSC access
 *   GOOGLE_PRIVATE_KEY           PEM (PKCS#8 or PKCS#1) or SA JSON; escaped \\n OK
 *   APPFLOWY_API_URL             AppFlowy base URL (e.g. https://appflowy.cloudless.gr)
 *   APPFLOWY_EMAIL               AppFlowy login email
 *   APPFLOWY_PASSWORD            AppFlowy login password
 *   APPFLOWY_GSC_REPORTS_FOLDER  parent view id (optional, uses first space as default)
 */

import { SignJWT } from "jose";
import { loadGooglePrivateKey } from "./lib/google-sa-key";

const GSC_API = "https://searchconsole.googleapis.com/webmasters/v3/sites";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[weekly-gsc-sync-af] missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

export function dateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 28);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

async function getGoogleAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || "";
  if (!email) {
    console.error("[weekly-gsc-sync-af] missing env var: GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_CLIENT_EMAIL");
    process.exit(1);
  }
  const privateKey = loadGooglePrivateKey(requireEnv("GOOGLE_PRIVATE_KEY"));
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

export async function gscQuery(
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

// --- AppFlowy helpers ----------------------------------------------------------

async function appflowyLogin(): Promise<{ token: string; workspaceId: string; base: string }> {
  const base = requireEnv("APPFLOWY_API_URL").replace(/\/$/, "");
  const email = requireEnv("APPFLOWY_EMAIL");
  const password = requireEnv("APPFLOWY_PASSWORD");
  const res = await fetch(`${base}/gotrue/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`AppFlowy login failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  const token = data.access_token;
  const wsRes = await fetch(`${base}/api/workspace`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!wsRes.ok) throw new Error(`AppFlowy workspace fetch failed: ${wsRes.status}`);
  const wsData = (await wsRes.json()) as { data: Array<{ workspace_id: string }> };
  const workspaceId = wsData.data[0]?.workspace_id ?? "";
  if (!workspaceId) throw new Error("No AppFlowy workspace found");
  return { token, workspaceId, base };
}

/** Returns the first space's view_id, or null if workspace hasn't been initialized */
async function findFirstSpace(token: string, workspaceId: string): Promise<string | null> {
  const base = process.env.APPFLOWY_API_URL!.replace(/\/$/, "");
  const res = await fetch(`${base}/api/workspace/${workspaceId}/folder?depth=2`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { code?: number; data?: { children?: Array<{ view_id?: string; space_permission?: unknown }> } };
  if (body.code != null && body.code !== 0) return null; // uninitialized workspace
  const children = body.data?.children ?? [];
  const space =
    children.find((c) => c.space_permission != null) ||
    children[0];
  return space ? (space.view_id ?? null) : null;
}

function formatRichText(text: string): Array<Record<string, unknown>> {
  return [{ insert: text }];
}

function headingBlock(level: number, text: string): Record<string, unknown> {
  return { type: "heading", data: { level, delta: formatRichText(text) } };
}

function paragraphBlock(text: string): Record<string, unknown> {
  return { type: "paragraph", data: { delta: formatRichText(text) } };
}

async function createReportPage(
  token: string,
  workspaceId: string,
  parentViewId: string,
  blocks: Array<Record<string, unknown>>,
  title: string,
): Promise<{ url: string }> {
  const base = process.env.APPFLOWY_API_URL!.replace(/\/$/, "");
  const viewId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

  const payload = {
    parent_view_id: parentViewId,
    layout: 0, // document
    name: title,
    page_data: {
      type: "page",
      children: blocks,
    },
    view_id: viewId,
    collab_id: viewId,
  };

  const res = await fetch(`${base}/api/workspace/${workspaceId}/page-view`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`AppFlowy create page failed: ${res.status} ${await res.text()}`);
  }
  return { url: `${base}/app/${workspaceId}/${viewId}` };
}

// --- Main ----------------------------------------------------------------------

async function main(): Promise<void> {
  const siteUrl = requireEnv("GSC_SITE_URL");

  console.log(`[weekly-gsc-sync-af] site=${siteUrl}`);

  const range = dateRange();
  console.log(`[weekly-gsc-sync-af] range=${range.startDate}..${range.endDate}`);

  const token = await getGoogleAccessToken();
  console.log(`[weekly-gsc-sync-af] obtained Google access token`);

  // Totals
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
    rowLimit: 1000,
    orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
  });
  const allQueries = queriesResp.rows ?? [];
  const topQueries = allQueries.slice(0, 20).map((r) => ({
    q: r.keys?.[0] ?? "",
    clicks: Math.round(r.clicks),
    ctr: parseFloat((r.ctr * 100).toFixed(2)),
  }));

  // CTR Opportunities
  const ctrOpportunities = allQueries.filter(
    (r) => r.impressions >= 20 && r.ctr < 0.02,
  ).length;

  // Country breakdown
  const countryResp = await gscQuery(token, siteUrl, {
    ...range,
    dimensions: ["country"],
    rowLimit: 5,
    orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
  });
  const topCountry = countryResp.rows?.[0]?.keys?.[0]?.toUpperCase() ?? "";

  // Device breakdown
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
    `[weekly-gsc-sync-af] clicks=${totals.clicks} impressions=${totals.impressions} ` +
      `keywords=${allQueries.length} ctrOpps=${ctrOpportunities} country=${topCountry} mobile=${mobilePct}%`,
  );

  // Login to AppFlowy and create report
  const { token: afToken, workspaceId, base } = await appflowyLogin();
  console.log(`[weekly-gsc-sync-af] logged into AppFlowy`);

  // Get parent folder/view
  let parentViewId = process.env.APPFLOWY_GSC_REPORTS_FOLDER;
  if (!parentViewId) {
    parentViewId = await findFirstSpace(afToken, workspaceId) ?? workspaceId;
    console.log(`[weekly-gsc-sync-af] using parent: ${parentViewId}`);
  }

  // Build report blocks
  const reportTitle = `GSC Report: ${range.endDate}`;
  const blocks: Array<Record<string, unknown>> = [
    headingBlock(1, reportTitle),
    paragraphBlock(`Period: ${range.startDate} to ${range.endDate}`),
    headingBlock(2, "Overview"),
    paragraphBlock(`Clicks: ${Math.round(totals.clicks)}`),
    paragraphBlock(`Impressions: ${Math.round(totals.impressions)}`),
    paragraphBlock(`CTR: ${(totals.ctr * 100).toFixed(2)}%`),
    paragraphBlock(`Avg Position: ${totals.position.toFixed(2)}`),
    headingBlock(2, "Top Countries"),
    paragraphBlock(topCountry ? `1. ${topCountry}` : "(no data)"),
    headingBlock(2, "Mobile Traffic"),
    paragraphBlock(`Mobile: ${mobilePct}%`),
    headingBlock(2, "CTR Opportunities"),
    paragraphBlock(`${ctrOpportunities} queries with impressions>=20 and ctr<2%`),
    headingBlock(2, "Top 5 Keywords"),
  ];

  for (const tq of topQueries.slice(0, 5)) {
    blocks.push(paragraphBlock(`${tq.q}: ${tq.clicks} clicks, ${tq.ctr}% CTR`));
  }

  const { url } = await createReportPage(
    afToken,
    workspaceId,
    parentViewId,
    blocks,
    reportTitle,
  );
  console.log(`[weekly-gsc-sync-af] report created: ${url}`);
}

// Only auto-run when invoked directly
if (process.argv[1]?.includes("weekly-gsc-sync-af")) {
  main().catch((err) => {
    console.error("[weekly-gsc-sync-af] FAILED:", err);
    process.exit(1);
  });
}