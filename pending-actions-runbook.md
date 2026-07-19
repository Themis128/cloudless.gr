# Cloudless.gr Pending Actions Runbook
# Generated: 2026-07-19
# Updated: 2026-07-19 22:24 UTC - Added ntfy manifest, updated ingress configuration

---

## 🔴 CRITICAL: omv Node Offline

**Status:** omv node (Pi 5, 192.168.1.128) is **OFFLINE in Tailscale**
- Tailscale IP: 100.74.191.58 (not 100.113.41.119 - old IP)
- Last workflow attempt: #29698658751 - SSH connection timed out
- Required actions are **blocked** until node is physically powered on

---

## ✅ Completed Configuration

### Wrangler Secrets (5/5 CONFIGURED)
```
ADMIN_ALERT_SECRET ✅
ESPOCRM_API_KEY ✅
ESPOCRM_API_PASSWORD ✅
SLACK_WEBHOOK_URL ✅
POSTIZ_API_KEY ✅
```

### Tailscale OAuth (4/4 CONFIGURED)
```
TS_CLIENT_ID      — 2026-07-19 ✅
TS_CLIENT_SECRET  — 2026-07-19 ✅
TS_AUTHKEY        — 2026-06-25 ✅
OMV_SSH_KEY       — 2026-07-12 ✅
```

### D1 Configuration
```
✅ email_suppression table ready
✅ app_config with ESPOCRM_BASE_URL ready
✅ user/auth session tables exist
```

### Infra Files (READY)
```
infrastructure/cloudflare-tunnels/ingress-rules.yaml   ✅ Updated with all services
infrastructure/cloudflare-tunnels/routes.yaml           ✅ Updated with correct ports
infrastructure/ntfy/k8s.yaml                          ✅ Created
infrastructure/ntfy/cloudflare-tunnel.yaml             ✅ Created
infrastructure/docs-server/k8s.yaml                   ✅ Fixed port mismatch
infrastructure/uptime-kuma/                           ✅ Exists (k8s.yaml, cloudflare-tunnel.yaml)
infrastructure/meilisearch/                           ✅ Exists (k8s.yaml, cloudflare-tunnel.yaml)
```

---

## ⚠️ Blocked Actions (Require omv Online)

| Action | File | Status |
|--------|------|--------|
| Deploy ntfy namespace + service | `infrastructure/ntfy/k8s.yaml` | ⏳ Blocked (omv offline) |
| Deploy uptime-kuma | `infrastructure/uptime-kuma/k8s/uptime-kuma.yaml` | ⏳ Blocked (omv offline) |
| Deploy meilisearch | `infrastructure/meilisearch/k8s.yaml` | ⏳ Blocked (omv offline) |
| Deploy docs-server | `infrastructure/docs-server/k8s.yaml` | ⏳ Blocked (omv offline) |
| Apply Cloudflare tunnel config | `infrastructure/cloudflare-tunnels/ingress-rules.yaml` | ⏳ Blocked (omv offline) |
| SSD mount verification | `/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7` | ⏳ Blocked (omv offline) |

---

## 📋 Resolution Checklist

### When omv is powered on:

1. **Verify Tailscale connectivity**
   ```bash
   tailscale ping 100.74.191.58
   ping 192.168.1.128
   ```

2. **Deploy missing services (if not already running)**
   ```bash
   # Deploy ntfy
   kubectl apply -f infrastructure/ntfy/k8s.yaml

   # Deploy uptime-kuma
   kubectl apply -f infrastructure/uptime-kuma/k8s/uptime-kuma.yaml

   # Deploy meilisearch (needs MEILI_MASTER_KEY secret)
   kubectl apply -f infrastructure/meilisearch/k8s.yaml

   # Deploy docs-server
   kubectl apply -f infrastructure/docs-server/k8s.yaml
   ```

3. **Apply Cloudflare tunnel config**
   ```bash
   gh workflow run .github/workflows/fix-selfhosted-tunnels.yml --repo Themis128/cloudless.gr
   ```

4. **Verify SSD mount**
   ```bash
   ssh 100.74.191.58 "df -BG /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7"
   ```

5. **Verify services**
   ```bash
   curl -I https://grafana.cloudless.gr/api/health   # Should return 200/403
   curl -I https://kuma.cloudless.gr/                 # Should return 200
   curl -I https://n8n.cloudless.gr/                  # Should return 200
   curl -I https://ntfy.cloudless.gr/                 # Should return 200
   curl -I https://espocrm.cloudless.gr/              # Should return 200
   curl -I https://docs.cloudless.gr/                   # Should return 302
   curl -I https://meili.cloudless.gr/health           # Should return {"status":"available"}
   curl -I https://postiz.cloudless.gr/                 # Should return 200
   curl -I https://appflowy.cloudless.gr/                # Should return 302
   ```

---

## 📊 Service Port Summary

| Service | Namespace | NodePort | Tunnel Host |
|---------|-----------|----------|-------------|
| grafana | default? | 30850 | grafana.cloudless.gr |
| kuma | uptime-kuma | 32501 | kuma.cloudless.gr |
| n8n | n8n | 30900 | n8n.cloudless.gr |
| ntfy | ntfy | 30080 | ntfy.cloudless.gr |
| espocrm | espocrm | 30700 | espocrm.cloudless.gr |
| meili | meilisearch | 30902 | meili.cloudless.gr |
| postiz | postiz | 30500 | postiz.cloudless.gr |
| appflowy | appflowy | 30810 | appflowy.cloudless.gr |
| docs | default | 30901 | docs.cloudless.gr |

---

## 🔗 References

- [ACTIONS-REQUIRED.md](ACTIONS-REQUIRED.md) - Full resolution steps with commands
- [infrastructure/cloudflare-tunnels/ingress-rules.yaml](infrastructure/cloudflare-tunnels/ingress-rules.yaml)
- [infrastructure/cloudflare-tunnels/routes.yaml](infrastructure/cloudflare-tunnels/routes.yaml)
- [fix-selfhosted-tunnels.yml](.github/workflows/fix-selfhosted-tunnels.yml)