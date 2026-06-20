/**
 * ETL: Stripe transactions → RFM + churn scores (Parquet)
 *
 * Replaces the external ML pipeline that produced ml-parquet/scores_*.parquet
 * (files were 5+ days stale as of 2026-06-20 audit, producer not in this repo).
 * Internal compute is deterministic and cheap:
 *   - Recency: days since last paid transaction
 *   - Frequency: count of paid transactions in last 365 days
 *   - Monetary: sum of paid amount_cents in last 365 days (converted to major units)
 *   - Composite RFM score: weighted quintile mapping → 0-100
 *
 * Churn risk (simple heuristic, no labels needed):
 *   - 0 days since last purchase     → 0.0
 *   - 1-30 days                       → 0.1
 *   - 31-60 days                      → 0.3
 *   - 61-90 days                      → 0.6
 *   - 90+ days                        → 1.0
 *
 * Reads:  s3://BUCKET/lake/transactions/transactions.parquet (Stripe ETL output)
 * Writes: s3://BUCKET/ml-parquet/scores_rfm.parquet
 *         s3://BUCKET/ml-parquet/scores_churn.parquet
 *
 * Daily refresh. Sub-second runtime. The downstream consumer is
 * scripts/etl/clients-to-lake.mjs which joins these scores into the
 * clients table.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { ParquetWriter, ParquetReader, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.ANALYTICS_BUCKET || "cloudless-analytics-data";
const s3 = new S3Client({ region: REGION });

const rfmSchema = new ParquetSchema({
  email: { type: "UTF8" },
  recency_days: { type: "INT32" },
  frequency: { type: "INT32" },
  monetary: { type: "DOUBLE" },
  rfm_score: { type: "DOUBLE" },
  last_purchase_at: { type: "UTF8" },
});

const churnSchema = new ParquetSchema({
  email: { type: "UTF8" },
  recency_days: { type: "INT32" },
  churn_score: { type: "DOUBLE" },
  risk_band: { type: "UTF8" }, // "low" | "medium" | "high" | "at_risk"
});

// ---------------------------------------------------------------------------
// Read transactions parquet from S3
// ---------------------------------------------------------------------------

async function loadTransactions() {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: "lake/transactions/transactions.parquet" })
  );
  const buf = Buffer.from(await res.Body.transformToByteArray());
  const dir = mkdtempSync(join(tmpdir(), "rfm-"));
  const tmp = join(dir, "data.parquet");
  writeFileSync(tmp, buf);
  const reader = await ParquetReader.openFile(tmp);
  const cursor = reader.getCursor();
  const rows = [];
  let row;
  while ((row = await cursor.next())) rows.push(row);
  await reader.close();
  rmSync(dir, { recursive: true, force: true });
  return rows;
}

// ---------------------------------------------------------------------------
// RFM math
// ---------------------------------------------------------------------------

function quintile(values, v) {
  // Inverse rank: higher v → higher quintile (5 = top 20%)
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = sorted.findIndex((x) => x >= v);
  const pct = idx < 0 ? 1 : idx / sorted.length;
  return Math.min(5, Math.floor(pct * 5) + 1);
}

function recencyQuintile(values, v) {
  // Reverse for recency: lower days = better, so flip
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = sorted.findIndex((x) => x >= v);
  const pct = idx < 0 ? 1 : idx / sorted.length;
  // recency: smaller is better, so high pct (high days) = low quintile
  return 6 - Math.min(5, Math.floor(pct * 5) + 1);
}

function aggregate(transactions) {
  // Group by email, only count paid status
  const now = Date.now();
  const oneYearAgo = now - 365 * 86400_000;
  const byEmail = new Map();
  for (const t of transactions) {
    if (t.status !== "paid") continue;
    const email = (t.email || "").toString().toLowerCase().trim();
    if (!email) continue;
    const paidAt = t.paid_at || t.created_at;
    if (!paidAt) continue;
    const ts = Date.parse(paidAt);
    if (!Number.isFinite(ts)) continue;
    const amount = Number(t.amount_cents || 0) / 100;
    if (!byEmail.has(email)) byEmail.set(email, { lastTs: 0, freq365: 0, mon365: 0 });
    const cur = byEmail.get(email);
    if (ts > cur.lastTs) cur.lastTs = ts;
    if (ts >= oneYearAgo) {
      cur.freq365 += 1;
      cur.mon365 += amount;
    }
  }
  return byEmail;
}

function bandFromChurnScore(s) {
  if (s >= 0.9) return "at_risk";
  if (s >= 0.5) return "high";
  if (s >= 0.2) return "medium";
  return "low";
}

function churnFromRecency(daysSinceLastPurchase) {
  if (daysSinceLastPurchase <= 0) return 0;
  if (daysSinceLastPurchase <= 30) return 0.1;
  if (daysSinceLastPurchase <= 60) return 0.3;
  if (daysSinceLastPurchase <= 90) return 0.6;
  return 1.0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Loading transactions from lake...");
  const transactions = await loadTransactions();
  console.log(`  ${transactions.length} transactions`);

  const aggMap = aggregate(transactions);
  console.log(`  ${aggMap.size} unique paying customers`);

  if (aggMap.size === 0) {
    console.log("No paying customers yet — writing empty score files for downstream consistency.");
  }

  const now = Date.now();
  const allRecency = [];
  const allFreq = [];
  const allMon = [];
  const records = [];

  for (const [email, agg] of aggMap) {
    const recencyDays = Math.floor((now - agg.lastTs) / 86400_000);
    allRecency.push(recencyDays);
    allFreq.push(agg.freq365);
    allMon.push(agg.mon365);
    records.push({ email, recencyDays, freq: agg.freq365, mon: agg.mon365, lastTs: agg.lastTs });
  }

  // Compute composite RFM score per customer (0-100):
  // weighted 30% R, 30% F, 40% M; each quintile maps to 20 points.
  const rfmWriter = await ParquetWriter.openFile(rfmSchema, "/tmp/scores_rfm.parquet");
  const churnWriter = await ParquetWriter.openFile(churnSchema, "/tmp/scores_churn.parquet");
  for (const rec of records) {
    const rQ = recencyQuintile(allRecency, rec.recencyDays);
    const fQ = quintile(allFreq, rec.freq);
    const mQ = quintile(allMon, rec.mon);
    const rfm = Math.round((rQ * 0.3 + fQ * 0.3 + mQ * 0.4) * 20);
    const churn = churnFromRecency(rec.recencyDays);
    await rfmWriter.appendRow({
      email: rec.email,
      recency_days: rec.recencyDays,
      frequency: rec.freq,
      monetary: rec.mon,
      rfm_score: rfm,
      last_purchase_at: new Date(rec.lastTs).toISOString(),
    });
    await churnWriter.appendRow({
      email: rec.email,
      recency_days: rec.recencyDays,
      churn_score: churn,
      risk_band: bandFromChurnScore(churn),
    });
  }
  await rfmWriter.close();
  await churnWriter.close();

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: "ml-parquet/scores_rfm.parquet",
      Body: readFileSync("/tmp/scores_rfm.parquet"),
      ContentType: "application/octet-stream",
    })
  );
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: "ml-parquet/scores_churn.parquet",
      Body: readFileSync("/tmp/scores_churn.parquet"),
      ContentType: "application/octet-stream",
    })
  );
  unlinkSync("/tmp/scores_rfm.parquet");
  unlinkSync("/tmp/scores_churn.parquet");

  console.log(`✅ Wrote scores for ${records.length} customers → s3://${BUCKET}/ml-parquet/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
