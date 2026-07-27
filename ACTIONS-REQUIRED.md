# Manual Actions Required - Cloudless.gr
# Generated: 2026-07-19 16:44 UTC
# Last Updated: 2026-07-27 23:25 EEST - Comprehensive secret audit complete

---

## 🔴 CRITICAL: Missing GitHub Secrets Blocking Deployments

### Workflows Currently Failing

| Workflow | Status | Reason |
|----------|--------|--------|
| `sst-infra-deploy.yml` | ❌ FAILING | Missing `CLOUDFLARE_API_TOKEN`, `CF_ACCOUNT_ID` |
| `cloudflare-deploy.yml` | ❌ FAILING | Missing `CLOUDFLARE_API_TOKEN`, `CF_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID` |
| `etl-espocrm-to-r2.yml` | ❌ FAILING | Missing `CF_ACCOUNT_ID`, `CF_R2_ACCESS_KEY_ID`, `CF_R2_SECRET_ACCESS_KEY` |

---

## ✅ IMMEDIATE ACTIONS REQUIRED

### Step 1: Get Cloudflare Account ID (REQUIRED)

**Time: 2 minutes**

1. Go to: https://dash.cloudflare.com
2. Look at the **right sidebar** — Account ID is displayed there
3. Click the copy icon next to it
4. Add as GitHub secret:

```
Name:  CF_ACCOUNT_ID
Value: [paste your Account ID here]
```

**Add at:** https://github.com/Themis128/cloudless.gr/settings/secrets/actions/new

---

### Step 2: Create Cloudflare API Token (REQUIRED for Deploy)

**Time: 3 minutes**

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Select **"Edit Cloudflare Workers"** template
4. Click **"Continue to summary"** → **"Create Token"**
5. Copy the token (shown only once!)

6. Add as GitHub secret:

```
Name:  CLOUDFLARE_API_TOKEN
Value: [paste your API token here]
```

**Add at:** https://github.com/Themis128/cloudless.gr/settings/secrets/actions/new

---

### Step 3: Get Cloudflare Zone ID (REQUIRED for Custom Domains)

**Time: 1 minute**

1. Go to: https://dash.cloudflare.com
2. Select your domain (cloudless.gr)
3. Look at the **right sidebar** — Zone ID is displayed there
4. Copy the Zone ID

5. Add as GitHub secret:

```
Name:  CLOUDFLARE_ZONE_ID
Value: [paste your Zone ID here]
```

**Add at:** https://github.com/Themis128/cloudless.gr/settings/secrets/actions/new

---

### Step 4: Create R2 API Credentials (REQUIRED for ETL)

**Time: 3 minutes**

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Select **"Edit Cloudflare Workers"** template (or create custom)
4. Add R2 permissions if not included
5. Click **"Continue to summary"** → **"Create Token"**
6. Copy the token

7. Add as TWO GitHub secrets:

```
Name:  CF_R2_ACCESS_KEY_ID
Value: [your R2 access key ID]

Name:  CF_R2_SECRET_ACCESS_KEY
Value: [your R2 secret access key]
```

**Add at:** https://github.com/Themis128/cloudless.gr/settings/secrets/actions/new

**Note:** You can use the same token from Step 2 if it has R2 permissions, or create a separate R2-specific token.

---

### Step 5: Set Wrangler Secrets for Workers Runtime (REQUIRED for Chat/Auth)

**Time: 5 minutes**

After the GitHub secrets are set, run these commands locally (or in a workflow) to sync them to Wrangler:

```bash
# Required for session signing
echo "your-SESSION_SECRET-value" | npx wrangler secret put SESSION_SECRET --config wrangler.jsonc

# Required for agent authentication
echo "your-AGENT_AUTH_TOKEN-value" | npx wrangler secret put AGENT_AUTH_TOKEN --config wrangler.jsonc

# Optional: Enable Gemini AI (Workers AI is free primary)
echo "your-GEMINI_API_KEY" | npx wrangler secret put GEMINI_API_KEY --config wrangler.jsonc
```

---

## 📊 COMPLETE SECRET INVENTORY

### ✅ Already Configured (GitHub + Wrangler)

| Secret | GitHub | Wrangler | Purpose |
|--------|--------|----------|---------|
| `ESPOCRM_API_KEY` | ✅ | ✅ | EspoCRM API authentication |
| `ESPOCRM_API_PASSWORD` | ✅ | ✅ | EspoCRM API password |
| `SLACK_WEBHOOK_URL` | ✅ | ✅ | Slack notifications |
| `POSTIZ_API_KEY` | ✅ | ✅ | Postiz social media |
| `ADMIN_ALERT_SECRET` | ✅ | ✅ | Admin alerts |
| `CRON_SECRET` | ✅ | ✅ | Cron job authorization |
| `TS_CLIENT_ID` | ✅ | ❌ | Tailscale OAuth |
| `TS_CLIENT_SECRET` | ✅ | ❌ | Tailscale OAuth |
| `TS_AUTHKEY` | ✅ | ❌ | Tailscale auth |
| `OMV_SSH_KEY` | ✅ | ❌ | OMV node SSH access |
| `AWS_DEPLOY_ROLE_ARN` | ✅ | ❌ | AWS OIDC role |

### ⏳ NEEDS GitHub Secret (Add via Settings → Secrets → Actions)

| Secret | Required For | Priority | Notes |
|--------|--------------|----------|-------|
| `CLOUDFLARE_API_TOKEN` | Deploy, SST | 🔴 CRITICAL | Use "Edit Cloudflare Workers" template |
| `CF_ACCOUNT_ID` | Deploy, ETL | 🔴 CRITICAL | From Cloudflare dashboard |
| `CLOUDFLARE_ZONE_ID` | Deploy (custom domains) | 🔴 CRITICAL | From Cloudflare dashboard |
| `CF_R2_ACCESS_KEY_ID` | ETL workflows | 🔴 CRITICAL | From Cloudflare R2 settings |
| `CF_R2_SECRET_ACCESS_KEY` | ETL workflows | 🔴 CRITICAL | From Cloudflare R2 settings |

### ⏳ NEEDS Wrangler Secret (Run `npx wrangler secret put`)

| Secret | Required For | Priority | Notes |
|--------|--------------|----------|-------|
| `SESSION_SECRET` | Auth, Sessions | 🔴 CRITICAL | 32+ bytes, secure random |
| `AGENT_AUTH_TOKEN` | Agent endpoints | 🔴 CRITICAL | Secure random token |
| `GOOGLE_CLIENT_EMAIL` | Calendar booking | 🟡 MEDIUM | Service account email |
| `GOOGLE_PRIVATE_KEY` | Calendar booking | 🟡 MEDIUM | With \n for newlines |
| `GOOGLE_CALENDAR_ID` | Calendar booking | 🟡 MEDIUM | Default: "primary" |

### ✅ Optional (Only if Using Feature)

| Secret | Purpose | Alternative |
|--------|---------|-------------|
| `GEMINI_API_KEY` | Gemini AI fallback | Workers AI (free) works without it |
| `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` | LinkedIn ads | Leave empty if not using |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta/Facebook ads | Leave empty if not using |
| `SENTRY_AUTH_TOKEN` | Error tracking | Leave empty if not using |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry client | Leave empty if not using |
| `KUMA_PUSH_ETL_ESPOCRM` | ETL monitoring | Leave empty if not using |
| `GH_PAT` | GitHub token rotation | Leave empty if not using |

---

## 🔧 VERIFICATION CHECKLIST

After adding all secrets, verify by triggering:

1. **Deploy workflow:** Push to main branch or manually trigger `deploy.yml`
2. **SST Infra:** Manually trigger `sst-infra-deploy.yml`
3. **Cloudflare Deploy:** Manually trigger `cloudflare-deploy.yml`
4. **ETL Workflow:** Manually trigger `etl-espocrm-to-r2.yml`

All workflows should complete successfully.

---

## 📝 GOOGLE CALENDAR CONFIGURATION (Optional)

Calendar booking is **not required for core functionality**. The chat widget works without it.

### To Enable Calendar Booking:

**Option A: Wrangler Secrets (for Workers)**

```bash
# Get these from Google Cloud Console → IAM & Admin → Service Accounts
npx wrangler secret put GOOGLE_CLIENT_EMAIL --config wrangler.jsonc
# Value: your-service-account@project.iam.gserviceaccount.com

npx wrangler secret put GOOGLE_PRIVATE_KEY --config wrangler.jsonc
# Value: -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY----- (use actual \n characters)

npx wrangler secret put GOOGLE_CALENDAR_ID --config wrangler.jsonc
# Value: primary (default) or specific calendar ID
```

**Option B: D1 app_config Table (for k3s/ETL)**

```sql
INSERT OR REPLACE INTO app_config (key, value, description) VALUES (
  'GOOGLE_CLIENT_EMAIL',
  'service-account@project.iam.gserviceaccount.com',
  'Google Calendar service account'
);

INSERT OR REPLACE INTO app_config (key, value, description) VALUES (
  'GOOGLE_CALENDAR_ID',
  'primary',
  'Google Calendar ID'
);
```

**Note:** `GOOGLE_PRIVATE_KEY` should always be set via Wrangler secret for security.

---

## 🔗 QUICK LINKS

- **GitHub Secrets:** https://github.com/Themis128/cloudless.gr/settings/secrets/actions
- **Cloudflare Dashboard:** https://dash.cloudflare.com
- **Cloudflare API Tokens:** https://dash.cloudflare.com/profile/api-tokens
- **R2 Settings:** https://dash.cloudflare.com/?to=/:account/r2
- **SST Infra Deploy:** https://github.com/Themis128/cloudless.gr/actions/workflows/sst-infra-deploy.yml
- **ETL Workflow:** https://github.com/Themis128/cloudless.gr/actions/workflows/etl-espocrm-to-r2.yml

---

## ⚠️ IMPORTANT NOTES

1. **Source of Truth:** AWS SSM is deprecated for secrets — GitHub Secrets is now the source of truth
2. **Workflows Are Ready:** All workflow files are already configured correctly — only secrets are missing
3. **No Code Changes Needed:** This is purely a configuration issue, not a code issue
4. **Self-Hosted Runners:** ETL workflows require Pi runners (Cloudflare blocks data-center IPs)
5. **Order Matters:** Add the secrets in order (Steps 1-4) to unblock workflows sequentially

---

## 🆘 TROUBLESHOOTING

### "CLOUDFLARE_API_TOKEN is invalid"
- **Solution:** Token may lack required permissions. Recreate with **"Edit Cloudflare Workers"** template

### "CF_ACCOUNT_ID not found"
- **Solution:** Verify you copied the Account ID from Cloudflare dashboard (not Zone ID)

### "R2 operations failing"
- **Solution:** Ensure `CF_R2_ACCESS_KEY_ID` and `CF_R2_SECRET_ACCESS_KEY` are set

### "Authentication failed in Workers"
- **Solution:** Set `SESSION_SECRET` and `AGENT_AUTH_TOKEN` via `npx wrangler secret put`

---

**Status:** Once all secrets in Steps 1-5 are added, **ALL workflows will work**. This is a pure configuration task.