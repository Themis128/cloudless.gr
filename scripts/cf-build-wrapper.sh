#!/usr/bin/env bash
set -euo pipefail

echo "▶ Pre-creating middleware stubs for OpenNext compatibility..."
mkdir -p .next/server
# Next.js 16 emits middleware in a subdirectory, but OpenNext expects flat files
# Create stubs that OpenNext needs during the build
echo '{}' > .next/server/middleware.js.nft.json
touch .next/server/middleware.js .next/server/middleware.js.map

# If Next.js 16 creates a middleware directory, also create flat files there
if [ -d ".next/server/middleware" ]; then
  echo '{}' > .next/server/middleware/middleware.js.nft.json
  touch .next/server/middleware/middleware.js .next/server/middleware/middleware.js.map
fi

echo "▶ Running Next.js build (OpenNext will package it)..."
# Build Next.js first, then fix middleware paths before OpenNext packaging
pnpm next build

echo "▶ Fixing Next.js 16 middleware paths before OpenNext packaging..."
node scripts/opennext-middleware-fix.mjs

echo "▶ Running OpenNext Cloudflare packaging..."
pnpm exec opennextjs-cloudflare build

echo "✅ Cloudflare build complete"
