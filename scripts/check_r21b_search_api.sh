#!/usr/bin/env bash
set -euo pipefail

ok=0
fail=0

pass() {
  printf '✅ %s\n' "$*"
  ok=$((ok + 1))
}

missing() {
  printf '❌ %s\n' "$*"
  fail=$((fail + 1))
}

contains() {
  local file="$1"
  local text="$2"
  [[ -f "$file" ]] && grep -qF "$text" "$file"
}

echo "== R21b /api/search + Bedrock embeddings check =="
echo

[[ -f src/lib/bedrock-embeddings.ts ]] && pass "Bedrock embedding helper exists" || missing "missing src/lib/bedrock-embeddings.ts"
[[ -f src/lib/meilisearch.ts ]] && pass "Meilisearch helper exists" || missing "missing src/lib/meilisearch.ts"
[[ -f src/lib/product-search.ts ]] && pass "product search/index helper exists" || missing "missing src/lib/product-search.ts"
[[ -f src/app/api/search/route.ts ]] && pass "/api/search route exists" || missing "missing src/app/api/search/route.ts"
[[ -f src/app/api/admin/search/reindex/route.ts ]] && pass "admin reindex route exists" || missing "missing admin reindex route"

contains src/lib/bedrock-embeddings.ts 'amazon.titan-embed-text-v2:0' \
  && pass "uses Titan Text Embeddings V2 model id" \
  || missing "missing Titan V2 model id"

contains src/lib/bedrock-embeddings.ts 'InvokeModelCommand' \
  && pass "uses Bedrock InvokeModelCommand" \
  || missing "missing Bedrock InvokeModelCommand"

contains src/lib/product-search.ts 'source: "userProvided"' \
  && pass "configures Meilisearch userProvided embedder" \
  || missing "missing userProvided embedder config"

contains src/lib/product-search.ts '_vectors' \
  && pass "indexes precomputed vectors into Meilisearch" \
  || missing "missing _vectors indexing"

contains src/lib/product-search.ts 'hybrid' \
  && pass "uses Meilisearch hybrid search" \
  || missing "missing hybrid search"

contains src/app/api/search/route.ts 'source: "fallback"' \
  && pass "has fallback search path" \
  || missing "missing fallback search path"

echo
printf 'Summary: %s passed, %s failures\n' "$ok" "$fail"
[[ "$fail" -eq 0 ]]
