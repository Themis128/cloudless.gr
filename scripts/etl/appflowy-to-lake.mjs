/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEPRECATED — use `appflowy-to-r2.mjs` instead.
 *
 * This legacy version uses AWS S3 for storage.
 * The migrated version (`appflowy-to-r2.mjs`) reads config from D1 via
 * the /api/config endpoint and writes to R2-compatible storage.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ETL: AppFlowy Cloud → S3 Data Lake (Parquet) — postgres-direct edition
 *
 * REVISED 2026-06-21: switched from REST `/admin/*` (which returned 0 rows
 * because the admin endpoints aren't publicly exposed on the AC version
 * we run) to direct postgres queries against the cluster's appflowy
 * namespace via `kubectl exec`.
 *
 * Two parquet files:
 *
 *   lake/appflowy-workspaces/workspaces.parquet
 *   lake/appflowy-users/users.parquet
 *
 * Auth: tailscale connects the runner to the tailnet, then KUBECONFIG_B64
 * (the same kubeconfig used by cluster-doctor / prometheus-tune workflows)
 * gives system:admin access to exec into the postgres pod.
 *
 * Runs daily via .github/workflows/etl-selfhosted-to-lake.yml.
 */

import { BUCKET, r2Put } from "./_r2-config.mjs";
import { execSync } from "node:child_process";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";

const REGION = process.env.AWS_REGION || "us-east-1";


// `kubectl exec` into the postgres pod and run a psql query, returning
// the rows as an array of objects. The pod name varies, so we resolve it
// dynamically via the app=postgres label.
function psqlRows(sql) {
  const podCmd =
    "kubectl -n appflowy get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}'";
  const pod = execSync(podCmd, { encoding: "utf8" }).trim();
  if (!pod) throw new Error("no postgres pod found in appflowy namespace");

  // Plain SELECT with json_agg + -tAq returns the JSON value raw — no COPY
  // text-format escaping of embedded newlines/quotes (which broke JSON.parse
  // when COPY emitted `\n` literally between rows in the array). Cast to text
  // so psql treats it as a single value and doesn't apply json-type pretty
  // printing.
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

async function uploadToS3(key, body) {
  await r2Put(key, body, { contentType: "application/octet-stream" });
  console.log(`✓ uploaded s3://${BUCKET}/${key} (${body.length} bytes)`);
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
  await uploadToS3("lake/appflowy-workspaces/workspaces.parquet", body);
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
  await uploadToS3("lake/appflowy-users/users.parquet", body);
  unlinkSync(local);
  console.log(`users: ${rows.length}`);
}

await syncWorkspaces();
await syncUsers();
console.log("✓ AppFlowy → S3 sync complete (postgres-direct)");
