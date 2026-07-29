# Cloudless.gr Migration & Infrastructure Task Checklist

## 🏗️ Infrastructure Corrections

- [ ] Verify `.cline/data/settings/cline_mcp_settings.json` exists and is correct
- [ ] Add fast-markdown-mcp server entry to MCP config
- [ ] Confirm DevDocs storage path: `/home/tbaltzakis/DevDocs/storage/markdown/` (16 files exist)
- [ ] Fix fast-markdown-mcp entry point (add `run_main()` async wrapper)
- [ ] Resolve infinite retry loop (remove while‑True, implement graceful shutdown)
- [ ] Clean up log handler to prevent “I/O closed file” errors
- [ ] Restart Cline to load new MCP configuration
- [ ] Verify fast‑markdown‑mcp tools (`sync_file`, `read_file`, `list_files`, `search_files`, `smart_section_search`) work
- [ ] Create Python unit tests for MCP server functionality
- [ ] Create Playwright tests for MCP integration

## 🔐 Tailscale & Network

- [ ] Create ProxyClass CRD for monitoring‑proxy (`proxyclass-monitoring.yaml`)
- [ ] Fix ProxyGroup health probe configuration (remove invalid probes)
- [ ] Deploy `tailscale-deploy.yml` GitHub workflow
- [ ] Update Tailscale OAuth docs (`README.md`)
- [ ] Add diagnostic script `tailscale-diagnose.sh`
- [ ] Store `TS_CLIENT_ID` and `TS_CLIENT_SECRET` in GitHub secrets (2026‑07‑19)
- [ ] Approve subnet routes in Tailscale admin console (10.42.0.0/16, 10.43.0.0/16)

## 🖥️ Pi 5 / Cluster Optimization (8 GB RAM)

- [ ] Apply `monitoring-node-selector-fix.yml` for Prometheus/Alertmanager
- [ ] Fix `cloudflare-geo-exporter` scaling (clear `pending/terminating` pods)
- [ ] Resolve `metoro-node-agent` CrashLoopBackOff (EBPF not supported on Pi kernel)
- [ ] Configure 2 TB SSD mount for analytics storage (`/sdb1`)
  - Verify mount path: `/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7`
  - Confirm OMV node can see and mount the disk

## 📦 Service Deployments

- [ ] Deploy Postiz worker to `omv` node (offload from `omv‑ha`) – already deployed
- [ ] Verify Postiz PVC claims (`uploadsPvc: 2Gi → 20Gi` for media)
- [ ] Configure Postiz Cloudflare Tunnel (`infrastructure/postiz/cloudflare-tunnel.yaml`)
- [ ] Deploy missing services (ntfy, uptime‑kuma, meilisearch, docs‑server) – all deployed
- [ ] Increase Postiz resources (currently 512 Mi RAM → consider 1 Gi if needed)
- [ ] Deploy `appflowy-liteLLM` service for AI features (optional)

## 🔑 Secrets & Configuration

- [ ] Create `CLOUDFLARE_API_TOKEN` secret (SSM + GitHub Actions) – required for deployment workflow
- [ ] Migrate all AWS SSM parameters to Workers/D1 (complete by 2026‑07‑19)
- [ ] Verify Wrangler secrets:
  - `ADMIN_ALERT_SECRET` ✅
  - `ESPOCRM_API_KEY` ✅
  - `ESPOCRM_API_PASSWORD` ✅
  - `SLACK_WEBHOOK_URL` ✅
  - `POSTIZ_API_KEY` ✅
- [ ] Update MinIO credentials from insecure defaults to secure random hex (COMPLETED 2026‑07‑20)

## 🛡️ Authentication Hardening

- [ ] Enforce password strength (min 8 chars, mixed case, number, symbol)
- [ ] Upgrade hashing from SHA‑256 to PBKDF2 (backward compatible)
- [ ] Implement rate limiting (max 10 attempts/minute)
- [ ] Add CSRF protection (utility + migration `0004-csrf-tokens.sql`)
- [ ] Add account lockout (≥5 failures in 15 min)
- [ ] Implement email verification flow (OTP via SES)
- [ ] Add “Remember me” (60 days vs 30)
- [ ] Rate limit password‑reset (max 3 requests/hour)
- [ ] Log session activity (IP, timestamps)
- [ ] Support multi‑session concurrency
- [ ] Build admin audit log (migration `0005`, `auth-audit.ts`, `/api/admin/auth-audit`)
- [ ] Create auth middleware (`auth-middleware.ts`) with `requireAuth`, `requireAdmin`, `optionalAuth`
- [ ] Generate OpenAPI docs (`auth-openapi.ts`)
- [ ] Provide sandbox auth endpoint (`/api/auth/sandbox`)
- [ ] Validate `SESSION_SECRET` (≥32 bytes)
- [ ] Verify D1 binding in `wrangler.jsonc`
- [ ] Ensure `/api/config` endpoint exposes required keys

## 📧 Email & Suppression

- [ ] Verify Cloudflare Email service is active
- [ ] Set up suppression table in D1 (`email_suppression`) with 5‑year retention
- [ ] Integrate suppression check into `email-sender.ts`

## 📊 Analytics Stack Completion

- [ ] Generate parquet files from R2 analytics data
- [ ] Verify `analytics-client.ts` connects to `/api/analytics/r2`
- [ ] Create DuckDB views for funnel metrics (`v_funnel_metrics`)
- [ ] Set up daily rollup cron for analytics data
- [ ] Configure Metabase connection to DuckDB
- [ ] Build dashboards: Lead Sources, Deal Velocity, CLV Cohorts
- [ ] Replace Google Analytics with Plausible (already done)
- [ ] Set up analytics ingestion for Workers AI calls

## 🚀 Performance Optimizations

- [ ] Optimize R2 cache‑control headers (increase to 7 days for static assets)
- [ ] Add Cloudflare Cache Rules for `/api/analytics/*`
- [ ] Pre‑warm Workers cache after deployments
- [ ] Run `ANALYZE=true next build` and audit bundle sizes
- [ ] Remove unused AWS SDK imports
- [ ] Consider dropping `langchain`, `aws-sdk` if not used
- [ ] Reduce cloudless‑app replicas from 5 → 3 (if traffic permits)
- [ ] Lower PostgreSQL request from 1 Gi → 512 Mi (if usage low)
- [ ] Configure HPA for AppFlowy services

## 🔄 Data Migration Cleanup

- [ ] Finalize PostgreSQL → D1 sync (55 users, 54 roles verified)
- [ ] Migrate remaining S3 assets to R2
- [ ] Clean stale entries from `analytics_cache`
- [ ] Add retention policy for `admin_notification` (90 days → archive)

## 🧪 Testing & CI/CD

- [ ] Add E2E tests for D1 auth endpoints
- [ ] Add unit tests for password‑reset flow
- [ ] Test chat streaming fallback (Workers AI → Anthropic)
- [ ] Verify all locale redirects work (`next-intl` middleware)
- [ ] Update GitHub Actions to use RUNNER_GENERIC failover (ARM64 compatibility)
- [ ] Add smoke test for Workers deployment
- [ ] Add Lighthouse audit step to pipeline

## 📚 Documentation & Knowledge Base

- [ ] Add architecture docs to DevDocs storage (`migration-completion.md`)
- [ ] Create `cloudflare-tunnel-cert-renewal.md`
- [ ] Create `d1-backup-restore.md`
- [ ] Create `workers-failover-playbook.md`
- [ ] Create `cluster-map-pod-status.md`
- [ ] Create `analytics-etl-pipeline.md`
- [ ] Create `oauth-provider-setup.md`
- [ ] Create `stripe-webhook-idempotency-r22.md`
- [ ] Document MCP tool usage patterns (`server.py` reference)
- [ ] Update `CLOUDFLARE-TUNNEL-MIGRATION.md` (2026‑07‑20 fixes)
- [ ] Update `ACTIONS-REQUIRED.md` (2026‑07‑19)
- [ ] Create `PENDING-ACTIONS-RUNBOOK.md` (2026‑07‑19)

## ✅ Completed (Check Off When Done)

- [ ] R2 buckets created (`cloudless-assets`, `cloudless-analytics`, `app-media-bucket`, `datalake-bucket`)
- [ ] D1 database created (`user-auth-db`)
- [ ] Wrangler configuration ready (`wrangler.jsonc`, `wrangler-cloudflare-free.json`)
- [ ] Schema migration files created (`0001-auth-schema.sql`, `0002-d1-optimizations.sql`, `0006-email-suppression.sql`, `0007-app-config.sql`)
- [ ] Worker endpoint created (`index-cloudflare-free.js`) with auth, chat, analytics
- [ ] `AUTH_PROVIDER` set to `"d1"` in environment variables
- [ ] Worker deployed and health endpoint confirmed
- [ ] Authentication routes implemented (register, login, logout, reset‑password, reset‑confirm)
- [ ] All 11 services operational via tunnel (grafana, kuma, n8n, ntfy, espocrm, meili, postiz, appflowy, docs)
