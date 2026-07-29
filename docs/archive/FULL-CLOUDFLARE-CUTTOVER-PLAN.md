# Full Cloudflare Workers Migration Plan

## AWS to Cloudflare Workers Cutover - Cloudless.gr

### Executive Summary

This plan completes the migration of cloudless.gr from AWS (Lambda@Edge, Lambda, DynamoDB, S3, CloudFront, Athena, Bedrock, SSM) to Cloudflare Workers (Free Tier) with Fly.io providing HA failover. The Workers entry point (`src/index-cloudflare-free.js`) already handles Auth, Static Assets, Analytics, and Chat. Remaining 200+ Lambda routes need to be migrated.

---

## Current Architecture State

### AWS Services Inventory

| Service | Lambda@Edge? | Migration Target | Status |
|---------|---------------|------------------|--------|
| **Lambda@Edge** | ✅ Yes | Workers (edge functions) | Pending |
| **Lambda (SST/Next.js)** | ❌ No | Workers + D1/R2/AI | Partial |
| **CloudFront** | N/A | Workers Routes | ✅ Migrated |
| **SSM Parameters** | N/A | Wrangler secrets | ✅ 15/20 synced |
| **DynamoDB** | N/A | D1 | ⏸️ IAM blocked |
| **S3 (assets)** | N/A | R2 | ⏸️ Ready to migrate |
| **S3 (analytics)** | N/A | R2 | ⏸️ Ready to migrate |
| **SES** | N/A | Email binding | ✅ Ready |
| **Bedrock (Nova)** | N/A | Workers AI | ⚠️ Partial |
| **Athena** | N/A | DuckDB-Wasm | ✅ Ready |
| **Cognito** | N/A | D1 Auth | ✅ Ready |
| **SNS** | N/A | Webhook/Slack | Pending |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Fly.io HA Proxy (Edge Entry Point)                      │
│  PRIMARY_HOST = cloudless.gr (Cloudflare Workers)                            │
│  FALLBACK_HOST = github-omv.tail4ecae1.ts.net (Pi/k3s via Tailscale)        │
└─────────────────────────────────────────────────────────────────────────────┘
                            │ Health Check every 30s
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE WORKERS                                │
│  ✅ Auth: register, login, logout, session, password reset (D1)             │
│  ✅ Static Assets: R2 (ASSETS_BUCKET)                                       │
│  ✅ Analytics: parquet endpoint (ANALYTICS_BUCKET)                          │
│  ⚠️  Chat: Workers AI (ANTHROPIC_API_KEY fallback needed)                   │
│  ❌ Lambda routes not migrated (see below)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Migration Execution Plan

### Phase 1: Data Migration (Critical Path)

#### 1.1 DynamoDB → D1 Migration

**Status: Blocked - IAM Permissions**

Required: `dynamodb:Scan` permission for `cloudless-ops` user

```bash
# Run the IAM permission fix
pnpm tsx scripts/add-dynamodb-migration-permissions.sh

# Then migrate data
CLOUDFLARE_API_TOKEN=$CF_TOKEN AWS_PROFILE=default pnpm tsx scripts/migrate-dynamodb-to-d1.ts
```

**Tables to migrate:**

| DynamoDB Table | D1 Table | Records |
|---------------|----------|---------|
| cloudless-production-UserProfileTable | user | ~1,000 |
| cloudless-production-SessionTokenStoreTable | session | ~500 |
| cloudless-production-StripeTransactionsTable | stripe_transaction | ~2,000 |
| cloudless-production-AdminNotificationsTable | admin_notification | ~5,000 |
| cloudless-production-AnalyticsCacheTable | analytics_cache | ~50 |

#### 1.2 S3 → R2 Migration (Assets & Data Lake)

**Status: Script ready**

```bash
# Migrate static assets from S3 to R2
pnpm tsx scripts/migrate-s3-to-r2.mjs cloudless-assets
pnpm tsx scripts/migrate-s3-to-r2.mjs app-media-bucket

# Migrate data lake (analytics data)
pnpm tsx scripts/migrate-s3-to-r2.mjs cloudless-analytics-data
```

---

### Phase 2: API Routes Migration

#### 2.1 Critical Routes (Priority 1)

These routes have direct Cloudflare replacements:

| Route | AWS Service | Cloudflare Replacement | Worker Code Status |
|-------|-------------|---------------------|-------------------|
| `/api/chat` | Bedrock (Nova) | Workers AI `@cf/meta/llama-3.1-8b-instruct` | ✅ Partial |
| `/api/contact` | SES | Email binding (`env.EMAIL.send()`) | ✅ Fallback exists |
| `/api/subscribe` | SES + DynamoDB | Email + D1 | ✅ Migrated |
| `/api/webhooks/stripe` | Lambda | Worker webhook handler | ❌ Not migrated |

#### 2.2 Analytics Routes (Priority 2)

Athena → DuckDB-Wasm migration:

| Route | Purpose | Replacement |
|-------|---------|-------------|
| `/api/analytics/*` | Server-side Athena | Client-side DuckDB-Wasm with R2 parquet |
| `/api/admin/analytics/*` | Admin dashboard queries | Pre-computed parquet in ANALYTICS_BUCKET |
| `/api/cron/analytics-rollup` | Daily aggregation | Workers Cron Trigger |

#### 2.3 Lambda@Edge Migration (Priority: HIGH)

Since CloudFront has been deleted, any Lambda@Edge functions you had for:

- A/B testing at the edge
- Geo-routing
- Header rewrites
- Authentication redirects

These should be migrated to **Workers middleware** patterns. Cloudflare Workers runs at the edge by default, making Lambda@Edge unnecessary.

**Lambda@Edge → Workers Middleware Examples:**

```typescript
// src/middleware/ab-testing.ts
export async function abTestingMiddleware(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const experiment = url.searchParams.get("exp");
  
  if (experiment === "b") {
    url.searchParams.set("variant", "b");
    return Response.redirect(url.toString(), 302);
  }
  
  return null; // Continue to next middleware
}

// src/middleware/geo-redirect.ts
export async function geoRedirectMiddleware(request: Request, env: Env): Promise<Response | null> {
  const country = request.cf?.country;
  
  if (country === "GR") {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/el")) {
      url.pathname = `/el${url.pathname}`;
      return Response.redirect(url.toString(), 301);
    }
  }
  
  return null;
}
```

#### 2.4 Lambda Routes to Worker Endpoints

The following route categories need migration (221 total routes):

**Migration Strategy:** Selective cut-over per category

```typescript
// Add to src/index-cloudflare-free.js incrementally
// Example: Contact endpoint migration
if (url.pathname === "/api/contact" && method === "POST") {
  // Handle contact form with EMAIL binding
  // Log to DATALAKE_BUCKET via NDJSON
}
```

---

### Phase 3: Cron Jobs → Workers Cron Triggers

Current Lambda cron schedule:

| Lambda Cron | Schedule | Priority | Worker Implementation |
|-------------|----------|----------|----------------------|
| analytics-rollup | 01:00 UTC daily | HIGH | Workers Cron Trigger |
| calendar-digest | 06:00 UTC weekdays | MED | Workers Cron Trigger |
| gsc-cache-refresh | Hourly | MED | Workers Cron Trigger |
| report-cleanup | 02:00 UTC Sundays | LOW | Workers Cron Trigger |
| voice-brief | 05:00 UTC Mondays | LOW | Workers Cron Trigger |

**Configuration in wrangler.jsonc:**

```jsonc
{
  "triggers": [
    { "type": "cron", "cron": "0 1 * * *", "name": "analytics-rollup" },
    { "type": "cron", "cron": "0 6 ? * MON-FRI *", "name": "calendar-digest" },
    { "type": "cron", "cron": "0 * * * *", "name": "gsc-cache-refresh" },
    { "type": "cron", "cron": "0 2 ? * SUN *", "name": "report-cleanup" },
    { "type": "cron", "cron": "0 5 ? * MON *", "name": "voice-brief" }
  ]
}
```

---

### Phase 4: Secrets & Configuration

#### 4.1 Missing Secrets (from sync-ssm-to-wrangler.ts)

```bash
# Set missing secrets manually if not in SSM
echo "secret_value" | npx wrangler secret put SESSION_SECRET
echo "secret_value" | npx wrangler secret put ANTHROPIC_API_KEY
echo "secret_value" | npx wrangler secret put SLACK_WEBHOOK_URL
```

Required secrets:

- `SESSION_SECRET` - Auth session signing
- `ANTHROPIC_API_KEY` - Fallback for chat (if Workers AI unavailable)
- `SLACK_WEBHOOK_URL` - Notifications
- `SLACK_OPS_USERS` - Admin user list
- `GITHUB_DISPATCH_TOKEN` - GitHub Actions triggering
- `AGENT_AUTH_TOKEN` - MCP agent authentication

---

### Phase 5: Fly.io HA Failover Update

**Current fly.toml:**

- PRIMARY_HOST: `cloudless.gr` (✅ Workers)
- FALLBACK_HOST: `github-omv.tail4ecae1.ts.net` (Pi via Tailscale)

**To add Workers secondary (Lambda fallback):**
If you want to keep Lambda as secondary instead of/ in addition to Pi:

```toml
# Add to fly.toml for Lambda fallback
[env]
  FALLBACK_CF = "d3k7muo3c6lw6s.cloudfront.net"  # Old CloudFront
  FALLBACK_LAMBDA = "api.cloudless.gr"  # If Lambda has direct endpoint
```

---

### Phase 6: Validation & Cutover

#### 6.1 Pre-Cutover Checklist

- [ ] All secrets synced to Wrangler
- [ ] DynamoDB data migrated to D1
- [ ] S3 data migrated to R2
- [ ] Chat endpoint fully migrated to Workers AI
- [ ] Contact form using Email binding
- [ ] Stripe webhook endpoint migrated
- [ ] All cron jobs converted to Workers Triggers
- [ ] Client-side analytics (DuckDB-Wasm) tested

#### 6.2 Gradual Cutover Strategy

```bash
# 1. Deploy updated Worker with additional routes
pnpm cf:deploy:free

# 2. Test specific endpoints before cutover
curl https://cloudless.gr/api/health
curl https://cloudless.gr/api/chat -X POST -d '{"messages":[{"role":"user","content":"test"}]}'

# 3. Update Fly.io to point to Worker-first
flyctl deploy --app cloudless-proxy --image updated-worker
```

#### 6.3 Monitoring During Cutover

```bash
# Watch Worker logs
npx wrangler tail cloudless-gr

# Check Fly.io health
curl https://cloudless-proxy.fly.dev/health

# Monitor D1 queries
npx wrangler d1 query user-auth-db --remote "SELECT COUNT(*) FROM user" --format pretty
```

---

## Execution Commands

### Step 1: Fix IAM Permissions

```bash
# Add DynamoDB read permissions for migration
AWS_PROFILE=default pnpm tsx scripts/add-dynamodb-migration-permissions.sh
```

### Step 2: Sync Missing Secrets

```bash
# Ensure CLOUDFLARE_API_TOKEN is set
export CLOUDFLARE_API_TOKEN=$YOUR_TOKEN

# Sync all available SSM secrets
AWS_PROFILE=default pnpm tsx scripts/sync-ssm-to-wrangler.ts
```

### Step 3: Migrate DynamoDB → D1

```bash
# Migrate all tables
CLOUDFLARE_API_TOKEN=$CF_TOKEN AWS_PROFILE=default pnpm tsx scripts/migrate-dynamodb-to-d1.ts
```

### Step 4: Migrate S3 → R2

```bash
# Use rclone for large transfers (leveraging CloudShift's expertise)
rclone sync s3:cloudless-assets r2:cloudless-assets --transfers=10
rclone sync s3:cloudless-analytics-data r2:datalake-bucket --transfers=10
```

### Step 5: Deploy Worker with All Routes

```bash
# Build and deploy
pnpm cf:build && pnpm cf:deploy:free
```

### Step 6: Configure Fly.io Cron Jobs

```bash
# Create scheduled machines for Lambda cron fallback (if needed)
# Or migrate to Workers Cron Triggers
flyctl machines schedule --app cloudless-proxy --cron "0 1 * * *"
```

---

## Post-Migration Cleanup (AWS Resources)

Once fully validated on Workers:

1. **Delete CloudFront distribution** (already done per docs)
2. **Delete Cognito User Pool** - after confirming D1 auth works
3. **Delete DynamoDB tables** - after confirming D1 migration
4. **Delete S3 buckets** - after confirming R2 migration
5. **Delete Athena workgroup** - after confirming DuckDB-Wasm works
6. **Revoke Bedrock IAM permissions** - after confirming Workers AI

---

## Rollback Plan

If issues arise:

1. **Immediate:** Fly.io falls back to Pi/k3s cluster
2. **If Pi fails:** Re-deploy old SST stack

```bash
# Quick rollback to SST/Lambda
AWS_PROFILE=default pnpm deploy
```

3. **Restore from backup:**

```bash
# DynamoDB backup restore
aws dynamodb restore-table-from-backup --target-table-name user-profile-restored
```

---

## Migration Timeline

| Week | Tasks |
|------|-------|
| Week 1 | DynamoDB migration + S3 → R2 |
| Week 2 | Analytics (Athena → DuckDB-Wasm) |
| Week 3 | Chat (Bedrock → Workers AI) |
| Week 4 | Remaining routes + Cron triggers |
| Week 5 | Validation + AWS cleanup |

---

## Success Metrics

- [ ] All auth flows working without Cognito
- [ ] Static assets loading from R2
- [ ] Chat responses from Workers AI
- [ ] Newsletter subscription working
- [ ] Analytics dashboard functional with DuckDB-Wasm
- [ ] All cron jobs running via Workers
- [ ] Monthly AWS bill reduced by ~80%
