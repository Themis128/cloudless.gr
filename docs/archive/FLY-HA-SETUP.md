# Fly.io HA Proxy Setup

## Architecture

```
Internet → Fly.io Proxy (fra region)
                    │
                    ├──→ Primary: Cloudflare Workers (cloudless.gr)
                    │           └── /api/health checked every 30s
                    │
                    └──→ Fallback: Pi/k3s via Tailscale (github-omv.tail4ecae1.ts.net)
                                └── Manual failover when Workers unavailable
```

## Deployment

```bash
# Deploy the proxy
cd fly-proxy-app
flyctl deploy

# Set environment variables
flyctl secrets set FALLBACK_HOST=github-omv.tail4ecae1.ts.net
flyctl secrets set PRIMARY_HOST=cloudless.gr
```

## Monitoring

```bash
# Check proxy health
curl https://cloudless-proxy.fly.dev/health

# View logs
flyctl logs

# Check failover status
flyctl ssh console "cat /proc/1/environ"  # View env vars
```

## Failover Behavior

- Health check happens every 30s
- If `/api/health` on cloudless.gr returns 200, use primary
- On failure, route all traffic to Pi/standby via Tailscale
- Auto-failback when primary recovers

## Required Environment

- Tailscale SSH key for Pi access
- Cloudflare API token (for Workers health endpoint)