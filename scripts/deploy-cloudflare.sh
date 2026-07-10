#!/usr/bin/env bash
# Deploy to Cloudflare Workers with full migration
set -euo pipefail

echo "=== Cloudflare Workers Deployment ==="

# 1. Build Next.js static export
echo "Building Next.js..."
pnpm cf:build

# 2. Upload to R2 bucket
echo "Uploading assets to R2..."
pnpm cf:r2:upload-dir

# 3. Deploy Worker with routes
echo "Deploying Worker..."
pnpm cf:deploy

echo "=== Deployment Complete ==="
echo "Your app is now at https://cloudless.gr"
