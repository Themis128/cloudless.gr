# Cloudflare Architecture

## Overview

This document describes the Cloudflare infrastructure for cloudless.gr, including DNS, Tunnel, and Load Balancer configurations.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Internet Users                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Cloudflare Edge (CDN)                                  │
│  - DNS: cloudless.gr → CloudFront (cloud) or Tunnel (pi-standby)              │
│  - WAF, DDoS Protection, SSL/TLS                                            │
│  - Workers AI (if configured)                                               │
└─────────────────────────────────────────────────────────────────────────────┘
           │                                           │
           │ (primary)                                 │ (failover)
           ▼                                           ▼
┌───────────────────────┐              ┌─────────────────────────────────────┐
│   CloudFront CDN      │              │   Cloudflare Tunnel (omv-main)        │
│                       │              │   Tunnel ID: e977a490-58c5-4fdb-9155-86832e3e636a │
│ - Lambda@Edge         │              │                                       │
│ - S3 Origin           │              │ - Traefik Load Balancer               │
│ - Cache Policies      │              │ - k3s Cluster                         │
└───────────────────────┘              └─────────────────────────────────────┘
           │                                           │
           │                                           ▼
           │                              ┌─────────────────────────┐
           │                              │   Traefik (kube-system) │
           │                              │   - LetsEncrypt DNS     │
           │                              │   - IngressRoutes       │
           │                              └─────────────────────────┘
           │                                           │
           │                                           ▼
           │                              ┌─────────────────────────┐
           │                              │   k3s Cluster (omv)     │
           │                              │   - cloudless-app         │
           │                              │   - n8n, postiz, etc.     │
           │                              └─────────────────────────┘
           │
           ▼
┌───────────────────────┐
│   AWS Lambda          │
│   (cloudless-app)     │
│   - Provisioned       │
│     Concurrency       │
└───────────────────────┘
```

## DNS Configuration

### Primary Domain

- **cloudless.gr** - Main application
  - CNAME → CloudFront distribution (primary)
  - A → Tunnel endpoint (failover via Cloudflare Load Balancer)

### Subdomains

| Hostname | Service | Type | Target |
|----------|---------|------|--------|
| manage.cloudless.gr | Traefik LB | A | Tunnel |
| omv.cloudless.gr | OMV Web UI | A | Tunnel |
| ftp.cloudless.gr | FTP Server | A | Tunnel |
| docs.cloudless.gr | Documentation | A | Tunnel |
| meili.cloudless.gr | Meilisearch | A | Tunnel |
| grafana.cloudless.gr | Grafana | A | Tunnel |
| n8n.cloudless.gr | n8n | A | Tunnel |
| pi-origin.cloudless.gr | Pi Origin | A | Tunnel |

## Cloudflare Tunnel

### Tunnel Details

- **ID:** `e977a490-58c5-4fdb-9155-86832e3e636a`
- **Name:** `omv-main-tunnel`
- **Account:** `fb7dc7b69b662480cd5961a4d1913c78`
- **Node:** omv-main (192.168.1.128)

### Configuration Files

- `infrastructure/cloudflare-tunnels/routes.yaml` - Single source of truth for all routes
- `infrastructure/cloudflare-tunnels/ingress-rules.yaml` - Ingress rules for cloudflared
- `/etc/cloudflared/config.yml` on omv-main - Live tunnel configuration

### Route Registry

All tunnel routes are defined in `infrastructure/cloudflare-tunnels/routes.yaml`:

```yaml
routes:
  - hostname: cloudless.gr
    service: traefik-lb
    port: 80
    healthPath: /api/health
    node: omv
    status: active

  - hostname: manage.cloudless.gr
    service: traefik-lb
    port: 80
    healthPath: /api/health
    node: omv
    status: active

  - hostname: omv.cloudless.gr
    service: omv-webui
    port: 80
    healthPath: /
    node: omv
    status: active

  - hostname: grafana.cloudless.gr
    service: grafana
    port: 30850
    healthPath: /api/health
    node: omv
    status: active

  - hostname: n8n.cloudless.gr
    service: n8n
    port: 80
    healthPath: /rest/health
    node: omv
    status: active
```

## Load Balancer (HA Failover)

### Configuration

- **Pool:** `cloudless-gr-pool`
- **Origin 1:** CloudFront (primary) - `d1234567890.cloudfront.net`
- **Origin 2:** Pi Tunnel (standby) - `e977a490-58c5-4fdb-9155-86832e3e636a.cfargotunnel.com`

### Health Checks

- **Endpoint:** `/api/health`
- **Interval:** 30s
- **Timeout:** 10s
- **Expected:** HTTP 200

### Failover Logic

1. CloudFront is primary (proxied, cached)
2. If CloudFront fails health check, traffic routes to Pi Tunnel
3. Pi Tunnel serves directly from k3s cluster

## Traefik Ingress

### Entry Points

- `web` (port 80) - HTTP redirect to HTTPS
- `websecure` (port 443) - HTTPS with Let's Encrypt

### CertResolver

- `letsencrypt-cloudflare` - DNS-01 challenge via Cloudflare API

### Middleware

- `secure-headers` - Security headers (X-Frame-Options, CSP, etc.)

### IngressRoutes

| Name | Host | Service | Port |
|------|------|---------|------|
| cloudless-manager | manage.cloudless.gr | cloudless-app | 80 |
| grafana | grafana.cloudless.gr | kube-prom-grafana | 80 |

## Network Policies

### cloudless-app-network-policy

- **Ingress:** Allow from all namespaces (fixed to allow Traefik)
- **Egress:** Allow DNS, HTTP, HTTPS

## Troubleshooting

### Check Tunnel Status

```bash
# On omv-main
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f
```

### Check Traefik Status

```bash
# Via kubectl
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik
```

### Check IngressRoute

```bash
kubectl get ingressroute -n cloudless
kubectl describe ingressroute cloudless-manager -n cloudless
```

### Common Issues

#### 502 Bad Gateway

- **Cause:** Traefik cannot connect to backend service
- **Fix:** Check NetworkPolicy allows traffic from kube-system

#### Certificate Issues

- **Cause:** Wrong certResolver name
- **Fix:** Use `letsencrypt-cloudflare` (not `letsencrypt`)

#### Missing Middleware

- **Cause:** Referenced middleware doesn't exist
- **Fix:** Remove middleware reference or create the middleware

## Related Files

- `k8s/ingressroute-manage.yaml` - IngressRoute for manage.cloudless.gr
- `k8s/cloudless-app-optimized.yaml` - NetworkPolicy and app configuration
- `infrastructure/cloudflare-tunnels/routes.yaml` - Route registry
- `infrastructure/cloudflare-tunnels/ingress-rules.yaml` - Tunnel ingress rules
- `.github/workflows/apply-k8s-manifests.yml` - Apply k8s changes
- `.github/workflows/k3s-restart.yml` - Restart k3s cluster
