#!/bin/bash
# Script to add missing GitHub secrets for SST deployment
# These secrets are REQUIRED for the deployment workflow to work

set -e

echo "🔐 Adding missing GitHub secrets for SST Cloudflare Infrastructure deployment"
echo "========================================================================"

# Check if gh CLI is authenticated
if ! gh auth status >/dev/null 2>&1; then
    echo "❌ GitHub CLI not authenticated. Please run: gh auth login"
    exit 1
fi

# CRON_SECRET - Already generated, just needs to be added
CRON_SECRET="3a0761c6c112e74b0e9a9692f864eb071d3fe6638fb3e042a348d0d5ccd429c4"

echo ""
echo "📋 Required Secrets to Add:"
echo "---------------------------"
echo "1. CLOUDFLARE_API_TOKEN - You need to create this at Cloudflare"
echo "2. CF_ACCOUNT_ID - Your Cloudflare account ID"
echo "3. CRON_SECRET - Ready to add (value known)"
echo ""

# Check if secrets already exist (gh secret list doesn't show values, just names)
echo "🔍 Checking which secrets are missing..."
EXISTING_SECRETS=$(gh secret list --repo Themis128/cloudless.gr --json name -t '.[].name' 2>/dev/null || echo "")

check_and_add_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    
    if echo "$EXISTING_SECRETS" | grep -q "^${SECRET_NAME}$"; then
        echo "✅ $SECRET_NAME already exists"
    else
        if [ -n "$SECRET_VALUE" ]; then
            echo "🔐 Adding $SECRET_NAME..."
            echo "$SECRET_VALUE" | gh secret set "$SECRET_NAME" --repo Themis128/cloudless.gr
        else
            echo "⚠️  $SECRET_NAME needs to be added manually (no value provided)"
        fi
    fi
}

# Add CRON_SECRET (we have the value)
check_and_add_secret "CRON_SECRET" "$CRON_SECRET"

# Check for CLOUDFLARE_API_TOKEN and CF_ACCOUNT_ID
echo ""
echo "⚠️  Manual Action Required:"
echo "---------------------------"

if ! echo "$EXISTING_SECRETS" | grep -q "^CLOUDFLARE_API_TOKEN$"; then
    echo "❌ CLOUDFLARE_API_TOKEN - MISSING"
    echo ""
    echo "   To get this:"
    echo "   1. Go to: https://dash.cloudflare.com/profile/api-tokens"
    echo "   2. Click 'Create Token'"
    echo "   3. Use 'Edit Cloudflare Workers' template or create custom with:"
    echo "      - Account:Edit"
    echo "      - Zone:Edit"
    echo "      - D1:Edit"
    echo "      - R2:Edit"
    echo "      - Workers:Edit"
    echo "   4. Copy the token and add it to GitHub:"
    echo "      gh secret set CLOUDFLARE_API_TOKEN --repo Themis128/cloudless.gr <<< 'YOUR_TOKEN_HERE'"
else
    echo "✅ CLOUDFLARE_API_TOKEN already exists"
fi

if ! echo "$EXISTING_SECRETS" | grep -q "^CF_ACCOUNT_ID$"; then
    echo "❌ CF_ACCOUNT_ID - MISSING"
    echo ""
    echo "   To get this:"
    echo "   1. Go to: https://dash.cloudflare.com"
    echo "   2. Look at the right sidebar - Account ID is displayed there"
    echo "   3. Add it to GitHub:"
    echo "      gh secret set CF_ACCOUNT_ID --repo Themis128/cloudless.gr <<< 'YOUR_ACCOUNT_ID_HERE'"
else
    echo "✅ CF_ACCOUNT_ID already exists"
fi

echo ""
echo "📝 After adding all secrets, verify with:"
echo "   gh secret list --repo Themis128/cloudless.gr"
echo ""
echo "🚀 Then run deployment:"
echo "   gh workflow run .github/workflows/sst-infra-deploy.yml --repo Themis128/cloudless.gr"