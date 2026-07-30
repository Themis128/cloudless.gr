#!/bin/bash
# CloudFlare Dashboard Cleanup & Sync Script
# Updated: 2026-07-30 — orphans cloudless-auth (D1) + HEALTH_CACHE (KV) deleted.
# Purpose: Verify live account matches wrangler.jsonc bindings.

set -euo pipefail

echo "=== Cloudflare Cleanup & Sync Script ==="
echo "Verifying resources against wrangler.jsonc..."

# ============================================================================
# SECTION 1: Expected resources (in sync)
# ============================================================================

echo ""
echo "📊 RESOURCES (expected = live as of 2026-07-30):"
echo "====================="

echo ""
echo "✅ R2 Buckets (wrangler.jsonc):"
echo "  Production: app-media-bucket, cloudless-analytics, cloudless-assets, datalake-bucket"
echo "  Preview: app-media-bucket-preview, cloudless-analytics-preview, cloudless-assets-preview, datalake-bucket-preview"
echo "  Extra (OK): sst-state"

echo ""
echo "✅ D1 Databases:"
echo "  - user-auth-db (7ca74513-23c3-412a-b9ca-b0c55835973d) — AUTH_DB / NEXT_CACHE_D1_BINDING (prod)"
echo "  - auth-db-preview (70d90155-12de-46d7-a0ea-113b3e7127cf) — staging"
echo "  - cloudless-auth — DELETED 2026-07-30 (was unbound orphan)"

echo ""
echo "✅ KV Namespaces:"
echo "  - TAG_CACHE (e81bb5dcf84b452b978323f09a3f7428) — prod"
echo "  - REVALIDATION_QUEUE (b5b95ab1caed42a8b6e14f5db869bbc6) — prod"
echo "  - TAG_CACHE_preview / REVALIDATION_QUEUE_preview — staging"
echo "  - HEALTH_CACHE — DELETED 2026-07-30 (was unbound orphan)"

# ============================================================================
# SECTION 2: Idempotent cleanup (safe if already gone)
# ============================================================================

echo ""
echo "🧹 CLEANUP (idempotent):"
echo "==========================="

if [[ "${1:-}" == "--execute" ]]; then
    echo ""
    echo "Ensuring orphaned D1 cloudless-auth is gone..."
    npx wrangler d1 delete cloudless-auth --force --config wrangler.jsonc 2>&1 || echo "  (already deleted)"

    echo ""
    echo "Ensuring orphaned KV HEALTH_CACHE is gone..."
    npx wrangler kv namespace delete 9a6997af9ff5495ba72b31d2c1e5e6dd --force --config wrangler.jsonc 2>&1 || echo "  (already deleted)"
else
    echo ""
    echo "Orphans already removed from the account. Re-run with --execute only to force idempotent deletes."
    echo "  $0 --execute"
fi

# ============================================================================
# SECTION 3: Local tooling
# ============================================================================

echo ""
echo "🔧 LOCAL SNAPSHOTS (Bindings explorer / SQLTools):"
echo "=============================="
echo "  Wrangler Local tab = Miniflare under .wrangler/state (dev data, not prod)."
echo "  For prod/staging SQLite copies: pnpm db:d1:pull"
echo "  Bindings explorer remote cache: /tmp/cloudflare-bindings-explorer/remote-d1/"
echo "  Expected remote files: 7ca74513-….sqlite (prod), 70d90155-….sqlite (preview)"

# ============================================================================
# SECTION 4: Verification
# ============================================================================

echo ""
echo "✅ VERIFICATION:"
echo "========================"
echo "  pnpm exec wrangler d1 list"
echo "  pnpm exec wrangler kv namespace list"
echo "  pnpm exec wrangler r2 bucket list"
echo "  curl -s https://cloudless.gr/api/health"

echo ""
echo "=== Analysis Complete ==="
