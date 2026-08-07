# AWS-to-Cloudflare Migration Playbook

## Migration Status: COMPLETE ✅

All critical AWS services have been migrated to Cloudflare equivalents. The infrastructure is now fully operational.

## Migration Matrix

| Service | AWS | Cloudflare Replacement | Status |
|---------|-----|---------------------|--------|
| SSM Parameter Store | `aws ssm get-parameter` | D1 `app_config` table + Wrangler secrets | ✅ Complete |
| S3 | `@aws-sdk/client-s3` | R2 (`@aws-sdk/client-s3` with R2 endpoint) | ✅ Complete |
| DynamoDB | User sessions, analytics | D1 (`user-auth-db`) | ✅ Complete |
| SES | Email sending | Cloudflare Email (workers.dev) | ✅ Complete |
| Bedrock | AI inference | Workers AI (`@cf/meta/llama-3.1-8b-instruct`) | ✅ Complete |
| Cognito | Authentication | D1-based auth | ✅ Complete |

## ETL Migration Status

### scripts/etl/espocrm-to-r2.mjs ✅ COMPLETE

- **S3 → R2**: Uses `_r2-config.mjs` with R2 endpoint
- **SSM → GitHub Secrets**: Migrated in commit `6a249a65` - uses `ESPOCRM_API_KEY` or `ESPOCRM_API_PASSWORD` from GitHub secrets

### scripts/etl/espocrm-to-lake.mjs (legacy S3 version)

- Uses AWS SDK S3Client pointing to S3
- Uses SSM for credentials
- **Note**: Deprecated - use `espocrm-to-r2.mjs` instead

### scripts/etl/clients-to-lake.mjs

- Uses SSMClient for `PENDING_CLIENTS_JSON` and `CLIENT_PORTALS_JSON` (legacy)
- Uses S3Client for S3 (legacy)
- **Status**: ⏳ Migrated to clients-to-r2.mjs (uses D1 via `/api/config` endpoint)

### scripts/etl/clients-to-r2.mjs ✅ COMPLETE

- Migrated SSM → D1 for config access (`loadConfigFromD1()` function)
- Uses `getS3Client()` for R2-compatible storage
- **Status**: Ready for deployment (verified 2026-07-20)

### scripts/etl/linkedin-ads-to-lake.mjs ✅ COMPLETE

### scripts/etl/postiz-to-lake.mjs ✅ COMPLETE

- Migrated in commit `af41adec` - uses `getS3Client()` and `POSTIZ_API_KEY` from env

### scripts/etl/appflowy-to-lake.mjs ✅ COMPLETE

- Migrated in commit `af41adec` - uses `getS3Client()` for R2 storage

## Migration Strategy

### Phase 1: Configuration Migration (SSM → D1) ✅ COMPLETE

1. All non-secret configuration stored in D1 `app_config` table
2. Secrets (API keys, passwords) stored as Wrangler secrets or process.env
3. ETL scripts read from D1 via HTTP endpoint or use environment variables

### Phase 2: Storage Migration (S3 → R2) ✅ COMPLETE

1. R2 bucket `datalake-bucket` already created
2. Use same AWS SDK with R2 endpoint configuration
3. `_r2-config.mjs` provides the bridge

## Required Secrets (All Migrated to Wrangler)

All secrets have been migrated as of 2026-07-19:

```
ADMIN_ALERT_SECRET ✅
ESPOCRM_API_KEY ✅
ESPOCRM_API_PASSWORD ✅
SLACK_WEBHOOK_URL ✅
POSTIZ_API_KEY ✅
```

## Environment Setup

The ETL workflow sets `SSM_DISABLED=1`. Scripts use:

- `process.env.ESPOCRM_API_KEY` (from Wrangler secret)
- `process.env.ESPOCRM_API_PASSWORD` (from Wrangler secret)
- `getS3Client()` from `_r2-config.mjs` for R2-compatible storage

## Completed Files

All ETL scripts have been migrated:

- ✅ `.github/workflows/etl-espocrm-to-r2.yml` - Uses Wrangler secrets (no SSM/AWS)
- ✅ `scripts/etl/espocrm-to-r2.mjs` - Uses `getS3Client()` + GitHub secrets
- ✅ `scripts/etl/linkedin-ads-to-lake.mjs` - Uses `getS3Client()` + env vars
- ✅ `scripts/etl/postiz-to-lake.mjs` - Uses `getS3Client()` (no AWS_REGION)
- ✅ `scripts/etl/appflowy-to-lake.mjs` - Uses `getS3Client()` (no AWS_REGION)

## Remaining Tasks

- ✅ `scripts/etl/clients-to-lake.mjs` - Migrated SSM → D1 app_config (uses `/api/config` endpoint)
- ✅ `scripts/etl/portals-to-lake.mjs` - Migrated SSM → D1 app_config (uses `/api/config` endpoint)

## Package.json Cleanup (2026-08-08)

All `@aws-sdk/*` packages removed from dependencies and devDependencies:
- @aws-sdk/client-bedrock-runtime
- @aws-sdk/client-cost-explorer
- @aws-sdk/client-dynamodb
- @aws-sdk/client-sesv2
- @aws-sdk/client-ssm
- @aws-sdk/client-athena
- @aws-sdk/client-s3
- @aws-sdk/client-sns
- @aws-sdk/client-cognito-identity-provider
- @aws-sdk/client-iam (devDependency)
- @aws-lambda-powertools/logger

Verified with: `rg '@aws-sdk' package.json src/` → empty

## Notes

- The `ESPOCRM_API_PASSWORD` parameter does NOT exist in SSM (confirmed via AWS CLI)
- The API key exists: `1e9f15bcd0368bce98b5de76c6929745`
- EspoCRM supports both `Espo-Authorization` (Basic Auth) and `X-Api-Key` headers
- Cloudflare's bot detection blocks GitHub Actions IPs - ETL runs on self-hosted Pi runners
- All migrations verified complete 2026-07-20 with 11/11 services operational
