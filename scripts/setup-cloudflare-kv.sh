#!/bin/bash
# Setup KV namespaces for OpenNext.js production caching
# Generated: 2026-07-20

set -euo pipefail

echo "=== Cloudflare KV Setup Script ==="

# Create production KV namespaces
echo ""
echo "Creating production KV namespaces..."

echo "Creating TAG_CACHE namespace..."
TAG_CACHE_ID=$(npx wrangler kv namespace create "TAG_CACHE" --config wrangler.jsonc --preview false 2>&1 | grep -oP 'id: \K[a-f0-9-]+' || echo "")

echo "Creating REVALIDATION_QUEUE namespace..."
REVALIDATION_QUEUE_ID=$(npx wrangler kv namespace create "REVALIDATION_QUEUE" --config wrangler.jsonc --preview false 2>&1 | grep -oP 'id: \K[a-f0-9-]+' || echo "")

echo ""
echo "Creating preview KV namespaces..."

echo "Creating TAG_CACHE (preview) namespace..."
TAG_CACHE_PREVIEW_ID=$(npx wrangler kv namespace create "TAG_CACHE" --config wrangler.jsonc --preview 2>&1 | grep -oP 'id: \K[a-f0-9-]+' || echo "")

echo "Creating REVALIDATION_QUEUE (preview) namespace..."
REVALIDATION_QUEUE_PREVIEW_ID=$(npx wrangler kv namespace create "REVALIDATION_QUEUE" --config wrangler.jsonc --preview 2>&1 | grep -oP 'id: \K[a-f0-9-]+' || echo "")

echo ""
echo "=== KV Namespaces Created ==="
echo "Production:"
echo "  TAG_CACHE: $TAG_CACHE_ID"
echo "  REVALIDATION_QUEUE: $REVALIDATION_QUEUE_ID"
echo ""
echo "Preview:"
echo "  TAG_CACHE: $TAG_CACHE_PREVIEW_ID"
echo "  REVALIDATION_QUEUE: $REVALIDATION_QUEUE_PREVIEW_ID"

echo ""
echo "Update wrangler.jsonc with these IDs:"
cat << 'EOF'
  "kv_namespaces": [
    {
      "binding": "TAG_CACHE",
      "id": "TAG_CACHE_ID_HERE"
    },
    {
      "binding": "REVALIDATION_QUEUE",
      "id": "REVALIDATION_QUEUE_ID_HERE"
    }
  ],
  "env": {
    "staging": {
      "kv_namespaces": [
        {
          "binding": "TAG_CACHE",
          "id": "TAG_CACHE_PREVIEW_ID_HERE"
        },
        {
          "binding": "REVALIDATION_QUEUE",
          "id": "REVALIDATION_QUEUE_PREVIEW_ID_HERE"
        }
      ]
    }
  }
EOF