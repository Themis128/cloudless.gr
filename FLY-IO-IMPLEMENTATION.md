# Fly.io Implementation Plan

## Overview

Fly.io deployment for cloudless.gr as part of the Cloudflare + Local Cluster architecture. The current architecture uses:

- ✅ **cloudless-proxy** - Deployed on Fly.io (HA failover proxy)
- ❌ **cloudless-analytics** - Running on k3s cluster (Metabase via Helm)
- ❌ **cloudless-cron-analytics** - Using GitHub Actions scheduled workflows

**Note**: As of 2026-07-19, Fly.io deployment has been consolidated to only the proxy service. Analytics and cron operations are handled by the existing infrastructure (k3s + GitHub Actions), avoiding redundancy and cost overhead.

## Current Status

### Deployed Apps

- [x] **cloudless-proxy** - Deployed Jul 13 2026, 2 machines running in fra (Frankfurt)

### Retired (Unused Configs Removed)

- [x] **cloudless-analytics** - Metabase running on k3s cluster (see `k8s/manifests/`)
- [x] **cloudless-cron-analytics** - GitHub Actions `cron-free-tier.yml` handles scheduled jobs

## Active Implementation: cloudless-proxy

### Purpose

HA failover proxy that sits in front of the main infrastructure:

- Primary: Cloudflare Workers (`cloudless.gr`)
- Fallback: Pi k3s via Tailscale (`omv.tail8eb71.ts.net`)

### Configuration Files

- `fly.toml` - Main proxy configuration
- `fly-proxy-app/proxy.py` - FastAPI proxy with automatic failover
- `fly-proxy-app/Dockerfile` - Python 3.11-slim container

### Deployment Commands

```bash
# Already deployed - these are for reference/redeploy
fly deploy --app cloudless-proxy --config fly.toml
```

## Retired Configurations (Removed)

The following configurations were removed to avoid confusion and redundant infrastructure:

### fly-analytics.toml (REMOVED)

**Reason**: Metabase already running on k3s cluster. No benefit to running duplicate analytics stack on Fly.io.

**Alternative**: See `k8s/manifests/monitoring-stack.yaml` or run locally:

```bash
# Local development
docker run -d -p 3000:3000 \
  -e MB_DB_FILE=/metabase-data/metabase.db \
  -v ./metabase-data:/metabase-data \
  metabase/metabase:v0.53.3
```

### fly-cron-apps/ (REMOVED)

**Reason**: GitHub Actions `cron-free-tier.yml` already handles scheduled analytics rollup with no Fly.io free tier restrictions.

**Alternative**: Scheduled workflow runs daily at 01:00 UTC:

- See `.github/workflows/cron-free-tier.yml`
- Calls `/api/cron/analytics-rollup` endpoint on the main app

## Architecture Decision: Fly.io vs k3s + GitHub Actions

| Service | Fly.io Approach | Current Approach | Rationale |
|---------|----------------|------------------|-----------|
| Proxy | ✅ cloudless-proxy | ✅ cloudless-proxy | Provides external failover outside Cloudflare |
| Analytics | fly-analytics (Metabase) | k3s Metabase + GitHub Actions | Already running on cluster, no duplication needed |
| Cron | fly-cron-analytics | GitHub Actions | Free tier, no Fly.io account needed |

## Next Steps

No further Fly.io deployment needed. The architecture is stable with:

1. **Traffic Entry** → Cloudflare Load Balancer
2. **Primary** → Pi k3s cluster via Cloudflare Tunnel
3. **Fallback** → Cloudflare Workers (if Pi down)
4. **External Failover** → Fly.io proxy (if Cloudflare needs bypass)

For issues with the deployed proxy:

```bash
fly logs --app cloudless-proxy
fly status --app cloudless-proxy
