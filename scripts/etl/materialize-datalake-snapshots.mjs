/**
 * Materialize admin datalake dashboard sections from R2 parquet → JSON snapshots.
 * Writes:
 *   - lake/snapshots/admin-datalake.json
 *   - lake/snapshots/gsc-weekly.json (weekly GSC rollups)
 */
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { ParquetReader } from "@dsnp/parquetjs";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getS3Client, BUCKET } from "./_r2-config.mjs";

const s3 = getS3Client();
const SNAPSHOT_KEY = "lake/snapshots/admin-datalake.json";
const GSC_WEEKLY_KEY = "lake/snapshots/gsc-weekly.json";

async function readParquet(key) {
	const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
	const buf = Buffer.from(await res.Body.transformToByteArray());
	const dir = mkdtempSync(join(tmpdir(), "datalake-snap-"));
	const tmp = join(dir, "data.parquet");
	writeFileSync(tmp, buf);
	try {
		const reader = await ParquetReader.openFile(tmp);
		const cursor = reader.getCursor();
		const rows = [];
		let row;
		while ((row = await cursor.next())) {
			const plain = {};
			for (const [k, v] of Object.entries(row)) {
				plain[k] = typeof v === "bigint" ? Number(v) : v;
			}
			rows.push(plain);
		}
		await reader.close();
		return rows;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

async function safeParquet(key) {
	try {
		return await readParquet(key);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`  skip ${key}: ${message.slice(0, 160)}`);
		return null;
	}
}

function sectionOk(section, rows) {
	return { section, rows, rowCount: rows.length, fromCache: false };
}

function sectionErr(section, error) {
	return { section, error: String(error).slice(0, 300) };
}

function topKeywords(rows) {
	const byQuery = new Map();
	for (const row of rows) {
		const query = String(row.query ?? "(unknown)");
		const cur = byQuery.get(query) || { query, clicks: 0, impressions: 0, position_sum: 0, n: 0 };
		cur.clicks += Number(row.clicks) || 0;
		cur.impressions += Number(row.impressions) || 0;
		cur.position_sum += Number(row.position) || 0;
		cur.n += 1;
		byQuery.set(query, cur);
	}
	return [...byQuery.values()]
		.map((r) => ({
			query: r.query,
			clicks: r.clicks,
			impressions: r.impressions,
			ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
			avg_position: r.n > 0 ? Math.round((r.position_sum / r.n) * 10) / 10 : 0,
		}))
		.sort((a, b) => b.clicks - a.clicks)
		.slice(0, 25);
}

function gscWeeklyReports(rows) {
	const byWeek = new Map();

	for (const row of rows) {
		const end = String(row.end_date ?? "");
		if (!end) continue;

		let week = byWeek.get(end);
		if (!week) {
			week = {
				clicks: 0,
				impressions: 0,
				position_sum: 0,
				position_n: 0,
				keywords: new Set(),
				ctr_opportunities: 0,
				queryRows: [],
			};
			byWeek.set(end, week);
		}

		const clicks = Number(row.clicks) || 0;
		const impressions = Number(row.impressions) || 0;
		const ctr = impressions > 0 ? clicks / impressions : Number(row.ctr) || 0;
		const query = String(row.query ?? "");

		week.clicks += clicks;
		week.impressions += impressions;
		if (query) week.keywords.add(query);
		week.position_sum += Number(row.position) || 0;
		week.position_n += 1;
		if (impressions >= 20 && ctr < 0.02) week.ctr_opportunities += 1;
		week.queryRows.push({ query, clicks, ctr });
	}

	return [...byWeek.entries()]
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([end, week]) => {
			const topKeywords = week.queryRows
				.sort((a, b) => b.clicks - a.clicks)
				.slice(0, 5)
				.map((r) => ({ q: r.query, clicks: r.clicks, ctr: r.ctr }));

			return {
				id: end,
				week: `Week of ${end}`,
				date: end,
				clicks: week.clicks,
				impressions: week.impressions,
				ctrPct:
					week.impressions > 0
						? Math.round((100 * week.clicks) / week.impressions * 100) / 100
						: 0,
				avgPosition:
					week.position_n > 0
						? Math.round((week.position_sum / week.position_n) * 100) / 100
						: 0,
				keywords: week.keywords.size,
				topKeywords,
				topCountry: "",
				mobilePct: 0,
				ctrOpportunities: week.ctr_opportunities,
			};
		});
}

function topErrors(rows) {
	return [...rows]
		.sort((a, b) => (Number(b.count_14d) || 0) - (Number(a.count_14d) || 0))
		.slice(0, 10)
		.map((r) => ({
			short_id: r.short_id ?? null,
			title: r.title ?? null,
			level: r.level ?? null,
			status: r.status ?? null,
			count_14d: Number(r.count_14d) || 0,
			user_count: Number(r.user_count) || 0,
			last_seen: r.last_seen ?? null,
			permalink: r.permalink ?? null,
		}));
}

function linkedinSummary(rows) {
	return rows.slice(0, 50).map((r) => {
		const out = {};
		for (const [k, v] of Object.entries(r)) out[k] = v ?? null;
		return out;
	});
}

function espocrmFunnel(contacts, opportunities) {
	if (!contacts) return null;
	const opps = opportunities || [];
	const bySource = new Map();
	for (const c of contacts) {
		const lead = String(c.lead_source ?? c.source ?? "(none)");
		const cur = bySource.get(lead) || {
			lifecycle_stage: "contact",
			lead_source: lead,
			contact_count: 0,
			closed_won_deals: 0,
			closed_won_revenue: 0,
		};
		cur.contact_count += 1;
		bySource.set(lead, cur);
	}
	for (const o of opps) {
		const stage = String(o.stage ?? o.status ?? "");
		if (!/closed\s*won/i.test(stage) && stage !== "Closed Won") continue;
		const lead = String(o.lead_source ?? "(none)");
		const cur = bySource.get(lead) || {
			lifecycle_stage: "contact",
			lead_source: lead,
			contact_count: 0,
			closed_won_deals: 0,
			closed_won_revenue: 0,
		};
		cur.closed_won_deals += 1;
		cur.closed_won_revenue += Number(o.amount) || 0;
		bySource.set(lead, cur);
	}
	return [...bySource.values()].sort((a, b) => b.contact_count - a.contact_count).slice(0, 20);
}

async function putJson(key, payload) {
	await s3.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: key,
			Body: Buffer.from(JSON.stringify(payload), "utf8"),
			ContentType: "application/json",
		})
	);
}

async function main() {
	console.log(`Materializing datalake snapshot → R2://${BUCKET}/${SNAPSHOT_KEY}`);
	const sections = [];
	const gsc = await safeParquet("lake/gsc-keywords/keywords.parquet");
	sections.push(
		gsc ? sectionOk("top_keywords", topKeywords(gsc)) : sectionErr("top_keywords", "missing gsc parquet")
	);

	if (gsc) {
		const reports = gscWeeklyReports(gsc);
		await putJson(GSC_WEEKLY_KEY, { generated_at: new Date().toISOString(), reports });
		console.log(`✅ Wrote GSC weekly snapshot (${reports.length} weeks) → ${GSC_WEEKLY_KEY}`);
	}

	const sentry = await safeParquet("lake/sentry-issues/issues.parquet");
	sections.push(
		sentry ? sectionOk("top_errors", topErrors(sentry)) : sectionErr("top_errors", "missing sentry parquet")
	);
	const linkedin = await safeParquet("lake/linkedin-ads/insights.parquet");
	sections.push(
		linkedin
			? sectionOk("linkedin_ads", linkedinSummary(linkedin))
			: sectionErr("linkedin_ads", "missing linkedin parquet")
	);
	const contacts = await safeParquet("lake/espocrm-contacts/contacts.parquet");
	const opportunities = await safeParquet("lake/espocrm-opportunities/opportunities.parquet");
	const funnel = espocrmFunnel(contacts, opportunities);
	sections.push(
		funnel ? sectionOk("espocrm_funnel", funnel) : sectionErr("espocrm_funnel", "missing espocrm parquet")
	);

	const payload = { generated_at: new Date().toISOString(), cache: "cloudflare", sections };
	await putJson(SNAPSHOT_KEY, payload);
	console.log(`✅ Wrote snapshot with ${sections.length} sections`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
