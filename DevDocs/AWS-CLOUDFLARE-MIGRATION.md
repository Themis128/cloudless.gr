# AWS to Cloudflare Migration - DevDocs

> **Status: COMPLETE** - All core AWS services migrated to Cloudflare Free Tier

## 1. Migration Status Matrix

### Completed Services Migration

| AWS Service | Migration Target | Status | Implementation Details |
|-------------|------------------|--------|------------------------|
| **DynamoDB** | D1 (SQLite) | ✅ **Complete** | `user-auth-db` with 8 tables migrated via `scripts/migrate-dynamodb-to-d1.ts` |
| **S3 (assets)** | R2 | ✅ **Complete** | 4 buckets: `cloudless-assets`, `app-media-bucket`, `cloudless-analytics`, `datalake-bucket` |
| **SES** | Cloudflare Email Service | ✅ **Complete** | Email binding in `wrangler.json` - primary transport in `src/lib/email-sender.ts` |
| **Bedrock (Nova)** | Workers AI | ✅ **Complete** | Inline in Worker (`@cf/meta/llama-3.1-8b-instruct`) with Anthropic fallback |
| **Cognito** | D1 Auth | ✅ **Complete** | Email/password auth with server-side sessions in `src/index-cloudflare-free.js` |
| **SSM** | Wrangler Secrets | ✅ **Complete** | All secrets synced via `scripts/sync-ssm-to-wrangler.ts` |
| **CloudFront** | Workers Routes | ✅ **Complete** | Routes configured in `wrangler.json` |
| **Lambda@Edge** | Workers | ✅ **Complete** | Unified handler in `src/index-cloudflare-free.js` (897 lines) |
| **Athena** | DuckDB-Wasm + R2 Parquet | ✅ **Complete** | Client-side queries via `/api/analytics/r2` endpoint |
| **SNS** | Webhook/Slack | ✅ **Complete** | Integrated via `src/lib/sns-notify.ts` (retained for backward compatibility) |

### Cron Jobs Migration

| Cron Job | Schedule | Status | Worker Implementation |
|----------|----------|--------|---------------------|
| `analytics-rollup` | 01:00 UTC daily | ✅ Complete | Cron trigger 1 |
| `calendar-digest` | 06:00 UTC weekdays | ✅ Complete | Cron trigger 2 |
| `gsc-cache-refresh` | Hourly | ✅ Complete | Cron trigger 3 |
| `report-cleanup` | 02:00 UTC Sundays | ✅ Complete | Cron trigger 4 |
| `voice-brief` | 05:00 UTC Mondays | ✅ Complete | Cron trigger 5 |

## 2. Remaining Code Cleanup

### Files Requiring Migration Cleanup

The following files still contain AWS SDK dependencies that are no longer actively used in production. They serve as fallback bridges and can be cleaned up after validation:

#### Critical Cleanup Required

```markdown
| File | Issue | Action Required |
|------|-------|-----------------|
| `src/lib/athena.ts` | Athena client for AWS | Remove - DuckDB-Wasm client-side queries now active |
| `src/lib/bedrock-chat.ts` | Bedrock SDK imports | Retain fallback only - Workers AI is primary |
| `src/lib/bedrock-shared.ts` | Bedrock client factory | Remove if Workers AI is sufficient |
| `src/lib/cognito-auth.ts` | Cognito user pool logic | Remove after full validation - D1 Auth replaces |
| `src/lib/amplify-config.ts` | AWS Amplify shim | Remove - no longer needed |
| `src/lib/ssm-config.ts` | SSM parameter fetching | Retained for backward compatibility + Lambda fallback |
| `src/lib/session-token-store-d1.ts` | Legacy bridge code | Remove - superseded by Worker-native auth |
| `src/lib/session-token-store.ts` | DynamoDB fallback | Remove - fully migrated to D1 |
```

#### Partial Cleanup Required (Monitoring/Analytics)

```markdown
| File | Issue | Action Required |
|------|-------|-----------------|
| `src/lib/analytics.ts` | S3 exports for analytics | Update to use R2 instead of S3 |
| `src/lib/cost-analytics.ts` | S3 client for cost data | Migrate to R2 or remove |
| `src/lib/ses-suppression.ts` | SESv2 client | Retain fallback - Cloudflare Email primary |
| `src/lib/sns-notify.ts` | SNS client for notifications | Retain - used for admin alerts |
```

#### Dependencies to Remove

After cleanup, remove these AWS SDK packages from `package.json`:

```json
{
  "dependencies": {
    "@aws-sdk/client-athena": "REMOVE",
    "@aws-sdk/client-bedrock-runtime": "REMOVE",
    "@aws-sdk/client-cognito-identity-provider": "REMOVE",
    "@aws-sdk/client-dynamodb": "REMOVE",
    "@aws-sdk/client-s3": "REMOVE",
    "@aws-sdk/client-sesv2": "REMOVE",
    "@aws-sdk/client-sns": "REMOVE"
  }
}
```

**Note:** These packages are currently ~$120kB combined and can be removed once the Lambda fallback paths are no longer needed.

### Cleanup Script

```bash
# Dry-run check: See what AWS SDK code is still imported
npx tsx scripts/check-remaining.ts

# After validation, remove unused files:
rm src/lib/athena.ts src/lib/bedrock-shared.ts src/lib/session-token-store.ts
# Keep aws-sdk packages temporarily for Lambda fallback
```

## 3. Running the Application with Cloudflare Stack

### Prerequisites

1. **Cloudflare Account** with Workers paid plan (Free tier has cold starts)
2. **Wrangler installed**: `pnpm add -g wrangler`
3. **Required secrets** set (see secrets sync below)

### Development Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
# Copy .dev.vars.example to .dev.vars and configure:
# SESSION_SECRET=<generate with: openssl rand -hex 32>
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# 3. Run local development (Next.js dev server)
pnpm dev
# App runs at http://localhost:4000

# 4. Or run Worker locally with full stack
pnpm cf:dev
# Worker runs at http://localhost:8787
```

### Production Deployment

```bash
# Full deployment (build -> R2 -> Workers)
pnpm cf:deploy:full

# Or step-by-step:
pnpm cf:build              # Next.js static export
pnpm cf:r2:upload-dir      # Upload to R2
pnpm cf:deploy:free        # Deploy Worker from wrangler-cloudflare-free.json

# Staging deployment
pnpm cf:deploy:staging
```

### Setting Secrets

```bash
# Add secrets to Cloudflare Worker
npx wrangler secret put SESSION_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put ANTHROPIC_API_KEY  # Optional fallback

# Verify secrets are set
npx wrangler secret list
```

### Verifying Deployment

```bash
# Health check
curl https://cloudless.gr/api/health
# Expected: {"status":"ok","authProvider":"d1","dbConnected":true}

# Services status
curl https://cloudless.gr/api/services
# Expected: {"services":{"auth":true,"email":true,"ai":true,...},"allOk":true}

# Auth endpoints
curl -X POST https://cloudless.gr/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'

curl https://cloudless.gr/api/auth/session
```

### Environment Variables Reference

```bash
# Required (set in wrangler.json vars section)
NEXT_PUBLIC_AUTH_PROVIDER=d1
NEXT_PUBLIC_SITE_URL=https://cloudless.gr
ENVIRONMENT=production
SESSION_SECRET=<auto-injected>

# Secrets (set via `npx wrangler secret put`)
SESSION_SECRET       # Auth password hashing
STRIPE_SECRET_KEY    # Stripe checkout
STRIPE_WEBHOOK_SECRET # Webhook validation
ANTHROPIC_API_KEY    # Optional AI fallback
SLACK_WEBHOOK_URL    # Admin notifications
SLACK_BOT_TOKEN      # Slack integration
```

## 4. Rollback Procedures

### When to Rollback

| Trigger | Action |
|---------|--------|
| Worker down/crash | DNS -> Fly.io Pi |
| Auth issues | Check D1 + Secrets |
| R2 outage | Check static assets |
| Full rollback needed | Restore AWS services |

### Scenario A: Emergency Failover to AWS (Complete Reversal)

**Timeline:** ~30 minutes

```bash
# Step 1: Point DNS to Fly.io backup (Pi/k3s)
# Edit fly-proxy-app/proxy.py to point to Lambda endpoint
# Deploy: pnpm deploy --stage production

# Step 2: Restore Cognito (users need password reset)
pnpm cognito:setup

# Step 3: Recreate DynamoDB tables if deleted
aws dynamodb create-table \
  --table-name cloudless-session-tokens \
  --attribute-definition AttributeName=sessionId,AttributeType=S \
  --key-schema AttributeName=sessionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Step 4: Update frontend config
NEXT_PUBLIC_AUTH_PROVIDER=cognito
```

### Scenario B: Auth Recovery Only

If users cannot login due to session/secret issues:

```bash
# Reset SESSION_SECRET
NEW_SECRET=$(openssl rand -hex 32)
npx wrangler secret put SESSION_SECRET <<< "$NEW_SECRET"

# Users must reset passwords:
# - Worker sends reset emails via EMAIL binding
# - /api/auth/reset-password endpoint active
```

### Scenario C: Data Recovery

If D1 data is corrupted:

```bash
# D1 has automatic 24-hour backups
# To restore:
npx wrangler d1 execute user-auth-db \
  --restore-from-backup-id=<backup-timestamp> \
  --remote

# Or re-import from DynamoDB (if not deleted):
AWS_PROFILE=default pnpm tsx scripts/migrate-dynamodb-to-d1.ts
```

### Pre-Rollback Backup Commands

```bash
# Export D1 data
npx wrangler d1 export user-auth-db --output=backup/d1-export.sql --remote

# Backup R2 assets
npx wrangler r2 object get cloudless-assets --recursive --local-path ./backup/r2/

# Backup analytics parquet
npx wrangler r2 object get cloudless-analytics --recursive --local-path ./backup/analytics/
```

### Rollback Validation Checklist

- [ ] Health endpoint returns 200 with `authProvider: "d1"`
- [ ] `/api/auth/login` works with test credentials
- [ ] `/api/contact` sends emails (check admin mailbox)
- [ ] `/api/chat` responds with Workers AI or fallback
- [ ] Static assets load from R2 (`/static/` paths)
- [ ] Cron triggers fire at scheduled times
- [ ] Stripe webhook receives test event

## 5. Architecture Summary

### Current Stack (Post-Migration)

```
cloudless.gr (Workers)
├── Routes: /api/auth/*, /api/chat, /api/contact, /api/services, /api/health
├── Bindings:
│   ├── R2: cloudless-assets, app-media-bucket, cloudless-analytics, datalake-bucket
│   ├── D1: user-auth-db (users, sessions, transactions)
│   ├── AI: Workers AI (@cf/meta/llama-3.1-8b-instruct)
│   ├── Email: send_email (Cloudflare Email Service)
│   └── Analytics: AnalyticsEngineDataset
└── HA Failover: Fly.io -> Pi (omv.tail8eb71.ts.net)
```

### Data Flow

1. **Auth Flow**: User login -> Worker -> D1 lookup/verify -> Session cookie
2. **Chat Flow**: POST /api/chat -> Workers AI -> Streaming SSE response
3. **Contact Flow**: POST /api/contact -> Worker -> D1 log + Email send + Datalake R2

## 6. Verification Commands

```bash
# Quick health check
curl -s https://cloudless.gr/api/health | jq

# Test auth flow
curl -X POST https://cloudless.gr/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@test.com","password":"Password123!"}' | jq

# Test chat
curl -X POST https://cloudless.gr/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"ping"}]}' | head -c 200

# Test services endpoint
curl -s https://cloudless.gr/api/services | jq
```

---

**Last Updated:** 2026-07-18  
**Maintainer:** tbaltzakis@cloudless.gr  
**Status:** Migration complete - validation in progress
