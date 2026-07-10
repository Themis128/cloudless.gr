# Tailscale & Infrastructure Deployment Playbook - July 2026

# ================================================

## ✅ INFRASTRUCTURE STATUS VERIFIED (2026-07-06)

### Network Fabric

- **Tailscale** - Works as fabric interconnect for all k3s services
  - Allows secure access between nodes and services across the cluster
  - MagicDNS provides `*.ts.cloudless.gr` endpoints
  - Currently unused - all k3s services consolidated on omv-main

### OMV Services (192.168.1.128)

- **FTP Service** - Running on port 21/TCP (LAN)
- **TFTP Service** - Running on port 69/UDP with Tailscale access
- **Meilisearch** - Running in `meilisearch` namespace on **omv-main** (120GB SSD), ✅ health check OK
- **Loki/Grafana** - Running in `monitoring` namespace, ✅ accessible via tunnel

### Services via Cloudflare Tunnel (e977a490-...cfargotunnel.com)

| Service | Status | Port/Age | Notes |
|---------|--------|---------|-------|
| appflowy.cloudless.gr | ✅ Working | HTTP/2 302 | Running on omv (NodePort 30502) |
| espocrm.cloudless.gr | ✅ Working | HTTP/2 200 | Running on omv (NodePort 30501) |
| postiz.cloudless.gr | ✅ Working | HTTP/2 307 | Running on omv (NodePort 30601) |
| grafana.cloudless.gr | ✅ Working | HTTP/2 302 | Running on omv (NodePort 30850) |
| docs.cloudless.gr | ✅ Active | HTTP/2 301 | Running on omv (NodePort 30901) |
| omv.cloudless.gr | ✅ Active | HTTP/2 200 | Running on omv (port 80) |
| ftp.cloudless.gr | ✅ Active | HTTP/2 200 | Running on omv (port 80) |
| meili.cloudless.gr | ✅ Active | HTTP/2 200 | Running on omv (NodePort 30902) |

### Tailscale Services (100.64.0.0/10)

- **Tailscale Operator** - Running in `tailscale-system` namespace
- **Proxies**: FTP, TFTP services accessible via Tailscale
- **Endpoints**: Accessible via MagicDNS (`*.ts.cloudless.gr`)
- Currently all k3s services run on omv-main; Tailscale on standby for overflow

### Next.js Application

- **Search API** (`/api/search`) - Meilisearch integration complete
- **Store** - Stripe checkout, product catalog working
- **Auth** - AWS Cognito + next-auth v5 working
- **Dashboard** - User portal complete
- **Admin** - Admin panel complete with CRM, analytics, orders, users

---

## 📦 DEPLOYMENT MANIFESTS CREATED

### Infrastructure Directory Structure

```
infrastructure/
├── tailscale/
│   ├── README.md
│   ├── namespace.yaml
│   ├── subnet-router.yaml
│   ├── proxygroup-monitoring.yaml
│   ├── ingress-class.yaml
│   ├── ingresses.yaml
│   └── deploy.sh
├── database/
│   ├── postgresql-ha.yaml
│   └── redis-ha.yaml
├── meilisearch/
│   ├── k8s.yaml (Running on omv-main, no nodeSelector)
│   └── cloudflare-tunnel.yaml (Points to 127.0.0.1:30902)
├── appflowy/
│   └── appflowy-complete.yaml (new)
└── DEPLOYMENT_PLAYBOOK.md
```

---

## 📊 CLUSTER STATUS SUMMARY

### Nodes

```
NAME      STATUS   ROLES                AGE   VERSION
omv       Ready    control-plane,etcd     62d   v1.35.4+k3s1
omv-ha    Ready    <none>                 43d   v1.35.5+k3s1  (standby)
```

### Key Namespaces Running

- `monitoring` - Loki, Grafana, Prometheus (on omv-main)
- `appflowy` - AppFlowy web, cloud, worker, postgres, redis (on omv-main)
- `espocrm` - EspoCRM and MariaDB (on omv-main)
- `postiz` - Postiz social media (on omv-main)
- `n8n` - n8n workflows (on omv-main)
- `meilisearch` - Meilisearch search engine (on omv-main, 120GB SSD)
- `tailscale-system` - Tailscale operator
- All k3s workloads consolidated on omv-main's 120GB SSD

---

## 📅 VERIFICATION DATE

**Verified:** July 6, 2026, 20:15 UTC
