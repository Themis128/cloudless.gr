# Cloudless.gr — High Availability Architecture

## Overview

Cloudless.gr operates with a **dual-homed HA architecture**:

- **PRIMARY**: AWS Serverless (Lambda + CloudFront) - always active
- **SECONDARY**: k3s Pi Cluster (Raspberry Pi 5 standby) - automatic failover

Both serve the identical Next.js application, deployed via automated pipelines that keep them in sync.

---

## 1. AWS Serverless Application (Primary)

### Deployment Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLOUDLESS.GR                             │
│                    PRIMARY DEPLOYMENT                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ ROUTE 53 (NOT USED FOR DNS)                                      │
│   - Domain cloudless.gr delegated to Cloudflare (ns records point    │
│     to Cloudflare nameservers)                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ CLOUDFLARE (DNS + CDN)                                           │
│   - Edge cache + WAF + Workers AI                                 │
│   - HA Failover Watchdog (ha-failover-watchdog.yml)                │
│   - Tunnels for internal services (e977a490...cfargotunnel.com)    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ CLOUDFRONT DISTRIBUTION                                           │
│   - apex.cloudless.gr → d3k7muo3c6lw6s.cloudfront.net            │
│   - www.cloudless.gr  → dgrxxatzrgxfi.cloudfront.net             │
│   - ACM Certificate: f505905a-97b4-46b0-a2b0-fb1900f425b2       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ AWS LAMBDA (arm64, 1024 MB, 30s timeout)                          │
│   - Next.js 16.2.1 App Router                                      │
│   - Node.js 22.x runtime                                            │
│   - Warm: 5 instances (min cold-start latency)                     │
│   - SST v4.15.2 deploy (sst.config.ts)                             │
│   - X-Ray active tracing enabled                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ COGNITO USER POOL                                                 │
│   - Auth: AWS Cognito (Hosted UI at cloudless-auth.auth.us-east-1  │
│            .amazoncognito.com)                                      │
│   - next-auth v5 integration                                         │
│   - Groups: "admin" for admin access                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ DYNAMODB TABLES                                                   │
│   - StripeTransactions (webhook events, orders)                   │
│   - UserProfile (name/company/phone/preferences)                  │
│   - AdminNotifications (CRM interactions log)                     │
│   - AnalyticsCache (GSC response cache)                             │
│   - SessionTokenStore (JWT token offload, avoids 4KB cookie limit)   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Configuration

- **Domain**: `https://cloudless.gr` (served via CloudFront)
- **Health Check**: `GET /api/health` → expects 200, checked every 5 min (watchdog)
- **Failover Trigger**: HA failover watchdog detects CloudFront unhealthy, swaps DNS to cfargotunnel
- **Staging**: `${stage}.cloudless.gr` (feature/staging environments)

---

## 2. k3s Pi Cluster (HA Failover)

### Cluster Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                     omv-ha (192.168.1.130)                      │
│                     Pi 5 • 8GB RAM                              │
│                     ARM64 • Debian 13 • k3s                        │
│                     node-type=standby:NoSchedule                   │
├─────────────────────────────────────────────────────────────────┤
│ STATUS: Standby - No workloads scheduled (taint blocks scheduling) │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     omv (192.168.1.128)                         │
│                     Pi 5 • 8GB RAM • 120GB SSD                    │
│                     ARM64 • Debian 13 • k3s v1.35.4               │
│                     control-plane node                             │
├─────────────────────────────────────────────────────────────────┤
│ SERVICES:                                                          │
│   - cloudless-app (Next.js deployment, 1-5 pods)                   │
│   - traefik (load balancer)                                        │
│   - cert-manager + Internal CA                                     │
│   - Rancher (fleet management)                                     │
│   - monitoring stack (Grafana, Loki, partial Prometheus)           │
│   - Tailscale operator (MagicDNS for .ts.cloudless.gr)             │
│   - meilisearch, n8n, appflowy, espocrm, postiz                   │
└─────────────────────────────────────────────────────────────────┘
```

### Failover Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ CLOUDFLARE HA FAILOVER WATCHDOG                                  │
│   Runs every 5 minutes (cron schedule). On each run:               │
│                                                                    │
│   1. Probes CloudFront directly:                                    │
│      GET https://d3k7muo3c6lw6s.cloudfront.net/api/health         │
│      (with Host: cloudless.gr header)                               │
│                                                                    │
│   2. If primary unhealthy for 2 consecutive failures:              │
│      - Swap cloudless.gr CNAME from CloudFront to                 │
│        e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com   │
│      - Notify Slack on failover                                    │
│                                                                    │
│   3. If healthy for 5 consecutive successes:                       │
│      - Swap CNAME back to CloudFront                               │
│      - Notify Slack on recovery                                      │
│                                                                    │
│   Hysteresis prevents flapping - failure window ~3 min,            │
│   recovery window ~5 min.                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Image Synchronization Pipeline

### Automated Sync Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ GITHUB PUSH TO main                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ .github/workflows/deploy.yml                                        │
│   - Triggers on: push to main                                      │
│   - SST deploy: builds + deploys to AWS Lambda + CloudFront          │
│   - Publishes SHA to SSM /cloudless/production/cloud-sha           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ .github/workflows/ha-sync-orchestrator.yml                          │
│   - Triggers on: successful deploy.yml completion                 │
│   - Checks: ECR for existing SHA image tag                         │
│   - Dispatches build-pi-image.yml if needed                        │
│   - ECR check escape hatch: if image exists, skip wait (~45 min)  │
│   - Waits: up to 60 min for Pi build completion                    │
│   - Waits: up to 30 min for k3s rollout                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ .github/workflows/build-pi-image.yml                                 │
│   - Triggers on: push to main, manual dispatch, orchestrator dispatch │
│   - Runs on: ubuntu-latest (GH-hosted, QEMU arm64)               │
│   - Builds: linux/arm64 Next.js image                              │
│   - Tags: SHA-full + SHA-short (immutable), SHA-latest if writable  │
│   - Pushes to: ECR cloudless-pi-app                                │
│   - Records digest in SSM /cloudless/production/ECR_LATEST_DIGEST   │
│   - Triggers Pi sync webhook (via Tailscale Funnel)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ .github/workflows/deploy-pi.yml                                      │
│   - Runs in parallel or after build-pi-image.yml                    │
│   - Runs on: ${{ vars.RUNNER_GENERIC }} (ubuntu-latest default)   │
│   - GH-hosted runner joins Tailscale (DERP relay)                  │
│   - Uses KUBECONFIG_B64 secret to access k3s API                   │
│   - Runs: kubectl set image deployment/cloudless                 │
│   - Waits: rollout status (60s timeout)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ k3s ROLLOUT                                                        │
│   - Pulls new image from ECR (requires regcred-ecr secret)           │
│   - Updates pods in cloudless namespace                              │
│   - Probes /api/health for readiness                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Cloudflare Configuration

### Current Failover Mechanism: HA Watchdog (No Load Balancing Add-on)

The account does NOT have the paid Cloudflare Load Balancing add-on. Instead, a watchdog workflow handles failover by swapping DNS records.

### Token Permissions (for Watchdog)

| Permission | Scope | Type |
|------------|-----|------|
| Zone.Zone | cloudless.gr | Read |
| Zone.DNS | cloudless.gr | Edit |

### HA Failover Watchdog Configuration (ha-failover-watchdog.yml)

```yaml
# Scheduled every 5 minutes (GitHub minimum)
PRIMARY_TARGET: "d3k7muo3c6lw6s.cloudfront.net"
STANDBY_TARGET: "e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com"
HEALTH_URL: "https://d3k7muo3c6lw6s.cloudfront.net/api/health"
HEALTH_HOST_HEADER: "cloudless.gr"
HEALTH_TIMEOUT_SEC: "15"

# Hysteresis thresholds
FAIL_THRESHOLD: "2"      # ~3 min to fail over
RECOVER_THRESHOLD: "5"   # ~5 min to recover
```

### Tunnel Configuration

- **Tunnel ID**: `e977a490-58c5-4fdb-9155-86832e3e636a`
- **FQDN**: `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com`
- **Tailscale Funnel**: Pi services accessible via `omv.tail8eb71.ts.net` (for sync webhook)

---

## 5. Configuration Requirements

### Secrets Required in .env.local / GitHub Secrets

```
# Cloudflare
CLOUDFLARE_API_TOKEN=<token>  # Zone:Read + DNS:Edit for watchdog

# Tailscale
TAILSCALE_AUTH_KEY=<tskey-...>
TS_AUTHKEY=<tskey-...>

# AWS / Cognito
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

COGNITO_CLIENT_ID=
COGNITO_CLIENT_SECRET=
COGNITO_ISSUER=
COGNITO_USER_POOL_ID=

AUTH_SECRET=
AWS_DEPLOY_ROLE_ARN=
KUBECONFIG_B64=<base64 kubeconfig to omv k3s API>
SYNC_HMAC_SECRET=  # For webhook-triggered Pi image sync
```

---

## 6. Current Status

### ✅ Working Components

- [x] AWS Serverless deployment (SST + Lambda + CloudFront)
- [x] Cognito authentication + next-auth v5
- [x] Pi cluster running on omv (192.168.1.128)
- [x] Image build pipeline (build-pi-image.yml) - GH-hosted ubuntu-latest
- [x] Pi deployment pipeline (deploy-pi.yml)
- [x] HA sync orchestrator (ha-sync-orchestrator.yml)
- [x] Cloudflare Tunnel (active for all subdomains)
- [x] Monitoring stack (Grafana, Loki) accessible
- [x] HA failover watchdog (ha-failover-watchdog.yml)

### ⚠️ Notes

- [ ] Cloudflare Load Balancing add-on NOT purchased
  - The watchdog workflow (ha-failover-watchdog.yml) handles failover instead
  - If Load Balancing is purchased in the future, use setup-cloudflare-lb.sh

### 📊 Cluster Health

| Namespace | Status | Notes |
|-----------|--------|-------|
| monitoring | Partial | Prometheus/Alertmanager pending (node selector fix applied) |
| tailscale-system | Running | Operator pods active (Helm release status may show stale) |
| cloudless | Running | 1-5 pods on omv primary (hpa) |
| cattle-system | Running | Rancher fleet management |

---

## 7. Verification Commands

```bash
# Check AWS app (primary)
curl -sI https://d3k7muo3c6lw6s.cloudfront.net/api/health \
  -H "Host: cloudless.gr"
# Expected: HTTP/2 200

# Check via domain (shows which origin is active)
curl -sI https://cloudless.gr/api/health
# Expected: HTTP/2 200

# Check Pi app (via cfargotunnel)
curl -sI https://e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com/api/health
# Expected: HTTP/2 200

# Check image sync status in ECR
aws ecr describe-images \
  --repository-name cloudless-pi-app \
  --region us-east-1 \
  --query 'imageDetails[0].[imageTags[0], imagePushedAt]' \
  --output table

# Check SSM tracking
aws ssm get-parameter --name /cloudless/production/pi-sha
aws ssm get-parameter --name /cloudless/production/cloud-sha

# List recent HA sync runs
gh run list --workflow=ha-sync-orchestrator.yml \
  --limit 10 --json conclusion,createdAt,status
```

---

## 8. Failover Test Procedure

1. **Verify current state**: Confirm AWS is serving traffic

   ```bash
   curl -sI https://cloudless.gr/api/health
   ```

2. **Check watchdog status**: View recent runs

   ```bash
   gh run list --workflow=ha-failover-watchdog.yml -L 5
   ```

3. **Simulate AWS failure**: Block `/api/health` temporarily (requires AWS console access or route modification)

4. **Observe failover**: After 2 consecutive unhealthy checks (~3 min), domain CNAME swaps to cfargotunnel

5. **Verify Pi serving**: curl cloudless.gr shows Pi version

   ```bash
   curl -sI https://cloudless.gr/api/health
   ```

6. **Restore AWS**: When CloudFront recovers for 5 consecutive checks (~5 min), DNS swaps back

7. **Manual override**: Force state via workflow dispatch

   ```bash
   gh workflow run ha-failover-watchdog.yml \
     --field force_state=primary
   gh workflow run ha-failover-watchdog.yml \
     --field force_state=standby
   ```

---

## 9. Files Reference

### AWS Serverless

- `sst.config.ts` - SST deployment configuration (Lambda, DynamoDB, Cognito)
- `.github/workflows/deploy.yml` - Production deploy (SST)
- `src/app/api/health/route.ts` - Health endpoint (version reporting)

### Pi Cluster

- `k8s/cloudless-app-optimized.yaml` - k3s Deployment spec (hpa, probes)
- `infrastructure/monitoring/` - Monitoring stack values
- `infrastructure/tailscale/` - Tailscale MagicDNS ingress

### HA / Cloudflare

- `.github/workflows/ha-failover-watchdog.yml` - DNS-based failover watchdog
- `.github/workflows/ha-sync-orchestrator.yml` - Sync orchestrator
- `.github/workflows/build-pi-image.yml` - Pi image build (GH-hosted)
- `.github/workflows/deploy-pi.yml` - Pi rollout (Tailscale + kubectl)
- `scripts/setup-cloudflare-lb.sh` - LB provisioning script (for future use)

---

## 10. Cloudflare Free Tier Migration (Planned)

### Migration Status

The project is preparing for a **zero-cost Cloudflare Free Tier** deployment as an alternative to AWS Serverless.

| Component | AWS Current | Cloudflare Free Target | Status |
|-----------|-------------|------------------------|--------|
| Lambda | ✅ Active | Workers (100K req/day) | Ready for migration |
| DynamoDB | ✅ Active | D1 Database (500MB) | Schema ready |
| S3 | ✅ Active | R2 Storage (10GB) | Buckets created |
| Cognito | ✅ Active | D1 + Custom Auth | ⚠️ Breaking changes |
| Athena | ✅ Active | DuckDB-Wasm (client-side) | ⚠️ Breaking changes |
| SSM | ✅ Active | Wrangler Secrets | Migration pending |

### Breaking Changes (Acknowledged)

- **OAuth/MFA**: Will be lost - email/password only
- **Password Reset**: Must implement custom flow
- **Serverless Cron**: Must use GitHub Actions or QStash
- **Server-side Analytics**: Moves to client-side DuckDB-Wasm

### Files for Migration

- `docs/MIGRATION-CLOUDFLARE-FREE.md` - Full migration guide
- `docs/CLOUDFLARE-MIGRATION-CHECKLIST.md` - Checklist for cutover
- `src/lib/auth-d1.ts` - D1-based authentication layer
- `src/lib/cloudflare-config.ts` - Workers configuration helpers
- `wrangler.jsonc` - Workers deployment configuration (with R2 + D1 bindings)

### Quick Migration Commands

```bash
# Pre-migration setup
npx wrangler r2 bucket put cloudless-assets
npx wrangler r2 bucket put cloudless-analytics
npx wrangler d1 create cloudless-auth

# Deploy to staging
pnpm cf:build && pnpm cf:deploy:free

# Check status
curl -sI https://cloudless.gr/api/health