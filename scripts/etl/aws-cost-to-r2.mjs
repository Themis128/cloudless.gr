/**
 * ETL: AWS Cost Explorer → R2 Data Lake (Parquet)
 *
 * Migrated version using R2 S3-compatible endpoint.
 * Same logic as aws-cost-to-lake.mjs - only client configuration differs.
 */

import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";
import { getS3Client } from "./_r2-config.mjs";

const LOOKBACK_DAYS = Number.parseInt(process.env.AWS_COST_LOOKBACK_DAYS || "60", 10);
const BUCKET = process.env.ANALYTICS_BUCKET || "datalake-bucket";

// Cost Explorer is a global service — uses us-east-1
const ce = new CostExplorerClient({ region: "us-east-1" });

// Create S3 client - uses shared R2 config helper (falls back to AWS S3 if R2 not configured)
const s3 = getS3Client();

const schema = new ParquetSchema({
	cost_date: { type: "UTF8" },
	service: { type: "UTF8" },
	amount_usd: { type: "DOUBLE" },
	currency: { type: "UTF8" },
});

function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function shapeResults(results: any[]): any[] {
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

async function fetchDailyCost(): Promise<any[]> {
	const end = new Date();
	const start = new Date();
	start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);
	const cmd = new GetCostAndUsageCommand({
		TimePeriod: { Start: isoDate(start), End: isoDate(end) },
		Granularity: "DAILY",
		Metrics: ["UnblendedCost"],
		GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
	});
	const out = await ce.send(cmd);
	return out.ResultsByTime || [];
}

async function main(): Promise<void> {
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

	await s3.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: "lake/aws-cost/cost.parquet",
			Body: readFileSync(tmp),
			ContentType: "application/octet-stream",
		})
	);
	unlinkSync(tmp);

	const target = process.env.CLOUDFLARE_ACCOUNT_ID ? "R2" : "S3";
	console.log(`✅ Uploaded ${rows.length} rows → ${target}://${BUCKET}/lake/aws-cost/cost.parquet`);
}

// Run directly only — keep `shapeResults` importable for tests.
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((e) => {
		console.error(e);
		process.exit(1);
	});
}