/**
 * R2 helpers for ETL scripts — aws4fetch (no @aws-sdk/client-s3).
 * Path-style: https://{accountId}.r2.cloudflarestorage.com/{bucket}/{key}
 */
import { AwsClient } from "aws4fetch";

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.CF_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY =
  process.env.CF_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

export const BUCKET = process.env.ANALYTICS_BUCKET || "datalake-bucket";

function requireCreds() {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      "Missing R2 credentials. Set CLOUDFLARE_ACCOUNT_ID (or CF_ACCOUNT_ID), CF_R2_ACCESS_KEY_ID, and CF_R2_SECRET_ACCESS_KEY. " +
        "See https://developers.cloudflare.com/r2/api/s3-api/"
    );
  }
}

/** @returns {AwsClient} */
export function getR2Client() {
  requireCreds();
  return new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
}

/** @deprecated use getR2Client — kept name for transitional imports */
export function getS3Client() {
  return getR2Client();
}

export function r2ObjectUrl(key, bucket = BUCKET) {
  requireCreds();
  const encoded = String(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${encoded}`;
}

/**
 * @param {string} key
 * @param {Buffer|Uint8Array|string|Blob} body
 * @param {{ contentType?: string, bucket?: string }} [opts]
 */
export async function r2Put(key, body, opts = {}) {
  const client = getR2Client();
  const bucket = opts.bucket || BUCKET;
  const contentType = opts.contentType || "application/octet-stream";
  const res = await client.fetch(r2ObjectUrl(key, bucket), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 PUT ${bucket}/${key} → ${res.status}: ${text.slice(0, 300)}`);
  }
}

/**
 * @param {string} key
 * @param {{ bucket?: string }} [opts]
 * @returns {Promise<Buffer>}
 */
export async function r2Get(key, opts = {}) {
  const client = getR2Client();
  const bucket = opts.bucket || BUCKET;
  const res = await client.fetch(r2ObjectUrl(key, bucket), { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 GET ${bucket}/${key} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * @param {string} key
 * @param {{ bucket?: string }} [opts]
 * @returns {Promise<{ exists: boolean, lastModified: string | null, size: number | null }>}
 */
export async function r2Head(key, opts = {}) {
  const client = getR2Client();
  const bucket = opts.bucket || BUCKET;
  const res = await client.fetch(r2ObjectUrl(key, bucket), { method: "HEAD" });
  if (res.status === 404) {
    return { exists: false, lastModified: null, size: null };
  }
  if (!res.ok) {
    throw new Error(`R2 HEAD ${bucket}/${key} → ${res.status}`);
  }
  const lastModified = res.headers.get("last-modified");
  const sizeRaw = res.headers.get("content-length");
  return {
    exists: true,
    lastModified: lastModified ? new Date(lastModified).toISOString() : null,
    size: sizeRaw ? Number(sizeRaw) : null,
  };
}

/**
 * Soft medallion schema contracts — required parquet columns per lake key.
 * Used by validate-lake-contracts.mjs after materialize.
 */
export const LAKE_SCHEMA_CONTRACTS = {
  "lake/transactions/transactions.parquet": [
    "transaction_id",
    "email",
    "type",
    "status",
    "amount_cents",
    "currency",
    "created_at",
  ],
  "lake/gsc-keywords/keywords.parquet": [
    "query",
    "page",
    "clicks",
    "impressions",
    "ctr",
    "position",
  ],
  "lake/gsc-countries/countries.parquet": [
    "country",
    "clicks",
    "impressions",
    "ctr",
    "position",
  ],
  "lake/gsc-devices/devices.parquet": ["device", "clicks", "impressions", "ctr", "position"],
  "lake/sentry-issues/issues.parquet": ["issue_id", "title", "level", "status", "count_14d"],
  "lake/linkedin-ads/insights.parquet": ["campaign_id", "day", "impressions", "clicks", "spend"],
  "lake/espocrm-contacts/contacts.parquet": ["contact_id", "email"],
  "lake/espocrm-opportunities/opportunities.parquet": ["opportunity_id", "stage", "amount"],
  "lake/clients/clients.parquet": ["user_id", "email"],
  "lake/n8n-workflows/workflows.parquet": ["workflow_id", "name", "active"],
  "lake/n8n-executions/executions.parquet": ["execution_id", "status"],
  "lake/postiz-posts/posts.parquet": ["post_id", "state"],
  "lake/appflowy-workspaces/workspaces.parquet": ["workspace_id"],
  "ml-parquet/scores_rfm.parquet": ["email", "rfm_score"],
  "ml-parquet/scores_churn.parquet": ["email", "churn_score"],
};
