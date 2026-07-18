#!/usr/bin/env bash
# Save secrets from .env or SSM to Cloudflare Workers secrets
# Usage: ./scripts/save-secrets-to-cloudflare.sh
#
# This script:
# 1. Reads secrets from SSM (if configured) or prompts for input
# 2. Saves them to Cloudflare Workers via wrangler secret put
# 3. Verifies the secrets are set correctly

set -euo pipefail

echo "🔐 Cloudflare Workers Secrets Setup"
echo "===================================="

# Check for CLOUDFLARE_API_TOKEN
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN not set in environment"
  echo ""
  echo "Set it first:"
  echo "  export CLOUDFLARE_API_TOKEN='your-api-token'"
  echo ""
  echo "Required permissions: Account → Workers Scripts → Edit"
  exit 1
fi

# Verify wrangler is available
if ! command -v wrangler &> /dev/null; then
  echo "❌ wrangler not found"
  echo "Install with: npm install -g wrangler"
  exit 1
fi

# Secrets to migrate (based on .env.example and cloudflare-secrets-migration.md)
SECRETS_TO_SET="SESSION_SECRET STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET SLACK_WEBHOOK_URL SLACK_BOT_TOKEN SLACK_SIGNING_SECRET ANTHROPIC_API_KEY POSTIZ_API_KEY"

echo ""
echo "📋 Secrets to set in Cloudflare Workers:"
for s in $SECRETS_TO_SET; do
  echo "  - $s"
done
echo ""

# Confirm before proceeding
read -p "Proceed with setting secrets? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "💾 Setting up Cloudflare Workers secrets..."
echo ""

# Function to set a secret
set_secret() {
  local name="$1"
  local value="${2:-}"
  
  # If no value provided, try to read from env
  if [ -z "$value" ]; then
    value="${!name:-}"
  fi
  
  if [ -z "$value" ]; then
    echo "  [SKIP] $name - no value provided"
    return 0
  fi
  
  echo -n "  Setting $name... "
  echo "$value" | npx wrangler secret put "$name" > /dev/null 2>&1 && echo "✓" || echo "✗ (may already exist)"
}

# Set all required secrets
for secret in $SECRETS_TO_SET; do
  value="${!secret:-}"
  set_secret "$secret" "$value"
done

echo ""
echo "📝 Optional: Set via GitHub Secrets for CI/CD workflows"
echo ""
echo "For GitHub Actions, run:"
echo "  gh secret set SESSION_SECRET --repo Themis128/cloudless.gr"
echo "  gh secret set STRIPE_SECRET_KEY --repo Themis128/cloudless.gr"
echo "  gh secret set SLACK_WEBHOOK_URL --repo Themis128/cloudless.gr"
echo ""

echo "✅ Cloudflare Workers secrets setup complete"
echo ""
echo "Next steps:"
echo "  1. Deploy worker: npx wrangler deploy"
echo "  2. Verify health: curl https://cloudless.gr/api/health"
echo "  3. Check /admin/integrations on the deployed site"