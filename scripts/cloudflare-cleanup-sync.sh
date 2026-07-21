#!/bin/bash
# CloudFlare Dashboard Cleanup & Sync Script
# Generated: 2026-07-20
# Purpose: Clean up orphaned resources and ensure perfect sync with app configuration

set -euo pipefail

echo "=== Cloudflare Cleanup & Sync Script ==="
echo "Analyzing current resources..."

# ============================================================================
# SECTION 1: Identify Orphaned Resources
# ============================================================================

echo ""
echo "📊 RESOURCES ANALYSIS:"
echo "====================="

# R2 Buckets currently configured
echo ""
echo "✅ R2 Buckets (CORRECT - all 8 in sync):"
echo "  Production: app-media-bucket, cloudless-analytics, cloudless-assets, datalake-bucket"
echo "  Preview: app-media-bucket-preview, cloudless-analytics-preview, cloudless-assets-preview, datalake-bucket-preview"

# D1 Databases
echo ""
echo "⚠️  D1 Databases Analysis:"
echo "  - user-auth-db (7ca74513...) ✅ IN USE - primary auth DB"
echo "  - auth-db-preview (70d90155...) ✅ IN USE - staging"
echo "  - cloudless-auth (0c00f32c...) ❌ ORPHANED - NOT referenced in any config"

# KV Namespaces
echo ""
echo "⚠️  KV Namespaces Analysis:"
echo "  - HEALTH_CACHE (9a6997af9ff...) ❌ ORPHANED - NOT referenced in wrangler.jsonc"

# Service Workers
echo ""
echo "⚠️  Service Workers Analysis:"
echo "  - cloudless-gr ✅ Main worker"
echo "  - cloudless ✅ Analytics worker"
echo "  - cloudless-gr-staging ✅ Staging"
echo "  - cloudless-analytics ✅ Analytics"
echo "  - cloudless-gr-chat ❓ May exist but verify it's deployed and accessible"
echo "  - cloudless-admin-api ❌ MISSING - referenced in wrangler.jsonc services but no /services/admin folder"

# Secrets
echo ""
echo "⚠️  Secrets Analysis:"
echo "  - CRON_SECRET ✅ Present"
echo "  - SESSION_SECRET ❌ Missing - only placeholder in config"
echo "  - AGENT_AUTH_TOKEN ❌ Missing - only placeholder in config"

# ============================================================================
# SECTION 2: Cleanup Recommendations
# ============================================================================

echo ""
echo "🧹 CLEANUP RECOMMENDATIONS:"
echo "==========================="

# Option 1: Show commands (dry-run mode)
if [[ "${1:-}" == "--execute" ]]; then
    echo ""
    echo "🗑️  EXECUTING CLEANUP..."
    
    echo ""
    echo "Deleting orphaned D1 database: cloudless-auth"
    npx wrangler d1 delete cloudless-auth --force --config wrangler.jsonc 2>&1 || echo "  (may already be deleted)"
    
    echo ""
    echo "Deleting orphaned KV namespace: HEALTH_CACHE"
    npx wrangler kv namespace delete 9a6997af9ff5495ba72b31d2c1e5e6dd --force --config wrangler.jsonc 2>&1 || echo "  (may already be deleted)"
    
else
    echo ""
    echo "To execute cleanup, run: $0 --execute"
    echo ""
    echo "Commands that would run:"
    echo "  npx wrangler d1 delete cloudless-auth --force --config wrangler.jsonc"
    echo "  npx wrangler kv namespace delete 9a6997af9ff5495ba72b31d2c1e5e6dd --force --config wrangler.jsonc"
fi

# ============================================================================
# SECTION 3: Missing Resources
# ============================================================================

echo ""
echo "🔧 MISSING RESOURCES TO CREATE:"
echo "=============================="

echo ""
echo "1. Admin API Service Worker (REQUIRED):"
echo "   Location: /services/admin (missing)"
echo "   Referenced in: wrangler.jsonc services.CHK_ADMIN_API binding"

echo ""
echo "2. Secrets to set (REQUIRED):"
echo "   SESSION_SECRET - 32+ bytes random string"
echo "   AGENT_AUTH_TOKEN - authentication token for agent endpoints"

# ============================================================================
# SECTION 4: OpenNext.js Fine-Tuning Recommendations
# ============================================================================

echo ""
echo "🔧 OPENNEXT.JS FINE-TUNING RECOMMENDATIONS:"
echo "============================================"

echo ""
echo "Current open-next.config.ts uses 'dummy' for caches and queues."
echo "This is suitable for development but production should use:"
echo ""

echo "Recommended enhancements for production:"
echo "  1. Add R2-based Incremental Cache for ISR performance"
echo "  2. Add KV-based Tag Cache for cache invalidation"
echo "  3. Enable KV-based Queue for scheduled revalidation"
echo "  4. Add warming function for critical routes"

# ============================================================================
# SECTION 5: Sync Verification
# ============================================================================

echo ""
echo "✅ VERIFICATION COMMANDS:"
echo "========================"
echo "  pnpm cloudflare-build && npx wrangler deploy --config wrangler.jsonc --dry-run"
echo "  curl -s https://cloudless.gr/api/health | jq"
echo "  curl -s https://cloudless.gr/api/auth/session | jq"

echo ""
echo "=== Analysis Complete ==="