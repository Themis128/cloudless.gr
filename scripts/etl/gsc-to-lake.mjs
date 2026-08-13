/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEPRECATED — use `gsc-to-r2.mjs` instead.
 *
 * This legacy version uses AWS S3 for storage.
 * The migrated version (`gsc-to-r2.mjs`) reads config from D1 via
 * the /api/config endpoint and writes to R2-compatible storage.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ETL: Google Search Console → S3 Data Lake (Parquet)
 *
 * Pulls last-90-day search analytics from GSC, dimensioned by query + page,
 * writes lake/gsc-keywords/keywords.parquet. Drives the SEO performance
 * section of the admin /analytics dashboard.
 *
 * Auth: GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (service account JWT) +
 *       GSC_SITE_URL (defaults to https://cloudless.gr/).
 * Daily refresh — overwrites the file.
 */

import { BUCKET, r2Put } from "./_r2-config.mjs";

import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";
import { readFileSync, unlinkSync } from "fs";

const REGION = process.env.AWS_REGION || "us-east-1";
const SITE = process.env.GSC_SITE_URL || "https://cloudless.gr/";
const EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
let KEY = process.env.GOOGLE_PRIVATE_KEY?.trim() ?? "";
if (KEY.startsWith("{")) {
  try {
    KEY = JSON.parse(KEY).private_key ?? KEY;
  } catch {
    /* keep raw */
  }
}
if ((KEY.startsWith('"') && KEY.endsWith('"')) || (KEY.startsWith("'") && KEY.endsWith("'"))) {
  KEY = KEY.slice(1, -1);
}
KEY = KEY.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

if (!EMAIL || !KEY) {
  console.error("GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY not set");
  process.exit(1);
}


const schema = new ParquetSchema({
  query: { type: "UTF8" },
  page: { type: "UTF8" },
  clicks: { type: "INT32" },
  impressions: { type: "INT32" },
  ctr: { type: "DOUBLE" },
  position: { type: "DOUBLE" },
  start_date: { type: "UTF8" },
  end_date: { type: "UTF8" },
});

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = createPrivateKey({ key: KEY, format: "pem" });
  const jwt = await new SignJWT({ iss: EMAIL, scope: SCOPE, aud: TOKEN_URL })
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
  if (!res.ok) throw new Error(`Google token exchange ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function main() {
  console.log(`Fetching GSC search analytics for ${SITE}...`);
  const token = await getAccessToken();

  const end = new Date();
  const start = new Date(end.getTime() - 90 * 86_400_000);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
  const body = {
    startDate: fmt(start),
    endDate: fmt(end),
    dimensions: ["query", "page"],
    rowLimit: 25_000,
    dataState: "all",
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`GSC ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const rows = (data.rows || []).map((r) => ({
    query: r.keys?.[0] ?? "(unknown)",
    page: r.keys?.[1] ?? "(unknown)",
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
    start_date: fmt(start),
    end_date: fmt(end),
  }));
  console.log(`  ${rows.length} keyword-page rows`);

  const tmp = "/tmp/gsc-keywords.parquet";
  const writer = await ParquetWriter.openFile(schema, tmp);
  for (const r of rows) await writer.appendRow(r);
  await writer.close();

  await r2Put("lake/gsc-keywords/keywords.parquet", readFileSync(tmp), { contentType: "application/octet-stream" });
  unlinkSync(tmp);
  console.log(`✅ Uploaded ${rows.length} rows → s3://${BUCKET}/lake/gsc-keywords/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
