#!/bin/bash
# Setup R2 bucket for website hosting
# Requires: CLOUDFLARE_API_TOKEN exported

set -e

# Check for API token
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ Error: CLOUDFLARE_API_TOKEN not set"
  echo "Set it with: export CLOUDFLARE_API_TOKEN='your-token'"
  exit 1
fi

BUCKET="cloudless-assets"
DIST_DIR="./out"

echo "🔍 Checking R2 bucket: $BUCKET"

# List current buckets
npx wrangler r2 bucket list

echo ""
echo "📋 Listing objects in $BUCKET (first 10):"
npx wrangler r2 object list $BUCKET --limit 10 || true

echo ""
echo "📤 Uploading files from $DIST_DIR to $BUCKET..."
if [ -d "$DIST_DIR" ]; then
  find "$DIST_DIR" -type f | while read file; do
    key=$(echo "$file" | sed "s|^$DIST_DIR/||")
    echo "  Uploading: $key"
    npx wrangler r2 object put "$BUCKET/$key" --file="$file" 2>/dev/null || true
  done
else
  echo "⚠️  Directory $DIST_DIR not found"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Go to https://dash.cloudflare.com → Workers & Pages → R2 → $BUCKET"
echo "2. Enable 'Public bucket' for r2.dev access, OR"
echo "3. Add custom domain under 'Custom domains' tab"
echo ""
echo "Worker endpoint: https://fully-migrated-serverless-stack.baltzakis-themis.workers.dev"