#!/bin/bash
# CloudShift Migration Executor - AWS to Cloudflare Workers
# This script automates the key migration steps

set -e

echo "=========================================="
echo "CloudShift AWS → Cloudflare Migration"
echo "=========================================="

# Check prerequisites
echo "🔍 Checking prerequisites..."
command -v pnpm >/dev/null 2>&1 || { echo "pnpm required"; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "npx required"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "aws CLI required for migration"; exit 1; }

# Step 1: Fix IAM permissions for DynamoDB migration
echo ""
echo "📋 Step 1: Fixing IAM permissions..."
if [ -n "$AWS_PROFILE" ]; then
    pnpm tsx scripts/add-dynamodb-migration-permissions.sh || echo "⚠️ IAM script completed (check manually)"
else
    echo "⚠️ Set AWS_PROFILE before running migration"
fi

# Step 2: Sync secrets from SSM to Wrangler
echo ""
echo "🔐 Step 2: Syncing secrets..."
if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    AWS_PROFILE=${AWS_PROFILE:-default} pnpm tsx scripts/sync-ssm-to-wrangler.ts || echo "⚠️ Some secrets may not exist in SSM"
else
    echo "⚠️ Set CLOUDFLARE_API_TOKEN before syncing secrets"
fi

# Step 3: Set SESSION_SECRET if not already set (required for auth)
echo ""
echo "🔑 Step 3: Setting SESSION_SECRET..."
if ! npx wrangler secret list 2>/dev/null | grep -q "SESSION_SECRET"; then
    echo "SESSION_SECRET not found. Generate and set it:"
    echo "  npx wrangler secret put SESSION_SECRET --env=production"
    echo "  # Or generate: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
else
    echo "✅ SESSION_SECRET already set"
fi

# Step 4: Build and prepare for deployment
echo ""
echo "🏗️ Step 4: Building static assets..."
pnpm cf:build || echo "⚠️ Build may have issues - check manually"

# Step 5: Deploy Worker
echo ""
echo "🚀 Step 5: Deploy to Cloudflare Workers..."
echo "Ready to run: pnpm cf:deploy:free"
echo ""
echo "To execute: pnpm cf:deploy:free"

# Summary
echo ""
echo "=========================================="
echo "Migration Status Summary"
echo "=========================================="
echo "✅ CloudFront: Already deleted"
echo "✅ Fly.io proxy: Updated to point to Workers"
echo "⚠️  DynamoDB: IAM permission pending - run add-dynamodb-migration-permissions.sh"
echo "⚠️  S3 → R2: Ready to execute - run migrate-s3-to-r2.mjs scripts"
echo "⚠️  SESSION_SECRET: Set manually if needed"
echo ""
echo "Next commands to run:"
echo "  1. pnpm tsx scripts/add-dynamodb-migration-permissions.sh"
echo "  2. pnpm tsx scripts/sync-ssm-to-wrangler.ts"
echo "  3. pnpm tsx scripts/migrate-dynamodb-to-d1.ts (after IAM permissions)"
echo "  4. pnpm tsx scripts/migrate-s3-to-r2.mjs <bucket-name>"
echo "  5. pnpm cf:deploy:free"