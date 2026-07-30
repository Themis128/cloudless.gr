/**
 * ETL: Stripe transactions → RFM + churn scores (Parquet) → R2
 *
 * Migrated version using R2 S3-compatible endpoint.
 * Same logic as compute-rfm-churn.mjs - only client configuration differs.
 */

import { ParquetWriter, ParquetReader, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { BUCKET, r2Put, r2Get } from "./_r2-config.mjs";


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
	risk_band: { type: "UTF8" },
});

// ---------------------------------------------------------------------------
// Read transactions parquet from R2
// ---------------------------------------------------------------------------

async function loadTransactions() {
	const buf = await r2Get("lake/transactions/transactions.parquet");
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
	if (values.length === 0) return 1;
	const sorted = [...values].sort((a, b) => a - b);
	const idx = sorted.findIndex((x) => x >= v);
	const pct = idx < 0 ? 1 : idx / sorted.length;
	return Math.min(5, Math.floor(pct * 5) + 1);
}

function recencyQuintile(values, v) {
	if (values.length === 0) return 1;
	const sorted = [...values].sort((a, b) => a - b);
	const idx = sorted.findIndex((x) => x >= v);
	const pct = idx < 0 ? 1 : idx / sorted.length;
	return 6 - Math.min(5, Math.floor(pct * 5) + 1);
}

function aggregate(transactions) {
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
	console.log("Loading transactions from R2...");
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

	await r2Put("ml-parquet/scores_rfm.parquet", readFileSync("/tmp/scores_rfm.parquet"), { contentType: "application/octet-stream" });
	await r2Put("ml-parquet/scores_churn.parquet", readFileSync("/tmp/scores_churn.parquet"), { contentType: "application/octet-stream" });
	unlinkSync("/tmp/scores_rfm.parquet");
	unlinkSync("/tmp/scores_churn.parquet");

	console.log(`✅ Wrote scores for ${records.length} customers → R2://${BUCKET}/ml-parquet/`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});