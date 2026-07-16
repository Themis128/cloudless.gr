#!/bin/bash
# Setup script for preview environment resources
# Run this once to create all preview bindings before PRs can be deployed

set -euo pipefail

echo "=== Setting up Cloudflare preview environment ==="

# Create preview D1 database
echo "Creating preview D1 database..."
npx wrangler d1 create auth-db-preview 2>/dev/null || echo "Database may already exist, continuing..."

# Create preview R2 buckets
echo "Creating preview R2 buckets..."
for bucket in cloudless-assets-preview cloudless-analytics-preview datalake-bucket-preview app-media-bucket-preview; do
  npx wrangler r2 bucket create "$bucket" 2>/dev/null || echo "Bucket $bucket may already exist, continuing..."
done

# Create preview Analytics Engine dataset (note: AE datasets are auto-created on first write)
echo "Analytics Engine dataset will be auto-created on first write..."

# Note: Secrets must be set manually via dashboard or CLI
echo ""
echo "=== Manual steps required ==="
echo "Set these secrets for the preview worker:"
echo "  npx wrangler secret put SESSION_SECRET --name cloudless-gr-preview"
echo "  npx wrangler secret put ANTHROPIC_API_KEY --name cloudless-gr-preview"
echo "  npx wrangler secret put STRIPE_WEBHOOK_SECRET --name cloudless-gr-preview"
echo ""
echo "Apply the auth schema to the preview database:"
echo "  npx wrangler d1 execute auth-db-preview --file=schema.sql --remote"