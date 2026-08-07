#!/usr/bin/env bash
#
# Provision Cloudflare Email / Resend API token and store in Cloudflare.
#
# Replaces the old SES SMTP provisioning. Uses Resend API token (already available
# as RESEND_API_KEY in GitHub secrets / Wrangler) and optional Cloudflare Email
# for incoming email handling.
#
# Writes to:
#   - Wrangler secret: RESEND_API_KEY
#   - D1 app_config:   resend_api_key
#   - Wrangler secret: CLOUDFLARE_EMAIL_API_TOKEN (for Cloudflare Email Workers)
#   - D1 app_config:   cloudflare_email_api_token
#   - Wrangler secret: EMAIL_FROM (verified sender)
#   - D1 app_config:   email_from
#
# Idempotent: if tokens already exist, exits early.
# Can be run with manual token input or via CI with GITHUB_TOKEN.

set -uo pipefail

source "$(dirname "$0")/lib/cf-secrets.sh"

FROM_DEFAULT="${EMAIL_FROM_DEFAULT:-noreply@cloudless.gr}"

# Check if already provisioned
EXISTING_RESEND=$(cf_config_get RESEND_API_KEY)
EXISTING_FROM=$(cf_config_get EMAIL_FROM)

if [ -n "$EXISTING_RESEND" ] && [ "$EXISTING_RESEND" != "null" ] && [ -n "$EXISTING_FROM" ] && [ "$EXISTING_FROM" != "null" ]; then
  echo "✓ Email credentials already present in Cloudflare (from=${EXISTING_FROM}). Nothing to do."
  exit 0
fi

# Manual token input path
MANUAL_RESEND="${RESEND_API_KEY_INPUT:-}"
MANUAL_CF_EMAIL="${CLOUDFLARE_EMAIL_API_TOKEN_INPUT:-}"
MANUAL_FROM="${EMAIL_FROM_INPUT:-}"

if [ -n "$MANUAL_RESEND" ] || [ -n "$MANUAL_CF_EMAIL" ]; then
  echo "→ Using manually provided email credentials (skipping auto-provisioning)"
  cf_verify_auth || exit 1

  if [ -n "$MANUAL_RESEND" ]; then
    echo "::add-mask::$MANUAL_RESEND"
    echo -n "Writing RESEND_API_KEY... "
    cf_secret_set "RESEND_API_KEY" "$MANUAL_RESEND" && echo -n "Wrangler ok " || echo -n "Wrangler failed "
    cf_config_set "RESEND_API_KEY" "$MANUAL_RESEND" && echo "D1 ok" || echo "D1 failed"
  fi

  if [ -n "$MANUAL_CF_EMAIL" ]; then
    echo "::add-mask::$MANUAL_CF_EMAIL"
    echo -n "Writing CLOUDFLARE_EMAIL_API_TOKEN... "
    cf_secret_set "CLOUDFLARE_EMAIL_API_TOKEN" "$MANUAL_CF_EMAIL" && echo -n "Wrangler ok " || echo -n "Wrangler failed "
    cf_config_set "CLOUDFLARE_EMAIL_API_TOKEN" "$MANUAL_CF_EMAIL" && echo "D1 ok" || echo "D1 failed"
  fi

  FROM_ADDR="${MANUAL_FROM:-$FROM_DEFAULT}"
  echo -n "Writing EMAIL_FROM... "
  cf_secret_set "EMAIL_FROM" "$FROM_ADDR" && echo -n "Wrangler ok " || echo -n "Wrangler failed "
  cf_config_set "EMAIL_FROM" "$FROM_ADDR" && echo "D1 ok" || echo "D1 failed"

  echo "✓ Email credentials written to Cloudflare (from=${FROM_ADDR})."
  exit 0
fi

# Auto-provisioning path: fetch from GitHub secrets if in CI
if [ -n "${GITHUB_TOKEN:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
  echo "→ Attempting to fetch RESEND_API_KEY from GitHub secrets..."
  # This would require gh CLI with appropriate permissions
  echo "  Note: GitHub secret fetch not implemented — use manual input or CI environment"
fi

echo "⚠ No manual credentials provided and no CI secret fetch implemented."
echo "Run with RESEND_API_KEY_INPUT and EMAIL_FROM_INPUT environment variables,"
echo "or add RESEND_API_KEY and EMAIL_FROM to GitHub secrets and configure CI to inject them."
exit 1