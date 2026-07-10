# Cloudflare-Only Migration Guide

> Last updated: 2026-07-10  
> Status: Pi primary + Workers fallback architecture

## Overview

This document describes the migration from AWS SST (Lambda+CloudFront) to Cloudflare-only infrastructure:

- **Primary**: Pi k3s cluster via Cloudflare Tunnel
- **Secondary**: Cloudflare Workers (static fallback for maintenance)
- **HTTPS**: Automatic via Cloudflare (no manual cert management)

## Architecture

```
cloudless.gr / www.cloudless.gr
        │
        ▼
 Cloudflare Load Balancer
        │
        ├─► [PRIMARY]   cl-pi-<host>     pi-origin.cloudless.gr
        │               (Pi via Cloudflare Tunnel)
        │               health: GET /api/health, expect 200, interval=60s
        │
        └─► [FALLBACK] cl-worker-<host> cloudless-failover.baltzakis-themis.workers.dev
                         (Cloudflare Workers)
                         health: same
```

## Prerequisites

### Cloudflare Token (SSM)

A Cloudflare API token with these permissions is required in SSM:
- `/cloudless/production/CLOUDFLARE_API_TOKEN` (SecureString)

Token scopes:
| Permission | Type |
|---|---|
| Zone → Zone → **Read** | cloudless.gr zone |
| Zone → Load Balancing: Monitors and Pools → **Edit** | cloudless.gr zone |
| Zone → Load Balancing: Load Balancers → **Edit** | cloudless.gr zone |
| Zone → DNS → **Edit** | cloudless.gr zone |
| Account → Cloudflare Tunnel → **Edit** | For tunnel creation |

### Cloudflare Account ID (SSM)

- `/cloudless/production/CLOUDFLARE_ACCOUNT_ID` (String)

## Setup Steps

### 1. Create Cloudflare Tunnel (one-time)

Run the setup-tunnel workflow:

```bash
# Or dispatch manually via GitHub UI
gh workflow run setup-pi-tunnel.yml
```

This creates:
- Tunnel: `cloudless-pi` (in Cloudflare dashboard)
- DNS: `pi-origin.cloudless.gr` → CNAME to tunnel
- SSM secret: `/cloudless/production/TUNNEL_TOKEN` (for k8s)

### 2. Deploy Tunnel to Pi Cluster

Apply the tunnel manifest to the Pi k3s cluster:

```bash
# Get token from SSM and create secret
kubectl create secret generic cloudflare-tunnel-token \
  --from-literal=token="$(aws ssm get-parameter --name /cloudless/production/TUNNEL_TOKEN --with-decryption --query Parameter.Value --output text)" \
  -n cloudless --dry-run=client -o yaml | kubectl apply -f -

# Apply tunnel deployment
kubectl apply -f k8s/tunnel/pi-tunnel.yaml
```

### 3. Verify Tunnel

```bash
curl -sI https://pi-origin.cloudless.gr/api/health
# Should return HTTP 200

curl -sI https://pi-origin.cloudless.gr/
# Should return the site homepage
```

### 4. Configure Load Balancer

Run the LB setup workflow with `apply=true`:

```bash
gh workflow run cloudflare-lb.yml -f apply=true
```

Or via GitHub UI: Actions → "Cloudflare HA load balancer" → Run workflow → `apply = true`

## SSL/TLS Certificates

**No manual certificate management required.** Cloudflare handles HTTPS automatically:

1. **Tunnel endpoint** (pi-origin.cloudless.gr): HTTPS terminated at Cloudflare edge
2. **Main domain** (cloudless.gr): HTTPS via Cloudflare's universal SSL
3. **Edge certificate**: Auto-provisioned, auto-renewed by Cloudflare

The tunnel connects via HTTP internally (port 80 → cloudless-app service), and Cloudflare adds the TLS layer externally.

## DNS Configuration

| Record | Type | Content | Purpose |
|---|---|---|---|
| @ | LB | cloudflare-lb-xxxxx.cloudflare.com | Main site (proxied) |
| www | LB | cloudflare-lb-xxxxx.cloudflare.com | WWW redirect (proxied) |
| pi-origin | CNAME | xxx.cfargotunnel.com | Pi tunnel endpoint (proxied) |

## Failover Behavior

- **Normal**: All traffic → Pi k3s cluster
- **Pi maintenance down**: Traffic → Cloudflare Workers fallback
- **Health check interval**: 60 seconds (fail after 2 consecutive failures)

## AWS Decommission Checklist

When ready to remove AWS entirely:

- [ ] Verify Cloudflare Tunnel works
- [ ] Verify LB routes to Pi
- [ ] Verify Workers fallback works
- [ ] Migrate any AWS-specific services (see below)
- [ ] Remove SST deployment (`sst.config.ts`)
- [ ] Remove CloudFront distributions from AWS
- [ ] Remove Lambda functions from AWS
- [ ] Remove DynamoDB tables (or migrate to D1/KV)
- [ ] Reduce AWS IAM permissions

## AWS Services to Migrate/Replace

| AWS Service | Replacement |
|---|---|
| Lambda (Next.js) | Pi k3s + Workers |
| CloudFront | Cloudflare LB/Tunnel |
| DynamoDB (user profile) | Consider D1 or keep Cognito |
| DynamoDB (transactions) | Consider D1 |
| SES (email) | Consider Email Routing or keep |
| SSM (secrets) | Cloudflare Secrets Store |

## Files Modified for Migration

- `scripts/setup-cloudflare-lb.sh` - Pi primary, Workers fallback
- `.github/workflows/cloudflare-lb.yml` - Updated comments
- `k8s/tunnel/pi-tunnel.yaml` - New tunnel manifest
- `.github/workflows/setup-pi-tunnel.yml` - New tunnel setup workflow

## Troubleshooting

### Tunnel not connecting

```bash
# Check tunnel logs on Pi
kubectl logs -l app=cloudflare-tunnel -n cloudless

# Verify token is in secret
kubectl get secret cloudflare-tunnel-token -n cloudless -o yaml
```

### Health check failing

```bash
# Check Pi health endpoint
curl -sI https://pi-origin.cloudless.gr/api/health

# Check LB status
curl -sI https://cloudless.gr/api/health
```

### SSL certificate issues

Cloudflare automatically provisions certificates. If issues arise:

1. Check Zone → SSL/TLS → Edge Certificates in Cloudflare dashboard
2. Verify the DNS record is proxied (orange cloud)
3. Allow 5-10 minutes for certificate provisioning