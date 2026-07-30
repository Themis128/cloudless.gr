#!/usr/bin/env bash
# d1-retire-cloudless-auth.sh — delete the orphaned empty D1 database cloudless-auth.
#
# cloudless-auth (0c00f32c-…) is not bound in wrangler.jsonc. Active auth DBs are
# user-auth-db + auth-db-preview. Cognito Hosted UI still uses the *name*
# "cloudless-auth" in sst.config.ts — that is unrelated AWS naming.
#
# Usage:
#   bash scripts/d1-retire-cloudless-auth.sh          # dry-run
#   CONFIRM=1 bash scripts/d1-retire-cloudless-auth.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="cloudless-auth"

cd "$ROOT"

echo "Orphan D1 candidate: ${NAME}"
echo "Active D1 (keep): user-auth-db, auth-db-preview"
echo

if [[ "${CONFIRM:-}" != "1" ]]; then
  echo "Dry-run. To delete:"
  echo "  CONFIRM=1 bash scripts/d1-retire-cloudless-auth.sh"
  echo
  echo "Equivalent:"
  echo "  pnpm exec wrangler d1 delete ${NAME} --force"
  exit 0
fi

pnpm exec wrangler d1 delete "$NAME" --force
echo "✅ deleted D1 ${NAME} (if it still existed)"
