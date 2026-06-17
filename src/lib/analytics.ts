/**
 * Analytics event sink — writes NDJSON to S3 partitioned by date.
 * Path: events/year=YYYY/month=MM/day=DD/<timestamp>-<random>.ndjson
 * Queryable via Athena using the DDL in docs/analytics-athena.sql
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.ANALYTICS_S3_BUCKET || "cloudless-analytics-data";

let s3: S3Client | null = null;
function getS3(): S3Client {
  s3 ??= new S3Client({ region: REGION });
  return s3;
}

export interface AnalyticsEvent {
  event: string;           // e.g. "signup", "purchase", "page_view"
  user_id?: string;        // Cognito sub
  email?: string;
  session_id?: string;
  page?: string;
  referrer?: string;
  country?: string;
  ip?: string;
  user_agent?: string;
  // domain-specific
  amount?: number;
  currency?: string;
  plan?: string;
  product_id?: string;
  service?: string;
  source?: string;
  campaign?: string;
  medium?: string;
  // freeform extras
  properties?: Record<string, unknown>;
}

export function trackS3Event(evt: AnalyticsEvent): void {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const key = `events/year=${y}/month=${m}/day=${d}/${now.getTime()}-${randomBytes(4).toString("hex")}.ndjson`;

  const record = JSON.stringify({
    timestamp: now.toISOString(),
    ...evt,
  });

  getS3()
    .send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: record, ContentType: "application/x-ndjson" }))
    .catch((e) => console.error("[analytics] S3 write failed:", e));
}
