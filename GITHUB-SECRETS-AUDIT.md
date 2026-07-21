# GitHub Secrets Audit - Missing Secrets Check
# Generated: 2026-07-21
# Compared: .env.example vs GitHub Repository Secrets

## ✅ Present in GitHub Secrets (Verified)

| Variable | Status | Last Updated |
|----------|--------|--------------|
| AUTH_SECRET | ✅ Configured | 2026-06-10 |
| CRON_SECRET | ✅ Configured | 2026-07-20 |
| STRIPE_SECRET_KEY | ✅ Configured | 2026-06-10 |
| STRIPE_PUBLISHABLE_KEY | ✅ Configured | 2026-06-10 |
| STRIPE_WEBHOOK_SECRET | ✅ Configured | 2026-06-10 |
| GOOGLE_CLIENT_EMAIL | ✅ Configured | 2026-06-10 |
| GOOGLE_PRIVATE_KEY | ✅ Configured | 2026-06-10 |
| GSC_SITE_URL | ✅ Configured | 2026-04-21 |
| SLACK_BOT_TOKEN | ✅ Configured | 2026-06-15 |
| SLACK_SIGNING_SECRET | ✅ Configured | 2026-06-10 |
| SLACK_WEBHOOK_URL | ✅ Configured | 2024-04-13 |
| SLACK_DEFAULT_CHANNEL | ❌ Not found | (Optional) |
| LINKEDIN_CLIENT_ID | ✅ Configured | 2026-06-10 |
| LINKEDIN_CLIENT_SECRET | ✅ Configured | 2026-06-10 |
| LINKEDIN_ACCESS_TOKEN | ✅ Configured | 2026-06-20 |
| LINKEDIN_AD_ACCOUNT_ID | ❌ Not found | (Required) |
| LINKEDIN_ORGANIZATION_URN | ✅ Configured | 2026-06-10 |
| LINKEDIN_CAPI_ACCESS_TOKEN | ✅ Configured | 2026-06-19 |
| META_AD_ACCOUNT_ID | ✅ Configured | 2026-06-10 |
| META_ACCESS_TOKEN | ✅ Configured | 2026-06-10 |
| META_CAPI_ACCESS_TOKEN | ✅ Configured | 2026-06-10 |
| META_PAGE_ID | ✅ Configured | 2026-06-10 |
| META_PIXEL_ID | ❌ Missing (NEXT_PUBLIC_META_PIXEL_ID exists) | |
| TIKTOK_APP_ID | ✅ Configured | 2026-06-10 |
| TIKTOK_APP_SECRET | ✅ Configured | 2026-06-10 |
| TIKTOK_ACCESS_TOKEN | ❌ Not found | (Required) |
| TIKTOK_ADVERTISER_ID | ❌ Not found | (Required) |
| X_API_KEY | ✅ Configured | 2026-06-10 |
| X_API_SECRET | ✅ Configured | 2026-06-10 |
| X_ACCESS_TOKEN | ✅ Configured | 2026-06-10 |
| X_ACCESS_SECRET | ✅ Configured | 2026-06-10 |
| X_AD_ACCOUNT_ID | ❌ Not found | (Required) |
| GOOGLE_ADS_DEVELOPER_TOKEN | ✅ Configured | 2026-06-10 |
| GOOGLE_ADS_CUSTOMER_ID | ❌ Not found | (Required) |
| ADMIN_ALERT_SECRET | ❌ Not found | (Check - not in secrets list) |
| SENTRY_AUTH_TOKEN | ✅ Configured | 2026-06-10 |
| SENTRY_ORG | ✅ Configured | 2026-04-16 |
| SENTRY_PROJECT | ✅ Configured | 2026-04-16 |
| NEXT_PUBLIC_SENTRY_DSN | ✅ Configured | 2024-05-09 |
| APPFLOWY_API_URL | ✅ Configured | 2026-06-25 |
| APPFLOWY_EMAIL | ✅ Configured | 2026-06-25 |
| APPFLOWY_PASSWORD | ✅ Configured | 2026-06-25 |
| APPFLOWY_API_KEY | ❌ Not found | |
| APPFLOWY_WORKSPACE_ID | ❌ Not found | |
| APPFLOWY_BLOG_DOCS_ID | ❌ Not found | |
| APPFLOWY_WEBHOOK_SECRET | ❌ Not found | |
| ACTIVECAMPAIGN_API_TOKEN | ❌ Not found | |
| NEXT_PUBLIC_HUBSPOT_PORTAL_ID | ✅ Configured | 2024-05-09 |
| HUBSPOT_API_KEY | ❌ Not found | |
| HUBSPOT_CLIENT_SECRET | ❌ Not found | |

## ❌ CRITICAL MISSING (Required for Core Functionality)

| Variable | Purpose | Action |
|----------|---------|--------|
| GEMINI_API_KEY | **PRIMARY AI PROVIDER** - Chat and admin AI | `gh secret set GEMINI_API_KEY` |
| ADMIN_ALERT_SECRET | Admin webhook authentication | `gh secret set ADMIN_ALERT_SECRET` |

## ⚠️ MISSING (Ad Platform Integration)

| Variable | Purpose | Action |
|----------|---------|--------|
| LINKEDIN_AD_ACCOUNT_ID | LinkedIn ads targeting | `gh secret set LINKEDIN_AD_ACCOUNT_ID` |
| TIKTOK_ACCESS_TOKEN | TikTok ads API access | `gh secret set TIKTOK_ACCESS_TOKEN` |
| TIKTOK_ADVERTISER_ID | TikTok advertiser account | `gh secret set TIKTOK_ADVERTISER_ID` |
| X_AD_ACCOUNT_ID | X/Twitter ads account | `gh secret set X_AD_ACCOUNT_ID` |
| GOOGLE_ADS_CUSTOMER_ID | Google Ads customer ID | `gh secret set GOOGLE_ADS_CUSTOMER_ID` |
| META_PIXEL_ID | Meta pixel tracking | `gh secret set META_PIXEL_ID` |
| HUBSPOT_API_KEY | HubSpot CRM integration | `gh secret set HUBSPOT_API_KEY` |
| ACTIVECAMPAIGN_API_TOKEN | Email automation | `gh secret set ACTIVECAMPAIGN_API_TOKEN` |

## 📋 Next Steps

### 1. Add GEMINI_API_KEY (Critical for AI chat)
```bash
gh secret set GEMINI_API_KEY --repo Themis128/cloudless.gr
```

### 2. Verify Wrangler Secrets for Workers
The following are in GitHub secrets but also need to be in Wrangler for Workers runtime:
```bash
npx wrangler secret put GEMINI_API_KEY --config wrangler.jsonc
npx wrangler secret put GOOGLE_PRIVATE_KEY --config wrangler.jsonc
```

### 3. Add to D1 app_config (Optional - non-secret configs)
```bash
# These can be set in D1 app_config table instead of secrets
INSERT OR REPLACE INTO app_config (key, value, description) VALUES
  ('GOOGLE_CALENDAR_ID', 'primary', 'Google Calendar ID'),
  ('GSC_SITE_URL', 'sc-domain:cloudless.gr', 'Google Search Console property');
```

## 📊 Summary

- **Total variables in .env.example**: ~50
- **Present in GitHub secrets**: ~37
- **Missing (Critical)**: 1 (GEMINI_API_KEY for chat endpoint - ADMIN_ALERT_SECRET now configured)
- **Missing (Optional/Ad Platforms)**: ~15
- **Already in Wrangler**: 6 (ESPOCRM_API_KEY, ESPOCRM_API_PASSWORD, SLACK_WEBHOOK_URL, POSTIZ_API_KEY, ADMIN_ALERT_SECRET, CRON_SECRET)

### Secrets Status Matrix
| Secret | GitHub | Wrangler | Priority | Action Needed |
|--------|--------|----------|----------|---------------|
| GEMINI_API_KEY | ✅ | ❌ | 🔴 CRITICAL | `npx wrangler secret put GEMINI_API_KEY` |
| ADMIN_ALERT_SECRET | ✅ | ✅ | ✅ Done | No action needed |
| SESSION_SECRET | ✅ | ⏳ | 🟡 High | `npx wrangler secret put SESSION_SECRET` |
| AGENT_AUTH_TOKEN | ⏳ | ⏳ | 🟡 High | Set in GitHub + Wrangler |
