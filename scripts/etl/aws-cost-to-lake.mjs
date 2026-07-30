/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEPRECATED — AWS Cost Explorer data collection.
 *
 * This script depends on AWS Cost Explorer API (an AWS-specific service).
 * Since the cloudless.gr infrastructure has migrated fully to Cloudflare,
 * this script is retained for historical reference only.
 *
 * No direct R2 replacement exists; Cloudflare does not provide cost APIs.
 * Consider removing this script and associated Grafana dashboard if AWS
 * cost monitoring is no longer required.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ETL: AWS Cost Explorer → S3 Data Lake (Parquet)
 *
 * R9 of the 2026-06-21 R-series. Pulls daily cost per AWS service for the last
 * 60 days via Cost Explorer's GetCostAndUsage API, normalizes into one row per
 * (date, service), writes lake/aws-cost/cost.parquet. Drives the cluster cost
 * dashboard (Athena view + Grafana panel; see
 * infrastructure/grafana/dashboards/aws-cost.json).
 *
 * Operator pre-requisites (one-time AWS console clicks):
 *
 *   1. Enable Cost Explorer (Billing console → Cost Explorer → Enable).
 *      Free. Takes ~24h before the API returns data.
 *   2. Grant the GH Actions OIDC deploy role (AWS_DEPLOY_ROLE_ARN) the action
 *      `ce:GetCostAndUsage`. Inline policy snippet:
 *        { "Effect": "Allow", "Action": "ce:GetCostAndUsage", "Resource": "*" }
 *      (Cost Explorer ignores resource ARNs — wildcard is the only valid form.)
 *
 * Without either step, the ETL exits with `AccessDenied` or `DataUnavailable`
 * — both surface in the workflow log AND fire `notifyAdmin()` via the existing
 * runner-fail Slack alert path. Won't fail closed silently.
 *
 * Runtime: ~3-5 s for 60d * N services. Idempotent — overwrites the file.
 */

import { BUCKET, r2Put } from "./_r2-config.mjs";

import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";

const REGION = process.env.AWS_REGION || "us-east-1";
const LOOKBACK_DAYS = Number.parseInt(process.env.AWS_COST_LOOKBACK_DAYS || "60", 10);

// Cost Explorer is a global service — but the SDK still requires *a* region.
// us-east-1 is the canonical home (and matches our existing AWS_REGION).
const ce = new CostExplorerClient({ region: "us-east-1" });

const schema = new ParquetSchema({
  /** ISO date — YYYY-MM-DD, partition-friendly. */
  cost_date: { type: "UTF8" },
  /** Cost Explorer's service dimension (e.g. "Amazon Elastic Compute Cloud - Compute"). */
  service: { type: "UTF8" },
  /** Unblended cost in USD. Doubles — sub-cent precision matters for low-cost services. */
  amount_usd: { type: "DOUBLE" },
  /** Currency, always USD for our account but kept explicit so a multi-currency
   *  setup later doesn't require a schema migration. */
  currency: { type: "UTF8" },
});

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function shapeResults(results) {
  // Cost Explorer returns { ResultsByTime: [{ TimePeriod: {Start, End}, Groups: [{Keys, Metrics}] }] }
  // We flatten into rows. Empty groups (zero spend) are skipped.
  const rows = [];
  for (const day of results) {
    const cost_date = day.TimePeriod?.Start;
    if (!cost_date) continue;
    const groups = day.Groups || [];
    for (const g of groups) {
      const service = g.Keys?.[0] || "unknown";
      const amountStr = g.Metrics?.UnblendedCost?.Amount || "0";
      const amount = Number.parseFloat(amountStr);
      if (!Number.isFinite(amount) || amount === 0) continue;
      rows.push({
        cost_date,
        service,
        amount_usd: amount,
        currency: g.Metrics?.UnblendedCost?.Unit || "USD",
      });
    }
  }
  return rows;
}

async function fetchDailyCost() {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);
  // CE TimePeriod is inclusive Start, exclusive End — so pass `today`'s date as
  // End to capture data through "yesterday" (today is partial / often delayed).
  const cmd = new GetCostAndUsageCommand({
    TimePeriod: { Start: isoDate(start), End: isoDate(end) },
    Granularity: "DAILY",
    Metrics: ["UnblendedCost"],
    GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
  });
  const out = await ce.send(cmd);
  return out.ResultsByTime || [];
}

async function main() {
  console.log(`Fetching ${LOOKBACK_DAYS}d of AWS Cost Explorer data...`);
  const results = await fetchDailyCost();
  const rows = shapeResults(results);
  console.log(`Shaped ${rows.length} (date, service) rows over ${results.length} days.`);

  if (rows.length === 0) {
    console.warn("No cost rows returned. Skipping upload to avoid clobbering existing file.");
    return;
  }

  const tmp = "/tmp/aws-cost.parquet";
  const writer = await ParquetWriter.openFile(schema, tmp);
  for (const r of rows) await writer.appendRow(r);
  await writer.close();

  await r2Put("lake/aws-cost/cost.parquet", readFileSync(tmp), { contentType: "application/octet-stream" });
  unlinkSync(tmp);
  console.log(`✅ Uploaded ${rows.length} rows → s3://${BUCKET}/lake/aws-cost/cost.parquet`);
}

// Run directly only — keep `shapeResults` importable for tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
