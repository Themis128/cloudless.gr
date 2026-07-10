# Safe Migration Plan: AWS CloudFront → Cloudflare Workers CDN

> **Migration Type**: AWS Serverless → Cloudflare Free Tier  
> **Estimated Timeline**: 2-3 weeks (2 weeks preparation, 1 week testing/cutover)  
> **Rollback Window**: 7 days post-cutover  
> **Cost Impact**: ~$40-80/month (AWS) → $0-10/month (Cloudflare)

---

## 🚨 CRITICAL BREAKING CHANGES

Before proceeding, acknowledge these irreversible changes:

| Component | AWS Feature | Cloudflare Free Alternative | Impact |
|-----------|-------------|---------------------------|--------|
| **Authentication** | Cognito Hosted UI + OAuth + MFA | Email/password only | ⚠️ All users must reset passwords |
| **Password Reset** | Cognito automatic flow | Custom email implementation | ⚠️ New flow required |
| **MFA/SSO** | Built-in TOTP + Social providers | ❌ Not available | ⚠️ Must inform users |
| **Serverless Cron** | Lambda scheduled events | GitHub Actions (free tier) | ⚠️ 5-min minimum granularity |
| **Analytics** | Server-side Athena | Client-side DuckDB-Wasm | ⚠️ Browser-only querying |

---

## Phase 1: Pre-Migration Assessment (Week 1)

### 1.1 Infrastructure Audit

```bash
# Check current AWS resource usage
aws cloudfront list-distributions --query 'DistributionList.Items[].{Id:Id,Status:Status,DomainName:DomainName}'
aws dynamodb describe-table --table-name cloudless-user-profiles --query 'Table.TableSizeBytes'
aws s3 ls s3://cloudless-analytics-data --recursive --human-readable --summarize | tail -5
aws lambda get-function --function-name $(terraform output -raw lambda_function_name) --query 'Configuration.MemorySize'
```

### 1.2 Cloudflare Setup Prerequisites

- [ ] **Cloudflare Account**: Ensure CLOUDFLARE_API_TOKEN has Zone.Zone + Zone.DNS permissions
- [ ] **R2 Access**: Enable in https://dash.cloudflare.com → R2 → Enable
- [ ] **D1 Access**: Enable in https://dash.cloudflare.com → D1 → Enable
- [ ] **Workers Paid Plan Decision**: Free tier gives 100K req/day; may need $5/month for 1M req

### 1.3 Usage Monitoring Baseline

```bash
# Track current request volume (must stay under 100K/day for free tier)
# Install CloudWatch metric dashboard
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=cloudless-gr \
  --start-time $(date -d '1 day ago' +%s) \
  --end-time $(date +%s) \
  --period 86400
```

---

## Phase 2: Infrastructure Setup (Week 1, Days 1-2)

### 2.1 Create R2 Buckets

```bash
# Execute via Wrangler CLI
npx wrangler r2 bucket create cloudless-assets
npx wrangler r2 bucket create cloudless-analytics
npx wrangler r2 bucket create cloudless-uploads
```

### 2.2 Create D1 Database

```bash
# Create the database
npx wrangler d1 create cloudless-auth

# Note the database_id from output and update wrangler.jsonc
# The ID looks like: 7ca74513-23c3-412a-b9ca-b0c55835973d
```

### 2.3 Apply D1 Schema

```bash
# Update wrangler.jsonc with actual DB ID first
# Then run migration
npx wrangler d1 execute cloudless-auth --file=./migrations/0001-auth-schema.sql
```

### 2.4 Sync SSM Secrets

```bash
# List all SSM parameters to migrate
aws ssm describe-parameters \
  --parameter-filters Key=Path,Option=Recursive,Values="/cloudless/production" \
  --query 'Parameters[*].Name' \
  --output text

# Run sync script (one-time migration)
AWS_PROFILE=default CLOUDFLARE_API_TOKEN=xxx npx tsx scripts/sync-ssm-to-wrangler.ts
```

### 2.5 Configure wrangler.jsonc Bindings

Update `/home/tbaltzakis/cloudless.gr/wrangler.jsonc`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "cloudless-gr",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-01",
  "compatibility_flags": ["nodejs_compat"],
  
  "vars": {
    "NEXT_PUBLIC_AUTH_PROVIDER": "d1",
    "NEXT_PUBLIC_SITE_URL": "https://cloudless.gr"
  },
  
  "r2_buckets": [
    { "binding": "ASSETS_BUCKET", "bucket_name": "cloudless-assets" },
    { "binding": "ANALYTICS_BUCKET", "bucket_name": "cloudless-analytics" }
  ],
  
  "d1_databases": [
    { 
      "binding": "AUTH_DB", 
      "database_name": "cloudless-auth", 
      "database_id": "<YOUR_D1_ID_FROM_STEP_2.2>"
    }
  ]
}
```

---

## Phase 3: Authentication Migration (Week 2)

### 3.1 Create Auth Library

Create `src/lib/auth-d1.ts`:

```typescript
import { Lucia } from "lucia";
import { D1Adapter } from "lucia-adapter-d1";

// D1 adapter for Lucia sessions
// Email/password authentication replacing Cognito
// See MIGRATION-CLOUDFLARE-FREE.md for full implementation
```

### 3.2 User Migration Script

```bash
# Export Cognito users (requires AWS console or CLI with user pool access)
# Users will need password reset emails sent

# Alternative: Keep Cognito running in parallel during transition
# Let users authenticate via Cognito, then migrate to D1 on next login
```

### 3.3 Registration Flow

Create `src/app/api/auth/register/route.ts`:
- Verify email uniqueness
- Hash password with bcrypt
- Create user record in D1
- Send verification email via SendGrid/Mailgun

---

## Phase 4: Data Layer Migration (Week 2, Days 3-4)

### 4.1 Migrate DynamoDB → D1

```bash
# Dry-run first (check SELECT statements)
AWS_PROFILE=default npx tsx scripts/migrate-dynamodb-to-d1.ts --dry-run

# Execute migration
AWS_PROFILE=default npx tsx scripts/migrate-dynamodb-to-d1.ts
```

### 4.2 Update Application Code

Replace imports in:
- `src/app/api/user/purchases/route.ts` (StripeTransactions)
- `src/app/api/user/consultations/route.ts` (Calendar bookings)
- `src/app/api/admin/users/route.ts` (UserProfile)
- `src/app/api/admin/analytics/route.ts` (AnalyticsCache)

Replace:
```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
```

With:
```typescript
// Fetch via API routes or direct D1 queries
import { AUTH_DB } from "wrangler.jsonc";
```

---

## Phase 5: Analytics Migration (Week 2, Days 4-5)

### 5.1 DuckDB-Wasm Setup

Client-side analytics implementation in `src/lib/analytics-client.ts`:
- Stream parquet files from R2
- Run queries in browser
- Cache results in localStorage

### 5.2 API Endpoint for R2 Parquet

Create `src/app/api/analytics/r2/route.ts` (exists in MIGRATION-CLOUDFLARE-FREE.md)

---

## Phase 6: Cron Jobs Alternative (Week 2, Day 5)

### 6.1 GitHub Actions Scheduler

Create `.github/workflows/cron-free-tier.yml`:

```yaml
name: Free Tier Cron Jobs
on:
  schedule:
    # Daily at 01:00 UTC (analytics rollup)
    - cron: '0 1 * * *'
    # Weekdays at 06:00 UTC (calendar digest)
    - cron: '0 6 * * 1-5'
    # Hourly (GSC cache refresh)
    - cron: '0 * * * *'

jobs:
  analytics-rollup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx wrangler d1 execute cloudless-auth --file scripts/analytics-rollup.sql
```

---

## Phase 7: Testing & Staging (Week 3)

### 7.1 Staging Deployment

```bash
# Create staging environment in wrangler.jsonc
npx wrangler deploy --env=staging
```

### 7.2 Test Auth Flow

- [ ] Register new user via `/api/auth/register`
- [ ] Login via `/api/auth/login`
- [ ] Access protected routes (`/dashboard`, `/admin`)
- [ ] Session persistence across restarts
- [ ] Admin access verified

### 7.3 Test Data Operations

- [ ] User profile CRUD
- [ ] Stripe webhook handling
- [ ] Admin notifications
- [ ] Analytics queries

### 7.4 Free Tier Limits Check

```bash
# Check Workers request count (must be <100K/day)
npx wrangler analytics --date 2026-07-01

# Check R2 storage (must be <10GB)
npx wrangler r2 bucket list

# Check D1 storage (must be <500MB)
npx wrangler d1 list
```

---

## Phase 8: Cutover Plan (Week 3, Day 6-7)

### 8.1 Pre-Cutover Checklist

- [ ] **Day 6, 10:00 UTC**: Final DynamoDB → D1 sync
- [ ] **Day 6, 14:00 UTC**: Verify all tests pass
- [ ] **Day 6, 16:00 UTC**: Notify users of maintenance window

### 8.2 DNS Switch Procedure

**Option A: Update wrangler.jsonc routes (Recommended)**

If wrangler.jsonc already has routes configured and domain is on Cloudflare:
```bash
# Deploy to production
npx wrangler deploy

# Domain cloudless.gr will automatically point to Workers
# No DNS change needed - Cloudflare serves Workers on the zone
```

**Option B: CNAME swap**

```bash
# Keep CloudFront as backup
# Point CNAME at Workers endpoint
# This requires Cloudflare Load Balancer (paid) or manual DNS update
```

### 8.3 Monitoring During Cutover

```bash
# Watch Workers logs
npx wrangler tail

# Watch Cloudflare analytics
npx wrangler analytics --date $(date +%Y-%m-%d)

# Health check every 5 minutes
watch -n 300 'curl -sI https://cloudless.gr/api/health'
```

---

## Phase 9: Rollback Procedure

### 9.1 Immediate Rollback (within 7 days)

If issues arise, execute in order:

1. **DNS Revert**
   ```bash
   # Point cloudless.gr back to CloudFront
   # Keep Workers deployment as backup
   ```

2. **Authentication Revert**
   - Cognito still active (users can log in)
   - No password reset needed (original auth restored)

3. **Data Sync**
   ```bash
   # Sync D1 changes back to DynamoDB if any occurred
   npx tsx scripts/d1-to-dynamodb-backup.ts
   ```

### 9.2 Gradual Rollback

If rollback happens after 7 days:

1. **Users**: Must reset passwords (seamless if revert within 24h)
2. **Data**: Run migration script backwards (D1 → DynamoDB)
3. **DNS**: Same as immediate rollback

---

## Phase 10: Post-Migration Optimization

### 10.1 Workers Optimization

```bash
# Enable caching for static assets
# Add cache-control headers in Worker
# Configure routes in wrangler.jsonc for optimal caching
```

### 10.2 Cost Monitoring

Set up alerts for free tier limits:

| Resource | Limit | Alert Threshold |
|----------|-------|-----------------|
| Workers Requests | 100K/day | >80K/day |
| R2 Storage | 10GB/month | >8GB/month |
| D1 Storage | 500MB | >400MB |
| Workers AI | 100K tokens/day | >80K tokens |

---

## 📋 Files Reference

| File | Purpose | Action Required |
|------|---------|-----------------|
| `wrangler.jsonc` | Cloudflare Worker config | ✅ Update D1 database_id |
| `migrations/0001-auth-schema.sql` | D1 schema | ✅ Apply via Wrangler |
| `scripts/sync-ssm-to-wrangler.ts` | Secret migration | ✅ Run to migrate secrets |
| `scripts/migrate-dynamodb-to-d1.ts` | Data migration | ✅ Run to migrate data |
| `scripts/deploy-cloudflare.sh` | Deployment script | ✅ Run for cutover |
| `docs/MIGRATION-CLOUDFLARE-FREE.md` | Full guide | ✅ Read for details |
| `.github/workflows/deploy-cloudflare.yml` | (Needs creation) CI/CD | ⬜ Create for automation |

---

## 🚦 Go/No-Go Decision Matrix

Before starting migration:

| Criteria | Status | Notes |
|----------|--------|-------|
| R2/D1 enabled in Cloudflare | ⬜ Pending | Check Dashboard |
| API token has Zone DNS permissions | ⬜ Pending | Verify in IAM |
| Current request volume <100K/day | ⬜ Pending | Monitor for 3 days |
| All SSM secrets identified | ⬜ Pending | Run audit script |
| D1 schema applied | ⬜ Pending | Run migration |
| Admin users notified of MFA loss | ⬜ Pending | Communication plan |

---

## Quick Start Commands

```bash
# Day 1: Infrastructure setup
npx wrangler r2 bucket create cloudless-assets
npx wrangler r2 bucket create cloudless-analytics
npx wrangler d1 create cloudless-auth

# Apply schema
npx wrangler d1 execute cloudless-auth --file=./migrations/0001-auth-schema.sql

# Sync secrets
AWS_PROFILE=default npx tsx scripts/sync-ssm-to-wrangler.ts

# Deploy staging
npx wrangler deploy --env=staging

# Cutover
npx wrangler deploy --env=production
```

---

## 🔒 Security Considerations

1. **JWT signing**: AUTH_SECRET must be identical in Workers secrets
2. **CORS**: Reconfigure for Workers origin (different from CloudFront)
3. **Rate limiting**: Workers use different mechanisms (see `src/lib/cloudflare-rate-limit.ts`)
4. **Security headers**: Configure via Worker or Cloudflare WAF rules
5. **Stripe webhooks**: Update endpoint URL after cutover

---

## 📊 Success Metrics

- [ ] All pages load within 200ms (Cloudflare edge)
- [ ] Auth flow works for all users
- [ ] Analytics queries return in <1s (DuckDB-Wasm)
- [ ] Under 100K Workers requests/day
- [ ] No data loss during transition
- [ ] Rollback tested and documented