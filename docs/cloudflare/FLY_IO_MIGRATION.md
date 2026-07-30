# Fly.io HA Failover Architecture - Full Migration Plan

## Decision: DNS Failover vs Fly.io Proxy

**Current Setup:**

- `ha-failover-watchdog.yml` switches DNS every 5 minutes between Worker and Pi
- Uses Cloudflare DNS (free tier) + Tailscale Funnel for Pi access
- Detection time: ~5 minutes, Failover time: DNS TTL

**Fly.io Proxy Approach:**

- Immediate failover (30s health check) without DNS propagation delays
- Free tier (256MB RAM) covers the proxy needs
- Self-contained in Fly.io (no dependency on GitHub Actions)

## Current Architecture (AWS + Pi Dual-Home)

### Primary Targets (Managed by ha-failover-watchdog.yml)

```
DNS: cloudless.gr → cloudless-gr.baltzakis-themis.workers.dev (PRIMARY)
                      omv.tail8eb71.ts.net (STANDBY via Tailscale Funnel)
```

## Proposed Architecture (Fly.io Proxy Layer)

```
DNS: cloudless.gr (CNAME → Fly.io app)
           │
           ▼
    ┌─────────────────┐
    │  Fly.io Proxy    │ (Free tier, Frankfurt region)
    │  • /health check  │
    │  • 30s TTL cache  │
    └────────┬────────┘
             │
     ┌───────┴───────┐
     │               │
     ▼               ▼
┌─────────┐    ┌───────────┐
│Worker    │    │Pi Tailscale│
│(Cloudflare)│  │Funnel      │
│OR        │    │            │
│CloudFront│    │            │
│(Lambda)  │    │            │
└─────────┘    └───────────┘
```

## Implementation Files

### 1. Fly.io Proxy Application (`fly-proxy-app/`)

**`proxy.py`** - FastAPI reverse proxy with:

- Health check to primary every 30s
- Automatic failover to fallback on failure
- Transparent request/response proxying

**`Dockerfile`** - Python 3.11 slim container

**`requirements.txt`** - fastapi, uvicorn, httpx

### 2. Fly.io Configuration (`fly.toml`)

```toml
app = "cloudless-proxy"
primary_region = "fra"

[build]
  context = "fly-proxy-app"

[[services]]
  internal_port = 8080
  protocol = "tcp"
  [[services.ports]]
    port = 80
    handlers = ["http"]
  [[services.http_options]]
    health_check_path = "/health"
    health_check_interval = "30s"

[env]
  PRIMARY_HOST = "d3k7muo3c6lw6s.cloudfront.net"
  FALLBACK_HOST = "omv.tail8eb71.ts.net"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory = "256mb"
```

## Deployment Steps

### Step 1: Add FLY_API_TOKEN Secret

Add to GitHub Secrets: `Settings → Secrets → FLY_API_TOKEN`

### Step 2: Deploy via GitHub Actions

```
GitHub → Actions → "Deploy Fly.io Proxy" → Run workflow
```

### Step 3: Get Fly.io App URL

```bash
flyctl ips list --app cloudless-proxy
# Output: your-app.fly.dev
```

### Step 4: Update Cloudflare DNS (if using Fly.io as ingress)

In Cloudflare DNS dashboard:

1. Create CNAME record for `cloudless.gr` → `cloudless-proxy.fly.dev`
2. Create CNAME record for `www.cloudless.gr` → `cloudless-proxy.fly.dev`
3. **Proxy status: DNS only** (orange cloud OFF)

## MCP Integration

The `agent-deploy-dashboard-mcp` is already added to `mcp.json`:

```json
"agent-deploy-dashboard": {
  "type": "http",
  "url": "https://agent-deploy-dashboard-mcp.onrender.com/mcp"
}
```

### Available MCP Tools for Fly.io

| Tool | Status | Notes |
|------|--------|-------|
| `check_health(url)` | ✅ Works | Universal health checker |
| `list_all_services()` | ✅ Works | Lists Fly.io apps (basic) |
| `get_deploy_status()` | ⏳ Planned | Not implemented for Fly.io |
| `tail_logs()` | ⏳ Planned | Not implemented for Fly.io |
| `get_env_vars()` | ⏳ Planned | Not implemented for Fly.io |
| `trigger_redeploy()` | ⏳ Planned | Not implemented for Fly.io |

## Monitoring

### Health Check Endpoints

- **Fly.io proxy health**: `https://cloudless-proxy.fly.dev/health`
- **AWS backend**: `https://cloudless.gr/api/health` (via CloudFront)
- **Worker**: `https://cloudless-gr.baltzakis-themis.workers.dev/api/health`
- **Pi standby**: `https://omv.tail8eb71.ts.net/api/health`

### Using MCP for Monitoring

```bash
# Check proxy health
curl -X POST https://agent-deploy-dashboard-mcp.onrender.com/api/v1/check_health \
  -d '{"url": "https://cloudless-proxy.fly.dev/health"}'

# List Fly.io services (requires FLY_API_TOKEN)
curl -X POST https://agent-deploy-dashboard-mcp.onrender.com/api/v1/list_all_services
```

## Rollback Plan

If issues arise:

1. Delete the Fly.io app: `flyctl apps destroy cloudless-proxy`
2. Revert DNS in Cloudflare to original:
   - `cloudless.gr` → `cloudless-gr.baltzakis-themis.workers.dev`
   - `www.cloudless.gr` → `cloudless-gr.baltzakis-themis.workers.dev`
3. The watchdog workflow will resume DNS-based failover

## Cost Analysis

| Component | Current | Proposed |
|-----------|---------|----------|
| Cloudflare | Free | Free |
| Cloudflare LB | ❌ Paid add-on | ❌ Not needed |
| Fly.io Proxy | N/A | Free tier (256MB RAM) |
| GitHub Actions | Free | Free |

## Benefits of Fly.io Proxy

1. **Faster failover** - 30s detection vs 5 minute DNS polling
2. **No DNS propagation delays** - Immediate switch to standby
3. **Self-contained** - No dependency on GitHub Actions availability
4. **MCP monitoring** - Deployment status via AI agent
5. **Simpler architecture** - Single proxy handles all routing logic
