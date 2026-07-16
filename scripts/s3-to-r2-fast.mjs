/**
 * Fast S3 to R2 Migration Script with Parallel Processing
 * - Clears R2 bucket using concurrent DELETE requests
 * - Migrates S3 to R2 using concurrent uploads
 */

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, unlink, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";

const REGION = "us-east-1";
const ACCOUNT_ID = "fb7dc7b69b662480cd5961a4d1913c78";
const R2_BUCKET = "cloudless-assets";
const S3_BUCKET = "cloudless-production-cloudlesssiteassetsbucket-sasvvhra";

const ssm = new SSMClient({ region: REGION });
const s3 = new S3Client({ region: REGION });

let apiToken = null;

async function getApiToken() {
  if (apiToken) return apiToken;
  const response = await ssm.send(new GetParameterCommand({
    Name: "/cloudless/production/CLOUDFLARE_API_TOKEN",
    WithDecryption: true,
  }));
  apiToken = response.Parameter?.Value;
  return apiToken;
}

// MIME types
const mimeTypes = {
  css: "text/css", js: "application/javascript", json: "application/json",
  html: "text/html", svg: "image/svg+xml", png: "image/png",
  jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", woff2: "font/woff2", woff: "font/woff",
  ico: "image/x-icon", map: "application/json",
};

// Clear R2 bucket concurrently
async function clearR2Bucket() {
  const token = await getApiToken();
  console.log(`🧹 Clearing R2 bucket ${R2_BUCKET}...\n`);

  // Get all object keys
  const keys = [];
  let cursor = null;

  while (true) {
    const url = cursor
      ? `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects?cursor=${encodeURIComponent(cursor)}&per_page=1000`
      : `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects?per_page=1000`;

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json();

    if (!data.success) {
      console.log("   ℹ️ Bucket appears empty or access denied");
      break;
    }

    for (const obj of data.result || []) {
      keys.push(obj.key);
    }

    if (!data.result_info?.is_truncated) break;
    cursor = data.result_info.cursor;
  }

  console.log(`   Found ${keys.length} objects to delete\n`);

  // Delete in parallel batches of 20
  const concurrency = 20;
  for (let i = 0; i < keys.length; i += concurrency) {
    const batch = keys.slice(i, i + concurrency);
    await Promise.all(
      batch.map((key) =>
        fetch(
          `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => null)
      )
    );
    console.log(`   Deleted ${Math.min(i + concurrency, keys.length)}/${keys.length} objects`);
  }

  console.log(`\n✅ Cleared ${keys.length} objects from R2 bucket`);
}

// List S3 objects
async function listS3Objects(prefix) {
  const keys = [];
  let continuationToken;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) keys.push(obj.Key);
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

// Stream to buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Upload to R2 using wrangler
async function uploadToR2(r2Key, buffer, contentType) {
  const tempDir = await mkdtemp(`${tmpdir()}/migrate-`);
  const safeKey = r2Key.replace(/[^a-zA-Z0-9._-]/g, "_");
  const tempFile = `${tempDir}/${safeKey}`;
  await writeFile(tempFile, buffer);

  const { exec } = await import("child_process");
  const { promisify } = await import("util");

  try {
    await promisify(exec)(
      `npx wrangler r2 object put "${R2_BUCKET}/${r2Key}" --file "${tempFile}" --content-type "${contentType}" --cache-control "public, max-age=31536000, immutable" --remote`
    );
  } finally {
    await unlink(tempFile).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Migrate S3 to R2
async function migrateS3ToR2(prefix) {
  const keys = await listS3Objects(prefix);
  console.log(`📥 Found ${keys.length} objects in s3://${S3_BUCKET}/${prefix}`);

  if (keys.length === 0) return 0;

  console.log(`📤 Migrating with 10 concurrent uploads...\n`);

  let migrated = 0;
  const concurrency = 10;

  for (let i = 0; i < keys.length; i += concurrency) {
    const batch = keys.slice(i, i + concurrency);

    await Promise.all(
      batch.map(async (key) => {
        try {
          const response = await s3.send(
            new GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
          );
          const buffer = await streamToBuffer(response.Body);
          const ext = key.split(".").pop()?.toLowerCase().split("?")[0] || "";
          const contentType = mimeTypes[ext] || "application/octet-stream";
          const r2Key = key.startsWith("_assets/") ? key.replace("_assets/", "") : key;

          await uploadToR2(r2Key, buffer, contentType);
          return 1;
        } catch {
          return 0;
        }
      })
    ).then((results) => {
      migrated += results.reduce((a, b) => a + b, 0);
    });

    console.log(`   Progress: ${migrated}/${keys.length} files migrated`);
  }

  console.log(`\n✅ Migrated ${migrated} objects (${keys.length - migrated} errors)`);
  return migrated;
}

async function main() {
  console.log("🚀 Starting S3 to R2 migration (fast mode)...\n");

  // Clear R2
  await clearR2Bucket();

  // Migrate S3 static assets
  console.log("\n=== Migrating Static Assets ===");
  await migrateS3ToR2("_assets/_next/static/");

  // Check for other assets
  const allAssets = await listS3Objects("_assets/");
  const staticKeys = await listS3Objects("_assets/_next/static/");
  const otherCount = allAssets.length - staticKeys.length;

  if (otherCount > 0) {
    console.log("\n=== Migrating Other Assets ===");
    await migrateS3ToR2("_assets/");
  }

  console.log("\n🎉 Migration complete!");
}

main().catch(console.error);