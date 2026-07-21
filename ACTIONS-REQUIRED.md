# Manual Actions Required - Cloudless.gr
# Generated: 2026-07-19 16:44 UTC
# Last Updated: 2026-07-20 04:45 EEST - Added missing SST secrets

---

## ✅ CURRENT STATUS: All Systems Operational

| Component | Status | Notes |
|-----------|--------|-------|
| omv node (192.168.1.128) | 🟢 ONLINE | Ping OK, SSH works, k3s running |
| Cloudflare tunnel | 🟢 ACTIVE | Running, all endpoints accessible |
| GitHub Actions workflows | 🟢 WORKAROUND IN PLACE | Uses SSH-based kubectl (see .github/workflows/fix-selfhosted-tunnels.yml) |
| KV Namespaces | 🟢 CREATED | TAG_CACHE + REVALIDATION_QUEUE IDs in wrangler.jsonc |
| Chat endpoint | 🟢 WORKING | Uses Cloudflare Workers AI (free) - @cf/meta/llama-3.1-8b-instruct |

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

**Status:** CRON_SECRET already configured (2026-07-20) ✅

#### Step 1: Get CF_ACCOUNT_ID
1. Go to: https://dash.cloudflare.com
2. Look at the right sidebar - **Account ID** is displayed there
3. Click the copy icon next to it
4. Add at: https://github.com/Themis128/cloudless.gr/settings/secrets/actions/new
```
Name:     CF_ACCOUNT_ID
Value:      [paste your Account ID here]
```

#### Step 2: Create CLOUDFLARE_API_TOKEN
Go to: https://dash.cloudflare.com/profile/api-tokens

**Option A: Use Template (Recommended)**
1. Click "Create Token"
2. Select "Edit Cloudflare Workers" template
3. Click "Continue to summary" → "Create Token"

Then add at: https://github.com/Themis128/cloudless.gr/settings/secrets/actions/new
```
Name:     CLOUDFLARE_API_TOKEN
Value:      [paste your API token here]
```


### 2. Set Wrangler Secrets for Workers Runtime (CRITICAL for Chat)

The following secrets are in GitHub secrets but need to be set in Wrangler for Workers runtime:

```bash
# CRITICAL - Enables /api/chat endpoint
npx wrangler secret put GEMINI_API_KEY --config wrangler.jsonc
# Enter your Google AI Studio API key (format: AIzaSy...)

# Required for session signing
npx wrangler secret put SESSION_SECRET --config wrangler.jsonc
# Enter a secure random string (openssl rand -base64 32)

# Required for agent authentication
npx wrangler secret put AGENT_AUTH_TOKEN --config wrangler.jsonc
# Enter a secure token for agent authorization
```

### 3. Upgrade cloudflared (OPTIONAL)

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

### Wrangler Secrets Status
```
ADMIN_ALERT_SECRET ✅ (configured)
ESPOCRM_API_KEY ✅ (configured)
ESPOCRM_API_PASSWORD ✅ (configured)
SLACK_WEBHOOK_URL ✅ (configured)
POSTIZ_API_KEY ✅ (configured)
CRON_SECRET ✅ (configured)
GEMINI_API_KEY ⏳ (optional - Workers AI is free primary)
SESSION_SECRET ⏳ (in GitHub secrets, needs Wrangler)
AGENT_AUTH_TOKEN ⏳ (in GitHub secrets, needs Wrangler)
```

### For Calendar Integration (partially configured)
```
GOOGLE_CLIENT_EMAIL - ✅ Configured in GitHub secrets
GOOGLE_PRIVATE_KEY - ✅ Configured in GitHub secrets (needs Wrangler)
GOOGLE_CALENDAR_ID - Can use default "primary"
```
These enable:
- `/api/calendar/availability` - Check available consultation slots (currently working!)
- `/api/calendar/book` - Book a consultation (currently working!)
- `/api/agent/book` - Authenticated booking agent

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