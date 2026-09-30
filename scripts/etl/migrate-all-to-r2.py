#!/usr/bin/env python3
"""Migrate-all-ETLs note — the -to-r2.mjs ETLs use the
fail-fast _r2-config.mjs helper (throws if R2 creds missing,
no AWS S3 fallback). Prints the migration checklist."""

print("""✅ _r2-config.mjs already configured with fail-fast behavior
   - Throws error if CF_ACCOUNT_ID, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY missing
   - No AWS S3 fallback (AWS SSM/S3 fully deprecated)

To complete migration:
1. Add R2 secrets to GitHub: CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY
   (Use the create-r2-credentials.yml workflow to auto-generate)
2. Run ETL scripts: node scripts/etl/espocrm-to-r2.mjs
3. All -to-r2.mjs scripts import from _r2-config.mjs:
   import { getS3Client, BUCKET } from './_r2-config.mjs'; const s3 = getS3Client();""")
