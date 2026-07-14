/**
 * R2 Client Factory - S3-compatible API for Node.js ETLs
 *
 * R2 supports the S3 API via aws-sdk - just change the endpoint and credentials.
 * No code changes needed in ETL logic; only configuration differs.
 */

import { S3Client } from "@aws-sdk/client-s3";

/**
 * Create an S3 client configured for R2 endpoint
 * This allows existing ETL code to work unchanged - just set R2_* env vars
 */
export function createR2ClientFromEnv(): S3Client {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2 credentials: CLOUDFLARE_ACCOUNT_ID and CF_R2_ACCESS_KEY_ID/CF_R2_SECRET_ACCESS_KEY required"
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}
