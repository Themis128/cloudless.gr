#!/usr/bin/env bash
# Save all secrets from environment to Cloudflare Workers secrets (bulk)
# Usage: CLOUDFLARE_API_TOKEN=... ./scripts/save-secrets-to-cloudflare.sh
#
# Reads all secrets from process.env and sets them via wrangler at once
# For k3s: creates Kubernetes secret manifest with SSM_DISABLED=1 support

set -euo pipefail

echo "🔐 Cloudflare Workers Secrets Bulk Setup"
echo "========================================="

# Verify wrangler is available
if ! command -v wrangler &> /dev/null; then
  echo "❌ wrangler not found"
  echo "Install with: npm install -g wrangler"
  exit 1
fi

# All secrets that can be set (based on .env.example)
ALL_SECRETS=(
  "SESSION_SECRET"
  "STRIPE_SECRET_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "SLACK_WEBHOOK_URL"
  "SLACK_BOT_TOKEN"
  "SLACK_SIGNING_SECRET"
  "POSTIZ_API_KEY"
  "ADMIN_ALERT_SECRET"
  "ESPOCRM_API_KEY"
  "ESPOCRM_BASE_URL"
  "ANTHROPIC_API_KEY"
  "ACTIVECAMPAIGN_API_TOKEN"
  "NOTION_API_KEY"
)

# Find secrets that have values in environment
SECRETS_WITH_VALUES=()
for s in "${ALL_SECRETS[@]}"; do
  if [ -n "${!s:-}" ]; then
    SECRETS_WITH_VALUES+=("$s")
  fi
done

echo ""
echo "📋 Found ${#SECRETS_WITH_VALUES[@]} secrets in environment:"
for s in "${SECRETS_WITH_VALUES[@]}"; do
  echo "  - $s"
done
echo ""

if [ ${#SECRETS_WITH_VALUES[@]} -eq 0 ]; then
  echo "❌ No secrets found in environment"
  echo ""
  echo "Load your .env file first:"
  echo "  export \$(cat .env.local | grep -v '^#' | xargs)"
  exit 1
fi

# Confirm
read -p "Set these ${#SECRETS_WITH_VALUES[@]} secrets to Cloudflare Workers? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo "💾 Setting secrets..."
echo ""

SUCCESS=0
FAIL=0

for secret in "${SECRETS_WITH_VALUES[@]}"; do
  value="${!secret}"
  echo -n "  $secret... "
  if echo "$value" | npx wrangler secret put "$secret" > /dev/null 2>&1; then
    echo "✓"
    ((SUCCESS++)) || true
  else
    echo "✗ (already exists or error)"
    ((FAIL++)) || true
  fi
done

echo ""
echo "Summary: $SUCCESS set, $FAIL skipped/errors"
echo ""

# Also output Kubernetes secret for k3s
echo "📋 Kubernetes secret manifest (for k3s with SSM_DISABLED=1):"
echo "--- save as k3s/cloudless-secrets.yaml ---"
echo "apiVersion: v1"
echo "kind: Secret"
echo "metadata:"
echo "  name: cloudless-secrets"
echo "  namespace: cloudless"
echo "type: Opaque"
echo "stringData:"
for secret in "${SECRETS_WITH_VALUES[@]}"; do
  echo "  $secret: \"${!secret}\""
done
echo "---"
echo ""

# GitHub Actions secrets command
echo "📋 GitHub Actions repo secrets (run after gh auth login):"
for secret in SESSION_SECRET STRIPE_SECRET_KEY POSTIZ_API_KEY ADMIN_ALERT_SECRET ANTHROPIC_API_KEY; do
  if [ -n "${!secret:-}" ]; then
    echo "gh secret set $secret --repo Themis128/cloudless.gr"
  fi
done
echo ""

echo "✅ Done. Secrets available to both Workers and k3s."
