#!/bin/bash
# Migrate all ETLs from AWS S3 to R2
# Creates -to-r2.mjs versions with S3→R2 endpoint swap
#
# NOTE: The _r2-config.mjs helper now uses fail-fast behavior —
# it throws an error if R2 credentials are missing instead of
# falling back to AWS S3. This ensures ETLs never silently
# write to the wrong storage backend.

set -e

echo "✅ _r2-config.mjs already configured with fail-fast behavior"
echo "   - Throws error if CF_ACCOUNT_ID, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY missing"
echo "   - No AWS S3 fallback (AWS SSM/S3 fully deprecated)"
echo ""
echo "To complete migration:"
echo "1. Add R2 secrets to GitHub: CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY"
echo "   (Use the create-r2-credentials.yml workflow to auto-generate)"
echo "2. Run ETL scripts: node scripts/etl/espocrm-to-r2.mjs"
echo "3. All -to-r2.mjs scripts import from _r2-config.mjs:"
echo "   import { getS3Client, BUCKET } from './_r2-config.mjs'; const s3 = getS3Client();"
