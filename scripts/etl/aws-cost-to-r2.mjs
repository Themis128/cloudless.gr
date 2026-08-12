/**
 * ETL: AWS Cost Explorer → Cloudflare R2 (+ optional D1 SQL dump)
 *
 * Source remains Cost Explorer (AWS-only billing API). Destination is
 * Cloudflare-first: R2 parquet + JSON for /admin/cost, with a generated
 * SQL file for `wrangler d1 execute` upserts into `aws_cost_daily`.
 *
 * Replaces scripts/etl/aws-cost-to-lake.mjs (S3 + Athena path).
 * Uses aws4fetch for signed requests (no @aws-sdk/client-cost-explorer).
 */

import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { BUCKET, r2Put, getR2Client } from "./_r2-config.mjs";
import { shapeResults } from "./aws-cost-to-lake.mjs";

const LOOKBACK_DAYS = Number.parseInt(process.env.AWS_COST_LOOKBACK_DAYS || "60", 10);

// Parquet schema for the cost lake — kept local so this live ETL does not
// depend on the deprecated `aws-cost-to-lake.mjs` for anything but the pure
// `shapeResults` transform.
const schema = new ParquetSchema({
  cost_date: { type: "UTF8" },
  service: { type: "UTF8" },
  amount_usd: { type: "DOUBLE" },
  currency: { type: "UTF8" },
});

// Cost Explorer endpoint (global service, us-east-1)
const CE_ENDPOINT = "https://ce.us-east-1.amazonaws.com/";

// Get credentials for aws4fetch signing
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || process.env.COST_EXPLORER_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || process.env.COST_EXPLORER_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

function isoDate(d) {
	return d.toISOString().slice(0, 10);
}

function sqlEscape(value) {
	return String(value).replaceAll("'", "''");
}

function buildD1Sql(rows, syncedAt) {
	const lines = ["DELETE FROM aws_cost_daily;"];
	const chunkSize = 80;
	for (let i = 0; i < rows.length; i += chunkSize) {
		const chunk = rows.slice(i, i + chunkSize);
		const values = chunk
			.map(
				(r) =>
					`('${sqlEscape(r.cost_date)}','${sqlEscape(r.service)}',${r.amount_usd},'${sqlEscape(r.currency)}',${syncedAt})`
			)
			.join(",\n  ");
		lines.push(
			`INSERT INTO aws_cost_daily (cost_date, service, amount_usd, currency, synced_at) VALUES\n  ${values};`
		);
	}
	return `${lines.join("\n")}\n`;
}

async function fetchDailyCost() {
	if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
		throw new Error("AWS credentials required for Cost Explorer API (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)");
	}

	const { AwsClient } = await import("aws4fetch");
	const client = new AwsClient({
		accessKeyId: ACCESS_KEY_ID,
		secretAccessKey: SECRET_ACCESS_KEY,
		service: "ce",
		region: AWS_REGION,
	});

	const end = new Date();
	const start = new Date();
	start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);

	const payload = {
		TimePeriod: { Start: isoDate(start), End: isoDate(end) },
		Granularity: "DAILY",
		Metrics: ["UnblendedCost"],
		GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
	};

	const res = await client.fetch(CE_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-amz-json-1.1",
			"X-Amz-Target": "AWSInsightsIndexService.GetCostAndUsage",
		},
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`Cost Explorer API ${res.status}: ${text.slice(0, 500)}`);
	}

	const data = await res.json();
	return data.ResultsByTime || [];
}

async function main() {
	console.log(`Fetching ${LOOKBACK_DAYS}d of AWS Cost Explorer data → R2://${BUCKET}...`);
	const results = await fetchDailyCost();
	const rows = shapeResults(results);
	console.log(`Shaped ${rows.length} (date, service) rows over ${results.length} days.`);

	if (rows.length === 0) {
		console.warn("No cost rows returned. Skipping upload to avoid clobbering existing file.");
		return;
	}

	const syncedAt = Date.now();
	const payload = {
		generated_at: new Date(syncedAt).toISOString(),
		lookback_days: LOOKBACK_DAYS,
		row_count: rows.length,
		rows,
	};

	// Private temp dir for parquet (not a predictable fixed /tmp path).
	const workDir = mkdtempSync(join(tmpdir(), "aws-cost-"));
	const parquetPath = join(workDir, "aws-cost.parquet");
	// Prefer explicit out path from CI (runner.temp). Never default to os.tmpdir()
	// fixed/predictable names (CodeQL js/insecure-temporary-file).
	const d1SqlOut = process.env.AWS_COST_D1_SQL_OUT;

	try {
		const writer = await ParquetWriter.openFile(schema, parquetPath);
		for (const r of rows) await writer.appendRow(r);
		await writer.close();

		await r2Put("lake/aws-cost/cost.parquet", readFileSync(parquetPath), { contentType: "application/octet-stream" });

		await r2Put("lake/aws-cost/cost.json", Buffer.from(JSON.stringify(payload), "utf8"), {
			contentType: "application/json",
		});

		if (d1SqlOut) {
			writeFileSync(d1SqlOut, buildD1Sql(rows, syncedAt), "utf8");
			console.log(`✅ Wrote D1 SQL → ${d1SqlOut}`);
		} else {
			console.warn("AWS_COST_D1_SQL_OUT unset — skipping D1 SQL write");
		}
		console.log(`✅ Uploaded ${rows.length} rows → R2://${BUCKET}/lake/aws-cost/{cost.parquet,cost.json}`);
	} finally {
		rmSync(workDir, { recursive: true, force: true });
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}