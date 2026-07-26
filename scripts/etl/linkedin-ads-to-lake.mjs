/**
 * ETL: LinkedIn Ads → S3 Data Lake (Parquet)
 *
 * Pulls campaign-level insights for the last 90 days from the LinkedIn
 * Marketing Solutions REST API. Writes one row per (campaign × day),
 * lake/linkedin-ads/insights.parquet. Drives the paid-acquisition section
 * of the admin /analytics dashboard.
 *
 * Auth: LINKEDIN_ACCESS_TOKEN (GH secret), LINKEDIN_AD_ACCOUNT_ID env
 *       (default 512642510, the cloudless.gr account per CLAUDE.md).
 * Daily refresh — overwrites the file.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.ANALYTICS_BUCKET || "cloudless-analytics-data";
const ACCOUNT = process.env.LINKEDIN_AD_ACCOUNT_ID || "512642510";
const SSM_PREFIX = process.env.SSM_PREFIX || "/cloudless/production";

/**
 * Resolve the LinkedIn access token. SSM-first because that's where the
 * operator rotates it (when the LinkedIn 60-day token expires, the new
 * value lands in /cloudless/production/LINKEDIN_ACCESS_TOKEN). The GH
 * secret with the same name is the env-var fallback for local runs;
 * relying on it in CI caused a REVOKED_ACCESS_TOKEN failure on
 * 2026-06-20 because the GH secret was 9 days older than the SSM value.
 */
async function resolveToken() {
  if (process.env.LINKEDIN_ACCESS_TOKEN_FORCE_ENV === "1" && process.env.LINKEDIN_ACCESS_TOKEN) {
    return process.env.LINKEDIN_ACCESS_TOKEN;
  }
  try {
    const ssm = new SSMClient({ region: REGION });
    const res = await ssm.send(
      new GetParameterCommand({
        Name: `${SSM_PREFIX}/LINKEDIN_ACCESS_TOKEN`,
        WithDecryption: true,
      })
    );
    const v = res.Parameter?.Value;
    if (v) return v;
  } catch (err) {
    console.warn("[etl/linkedin] SSM lookup failed, falling back to env:", err?.name || err?.message);
  }
  return process.env.LINKEDIN_ACCESS_TOKEN;
}

const TOKEN = await resolveToken();
if (!TOKEN) {
  console.error("LINKEDIN_ACCESS_TOKEN not available (tried SSM + env)");
  process.exit(1);
}

const s3 = new S3Client({ region: REGION });
const LI_BASE = "https://api.linkedin.com/rest";
const LI_HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "LinkedIn-Version": "202509",
  "X-Restli-Protocol-Version": "2.0.0",
};

const schema = new ParquetSchema({
  campaign_id: { type: "UTF8" },
  campaign_name: { type: "UTF8", optional: true },
  day: { type: "UTF8" },
  impressions: { type: "INT64" },
  clicks: { type: "INT32" },
  ctr: { type: "DOUBLE" },
  spend: { type: "DOUBLE" },
  currency: { type: "UTF8" },
  conversions: { type: "INT32" },
  cost_per_click: { type: "DOUBLE" },
  cost_per_thousand_impressions: { type: "DOUBLE" },
  account_id: { type: "UTF8" },
});

async function liFetch(path) {
  const res = await fetch(`${LI_BASE}${path}`, { headers: LI_HEADERS });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`LinkedIn ${res.status} on ${path}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

async function listCampaigns() {
  // GET ad campaigns under the account.
  const path = `/adAccounts/${ACCOUNT}/adCampaigns?q=search&search=(status:(values:List(ACTIVE,PAUSED,COMPLETED)))`;
  const data = await liFetch(path);
  return (data.elements || []).map((c) => ({
    id: String(c.id),
    name: c.name || null,
  }));
}

async function dailyInsights(campaignId, start, end) {
  // Daily breakdown: pivot=NONE returns daily rows for the campaign.
  // dateRange uses YYYY-MM-DD parts via (start:(year,month,day),end:(...)) tuple syntax.
  const sp = `(year:${start.getUTCFullYear()},month:${start.getUTCMonth() + 1},day:${start.getUTCDate()})`;
  const ep = `(year:${end.getUTCFullYear()},month:${end.getUTCMonth() + 1},day:${end.getUTCDate()})`;
  const path = `/adAnalytics?q=analytics&pivot=CREATIVE&timeGranularity=DAILY&campaigns=List(urn%3Ali%3AsponsoredCampaign%3A${campaignId})&dateRange=(start:${sp},end:${ep})&fields=dateRange,impressions,clicks,costInLocalCurrency,externalWebsiteConversions`;
  try {
    const data = await liFetch(path);
    return data.elements || [];
  } catch (err) {
    console.warn(`  campaign ${campaignId} insights failed:`, err.message?.slice(0, 100));
    return [];
  }
}

function fmtDay(dr) {
  const s = dr?.start;
  if (!s) return "";
  return `${s.year}-${String(s.month).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`;
}

async function main() {
  console.log(`Fetching LinkedIn campaigns for account ${ACCOUNT}...`);
  const campaigns = await listCampaigns();
  console.log(`  ${campaigns.length} campaigns`);

  const end = new Date();
  const start = new Date(end.getTime() - 90 * 86_400_000);

  const rows = [];
  for (const c of campaigns) {
    const insights = await dailyInsights(c.id, start, end);
    for (const r of insights) {
      const day = fmtDay(r.dateRange);
      const spend = Number(r.costInLocalCurrency ?? 0);
      const impressions = BigInt(r.impressions || 0);
      const clicks = r.clicks || 0;
      rows.push({
        campaign_id: c.id,
        campaign_name: c.name,
        day,
        impressions,
        clicks,
        ctr: r.impressions > 0 ? clicks / Number(impressions) : 0,
        spend,
        currency: "EUR",
        conversions: r.externalWebsiteConversions || 0,
        cost_per_click: clicks > 0 ? spend / clicks : 0,
        cost_per_thousand_impressions: r.impressions > 0 ? (spend / Number(impressions)) * 1000 : 0,
        account_id: ACCOUNT,
      });
    }
  }
  console.log(`  ${rows.length} (campaign × day) rows`);

  const tmp = "/tmp/linkedin-ads.parquet";
  const writer = await ParquetWriter.openFile(schema, tmp);
  for (const r of rows) await writer.appendRow(r);
  await writer.close();

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: "lake/linkedin-ads/insights.parquet",
      Body: readFileSync(tmp),
      ContentType: "application/octet-stream",
    })
  );
  unlinkSync(tmp);
  console.log(`✅ Uploaded ${rows.length} rows → s3://${BUCKET}/lake/linkedin-ads/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
