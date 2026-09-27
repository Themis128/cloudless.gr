/**
 * Materialize admin datalake dashboard sections from R2 parquet → JSON snapshots.
 * Writes:
 *   - lake/snapshots/admin-datalake.json
 *   - lake/snapshots/gsc-weekly.json (weekly GSC rollups)
 */
import { ParquetReader } from "@dsnp/parquetjs";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { BUCKET, r2Put, r2Get, r2List } from "./_r2-config.mjs";

const SNAPSHOT_KEY = "lake/snapshots/admin-datalake.json";
const GSC_WEEKLY_KEY = "lake/snapshots/gsc-weekly.json";

async function readParquet(key) {
	const buf = await r2Get(key);
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

async function safeJson(key) {
	try {
		const buf = await r2Get(key);
		return JSON.parse(buf.toString("utf8"));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`  skip ${key}: ${message.slice(0, 160)}`);
		return null;
	}
}

function sectionOk(section, rows) {
	return { section, rows, rowCount: rows.length, fromCache: false };
}

// ── D1 hot-overlay sections ────────────────────────────────────────────
// acquisition_funnel + attribution are served live from D1 analytics_events
// (see datalake-r2.ts HOT_D1_SECTIONS). Materialize the same queries into
// gold so the batch insights pipeline and cold-cache fallback see them too.
const AUTH_D1_DATABASE_ID =
	process.env.CLOUDFLARE_D1_DATABASE_ID?.trim() ||
	process.env.AUTH_D1_DATABASE_ID?.trim() ||
	"7ca74513-23c3-412a-b9ca-b0c55835973d";

async function d1Query(sql, params = []) {
	const account =
		process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || process.env.CF_ACCOUNT_ID?.trim();
	const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
	if (!account || !token) return null;
	const url = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${AUTH_D1_DATABASE_ID}/query`;
	const res = await fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
		body: JSON.stringify({ sql, params }),
		signal: AbortSignal.timeout(15_000),
	});
	const body = await res.json().catch(() => null);
	if (!res.ok || body?.success === false) {
		const msg =
			body?.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
			res.statusText;
		throw new Error(`d1 query failed (${res.status}): ${msg}`);
	}
	return body?.result?.[0]?.results ?? [];
}

const daysAgoUnix = (days) => Math.floor(Date.now() / 1000) - days * 86400;

// Mirrors acquisitionFromD1 in src/lib/datalake-r2.ts (30-day window).
async function acquisitionFunnelD1() {
	const rows = await d1Query(
		`SELECT date(created_at, 'unixepoch') AS day,
		        COUNT(DISTINCT CASE WHEN event = 'page_view' THEN session_id END) AS sessions,
		        COUNT(DISTINCT CASE WHEN event = 'signup' THEN user_id END) AS signups,
		        COUNT(DISTINCT CASE WHEN event = 'purchase' THEN user_id END) AS purchasers,
		        SUM(CASE WHEN event = 'purchase'
		                 THEN COALESCE(json_extract(properties_json, '$.amount'), 0)
		                 ELSE 0 END) AS revenue
		 FROM analytics_events
		 WHERE created_at >= ?
		 GROUP BY 1
		 ORDER BY 1 DESC`,
		[daysAgoUnix(30)]
	);
	return rows;
}

// Mirrors attributionFromD1 in src/lib/datalake-r2.ts (90-day window).
async function attributionD1() {
	const rows = await d1Query(
		`SELECT COALESCE(source, '(direct)') AS utm_source,
		        COALESCE(medium, '(none)') AS utm_medium,
		        COALESCE(campaign, '(none)') AS utm_campaign,
		        COUNT(DISTINCT CASE WHEN event = 'page_view' THEN session_id END) AS sessions,
		        COUNT(DISTINCT CASE WHEN event = 'signup' THEN user_id END) AS signups,
		        SUM(CASE WHEN event = 'purchase' THEN 1 ELSE 0 END) AS purchases,
		        SUM(CASE WHEN event = 'purchase'
		                 THEN COALESCE(json_extract(properties_json, '$.amount'), 0)
		                 ELSE 0 END) AS revenue
		 FROM analytics_events
		 WHERE created_at >= ?
		 GROUP BY 1, 2, 3
		 HAVING COUNT(*) > 1
		 ORDER BY revenue DESC, sessions DESC
		 LIMIT 25`,
		[daysAgoUnix(90)]
	);
	return rows;
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

function topPages(rows) {
	const byPage = new Map();
	for (const row of rows) {
		const page = String(row.page ?? "(unknown)");
		const cur = byPage.get(page) || { page, clicks: 0, impressions: 0, position_sum: 0, n: 0 };
		cur.clicks += Number(row.clicks) || 0;
		cur.impressions += Number(row.impressions) || 0;
		cur.position_sum += Number(row.position) || 0;
		cur.n += 1;
		byPage.set(page, cur);
	}
	return [...byPage.values()]
		.map((r) => ({
			page: r.page,
			clicks: r.clicks,
			impressions: r.impressions,
			ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
			avg_position: r.n > 0 ? Math.round((r.position_sum / r.n) * 10) / 10 : 0,
		}))
		.sort((a, b) => b.clicks - a.clicks)
		.slice(0, 25);
}

function gscQueryPages(rows) {
	return [...rows]
		.map((r) => ({
			query: String(r.query ?? ""),
			page: String(r.page ?? ""),
			clicks: Number(r.clicks) || 0,
			impressions: Number(r.impressions) || 0,
			ctr: Number(r.impressions) > 0 ? (Number(r.clicks) || 0) / (Number(r.impressions) || 1) : Number(r.ctr) || 0,
			position: Math.round((Number(r.position) || 0) * 10) / 10,
		}))
		.sort((a, b) => b.clicks - a.clicks)
		.slice(0, 50);
}

function gscCountries(rows) {
	return [...rows]
		.map((r) => ({
			country: String(r.country ?? "(unknown)"),
			clicks: Number(r.clicks) || 0,
			impressions: Number(r.impressions) || 0,
			ctr: Number(r.impressions) > 0 ? (Number(r.clicks) || 0) / (Number(r.impressions) || 1) : Number(r.ctr) || 0,
			avg_position: Math.round((Number(r.position) || 0) * 10) / 10,
		}))
		.sort((a, b) => b.clicks - a.clicks)
		.slice(0, 50);
}

function gscDevices(rows) {
	return [...rows]
		.map((r) => ({
			device: String(r.device ?? "(unknown)"),
			clicks: Number(r.clicks) || 0,
			impressions: Number(r.impressions) || 0,
			ctr: Number(r.impressions) > 0 ? (Number(r.clicks) || 0) / (Number(r.impressions) || 1) : Number(r.ctr) || 0,
			avg_position: Math.round((Number(r.position) || 0) * 10) / 10,
		}))
		.sort((a, b) => b.clicks - a.clicks);
}

function gscWeeklyReports(rows, countryRows = [], deviceRows = []) {
	const topCountry =
		[...countryRows].sort((a, b) => (Number(b.clicks) || 0) - (Number(a.clicks) || 0))[0]
			?.country ?? "";
	const deviceClicks = deviceRows.reduce((a, r) => a + (Number(r.clicks) || 0), 0);
	const mobileClicks = deviceRows
		.filter((r) => String(r.device ?? "").toUpperCase() === "MOBILE")
		.reduce((a, r) => a + (Number(r.clicks) || 0), 0);
	const mobilePct =
		deviceClicks > 0 ? Math.round((100 * mobileClicks) / deviceClicks * 10) / 10 : 0;

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
				topCountry: String(topCountry),
				mobilePct,
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
		if (String(c.contact_id ?? "") === "__placeholder__") continue;
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
		if (String(o.opportunity_id ?? "") === "__placeholder__") continue;
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
	await r2Put(key, Buffer.from(JSON.stringify(payload), "utf8"), {
		contentType: "application/json",
	});
}

function stripeRevenue(rows) {
	const isTest = (r) =>
		/^cs_test_|^in_test_|^sub_test_/i.test(String(r.stripe_id ?? r.transaction_id ?? "")) ||
		/@example\.(com|invalid)$/i.test(String(r.email ?? ""));
	const paid = rows.filter((r) => String(r.status) === "paid" && !isTest(r));
	const totalCents = paid.reduce((acc, r) => acc + (Number(r.amount_cents) || 0), 0);
	const byType = new Map();
	for (const r of paid) {
		const t = String(r.type ?? "unknown");
		const cur = byType.get(t) || { type: t, count: 0, amount_eur: 0 };
		cur.count += 1;
		cur.amount_eur += (Number(r.amount_cents) || 0) / 100;
		byType.set(t, cur);
	}
	return [
		{
			metric: "paid_orders",
			value: paid.length,
			amount_eur: Math.round((totalCents / 100) * 100) / 100,
		},
		...[...byType.values()].map((r) => ({
			metric: `type_${r.type}`,
			value: r.count,
			amount_eur: Math.round(r.amount_eur * 100) / 100,
		})),
	];
}

function n8nOps(workflows, executions) {
	const wf = workflows || [];
	const ex = executions || [];
	const failed = ex.filter((e) => /error|failed|crashed/i.test(String(e.status ?? ""))).length;
	return [
		{ metric: "workflows_total", value: wf.length },
		{ metric: "workflows_active", value: wf.filter((w) => w.active).length },
		{ metric: "executions_sampled", value: ex.length },
		{ metric: "executions_failed", value: failed },
		{
			metric: "failure_rate",
			value: ex.length ? Math.round((failed / ex.length) * 1000) / 1000 : 0,
		},
	];
}

function postizOps(posts, integrations) {
	const p = posts || [];
	const i = integrations || [];
	const published = p.filter((x) => /publish|released|success/i.test(String(x.state ?? ""))).length;
	return [
		{ metric: "posts_sampled", value: p.length },
		{ metric: "posts_published", value: published },
		{ metric: "integrations", value: i.length },
		{ metric: "integrations_disabled", value: i.filter((x) => x.disabled).length },
	];
}

// ── SocialAuto sections ───────────────────────────────────────────────────
// Silver JSON written by SocialAuto's datalake_export Celery task into
// lake/socialauto-*; insights come from its deterministic insights engine.

function socialautoOps(accounts, posts) {
	const a = accounts || [];
	const p = posts || [];
	const published = p.filter(
		(x) => x.status === "published" ||
			(x.targets || []).some((t) => t.status === "published")
	);
	const platforms = new Set(a.map((x) => x.platform));
	return [
		{ metric: "accounts_total", value: a.length },
		{ metric: "accounts_active", value: a.filter((x) => x.status === "active").length },
		{ metric: "accounts_error", value: a.filter((x) => x.status === "error" || x.status === "expired" || x.status === "revoked").length },
		{ metric: "platforms_connected", value: platforms.size },
		{ metric: "posts_total", value: p.length },
		{ metric: "posts_published", value: published.length },
	];
}

/** Pick the team insights file with the most populated platform data. */
function richestInsights(candidates) {
	const valid = (candidates || []).filter((j) => j && j.platforms && !j.error);
	if (!valid.length) return null;
	return valid.sort(
		(a, b) => Object.keys(b.platforms).length - Object.keys(a.platforms).length
	)[0];
}

function socialEngagement(insights) {
	if (!insights?.platforms) return null;
	return Object.entries(insights.platforms)
		.map(([platform, p]) => ({
			platform,
			focus_tier: p.focus_tier ?? null,
			confidence: p.confidence ?? null,
			posts: p.posts ?? 0,
			impressions: p.impressions ?? 0,
			engagement: p.engagement ?? 0,
			avg_er_pct: p.avg_engagement_rate ?? 0,
			median_er_pct: p.median_engagement_rate ?? 0,
			median_eng_per_post: p.median_engagement_per_post ?? 0,
			er_by_followers_pct: p.er_by_followers_pct ?? null,
			benchmark_verdict: p.benchmark?.verdict ?? null,
			momentum_7d_pct: p.momentum_7d_engagement_pct ?? null,
			engagement_7d: p.engagement_7d ?? 0,
			followers: p.follower_growth?.current ?? null,
			follower_net: p.follower_growth?.net ?? null,
			data_warnings: (p.data_warnings || []).join("; ") || null,
		}))
		.sort((a, b) => (b.engagement || 0) - (a.engagement || 0));
}

function socialOutliers(insights) {
	if (!insights?.platforms) return null;
	const rows = [];
	for (const [platform, p] of Object.entries(insights.platforms)) {
		for (const o of p.outliers || []) {
			rows.push({
				platform,
				post_id: o.post_id ?? null,
				kind: o.kind,
				engagement: o.engagement ?? 0,
				engagement_rate: o.engagement_rate ?? 0,
				platform_median: o.platform_median_engagement ?? null,
			});
		}
		const a = p.follower_growth?.anomaly;
		if (a) {
			rows.push({
				platform,
				post_id: null,
				kind: "follower_anomaly",
				engagement: a.delta,
				engagement_rate: null,
				platform_median: null,
			});
		}
	}
	return rows.sort((a, b) => Math.abs(b.engagement) - Math.abs(a.engagement));
}

function socialRecommendations(insights) {
	if (!insights?.recommendations) return null;
	return insights.recommendations.map((r) => ({
		type: r.type ?? null,
		priority: r.priority ?? null,
		platform: r.platform ?? null,
		text: String(r.text ?? "").slice(0, 500),
	}));
}

function socialLeads(leads) {
	if (!leads) return null;
	const bySource = new Map();
	const byInterest = new Map();
	const bySize = new Map();
	for (const l of leads) {
		const bump = (m, key) => {
			const k = key || "(unknown)";
			const cur = m.get(k) || { leads: 0, espocrm_synced: 0 };
			cur.leads += 1;
			if (l.espocrm_synced) cur.espocrm_synced += 1;
			m.set(k, cur);
		};
		bump(bySource, l.platform ? `${l.source}·${l.platform}` : l.source);
		bump(byInterest, l.interest);
		bump(bySize, l.company_size);
	}
	const rows = [];
	for (const [dim, m] of [["source", bySource], ["interest", byInterest], ["company_size", bySize]]) {
		for (const [value, cur] of m) {
			rows.push({ dimension: dim, value, leads: cur.leads, espocrm_synced: cur.espocrm_synced });
		}
	}
	return rows.sort((a, b) => b.leads - a.leads);
}

function socialAttribution(events) {
	if (!events) return null;
	const byUtm = new Map();
	for (const e of events) {
		if (!e.utm_source && !e.utm_campaign) continue;
		const key = `${e.utm_source || "(direct)"}|${e.utm_medium || "(none)"}|${e.utm_campaign || "(none)"}`;
		const cur = byUtm.get(key) || { events: 0, sessions: new Set() };
		cur.events += 1;
		if (e.session_id) cur.sessions.add(e.session_id);
		byUtm.set(key, cur);
	}
	return [...byUtm.entries()]
		.map(([key, cur]) => {
			const [utm_source, utm_medium, utm_campaign] = key.split("|");
			return { utm_source, utm_medium, utm_campaign, events: cur.events, sessions: cur.sessions.size };
		})
		.sort((a, b) => b.events - a.events)
		.slice(0, 25);
}

// ── LinkedIn Ads — report ground truth (lake/socialauto-ads/*.json) ────────
// Daily + demographics rows are imported into SocialAuto Postgres from
// Campaign Manager CSV exports (scripts/import_linkedin_reports.py) and
// shipped here by the datalake_export celery task. The API-based
// lake/linkedin-ads/insights.parquet is the fallback when the CSV import
// is absent (OAuth restored 2026-09 — LinkedIn-Version 202605).

function linkedinAdsTruth(daily, snapshots) {
	const sets = new Map();
	for (const r of daily || []) {
		if (r.report_type !== "campaign_performance") continue;
		const key = r.ad_set_id || r.ad_set_name || "(unknown)";
		const cur = sets.get(key) || {
			ad_set_id: r.ad_set_id, ad_set_name: r.ad_set_name,
			campaign_name: r.campaign_name, status: r.status,
			days: 0, spend_eur: 0, impressions: 0, clicks: 0,
			engagements: 0, leads: 0, conversions: 0,
			clicks_to_landing_page: 0, clicks_to_linkedin_page: 0,
			budget_eur: 0, first_day: r.day, last_day: r.day,
		};
		cur.days += 1;
		cur.spend_eur += Number(r.spend_eur) || 0;
		cur.impressions += Number(r.impressions) || 0;
		cur.clicks += Number(r.clicks) || 0;
		cur.engagements += Number(r.engagements) || 0;
		cur.leads += Number(r.leads) || 0;
		cur.conversions += Number(r.conversions) || 0;
		cur.clicks_to_landing_page += Number(r.clicks_to_landing_page) || 0;
		cur.clicks_to_linkedin_page += Number(r.clicks_to_linkedin_page) || 0;
		cur.budget_eur = Math.max(cur.budget_eur, Number(r.budget_eur) || 0);
		if (r.day && r.day < cur.first_day) cur.first_day = r.day;
		if (r.day && r.day > cur.last_day) cur.last_day = r.day;
		sets.set(key, cur);
	}
	const rows = [...sets.values()].map((s) => ({
		...s,
		spend_eur: Number(s.spend_eur.toFixed(2)),
		ctr_pct: s.impressions ? Number(((s.clicks / s.impressions) * 100).toFixed(2)) : 0,
		cpc_eur: s.clicks ? Number((s.spend_eur / s.clicks).toFixed(2)) : null,
		cpm_eur: s.impressions ? Number(((s.spend_eur / s.impressions) * 1000).toFixed(2)) : null,
		cost_per_engagement_eur: s.engagements
			? Number((s.spend_eur / s.engagements).toFixed(2))
			: null,
		budget_used_pct: s.budget_eur
			? Number(((s.spend_eur / s.budget_eur) * 100).toFixed(1))
			: null,
	}));
	// Latest scraped snapshot adds live status/budget where the report lags.
	const latestSnap = (snapshots || [])[0];
	if (latestSnap) {
		for (const s of rows) {
			if (String(latestSnap.campaign_id) === String(s.ad_set_id)) {
				s.live_status = latestSnap.status;
				if (!s.budget_eur) s.budget_eur = Number(latestSnap.budget_eur) || 0;
			}
		}
	}
	return rows.sort((a, b) => b.spend_eur - a.spend_eur);
}

// lake/linkedin-ads/demographics.parquet (Marketing API r_ads_reporting
// MEMBER_* pivots) → the same shape the CM-CSV demographics.json rows carry.
// Fallback source for linkedin_ads_audience when the CSV import is absent.
function apiDemoToSegments(rows) {
	if (!rows?.length) return null;
	const totals = new Map();
	for (const r of rows) {
		const t = r.pivot || "(unknown)";
		totals.set(t, (totals.get(t) || 0) + (Number(r.clicks) || 0));
	}
	return rows.map((r) => {
		const clicks = Number(r.clicks) || 0;
		const impressions = Number(r.impressions) || 0;
		const totalClicks = totals.get(r.pivot) || 0;
		return {
			segment_type: String(r.pivot || "").replace(/^MEMBER_/, "").toLowerCase(),
			segment_value: r.pivot_label || r.pivot_value,
			impressions,
			clicks,
			ctr: impressions ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
			pct_clicks: totalClicks ? Number(((clicks / totalClicks) * 100).toFixed(1)) : 0,
			conversions: r.conversions || 0,
		};
	});
}

function linkedinAdsAudience(demographics) {
	if (!demographics) return null;
	const byType = new Map();
	for (const r of demographics) {
		const t = r.segment_type || "(unknown)";
		if (!byType.has(t)) byType.set(t, []);
		byType.get(t).push(r);
	}
	const rows = [];
	for (const [type, segs] of byType) {
		const ranked = segs
			.slice()
			.sort((a, b) => (b.clicks || 0) - (a.clicks || 0) || (b.impressions || 0) - (a.impressions || 0))
			.slice(0, 8);
		for (const s of ranked) {
			rows.push({
				segment_type: type,
				segment_value: s.segment_value,
				impressions: s.impressions,
				clicks: s.clicks,
				ctr_pct: s.ctr,
				pct_of_clicks: s.pct_clicks,
				conversions: s.conversions,
			});
		}
	}
	return rows;
}

/** Join paid ground truth with owned-site events → real funnel + cost. */
function adsFunnel(daily, webEvents, leads) {
	if (!daily) return null;
	const spend = { spend_eur: 0, impressions: 0, clicks: 0, engagements: 0,
		leads: 0, conversions: 0, clicks_to_landing_page: 0 };
	for (const r of daily) {
		if (r.report_type !== "campaign_performance") continue;
		spend.spend_eur += Number(r.spend_eur) || 0;
		spend.impressions += Number(r.impressions) || 0;
		spend.clicks += Number(r.clicks) || 0;
		spend.engagements += Number(r.engagements) || 0;
		spend.leads += Number(r.leads) || 0;
		spend.conversions += Number(r.conversions) || 0;
		spend.clicks_to_landing_page += Number(r.clicks_to_landing_page) || 0;
	}

	// Site-side truth: events attributed to LinkedIn via UTM or referrer.
	const liEvents = (webEvents || []).filter((e) =>
		/linkedin/i.test(e.referrer || "") || /linkedin/i.test(e.utm_source || ""));
	const liSessions = new Set(liEvents.map((e) => e.session_id).filter(Boolean));
	const liConversions = liEvents.filter((e) =>
		/contact|lead|signup|checkout|submit/i.test(e.event_name || "")).length;
	const paidLeads = (leads || []).filter((l) =>
		/linkedin|paid|ad/i.test(`${l.source} ${l.platform}`)).length;

	return [
		{ stage: "impressions", count: spend.impressions,
			cost_eur: spend.impressions ? spend.spend_eur / (spend.impressions / 1000) : null,
			note: "CPM basis" },
		{ stage: "clicks", count: spend.clicks,
			cost_eur: spend.clicks ? spend.spend_eur / spend.clicks : null, note: "CPC" },
		{ stage: "clicks_to_landing_page", count: spend.clicks_to_landing_page,
			cost_eur: spend.clicks_to_landing_page
				? spend.spend_eur / spend.clicks_to_landing_page : null,
			note: "LinkedIn-attributed site clicks" },
		{ stage: "site_events_linkedin_attr", count: liEvents.length,
			cost_eur: liEvents.length ? spend.spend_eur / liEvents.length : null,
			note: "datalake web events w/ linkedin referrer or utm" },
		{ stage: "site_sessions_linkedin_attr", count: liSessions.size,
			cost_eur: liSessions.size ? spend.spend_eur / liSessions.size : null,
			note: "unique sessions" },
		{ stage: "conversions_site", count: liConversions,
			cost_eur: liConversions ? spend.spend_eur / liConversions : null,
			note: "contact/lead/signup events from LI traffic" },
		{ stage: "leads", count: spend.leads + paidLeads,
			cost_eur: (spend.leads + paidLeads) ? spend.spend_eur / (spend.leads + paidLeads) : null,
			note: "LI lead forms + SocialAuto leads" },
		{ stage: "spend_total_eur", count: Number(spend.spend_eur.toFixed(2)),
			cost_eur: null, note: "all report types" },
	].map((r) => ({
		...r,
		cost_eur: r.cost_eur === null ? null : Number(r.cost_eur.toFixed(2)),
	}));
}

function appflowyActivity(workspaces, users) {
	const w = workspaces || [];
	const u = users || [];
	const members = w.reduce((acc, row) => acc + (Number(row.member_count) || 0), 0);
	return [
		{ metric: "workspaces", value: w.length },
		{ metric: "users", value: u.length },
		{ metric: "member_seats", value: members },
	];
}

function rfmChurn(rfmRows, churnRows) {
	const churnByEmail = new Map();
	for (const row of churnRows || []) {
		const email = String(row.email ?? "")
			.toLowerCase()
			.trim();
		if (!email) continue;
		churnByEmail.set(email, row);
	}

	const seen = new Set();
	const out = [];
	for (const row of rfmRows || []) {
		const email = String(row.email ?? "")
			.toLowerCase()
			.trim();
		if (!email) continue;
		seen.add(email);
		const churn = churnByEmail.get(email);
		out.push({
			email,
			recency_days: Number(row.recency_days) || 0,
			frequency: Number(row.frequency) || 0,
			monetary: Number(row.monetary) || 0,
			rfm_score: Number(row.rfm_score) || 0,
			last_purchase_at: String(row.last_purchase_at ?? ""),
			churn_score: churn ? Number(churn.churn_score) || 0 : null,
			risk_band: churn ? String(churn.risk_band ?? "") : "",
		});
	}

	for (const [email, churn] of churnByEmail) {
		if (seen.has(email)) continue;
		out.push({
			email,
			recency_days: Number(churn.recency_days) || 0,
			frequency: null,
			monetary: null,
			rfm_score: null,
			last_purchase_at: "",
			churn_score: Number(churn.churn_score) || 0,
			risk_band: String(churn.risk_band ?? ""),
		});
	}

	return out.sort((a, b) => (Number(b.monetary) || 0) - (Number(a.monetary) || 0));
}

async function buildFreshness(keys) {
	const { r2Head } = await import("./_r2-config.mjs");
	const sources = {};
	for (const key of keys) {
		try {
			const head = await r2Head(key);
			sources[key] = {
				exists: head.exists,
				last_etl_at: head.lastModified,
				size: head.size,
			};
		} catch {
			sources[key] = { exists: false, last_etl_at: null, size: null };
		}
	}
	return sources;
}

async function main() {
	console.log(`Materializing datalake snapshot → R2://${BUCKET}/${SNAPSHOT_KEY}`);
	const sections = [];
	const gsc = await safeParquet("lake/gsc-keywords/keywords.parquet");
	const gscCountry = await safeParquet("lake/gsc-countries/countries.parquet");
	const gscDevice = await safeParquet("lake/gsc-devices/devices.parquet");
	sections.push(
		gsc ? sectionOk("top_keywords", topKeywords(gsc)) : sectionErr("top_keywords", "missing gsc parquet")
	);
	sections.push(
		gsc ? sectionOk("top_pages", topPages(gsc)) : sectionErr("top_pages", "missing gsc parquet")
	);
	sections.push(
		gsc
			? sectionOk("gsc_query_pages", gscQueryPages(gsc))
			: sectionErr("gsc_query_pages", "missing gsc parquet")
	);
	sections.push(
		gscCountry
			? sectionOk("gsc_countries", gscCountries(gscCountry))
			: sectionErr("gsc_countries", "missing gsc countries parquet")
	);
	sections.push(
		gscDevice
			? sectionOk("gsc_devices", gscDevices(gscDevice))
			: sectionErr("gsc_devices", "missing gsc devices parquet")
	);

	if (gsc) {
		const reports = gscWeeklyReports(gsc, gscCountry ?? [], gscDevice ?? []);
		const kw = topKeywords(gsc);
		const totalClicks = reports.reduce((a, r) => a + r.clicks, 0);
		const totalImpr = reports.reduce((a, r) => a + r.impressions, 0);
		const seoGold = {
			generated_at: new Date().toISOString(),
			snapshot: {
				clicks: totalClicks,
				impressions: totalImpr,
				ctr: totalImpr > 0 ? Math.round((10000 * totalClicks) / totalImpr) / 100 : 0,
				avgPosition:
					reports.length > 0
						? Math.round((reports.reduce((a, r) => a + r.avgPosition, 0) / reports.length) * 10) /
							10
						: 0,
				organicKeywords: kw.length,
			},
			keywords: kw.slice(0, 20).map((k) => ({
				keyword: k.query,
				clicks: k.clicks,
				impressions: k.impressions,
				ctr: Math.round(k.ctr * 10000) / 100,
				position: k.avg_position,
			})),
			reports,
		};
		await putJson(GSC_WEEKLY_KEY, seoGold);
		console.log(`✅ Wrote GSC weekly/SEO gold snapshot → ${GSC_WEEKLY_KEY}`);
	}

	const sentry = await safeParquet("lake/sentry-issues/issues.parquet");
	sections.push(
		sentry ? sectionOk("top_errors", topErrors(sentry)) : sectionErr("top_errors", "missing sentry parquet")
	);
	const saAdDaily = await safeJson("lake/socialauto-ads/daily.json");
	const saAdSnaps = await safeJson("lake/socialauto-ads/snapshots.json");
	const saAdDemo = await safeJson("lake/socialauto-ads/demographics.json");
	const apiAdDemo = await safeParquet("lake/linkedin-ads/demographics.parquet");
	const linkedin = await safeParquet("lake/linkedin-ads/insights.parquet");
	// Prefer report ground truth (socialauto-ads JSON); API parquet is the
	// fallback while LinkedIn Marketing API OAuth is revoked.
	sections.push(
		saAdDaily?.length || saAdSnaps?.length
			? sectionOk("linkedin_ads", linkedinAdsTruth(saAdDaily, saAdSnaps))
			: linkedin
				? sectionOk("linkedin_ads", linkedinSummary(linkedin))
				: sectionErr("linkedin_ads", "missing linkedin ad data")
	);
	const apiDemoRows = saAdDemo ? null : apiDemoToSegments(apiAdDemo);
	sections.push(
		saAdDemo
			? sectionOk("linkedin_ads_audience", linkedinAdsAudience(saAdDemo))
			: apiDemoRows
				? sectionOk("linkedin_ads_audience", linkedinAdsAudience(apiDemoRows))
				: sectionErr("linkedin_ads_audience", "missing ad demographics json")
	);
	const contacts = await safeParquet("lake/espocrm-contacts/contacts.parquet");
	const opportunities = await safeParquet("lake/espocrm-opportunities/opportunities.parquet");
	const funnel = espocrmFunnel(contacts, opportunities);
	sections.push(
		funnel ? sectionOk("espocrm_funnel", funnel) : sectionErr("espocrm_funnel", "missing espocrm parquet")
	);

	const tx = await safeParquet("lake/transactions/transactions.parquet");
	sections.push(
		tx ? sectionOk("stripe_revenue", stripeRevenue(tx)) : sectionErr("stripe_revenue", "missing stripe parquet")
	);

	// D1 hot-overlay sections — materialized so batch insights and the
	// dashboard cold path see them; the live D1 overlay still wins at serve
	// time when AUTH_DB is bound.
	try {
		const acq = await acquisitionFunnelD1();
		sections.push(
			acq === null
				? sectionErr("acquisition_funnel", "missing CLOUDFLARE_API_TOKEN for D1 overlay")
				: sectionOk("acquisition_funnel", acq)
		);
	} catch (error) {
		sections.push(sectionErr("acquisition_funnel", String(error)));
	}
	try {
		const attr = await attributionD1();
		sections.push(
			attr === null
				? sectionErr("attribution", "missing CLOUDFLARE_API_TOKEN for D1 overlay")
				: sectionOk("attribution", attr)
		);
	} catch (error) {
		sections.push(sectionErr("attribution", String(error)));
	}

	const n8nWf = await safeParquet("lake/n8n-workflows/workflows.parquet");
	const n8nEx = await safeParquet("lake/n8n-executions/executions.parquet");
	sections.push(
		n8nWf || n8nEx
			? sectionOk("n8n_ops", n8nOps(n8nWf, n8nEx))
			: sectionErr("n8n_ops", "missing n8n parquet")
	);

	const postizPosts = await safeParquet("lake/postiz-posts/posts.parquet");
	const postizInt = await safeParquet("lake/postiz-integrations/integrations.parquet");
	sections.push(
		postizPosts || postizInt
			? sectionOk("postiz_ops", postizOps(postizPosts, postizInt))
			: sectionErr("postiz_ops", "missing postiz parquet")
	);

	// ── SocialAuto lake tables (JSON written by datalake_export Celery task)
	const saAccounts = await safeJson("lake/socialauto-accounts/accounts.json");
	const saPosts = await safeJson("lake/socialauto-posts/posts.json");
	const saLeads = await safeJson("lake/socialauto-leads/leads.json");
	const saWebEvents = await safeJson("lake/socialauto-web-events/events.json");

	let saInsights = null;
	try {
		const insightKeys = await r2List("lake/socialauto-insights/");
		const candidates = [];
		for (const key of insightKeys.filter((k) => k.endsWith(".json"))) {
			const j = await safeJson(key);
			if (j) candidates.push(j);
		}
		saInsights = richestInsights(candidates);
	} catch (error) {
		console.warn(`  skip socialauto-insights: ${String(error).slice(0, 160)}`);
	}

	sections.push(
		saAccounts || saPosts
			? sectionOk("socialauto_ops", socialautoOps(saAccounts, saPosts))
			: sectionErr("socialauto_ops", "missing socialauto json")
	);
	sections.push(
		saInsights
			? sectionOk("social_engagement", socialEngagement(saInsights))
			: sectionErr("social_engagement", "missing socialauto insights")
	);
	sections.push(
		saInsights
			? sectionOk("social_outliers", socialOutliers(saInsights))
			: sectionErr("social_outliers", "missing socialauto insights")
	);
	sections.push(
		saInsights
			? sectionOk("social_recommendations", socialRecommendations(saInsights))
			: sectionErr("social_recommendations", "missing socialauto insights")
	);
	sections.push(
		saLeads
			? sectionOk("social_leads", socialLeads(saLeads))
			: sectionErr("social_leads", "missing socialauto leads json")
	);
	sections.push(
		saWebEvents
			? sectionOk("social_attribution", socialAttribution(saWebEvents))
			: sectionErr("social_attribution", "missing socialauto web-events json")
	);
	sections.push(
		saAdDaily
			? sectionOk("ads_funnel", adsFunnel(saAdDaily, saWebEvents, saLeads))
			: sectionErr("ads_funnel", "missing socialauto ads json")
	);

	const afWs = await safeParquet("lake/appflowy-workspaces/workspaces.parquet");
	const afUsers = await safeParquet("lake/appflowy-users/users.parquet");
	sections.push(
		afWs || afUsers
			? sectionOk("appflowy_activity", appflowyActivity(afWs, afUsers))
			: sectionErr("appflowy_activity", "missing appflowy parquet")
	);

	const rfm = await safeParquet("ml-parquet/scores_rfm.parquet");
	const churn = await safeParquet("ml-parquet/scores_churn.parquet");
	sections.push(
		rfm || churn
			? sectionOk("rfm_churn", rfmChurn(rfm, churn))
			: sectionErr("rfm_churn", "missing rfm/churn parquet")
	);

	const freshnessKeys = [
		"lake/gsc-keywords/keywords.parquet",
		"lake/gsc-countries/countries.parquet",
		"lake/gsc-devices/devices.parquet",
		"lake/transactions/transactions.parquet",
		"lake/sentry-issues/issues.parquet",
		"lake/linkedin-ads/insights.parquet",
		"lake/espocrm-contacts/contacts.parquet",
		"lake/n8n-workflows/workflows.parquet",
		"lake/postiz-posts/posts.parquet",
		"lake/socialauto-accounts/accounts.json",
		"lake/socialauto-posts/posts.json",
		"lake/socialauto-post-metrics/metrics.json",
		"lake/socialauto-followers/followers.json",
		"lake/socialauto-account-events/events.json",
		"lake/socialauto-leads/leads.json",
		"lake/socialauto-web-events/events.json",
		"lake/socialauto-ads/snapshots.json",
		"lake/socialauto-ads/daily.json",
		"lake/socialauto-ads/demographics.json",
		"lake/linkedin-ads/demographics.parquet",
		"lake/appflowy-workspaces/workspaces.parquet",
		"ml-parquet/scores_rfm.parquet",
		"ml-parquet/scores_churn.parquet",
		"lake/clients/clients.parquet",
	];
	const sources = await buildFreshness(freshnessKeys);
	const freshnessRows = Object.entries(sources).map(([key, meta]) => ({
		source: key,
		exists: meta.exists ? 1 : 0,
		last_etl_at: meta.last_etl_at,
		size: meta.size,
	}));
	sections.push(sectionOk("freshness", freshnessRows));

	const payload = {
		generated_at: new Date().toISOString(),
		cache: "cloudflare",
		sections,
		freshness: { generated_at: new Date().toISOString(), sources },
	};
	await putJson(SNAPSHOT_KEY, payload);
	await putJson("lake/snapshots/freshness.json", payload.freshness);
	console.log(`✅ Wrote snapshot with ${sections.length} sections`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
