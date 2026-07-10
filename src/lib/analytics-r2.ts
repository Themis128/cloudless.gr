/**
 * Analytics R2 Adapter
 * 
 * Writes NDJSON to R2 for Cloudflare Workers environment.
 * Falls back to S3 for AWS Lambda environment.
 */

export interface AnalyticsEvent {
  event: string;
  user_id?: string;
  email?: string;
  session_id?: string;
  page?: string;
  referrer?: string;
  country?: string;
  ip?: string;
  user_agent?: string;
  amount?: number;
  currency?: string;
  plan?: string;
  product_id?: string;
  service?: string;
  source?: string;
  campaign?: string;
  properties?: Record<string, unknown>;
}

// Detect environment
function isCloudflareWorkers(): boolean {
  return !(process as any).env?.AWS_LAMBDA_FUNCTION_NAME && 
         typeof (globalThis as any).caches !== "undefined";
}

// R2 adapter for Workers
export async function trackR2Event(env: any, evt: AnalyticsEvent): Promise<void> {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const key = `events/year=${y}/month=${m}/day=${d}/${now.getTime()}-${Math.random().toString(36).slice(2, 8)}.ndjson`;

  const record = JSON.stringify({
    timestamp: now.toISOString(),
    ...evt,
  });

  // Use env.DATALAKE_BUCKET if available (Workers)
  if (env?.DATALAKE_BUCKET?.put) {
    await env.DATALAKE_BUCKET.put(key, record, {
      httpMetadata: { contentType: "application/x-ndjson" }
    }).catch((e: Error) => console.error("[analytics-r2] R2 write failed:", e.message));
  } else {
    // Fallback to S3 for Lambda
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
    const BUCKET = process.env.ANALYTICS_S3_BUCKET || "cloudless-analytics-data";
    
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: record,
        ContentType: "application/x-ndjson",
      })
    ).catch((e: Error) => console.error("[analytics-r2] S3 write failed:", e.message));
  }
}

// Universal function - works in both environments
export function trackEvent(env: any | undefined, evt: AnalyticsEvent): void {
  // In Workers, env is passed; in Lambda, use S3
  if (isCloudflareWorkers() && env?.DATALAKE_BUCKET) {
    trackR2Event(env, evt).catch(() => {});
  } else {
    // Use existing S3 implementation
    import("./analytics").then(({ trackS3Event }) => {
      trackS3Event(evt);
    }).catch(() => {});
  }
}