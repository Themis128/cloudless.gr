/**
 * ETL: D1 Users + Portals + RFM scores → unified clients table in R2.
 *
 * Migrated from Cognito to D1-based auth (Cloudflare-first).
 * Reads users from D1 user table, merges with pending clients, portals, and ML scores.
 */

import { ParquetWriter, ParquetReader, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { BUCKET, r2Put, r2Get } from "./_r2-config.mjs";

const AUTH_DB_URL = process.env.AUTH_DB_URL || "http://localhost:8787/api/config";
const TMP = "/tmp/clients.parquet";

const schema = new ParquetSchema({
	user_id: { type: "UTF8" },
	email: { type: "UTF8" },
	name: { type: "UTF8", optional: true },
	company: { type: "UTF8", optional: true },
	phone: { type: "UTF8", optional: true },
	plan: { type: "UTF8", optional: true },
	plan_label: { type: "UTF8", optional: true },
	portal_status: { type: "UTF8", optional: true },
	portal_token: { type: "UTF8", optional: true },
	signup_date: { type: "UTF8", optional: true },
	last_login: { type: "UTF8", optional: true },
	email_verified: { type: "BOOLEAN", optional: true },
	cognito_status: { type: "UTF8", optional: true },
	hubspot_id: { type: "UTF8", optional: true },
	country: { type: "UTF8", optional: true },
	source: { type: "UTF8", optional: true },
	rfm_score: { type: "DOUBLE", optional: true },
	churn_risk: { type: "DOUBLE", optional: true },
	lifetime_value: { type: "DOUBLE", optional: true },
});

/**
 * D1 HTTP client for fetching users from the auth database.
 * Uses Cloudflare D1 REST API with CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.
 */
async function queryD1(sql, params = []) {
	const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || process.env.CF_ACCOUNT_ID?.trim();
	const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
	const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim() || process.env.AUTH_D1_DATABASE_ID?.trim() || "7ca74513-23c3-412a-b9ca-b0c55835973d";

	if (!account || !token) {
		throw new Error("D1 HTTP: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not configured");
	}

	const url = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${databaseId}/query`;
	const res = await globalThis.fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ sql, params }),
	});

	const body = await res.json();
	if (!res.ok || body.success === false) {
		const msg = body.errors?.map(e => e.message).filter(Boolean).join("; ") || res.statusText;
		throw new Error(`D1 HTTP query failed (${res.status}): ${msg}`);
	}

	const first = body.result?.[0];
	if (!first) {
		throw new Error("D1 HTTP query returned no result payload");
	}
	return first;
}

async function listD1Users() {
	const sql = `
		SELECT
			u.id as user_id,
			u.email,
			u.name,
			u.company,
			u.phone,
			u.preferences_json,
			u.created_at,
			u.updated_at,
			CASE WHEN r.role = 'admin' THEN 'admin' ELSE 'user' END AS role,
			json_extract(u.preferences_json, '$.email_verified') as email_verified,
			json_extract(u.preferences_json, '$.disabled') as disabled
		FROM user u
		LEFT JOIN user_role r ON r.user_id = u.id AND r.role = 'admin'
		ORDER BY u.created_at DESC
	`;

	const result = await queryD1(sql);
	const rows = result.results || [];

	return rows.map(u => {
		const prefs = u.preferences_json ? JSON.parse(u.preferences_json) : {};
		return {
			user_id: u.user_id,
			email: u.email,
			name: u.name,
			company: u.company,
			phone: u.phone,
			email_verified: prefs.email_verified === true || prefs.email_verified === "true",
			disabled: prefs.disabled === true || prefs.disabled === "true",
			signup_date: u.created_at ? new Date(u.created_at * 1000).toISOString() : null,
			last_login: u.updated_at ? new Date(u.updated_at * 1000).toISOString() : null,
			cognito_status: u.disabled ? "disabled" : "confirmed", // Map D1 status to legacy field
		};
	});
}

async function loadConfigFromD1(key) {
	// Map SSM keys to D1 config keys
	const keyMap = {
		"/cloudless/PENDING_CLIENTS_JSON": "pending_clients",
		"/cloudless/CLIENT_PORTALS_JSON": "client_portals",
	};

	const configKey = keyMap[key] || key.replace("/cloudless/", "");

	try {
		const res = await fetch(`${AUTH_DB_URL}?key=${encodeURIComponent(configKey)}`);
		if (!res.ok) {
			// Fallback to env var if D1 endpoint fails (for CI/testing)
			const envData = process.env[configKey.toUpperCase().replace(/-/g, "_")];
			if (envData) return JSON.parse(envData);
			return [];
		}
		const json = await res.json();
		return json.value ? JSON.parse(json.value) : [];
	} catch (err) {
		console.warn(`[etl/clients] D1 config ${key} unavailable:`, err?.name || err?.message || "unknown");
		return [];
	}
}

async function loadScores(key) {
	let dir;
	try {
		const buf = await r2Get(key);
		dir = mkdtempSync(join(tmpdir(), "scores-"));
		const tmp = join(dir, "data.parquet");
		writeFileSync(tmp, buf);
		const reader = await ParquetReader.openFile(tmp);
		const cursor = reader.getCursor();
		const rows = [];
		let row;
		while ((row = await cursor.next())) rows.push(row);
		await reader.close();
		return rows;
	} catch (err) {
		// ML scores files (scores_rfm.parquet, scores_churn.parquet) are produced
		// by a separate ML pipeline. They may be missing on a fresh env, in which
		// case the clients table just lands without rfm/churn columns populated.
		// Log + continue rather than fail the whole ETL.
		console.warn(`[etl/clients] scores ${key} unavailable:`, err?.name || err?.message || "unknown");
		return [];
	} finally {
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
}

async function main() {
	console.log("Loading D1 users...");
	const d1Users = await listD1Users();
	console.log(`  ${d1Users.length} users`);

	console.log("Loading pending clients...");
	const pending = await loadConfigFromD1("/cloudless/PENDING_CLIENTS_JSON");
	const pendingMap = new Map(pending.map(p => [p.email?.toLowerCase(), p]));

	console.log("Loading portals...");
	const portals = await loadConfigFromD1("/cloudless/CLIENT_PORTALS_JSON");
	const portalMap = new Map(portals.map(p => [p.clientEmail?.toLowerCase(), p]));

	console.log("Loading ML scores...");
	const rfmScores = await loadScores("ml-parquet/scores_rfm.parquet");
	const churnScores = await loadScores("ml-parquet/scores_churn.parquet");
	if (rfmScores.length === 0 || churnScores.length === 0) {
		console.warn(
			"[etl/clients] RFM/churn parquet empty or missing — clients will land without scores. " +
				"Run compute-rfm-churn-to-r2.mjs after stripe-to-r2.mjs (workflow etl-compute-rfm-to-r2)."
		);
	}
	const rfmMap = new Map(rfmScores.map(r => [r.email?.toLowerCase() || r.user_id, r]));
	const churnMap = new Map(churnScores.map(r => [r.email?.toLowerCase() || r.user_id, r]));

	const writer = await ParquetWriter.openFile(schema, TMP);
	for (const u of d1Users) {
		const email = u.email.toLowerCase();
		const p = pendingMap.get(email);
		const portal = portalMap.get(email);
		const rfm = rfmMap.get(email) || rfmMap.get(u.user_id);
		const churn = churnMap.get(email) || churnMap.get(u.user_id);

		await writer.appendRow({
			user_id: u.user_id,
			email: u.email,
			name: u.name,
			company: u.company,
			phone: u.phone,
			plan: p?.plan || null,
			plan_label: p?.planLabel || null,
			portal_status: portal ? "approved" : p?.status || "none",
			portal_token: portal?.token || p?.portalToken || null,
			signup_date: u.signup_date,
			last_login: u.last_login,
			email_verified: u.email_verified,
			cognito_status: u.cognito_status,
			hubspot_id: null,
			country: null,
			source: null,
			rfm_score: rfm?.score ?? rfm?.rfm_score ?? null,
			churn_risk: churn?.score ?? churn?.churn_score ?? null,
			lifetime_value: rfm?.monetary ?? rfm?.lifetime_value ?? null,
		});
	}
	await writer.close();

	const body = readFileSync(TMP);
	await r2Put("lake/clients/clients.parquet", body);
	unlinkSync(TMP);
	console.log(`✅ Uploaded ${d1Users.length} clients → R2://${BUCKET}/lake/clients/clients.parquet`);
}

main().catch(e => { console.error(e); process.exit(1); });