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

## Migration Matrix

| Component | Before (AWS) | After (Cloudflare) | Status |
|-----------|--------------|-------------------|--------|
| Parameter Store | SSM parameters | D1 `app_config` table | ✅ Primary, SSM fallback |
| Object Storage | S3 buckets | R2 buckets | ✅ Using `_r2-config.mjs` |
| Email | SES | Cloudflare Email | ✅ Workers Email binding |
| Auth Database | DynamoDB | D1 `user-auth-db` | ✅ Complete |
| AI/LLM | Bedrock | Workers AI | ✅ Complete |
| Cron Jobs | EventBridge + Lambda | Wrangler cron triggers | ✅ Complete |

## ETL Scripts Migration Status

### Migrated (R2 + Env vars)
- ✅ `espocrm-to-r2.mjs` - Uses `getS3Client()` + env vars
- ✅ `linkedin-ads-to-lake.mjs` - Uses `getS3Client()` + env vars

### Pending Migration
- ⏳ `clients-to-lake.mjs` - Uses Cognito + SSM (needs D1 auth migration)
- ⏳ `portals-to-lake.mjs` - Uses SSM only
- ⏳ `postiz-to-lake.mjs` - Uses S3
- ⏳ `appflowy-to-lake.mjs` - Uses S3
- ⏳ `espocrm-to-lake.mjs` - Legacy, use espocrm-to-r2.mjs instead

## Environment Variables

### For Local Development
Create `scripts/etl/.env.local`:
```
ESPOCRM_BASE_URL=https://espocrm.cloudless.gr
ESPOCRM_API_KEY=your-api-key
CLOUDFLARE_ACCOUNT_ID=your-account-id
CF_R2_ACCESS_KEY_ID=your-access-key
CF_R2_SECRET_ACCESS_KEY=your-secret-key
ANALYTICS_BUCKET=datalake-bucket
```

### For GitHub Actions (Pi Runners)
Secrets required:
- `ESPOCRM_BASE_URL`
- `ESPOCRM_API_KEY`
- `ESPOCRM_API_PASSWORD`
- `CLOUDFLARE_ACCOUNT_ID`
- `CF_R2_ACCESS_KEY_ID`
- `CF_R2_SECRET_ACCESS_KEY`
- `LINKEDIN_ACCESS_TOKEN`

## D1 Configuration Table

The `app_config` table stores non-secret configuration values:

```sql
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
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
LINKEDIN_ACCESS_TOKEN=test CFT_R2_ACCESS_KEY_ID=... node scripts/etl/linkedin-ads-to-lake.mjs
```

## Notes

- The `ESPOCRM_API_PASSWORD` parameter does NOT exist in SSM - use API key instead
- Cloudflare bot detection blocks GitHub Actions IPs - use self-hosted runners
- R2 uses S3-compatible API, so existing code works with endpoint override