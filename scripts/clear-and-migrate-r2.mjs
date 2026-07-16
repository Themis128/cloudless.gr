/**
 * Clear R2 Bucket and Migrate S3 Content
 * 
 * 1. Clears all objects from the target R2 bucket (cloudless-assets)
 * 2. Migrates S3 static assets to R2
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { config } from "dotenv";

config();

const execAsync = promisify(exec);

const REGION = "us-east-1";
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

/**
 * List all objects in R2 bucket using Cloudflare S3 API
 */
async function listR2Objects(bucket, accountToken) {
  const endpoint = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  
  // Use AWS SDK with R2 endpoint
  const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  
  const r2Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: "dummy",
      secretAccessKey: accountToken || process.env.CLOUDFLARE_API_TOKEN,
    },
  });

  const keys = [];
  let continuationToken;

  do {
    try {
      const response = await r2Client.send(new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }));

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) keys.push(obj.Key);
        }
      }
      
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } catch (error) {
      console.error(`   Warning: Could not list R2 bucket ${bucket}:`, error.message);
      break;
    }
  } while (continuationToken);

  return keys;
}

/**
 * Delete all objects from R2 bucket
 */
async function clearR2Bucket(bucket) {
  console.log(`🧹 Clearing R2 bucket: ${bucket}...`);
  
  const endpoint = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
  
  const r2Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: "dummy",
      secretAccessKey: process.env.CLOUDFLARE_API_TOKEN,
    },
  });

  const keysToDelete = [];
  let continuationToken;

  // List all objects in batches of 1000
  do {
    try {
      const response = await r2Client.send(new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }));

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            keysToDelete.push({ Key: obj.Key });
          }
        }
      }
      
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } catch (error) {
      console.error(`   Error listing objects in R2 bucket ${bucket}:`, error.message);
      break;
    }
  } while (continuationToken);

  if (keysToDelete.length === 0) {
    console.log(`   ℹ️ R2 bucket ${bucket} is empty or cannot be accessed`);
    return 0;
  }

  console.log(`   Found ${keysToDelete.length} objects to delete...`);

  // Delete in batches of 1000 (S3 API limit)
  let totalDeleted = 0;
  for (let i = 0; i < keysToDelete.length; i += 1000) {
    const batch = keysToDelete.slice(i, i + 1000);
    try {
      const response = await r2Client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch,
          Quiet: true,
        },
      }));
      totalDeleted += response.Deleted?.length || batch.length;
      console.log(`   Deleted ${totalDeleted}/${keysToDelete.length} objects`);
    } catch (error) {
      console.error(`   Error deleting batch:`, error.message);
    }
  }

  console.log(`✅ Cleared ${totalDeleted} objects from R2 bucket ${bucket}`);
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
 * Migrate objects from S3 to R2
 */
async function migrateS3ToR2(s3Bucket, r2Bucket, prefix = "") {
  console.log(`\n📥 Scanning s3://${s3Bucket}/${prefix}...`);
  
  const keys = await listS3Objects(s3Bucket, prefix);
  console.log(`   Found ${keys.length} objects`);

  if (keys.length === 0) {
    console.log(`⚠️ No files to migrate for prefix ${prefix}`);
    return 0;
  }

  console.log(`📤 Migrating to R2 bucket ${r2Bucket}...`);
  
  let migrated = 0;
  let errors = 0;
  
  for (const key of keys) {
    const getCommand = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: key,
    });
    
    const response = await s3.send(getCommand);
    const body = response.Body;
    
    if (body) {
      const buffer = await streamToBuffer(body);
      const ext = key.split(".").pop()?.toLowerCase().split("?")[0] || "";
      const contentType = mimeTypes[ext] || "application/octet-stream";
      
      // Remove _assets/ prefix if present for R2
      const r2Key = key.startsWith("_assets/") ? key.replace("_assets/", "") : key;
      
      const tempDir = await mkdtemp(`${tmpdir()}/migrate-s3-`);
      const safeKey = r2Key.replace(/[^a-zA-Z0-9._-]/g, "_");
      const tempFile = `${tempDir}/${safeKey}`;
      await writeFile(tempFile, buffer);
      
      try {
        await execAsync(
          `npx wrangler r2 object put "${r2Bucket}/${r2Key}" --file "${tempFile}" --content-type "${contentType}" --cache-control "public, max-age=31536000, immutable" --remote`
        );
        migrated++;
        if (migrated % 100 === 0) {
          console.log(`   Progress: ${migrated}/${keys.length} files migrated`);
        }
      } catch (e) {
        errors++;
        if (errors <= 5) {
          console.error(`   Error uploading ${key}: ${e.message.trim()}`);
        }
      } finally {
        await unlink(tempFile).catch(() => {});
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
  
  console.log(`✅ Migrated ${migrated} objects to ${r2Bucket} (${errors} errors)`);
  return migrated;
}

async function main() {
  console.log("🚀 Starting S3 to R2 migration with clear...\n");

  // Step 1: Clear the R2 bucket
  await clearR2Bucket(R2_BUCKET);

  // Step 2: Migrate S3 assets to R2
  console.log("\n=== Migrating Static Assets ===");
  await migrateS3ToR2(S3_BUCKET, R2_BUCKET, "_assets/_next/static/");
  
  // Migrate other assets if needed
  const totalAssets = await listS3Objects(S3_BUCKET, "_assets/");
  const staticCount = await listS3Objects(S3_BUCKET, "_assets/_next/static/");
  const otherCount = totalAssets.length - staticCount.length;
  
  if (otherCount > 0) {
    console.log("\n=== Migrating Other Assets ===");
    await migrateS3ToR2(S3_BUCKET, R2_BUCKET, "_assets/");
  }

  console.log("\n🎉 Migration complete!");
  console.log("\n📋 Next steps:");
  console.log("1. Verify assets: curl https://cloudless.gr/_next/static/chunks/*.js");
  console.log("2. Deploy: npx wrangler deploy --config wrangler-cloudflare-free.json");
}

main().catch(console.error);