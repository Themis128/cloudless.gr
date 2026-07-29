# Tailscale → Cloudflare Access/Tunnel Migration Playbook

# Generated: 2026-07-19

# Last Updated: 2026-07-20 01:43 EEST - All services verified operational

## Migration Status: COMPLETE ✅

All critical services are now operational with Cloudflare Tunnel access.

---

## Current State Analysis

### Tailscale Inventory (23 machines)

- **Control Plane**: `github-omv` (omv-primary, 192.168.1.128)
- **Standby**: `omv-ha` (192.168.1.130, NoSchedule taint)
- **Services**: k3s, monitoring, appflowy, postiz, n8n, postgres, redis
- **Last Seen**: `github-omv` online and reachable (verified 2026-07-20)

### Cloudflare Tunnel Status

- **Tunnel ID**: e977a490-58c5-4fdb-9155-86832e3e636a
- **Tunnel Name**: cloudless
- **Status**: ✅ **ACTIVE** and serving all endpoints
- **Connector**: b1a3929a-bee3-4053-9f9c-e245ce1d0380 (linux_arm64, version 2026.7.2)
- **Edge**: 2xsof01, 1xvie07
- **Origin IP**: 150.228.61.46 (Cloudflare proxy)

---

## ✅ Completed Fixes (2026-07-20)

### 1. Tunnel Credentials File Permissions ✅

**Issue**: `/etc/cloudflared/e977a490-58c5-4fdb-9155-86832e3e636a.json` had permissions `-r--------` (400)  
**Impact**: cloudflared daemon couldn't read tunnel credentials, causing automatic restart loop  
**Fix**:

```bash
sudo chmod 644 /etc/cloudflared/e977a490-58c5-4fdb-9155-86832e3e636a.json
sudo systemctl restart cloudflared
```

**Result**: ✅ Tunnel active and connected

### 2. Tunnel Configuration - Port Fixes ✅

**Issue**: `docs.cloudless.gr` and `meili.cloudless.gr` tunnel rules pointed to `localhost:30901` and `localhost:30902`  
**Impact**: These are k3s NodePort services - fixed to use proper IP  
**Fix**: Updated to `http://192.168.1.128:30901` and `http://192.168.1.128:30902`  
**Result**: ✅ All endpoints now accessible

### 3. n8n 502 Error Resolution ✅

**Issue**: n8n returning 502 Bad Gateway  
**Impact**: QUIC connection errors blocking tunnel  
**Fix**: Full cloudflared restart cleared connection cache  
**Result**: ✅ n8n now returning 200 OK

### 4. docs-server NodePort Fix ✅

**Issue**: `infrastructure/docs-server/k8s.yaml` missing nodePort specification  
**Impact**: Service couldn't be accessed via tunnel  
**Fix**: Added `nodePort: 30901` to Service definition  
**Result**: ✅ docs.cloudless.gr now accessible

---

## ✅ Endpoint Status (Verified 2026-07-20 01:43 EEST)

All 11 endpoints verified returning 200 OK (or expected redirect):

| Endpoint | Status | Notes |
|----------|--------|-------|
| cloudless.gr/api/health | 200 ✅ | Main Cloudflare Workers |
| grafana.cloudless.gr/api/health | 200 ✅ | Monitoring dashboard |
| kuma.cloudless.gr/ | 200 ✅ | Uptime Kuma |
| n8n.cloudless.gr/ | 200 ✅ | Workflow automation (was 502) |
| ntfy.cloudless.gr/ | 200 ✅ | Notifications |
| espocrm.cloudless.gr/ | 200 ✅ | CRM system |
| postiz.cloudless.gr/ | 307 ✅ | Social publishing (redirect) |
| appflowy.cloudless.gr/ | 302 ✅ | CMS (redirect) |
| docs.cloudless.gr/ | 200 ✅ | Documentation portal |
| meili.cloudless.gr/health | 200 ✅ | Meilisearch search engine |
| omv.cloudless.gr/ | 200 ✅ | OMV Web UI |

---

## 🔧 Remaining Actions (LOW PRIORITY)

### 1. GitHub Actions Workflow Enhancement (OPTIONAL)

The workflow `.github/workflows/fix-selfhosted-tunnels.yml` uses SSH-based kubectl execution which works correctly. For enhanced reliability, consider deploying a self-hosted runner on omv.

### 2. Upgrade cloudflared (OPTIONAL)

Current version: 2026.6.1 (outdated)

```bash
ssh 192.168.1.128 "sudo cloudflared update"
```

### 3. Configure Cloudflare Access (OPTIONAL)

Set up zero-trust authentication for admin services (Grafana, n8n, AppFlowy) using `infrastructure/cloudflare-access/access-apps.tf`.

---

## 🔗 References

- [ACTIONS-REQUIRED.md](./ACTIONS-REQUIRED.md) - Action status (all completed)
- [pending-actions-runbook.md](./pending-actions-runbook.md) - Current runbook
- [infrastructure/cloudflare-tunnels/ingress-rules.yaml](./infrastructure/cloudflare-tunnels/ingress-rules.yaml)
- [infrastructure/cloudflare-tunnels/routes.yaml](./infrastructure/cloudflare-tunnels/routes.yaml)
- [.github/workflows/fix-selfhosted-tunnels.yml](../.github/workflows/fix-selfhosted-tunnels.yml)
