/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEPRECATED — use `portals-to-r2.mjs` instead.
 *
 * This legacy version uses AWS SSM for config and S3 for storage.
 * The migrated version (`portals-to-r2.mjs`) reads config from D1 via
 * the /api/config endpoint and writes to R2-compatible storage.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ETL: Client Portals (SSM) → S3 Data Lake (Parquet)
 *
 * Reads /cloudless/CLIENT_PORTALS_JSON from SSM, computes per-portal
 * metrics, writes to s3://BUCKET/lake/portals/portals.parquet.
 * Full refresh daily.
 */

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.ANALYTICS_BUCKET || "cloudless-analytics-data";
const ssm = new SSMClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const TMP = "/tmp/portals.parquet";

const schema = new ParquetSchema({
  token: { type: "UTF8" },
  client_email: { type: "UTF8" },
  client_name: { type: "UTF8", optional: true },
  label: { type: "UTF8" },
  created_at: { type: "UTF8" },
  expires_at: { type: "UTF8", optional: true },
  workspace_id: { type: "UTF8", optional: true },
  total_steps: { type: "INT32" },
  completed_steps: { type: "INT32" },
  blocked_steps: { type: "INT32" },
  total_deliverables: { type: "INT32" },
  approved_deliverables: { type: "INT32" },
  open_payments: { type: "INT32" },
  paid_payments: { type: "INT32" },
  total_revenue_cents: { type: "INT64" },
  last_comment_at: { type: "UTF8", optional: true },
  health_score: { type: "INT32" },
});

async function loadPortals() {
  try {
    const res = await ssm.send(new GetParameterCommand({ Name: "/cloudless/CLIENT_PORTALS_JSON" }));
    return JSON.parse(res.Parameter?.Value || "[]");
  } catch (err) {
    // Log but degrade gracefully — fresh env may not have any portals
    // configured yet. Previous silent catch masked AccessDenied vs
    // ParameterNotFound vs JSON parse equally.
    console.warn(
      "[etl/portals] SSM /cloudless/CLIENT_PORTALS_JSON unavailable:",
      err?.name || err?.message || "unknown"
    );
    return [];
  }
}

function computeHealth(portal) {
  let score = 100;
  const blocked = (portal.steps || []).filter(s => s.status === "blocked").length;
  score -= Math.min(blocked * 25, 50);
  const changesRequested = (portal.deliverables || []).filter(d => d.status === "changes_requested").length;
  score -= changesRequested * 10;
  const openOld = (portal.paymentLinks || []).filter(l => {
    if (l.status !== "open") return false;
    const age = Date.now() - Date.parse(l.createdAt);
    return age > 14 * 86400000;
  }).length;
  score -= openOld * 20;
  return Math.max(0, score);
}

function lastCommentAt(portal) {
  let latest = null;
  for (const step of portal.steps || []) {
    for (const c of step.comments || []) {
      if (!latest || c.createdAt > latest) latest = c.createdAt;
    }
  }
  return latest;
}

async function main() {
  const portals = await loadPortals();
  console.log(`Loaded ${portals.length} portals from SSM`);

  const writer = await ParquetWriter.openFile(schema, TMP);
  for (const p of portals) {
    const steps = p.steps || [];
    const deliverables = p.deliverables || [];
    const payments = p.paymentLinks || [];
    await writer.appendRow({
      token: p.token,
      client_email: p.clientEmail,
      client_name: p.clientName || null,
      label: p.label,
      created_at: p.createdAt,
      expires_at: p.expiresAt || null,
      workspace_id: p.workspaceId || null,
      total_steps: steps.length,
      completed_steps: steps.filter(s => s.status === "completed").length,
      blocked_steps: steps.filter(s => s.status === "blocked").length,
      total_deliverables: deliverables.length,
      approved_deliverables: deliverables.filter(d => d.status === "approved").length,
      open_payments: payments.filter(l => l.status === "open").length,
      paid_payments: payments.filter(l => l.status === "paid").length,
      total_revenue_cents: BigInt(payments.filter(l => l.status === "paid").reduce((s, l) => s + (l.amountCents || 0), 0)),
      last_comment_at: lastCommentAt(p),
      health_score: computeHealth(p),
    });
  }
  await writer.close();

  const body = readFileSync(TMP);
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: "lake/portals/portals.parquet", Body: body }));
  unlinkSync(TMP);
  console.log(`✅ Uploaded ${portals.length} portals → s3://${BUCKET}/lake/portals/portals.parquet`);
  console.log("⚠️  DEPRECATED: Use portals-to-r2.mjs instead (D1 config + R2 storage)");
}

main().catch(e => { console.error(e); process.exit(1); });
