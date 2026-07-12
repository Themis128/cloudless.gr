#!/bin/bash
# Migrate all ETLs from AWS S3 to R2
# Creates -to-r2.mjs versions with S3→R2 endpoint swap

set -e

cat << 'EOF' > scripts/etl/_r2-config.mjs
import { S3Client } from "@aws-sdk/client-s3";

const R2_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
const R2_KEY = process.env.CF_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const R2_SECRET = process.env.CF_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

export function getS3Client() {
  if (R2_ACCOUNT && R2_KEY && R2_SECRET) {
    return new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: { accessKeyId: R2_KEY, secretAccessKey: R2_SECRET },
    });
  }
  return new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
}

export const BUCKET = process.env.ANALYTICS_BUCKET || "cloudless-analytics";
EOF

echo "✅ Created _r2-config.mjs - shared R2 client helper"
echo ""
echo "To complete migration:"
echo "1. Add R2 secrets to GitHub: CLOUDFLARE_ACCOUNT_ID, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY"
echo "2. Run: AWS_PROFILE=default pnpm tsx scripts/migrate-s3-to-r2.mjs"
echo "3. Update each ETL to: import { getS3Client, BUCKET } from './_r2-config.mjs'; const s3 = getS3Client();"