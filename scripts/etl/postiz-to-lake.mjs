/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEPRECATED — use `postiz-to-r2.mjs` instead.
 *
 * This legacy version uses AWS S3 for storage.
 * The migrated version (`postiz-to-r2.mjs`) reads config from D1 via
 * the /api/config endpoint and writes to R2-compatible storage.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ETL: Postiz → S3 Data Lake (Parquet)
 *
 * Pulls scheduled / published posts + connected integrations from the
 * self-hosted Postiz via its public API. Two parquet files:
 *
 *   lake/postiz-posts/posts.parquet
 *   lake/postiz-integrations/integrations.parquet
 *
 * Auth: Authorization header with raw API key (Postiz uses non-standard
 * scheme — no "Bearer " prefix). Key from Postiz Settings → Public API.
 *
 * Runs daily via .github/workflows/etl-selfhosted-to-lake.yml. Posts are
 * fetched for a configurable rolling window (default 90d) to bound size;
 * integrations are a small snapshot.
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.ANALYTICS_BUCKET || "cloudless-analytics-data";
const BASE = (process.env.POSTIZ_API_URL || "").replace(/\/$/, "");
const KEY = process.env.POSTIZ_API_KEY;
const DAYS = Math.max(1, Math.min(Number(process.env.POSTIZ_DAYS) || 90, 365));

if (!BASE || !KEY) {
  console.error("POSTIZ_API_URL and POSTIZ_API_KEY are required");
  process.exit(1);
}

const s3 = new S3Client({ region: REGION });

async function postizFetch(path) {
  const res = await fetch(`${BASE}/api/public/v1${path}`, {
    headers: { Authorization: KEY, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Postiz ${path} returned ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

const postSchema = new ParquetSchema({
  post_id: { type: "UTF8" },
  integration_id: { type: "UTF8", optional: true },
  integration_name: { type: "UTF8", optional: true },
  platform: { type: "UTF8", optional: true },
  state: { type: "UTF8", optional: true },
  release_url: { type: "UTF8", optional: true },
  publish_date: { type: "UTF8", optional: true },
  released_at: { type: "UTF8", optional: true },
  content_length: { type: "INT32", optional: true },
  created_at: { type: "UTF8", optional: true },
});

const integrationSchema = new ParquetSchema({
  integration_id: { type: "UTF8" },
  name: { type: "UTF8", optional: true },
  platform: { type: "UTF8", optional: true },
  disabled: { type: "BOOLEAN", optional: true },
  refresh_needed: { type: "BOOLEAN", optional: true },
  created_at: { type: "UTF8", optional: true },
});

async function writeParquet(rows, schema, localPath) {
  const writer = await ParquetWriter.openFile(schema, localPath);
  for (const row of rows) await writer.appendRow(row);
  await writer.close();
  return readFileSync(localPath);
}

async function uploadToS3(key, body) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/octet-stream",
    })
  );
  console.log(`✓ uploaded s3://${BUCKET}/${key} (${body.length} bytes)`);
}

async function syncPosts() {
  // Postiz public API: GET /api/public/v1/posts?display=month&day=YYYY-MM-DD
  // returns posts for that calendar month. Sweep DAYS/30 months back.
  const today = new Date();
  const months = Math.ceil(DAYS / 30);
  const accum = [];
  const seen = new Set();
  for (let i = 0; i < months; i++) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    const day = d.toISOString().slice(0, 10);
    const data = await postizFetch(`/posts?display=month&day=${day}`).catch((e) => {
      console.warn(`month ${day} failed:`, e.message);
      return { posts: [] };
    });
    const posts = data.posts || data.data || [];
    for (const p of posts) {
      const id = String(p.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      accum.push(p);
    }
  }
  const rows = accum.map((p) => ({
    post_id: String(p.id ?? ""),
    integration_id: String(p.integration?.id ?? p.integrationId ?? ""),
    integration_name: String(p.integration?.name ?? ""),
    platform: String(p.integration?.providerIdentifier ?? p.providerIdentifier ?? ""),
    state: String(p.state ?? ""),
    release_url: String(p.releaseURL ?? ""),
    publish_date: String(p.publishDate ?? ""),
    released_at: String(p.releasedAt ?? ""),
    content_length: typeof p.content === "string" ? p.content.length : 0,
    created_at: String(p.createdAt ?? ""),
  }));
  const local = "/tmp/postiz-posts.parquet";
  const body = await writeParquet(rows, postSchema, local);
  await uploadToS3("lake/postiz-posts/posts.parquet", body);
  unlinkSync(local);
  console.log(`posts: ${rows.length} across ${months} months`);
}

async function syncIntegrations() {
  const data = await postizFetch("/integrations").catch((e) => {
    console.warn("/integrations failed:", e.message);
    return { data: [] };
  });
  const list = Array.isArray(data) ? data : data.data || [];
  const rows = list.map((i) => ({
    integration_id: String(i.id ?? ""),
    name: String(i.name ?? ""),
    platform: String(i.providerIdentifier ?? ""),
    disabled: Boolean(i.disabled),
    refresh_needed: Boolean(i.refreshNeeded),
    created_at: String(i.createdAt ?? ""),
  }));
  const local = "/tmp/postiz-integrations.parquet";
  const body = await writeParquet(rows, integrationSchema, local);
  await uploadToS3("lake/postiz-integrations/integrations.parquet", body);
  unlinkSync(local);
  console.log(`integrations: ${rows.length}`);
}

await syncPosts();
await syncIntegrations();
console.log("✓ Postiz → S3 sync complete");
