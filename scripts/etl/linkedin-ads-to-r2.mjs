/**
 * ETL: LinkedIn Ads → R2 Data Lake (Parquet)
 *
 * Migrated version using R2 S3-compatible endpoint.
 * Resolves token from environment variable only (LINKEDIN_ACCESS_TOKEN).
 * SSM has been removed — use GitHub Actions secrets or Wrangler secrets.
 */

import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";
import { BUCKET, r2Put } from "./_r2-config.mjs";

const ACCOUNT = process.env.LINKEDIN_AD_ACCOUNT_ID || "512642510";

/**
 * Resolve the LinkedIn access token from environment variable.
 * Token should be set via LINKEDIN_ACCESS_TOKEN env var (GitHub secret / Wrangler secret).
 */
function resolveToken() {
	const token =
		process.env.LINKEDIN_ACCESS_TOKEN || process.env.LINKEDIN_CAPI_ACCESS_TOKEN;
	if (!token) {
		console.error(
			"LINKEDIN_ACCESS_TOKEN (or LINKEDIN_CAPI_ACCESS_TOKEN) not available"
		);
		process.exit(1);
	}
	return token;
}

const TOKEN = resolveToken();

const LI_BASE = "https://api.linkedin.com/rest";
const LI_HEADERS = {
	Authorization: `Bearer ${TOKEN}`,
	"LinkedIn-Version": "202605",
	"X-Restli-Protocol-Version": "2.0.0",
};

const schema = new ParquetSchema({
	campaign_id: { type: "UTF8" },
	campaign_name: { type: "UTF8", optional: true },
	day: { type: "UTF8" },
	impressions: { type: "INT64" },
	clicks: { type: "INT32" },
	ctr: { type: "DOUBLE" },
	spend: { type: "DOUBLE" },
	currency: { type: "UTF8" },
	conversions: { type: "INT32" },
	cost_per_click: { type: "DOUBLE" },
	cost_per_thousand_impressions: { type: "DOUBLE" },
	account_id: { type: "UTF8" },
});

// Professional-demographic report — one row per pivot value. Mirrors
// Campaign Manager's "Demographics" tab. Per LinkedIn docs these queries
// MUST run at account level with timeGranularity=ALL (top-100 values per
// pivot; sub-3-event values are suppressed; daily noise otherwise).
const demoSchema = new ParquetSchema({
	pivot: { type: "UTF8" }, // e.g. MEMBER_JOB_TITLE
	pivot_value: { type: "UTF8" }, // raw URN (urn:li:title:35) or literal (SIZE_2_TO_10)
	pivot_label: { type: "UTF8", optional: true }, // resolved display name when available
	impressions: { type: "INT64" },
	clicks: { type: "INT32" },
	spend: { type: "DOUBLE" },
	conversions: { type: "INT32" },
	account_id: { type: "UTF8" },
	window_start: { type: "UTF8" },
	window_end: { type: "UTF8" },
});

// Verified live 2026-09-27: these five return data on the Cloudless app;
// MEMBER_COUNTRY is rejected (400) on this access tier.
const DEMOGRAPHIC_PIVOTS = [
	"MEMBER_JOB_TITLE",
	"MEMBER_SENIORITY",
	"MEMBER_INDUSTRY",
	"MEMBER_COMPANY_SIZE",
	"MEMBER_JOB_FUNCTION",
];

// Legacy v2 batch lookups that still resolve URN→name for this app.
// Others (seniorities, functions, companySizes) 404 — label stays null and
// downstream joins on pivot_value.
const URN_RESOLVERS = {
	"urn:li:title:": "/v2/titles",
	"urn:li:industry:": "/v2/industries",
};

async function liFetch(path) {
	const res = await fetch(`${LI_BASE}${path}`, { headers: LI_HEADERS });
	if (!res.ok) {
		const t = await res.text().catch(() => "");
		throw new Error(`LinkedIn ${res.status} on ${path}: ${t.slice(0, 300)}`);
	}
	return res.json();
}

async function listCampaigns() {
	const path = `/adAccounts/${ACCOUNT}/adCampaigns?q=search&search=(status:(values:List(ACTIVE,PAUSED,COMPLETED)))`;
	const data = await liFetch(path);
	return (data.elements || []).map((c) => ({
		id: String(c.id),
		name: c.name || null,
	}));
}

async function dailyInsights(campaignId, start, end) {
	const sp = `(year:${start.getUTCFullYear()},month:${start.getUTCMonth() + 1},day:${start.getUTCDate()})`;
	const ep = `(year:${end.getUTCFullYear()},month:${end.getUTCMonth() + 1},day:${end.getUTCDate()})`;
	const path = `/adAnalytics?q=analytics&pivot=CREATIVE&timeGranularity=DAILY&campaigns=List(urn%3Ali%3AsponsoredCampaign%3A${campaignId})&dateRange=(start:${sp},end:${ep})&fields=dateRange,impressions,clicks,costInLocalCurrency,externalWebsiteConversions`;
	try {
		const data = await liFetch(path);
		return data.elements || [];
	} catch (err) {
		console.warn(`  campaign ${campaignId} insights failed:`, err.message?.slice(0, 100));
		return [];
	}
}

function fmtDay(dr) {
	const s = dr?.start;
	if (!s) return "";
	return `${s.year}-${String(s.month).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`;
}

function fmtYmd(d) {
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// v2 endpoints live on api.linkedin.com root, not /rest.
async function liFetchV2(path) {
	const res = await fetch(`https://api.linkedin.com${path}`, { headers: LI_HEADERS });
	if (!res.ok) return null;
	return res.json();
}

/** Fetch one demographic pivot at account level (docs: ALL granularity). */
async function demographicReport(pivot, start, end) {
	const sp = `(year:${start.getUTCFullYear()},month:${start.getUTCMonth() + 1},day:${start.getUTCDate()})`;
	const ep = `(year:${end.getUTCFullYear()},month:${end.getUTCMonth() + 1},day:${end.getUTCDate()})`;
	const path =
		`/adAnalytics?q=analytics&pivot=${pivot}&timeGranularity=ALL` +
		`&dateRange=(start:${sp},end:${ep})` +
		`&accounts=List(urn%3Ali%3AsponsoredAccount%3A${ACCOUNT})` +
		`&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,pivotValues`;
	try {
		const data = await liFetch(path);
		return data.elements || [];
	} catch (err) {
		console.warn(`  pivot ${pivot} failed:`, err.message?.slice(0, 100));
		return [];
	}
}

/** Batch-resolve urn:li:{type}:{id} → localized name where the v2 lookup exists. */
async function resolveUrns(urns) {
	const labels = new Map();
	const byEndpoint = new Map();
	for (const u of urns) {
		for (const [prefix, ep] of Object.entries(URN_RESOLVERS)) {
			if (u.startsWith(prefix)) {
				const id = u.slice(prefix.length);
				if (!byEndpoint.has(ep)) byEndpoint.set(ep, new Map());
				byEndpoint.get(ep).set(id, u);
				break;
			}
		}
	}
	for (const [ep, idMap] of byEndpoint) {
		const ids = [...idMap.keys()];
		for (let i = 0; i < ids.length; i += 50) {
			const chunk = ids.slice(i, i + 50);
			const data = await liFetchV2(`${ep}?ids=List(${chunk.join(",")})`);
			for (const [id, rec] of Object.entries(data?.results || {})) {
				const name = rec?.name?.localized?.en_US || rec?.name?.localized?.[Object.keys(rec?.name?.localized || {})[0]];
				if (name && idMap.has(id)) labels.set(idMap.get(id), name);
			}
		}
	}
	return labels;
}

async function main() {
	console.log(`Fetching LinkedIn campaigns for account ${ACCOUNT}...`);
	let campaigns;
	try {
		campaigns = await listCampaigns();
	} catch (err) {
		const msg = String(err?.message ?? err);
		if (/\b401\b|INVALID_ACCESS_TOKEN|Unauthorized/i.test(msg)) {
			console.warn(
				`[linkedin-ads-to-r2] auth failed (${msg.slice(0, 160)}) — writing empty parquet and exiting 0. Rotate LINKEDIN_ACCESS_TOKEN.`
			);
			for (const [file, sch] of [
				["insights.parquet", schema],
				["demographics.parquet", demoSchema],
			]) {
				const local = `/tmp/linkedin-ads-empty-${file}`;
				const writer = await ParquetWriter.openFile(sch, local);
				await writer.close();
				await r2Put(`lake/linkedin-ads/${file}`, readFileSync(local), {
					contentType: "application/octet-stream",
				});
				unlinkSync(local);
			}
			console.log("✓ linkedin-ads → R2 sync complete (empty — auth skip)");
			return;
		}
		throw err;
	}
	console.log(`  ${campaigns.length} campaigns`);

	const end = new Date();
	const start = new Date(end.getTime() - 90 * 86_400_000);

	const rows = [];
	for (const c of campaigns) {
		const insights = await dailyInsights(c.id, start, end);
		for (const r of insights) {
			const day = fmtDay(r.dateRange);
			const spend = Number(r.costInLocalCurrency ?? 0);
			const impressions = BigInt(r.impressions || 0);
			const clicks = r.clicks || 0;
			rows.push({
				campaign_id: c.id,
				campaign_name: c.name,
				day,
				impressions,
				clicks,
				ctr: r.impressions > 0 ? clicks / Number(impressions) : 0,
				spend,
				currency: "EUR",
				conversions: r.externalWebsiteConversions || 0,
				cost_per_click: clicks > 0 ? spend / clicks : 0,
				cost_per_thousand_impressions: r.impressions > 0 ? (spend / Number(impressions)) * 1000 : 0,
				account_id: ACCOUNT,
			});
		}
	}
	console.log(`  ${rows.length} (campaign × day) rows`);

	const tmp = "/tmp/linkedin-ads.parquet";
	const writer = await ParquetWriter.openFile(schema, tmp);
	for (const r of rows) await writer.appendRow(r);
	await writer.close();

	await r2Put("lake/linkedin-ads/insights.parquet", readFileSync(tmp), { contentType: "application/octet-stream" });
	unlinkSync(tmp);
	console.log(`✅ Uploaded ${rows.length} rows → R2://${BUCKET}/lake/linkedin-ads/`);

	// ── Professional demographics (r_ads_reporting) ────────────────────────
	// Feeds the linkedin_ads_audience gold section — replaces the manual
	// Campaign Manager CSV import path for audience segmentation.
	const demoRows = [];
	for (const pivot of DEMOGRAPHIC_PIVOTS) {
		const els = await demographicReport(pivot, start, end);
		console.log(`  ${pivot}: ${els.length} segments`);
		for (const el of els) {
			for (const pv of el.pivotValues || []) {
				demoRows.push({
					pivot,
					pivot_value: String(pv),
					pivot_label: null, // resolved below
					impressions: BigInt(el.impressions || 0),
					clicks: el.clicks || 0,
					spend: Number(el.costInLocalCurrency ?? 0),
					conversions: el.externalWebsiteConversions || 0,
					account_id: ACCOUNT,
					window_start: fmtYmd(start),
					window_end: fmtYmd(end),
				});
			}
		}
	}
	if (demoRows.length) {
		const labels = await resolveUrns([...new Set(demoRows.map((r) => r.pivot_value))]);
		for (const r of demoRows) r.pivot_label = labels.get(r.pivot_value) || null;
		console.log(`  resolved ${labels.size} segment names`);
	}
	const demoTmp = "/tmp/linkedin-ads-demographics.parquet";
	const demoWriter = await ParquetWriter.openFile(demoSchema, demoTmp);
	for (const r of demoRows) await demoWriter.appendRow(r);
	await demoWriter.close();
	await r2Put("lake/linkedin-ads/demographics.parquet", readFileSync(demoTmp), {
		contentType: "application/octet-stream",
	});
	unlinkSync(demoTmp);
	console.log(`✅ Uploaded ${demoRows.length} demographic rows → lake/linkedin-ads/demographics.parquet`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
