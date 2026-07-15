#!/usr/bin/env bash
set -euo pipefail

ok=0
fail=0

pass() {
  printf '✅ %s\n' "$*"
  ok=$((ok+1))
}

missing() {
  printf '❌ %s\n' "$*"
  fail=$((fail+1))
}

contains() {
  local file="$1"
  local text="$2"
  [[ -f "$file" ]] && grep -qF "$text" "$file"
}

echo "== R21 search baseline check =="
echo

contains src/lib/meilisearch.ts 'MEILI_HOST' \
  && pass 'Meilisearch host env is referenced' \
  || missing 'src/lib/meilisearch.ts missing MEILI_HOST'

contains src/lib/meilisearch.ts 'MEILI_SEARCH_KEY' \
  && pass 'Meilisearch search key env is referenced' \
  || missing 'src/lib/meilisearch.ts missing MEILI_SEARCH_KEY'

contains src/lib/meilisearch.ts 'MEILI_ADMIN_KEY' \
  && pass 'Meilisearch admin key env is referenced' \
  || missing 'src/lib/meilisearch.ts missing MEILI_ADMIN_KEY'

contains src/lib/product-search.ts 'amazon.titan-embed-text-v2:0' \
  && pass 'Titan embedding model is referenced in product search metadata' \
  || missing 'src/lib/product-search.ts missing Titan embedding metadata'

contains src/app/api/search/route.ts 'source: "fallback"' \
  && pass '/api/search has fallback source path' \
  || missing '/api/search fallback source path missing'

contains src/app/api/admin/search/reindex/route.ts 'x-cron-secret' \
  && pass 'admin reindex supports x-cron-secret' \
  || missing 'admin reindex missing x-cron-secret'

contains src/app/api/admin/search/reindex/route.ts 'x-admin-secret' \
  && pass 'admin reindex supports x-admin-secret' \
  || missing 'admin reindex missing x-admin-secret'

echo
printf 'Summary: %s passed, %s failures\n' "$ok" "$fail"

[[ "$fail" -eq 0 ]]
