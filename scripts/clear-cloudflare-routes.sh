#!/usr/bin/env bash
# Clear Cloudflare Worker routes conflict by deleting the old worker
# This resolves: "Can't deploy routes that are assigned to another worker"
set -euo pipefail

echo "=== Cloudflare Routes Cleanup ==="

# Delete the conflicting worker (cloudless-gr)
# This will free up routes: cloudless.gr, www.cloudless.gr
echo "Deleting old worker 'cloudless-gr' to free up routes..."
npx wrangler delete cloudless-gr --force --config wrangler.jsonc

echo "✅ Old worker deleted, routes are now available"

# Now deploy the free-tier worker
echo "Deploying cloudless-gr-free..."
pnpm cf:deploy:free

echo "=== Deployment Complete ==="