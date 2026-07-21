#!/usr/bin/env bash
set -euo pipefail

echo "▶ Pre-creating middleware stubs for OpenNext compatibility..."
mkdir -p .next/server
echo '{}' > .next/server/middleware.js.nft.json
touch .next/server/middleware.js .next/server/middleware.js.map

echo "▶ Running OpenNext build..."
pnpm exec opennextjs-cloudflare build

echo "▶ Fixing Next.js 16 middleware paths after OpenNext build..."
node scripts/opennext-middleware-fix.mjs

echo "✅ Cloudflare build complete"
