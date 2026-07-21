# Cloudflare Deployment & Fine-Tuning Plan
# Generated: 2026-07-21 (Post-Sync Report)

## Executive Summary

This plan covers the complete deployment workflow for cloudless.gr on Cloudflare Workers, including:
- Resource provisioning (KV namespaces, secrets)
- Worker deployment (main app + chat service)
- Performance optimization and monitoring setup
- Verification and rollback procedures

---

## Phase 1: Resource Provisioning (REQUIRED)

### 1.1 Create Missing KV Namespaces

The wrangler.jsonc currently has placeholder IDs for these bindings:
- `TAG_CACHE` - For on-demand cache invalidation
- `REVALIDATION_QUEUE` - For scheduled ISR revalidation

```bash
# Production KV namespaces
npx wrangler kv namespace create "TAG_CACHE" --config wrangler.jsonc
npx wrangler kv namespace create "REVALIDATION_QUEUE" --config wrangler.jsonc

# Preview/staging KV namespaces
npx wrangler kv namespace create "TAG_CACHE" --config wrangler.jsonc --preview
npx wrangler kv namespace create "REVALIDATION_QUEUE" --config wrangler.jsonc --preview
```

**Expected Output Format:**
```
🌀 Creating KV namespace TAG_CACHE... 
✅ Created KV namespace TAG_CACHE
{"namespace_id":"<ID_TO_COPY>","title":"TAG_CACHE"}
```

**Action Required:** Update `wrangler.jsonc` with the actual namespace IDs in both the main config and the `staging` environment section.

### 1.2 Set Missing Secrets

Two secrets are currently placeholders and must be set before production deployment:

```bash
# Generate secure SESSION_SECRET (32+ bytes)
npx wrangler secret put SESSION_SECRET --config wrangler.jsonc
# Value: Use `openssl rand -base64 32` or similar

# Generate AGENT_AUTH_TOKEN for chat service authentication
npx wrangler secret put AGENT_AUTH_TOKEN --config wrangler.jsonc
# Value: Secure token for agent authorization
```

**Verification:**
```bash
npx wrangler secret list --config wrangler.jsonc
```

### 1.3 Clean Up Orphaned Resources (Optional)

```bash
# Delete orphaned D1 database (confirm no data needed)
npx wrangler d1 delete cloudless-auth --force --config wrangler.jsonc

# Delete orphaned KV namespace (HEALTH_CACHE)
npx wrangler kv namespace delete <HEALTH_CACHE_ID> --force --config wrangler.jsonc
```

---

## Phase 2: Worker Deployment

### 2.1 Deploy Main Worker (cloudless-gr)

**Current Status:** Worker exists but needs KV namespace fixes

```bash
# Run typecheck first
pnpm cf:typecheck

# Dry-run to verify configuration
npx wrangler deploy --config wrangler.jsonc --dry-run --env="" --persist

# Deploy to production (after KV IDs are updated)
pnpm cf:build && pnpm cf:deploy
```

**Build Process:**
- Uses `@opennextjs/cloudflare` for Next.js optimization
- Requires `open-next.config.ts` configuration (already in place)
- Outputs to `./.opennext` then wrangler bundles

### 2.2 Deploy Chat Service Worker (cloudless-gr-chat)

**Current Status:** Code exists, worker needs deployment

```bash
cd services/chat

# Install dependencies if needed
pnpm install

# Run typecheck
pnpm exec tsc --noEmit -p tsconfig.json

# Deploy
npx wrangler deploy

# Or dry-run first
npx wrangler deploy --dry-run
```

### 2.3 Deploy Staging Environment

```bash
# Deploy main worker to staging
pnpm deploy:staging

# Or via wrangler directly
npx wrangler deploy -c wrangler.staging.jsonc
```

---

## Phase 3: Performance Optimization

### 3.1 ISR Configuration

The `open-next.config.ts` is configured with:
- R2-based incremental cache (`CACHE_BUCKET`)
- KV-based tag cache (`TAG_CACHE`)
- KV-based queue (`REVALIDATION_QUEUE`)

**Expected Performance Improvements:**
| Metric | Before | After |
|--------|--------|-------|
| Cold start latency | ~2-3s | ~1-2s (cached) |
| ISR revalidation | Full rebuild | R2 cache hit |
| Cache invalidation | None | On-demand via KV |

### 3.2 Route Warming

Configured paths: `/`, `/en`, `/el`, `/contact`, `/admin`

**Verification After Deploy:**
```bash
# Check if warming ran
curl -s https://cloudless.gr/api/health | jq
```

### 3.3 Cache TTL Tuning

For the `CACHE_BUCKET` (cloudless-assets), consider these TTL settings:

```javascript
// In your Next.js app, set cache headers for static assets:
// - Images: 7 days (will be in R2)
// - CSS/JS: 30 days (hashed filenames)
// - HTML: 0 (SSR)
// - ISR pages: configurable via revalidateSeconds
```

---

## Phase 4: Monitoring & Alerting

### 4.1 Health Checks

```bash
# Main worker health
curl -s https://cloudless.gr/api/health | jq

# Auth session endpoint
curl -s https://cloudless.gr/api/auth/session | jq

# Chat health (after deploy)
curl -s https://cloudless.gr/api/chat | jq

# Analytics events
curl -s https://cloudless.gr/api/analytics/health | jq
```

### 4.2 Workers Analytics

Monitor via dashboard or CLI:
```bash
# Get worker analytics
npx wrangler tail cloudless-gr --config wrangler.jsonc

# Check invocation counts (for free tier limits)
gh api /accounts/{ACCOUNT_ID}/workers/metadata/cloudless-gr-invocations \
  --jq '.result[-1].requests'
```

### 4.3 D1 Database Monitoring

```bash
# Check database size (free tier limit: 5GB)
npx wrangler d1 list --config wrangler.jsonc

# Query recent auth events
curl -s https://cloudless.gr/api/admin/auth-audit | jq
```

---

## Phase 5: Security Hardening

### 5.1 Rate Limiting

Already configured for chat service (10 req/min per IP). Consider adding:

```bash
# For auth endpoints (if not already rate-limited)
# Check src/lib/rate-limit.ts for implementation
```

### 5.2 CSP & Security Headers

Already configured in `src/index.ts`:
- HSTS (Max-Age: 2 years)
- X-Frame-Options: DENY
- Content-Security-Policy with comprehensive directives
- Report-To header for CSP violation reports

### 5.3 Verify Secrets Handling

```bash
# SESSION_SECRET should be in Wrangler secrets (not .env)
# AGENT_AUTH_TOKEN should be validated on agent routes
# CRON_SECRET already set for cron endpoints
```

---

## Phase 6: Verification & Rollback

### 6.1 Pre-Deploy Checklist

- [ ] KV namespaces created and IDs updated in wrangler.jsonc
- [ ] SESSION_SECRET set (>32 bytes)
- [ ] AGENT_AUTH_TOKEN set
- [ ] Typecheck passes (`pnpm cf:typecheck`)
- [ ] Chat service wrangler.jsonc verified
- [ ] Backup of current production worker (if exists)

### 6.2 Post-Deploy Verification

```bash
# 1. Basic health check
curl -s https://cloudless.gr/api/health | jq

# 2. Auth endpoint
curl -s https://cloudless.gr/api/auth/session | jq

# 3. ISR test (check if cache works)
curl -s -I https://cloudless.gr/en | grep -E "cf-cache|cache-control"

# 4. Chat endpoint test
curl -s https://cloudless.gr/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}' \
  | head -20
```

### 6.3 Rollback Procedure

If deployment fails:
```bash
# Rollback to previous deployment
npx wrangler rollback cloudless-gr --config wrangler.jsonc

# Or revert chat service
cd services/chat
npx wrangler rollback cloudless-gr-chat
```

---

## Phase 7: Cost Optimization (Free Tier)

### 7.1 Cloudflare Free Tier Limits

| Resource | Free Tier Limit | Current Usage |
|----------|-----------------|---------------|
| Workers invocations | 100,000/day | Check dashboard |
| D1 storage | 5 GB | Check size |
| R2 operations | 10M/month | Check dashboard |
| KV operations | 100K/day | Check dashboard |

### 7.2 Recommended Budget Alerts

```bash
# Set via Cloudflare dashboard or API:
# - Workers invocations > 80K/day
# - D1 > 4GB
# - R2 > 8M operations/month
```

---

## Phase 8: Deployment Commands Summary

### Quick Deploy (After Resource Setup)

```bash
# 1. Create KV namespaces (run once)
npx wrangler kv namespace create "TAG_CACHE" --config wrangler.jsonc
npx wrangler kv namespace create "REVALIDATION_QUEUE" --config wrangler.jsonc

# 2. Set secrets (run once)
npx wrangler secret put SESSION_SECRET --config wrangler.jsonc
npx wrangler secret put AGENT_AUTH_TOKEN --config wrangler.jsonc

# 3. Build and deploy main worker
pnpm cloudflare-build
pnpm cf:deploy

# 4. Deploy chat service
cd services/chat
npx wrangler deploy
```

### Verification Commands

```bash
# Health checks
curl -s https://cloudless.gr/api/health | jq
curl -s https://cloudless.gr/api/auth/session | jq

# Dry-run before actual deploy
npx wrangler deploy --config wrangler.jsonc --dry-run --env="" --persist
```

---

## Phase 9: SST-Based Deployment (Alternative)

### 9.1 SST Infrastructure Deploy

If using SST for infrastructure management:

```bash
# Deploy infrastructure only (KV, R2, D1)
pnpm sst:infra:deploy

# Deploy to staging
pnpm sst:infra:deploy:staging

# Full deploy (build + infrastructure)
pnpm deploy
pnpm deploy:staging
```

### 9.2 SST Cron Jobs

Configured cron schedules in `sst.config.cloudflare.ts`:

| Cron | Schedule | Purpose |
|------|----------|---------|
| AnalyticsRollup | `0 1 * * *` (Daily 01:00 UTC) | Flush event queue, weekly rollup |
| CalendarDigest | `0 6 ? * MON-FRI *` | Google Calendar agenda to Slack |
| ReportCleanup | `0 2 ? * SUN *` (Sun 02:00 UTC) | Delete reports > 90 days |
| VoiceBrief | `0 5 ? * MON *` (Mon 05:00 UTC) | Weekly voice brief |

---

## Phase 10: Advanced Fine-Tuning

### 10.1 Image Optimization (Next.js config)

From `next.config.ts`:
- Formats: AVIF first, WebP fallback
- Device sizes: [640, 750, 828, 1080, 1200, 1920, 2048] (removed 3840/8K)
- Cache TTL: 30 days for optimized variants

### 10.2 Bundle Analysis

```bash
# Analyze bundle sizes
pnpm analyze

# Check for unused AWS SDK imports (post-migration)
grep -r "@aws-sdk" src --include="*.ts" --include="*.tsx" \
  | grep -v "bedrock-runtime" | grep -v "s3"
```

### 10.3 Edge Caching Rules (Cloudflare Dashboard)

After deployment, configure these cache rules in Cloudflare Dashboard:

| Path Pattern | TTL | Browser TTL | Edge Cache |
|--------------|-----|-------------|------------|
| `/static/*` | 30 days | 30 days | Yes |
| `/_next/image*` | 30 days | 30 days | Yes |
| `/en/*` | Dynamic | Dynamic | Yes (via OpenNext) |
| `/el/*` | Dynamic | Dynamic | Yes (via OpenNext) |
| `/api/*` | Do not cache | Do not cache | No |

### 10.4 Analytics Event Sampling

For production monitoring, consider sampling rate:

```javascript
// Analytics events are batched via ANALYTICS_BINDING (Analytics Engine)
// Sample rate can be adjusted to reduce costs while maintaining insights
// Recommended: 100% sampling for critical events, 10% for page views
```

---

## Phase 11: Troubleshooting Guide

### 11.1 Common Deployment Issues

| Issue | Solution |
|-------|----------|
| KV namespace placeholder error | Update wrangler.jsonc with real IDs |
| SESSION_SECRET missing | Run `npx wrangler secret put SESSION_SECRET` |
| Chat service not responding | Check service binding entrypoint matches `ChatAgent` |
| ISR cache not working | Verify CACHE_BUCKET binding and OpenNext config |
| Agents not accessible | Check durable object migrations (v1, v2, v3) |

---

## Appendix A: Secrets Generation Commands

```bash
# Generate SESSION_SECRET (32+ bytes, base64)
openssl rand -base64 32

# Generate AGENT_AUTH_TOKEN (secure random)
openssl rand -hex 24
```

---

## Appendix B: KV Namespace Update Template

After running `npx wrangler kv namespace create`, update wrangler.jsonc:

```jsonc
// Add to kv_namespaces section:
"kv_namespaces": [
  {
    "binding": "TAG_CACHE",
    "id": "<ACTUAL_TAG_CACHE_ID>",
    "preview_id": "<ACTUAL_TAG_CACHE_PREVIEW_ID>"
  },
  {
    "binding": "REVALIDATION_QUEUE",
    "id": "<ACTUAL_REVALIDATION_QUEUE_ID>",
    "preview_id": "<ACTUAL_REVALIDATION_QUEUE_PREVIEW_ID>"
  }
]
```

---

## Environment Variables Reference

### Main Worker (wrangler.jsonc)

| Variable | Source | Status |
|----------|--------|--------|
| `AGENT_AUTH_TOKEN` | Secret | ❌ Not set |
| `SESSION_SECRET` | Secret | ❌ Not set |
| `CRON_SECRET` | Secret | ✅ Set |
| `ENVIRONMENT` | Vars (staging) | ✅ Configured |
| `NEXT_PUBLIC_SITE_URL` | Vars | ✅ Configured |

### Chat Service (services/chat/wrangler.jsonc)

| Variable | Source | Status |
|----------|--------|--------|
| `SITE_BASE_URL` | Vars | ✅ Set (https://cloudless.gr) |
| `AI` | Binding | ✅ Configured |

---

## Architecture Summary

**Current Bindings (16 total):**
1. 3 Durable Objects: `CounterAgent`, `EchoAgent`, `CodingAgent`
2. 2 KV Namespaces: `TAG_CACHE`, `REVALIDATION_QUEUE`
3. 1 Send Email: `EMAIL`
4. 1 D1 Database: `AUTH_DB` (user-auth-db)
5. 5 R2 Buckets: `ASSETS_BUCKET`, `CACHE_BUCKET`, `MEDIA_BUCKET`, `ANALYTICS_BUCKET`, `DATALAKE_BUCKET`
6. 1 Service: `CHAT` → cloudless-gr-chat#ChatAgent
7. 1 Analytics Engine: `ANALYTICS`
8. 1 AI Binding: `AI`
9. 1 Assets Binding: `ASSETS` (via @opennextjs/cloudflare)

---

## Next Steps Priority

1. **🔴 CRITICAL** - Create KV namespaces and update wrangler.jsonc
2. **🔴 CRITICAL** - Set SESSION_SECRET and AGENT_AUTH_TOKEN secrets
3. **🟡 HIGH** - Deploy chat service worker
4. **🟢 MEDIUM** - Verify ISR/cache functionality
5. **⚪ LOW** - Clean up orphaned resources (optional)