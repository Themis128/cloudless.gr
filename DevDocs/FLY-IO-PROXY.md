# Fly.io HA Failover Proxy

## Overview

The Fly.io proxy (`cloudless-proxy`) provides an external failover endpoint that sits outside Cloudflare's infrastructure. This provides redundancy when Cloudflare experiences issues.

## Service Details

| Property | Value |
|----------|-------|
| **App Name** | cloudless-proxy |
| **Region** | fra (Frankfurt) |
| **Status** | Deployed (2 machines) |
| **Primary Backend** | cloudless.gr (Cloudflare Workers) |
| **Fallback Backend** | omv.tail8eb71.ts.net (Pi k3s via Tailscale) |

## Configuration

### fly.toml

```toml
app = "cloudless-proxy"
primary_region = "fra"

[build]
  context = "fly-proxy-app"
  dockerfile = "Dockerfile"

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
  PRIMARY_HOST = "cloudless.gr"
  FALLBACK_HOST = "omv.tail8eb71.ts.net"
```

### proxy.py (FastAPI Implementation)

Located in `fly-proxy-app/proxy.py`:

- Health checks primary backend every 30s
- Proxies to primary when healthy, fallback otherwise
- 30s cache TTL for health status

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Returns proxy health status |
| `/{path:path}` | * | Proxies all requests with failover |

### Health Check Response

```json
{
  "status": "healthy",
  "primary": "cloudless.gr",
  "fallback": "omv.tail8eb71.ts.net",
  "primary_healthy": true
}
```

## Failover Behavior

1. **Normal Operation**: Traffic routes to `cloudless.gr` (Cloudflare Workers)
2. **Cloudflare Down**: Health check fails → Traffic routes to Pi via Tailscale
3. **Both Down**: Returns 502/503

## Verification Commands

```bash
# Check proxy status
fly status --app cloudless-proxy

# View logs
fly logs --app cloudless-proxy

# Manual health check
curl https://cloudless-proxy.fly.dev/health
```

## Architecture Context

```
Internet → Cloudflare LB → Pi k3s (via Tunnel)
    ↓ (if Cloudflare issues)
Fly.io proxy → Pi k3s (direct via Tailscale)
```

The Fly.io proxy provides an external entry point that bypasses Cloudflare when needed, ensuring availability during:

- Cloudflare outages
- DNS propagation issues
- TLS certificate problems
- Regional connectivity issues

## Related Documentation

- `FLY-IO-IMPLEMENTATION.md` - Full implementation details
- `SST-CLOUDFLARE-HYBRID-ARCHITECTURE.md` - Overall architecture
- `CLOUDFLARE-TUNNEL-MIGRATION.md` - Tunnel configuration
