# SST Cloudflare Hybrid Architecture Implementation

> **Status:** Implementation Complete ✅

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

| Component | File | Description |
|-----------|------|-------------|
| SST Config | `sst.config.cf-infra.ts` | Cloudflare infrastructure with D1, R2, Cron |
| Worker Entry | `src/index.ts` | Handles CRON_ROUTE triggers, internal routing |
| D1 Config Module | `src/lib/ssm-config-d1.ts` | D1-based config for Workers environment |
| Config Endpoint | `src/app/api/config/route.ts` | Runtime config API for ETL scripts |
| Cron Invoker | `src/lambda/cron-invoker.ts` | Dual-environment cron handler (AWS SSM + Workers) |
| GitHub Workflow | `.github/workflows/sst-infra-deploy.yml` | Automated SST deployment |

### 🔄 Cron Jobs Architecture

Workers Cron triggers invoke the Worker's `fetch()` handler directly with:
- `CRON_ROUTE` environment variable set to the target endpoint (e.g., `/api/cron/analytics-rollup`)
- `CRON_SECRET` secret for authorization

The Worker detects `CRON_ROUTE` and:
1. Verifies `CRON_SECRET` is available
2. Creates an internal POST request to the target endpoint
3. Routes through ASSETS to Next.js API handlers

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

## Cron Job Migration

| AWS Cron | Cloudflare Cron | Description |
|----------|-----------------|-------------|
| `cron(0 1 * * ? *)` | `0 1 * * *` | Daily 01:00 UTC - Analytics rollup |
| `cron(0 6 ? * MON-FRI *)` | `0 6 * * 1-5` | Weekdays 06:00 UTC - Calendar digest |
| `cron(0 2 ? * SUN *)` | `0 2 * * 0` | Sunday 02:00 UTC - Report cleanup |
| `cron(0 5 ? * MON *)` | `0 5 * * 1` | Monday 05:00 UTC - Voice brief |

## Next Steps

1. **Configure GitHub secrets** - Add CLOUDFLARE_API_TOKEN, CF_ACCOUNT_ID, CRON_SECRET
2. **Run initial deployment** - `pnpm sst:infra:deploy`
3. **Apply D1 migrations** - `npx wrangler d1 migrations apply user-auth-db`
4. **Set production secrets** - CRON_SECRET, SESSION_SECRET
5. **Test cron triggers** - Verify via Cloudflare dashboard

## Rollback Procedure

If issues arise, the AWS-based SST config (`sst.config.ts`) remains available:

```bash
# Rollback to AWS deployment
pnpm sst:dev  # Use AWS configuration
pnpm deploy   # Deploy to AWS