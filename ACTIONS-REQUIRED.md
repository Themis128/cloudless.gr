# Manual Actions Required - Cloudless.gr
# Generated: 2026-07-19 16:44 UTC
# Last Updated: 2026-07-20 01:43 EEST - All endpoints verified working

---

## 🟢 CURRENT STATUS: All Services Operational

| Component | Status | Notes |
|-----------|--------|-------|
| omv node (192.168.1.128) | 🟢 ONLINE | Ping OK, SSH works, k3s running |
| Cloudflare tunnel | 🟢 ACTIVE | Running, all endpoints accessible |
| DNS records | 🟢 WORKING | All endpoints returning valid HTTP responses |
| n8n service | 🟢 HEALTHY | Returning 200 (previously 502, fixed) |
| GitHub Actions workflow | ⚠️ UNREACHABLE | kubectl can't reach k3s via Tailscale (SSH-based alternative works) |

---

## ✅ Current Status (as of 2026-07-20 01:43 EEST - VERIFIED)

### ✅ All Endpoints Working (11/11)

All tunnel endpoints verified returning 200 OK:
- [200] https://cloudless.gr/api/health
- [200] https://grafana.cloudless.gr/api/health
- [200] https://kuma.cloudless.gr/
- [200] https://n8n.cloudless.gr/ (previously 502, now fixed)
- [200] https://ntfy.cloudless.gr/
- [200] https://espocrm.cloudless.gr/
- [307] https://postiz.cloudless.gr/ (redirect - expected)
- [302] https://appflowy.cloudless.gr/ (redirect - expected)
- [200] https://docs.cloudless.gr/
- [200] https://meili.cloudless.gr/health
- [200] https://omv.cloudless.gr/

---

## 🔧 Actions Required

### 1. GitHub Actions Workflow Fix (HIGH - but has workaround)

The k3s API is unreachable from GitHub Actions hosted runners via Tailscale IP `100.74.191.58:6443`.

**Workaround - Use Direct SSH:**
```bash
# Fix tunnel config directly on omv
ssh 192.168.1.128 "sudo systemctl restart cloudflared"

# Or run the workflow and apply fixes manually if needed
gh workflow run .github/workflows/fix-selfhosted-tunnels.yml --repo Themis128/cloudless.gr
```

**Alternative - Workflow Already Uses SSH:**
The workflow `.github/workflows/fix-selfhosted-tunnels.yml` already uses SSH-based kubectl execution:
- Connects via SSH using OMV_SSH_KEY secret
- Runs kubectl commands on omv node over SSH
- No changes needed to workflow

### 2. Upgrade cloudflared (OPTIONAL)

Current version: 2026.6.1 (outdated)
```bash
ssh 192.168.1.128 "sudo cloudflared update"
```

---

## ✅ Already Completed (No Action Needed)

- [x] omv node powered on and reachable
- [x] Tunnel credentials permissions fixed (chmod 644)
- [x] Tunnel config updated for docs.meili ports
- [x] Local services verified via kubectl
- [x] 11/11 tunnel endpoints working (DNS already functional)
- [x] n8n 502 error fixed (cloudflared restart resolved)
- [x] docs-server k8s.yaml nodePort configured (30901)

---

## 📊 Configuration Status

### ✅ Wrangler Secrets (ALL 5 CONFIGURED)
```
ADMIN_ALERT_SECRET ✅
ESPOCRM_API_KEY ✅
ESPOCRM_API_PASSWORD ✅
SLACK_WEBHOOK_URL ✅
POSTIZ_API_KEY ✅
```

### ✅ Tailscale OAuth (ALL 4 CONFIGURED)
```
TS_CLIENT_ID      — 2026-07-19 ✅
TS_CLIENT_SECRET  — 2026-07-19 ✅
TS_AUTHKEY        — 2026-06-25 ✅
OMV_SSH_KEY       — 2026-07-12 ✅
```

### ✅ Services Deployed and Working

| Service | File | Port | Status |
|---------|------|------|--------|
| grafana | infrastructure/monitoring/ | 30850 | ✅ Running + tunnel working |
| kuma | infrastructure/uptime-kuma/ | 32501 | ✅ Running + tunnel working |
| n8n | infrastructure/n8n/k8s.yaml | 30900 | ✅ Running + tunnel working |
| ntfy | infrastructure/ntfy/ | 30080 | ✅ Running + tunnel working |
| espocrm | infrastructure/espocrm/ | 30700 | ✅ Running + tunnel working |
| meili | infrastructure/meilisearch/ | 30902 | ✅ Running + tunnel working |
| postiz | infrastructure/postiz/ | 30500 | ✅ Running + tunnel working (307 redirect) |
| appflowy | infrastructure/appflowy/ | 30810 | ✅ Running + tunnel working (302 redirect) |
| docs | infrastructure/docs-server/ | 30901 | ✅ Running + tunnel working |

---

## 🔄 Workaround: Direct SSH (When Workflow Fails)

The GitHub Actions workflow cannot reach k3s API via Tailscale. Use direct SSH instead:
```bash
# Fix tunnel config directly on omv
ssh 192.168.1.128 "sudo systemctl restart cloudflared"

# Verify all endpoints
for url in \
  "https://cloudless.gr/api/health" \
  "https://grafana.cloudless.gr/api/health" \
  "https://kuma.cloudless.gr/" \
  "https://n8n.cloudless.gr/" \
  "https://ntfy.cloudless.gr/" \
  "https://espocrm.cloudless.gr/" \
  "https://postiz.cloudless.gr/" \
  "https://appflowy.cloudless.gr/" \
  "https://docs.cloudless.gr/" \
  "https://meili.cloudless.gr/health" \
  "https://omv.cloudless.gr/"; do
  CODE=$(curl -4 -sSL -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo "ERR")
  echo "[$CODE] $url"
done
```

---

## 📝 Notes

1. **All services are deployed and operational** - No pending deployments needed
2. **The workflows already use SSH-based kubectl execution** - No changes required
3. **n8n 502 error was resolved** by cloudflared restart (QUIC connection cleared)
4. **DNS is working correctly** - Endpoints reachable via Cloudflare proxy
5. **Correct Tailscale IP is 100.74.191.58** - old IP 100.113.41.119/19 is stale

---

## 🔗 Quick Links

- [k3s-ssh-restart workflow](https://github.com/Themis128/cloudless.gr/actions/workflows/k3s-ssh-restart.yml)
- [fix-selfhosted-tunnels workflow](https://github.com/Themis128/cloudless.gr/actions/workflows/fix-selfhosted-tunnels.yml)
- [Tailscale admin console](https://login.tailscale.com/admin/machines)
- [Cloudflare Zero Trust dashboard](https://dash.teams.cloudflare.com)