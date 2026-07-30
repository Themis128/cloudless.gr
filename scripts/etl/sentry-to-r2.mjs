/**
 * ETL: Sentry → R2 Data Lake (Parquet)
 *
 * Migrated version using R2 S3-compatible endpoint.
 * Same logic as sentry-to-lake.mjs - only client configuration differs.
 */

import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";
import { BUCKET, r2Put } from "./_r2-config.mjs";
const TOKEN = process.env.SENTRY_AUTH_TOKEN;
const ORG = process.env.SENTRY_ORG || "baltzakisthemiscom";
const PROJECT = process.env.SENTRY_PROJECT || "cloudless-gr";

if (!TOKEN) {
	console.error("SENTRY_AUTH_TOKEN not set");
	process.exit(1);
}


const SENTRY_API = "https://sentry.io/api/0";

const schema = new ParquetSchema({
	issue_id: { type: "UTF8" },
	short_id: { type: "UTF8", optional: true },
	title: { type: "UTF8" },
	culprit: { type: "UTF8", optional: true },
	level: { type: "UTF8" },
	status: { type: "UTF8" },
	count_14d: { type: "INT64" },
	user_count: { type: "INT32" },
	first_seen: { type: "UTF8", optional: true },
	last_seen: { type: "UTF8", optional: true },
	permalink: { type: "UTF8", optional: true },
});

async function sentryFetch(path) {
	const res = await fetch(`${SENTRY_API}${path}`, {
		headers: { Authorization: `Bearer ${TOKEN}` },
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Sentry ${res.status} on ${path}: ${body.slice(0, 200)}`);
	}
	return res;
}

async function listAllIssues() {
	const out = [];
	let url = `/projects/${ORG}/${PROJECT}/issues/?statsPeriod=14d&limit=100`;
	for (let i = 0; i < 20; i++) {
		const res = await sentryFetch(url);
		const batch = await res.json();
		for (const r of batch) out.push(r);
		const link = res.headers.get("Link") || "";
		const next = link.split(",").find((s) => s.includes('rel="next"'));
		if (!next || next.includes('results="false"')) break;
		const m = next.match(/<([^>]+)>/);
		if (!m) break;
		url = m[1].replace("https://sentry.io/api/0", "");
	}
	return out;
}

async function main() {
	console.log(`Fetching Sentry issues for ${ORG}/${PROJECT}...`);
	const issues = await listAllIssues();
	console.log(`  ${issues.length} unresolved issues`);

	const rows = issues.map((i) => ({
		issue_id: i.id,
		short_id: i.shortId || null,
		title: i.title || "(no title)",
		culprit: i.culprit || null,
		level: i.level || "error",
		status: i.status || "unresolved",
		count_14d: BigInt(parseInt(i.count, 10) || 0),
		user_count: i.userCount || 0,
		first_seen: i.firstSeen || null,
		last_seen: i.lastSeen || null,
		permalink: i.permalink || null,
	}));

	const tmp = "/tmp/sentry-issues.parquet";
	const writer = await ParquetWriter.openFile(schema, tmp);
	for (const r of rows) await writer.appendRow(r);
	await writer.close();

	await r2Put("lake/sentry-issues/issues.parquet", readFileSync(tmp), { contentType: "application/octet-stream" });
	unlinkSync(tmp);
	console.log(`✅ Uploaded ${rows.length} issues → R2://${BUCKET}/lake/sentry-issues/`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});