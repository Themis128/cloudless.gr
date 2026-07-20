# AWS-to-Cloudflare Migration Guide

## Quick Start

### Set Required Wrangler Secrets
```bash
# EspoCRM credentials
npx wrangler secret put ESPOCRM_BASE_URL
npx wrangler secret put ESPOCRM_API_KEY
npx wrangler secret put ESPOCRM_API_PASSWORD

# R2 credentials
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put CF_R2_ACCESS_KEY_ID
npx wrangler secret put CF_R2_SECRET_ACCESS_KEY

# Analytics tokens
npx wrangler secret put LINKEDIN_ACCESS_TOKEN
npx wrangler secret put TIKTOK_ACCESS_TOKEN
npx wrangler secret put X_ACCESS_TOKEN
npx wrangler secret put X_ACCESS_SECRET
npx wrangler secret put META_ACCESS_TOKEN

# Service tokens
npx wrangler secret put ACTIVECAMPAIGN_API_TOKEN
npx wrangler secret put HUBSPOT_API_KEY
npx wrangler secret put POSTIZ_API_KEY
```

## Migration Status: COMPLETE ✅

All critical AWS services have been successfully migrated to Cloudflare. See `.clinerules/migration-completion.md` for full details.

## Migration Matrix

| Component | Before (AWS) | After (Cloudflare) | Status |
|-----------|--------------|-------------------|--------|
| Parameter Store | SSM parameters | D1 `app_config` table + Wrangler secrets | ✅ Complete |
| Object Storage | S3 buckets | R2 buckets | ✅ Complete |
| Email | SES | Cloudflare Email | ✅ Complete |
| Auth Database | DynamoDB | D1 `user-auth-db` | ✅ Complete |
| AI/LLM | Bedrock | Workers AI | ✅ Complete |
| Cron Jobs | EventBridge + Lambda | Wrangler cron triggers | ✅ Complete |

## ETL Scripts Migration Status

### Migrated (R2 + Env vars) - ALL COMPLETE
- ✅ `espocrm-to-r2.mjs` - Uses `getS3Client()` + env vars (GitHub secrets)
- ✅ `linkedin-ads-to-lake.mjs` - Uses `getS3Client()` + env vars
- ✅ `postiz-to-lake.mjs` - Uses `getS3Client()` + env vars (no AWS_REGION)
- ✅ `appflowy-to-lake.mjs` - Uses `getS3Client()` + env vars (no AWS_REGION)
- ✅ `clients-to-r2.mjs` - Uses D1 via `/api/config` endpoint for config

### Legacy Scripts (Deprecated)
- ⏳ `clients-to-lake.mjs` - Uses SSM only (deprecated, use clients-to-r2.mjs)
- ⏳ `portals-to-lake.mjs` - Uses SSM only (deprecated, pending migration)

## Environment Configuration

### For Local Development
Create `scripts/etl/.env.local`:
```
ESPOCRM_BASE_URL=https://espocrm.cloudless.gr
ESPOCRM_API_KEY=your-api-key
CLOUDFLARE_ACCOUNT_ID=your-account-id
CF_R2_ACCESS_KEY_ID=your-access-key
CF_R2_SECRET_ACCESS_KEY=your-secret-key
ANALYTICS_BUCKET=datalake-bucket
SSM_DISABLED=1
```

### For GitHub Actions (Pi Runners - Required)
Cloudflare bot detection blocks GitHub Actions IPs. Use self-hosted Pi runners.
Secrets required:
- `ESPOCRM_BASE_URL`
- `ESPOCRM_API_KEY`
- `ESPOCRM_API_PASSWORD`
- `CLOUDFLARE_ACCOUNT_ID`
- `CF_R2_ACCESS_KEY_ID`
- `CF_R2_SECRET_ACCESS_KEY`
- `LINKEDIN_ACCESS_TOKEN`
- `TS_CLIENT_ID`, `TS_CLIENT_SECRET`, `TS_AUTHKEY`, `OMV_SSH_KEY`

## D1 Configuration Table

The `app_config` table stores non-secret configuration values (migrations 0006, 0007):

```sql
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS email_suppression (
  email TEXT NOT NULL PRIMARY KEY,
  reason TEXT NOT NULL,
  suppressed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  expires_at INTEGER
);
```

Pre-populated keys:
- `ESPOCRM_BASE_URL`
- `LINKEDIN_AD_ACCOUNT_ID`
- `SES_FROM_EMAIL`, `SES_TO_EMAIL`
- `GSC_SITE_URL`

## Testing Migration

```bash
# Test R2 connection
npm ci --prefix scripts/etl
LINKEDIN_ACCESS_TOKEN=test CF_R2_ACCESS_KEY_ID=... node scripts/etl/linkedin-ads-to-lake.mjs

# Apply migrations
npx wrangler d1 execute user-auth-db --file ./migrations/0006-email-suppression.sql --remote
npx wrangler d1 execute user-auth-db --file ./migrations/0007-app-config.sql --remote
```

## Notes

- The `ESPOCRM_API_PASSWORD` parameter does NOT exist in SSM - use API key instead
- R2 uses S3-compatible API, so existing code works with endpoint override
- All secrets migrated to Wrangler (2026-07-19)
- D1 migrations applied and verified (2026-07-20)
- See `.clinerules/aws-to-cloudflare-migration.md` for detailed migration patterns