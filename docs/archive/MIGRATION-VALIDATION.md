# Migration Validation Plan

## Current Architecture Status

```
cloudless.gr → Cloudflare Workers (auth/assets/analytics/health)
            → AWS Lambda fallback (221 API routes)
            → Pi/k3s tertiary fallback
```

## Why Hybrid is Optimal

1. **Workers handles critical surfaces** (auth, static assets, health) with no external dependencies
2. **Lambda fallback is cost-effective** (Serverless with provisioned concurrency = ~$5/month when idle)
3. **Pi cluster provides disaster recovery** without additional cost
4. **Gradual migration** reduces risk vs big-bang approach (~10,000+ lines of code)

## Validation Tests

### 1. Workers Endpoints (Primary)
```bash
# Auth - D1 based
curl -X POST https://cloudless.gr/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}'

# Health check
curl https://cloudless.gr/api/health
# Expected: {"status":"ok","dbConnected":true}

# Static assets via R2
curl -I https://cloudless.gr/static/logo.png
# Expected: 200 OK with Cache-Control

# Analytics parquet
curl https://cloudless.gr/api/analytics/r2?file=events/2026/07/01.ndjson.parquet
```

### 2. Lambda Fallback Verification
```bash
# These should work via Lambda (fallback)
curl https://cloudless.gr/api/contact
curl https://cloudless.gr/api/chat
curl https://cloudless.gr/api/calendar/availability
curl https://cloudless.gr/api/blog/posts
```

### 3. Failover Test (Simulate Lambda Down)
```bash
# Temporarily disable Lambda, verify Workers handles fallback
# Or test Pi endpoint directly:
curl https://omv.tail8eb71.ts.net/api/health
```

## Secrets Required for Full Migration

| Secret | Currently Where | Workers Needs |
|--------|-----------------|-------------|
| AUTH_SECRET | ✓ D1 lib | ✓ |
| SESSION_SECRET | ✓ | ✓ for D1 auth |
| STRIPE_SECRET_KEY | ✓ Lambda | ✗ Needed for checkout |
| STRIPE_WEBHOOK_SECRET | ✓ Lambda | ✗ Needed for webhooks |
| SES_FROM_EMAIL | ✓ Lambda | ✓ Email binding exists |
| NOTION_API_KEY | ✓ Lambda | ✗ Needed for CMS |
| GOOGLE_* keys | ✓ Lambda | ✗ For calendar |
| SLACK_WEBHOOK_URL | ✓ Lambda | ✗ For notifications |
| HUBSPOT_API_KEY | ✓ Lambda | ✗ For CRM |
| WORKSPACE_* secrets | ✓ Lambda | ✗ For Workspaces |

## Recommended Next Steps

1. **Keep current hybrid** - it works well
2. **Monitor fallback triggers** - check if Lambda routes are ever hit
3. **Migrate high-value routes selectively**:
   - Contact form (uses Email binding, no external API)
   - User profile (simple D1 operations)
4. **Decommission Lambda** only when:
   - All 221 routes work on Workers
   - 30-day validation period with no fallback needed
   - Pi cluster validated as tertiary backup

## Commands for Testing

```bash
# Test Workers deployment
npx wrangler deploy --config wrangler.jsonc

# Test health endpoint on both
curl https://cloudless.gr/api/health
curl https://fully-migrated-serverless-stack.baltzakis-themis.workers.dev/api/health

# Check Lambda fallback
gh workflow run deploy.yml -f skip-lambda=false