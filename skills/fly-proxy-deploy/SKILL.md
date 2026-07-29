---
name: fly-proxy-deploy
description: |
  Deploy and redeploy the Fly.io HA proxy for Cloudflare Workers failover. Use when
  you need to update the proxy configuration, change PRIMARY_HOST from Lambda to
  Workers, redeploy after fly.toml changes, or troubleshoot proxy issues. Triggered
  by phrases like "redeploy fly proxy", "fly.io proxy update", "deploy fly.io",
  "flyctl deploy", "ha proxy redeploy", "cloudflare failover", or "PRIMARY_HOST
  update".
---

# Fly.io HA Proxy Deploy

Deploys and manages the Fly.io High Availability proxy that routes traffic to
Cloudflare Workers (primary) with Tailscale fallback to Pi/k3s (secondary).

## When to invoke this skill

- Migration complete and you need to deploy the HA proxy
- fly.toml PRIMARY_HOST needs updating
- Proxy returns 503 or connection errors
- Need to change environment variables (PRIMARY_HOST, FALLBACK_HOST)

## Prerequisites

```bash
# Install flyctl (if not already)
curl -L https://fly.io/install.sh | sh

# Authenticate
flyctl auth login

# Or use access token (for CI)
export FLY_ACCESS_TOKEN="your-token"
```

## Stage 1 — Verify Current Configuration

```bash
# Check current fly.toml
cat fly.toml

# Verify current deployment status
flyctl status --app cloudless-proxy

# Check current PRIMARY_HOST
flyctl secrets list --app cloudless-proxy
```

Expected configuration in fly.toml:

```toml
app = "cloudless-proxy"
primary_region = "fra"

[env]
  PRIMARY_HOST = "cloudless.gr"
  FALLBACK_HOST = "omv.tail8eb71.ts.net"

[[services.http_options]]
  health_check_path = "/health"
  health_check_interval = "30s"
```

## Stage 2 — Deploy the Proxy

```bash
# Deploy with current configuration
flyctl deploy --app cloudless-proxy --config fly.toml

# Or for a specific region
flyctl deploy --app cloudless-proxy --region fra
```

## Stage 3 — Update Environment Variables

If you need to change PRIMARY_HOST or FALLBACK_HOST:

```bash
# Update PRIMARY_HOST (switch between Lambda and Workers)
flyctl secrets set --app cloudless-proxy PRIMARY_HOST="cloudless.gr"

# Update FALLBACK_HOST
flyctl secrets set --app cloudless-proxy FALLBACK_HOST="omv.tail8eb71.ts.net"

# Verify changes
flyctl secrets list --app cloudless-proxy
```

After changing secrets, redeploy:

```bash
flyctl deploy --app cloudless-proxy
```

## Stage 4 — Verify Deployment

```bash
# Check deployment status
flyctl status --app cloudless-proxy

# Check logs
flyctl logs --app cloudless-proxy

# Test the proxy health endpoint
curl -s https://cloudless.gr/api/health

# Check DNS (should point to Fly.io IPs if proxy is primary entry)
dig cloudless.gr +short
```

## Stage 5 — Monitor Health Checks

```bash
# Stream logs with health check info
flyctl logs --app cloudless-proxy --follow

# Check service status
flyctl services list --app cloudless-proxy

# Get metrics (if available)
flyctl metrics list --app cloudless-proxy
```

## Stage 6 — Rollback if Needed

If the proxy causes issues after deployment:

```bash
# Rollback to previous release
flyctl releases list --app cloudless-proxy
flyctl deploy --app cloudless-proxy --image cloudless-proxy@previous-sha

# Or revert configuration
git checkout HEAD~1 -- fly.toml
flyctl deploy --app cloudless-proxy
```

## Common Issues

### Proxy Returns 503

- Check PRIMARY_HOST is reachable
- Check health check endpoint is working: `curl https://cloudless.gr/api/health`
- Check Fly.io logs: `flyctl logs --app cloudless-proxy --follow`

### Backend Connection Refused

- Verify FALLBACK_HOST Tailscale address is correct
- Check Tailscale connectivity on omv node
- Verify Pi/k3s services are running

### Health Check Failing

- Primary health endpoint may be down
- Check Workers: `npx wrangler tail`
- Consider increasing health_check_interval

## See Also

- `skills/cloudflare-token-doctor/SKILL.md` — Cloudflare API access
- `skills/aws-post-migration/SKILL.md` — Post-migration cleanup
- `MIGRATION-STATUS.md` — Migration completion status
- `fly.toml` — Current proxy configuration
- `fly-proxy-app/proxy.py` — Proxy application code
