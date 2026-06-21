/**
 * ETL: AppFlowy Cloud → S3 Data Lake (Parquet)
 *
 * Pulls workspace + user metadata from the self-hosted AppFlowy Cloud
 * (Notion replacement) via its REST API. Two parquet files:
 *
 *   lake/appflowy-workspaces/workspaces.parquet
 *   lake/appflowy-users/users.parquet
 *
 * Auth: short-lived service-role JWT signed with APPFLOWY_JWT_SECRET
 * (same value as cluster Secret appflowy-secrets/GOTRUE_JWT_SECRET).
 * See src/lib/appflowy.ts for the JWT signing approach this mirrors.
 *
 * Runs daily via .github/workflows/etl-selfhosted-to-lake.yml.
 * Full-refresh — counts are well under 1k records.
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";
import { createHmac } from "node:crypto";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.ANALYTICS_BUCKET || "cloudless-analytics-data";
const BASE = (process.env.APPFLOWY_API_URL || "").replace(/\/$/, "");
const SECRET = process.env.APPFLOWY_JWT_SECRET;

if (!BASE || !SECRET) {
  console.error("APPFLOWY_API_URL and APPFLOWY_JWT_SECRET are required");
  process.exit(1);
}

const s3 = new S3Client({ region: REGION });

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function mintServiceJwt() {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: "",
    role: "supabase_admin",
    iss: "cloudless-appflowy-etl",
    iat: now,
    exp: now + 600,
  };
  const head = b64url(JSON.stringify(header));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", SECRET).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

async function afFetch(path) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${mintServiceJwt()}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AppFlowy ${path} returned ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
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
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/octet-stream",
    })
  );
  console.log(`✓ uploaded s3://${BUCKET}/${key} (${body.length} bytes)`);
}

async function syncWorkspaces() {
  const data = await afFetch("/admin/workspace").catch((e) => {
    console.warn("/admin/workspace failed:", e.message);
    return { data: [] };
  });
  const rows = (data.data || []).map((w) => ({
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
  const data = await afFetch("/admin/user").catch((e) => {
    console.warn("/admin/user failed:", e.message);
    return { data: [] };
  });
  const rows = (data.data || []).map((u) => ({
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
console.log("✓ AppFlowy → S3 sync complete");
