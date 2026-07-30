/**
 * ETL: Client Portals (SSM) → R2 Data Lake (Parquet)
 *
 * Migrated version using R2 S3-compatible endpoint.
 * Same logic as portals-to-lake.mjs - only client configuration differs.
 */

import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";
import { BUCKET, r2Put } from "./_r2-config.mjs";

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

async function loadConfigFromD1(key) {
  // Map SSM keys to D1 config keys
  const keyMap = {
    "/cloudless/CLIENT_PORTALS_JSON": "client_portals",
  };

  const configKey = keyMap[key] || key.replace("/cloudless/", "");

  try {
    const res = await fetch(`${process.env.AUTH_DB_URL || "http://localhost:8787/api/config"}?key=${encodeURIComponent(configKey)}`);
    if (!res.ok) {
      // Fallback to env var if D1 endpoint fails (for CI/testing)
      const envData = process.env[configKey.toUpperCase().replace(/-/g, "_")];
      if (envData) return JSON.parse(envData);
      return [];
    }
    const json = await res.json();
    return json.value ? JSON.parse(json.value) : [];
  } catch (err) {
    console.warn(`[etl/portals] D1 config ${key} unavailable:`, err?.name || err?.message || "unknown");
    return [];
  }
}

async function loadPortals() {
  try {
    return await loadConfigFromD1("/cloudless/CLIENT_PORTALS_JSON");
  } catch (err) {
    // Log but degrade gracefully — fresh env may not have any portals
    // configured yet.
    console.warn("[etl/portals] D1 config /cloudless/CLIENT_PORTALS_JSON unavailable:", err?.name || err?.message || "unknown");
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
  console.log(`Loaded ${portals.length} portals from D1`);

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
  await r2Put("lake/portals/portals.parquet", body);
  unlinkSync(TMP);
  console.log(`✅ Uploaded ${portals.length} portals → R2://${BUCKET}/lake/portals/portals.parquet`);
}

main().catch(e => { console.error(e); process.exit(1); });