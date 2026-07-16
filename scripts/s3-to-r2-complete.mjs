/**
 * Complete S3 to R2 Migration Script
 * 1. Fetches CLOUDFLARE_API_TOKEN from AWS SSM
 * 2. Clears the target R2 bucket (cloudless-assets) - 5000 objects to delete
 * 3. Migrates S3 static assets to R2 (~4876 objects)
 */

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";

const REGION = "us-east-1";
const ACCOUNT_ID = "fb7dc7b69b662480cd5961a4d1913c78";
const R2_BUCKET = "cloudless-assets";
const S3_BUCKET = "cloudless-production-cloudlesssiteassetsbucket-sasvvhra";

const ssm = new SSMClient({ region: REGION });
const s3 = new S3Client({ region: REGION });

let apiToken = null;

// MIME type mapping
const mimeTypes = {
  css: "text/css",
  js: "application/javascript",
  json: "application/json",
  html: "text/html",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  woff2: "font/woff2",
  woff: "font/woff",
  ico: "image/x-icon",
  map: "application/json",
};

async function getApiToken() {
  if (apiToken) return apiToken;
  const response = await ssm.send(new GetParameterCommand({
    Name: "/cloudless/production/CLOUDFLARE_API_TOKEN",
    WithDecryption: true,
  }));
  apiToken = response.Parameter?.Value;
  return apiToken;
}

// List all R2 objects
async function listAllR2Objects() {
  const token = await getApiToken();
  const allObjects = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects?per_page=1000&page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();

    if (!data.success) break;
    allObjects.push(...(data.result || []));

    if (!data.result_info?.is_truncated) break;
    page++;
  }

  return allObjects.map((obj) => obj.key);
}

// Delete objects from R2 in batches
async function deleteR2Objects(keys) {
  const token = await getApiToken();
  console.log(`🧹 Deleting ${keys.length} objects from R2 bucket...`);

  // Delete one by one (R2 API doesn't support batch delete)
  for (let i = 0; i < keys.length; i++) {
    try {
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(keys[i])}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if ((i + 1) % 100 === 0) {
        console.log(`   Deleted ${i + 1}/${keys.length} objects`);
      }
    } catch (error) {
      console.error(`   Failed to delete ${keys[i]}`);
    }
  }

  console.log(`✅ Deleted ${keys.length} objects from R2 bucket ${R2_BUCKET}`);
  return keys.length;
}

// List S3 objects
async function listS3Objects(bucket, prefix = "") {
  const keys = [];
  let continuationToken;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
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

// Upload to R2 via wrangler
async function uploadToR2(key, buffer, contentType) {
  const tempDir = await mkdtemp(`${tmpdir()}/migrate-s3-`);
  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  const tempFile = `${tempDir}/${safeKey}`;

  const { writeFile, unlink } = await import("fs/promises");
  await writeFile(tempFile, buffer);

  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    await execAsync(
      `npx wrangler r2 object put "${R2_BUCKET}/${key}" --file "${tempFile}" --content-type "${contentType}" --cache-control "public, max-age=31536000, immutable" --remote`
    );
  } finally {
    await unlink(tempFile).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function migrateS3ToR2(prefix) {
  console.log(`\n📥 Scanning s3://${S3_BUCKET}/${prefix}...`);

  const keys = await listS3Objects(S3_BUCKET, prefix);
  console.log(`   Found ${keys.length} S3 objects`);

  if (keys.length === 0) {
    console.log(`⚠️ No files to migrate`);
    return 0;
  }

  console.log(`📤 Migrating to R2...`);

  let migrated = 0;
  let errors = 0;

  for (const key of keys) {
    try {
      const response = await s3.send(
        new GetObjectCommand({ Bucket: S3_BUCKET, Key: key })
      );
      const buffer = await streamToBuffer(response.Body);
      const ext = key.split(".").pop()?.toLowerCase().split("?")[0] || "";
      const contentType = mimeTypes[ext] || "application/octet-stream";

      // Remove _assets/ prefix for R2 key
      const r2Key = key.startsWith("_assets/") ? key.replace("_assets/", "") : key;

      await uploadToR2(r2Key, buffer, contentType);
      migrated++;

      if (migrated % 50 === 0) {
        console.log(`   Progress: ${migrated}/${keys.length} files migrated`);
      }
    } catch (error) {
      errors++;
      if (errors <= 3) console.error(`   Error uploading ${key}: ${error.message}`);
    }
  }

  console.log(`✅ Migrated ${migrated} objects (${errors} errors)`);
  return migrated;
}

async function main() {
  console.log("🚀 Starting S3 to R2 migration...\n");

  // Step 1: Clear R2 bucket
  console.log("=== Step 1: Clearing R2 bucket ===");
  const r2Keys = await listAllR2Objects();
  if (r2Keys.length > 0) {
    await deleteR2Objects(r2Keys);
  } else {
    console.log("   ℹ️ R2 bucket is already empty");
  }

  // Step 2: Migrate S3 assets
  console.log("\n=== Step 2: Migrating Static Assets ===");
  await migrateS3ToR2("_assets/_next/static/");

  // Check for other assets
  const allAssets = await listS3Objects(S3_BUCKET, "_assets/");
  const staticKeys = await listS3Objects(S3_BUCKET, "_assets/_next/static/");
  const otherAssets = allAssets.filter((k) => !k.startsWith("_assets/_next/static/"));

  if (otherAssets.length > 0) {
    console.log("\n=== Step 3: Migrating Other Assets ===");
    await migrateS3ToR2("_assets/");
  }

  console.log("\n🎉 Migration complete!");
  console.log("\n📋 Next steps:");
  console.log("1. Verify: curl https://cloudless.gr/_next/static/chunks/*.js");
  console.log("2. Deploy: npx wrangler deploy --config wrangler-cloudflare-free.json");
}

main().catch(console.error);