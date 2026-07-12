/**
 * ETL: AppFlowy Cloud → R2 Data Lake (Parquet) — postgres-direct edition
 *
 * Migrated version using R2 S3-compatible endpoint.
 * Same logic as appflowy-to-lake.mjs - only client configuration differs.
 */

import { execSync } from "node:child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";
import { getS3Client, BUCKET } from "./_r2-config.mjs";

// R2 S3-compatible client (uses shared config helper)
const s3 = getS3Client();

// `kubectl exec` into the postgres pod and run a psql query
function psqlRows(sql) {
	const podCmd =
		"kubectl -n appflowy get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}'";
	const pod = execSync(podCmd, { encoding: "utf8" }).trim();
	if (!pod) throw new Error("no postgres pod found in appflowy namespace");

	const wrappedSql = `SELECT coalesce(json_agg(t)::text, '[]') FROM (${sql.replace(/;\s*$/, "")}) t`;
	const escaped = wrappedSql.replace(/'/g, "'\\''");
	const out = execSync(
		`kubectl -n appflowy exec ${pod} -- bash -c "PGPASSWORD=\\$POSTGRES_PASSWORD psql -h 127.0.0.1 -U postgres -d postgres -tAq -c '${escaped}'"`,
		{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
	);
	const trimmed = out.trim();
	if (!trimmed || trimmed === "\\N" || trimmed === "[]") return [];
	return JSON.parse(trimmed);
}

const workspaceSchema = new ParquetSchema({
	workspace_id: { type: "UTF8" },
	workspace_name: { type: "UTF8", optional: true },
	owner_uid: { type: "INT64", optional: true },
	workspace_type: { type: "INT32", optional: true },
	member_count: { type: "INT32", optional: true },
	created_at: { type: "UTF8", optional: true },
});

const userSchema = new ParquetSchema({
	uid: { type: "INT64" },
	uuid: { type: "UTF8", optional: true },
	email: { type: "UTF8", optional: true },
	name: { type: "UTF8", optional: true },
	created_at: { type: "UTF8", optional: true },
});

async function writeParquet(rows, schema, localPath) {
	const writer = await ParquetWriter.openFile(schema, localPath);
	for (const row of rows) await writer.appendRow(row);
	await writer.close();
	return readFileSync(localPath);
}

async function uploadToR2(key, body) {
	await s3.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: key,
			Body: body,
			ContentType: "application/octet-stream",
		})
	);
	console.log(`✓ uploaded R2://${BUCKET}/${key} (${body.length} bytes)`);
}

async function syncWorkspaces() {
	const rows = psqlRows(`
    SELECT w.workspace_id::text, w.workspace_name,
           w.owner_uid, w.workspace_type,
           (SELECT count(*) FROM af_workspace_member m WHERE m.workspace_id = w.workspace_id)::int AS member_count,
           to_char(w.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
    FROM af_workspace w
    WHERE w.deleted_at IS NULL
    ORDER BY w.created_at
  `).map((w) => ({
		workspace_id: String(w.workspace_id ?? ""),
		workspace_name: String(w.workspace_name ?? ""),
		owner_uid: Number(w.owner_uid ?? 0),
		workspace_type: Number(w.workspace_type ?? 0),
		member_count: Number(w.member_count ?? 0),
		created_at: String(w.created_at ?? ""),
	}));
	const local = "/tmp/appflowy-workspaces.parquet";
	const body = await writeParquet(rows, workspaceSchema, local);
	await uploadToR2("lake/appflowy-workspaces/workspaces.parquet", body);
	unlinkSync(local);
	console.log(`workspaces: ${rows.length}`);
}

async function syncUsers() {
	const rows = psqlRows(`
    SELECT uid,
           uuid::text,
           email, name,
           to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
    FROM af_user
    WHERE deleted_at IS NULL
    ORDER BY uid
  `).map((u) => ({
		uid: Number(u.uid ?? 0),
		uuid: String(u.uuid ?? ""),
		email: String(u.email ?? ""),
		name: String(u.name ?? ""),
		created_at: String(u.created_at ?? ""),
	}));
	const local = "/tmp/appflowy-users.parquet";
	const body = await writeParquet(rows, userSchema, local);
	await uploadToR2("lake/appflowy-users/users.parquet", body);
	unlinkSync(local);
	console.log(`users: ${rows.length}`);
}

await syncWorkspaces();
await syncUsers();
console.log("✓ AppFlowy → R2 sync complete (postgres-direct)");