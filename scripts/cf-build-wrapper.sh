#!/usr/bin/env bash
set -euo pipefail

# Guard against recursion: OpenNext calls `buildCommand` internally.
# When OpenNext's build() calls buildNextjsApp(options), it execSync's
# the buildCommand (pnpm build = bash scripts/cf-build-wrapper.sh).
# In this recursive call, we should NOT run next build again because:
# 1. The first next build already created the complete .next/ output
# 2. Running next build again cleans .next/ and rebuilds it, but the
#    TypeScript checker (useTypeScriptCli) fails, leaving .next/ incomplete
# 3. The incomplete .next/ then causes ENOENT errors in OpenNext's bundle phase
#
# Instead, we just ensure the middleware stub exists and exit successfully.
# NOTE: package.json "build" is scripts/sst-next-build.mjs (not this file).
# OpenNext's nested `pnpm build` hits that script — it also honors
# OPEN_NEXT_BUILD_ACTIVE (see sst-next-build.mjs).
if [ -n "${OPEN_NEXT_BUILD_ACTIVE:-}" ]; then
  echo "⚠ Recursive build detected — skipping next build (already built above)..."
  # Ensure middleware.js.nft.json stub exists for OpenNext's bundle phase
  node scripts/opennext-middleware-fix.mjs || true
  exit 0
fi
export OPEN_NEXT_BUILD_ACTIVE=1
# Prevent any nested build wrappers from recursing
export CF_BUILD_WRAPPER_ACTIVE=1

# Clean previous OpenNext output to avoid stale artifacts
rm -rf .open-next

# SSM_DISABLED=1 prevents AWS SSM calls during static generation.
# The build environment has no AWS credentials, and the deployed app
# uses D1 app_config / Wrangler secrets instead.
export SSM_DISABLED=1

echo "▶ Patching OpenNext for Next.js 16.3.0-preview.6 middleware compatibility..."
# Patch the OpenNext build to inject middleware fix after Next.js build
node scripts/patch-opennext-build.mjs

echo "▶ Running Next.js build..."
# Keep middleware.js.nft.json present for the whole Next build — Next 16
# finalization opens it, but recreating `.next/` wipes any pre-build stub.
export NEXT_OUTPUT_STANDALONE=1
node scripts/sst-next-build.mjs
echo "⚠ Next.js build completed (SST wrapper keeps middleware NFT stub alive)"

# Ensure standalone build exists for OpenNext.
# Next.js with output: "standalone" creates .next/standalone/ during build.
# If the build failed during type checking, the standalone output may be
# incomplete (directory exists but files are missing). Always ensure the
# required files are present by copying from .next/server.
echo "▶ Ensuring standalone build files exist for OpenNext..."
mkdir -p .next/standalone/.next
# Copy the server directory which contains pages-manifest.json
if [ -d ".next/server" ]; then
  cp -rf .next/server/. .next/standalone/.next/server/ 2>/dev/null || true
fi
# Copy other essential directories/files
# Copy BUILD_ID for OpenNext
  if [ -e ".next/BUILD_ID" ]; then
    cp -rf ".next/BUILD_ID" ".next/standalone/.next/BUILD_ID" 2>/dev/null || true
  fi
for dir in app chunks edge functions-config-manifest.json middleware middleware-build-manifest.js middleware-manifest.json next-font-manifest.js pages-manifest.json prefetch-hints.json server-reference-manifest.js required-server-files.json; do
  if [ -e ".next/$dir" ]; then
    cp -rf ".next/$dir" ".next/standalone/.next/$dir" 2>/dev/null || true
  fi
done
# Copy package.json for standalone
cp package.json .next/standalone/package.json 2>/dev/null || true
echo "▶ Standalone build files ensured"

# Ensure middleware.js.nft.json stub exists for OpenNext
echo "▶ Ensuring middleware.js.nft.json stub exists for OpenNext..."
node scripts/opennext-middleware-fix.mjs || true

echo "▶ Running OpenNext Cloudflare build..."
NEXT_TELEMETRY_DISABLED=1 pnpm exec opennextjs-cloudflare build \
  --openNextConfigPath open-next.config.cloudflare.ts

# Patch worker.js to export custom Durable Objects (copies agent files)
node scripts/patch-worker-dos.mjs

# Free plan = 3 MiB gzip Worker script. Strip OG fonts/WASM + .bin stubs so
# we stay under the limit without Workers Paid (~$5/mo).
echo "▶ Slimming OpenNext output for Workers Free (strip OG + .bin fonts)..."
node scripts/strip-opennext-bin-fonts.mjs
node scripts/strip-opennext-vercel-og.mjs
node scripts/strip-yoga-wasm.mjs

if [ -f .open-next/worker.js ]; then
  bytes=$(gzip -c .open-next/worker.js | wc -c)
  awk -v b="$bytes" 'BEGIN {printf "▶ worker.js gzip ≈ %.2f MiB (free limit 3.00)\n", b/1024/1024}'
fi

echo "✅ Cloudflare build complete"