#!/bin/bash
# DynamoDB to D1 Migration Runner
# Sources .env.local and runs the migration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Source environment (preserves special characters in secrets)
set -a
[ -f .env.local ] && . .env.local
set +a

# Verify we have the token
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ CLOUDFLARE_API_TOKEN not found in .env.local"
    exit 1
fi

echo "✅ CLOUDFLARE_API_TOKEN found"
echo "📋 AWS_PROFILE: ${AWS_PROFILE:-default}"

# Run migration
exec pnpm tsx scripts/migrate-dynamodb-to-d1.ts "$@"