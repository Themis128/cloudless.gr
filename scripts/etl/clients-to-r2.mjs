/**
 * ETL: Cognito Users + Portals + RFM scores → unified clients table in R2.
 *
 * Migrated version using R2 S3-compatible endpoint.
 * Same logic as clients-to-lake.mjs - only client configuration differs.
 */

import { CognitoIdentityProviderClient, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { ParquetWriter, ParquetReader, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getS3Client, BUCKET } from "./_r2-config.mjs";

const REGION = process.env.AWS_REGION || "us-east-1";
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "us-east-1_1Bq3Mpqer";

const cognito = new CognitoIdentityProviderClient({ region: REGION });
const ssm = new SSMClient({ region: REGION });
// R2 S3-compatible client (uses shared config helper)
const s3 = getS3Client();
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

async function listCognitoUsers() {
	const users = [];
	let token = undefined;
	do {
		const res = await cognito.send(new ListUsersCommand({
			UserPoolId: USER_POOL_ID,
			Limit: 60,
			PaginationToken: token,
		}));
		for (const u of res.Users || []) {
			const attr = (name) => u.Attributes?.find(a => a.Name === name)?.Value;
			users.push({
				user_id: attr("sub") || u.Username,
				email: attr("email") || "",
				name: attr("name") || null,
				phone: attr("phone_number") || null,
				email_verified: attr("email_verified") === "true",
				cognito_status: u.UserStatus || null,
				signup_date: u.UserCreateDate?.toISOString() || null,
				last_login: u.UserLastModifiedDate?.toISOString() || null,
			});
		}
		token = res.PaginationToken;
	} while (token);
	return users;
}

async function loadSSMJson(key) {
	try {
		const res = await ssm.send(new GetParameterCommand({ Name: key }));
		return JSON.parse(res.Parameter?.Value || "[]");
	} catch (err) {
		console.warn(`[etl/clients] SSM ${key} unavailable:`, err?.name || err?.message || "unknown");
		return [];
	}
}

async function loadScores(key) {
	let dir;
	try {
		const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
		const buf = Buffer.from(await res.Body.transformToByteArray());
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
		console.warn(`[etl/clients] scores ${key} unavailable:`, err?.name || err?.message || "unknown");
		return [];
	} finally {
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
}

async function main() {
	console.log("Loading Cognito users...");
	const cognitoUsers = await listCognitoUsers();
	console.log(`  ${cognitoUsers.length} users`);

	console.log("Loading pending clients...");
	const pending = await loadSSMJson("/cloudless/PENDING_CLIENTS_JSON");
	const pendingMap = new Map(pending.map(p => [p.email?.toLowerCase(), p]));

	console.log("Loading portals...");
	const portals = await loadSSMJson("/cloudless/CLIENT_PORTALS_JSON");
	const portalMap = new Map(portals.map(p => [p.clientEmail?.toLowerCase(), p]));

	console.log("Loading ML scores...");
	const rfmScores = await loadScores("ml-parquet/scores_rfm.parquet");
	const rfmMap = new Map(rfmScores.map(r => [r.email?.toLowerCase() || r.user_id, r]));
	const churnScores = await loadScores("ml-parquet/scores_churn.parquet");
	const churnMap = new Map(churnScores.map(r => [r.email?.toLowerCase() || r.user_id, r]));

	const writer = await ParquetWriter.openFile(schema, TMP);
	for (const u of cognitoUsers) {
		const email = u.email.toLowerCase();
		const p = pendingMap.get(email);
		const portal = portalMap.get(email);
		const rfm = rfmMap.get(email) || rfmMap.get(u.user_id);
		const churn = churnMap.get(email) || churnMap.get(u.user_id);

		await writer.appendRow({
			user_id: u.user_id,
			email: u.email,
			name: u.name,
			company: null,
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
	await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: "lake/clients/clients.parquet", Body: body }));
	unlinkSync(TMP);
	console.log(`✅ Uploaded ${cognitoUsers.length} clients → R2://${BUCKET}/lake/clients/clients.parquet`);
}

main().catch(e => { console.error(e); process.exit(1); });