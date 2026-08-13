/**
 * ETL: Google Search Console → R2 Data Lake (Parquet)
 *
 * Migrated version using R2 S3-compatible endpoint.
 * Same logic as gsc-to-lake.mjs - only client configuration differs.
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

const schema = new ParquetSchema({
	query: { type: "UTF8" },
	page: { type: "UTF8" },
	clicks: { type: "INT32" },
	impressions: { type: "INT32" },
	ctr: { type: "DOUBLE" },
	position: { type: "DOUBLE" },
	start_date: { type: "UTF8" },
	end_date: { type: "UTF8" },
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

async function writeEmptyAndExit(reason) {
	console.warn(`[gsc-to-r2] ${reason} — writing empty parquet and exiting 0.`);
	const tmp = "/tmp/gsc-keywords-empty.parquet";
	const writer = await ParquetWriter.openFile(schema, tmp);
	await writer.close();
	await r2Put("lake/gsc-keywords/keywords.parquet", readFileSync(tmp), {
		contentType: "application/octet-stream",
	});
	unlinkSync(tmp);
	console.log("✓ gsc → R2 sync complete (empty — skip)");
	process.exit(0);
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

	const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
	const body = {
		startDate: fmt(start),
		endDate: fmt(end),
		dimensions: ["query", "page"],
		rowLimit: 25_000,
		dataState: "all",
	};
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
		await writeEmptyAndExit(`GSC ${res.status}: ${t.slice(0, 160)}`);
	}
	const data = await res.json();
	const rows = (data.rows || []).map((r) => ({
		query: r.keys?.[0] ?? "(unknown)",
		page: r.keys?.[1] ?? "(unknown)",
		clicks: r.clicks || 0,
		impressions: r.impressions || 0,
		ctr: r.ctr || 0,
		position: r.position || 0,
		start_date: fmt(start),
		end_date: fmt(end),
	}));
	console.log(`  ${rows.length} keyword-page rows`);

	const tmp = "/tmp/gsc-keywords.parquet";
	const writer = await ParquetWriter.openFile(schema, tmp);
	for (const r of rows) await writer.appendRow(r);
	await writer.close();

	await r2Put("lake/gsc-keywords/keywords.parquet", readFileSync(tmp), {
		contentType: "application/octet-stream",
	});
	unlinkSync(tmp);
	console.log(`✅ Uploaded ${rows.length} rows → R2://${BUCKET}/lake/gsc-keywords/`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
