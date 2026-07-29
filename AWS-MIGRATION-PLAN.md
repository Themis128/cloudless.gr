# AWS to Fly.io/Cloudflare Migration Plan

## Current State

- **Primary Backend:** `d3k7muo3c6lw6s.cloudfront.net` (AWS CloudFront) - UPDATED
- **Fallback Backend:** `omv.tail8eb71.ts.net` (Pi via Tailscale)
- **Target Primary:** `cloudless.gr` (Cloudflare Workers - already deployed)

## Migration Phases

### Phase 1: Proxy Configuration ✅ COMPLETE

- [x] Update `fly.toml` PRIMARY_HOST to `cloudless.gr`
- [x] Update `fly-proxy-app/proxy.py` PRIMARY_HOST to `cloudless.gr`
- [x] Fly.io HA failover configured (Workers as primary)

### Phase 2: Secrets Migration ✅ COMPLETE

- [x] `scripts/sync-ssm-to-wrangler.ts` - All secrets synced
- [x] All required secrets configured in Wrangler

### Phase 3: Data Migration ✅ COMPLETE

- [x] `scripts/migrate-dynamodb-to-d1.ts` - All 5 tables migrated
- [x] D1 tables: user, session, stripe_transaction, admin_notification, analytics_cache
- [x] `scripts/migrate-s3-to-r2.mjs` - R2 buckets configured

### Phase 4: Service Migration ✅ COMPLETE

- [x] SES → Cloudflare Email (email binding active)
- [x] R2 → 4 buckets configured (cloudless-assets, app-media-bucket, cloudless-analytics, datalake-bucket)
- [x] Athena → DuckDB-Wasm endpoint ready
- [x] Bedrock → Workers AI (with Anthropic fallback)
- [x] SNS → Webhook/Slack integration

### Phase 5: Auth Migration ✅ COMPLETE

- [x] D1 Auth endpoints in `src/index-cloudflare-free.js`
- [x] Cognito fully replaced by D1 Auth

### Phase 6: Cron Migration ✅ COMPLETE

- [x] All 5 cron jobs as Workers Cron Triggers
- [x] analytics-rollup, calendar-digest, gsc-cache-refresh, report-cleanup, voice-brief

## AWS Services Inventory - Migration Complete

| Service | Migration Target | Status |
|---------|------------------|--------|
| Lambda@Edge | Workers (edge functions) | ✅ Migrated |
| Lambda (SST/Next.js) | Workers + D1/R2/AI | ✅ Migrated |
| CloudFront | Workers Routes | ✅ Deleted |
| SSM | Wrangler secrets | ✅ Synced |
| DynamoDB | D1 | ✅ Migrated |
| S3 (assets) | R2 | ✅ Migrated |
| S3 (analytics) | R2 | ✅ Migrated |
| SES | Cloudflare Email Service | ✅ Active |
| Bedrock (Nova) | Workers AI | ✅ Primary + Anthropic fallback |
| Athena | DuckDB-Wasm | ✅ R2 parquet endpoint |
| Cognito | D1 Auth | ✅ Replaced |
| SNS | Webhook/Slack | ✅ Integrated |

## Execution Commands

```bash
# Fix IAM permissions (needed for DynamoDB migration)
pnpm tsx scripts/ses-smtp-iam-bootstrap.sh

# Migrate secrets
AWS_PROFILE=default pnpm tsx scripts/sync-ssm-to-wrangler.ts

# Migrate DynamoDB data
AWS_PROFILE=default pnpm tsx scripts/migrate-dynamodb-to-d1.ts

# Migrate S3 assets
AWS_PROFILE=default pnpm tsx scripts/migrate-s3-to-r2.js
