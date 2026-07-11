/**
 * S3 to R2 Migration Script
 * Migrates cloudless.gr static assets and analytics data to Cloudflare R2
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";

const execAsync = promisify(exec);

const REGION = "us-east-1";
const s3 = new S3Client({ region: REGION });

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
};

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

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function migrateBucket(s3Bucket, r2Bucket, prefixes) {
  const prefixArray = Array.isArray(prefixes) ? prefixes : [prefixes];
  
  for (const prefix of prefixArray) {
    console.log(`📥 Scanning s3://${s3Bucket}/${prefix}...`);
    
    const keys = await listS3Objects(s3Bucket, prefix);
    console.log(`   Found ${keys.length} objects`);

    if (keys.length === 0) {
      console.log(`⚠️ No files to migrate for prefix ${prefix}`);
      continue;
    }

    for (const key of keys) {
      console.log(`   Uploading: ${key}`);
      
      const getCommand = new GetObjectCommand({
        Bucket: s3Bucket,
        Key: key,
      });
      
      const response = await s3.send(getCommand);
      const body = response.Body;
      
      if (body) {
        const buffer = await streamToBuffer(body);
        const ext = key.split(".").pop()?.toLowerCase() || "";
        const contentType = mimeTypes[ext] || "application/octet-stream";
        
        // Create a unique temp directory to avoid race conditions and symlink attacks
        const tempDir = await mkdtemp(`${tmpdir()}/migrate-s3-to-r2-`);
        const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "_");
        const tempFile = `${tempDir}/${safeKey}`;
        await writeFile(tempFile, buffer);
        
        try {
          await execAsync(
            `npx wrangler r2 object put "${r2Bucket}/${key}" --file "${tempFile}" --content-type "${contentType}" --cache-control "public, max-age=31536000, immutable" --remote`
          );
        } catch (e) {
          console.error(`   Error uploading key:`, e.message);
        } finally {
          await unlink(tempFile).catch(() => {});
        }
      }
    }
    
    console.log(`✅ Migrated ${prefix}`);
  }
}

async function main() {
  console.log("🚀 Starting S3 to R2 migration...\n");

  await migrateBucket(
    "cloudless-production-cloudlesssiteassetsbucket-sasvvhra",
    "cloudless-assets",
    "_assets/"
  );

  await migrateBucket(
    "cloudless-analytics-data",
    "datalake-bucket",
    ["events/", "lake/", "athena-results/"]
  );

  console.log("\n🎉 Migration complete!");
}

main().catch(console.error);