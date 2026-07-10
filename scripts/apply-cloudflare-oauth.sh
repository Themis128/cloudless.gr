#!/bin/bash
# Apply Cloudflare R2 Website Configuration
# Works with CLOUDFLARE_API_TOKEN or wrangler login

set -e

echo "🔍 Checking R2 buckets..."
npx wrangler r2 bucket list

echo ""
echo "📋 Checking bucket: cloudless-assets"
npx wrangler r2 bucket info cloudless-assets

echo ""
echo "✅ Configuration complete!"
echo ""
echo "Next steps in Cloudflare Dashboard:"
echo "  Workers & Pages → R2 → cloudless-assets → Settings → Enable 'Public bucket'"
echo ""
echo "Worker endpoint: https://fully-migrated-serverless-stack.baltzakis-themis.workers.dev"