#!/usr/bin/env bash
set -euo pipefail

# Clean previous OpenNext output to avoid stale artifacts
rm -rf .open-next

# SSM_DISABLED=1 prevents AWS SSM calls during static generation.
# The build environment has no AWS credentials, and the deployed app
# uses D1 app_config / Wrangler secrets instead.
export SSM_DISABLED=1

echo "▶ Patching OpenNext for Next.js 16.3.0-preview.6 middleware compatibility..."
# Patch the OpenNext build to inject middleware fix after Next.js build
node scripts/patch-opennext-build.mjs

echo "▶ Running OpenNext Cloudflare build..."
NEXT_TELEMETRY_DISABLED=1 pnpm exec opennextjs-cloudflare build

echo "✅ Cloudflare build complete"