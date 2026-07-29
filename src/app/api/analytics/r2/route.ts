import { NextRequest, NextResponse } from "next/server";
import type { R2Bucket } from "@cloudflare/workers-types";

// R2 binding interface - provided by Worker
interface Env {
  ANALYTICS_BUCKET: R2Bucket;
}

function getBucket(_request: NextRequest): R2Bucket | null {
  const env = process.env as unknown as Env;
  if (!env.ANALYTICS_BUCKET) {
    return null;
  }
  return env.ANALYTICS_BUCKET;
}

export async function GET(req: NextRequest) {
  const bucket = getBucket(req);
  if (!bucket) {
    // Fallback for AWS deployment - proxy to S3 or return 503
    return NextResponse.json({ error: "Analytics storage not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const file = url.searchParams.get("file");

  if (!file) {
    return new NextResponse("Missing file parameter", { status: 400 });
  }

  // Security: validate filename to prevent path traversal
  if (!/^[a-zA-Z0-9_\-./]+\.parquet$/.test(file)) {
    return new NextResponse("Invalid filename", { status: 400 });
  }

  // Accept Range requests for efficient streaming
  const rangeHeader = req.headers.get("range");
  const options: { range?: { offset: number; length: number } } = {};

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : undefined;
      if (!end) {
        options.range = { offset: start, length: 1024 * 1024 }; // 1MB chunks
      } else {
        options.range = { offset: start, length: end - start + 1 };
      }
    }
  }

  try {
    const object = await bucket.get(`lake/${file}`, options);

    if (!object) {
      return new NextResponse("Not found", { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/octet-stream");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour

    // Copy ETag and related headers from R2 if available
    if (object.httpEtag) {
      headers.set("ETag", object.httpEtag);
    }

    // Type assertion: Cloudflare Workers R2 body is ReadableStream at runtime
    // Cast through unknown to satisfy TypeScript type checker
    return new Response(object.body as unknown as ReadableStream, { headers });
  } catch (err: unknown) {
    console.error("[analytics/r2] R2 fetch failed:", err);
    return new NextResponse("Internal error", { status: 500 });
  }
}
