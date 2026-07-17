# Fly.io Implementation Plan

## Overview
Fly.io deployment for cloudless.gr as part of the Cloudflare + Local Cluster architecture. Provides:
1. **cloudless-proxy** - HA failover proxy (Cloudflare Workers → Pi/k3s via Tailscale)
2. **cloudless-analytics** - Metabase dashboard for DuckDB/R2 analytics
3. **cloudless-cron-analytics** - Cron replacement for AWS Lambda analytics rollup

## Status: INFRASTRUCTURE READY FOR DEPLOYMENT

### Completed Implementation
- [x] **fly.toml** - Main proxy configuration (Frankfurt region)
- [x] **fly-analytics.toml** - Metabase configuration (Frankfurt region)
- [x] **fly-proxy-app/proxy.py** - FastAPI proxy with automatic failover
- [x] **fly-proxy-app/Dockerfile** - Python 3.11-slim container
- [x] **fly-proxy-app/requirements.txt** - FastAPI, uvicorn, httpx
- [x] **fly-cron-apps/cron-runner.js** - Pure JavaScript cron runner (no placeholders)
- [x] **fly-cron-apps/Dockerfile** - Node 20-alpine container
- [x] **fly-cron-apps/analytics-rollup/fly.toml** - Cron app configuration
- [x] **src/app/api/cron/analytics-rollup/route.ts** - POST endpoint for cron

### Deployed Apps
- [x] **cloudless-proxy** - Deployed Jul 13 2026, 2 machines running in fra

### Pending Deployment
- [ ] **cloudless-analytics** - Waiting for R2 credentials
- [ ] **cloudless-cron-analytics** - Waiting for CRON_SECRET

## Deployment Commands

```bash
# Deploy analytics (requires R2 credentials)
fly volumes create metabase_data --size 1 --app cloudless-analytics
fly secrets set R2_ACCESS_KEY_ID=<key> R2_SECRET_ACCESS_KEY=<secret> --app cloudless-analytics
fly deploy --app cloudless-analytics --config fly-analytics.toml

# Deploy cron (requires CRON_SECRET)
fly apps create cloudless-cron-analytics
CRON_SECRET=$(openssl rand -hex 32)
fly secrets set CRON_SECRET=$CRON_SECRET --app cloudless-cron-analytics
fly deploy --app cloudless-cron-analytics --config fly-cron-apps/analytics-rollup/fly.toml
```

## Notes
- Uses personal Fly.io account (no "cloudless" organization exists)
- All configurations use actual values, no placeholders
- ARM64 compatible for potential Pi deployment