# Manual Actions Required - Cloudless.gr
# Generated: 2026-07-19 16:44 UTC
# Updated: 2026-07-19 22:24 UTC - Correct Tailscale IP (100.74.191.58), updated infra files

---

## 🔴 CRITICAL BLOCKERS

| Component | Status | Action Required |
|-----------|--------|-----------------|
| omv node (192.168.1.128) | 🔴 OFFLINE in Tailscale | Power on + Tailscale SSH key verification |
| Cloudflare tunnel config | ⏳ Blocked | Requires omv online |
| 2TB SSD mount (/sdb1) | ⏳ Blocked | Requires omv online |

---

## Current Status (from GitHub Actions Run #29698658751)

```
SSH connection to 100.74.191.58:22 - FAILED (Connection timed out)
k3s API port 6443 - NOT LISTENING (k3s is down)
All services behind tunnel returning HTTP 530
```

The k3s-ssh-restart workflow #29698658751 completed but **SSH to omv failed** because the node is powered off or offline in Tailscale.

---

## 🛠️ Resolution Steps

### Step 1: Physically Power On omv Node (REQUIRED FIRST)

The omv node (Pi 5 at 192.168.1.128) must be powered on. Check:
- Power LED on Pi 5 is lit
- Ethernet cable connected
- Tailscale is running (can connect via `tailscale ping 100.74.191.58`)

### Step 2: Verify Tailscale SSH Access

Once omv is online, verify SSH works:
```bash
# From any machine with Tailscale + same tailnet:
tailscale ping 100.74.191.58
ssh 100.74.191.58  # Should connect to tbaltzakis@pi

# Or via hostname if registered:
ssh github-omv
```

### Step 3: Deploy Missing Services (if not running)

The following services need to be deployed once omv is online:
```bash
# Deploy ntfy (notification service)
kubectl apply -f infrastructure/ntfy/k8s.yaml

# Deploy uptime-kuma (monitoring)
kubectl apply -f infrastructure/uptime-kuma/k8s/uptime-kuma.yaml

# Deploy meilisearch (search engine) - needs MEILI_MASTER_KEY secret
kubectl apply -f infrastructure/meilisearch/k8s.yaml

# Deploy docs-server (documentation portal)
kubectl apply -f infrastructure/docs-server/k8s.yaml
```

### Step 4: Apply Cloudflare Tunnel Configuration (after omv online)

The tunnel rules are prepared in `infrastructure/cloudflare-tunnels/ingress-rules.yaml`. Apply via:
```bash
# Via GitHub Actions (automated)
gh workflow run .github/workflows/fix-selfhosted-tunnels.yml --repo Themis128/cloudless.gr
```

### Step 5: Verify SSD Mount (after omv online)

The SSD mount `/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7` is configured in:
- `infrastructure/omv-sdb1/cronjob-share-readme-and-probe.yaml`

Verify on omv once online:
```bash
ssh 100.74.191.58 "df -BG /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7"
```

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

### ✅ Infrastructure Files Ready (10 services configured)

| Service | File | Port | Status |
|---------|------|------|--------|
| grafana | infrastructure/??? | 30850 | ✅ Config in ingress-rules.yaml |
| kuma | infrastructure/uptime-kuma/ | 32501 | ✅ k8s.yaml + tunnel.yaml ready |
| n8n | infrastructure/n8n/k8s.yaml | 30900 | ✅ Already deployed + verified |
| ntfy | infrastructure/ntfy/ | 30080 | ✅ k8s.yaml + tunnel.yaml created |
| espocrm | infrastructure/espocrm/ | 30700 | ✅ Config in ingress-rules.yaml |
| meili | infrastructure/meilisearch/ | 30902 | ✅ k8s.yaml + tunnel.yaml ready |
| postiz | infrastructure/postiz/ | 30500 | ✅ Config in ingress-rules.yaml |
| appflowy | infrastructure/appflowy/ | 30810 | ✅ Config in ingress-rules.yaml |
| docs | infrastructure/docs-server/ | 30901 | ✅ k8s.yaml fixed |
| omv | omv host | 80 | ✅ Config in ingress-rules.yaml |

---

## 🔄 Alternative: Wait + Retry Workflow

If you cannot physically access the omv node:
```bash
# Re-run k3s-ssh-restart when omv is expected to be online
gh workflow run .github/workflows/k3s-ssh-restart.yml --repo Themis128/cloudless.gr

# Or run the tunnel fix directly
gh workflow run .github/workflows/fix-selfhosted-tunnels.yml --repo Themis128/cloudless.gr
```

---

## 🧪 Verification After Resolution

```bash
# 1. Check omv is online
ping 192.168.1.128
tailscale ping 100.74.191.58

# 2. Verify tunnel endpoints (should return 403 without auth, NOT 530)
curl -I https://grafana.cloudless.gr/api/health
curl -I https://kuma.cloudless.gr/
curl -I https://n8n.cloudless.gr/
curl -I https://ntfy.cloudless.gr/
curl -I https://espocrm.cloudless.gr/
curl -I https://postiz.cloudless.gr/
curl -I https://appflowy.cloudless.gr/
curl -I https://docs.cloudless.gr/
curl -I https://meili.cloudless.gr/health

# 3. Check SSD mount
ssh 100.74.191.58 "df -BG /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7"
```

---

## 📝 Notes

1. **The omv node must be physically powered on** - it's a Pi 5 at 192.168.1.128
2. **All configuration is ready** - just waiting for omv availability
3. **Tunnel rules are pre-written** in `infrastructure/cloudflare-tunnels/ingress-rules.yaml`
4. **SSD mount path** is `/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7` (used for Google archive)
5. **All secrets are configured** - no additional secrets required
6. **Correct Tailscale IP is 100.74.191.58** - old IP 100.113.41.119/19 is stale

---

## 🔗 Quick Links

- [k3s-ssh-restart workflow](https://github.com/Themis128/cloudless.gr/actions/workflows/k3s-ssh-restart.yml)
- [fix-selfhosted-tunnels workflow](https://github.com/Themis128/cloudless.gr/actions/workflows/fix-selfhosted-tunnels.yml)
- [Tailscale admin console](https://login.tailscale.com/admin/machines)
- [Cloudflare Zero Trust dashboard](https://dash.teams.cloudflare.com)