# Tailscale Funnel Setup for omv-ha Standby Node

This document describes how to configure Tailscale Funnel on the omv-ha standby node to serve as the HA failover target for cloudless.gr.

## Architecture

```
                    ┌─────────────────────┐
                    │   Cloudflare Worker   │
                    │ cloudless.gr (primary)│
                    └──────────┬────────────┘
                                 │
                    (health check fails)
                                 │
                                 ▼
                    ┌─────────────────────┐
                    │   Fly.io Proxy        │
                    │ (probes + routes)     │
                    └──────────┬────────────┘
                                 │
                    (DNS switch or proxy)
                                 │
                                 ▼
                    ┌─────────────────────┐
                    │ omv-ha.tail8eb71.ts.net│
                    │ (Tailscale Funnel)   │
                    └──────────┬────────────┘
                                 │
                    (serves from omv's k3s)
                                 │
                                 ▼
                    ┌─────────────────────┐
                    │   omv k3s cluster   │
                    │  (Traefik + App)    │
                    └─────────────────────┘
```

## Prerequisites

1. Tailscale installed on omv-ha (already running as k3s agent)
2. Funnel enabled on the tailnet (requires Tailscale Funnel feature flag)
3. Port 443 accessible via funnel

## Setup Steps (on omv-ha node)

### 1. Verify Tailscale Status

```bash
# SSH to omv-ha
ssh tbaltzakis@192.168.1.130

# Check Tailscale is running
sudo systemctl status tailscaled
tailscale status
```

### 2. Configure Tailscale Funnel

The omv-ha node needs to proxy to omv's k3s cluster. Since omv-ha is only a k3s agent, we use it as a Tailscale-to-LAN gateway.

**Correct approach: Use nginx + Tailscale Funnel**

Tailscale Funnel exposes a local port, not arbitrary upstream URLs. Install nginx as reverse proxy:

```bash
sudo apt install -y nginx
```

Configure nginx to proxy to omv's Traefik (192.168.1.128:80):

```bash
sudo tee /etc/nginx/sites-available/cloudless-failover <<'EOF'
server {
    listen 8080;
    server_name omv-ha.tail8eb71.ts.net;

    location / {
        proxy_pass http://192.168.1.128:80;
        proxy_set_header Host cloudless.gr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/cloudless-failover /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

Expose nginx via Tailscale Funnel (the hostname is set in Tailscale admin):

```bash
# Expose nginx on port 8080 via Funnel
tailscale funnel --https=443 8080
```

**Note:** The Tailscale hostname `omv-ha.tail8eb71.ts.net` must be configured in the Tailscale admin panel under Funnel settings. Tailscale Funnel uses the MagicDNS name automatically.

### 3. Verify the Setup

```bash
# Test health endpoint
curl -H "Host: cloudless.gr" http://192.168.1.128:80/api/health

# Test via Funnel (from anywhere)
curl https://omv-ha.tail8eb71.ts.net/api/health
```

## Failover Flow

1. **Normal operation**: Cloudflare Worker serves cloudless.gr directly
2. **Worker failure**: HA watchdog detects unhealthy `/api/health` on primary
3. **DNS switch**: Cloudflare DNS records point to `omv-ha.tail8eb71.ts.net`
4. **Traffic flow**: Requests → omv-ha Funnel → omv Traefik → cloudless app

## Notes

- The omv-ha node uses its Tailscale Funnel as a **gateway** to omv's services
- This provides failover without duplicating the entire k3s stack
- When both nodes are down, the Fly.io proxy will show 502/504 responses
- The Tailscale Funnel config is stored in the tailscaled state, not in k8s manifests