#!/usr/bin/env bash
#
# Cloudflare-native secret management helpers.
# Replaces AWS SSM with: Wrangler secrets + D1 app_config via /api/config
#
# Usage: source this file in other scripts
#   source scripts/lib/cf-secrets.sh
#   cf_secret_get "KEY"          # prints value or empty
#   cf_secret_set "KEY" "VALUE"  # writes secret via wrangler
#   cf_config_get "key"          # reads from D1 app_config
#   cf_config_set "key" "value"  # writes to D1 app_config

set -euo pipefail

# Cloudflare configuration
CF_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${CF_ACCOUNT_ID:-}}"
CF_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CF_CONFIG_URL="${CONFIG_URL:-http://localhost:8787/api/config}"

# Wrangler secret prefix (matches wrangler.jsonc bindings)
# These are the secret names used in the Worker
WRANGLER_SECRETS=(
  "ACTIVECAMPAIGN_API_URL"
  "ACTIVECAMPAIGN_API_TOKEN"
  "ACTIVECAMPAIGN_LEAD_AUTOMATION_ID"
  "TIKTOK_ACCESS_TOKEN"
  "TIKTOK_ADVERTISER_ID"
  "X_AD_ACCOUNT_ID"
  "POSTIZ_API_URL"
  "POSTIZ_API_KEY"
  "CLOUDFLARE_API_TOKEN"
  "SLACK_BOT_TOKEN"
  "SLACK_SIGNING_SECRET"
  "SLACK_DEFAULT_CHANNEL"
  "SLACK_APP_CONFIG_TOKEN"
  "SLACK_APP_CONFIG_REFRESH_TOKEN"
  "NOTION_API_KEY"
  "NOTION_BLOG_DB_ID"
  "NOTION_DOCS_DB_ID"
  "NOTION_PROJECTS_DB_ID"
  "NOTION_TASKS_DB_ID"
  "NOTION_CALENDAR_DB_ID"
  "NOTION_SUBMISSIONS_DB_ID"
  "NOTION_TESTIMONIALS_DB_ID"
  "NOTION_CASE_STUDIES_DB_ID"
  "NOTION_SERVICES_DB_ID"
  "NOTION_FAQS_DB_ID"
  "GITHUB_TOKEN"
  "GITHUB_DISPATCH_TOKEN"
  "SESSION_SECRET"
  "RESEND_API_KEY"
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
)

# Map secret names to D1 config keys (for keys that should live in app_config)
declare -A SECRET_TO_CONFIG_KEY=(
  ["NOTION_API_KEY"]="notion_api_key"
  ["NOTION_BLOG_DB_ID"]="notion_blog_db_id"
  ["NOTION_DOCS_DB_ID"]="notion_docs_db_id"
  ["NOTION_PROJECTS_DB_ID"]="notion_projects_db_id"
  ["NOTION_TASKS_DB_ID"]="notion_tasks_db_id"
  ["NOTION_CALENDAR_DB_ID"]="notion_calendar_db_id"
  ["NOTION_SUBMISSIONS_DB_ID"]="notion_submissions_db_id"
  ["NOTION_TESTIMONIALS_DB_ID"]="notion_testimonials_db_id"
  ["NOTION_CASE_STUDIES_DB_ID"]="notion_case_studies_db_id"
  ["NOTION_SERVICES_DB_ID"]="notion_services_db_id"
  ["NOTION_FAQS_DB_ID"]="notion_faqs_db_id"
  ["SLACK_BOT_TOKEN"]="slack_bot_token"
  ["SLACK_SIGNING_SECRET"]="slack_signing_secret"
  ["SLACK_DEFAULT_CHANNEL"]="slack_default_channel"
  ["POSTIZ_API_URL"]="postiz_api_url"
  ["POSTIZ_API_KEY"]="postiz_api_key"
  ["ACTIVECAMPAIGN_API_URL"]="activecampaign_api_url"
  ["ACTIVECAMPAIGN_API_TOKEN"]="activecampaign_api_token"
  ["ACTIVECAMPAIGN_LEAD_AUTOMATION_ID"]="activecampaign_lead_automation_id"
  ["TIKTOK_ACCESS_TOKEN"]="tiktok_access_token"
  ["TIKTOK_ADVERTISER_ID"]="tiktok_advertiser_id"
  ["X_AD_ACCOUNT_ID"]="x_ad_account_id"
  ["SESSION_SECRET"]="session_secret"
  ["RESEND_API_KEY"]="resend_api_key"
  ["STRIPE_SECRET_KEY"]="stripe_secret_key"
  ["STRIPE_WEBHOOK_SECRET"]="stripe_webhook_secret"
)

# Check if we can use wrangler
cf_has_wrangler() {
  command -v wrangler >/dev/null 2>&1
}

# Get a secret via Wrangler (for Worker runtime)
cf_secret_get() {
  local key="$1"
  if cf_has_wrangler && [ -n "$CF_ACCOUNT_ID" ]; then
    # Try to get from wrangler (only works for deployed workers)
    wrangler secret list --env production 2>/dev/null | grep -q "^$key$" && \
      wrangler secret get "$key" --env production 2>/dev/null || true
  fi
}

# Set a secret via Wrangler
cf_secret_set() {
  local key="$1" value="$2"
  if cf_has_wrangler && [ -n "$CF_ACCOUNT_ID" ] && [ -n "$CF_API_TOKEN" ]; then
    echo "$value" | wrangler secret put "$key" --env production 2>/dev/null
  else
    echo "ERROR: wrangler not available or CF credentials missing" >&2
    return 1
  fi
}

# Get config from D1 app_config via /api/config endpoint
cf_config_get() {
  local key="$1"
  local config_key="${SECRET_TO_CONFIG_KEY[$key]:-${key,,}}"
  curl -s "${CF_CONFIG_URL}?key=${config_key}" 2>/dev/null | \
    jq -r '.value // empty' 2>/dev/null || true
}

# Set config in D1 app_config via /api/config endpoint
cf_config_set() {
  local key="$1" value="$2"
  local config_key="${SECRET_TO_CONFIG_KEY[$key]:-${key,,}}"
  local payload=$(jq -n --arg k "$config_key" --arg v "$value" '{key: $k, value: $v}')
  curl -s -X PUT "${CF_CONFIG_URL}" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null | jq -r '.success // false' 2>/dev/null || true
}

# Check if a secret/config exists
cf_exists() {
  local key="$1"
  local val
  val=$(cf_config_get "$key")
  [ -n "$val" ] && [ "$val" != "null" ]
}

# List all known secrets and their status
cf_status() {
  echo "Cloudflare secrets / D1 config status:"
  for key in "${WRANGLER_SECRETS[@]}"; do
    if cf_exists "$key"; then
      echo "  [set]     $key"
    else
      echo "  [MISSING] $key"
    fi
  done
}

# Verify wrangler is authenticated
cf_verify_auth() {
  if ! cf_has_wrangler; then
    echo "ERROR: wrangler CLI not found. Install with: npm install -g wrangler" >&2
    return 1
  fi
  if [ -z "$CF_ACCOUNT_ID" ]; then
    echo "ERROR: CLOUDFLARE_ACCOUNT_ID not set" >&2
    return 1
  fi
  if [ -z "$CF_API_TOKEN" ]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN not set" >&2
    return 1
  fi
  return 0
}