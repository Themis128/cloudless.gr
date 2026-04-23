# Marketing Hub — Activation Guide

The Marketing Hub is fully implemented in code. Every platform degrades gracefully to a `503` response when its SSM keys are absent. This guide lists what to populate in AWS Parameter Store to activate each feature.

---

## Activation checklist

| Platform | Admin page | Keys needed | Status |
|---|---|---|---|
| HubSpot Pipeline | `/admin/pipeline` | `HUBSPOT_API_KEY` (already in SSM) | Ready |
| Email (ActiveCampaign) | `/admin/email` | `ACTIVECAMPAIGN_API_URL`, `ACTIVECAMPAIGN_API_TOKEN` | Needs keys |
| Google Ads | `/admin/campaigns/google` | `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID` | Needs keys |
| LinkedIn | `/admin/campaigns/linkedin` | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AD_ACCOUNT_ID`, `LINKEDIN_ORGANIZATION_URN` | Needs keys |
| TikTok | `/admin/campaigns/tiktok` | `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID` | Needs keys |
| X (Twitter) | `/admin/campaigns/x` | `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`, `X_AD_ACCOUNT_ID` | Needs keys |
| Meta/Instagram | `/admin/campaigns/meta` | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | Blocked (policy appeal) |
| AI Assistant | `/admin/ai-assistant` | `ANTHROPIC_API_KEY` | Needs key |
| Content Calendar | `/admin/calendar` | None (in-memory store) | Ready |
| Client Reports | `/admin/reports` | Uses HubSpot + AC for data; `ANTHROPIC_API_KEY` for AI insights | Ready (no AI insights until key set) |

---

## SSM commands

```bash
# ActiveCampaign
aws ssm put-parameter --name "/cloudless/production/ACTIVECAMPAIGN_API_URL" \
  --type String --value "https://ACCOUNT.api-us1.com"
aws ssm put-parameter --name "/cloudless/production/ACTIVECAMPAIGN_API_TOKEN" \
  --type SecureString --value "TOKEN"

# Google Ads
aws ssm put-parameter --name "/cloudless/production/GOOGLE_ADS_DEVELOPER_TOKEN" \
  --type SecureString --value "TOKEN"
aws ssm put-parameter --name "/cloudless/production/GOOGLE_ADS_CUSTOMER_ID" \
  --type String --value "123-456-7890"

# LinkedIn
aws ssm put-parameter --name "/cloudless/production/LINKEDIN_ACCESS_TOKEN" \
  --type SecureString --value "TOKEN"
aws ssm put-parameter --name "/cloudless/production/LINKEDIN_AD_ACCOUNT_ID" \
  --type String --value "123456789"
aws ssm put-parameter --name "/cloudless/production/LINKEDIN_ORGANIZATION_URN" \
  --type String --value "urn:li:organization:123456789"

# TikTok
aws ssm put-parameter --name "/cloudless/production/TIKTOK_ACCESS_TOKEN" \
  --type SecureString --value "TOKEN"
aws ssm put-parameter --name "/cloudless/production/TIKTOK_ADVERTISER_ID" \
  --type String --value "1234567890123"

# X (Twitter)
aws ssm put-parameter --name "/cloudless/production/X_API_KEY" \
  --type SecureString --value "KEY"
aws ssm put-parameter --name "/cloudless/production/X_API_SECRET" \
  --type SecureString --value "SECRET"
aws ssm put-parameter --name "/cloudless/production/X_ACCESS_TOKEN" \
  --type SecureString --value "TOKEN"
aws ssm put-parameter --name "/cloudless/production/X_ACCESS_SECRET" \
  --type SecureString --value "SECRET"
aws ssm put-parameter --name "/cloudless/production/X_AD_ACCOUNT_ID" \
  --type String --value "abc123def456"

# Anthropic (AI Assistant + Report Insights)
aws ssm put-parameter --name "/cloudless/production/ANTHROPIC_API_KEY" \
  --type SecureString --value "sk-ant-..."
```

---

## Where to get the credentials

### ActiveCampaign
Settings → Developer → API Access. The URL is your account subdomain (`https://ACCOUNT.api-us1.com`).

### Google Ads
1. Sign in at ads.google.com
2. Tools → API Center → Developer token (apply for Standard Access if not yet approved — takes 1-5 days)
3. Customer ID is shown in the top-right of the Google Ads dashboard (format: `123-456-7890`)

### LinkedIn
1. Create an app at linkedin.com/developers
2. Request `r_ads`, `rw_ads` scopes
3. Run the OAuth 2.0 authorization flow to get an access token
4. Ad Account ID from Campaign Manager → account settings
5. Organization URN: your LinkedIn Company Page URL contains the numeric ID

### TikTok
1. Register at business.tiktok.com → Developer
2. Create an app and request Business API access
3. Generate an access token via the OAuth flow
4. Advertiser ID from TikTok Ads Manager → account settings

### X (Twitter)
1. Apply at developer.twitter.com → Projects & Apps
2. Enable "Read and Write" app permissions + Ads API access
3. Generate Access Token and Secret from the app dashboard
4. Ad Account ID from ads.twitter.com (format: `abc123def456`)

### Anthropic
console.anthropic.com → API Keys → Create key. The AI assistant uses `claude-sonnet-4-6`.

---

## HubSpot pipeline scopes

The existing `HUBSPOT_API_KEY` token needs additional scopes for the pipeline board:

| Scope | Feature |
|---|---|
| `crm.objects.deals.read` | Board, stats |
| `crm.objects.deals.write` | Move deal stage |
| `crm.objects.notes.write` | Create notes |
| `crm.schemas.deals.read` | Pipeline definitions |

Go to HubSpot → Settings → Integrations → Private Apps → edit the `cloudless.gr` app and add these scopes.

---

## Local development

Add the same keys to `.env.local` (not committed to git):

```bash
ACTIVECAMPAIGN_API_URL=https://myaccount.api-us1.com
ACTIVECAMPAIGN_API_TOKEN=...
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_CUSTOMER_ID=...
LINKEDIN_ACCESS_TOKEN=...
LINKEDIN_AD_ACCOUNT_ID=...
LINKEDIN_ORGANIZATION_URN=...
TIKTOK_ACCESS_TOKEN=...
TIKTOK_ADVERTISER_ID=...
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_SECRET=...
X_AD_ACCOUNT_ID=...
ANTHROPIC_API_KEY=sk-ant-...
```
