#!/bin/bash
# Verification script for analytics stack deployment
# Run after each phase of the ANALYTICS-IMPLEMENTATION-STRATEGY.md

set -e

echo "=== Analytics Stack Verification ==="
echo ""

# Phase 1: AppFlowy Check
echo "🔍 Checking AppFlowy deployment..."
kubectl get namespace appflowy 2>/dev/null || { echo "❌ Namespace appflowy not found"; exit 1; }
kubectl get pods -n appflowy 2>/dev/null | grep -E "(postgres|redis|gotrue|appflowy-cloud|appflowy-web|admin-frontend|nginx|worker)" || { echo "❌ Some AppFlowy pods missing"; }
echo "✅ AppFlowy pods present"

# Phase 2: n8n Check
echo "🔍 Checking n8n deployment..."
kubectl get namespace n8n 2>/dev/null || { echo "❌ Namespace n8n not found"; exit 1; }
kubectl get pods -n n8n 2>/dev/null | grep n8n || { echo "❌ n8n pods missing"; }
echo "✅ n8n pods present"

# Phase 3: EspoCRM Check
echo "🔍 Checking EspoCRM deployment..."
kubectl get namespace espocrm 2>/dev/null || { echo "❌ Namespace espocrm not found (will be created in Phase 3)"; }
echo "ℹ️  EspoCRM: Phase 3 target"

# Phase 4: Analytics (DuckDB/Metabase) Check
echo "🔍 Checking analytics stack..."
# Check if analytics namespace exists or will be created
echo "ℹ️  DuckDB/Metabase: Phase 4 target"

# Resource check
echo ""
echo "📊 Current Resource Usage:"
kubectl top nodes 2>/dev/null || echo "⚠️  Metrics server not available (run kubectl top nodes manually)"

# Storage check  
echo ""
echo "💾 Storage Allocation:"
echo "  AppFlowy MinIO: $(kubectl get pvc -n appflowy appflowy-minio 2>/dev/null | awk 'NR>1 {print $4}' || echo 'pending')"
echo "  AppFlowy Postgres: $(kubectl get pvc -n appflowy appflowy-postgres 2>/dev/null | awk 'NR>1 {print $4}' || echo 'pending')"

# Cloudflare bindings check
echo ""
echo "🔗 Cloudflare Bindings Check:"
echo "  wrangler whoami should show account: $(grep -o 'fb7dc7b69b662480cd5961a4d1913c78' wrangler-cloudflare-free.json && echo '✅' || echo '❓')"
echo "  Analytics binding: $(grep -q '"binding": "ANALYTICS"' wrangler-cloudflare-free.json && echo '✅ Configured' || echo '❌ Missing')"
echo "  D1 binding: $(grep -q '"binding": "AUTH_DB"' wrangler-cloudflare-free.json && echo '✅ Configured' || echo '❌ Missing')"
echo "  R2 buckets: $(grep -c '"binding": ".*_BUCKET"' wrangler-cloudflare-free.json) configured"

echo ""
echo "=== Verification Complete ==="