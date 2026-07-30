#!/usr/bin/env bash
# d1-retire-cloudless-auth.sh — remove orphaned D1 database cloudless-auth.
#
# Status: DELETED from the Cloudflare account on 2026-07-30.
# This script remains as an idempotent guard (no-op if already gone).
#
# cloudless-auth (0c00f32c-…) was never bound in wrangler.jsonc.
# Active auth DBs: user-auth-db + auth-db-preview.
# Cognito Hosted UI prefix "cloudless-auth" in sst.config.ts is unrelated AWS naming.
#
# Usage:
#   bash scripts/d1-retire-cloudless-auth.sh          # status / dry-run
#   CONFIRM=1 bash scripts/d1-retire-cloudless-auth.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="cloudless-auth"

cd "$ROOT"

echo "Orphan D1 candidate: ${NAME}"
echo "Active D1 (keep): user-auth-db, auth-db-preview"
echo "Account status: deleted 2026-07-30 (idempotent re-run OK)."
echo

if [[ "${CONFIRM:-}" != "1" ]]; then
  echo "Dry-run. To force delete attempt:"
  echo "  CONFIRM=1 bash scripts/d1-retire-cloudless-auth.sh"
  exit 0
fi

if pnpm exec wrangler d1 delete "$NAME" --force; then
  echo "✅ deleted D1 ${NAME}"
else
  echo "✅ D1 ${NAME} already absent (nothing to do)"
fi
