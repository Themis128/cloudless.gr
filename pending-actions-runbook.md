# Cloudless.gr Pending Actions Runbook

# Generated: 2026-07-19

# Updated: 2026-07-20 01:43 EEST - All endpoints verified working

---

## 🟢 CURRENT STATUS: All Services Operational

**Status:** omv node (Pi 5, 192.168.1.128) is **ONLINE**

- Tailscale IP: 100.74.191.58 (correct)
- SSH: ✅ Working (verified 2026-07-20)
- k3s: ✅ Running (pods verified)
- Cloudflare Tunnel: ✅ ACTIVE (all endpoints working)
- DNS: ✅ WORKING (all endpoints returning valid responses)

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

### Services Deployed (All 9 services operational)

```
✅ grafana (30850) - Monitoring dashboard
✅ kuma (32501) - Uptime Kuma monitoring  
✅ n8n (30900) - Workflow automation
✅ ntfy (30080) - Notification service
✅ espocrm (30700) - CRM system
✅ meili (30902) - Meilisearch search engine
✅ postiz (30500) - Social publishing engine
✅ appflowy (30810) - CMS
✅ docs (30901) - Documentation portal
```

---

## 📊 Service Port Summary

| Service | Namespace | NodePort | Tunnel Host | Status |
|---------|-----------|----------|-------------|--------|
| grafana | monitoring | 30850 | grafana.cloudless.gr | ✅ Running |
| kuma | uptime-kuma | 32501 | kuma.cloudless.gr | ✅ Running |
| n8n | n8n | 30900 | n8n.cloudless.gr | ✅ Running |
| ntfy | ntfy | 30080 | ntfy.cloudless.gr | ✅ Running |
| espocrm | espocrm | 30700 | espocrm.cloudless.gr | ✅ Running |
| meili | meilisearch | 30902 | meili.cloudless.gr | ✅ Running |
| postiz | postiz | 30500 | postiz.cloudless.gr | ✅ Running |
| appflowy | appflowy | 30810 | appflowy.cloudflow.gr | ✅ Running |
| docs | default | 30901 | docs.cloudless.gr | ✅ Running |

---

## 🔗 References

- [ACTIONS-REQUIRED.md](ACTIONS-REQUIRED.md) - Action items (all completed)
- [infrastructure/cloudflare-tunnels/ingress-rules.yaml](infrastructure/cloudflare-tunnels/ingress-rules.yaml)
- [infrastructure/cloudflare-tunnels/routes.yaml](infrastructure/cloudflare-tunnels/routes.yaml)
- [fix-selfhosted-tunnels.yml](.github/workflows/fix-selfhosted-tunnels.yml)

---

## ✅ Security Fixes Applied

### MinIO Credentials Updated (2026-07-20)

- **Before:** `minioadmin` / `minioadmin` (insecure defaults)
- **After:** Random hex credentials (`57b56c9b79e46f8fe467` / `1a8159f4574a94bd06e9dc3b33ba1dfe39a69e56`)
- **Pod restarted:** minio-d8f9f74cb-smkmd successfully rolled out with new credentials
- **Note:** Other secrets (POSTGRES_PASSWORD, GOTRUE_JWT_SECRET, etc.) preserved during update

## 📝 Notes

1. **omv node is ONLINE** - Pi 5 at 192.168.1.128 (verified 2026-07-20)
2. **All endpoints verified working** - All 11 endpoints returning 200 OK
3. **n8n 502 error resolved** - Fixed via cloudflared restart (QUIC connection cleared)
4. **docs-server nodePort fixed** - Added missing nodePort specification (30901)
5. **GitHub Actions workflow uses SSH** - No changes needed, already configured
6. **MinIO security fix applied** - Changed from insecure defaults to secure random credentials
