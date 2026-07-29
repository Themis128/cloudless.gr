/**
 * ETL: AWS Cost Explorer → Cloudflare R2 (+ optional D1 SQL dump)
 *
 * Source remains Cost Explorer (AWS-only billing API). Destination is
 * Cloudflare-first: R2 parquet + JSON for /admin/cost, with a generated
 * SQL file for `wrangler d1 execute` upserts into `aws_cost_daily`.
 *
 * Replaces scripts/etl/aws-cost-to-lake.mjs (S3 + Athena path).
 */

import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync, writeFileSync } from "fs";
import { getS3Client, BUCKET } from "./_r2-config.mjs";
import { shapeResults } from "./aws-cost-to-lake.mjs";

const LOOKBACK_DAYS = Number.parseInt(process.env.AWS_COST_LOOKBACK_DAYS || "60", 10);
const D1_SQL_OUT = process.env.AWS_COST_D1_SQL_OUT || "/tmp/aws-cost-d1.sql";

const ce = new CostExplorerClient({ region: "us-east-1" });
const s3 = getS3Client();

const schema = new ParquetSchema({
	cost_date: { type: "UTF8" },
	service: { type: "UTF8" },
	amount_usd: { type: "DOUBLE" },
	currency: { type: "UTF8" },
});

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
	const end = new Date();
	const start = new Date();
	start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);
	const out = await ce.send(
		new GetCostAndUsageCommand({
			TimePeriod: { Start: isoDate(start), End: isoDate(end) },
			Granularity: "DAILY",
			Metrics: ["UnblendedCost"],
			GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
		})
	);
	return out.ResultsByTime || [];
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

	const tmp = "/tmp/aws-cost.parquet";
	const writer = await ParquetWriter.openFile(schema, tmp);
	for (const r of rows) await writer.appendRow(r);
	await writer.close();

	await s3.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: "lake/aws-cost/cost.parquet",
			Body: readFileSync(tmp),
			ContentType: "application/octet-stream",
		})
	);
	unlinkSync(tmp);

	await s3.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: "lake/aws-cost/cost.json",
			Body: Buffer.from(JSON.stringify(payload), "utf8"),
			ContentType: "application/json",
		})
	);

	writeFileSync(D1_SQL_OUT, buildD1Sql(rows, syncedAt), "utf8");
	console.log(`✅ Uploaded ${rows.length} rows → R2://${BUCKET}/lake/aws-cost/{cost.parquet,cost.json}`);
	console.log(`✅ Wrote D1 SQL → ${D1_SQL_OUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}
