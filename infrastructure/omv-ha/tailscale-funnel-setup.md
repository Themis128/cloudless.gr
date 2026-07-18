# Tailscale Funnel Setup for omv-ha Standby Node

**STATUS: MIGRATED TO CLOUDFLARE WORKERS** (July 2026)

The cloudless.gr application has been migrated from k3s to Cloudflare Workers. The Tailscale Funnel failover is no longer required as the primary application is now served directly by Cloudflare.

## Current Architecture

```
                     ┌─────────────────────┐
                     │   Cloudflare Worker   │
                     │  cloudless.gr (primary)│
                     │  /api/health: 200 OK   │
                     └─────────────────────┘
```

## Migration Complete (July 2026)

- Main application: `https://cloudless.gr` → Cloudflare Workers ✓
- Health endpoint: `/api/health` returns `{"status":"ok","authProvider":"d1"}` ✓
- k3s `cloudless-app` deployment removed (was pulling from AWS ECR) ✓
- `pi-origin.cloudless.gr` no longer serves the application

## Alternative: Proxy to Workers (Optional)

If Tailscale Funnel is still desired for internal access, configure nginx to proxy to the Workers endpoint:

```nginx
# /etc/nginx/sites-available/cloudless-workers
server {
    listen 8080;
    server_name pi-origin.cloudless.gr;

    location / {
        proxy_pass https://cloudless.gr;
        proxy_set_header Host cloudless.gr;
        proxy_ssl_server_name on;
        proxy_ssl_name cloudless.gr;
    }
}
