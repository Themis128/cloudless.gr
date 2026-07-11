# AWS → Fly.io/Cloudflare Migration: Execution Guide

## Quick Summary

Most migration scripts and infrastructure already exist. Here's what to run:

## Phase 1: Proxy Update (READY)

```bash
# Files updated:
# - fly.toml (PRIMARY_HOST = "cloudless.gr")
# - fly-proxy-app/proxy.py (updated to check cloudless.gr)

# Deploy the updated proxy:
cd /home/tbaltzakis/cloudless.gr
flyctl deploy --app cloudless-proxy
```

## Phase 2: Secrets Migration

```bash
# Export from SSM and import to Wrangler
AWS_PROFILE=default pnpm tsx scripts/sync-ssm-to-wrangler.ts

# For Fly.io secrets (alternative):
# pnpm tsx scripts/sync-ssm-to-wrangler.ts --format=fly
```

## Phase 3: Data Migration

```bash
# Migrate DynamoDB to D1 (test first)
AWS_PROFILE=default pnpm tsx scripts/migrate-dynamodb-to-d1.ts
```

## Phase 4: S3→R2 Migration

```bash
# Migrate assets and datalake
AWS_PROFILE=default pnpm tsx scripts/migrate-s3-to-r2.js
```

## Phase 5: Auth Switch

The D1 Auth is already implemented in `src/index-cloudflare-free.js`. To activate:
- Remove `COGNITO_*` env vars from `wrangler.json`
- Add `SESSION_SECRET` to Wrangler secrets
- Update `src/lib/auth.ts` to use D1 endpoints

## Phase 6: Cron Replacement

The cron runner exists at `fly-cron-apps/cron-runner.ts`. 

For Fly.io scheduled machines, run:
```bash
# Example: Analytics rollup at 01:00 UTC
flyctl machines schedule cloudless-cron-analytics --cron "0 1 * * ?"
```

## AWS Services Status

| Service | Migration Status | Action Required |
|---------|-----------------|-----------------|
| SSM | Ready to migrate | Run sync script |
| Lambda (SST) | Active | Switch to Workers |
| Cognito | Ready to replace | Update auth.ts |
| DynamoDB | Ready to migrate | Run migrate script |
| SES | Fallback ready | Test email binding |
| S3 | Ready to migrate | Run migrate-s3-to-r2.js |
| Athena | Client-side alt | Use analytics-client.ts |
| Bedrock | Needs update | Use Workers AI bindings |
| SNS | Needs replacement | Use webhooks |

## Rollback Plan

If issues occur:
1. Revert `fly.toml` PRIMARY_HOST to CloudFront
2. Restore SSM parameters
3. The SST stack remains deployable via `pnpm deploy`