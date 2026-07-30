/**
 * Complete S3 to R2 Migration Script
 * 1. Fetches CLOUDFLARE_API_TOKEN from AWS SSM
 * 2. Clears the target R2 bucket (cloudless-assets) 
 * 3. Migrates S3 static assets to R2
 */

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";

const execAsync = promisify(exec);

// AWS Configuration
const REGION = "us-east-1";
const ssm = new SSMClient({ region: REGION });
const s3 = new S3Client({ region: REGION });

// R2 Configuration
const ACCOUNT_ID = "fb7dc7b69b662480cd5961a4d1913c78";
const R2_BUCKET = "cloudless-assets";
const S3_BUCKET = "cloudless-production-cloudlesssiteassetsbucket-sasvvhra";

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

let apiToken = null;

/**
 * Get API token from SSM or environment
 */
async function getApiToken() {
  if (apiToken) return apiToken;
  
  // Try environment first
  apiToken = process.env.CLOUDFLARE_API_TOKEN;
  
  if (!apiToken) {
    // Fetch from SSM
    try {
      const response = await ssm.send(new GetParameterCommand({
        Name: "/cloudless/production/CLOUDFLARE_API_TOKEN",
        WithDecryption: true,
      }));
      apiToken = response.Parameter?.Value;
    } catch (error) {
      console.error("❌ Could not fetch CLOUDFLARE_API_TOKEN from SSM:", error.message);
      process.exit(1);
    }
  }
  
  return apiToken;
}

/**
 * List all objects in R2 bucket via Cloudflare API
 */
async function listR2Objects(page = 1, token) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects?page=${page}&per_page=1000`,
    {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.json();
}

/**
 * Delete object from R2 via Cloudflare API
 */
async function deleteR2Object(key, token) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`,
    {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    }
  );
  return response.json();
}

/**
 * Clear all objects from R2 bucket
 */
async function clearR2Bucket() {
  const token = await getApiToken();
  console.log(`🧹 Clearing R2 bucket: ${R2_BUCKET}...\n`);
  
  let totalDeleted = 0;
  let page = 1;

  while (true) {
    const data = await listR2Objects(page, token);
    
    if (!data.success) {
      console.error("❌ API Error:", data.errors);
      if (data.errors?.[0]?.code === 9109) {
        console.log("   ℹ️ Bucket appears empty or access denied - proceeding with migration");
        break;
      }
      break;
    }

    const objects = data.result || [];
    
    if (objects.length === 0) {
      console.log(`   ℹ️ R2 bucket is empty`);
      break;
    }

    console.log(`   Found ${objects.length} objects on page ${page}...`);

    for (const obj of objects) {
      try {
        await deleteR2Object(obj.key, token);
        totalDeleted++;
        if (totalDeleted % 20 === 0) {
          console.log(`   Deleted ${totalDeleted} objects...`);
        }
      } catch (error) {
        console.error(`   Failed to delete ${obj.key}`);
      }
    }

    const totalPages = data.result_info?.total_pages || 1;
    if (page >= totalPages) break;
    page++;
  }

  console.log(`\n✅ Cleared ${totalDeleted} objects from R2 bucket`);
  return totalDeleted;
}

/**
 * List objects in S3 bucket
 */
async function listS3Objects(bucket, prefix = "") {
  const keys = [];
  let continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await s3.send(command);
    
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) keys.push(obj.Key);
      }
    }
    
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

/**
 * Stream to buffer helper
 */
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Migrate objects from S3 to R2 using wrangler CLI
 */
async function migrateS3ToR2(prefix = "") {
  console.log(`\n📥 Scanning s3://${S3_BUCKET}/${prefix}...`);
  
  const keys = await listS3Objects(S3_BUCKET, prefix);
  console.log(`   Found ${keys.length} objects`);

  if (keys.length === 0) {
    console.log(`⚠️ No files to migrate`);
    return 0;
  }

  console.log(`📤 Migrating to R2 bucket ${R2_BUCKET}...`);
  
  let migrated = 0;
  let errors = 0;
  
  for (const key of keys) {
    const getCommand = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });
    
    const response = await s3.send(getCommand);
    const body = response.Body;
    
    if (body) {
      const buffer = await streamToBuffer(body);
      const ext = key.split(".").pop()?.toLowerCase().split("?")[0] || "";
      const contentType = mimeTypes[ext] || "application/octet-stream";
      
      // Remove _assets/ prefix for R2 key
      const r2Key = key.startsWith("_assets/") ? key.replace("_assets/", "") : key;
      
      const tempDir = await mkdtemp(`${tmpdir()}/migrate-s3-`);
      const safeKey = r2Key.replace(/[^a-zA-Z0-9._-]/g, "_");
      const tempFile = `${tempDir}/${safeKey}`;
      await writeFile(tempFile, buffer);
      
      try {
        await execAsync(
          `npx wrangler r2 object put "${R2_BUCKET}/${r2Key}" --file "${tempFile}" --content-type "${contentType}" --cache-control "public, max-age=31536000, immutable" --remote 2>&1 | grep -v "^$"`
        );
        migrated++;
        if (migrated % 50 === 0) {
          console.log(`   Progress: ${migrated}/${keys.length} files migrated`);
        }
      } catch (e) {
        errors++;
        if (errors <= 3) {
          console.error(`   Error uploading ${key}`);
        }
      } finally {
        await unlink(tempFile).catch(() => {});
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
  
  console.log(`✅ Migrated ${migrated} objects (${errors} errors)`);
  return migrated;
}

async function main() {
  console.log("🚀 Starting S3 to R2 migration...\n");

  // Step 1: Clear R2 bucket
  await clearR2Bucket();

  // Step 2: Migrate S3 assets to R2
  console.log("\n=== Migrating Static Assets ===");
  await migrateS3ToR2("_assets/_next/static/");
  
  // Migrate other assets
  const otherAssets = await listS3Objects(S3_BUCKET, "_assets/");
  const staticKeys = await listS3Objects(S3_BUCKET, "_assets/_next/static/");
  const nonStaticCount = otherAssets.filter(k => !k.startsWith("_assets/_next/static/")).length;
  
  if (nonStaticCount > 0) {
    console.log("\n=== Migrating Other Assets ===");
    await migrateS3ToR2("_assets/");
  }

  console.log("\n🎉 Migration complete!");
  console.log("\n📋 Next steps:");
  console.log("1. Verify: curl https://cloudless.gr/_next/static/chunks/*.js");
  console.log("2. Deploy: npx wrangler deploy --config wrangler-cloudflare-free.json");
}

main().catch(console.error);