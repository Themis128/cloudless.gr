# AWS Migration Status Report

## Completed Changes (6 files, ~60 lines)

### Files Modified:

1. **fly.toml** - PRIMARY_HOST = `cloudless.gr` (was CloudFront)
2. **fly-proxy-app/proxy.py** - Backend check updated to Cloudflare
3. **scripts/sync-ssm-to-wrangler.ts** - All 20 secrets mapped for migration

### Files Created:

1. **scripts/dynamodb-migration-policy.json** - IAM policy for all 5 tables
2. **scripts/add-dynamodb-migration-permissions.sh** - IAM setup script
3. **scripts/create-dynamodb-policy.py** - Alternative policy creator
4. **scripts/migrate-dynamodb-to-d1.ts** - Updated with correct table names
5. **scripts/etl/_r2-config.mjs** - Fixed BUCKET to `datalake-bucket` (was `cloudless-analytics`)
6. **All 12 -to-r2.mjs ETL scripts** - Fixed to import BUCKET from _r2-config.mjs

## Execution Results:

### ✅ Secrets Sync: SUCCESS (15/20 synced)

- AUTH_SECRET, CRON_SECRET, STRIPE_* keys synced
- Missing: SESSION_SECRET, ANTHROPIC_CHAT_MODEL, SLACK_WEBHOOK_URL, etc.

### ✅ IAM Policy: CREATED

- Policy `cloudless-dynamodb-migration` created
- Attached to `cloudless-ops` user

### ❌ DynamoDB Migration: PENDING

- Script ready, needs `wrangler` CLI configured
- IAM permissions now in place

### ❌ Fly.io Proxy: PENDING

- flyctl not installed on this machine
- Run manually: `flyctl deploy --app cloudless-proxy`

## Remaining AWS Services:

| Service | Tables/Resources | Migration Status |
|---------|-----------------|----------------|
| SSM | 4 modules use SSMClient | Script ready |
| Lambda/SST | sst.config.ts deploys Lambda | Infrastructure ready on Workers |
| Cognito | auth.ts, auth-d1.ts | D1 Auth ready in index-cloudflare-free.js |
| DynamoDB | 5 production tables | IAM policy created, script ready |
| SES | email-sender.ts | Email binding in wrangler.json |
| S3 | 2 buckets | migrate-s3-to-r2.js script exists |
| Athena | athena.ts | DuckDB-Wasm alternative exists |
| Bedrock | bedrock-*.ts | Workers AI bindings ready |
| SNS | admin-notifications.ts | Webhook replacement needed |
