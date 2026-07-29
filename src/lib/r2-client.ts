/**
 * R2 Client Helper
 *
 * Provides unified access to Cloudflare R2 buckets across the application.
 * Handles environment detection (Workers vs Lambda) and routing to appropriate bucket.
 */

import type { R2Bucket } from "@cloudflare/workers-types";

interface R2Env {
  ASSETS_BUCKET?: R2Bucket;
  MEDIA_BUCKET?: R2Bucket;
  DATALAKE_BUCKET?: R2Bucket;
}

interface NodeProcess {
  env?: { AWS_LAMBDA_FUNCTION_NAME?: string };
}

// Environment detection
export function isCloudflareWorkers(): boolean {
  return (
    typeof (globalThis as unknown as Record<string, unknown>).caches !== "undefined" &&
    !(process as unknown as NodeProcess).env?.AWS_LAMBDA_FUNCTION_NAME
  );
}

// Get R2 bucket binding for assets (static files)
export function getAssetsBucket(env: R2Env): R2Bucket | null {
  // In Workers: env.ASSETS_BUCKET
  // In Lambda: null (use CloudFront/S3)
  if (isCloudflareWorkers() && env?.ASSETS_BUCKET) {
    return env.ASSETS_BUCKET;
  }
  return null;
}

// Get R2 bucket binding for media (user uploads)
export function getMediaBucket(env: R2Env): R2Bucket | null {
  if (isCloudflareWorkers() && env?.MEDIA_BUCKET) {
    return env.MEDIA_BUCKET;
  }
  return null;
}

// Get R2 bucket binding for analytics/datalake
export function getDataLakeBucket(env: R2Env): R2Bucket | null {
  if (env?.DATALAKE_BUCKET && typeof env.DATALAKE_BUCKET.put === "function") {
    return env.DATALAKE_BUCKET;
  }
  return null;
}

/** Resolve DATALAKE_BUCKET from Workers global / env object (no AWS S3). */
export function getDataLakeBucketFromEnv(): R2Bucket | null {
  const g = globalThis as unknown as {
    __DATALAKE_BUCKET__?: R2Bucket;
    __R2__?: { DATALAKE_BUCKET?: R2Bucket };
  };
  const fromProcess = (process as unknown as { env?: R2Env }).env?.DATALAKE_BUCKET;
  // Prefer explicit globals — Node process.env cannot hold R2 binding objects.
  const candidate = g.__DATALAKE_BUCKET__ ?? g.__R2__?.DATALAKE_BUCKET ?? fromProcess;
  return getDataLakeBucket({ DATALAKE_BUCKET: candidate });
}

// Serve static asset from R2 with proper headers
export async function serveStaticAsset(
  env: R2Env,
  key: string,
  opts: { cacheSeconds?: number } = {}
): Promise<Response | null> {
  const bucket = getAssetsBucket(env);
  if (!bucket) return null;

  const asset = await bucket.get(key);
  if (!asset) return null;

  const headers = new Headers();
  asset.writeHttpMetadata(headers as unknown as import("@cloudflare/workers-types").Headers);
  headers.set("Cache-Control", `public, max-age=${opts.cacheSeconds || 31536000}, immutable`);

  // Set CORS headers
  headers.set("Access-Control-Allow-Origin", "*");

  // Set content type if missing
  if (!headers.get("Content-Type")) {
    const ext = key.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
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
    };
    if (ext && mimeTypes[ext]) {
      headers.set("Content-Type", mimeTypes[ext]);
    }
  }

  return new Response(asset.body as unknown as BodyInit, { headers });
}

// List objects in an R2 bucket (for admin operations)
export async function listR2Objects(
  env: R2Env,
  bucketType: "assets" | "media" | "lake",
  prefix = ""
): Promise<string[]> {
  const bucket =
    bucketType === "assets"
      ? getAssetsBucket(env)
      : bucketType === "media"
        ? getMediaBucket(env)
        : getDataLakeBucket(env);

  if (!bucket?.list) return [];

  const result = await bucket.list({ prefix, limit: 1000 });
  return result.objects.map((obj: { key: string }) => obj.key);
}
