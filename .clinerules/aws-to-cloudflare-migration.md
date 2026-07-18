# AWS-to-Cloudflare Migration Playbook

## Overview

This document tracks the migration of all AWS services to Cloudflare equivalents for the cloudless.gr infrastructure.

## Migration Matrix

| Service | AWS | Cloudflare Replacement | Status |
|---------|-----|---------------------|--------|
| SSM Parameter Store | `aws ssm get-parameter` | D1 `app_config` table + Wrangler secrets | ✅ In Progress |
| S3 | `@aws-sdk/client-s3` | R2 (`@aws-sdk/client-s3` with R2 endpoint) | ✅ Complete (R2 config) |
| DynamoDB | User sessions, analytics | D1 (`user-auth-db`) | ✅ Complete |
| SES | Email sending | Cloudflare Email (workers.dev) | ✅ Complete |
| Bedrock | AI inference | Workers AI (`@cf/meta/llama-3.1-8b-instruct`) | ✅ Complete |
| Cognito | Authentication | D1-based auth | ✅ Complete |

## ETL Migration Status

### scripts/etl/espocrm-to-r2.mjs
- **S3 → R2**: Uses `_r2-config.mjs` with conditional R2 endpoint
- **SSM → D1**: NOT YET MIGRATED - Still uses AWS SSM for credentials
- **Issue**: `ESPOCRM_API_PASSWORD` doesn't exist in SSM, causing 401 errors

### scripts/etl/espocrm-to-lake.mjs (legacy S3 version)
- Uses AWS SDK S3Client pointing to S3
- Uses SSM for credentials

### scripts/etl/clients-to-lake.mjs
- Uses SSMClient for `PENDING_CLIENTS_JSON` and `CLIENT_PORTALS_JSON`
- Uses S3Client for S3

### scripts/etl/linkedin-ads-to-lake.mjs
- Uses SSMClient for `LINKEDIN_ACCESS_TOKEN`
- Uses S3Client for S3

## Migration Strategy

### Phase 1: Configuration Migration (SSM → D1)

1. All non-secret configuration stored in D1 `app_config` table
2. Secrets (API keys, passwords) stored as Wrangler secrets or process.env
3. ETL scripts read from D1 via HTTP endpoint or use environment variables

### Phase 2: Storage Migration (S3 → R2)

1. R2 bucket `datalake-bucket` already created
2. Use same AWS SDK with R2 endpoint configuration
3. `_r2-config.mjs` provides the bridge

## Required Secrets (Wrangler)

Add these secrets for ETL:
```bash
npx wrangler secret put ESPOCRM_API_KEY
npx wrangler secret put ESPOCRM_API_PASSWORD
npx wrangler secret put LINKEDIN_ACCESS_TOKEN
npx wrangler secret put TIKTOK_ACCESS_TOKEN
npx wrangler secret put X_ACCESS_TOKEN
npx wrangler secret put X_ACCESS_SECRET
npx wrangler secret put META_ACCESS_TOKEN
npx wrangler secret put ACTIVECAMPAIGN_API_TOKEN
npx wrangler secret put HUBSPOT_API_KEY
```

## Environment Setup

The ETL workflow should set `SSM_DISABLED=1` before the migration is complete, or the scripts should use:
- `process.env.ESPOCRM_API_KEY` (from Wrangler secret)
- `process.env.ESPOCRM_API_PASSWORD` (from Wrangler secret)
- `getS3Client()` from `_r2-config.mjs` for R2-compatible storage

## Files to Update

1. `.github/workflows/etl-espocrm-to-r2.yml` - Remove SSM step, use Wrangler secrets
2. `scripts/etl/espocrm-to-r2.mjs` - Already uses R2 config, needs SSM env var fallback
3. `scripts/etl/linkedin-ads-to-lake.mjs` - Migrate SSM client calls
4. `scripts/etl/clients-to-lake.mjs` - Migrate SSM client calls
5. `scripts/etl/postiz-to-lake.mjs` - Migrate S3 to R2
6. `scripts/etl/appflowy-to-lake.mjs` - Migrate S3 to R2

## Notes

- The `ESPOCRM_API_PASSWORD` parameter does NOT exist in SSM (confirmed via AWS CLI)
- The API key exists: `1e9f15bcd0368bce98b5de76c6929745`
- EspoCRM supports both `Espo-Authorization` (Basic Auth) and `X-Api-Key` headers
- Cloudflare's bot detection blocks GitHub Actions IPs - ETL must run on self-hosted Pi runners