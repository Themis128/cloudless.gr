# SST Cloudflare Hybrid Architecture Implementation

> **Status:** Implementation In Progress 🔄

## Overview

This hybrid approach leverages SST's Cloudflare provider for **infrastructure provisioning** (D1 databases, R2 buckets) while maintaining the existing **Wrangler-based application deployment** for maximum compatibility with Next.js features.

## Architecture Diagram

```
                       ┌─────────────────────────────────────────────────────────────┐
                       │                    SST Infrastructure                        │
                       │                      (sst.config.cf-infra.ts)               │
                       │                                                             │
                       │  ├── D1 Database (user-auth-db)                             │
                       │  │     ├── auth tables (users, sessions, etc.)               │
                       │  │     └── app_config table (runtime config)                 │
                       │  ├── R2 Buckets                                           │
                       │  │     ├── cloudless-assets                                  │
                       │  │     ├── app-media-bucket                                  │
                       │  │     ├── cloudless-analytics                               │
                       │  │     └── datalake-bucket                                 │
                       │  └── Scheduled Triggers (Cron Jobs)                          │
                       └─────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
      ┌──────────────────────────────────────────────────────────────────────────────┐
      │                    DNS & Edge (Cloudflare)                                    │
      ┌──────────────────────────────────────────────────────────────────────────────┐
      │                                                                               │
      │  ├── cloudless.gr (Cloudflare Tunnel → Pi k3s)                                 │
      │  ├── Worker Fallback (cloudless-gr.baltzakis-themis.workers.dev)              │
      │  └── Analytics Worker (separate from main app)                                │
      │                                                                               │
      └──────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
      ┌──────────────────────────────────────────────────────────────────────────────┐
      │              Application Layer (Wrangler)                                       │
      │                                                                               │
      │  ┌─────────────────────────────────────────────────────────────────────────┐ │
      │  │  Worker Entry Point (src/index.ts)                                         │ │
      │  │  ├── CRON_ROUTE detection (SST Cron triggers)                             │ │
      │  │  ├── CRON_SECRET authorization                                          │ │
      │  │  ├── Durable Objects (CounterAgent, EchoAgent, CodingAgent)              │ │
      │  │  ├── Service Bindings (CHAT, ADMIN_API)                                  │ │
      │  │  └── API Routes (via ASSETS.fetch)                                        │ │
      │  └─────────────────────────────────────────────────────────────────────────┘ │
      └──────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Status

### ✅ Completed Components

| Component | File | Status |
|-----------|------|--------|
| SST Config | `sst.config.cf-infra.ts` | ✅ Defined with D1, R2, Cron |
| Worker Entry | `src/index.ts` | ✅ Handles CRON_ROUTE triggers, internal routing |
| D1 Config Module | `src/lib/ssm-config-d1.ts` | ✅ D1-based config for Workers environment |
| Config Endpoint | `src/app/api/config/route.ts` | ✅ Runtime config API for ETL scripts |
| Cron Invoker | `src/lambda/cron-invoker.ts` | ✅ AWS Lambda handler maintained |
| GitHub Workflow | `.github/workflows/sst-infra-deploy.yml` | ✅ Automated SST deployment defined |
| Cron Auth | `src/lib/cron-auth.ts` | ✅ Updated for Workers compatibility |

### 🔄 Cron Jobs Architecture

Workers Cron triggers invoke the Worker's `fetch()` handler directly with:
- `CRON_ROUTE` environment variable set to the target endpoint (e.g., `/api/cron/analytics-rollup`)
- `CRON_SECRET` secret for authorization

The Worker detects `CRON_ROUTE` and:
1. Verifies `CRON_SECRET` is available
2. Routes through ASSETS to Next.js API handlers (via handleCronRoute in src/index.ts)

### 🔐 Secrets Required

The following secrets must be configured in Wrangler:

```bash
# Run these commands to set production secrets
npx wrangler secret put CRON_SECRET --config wrangler.jsonc
npx wrangler secret put SESSION_SECRET --config wrangler.jsonc
npx wrangler secret put AGENT_AUTH_TOKEN --config wrangler.jsonc
```

Or add to GitHub secrets:
- `CLOUDFLARE_API_TOKEN` - API token for deployment
- `CF_ACCOUNT_ID` - Cloudflare account ID
- `CRON_SECRET` - Shared secret for cron job authorization
- `SESSION_SECRET` - Session signing secret (32+ bytes)
- `AGENT_AUTH_TOKEN` - Agent RPC authorization token

### 🚀 Deployment Pipeline

```bash
# Step 1: Deploy infrastructure with SST
pnpm sst:infra:deploy

# Step 2: Apply D1 migrations
npx wrangler d1 migrations apply user-auth-db --config wrangler.jsonc

# Step 3: Set required secrets
npx wrangler secret put CRON_SECRET --config wrangler.jsonc
npx wrangler secret put SESSION_SECRET --config wrangler.jsonc

# Step 4: Build Next.js
pnpm cf:build

# Step 5: Deploy Worker with Wrangler
pnpm cf:deploy

# All-in-one
pnpm deploy
```

### ETL Integration

The `/api/config` endpoint provides configuration for ETL scripts:

```javascript
// In ETL scripts (GitHub Actions)
const config = await fetch('https://cloudless.gr/api/config', {
  headers: { 'x-config-auth': process.env.ADMIN_ALERT_SECRET }
}).then(r => r.json());
```

## Cron Job Implementation

| Job | Schedule | Endpoint | Status |
|-----|----------|----------|--------|
| Analytics Rollup | Daily 01:00 UTC | `/api/cron/analytics-rollup` | ✅ GET + POST |
| Calendar Digest | Weekdays 06:00 UTC | `/api/cron/calendar-digest` | ✅ GET + POST |
| Report Cleanup | Sunday 02:00 UTC | `/api/cron/report-cleanup` | ✅ GET + POST |
| Voice Brief | Monday 05:00 UTC | `/api/cron/voice-brief` | ✅ GET + POST |

All cron endpoints now support both GET (for manual testing) and POST (for SST Cron triggers).

## Remaining Tasks

| Task | Status |
|------|--------|
| Configure GitHub secrets (CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID) | ⏳ Pending |
| Deploy SST infrastructure | ⏳ Pending |
| Apply D1 migration 0007 (app_config table) | ⏳ Pending |
| Set CRON_SECRET in Wrangler | ⏳ Pending |
| Set SESSION_SECRET in Wrangler | ⏳ Pending |
| Verify Workers deployment | ⏳ Pending |

## 🔧 Troubleshooting

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Cron jobs not firing | Verify CRON_SECRET is set in Wrangler secrets and tunnel is active |
| D1 connection errors | Check AUTH_DB binding in wrangler.jsonc matches database ID |
| R2 bucket access denied | Verify bucket names match between SST config and Wrangler config |
| Service binding failures | Ensure ChatAgent and AdminApi are deployed as separate Workers |

### Verification Commands

```bash
# Check SST deployment status
pnpm sst list --config sst.config.cf-infra.ts --stage production

# Verify D1 binding
npx wrangler d1 list --config wrangler.jsonc

# Verify R2 buckets
npx wrangler r2 bucket list --config wrangler.jsonc

# Check Worker deployment
npx wrangler deployments list --config wrangler.jsonc

# Test cron endpoint (manual trigger)
curl -X POST https://cloudless.gr/api/cron/analytics-rollup \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 📊 Monitoring & Alerts

### Health Check Endpoints
- `/api/health` - Basic health check (returns 200 OK)
- `/api/auth/session` - Session validation endpoint
- `/api/config` - Configuration endpoint with auth required

### Key Metrics to Monitor
1. **D1 Database**: Query count, storage usage (< 5GB free tier)
2. **R2 Buckets**: Request count (< 10M ops/month free tier)
3. **Workers Invocations**: Daily count (< 100K free tier)
4. **Cron Success Rate**: All 4 cron jobs should execute successfully

## 🔒 Security Considerations

### Secret Management
- **CRON_SECRET**: Shared secret for internal cron authorization
- **SESSION_SECRET**: Used for session cookie signing (32+ bytes required)
- **AGENT_AUTH_TOKEN**: RPC authorization for agent endpoints
- **ADMIN_ALERT_SECRET**: API authentication for admin endpoints

### Network Security
- All traffic through Cloudflare Tunnel (encrypted)
- CSP headers enforced on all responses
- HSTS enabled with preload directive
- X-Frame-Options: DENY to prevent clickjacking

### CORS Configuration
API routes use origin-based CORS allowing:
- `https://cloudless.gr` (production)
- `https://staging.cloudless.gr` (staging)
- Cloudflare tunnel endpoints

## 🔄 Environment Variables

| Variable | Source | Description |
|----------|--------|-------------|
| `CRON_ROUTE` | SST Cron | Set automatically when cron triggers fetch |
| `CRON_SECRET` | Wrangler Secret | Authorization token for cron jobs |
| `SESSION_SECRET` | Wrangler Secret | Session signing secret |
| `AGENT_AUTH_TOKEN` | Wrangler Secret | Agent RPC authorization |
| `NEXT_PUBLIC_SITE_URL` | Wrangler Vars | Public site URL for frontend |

## 🚀 Fly.io HA Failover Proxy

The Fly.io proxy (cloudless-proxy.fly.dev) provides automatic failover from Cloudflare Workers to the Pi k3s cluster.

### Proxy Status
```
Endpoint: http://cloudless-proxy.fly.dev/health
Response: {"status":"healthy","primary":"cloudless.gr","fallback":"omv.tail8eb71.ts.net","primary_healthy":true}
```

| Component | Detail |
|-----------|--------|
| **Primary** | cloudless.gr (Cloudflare Workers) |
| **Fallback** | omv.tail8eb71.ts.net (Pi via Tailscale) |
| **Region** | fra (Frankfurt) |
| **Memory** | 256MB shared CPU |

### Failover Behavior
- Health checks run every 30s to primary backend
- If primary returns non-200, traffic routes to fallback
- HTTP endpoint working (HTTPS cert renewal in progress)

## 📚 Related Documentation

- **ACTIONS-REQUIRED.md** - Current pending tasks and action items

## 🔄 Next Review

This architecture should be reviewed:
- When Cloudflare free tier limits are approached
- Before adding new cron jobs or scheduled tasks
- When expanding to additional Workers service bindings
- Quarterly for security audit and optimization opportunities