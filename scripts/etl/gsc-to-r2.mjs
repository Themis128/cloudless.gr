/**
 * ETL: Google Search Console → R2 Data Lake (Parquet)
 *
 * Writes:
 *   lake/gsc-keywords/keywords.parquet  — dimensions [query, page]
 *   lake/gsc-countries/countries.parquet — dimensions [country]
 *   lake/gsc-devices/devices.parquet     — dimensions [device]
 *
 * Auth (preferred): GOOGLE_SERVICE_ACCOUNT_JSON_B64 = base64(entire SA JSON)
 * Fallback: GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (PEM with \\n OK)
 */

import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { SignJWT } from "jose";
import { readFileSync, unlinkSync } from "fs";
import { BUCKET, r2Put } from "./_r2-config.mjs";
import {
	loadGooglePrivateKey,
	resolveGoogleServiceAccountFromEnv,
} from "./_google-sa-key.mjs";

const SITE = process.env.GSC_SITE_URL || "https://cloudless.gr/";

let EMAIL = "";
let KEY_RAW = "";
try {
	const sa = resolveGoogleServiceAccountFromEnv();
	EMAIL = sa.email;
	KEY_RAW = sa.privateKeyRaw;
} catch (err) {
	console.error(String(err?.message ?? err));
	process.exit(1);
}

const metricsSchemaFields = {
	clicks: { type: "INT32" },
	impressions: { type: "INT32" },
	ctr: { type: "DOUBLE" },
	position: { type: "DOUBLE" },
	start_date: { type: "UTF8" },
	end_date: { type: "UTF8" },
};

const keywordsSchema = new ParquetSchema({
	query: { type: "UTF8" },
	page: { type: "UTF8" },
	...metricsSchemaFields,
});

const countrySchema = new ParquetSchema({
	country: { type: "UTF8" },
	...metricsSchemaFields,
});

const deviceSchema = new ParquetSchema({
	device: { type: "UTF8" },
	...metricsSchemaFields,
});

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

async function getAccessToken() {
	const now = Math.floor(Date.now() / 1000);
	const privateKey = loadGooglePrivateKey(KEY_RAW);
	const jwt = await new SignJWT({ iss: EMAIL, scope: SCOPE, aud: TOKEN_URL })
		.setProtectedHeader({ alg: "RS256" })
		.setIssuedAt(now)
		.setExpirationTime(now + 3600)
		.sign(privateKey);
	const res = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion: jwt,
		}),
	});
	if (!res.ok) throw new Error(`Google token exchange ${res.status}`);
	const data = await res.json();
	return data.access_token;
}

async function writeParquet(tmpPath, schema, rows, r2Key) {
	const writer = await ParquetWriter.openFile(schema, tmpPath);
	for (const r of rows) await writer.appendRow(r);
	await writer.close();
	await r2Put(r2Key, readFileSync(tmpPath), {
		contentType: "application/octet-stream",
	});
	unlinkSync(tmpPath);
}

async function writeEmptyAndExit(reason) {
	console.warn(`[gsc-to-r2] ${reason} — writing empty parquet(s) and exiting 0.`);
	await writeParquet("/tmp/gsc-keywords-empty.parquet", keywordsSchema, [], "lake/gsc-keywords/keywords.parquet");
	await writeParquet("/tmp/gsc-countries-empty.parquet", countrySchema, [], "lake/gsc-countries/countries.parquet");
	await writeParquet("/tmp/gsc-devices-empty.parquet", deviceSchema, [], "lake/gsc-devices/devices.parquet");
	console.log("✓ gsc → R2 sync complete (empty — skip)");
	process.exit(0);
}

async function queryGsc(token, body) {
	const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const t = await res.text().catch(() => "");
		throw new Error(`GSC ${res.status}: ${t.slice(0, 160)}`);
	}
	return res.json();
}

function metricFields(r, startDate, endDate) {
	return {
		clicks: r.clicks || 0,
		impressions: r.impressions || 0,
		ctr: r.ctr || 0,
		position: r.position || 0,
		start_date: startDate,
		end_date: endDate,
	};
}

async function main() {
	console.log(`Fetching GSC search analytics for ${SITE}...`);
	let token;
	try {
		token = await getAccessToken();
	} catch (err) {
		await writeEmptyAndExit(
			`auth/key failed (${String(err?.message ?? err).slice(0, 200)}). Prefer GOOGLE_SERVICE_ACCOUNT_JSON_B64.`
		);
	}

	const end = new Date();
	const start = new Date(end.getTime() - 90 * 86_400_000);
	const fmt = (d) => d.toISOString().slice(0, 10);
	const startDate = fmt(start);
	const endDate = fmt(end);
	const base = { startDate, endDate, dataState: "all" };

	let keywordData;
	try {
		keywordData = await queryGsc(token, {
			...base,
			dimensions: ["query", "page"],
			rowLimit: 25_000,
		});
	} catch (err) {
		await writeEmptyAndExit(String(err?.message ?? err));
	}

	const keywordRows = (keywordData.rows || []).map((r) => ({
		query: r.keys?.[0] ?? "(unknown)",
		page: r.keys?.[1] ?? "(unknown)",
		...metricFields(r, startDate, endDate),
	}));
	console.log(`  ${keywordRows.length} keyword-page rows`);

	let countryRows = [];
	try {
		const countryData = await queryGsc(token, {
			...base,
			dimensions: ["country"],
			rowLimit: 250,
		});
		countryRows = (countryData.rows || []).map((r) => ({
			country: r.keys?.[0] ?? "(unknown)",
			...metricFields(r, startDate, endDate),
		}));
		console.log(`  ${countryRows.length} country rows`);
	} catch (err) {
		console.warn(`[gsc-to-r2] country fetch failed: ${String(err?.message ?? err).slice(0, 160)}`);
	}

	let deviceRows = [];
	try {
		const deviceData = await queryGsc(token, {
			...base,
			dimensions: ["device"],
			rowLimit: 10,
		});
		deviceRows = (deviceData.rows || []).map((r) => ({
			device: r.keys?.[0] ?? "(unknown)",
			...metricFields(r, startDate, endDate),
		}));
		console.log(`  ${deviceRows.length} device rows`);
	} catch (err) {
		console.warn(`[gsc-to-r2] device fetch failed: ${String(err?.message ?? err).slice(0, 160)}`);
	}

	await writeParquet("/tmp/gsc-keywords.parquet", keywordsSchema, keywordRows, "lake/gsc-keywords/keywords.parquet");
	await writeParquet("/tmp/gsc-countries.parquet", countrySchema, countryRows, "lake/gsc-countries/countries.parquet");
	await writeParquet("/tmp/gsc-devices.parquet", deviceSchema, deviceRows, "lake/gsc-devices/devices.parquet");

	console.log(
		`✅ Uploaded keywords=${keywordRows.length} countries=${countryRows.length} devices=${deviceRows.length} → R2://${BUCKET}/lake/gsc-*`
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
