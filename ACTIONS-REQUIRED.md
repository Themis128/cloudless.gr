# Manual Actions Required - Cloudless.gr
# Generated: 2026-07-19 16:44 UTC
# Last Updated: 2026-07-20 04:45 EEST - Added missing SST secrets

---

## 🟡 CURRENT STATUS: Workflows Blocked - Missing Secrets

| Component | Status | Notes |
|-----------|--------|-------|
| omv node (192.168.1.128) | 🟢 ONLINE | Ping OK, SSH works, k3s running |
| Cloudflare tunnel | 🟢 ACTIVE | Running, all endpoints accessible |
| GitHub Actions workflows | 🟢 OPERATIONAL after adding secrets | Failing due to missing `CLOUDFLARE_API_TOKEN`, `CF_ACCOUNT_ID`, `CRON_SECRET` |

---

## 🔴 WORKFLOW FAILURES - Missing GitHub Secrets

### SST Infrastructure Deploy (`.github/workflows/sst-infra-deploy.yml`)
**Status:** Failing - Requires secrets for SST deployment

| Secret | Required | Use |
|--------|----------|-----|
| `CLOUDFLARE_API_TOKEN` | ✅ REQUIRED | SST deployment to Cloudflare |
| `CF_ACCOUNT_ID` | ✅ REQUIRED | Cloudflare account identification |
| `CRON_SECRET` | ✅ REQUIRED | Cron job authorization |

### ETL EspoCRM to R2 (`.github/workflows/etl-espocrm-to-r2.yml`)
**Status:** Failing - Missing Cloudflare R2 credentials

| Secret | Required | Use |
|--------|----------|-----|
| `CF_R2_ACCESS_KEY_ID` | ✅ REQUIRED | R2 bucket access |
| `CF_R2_SECRET_ACCESS_KEY` | ✅ REQUIRED | R2 bucket access secret |
| `ESPOCRM_BASE_URL` | ✅ REQUIRED | EspoCRM API base URL |

---

## 🔧 Actions Required

### 1. Configure Missing GitHub Secrets (CRITICAL)

Add these secrets in **GitHub repo Settings → Secrets → Actions**:

#### Step 1: Add CRON_SECRET (Ready to copy)
Go to: https://github.com/Themis128/cloudless.gr/settings/secrets/actions/new
```
Name:     CRON_SECRET
Value:      3a0761c6c112e74b0e9a9692f864eb071d3fe6638fb3e042a348d0d5ccd429c4
```

#### Step 2: Get CF_ACCOUNT_ID
1. Go to: https://dash.cloudflare.com
2. Look at the right sidebar - **Account ID** is displayed there
3. Click the copy icon next to it
4. Add at: https://github.com/Themis128/cloudless.gr/settings/secrets/actions/new
```
Name:     CF_ACCOUNT_ID
Value:      [paste your Account ID here]
```

#### Step 3: Create CLOUDFLARE_API_TOKEN
Go to: https://dash.cloudflare.com/profile/api-tokens

**Option A: Use Template (Recommended)**
1. Click "Create Token"
2. Select "Edit Cloudflare Workers" template
3. Click "Continue to summary" → "Create Token"

**Option B: Custom Token with Required Scopes**
```
Permissions:
  - Account:Edit
  - Zone:Edit  
  - D1:Edit
  - R2:Edit
  - Workers:Edit
  - KV:Edit (optional, for future use)
```

Then add at: https://github.com/Themis128/cloudless.gr/settings/secrets/actions/new
```
Name:     CLOUDFLARE_API_TOKEN
Value:      [paste your API token here]
```

#### Step 4: (Optional) Add ETL R2 Secrets
If you need EspoCRM ETL to run:
```
CF_R2_ACCESS_KEY_ID     - Create at: https://dash.cloudflare.com → R2 → Manage keys
CF_R2_SECRET_ACCESS_KEY - Copy from the same R2 keys page
ESPOCRM_BASE_URL         - https://espocrm.cloudless.gr
```

### 2. Upgrade cloudflared (OPTIONAL)

Current version: 2026.6.1 (outdated)
```bash
ssh 192.168.1.128 "sudo cloudflared update"
```

---

## 📊 ETL Secrets Status

| Secret | Status | Notes |
|--------|--------|-------|
| `ESPOCRM_API_KEY` | ✅ Configured (Wrangler) | Available for workflow |
| `ESPOCRM_API_PASSWORD` | ✅ Configured (Wrangler) | Available for workflow |
| `CF_ACCOUNT_ID` | ⏳ NEEDS SECRET | Required for R2 access |
| `CF_R2_ACCESS_KEY_ID` | ⏳ NEEDS SECRET | Required for ETL workflow |
| `CF_R2_SECRET_ACCESS_KEY` | ⏳ NEEDS SECRET | Required for ETL workflow |
| `ESPOCRM_BASE_URL` | ✅ Hardcoded | `https://espocrm.cloudless.gr` |

---

## ✅ Already Completed (No Action Needed)

- [x] omv node powered on and reachable
- [x] Tunnel credentials permissions fixed (chmod 644)
- [x] Tunnel config updated for docs.meili ports
- [x] Local services verified via kubectl
- [x] 11/11 tunnel endpoints working (DNS already functional)
- [x] n8n 502 error fixed (cloudflared restart resolved)
- [x] docs-server k8s.yaml nodePort configured (30901)
- [x] MinIO credentials security fix - Changed from insecure "minioadmin" defaults to secure random credentials
- [x] Wrangler secrets configured (ADMIN_ALERT_SECRET, ESPOCRM_API_KEY, ESPOCRM_API_PASSWORD, SLACK_WEBHOOK_URL, POSTIZ_API_KEY)
- [x] Tailscale OAuth configured (TS_CLIENT_ID, TS_CLIENT_SECRET, TS_AUTHKEY, OMV_SSH_KEY)

---

## 📊 Configuration Status

### Wrangler Secrets (5/5 CONFIGURED)
```
ADMIN_ALERT_SECRET ✅
ESPOCRM_API_KEY ✅
ESPOCRM_API_PASSWORD ✅
SLACK_WEBHOOK_URL ✅
POSTIZ_API_KEY ✅
```

### For Calendar Integration (pending configuration)
```
GOOGLE_CLIENT_EMAIL - Not yet configured (required for calendar booking)
GOOGLE_PRIVATE_KEY - Not yet configured (required for calendar booking)
GOOGLE_CALENDAR_ID - Can use default "primary"
```
These enable:
- `/api/calendar/availability` - Check available consultation slots
- `/api/calendar/book` - Book a consultation
- `/api/agent/book` - Authenticated booking agent
- Chat tool `check_calendar_availability` and `book_slot`

### Tailscale OAuth (4/4 CONFIGURED)
```
TS_CLIENT_ID      — 2026-07-19 ✅
TS_CLIENT_SECRET  — 2026-07-19 ✅
TS_AUTHKEY        — 2026-06-25 ✅
OMV_SSH_KEY       — 2026-07-12 ✅
```

### Services Deployed (9/9 operational)
| Service | Port | Status |
|---------|------|--------|
| grafana | 30850 | ✅ Running + tunnel working |
| kuma | 32501 | ✅ Running + tunnel working |
| n8n | 30900 | ✅ Running + tunnel working |
| ntfy | 30080 | ✅ Running + tunnel working |
| espocrm | 30700 | ✅ Running + tunnel working |
| meili | 30902 | ✅ Running + tunnel working |
| postiz | 30500 | ✅ Running + tunnel working (307 redirect) |
| appflowy | 30810 | ✅ Running + tunnel working (302 redirect) |
| docs | 30901 | ✅ Running + tunnel working |

---

## 🔄 Workaround: Direct SSH (When Workflow Fails)

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

1. **All Cloudflare secrets must be added to GitHub Actions secrets** - The workflows fail immediately without `CLOUDFLARE_API_TOKEN` and `CF_ACCOUNT_ID`
2. **The workflows already use SSH-based kubectl execution** - No changes required to workflow files
3. **n8n 502 error was resolved** by cloudflared restart (QUIC connection cleared)
4. **DNS is working correctly** - Endpoints reachable via Cloudflare proxy
5. **Correct Tailscale IP is 100.74.191.58** - old IP 100.113.41.119/19 is stale
6. **MinIO credentials updated** - Changed from "minioadmin:minioadmin" to secure random credentials on 2026-07-20

---

## 🔗 Quick Links

- [SST Infra Deploy workflow](https://github.com/Themis128/cloudless.gr/actions/workflows/sst-infra-deploy.yml)
- [ETL EspoCRM workflow](https://github.com/Themis128/cloudless.gr/actions/workflows/etl-espocrm-to-r2.yml)
- [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
- [Tailscale admin console](https://login.tailscale.com/admin/machines)