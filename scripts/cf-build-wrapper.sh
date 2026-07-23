#!/usr/bin/env bash
set -euo pipefail

# Guard against recursion: OpenNext calls `buildCommand` internally,
# and if it falls back to `pnpm run build` we'd loop forever.
# Safety net: detect the re-entry and delegate directly to next build.
if [ -n "${OPEN_NEXT_BUILD_ACTIVE:-}" ]; then
  echo "⚠ Recursive build detected — delegating directly to next build..."
  # OpenNext sets NEXT_PRIVATE_STANDALONE=true via setStandaloneBuildMode()
  # before calling buildCommand. In standalone mode, Next.js 16.3.0-preview.6
  # tries to write middleware.js.nft.json during finalization, but the file
  # doesn't exist (Next 16 uses edge/chunks/ instead). This causes ENOENT.
  # Unset it so next build runs the same as the first build (non-standalone).
  unset NEXT_PRIVATE_STANDALONE
  unset NEXT_PRIVATE_OUTPUT_TRACE_ROOT
  # Pre-create middleware.js.nft.json stub BEFORE next build runs.
  node scripts/opennext-middleware-fix.mjs || true
  pnpm exec next build
  # Re-create middleware stub after inner next build (which cleans .next/server)
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
NEXT_TELEMETRY_DISABLED=1 pnpm exec next build

# Next.js build cleans stale artifacts from .next/server, which DELETES
# middleware.js.nft.json. Re-create the stub here so opennextjs-cloudflare
# doesn't ENOENT when it scans for middleware files.
echo "▶ Ensuring middleware.js.nft.json stub exists for OpenNext..."
node scripts/opennext-middleware-fix.mjs || true

echo "▶ Running OpenNext Cloudflare build..."
NEXT_TELEMETRY_DISABLED=1 pnpm exec opennextjs-cloudflare build

echo "✅ Cloudflare build complete"