/**
 * ETL: GA4 Data API → R2 Data Lake (Parquet)
 *
 * Writes:
 *   lake/ga4-daily/daily.parquet      — dims [date] (90d, core metrics)
 *   lake/ga4-channels/channels.parquet — dims [channel_group] (28d)
 *
 * Auth: user OAuth refresh token (analytics.readonly scope).
 *   GA4_OAUTH_CLIENT_ID, GA4_OAUTH_CLIENT_SECRET, GA4_REFRESH_TOKEN
 *   GA4_PROPERTY_ID — default properties/532355790 (cloudless.gr)
 *
 * The refresh token comes from the one-time consent flow (see
 * home-ops/scripts/google-mcp-setup.py). Access tokens are minted per run.
 */

import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";
import { r2Put } from "./_r2-config.mjs";

const PROPERTY = process.env.GA4_PROPERTY_ID || "properties/532355790";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const CORE_METRICS = [
	"sessions",
	"totalUsers",
	"newUsers",
	"screenPageViews",
	"engagedSessions",
	"engagementRate",
	"averageSessionDuration",
	"bounceRate",
	"conversions",
	"totalRevenue",
]; // GA4 Data API caps at 10 metrics/request

const dailySchema = new ParquetSchema({
	date: { type: "UTF8" },
	sessions: { type: "INT32" },
	total_users: { type: "INT32" },
	new_users: { type: "INT32" },
	page_views: { type: "INT32" },
	engaged_sessions: { type: "INT32" },
	engagement_rate: { type: "DOUBLE" },
	avg_session_duration: { type: "DOUBLE" },
	bounce_rate: { type: "DOUBLE" },
	conversions: { type: "INT32" },
	total_revenue: { type: "DOUBLE" },
});

const channelSchema = new ParquetSchema({
	channel_group: { type: "UTF8" },
	sessions: { type: "INT32" },
	total_users: { type: "INT32" },
	new_users: { type: "INT32" },
	page_views: { type: "INT32" },
	engagement_rate: { type: "DOUBLE" },
	avg_session_duration: { type: "DOUBLE" },
	conversions: { type: "INT32" },
	total_revenue: { type: "DOUBLE" },
	start_date: { type: "UTF8" },
	end_date: { type: "UTF8" },
});

const METRIC_MAP = {
	sessions: "sessions",
	totalUsers: "total_users",
	newUsers: "new_users",
	screenPageViews: "page_views",
	engagedSessions: "engaged_sessions",
	engagementRate: "engagement_rate",
	averageSessionDuration: "avg_session_duration",
	bounceRate: "bounce_rate",
	conversions: "conversions",
	totalRevenue: "total_revenue",
};

async function getAccessToken() {
	const cid = process.env.GA4_OAUTH_CLIENT_ID;
	const csec = process.env.GA4_OAUTH_CLIENT_SECRET;
	const rt = process.env.GA4_REFRESH_TOKEN;
	if (!cid || !csec || !rt) {
		throw new Error("Set GA4_OAUTH_CLIENT_ID / GA4_OAUTH_CLIENT_SECRET / GA4_REFRESH_TOKEN");
	}
	const res = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: rt,
			client_id: cid,
			client_secret: csec,
		}),
	});
	if (!res.ok) throw new Error(`token refresh ${res.status}: ${(await res.text()).slice(0, 160)}`);
	return (await res.json()).access_token;
}

async function runReport(token, body) {
	const url = `https://analyticsdata.googleapis.com/v1beta/${PROPERTY}:runReport`;
	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const t = await res.text().catch(() => "");
		throw new Error(`GA4 runReport ${res.status}: ${t.slice(0, 200)}`);
	}
	return res.json();
}

function metricValues(row, metricHeaders) {
	const out = {};
	const headers = metricHeaders?.map((m) => m.name) ?? [];
	row.metricValues?.forEach((mv, i) => {
		const name = headers[i] ?? mv.name;
		const col = METRIC_MAP[name];
		if (!col) return;
		const v = Number(mv.value);
		out[col] = Number.isFinite(v) ? v : 0;
	});
	return out;
}

async function writeParquet(tmpPath, schema, rows, r2Key) {
	const writer = await ParquetWriter.openFile(schema, tmpPath);
	for (const r of rows) await writer.appendRow(r);
	await writer.close();
	await r2Put(r2Key, readFileSync(tmpPath), { contentType: "application/octet-stream" });
	unlinkSync(tmpPath);
}

async function writeEmptyAndExit(reason) {
	console.warn(`[ga4-to-r2] ${reason} — writing empty parquet(s) and exiting 0.`);
	await writeParquet("/tmp/ga4-daily-empty.parquet", dailySchema, [], "lake/ga4-daily/daily.parquet");
	await writeParquet("/tmp/ga4-channels-empty.parquet", channelSchema, [], "lake/ga4-channels/channels.parquet");
	console.log("✓ ga4 → R2 sync complete (empty — skip)");
	process.exit(0);
}

function ymdToIso(ymd) {
	// GA4 returns YYYYMMDD
	return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

async function main() {
	console.log(`Fetching GA4 reports for ${PROPERTY}...`);
	let token;
	try {
		token = await getAccessToken();
	} catch (err) {
		await writeEmptyAndExit(`auth failed (${String(err?.message ?? err).slice(0, 200)})`);
	}

	// 1) Daily series — 90 days
	const daily = await runReport(token, {
		dateRanges: [{ startDate: "90daysAgo", endDate: "today" }],
		dimensions: [{ name: "date" }],
		metrics: CORE_METRICS.map((name) => ({ name })),
		orderBys: [{ dimension: { dimensionName: "date" } }],
		limit: 100,
	});
	const dailyRows = (daily.rows ?? []).map((r) => ({
		date: ymdToIso(r.dimensionValues[0].value),
		sessions: 0, total_users: 0, new_users: 0, page_views: 0,
		engaged_sessions: 0, engagement_rate: 0, avg_session_duration: 0,
		bounce_rate: 0, conversions: 0, total_revenue: 0,
		...metricValues(r, daily.metricHeaders),
	}));
	await writeParquet("/tmp/ga4-daily.parquet", dailySchema, dailyRows, "lake/ga4-daily/daily.parquet");
	console.log(`✓ ga4-daily: ${dailyRows.length} rows`);

	// 2) Channel grouping — 28 days
	const channels = await runReport(token, {
		dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
		dimensions: [{ name: "sessionDefaultChannelGroup" }],
		metrics: ["sessions", "totalUsers", "newUsers", "screenPageViews",
			"engagementRate", "averageSessionDuration", "conversions", "totalRevenue"]
			.map((name) => ({ name })),
		orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
		limit: 50,
	});
	const channelRows = (channels.rows ?? []).map((r) => ({
		channel_group: r.dimensionValues[0].value,
		sessions: 0, total_users: 0, new_users: 0, page_views: 0,
		engagement_rate: 0, avg_session_duration: 0,
		conversions: 0, total_revenue: 0,
		...metricValues(r, channels.metricHeaders),
		start_date: "28daysAgo",
		end_date: "today",
	}));
	await writeParquet("/tmp/ga4-channels.parquet", channelSchema, channelRows, "lake/ga4-channels/channels.parquet");
	console.log(`✓ ga4-channels: ${channelRows.length} rows`);

	console.log("✓ ga4 → R2 sync complete");
}

main().catch((err) => {
	console.error("ga4-to-r2 failed:", err);
	process.exit(1);
});
