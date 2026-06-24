#!/usr/bin/env bash
set -euo pipefail

manifest="${1:-k8s/search/meilisearch.yaml}"

ok=0
fail=0
warn=0

pass() {
  printf '✅ %s\n' "$*"
  ok=$((ok+1))
}

missing() {
  printf '❌ %s\n' "$*"
  fail=$((fail+1))
}

warning() {
  printf '⚠️  %s\n' "$*"
  warn=$((warn+1))
}

contains() {
  local file="$1"
  local text="$2"
  [[ -f "$file" ]] && grep -qF "$text" "$file"
}

contains_re() {
  local file="$1"
  local pattern="$2"
  [[ -f "$file" ]] && grep -qEi "$pattern" "$file"
}

echo "== R21I Meilisearch k3s storage check =="
echo "Manifest: $manifest"
echo

[[ -f "$manifest" ]] \
  && pass "Meilisearch manifest exists" \
  || missing "Meilisearch manifest missing: $manifest"

if [[ -f "$manifest" ]]; then
  contains_re "$manifest" 'kind:[[:space:]]*PersistentVolumeClaim|persistentVolumeClaim|claimName:' \
    && pass "Manifest defines or uses persistent volume claim" \
    || missing "Manifest does not define/use a PVC"

  contains_re "$manifest" 'meili|meilisearch' \
    && pass "Manifest references Meilisearch" \
    || missing "Manifest does not reference Meilisearch"

  contains_re "$manifest" '/meili_data|MEILI_DB_PATH|data.ms|/data' \
    && pass "Manifest references Meilisearch data path" \
    || warning "Could not confirm Meilisearch data path"

  contains "$manifest" 'cloudless.gr/storage-node: OMV-MAIN' \
    && pass "Manifest labels storage node as OMV-MAIN" \
    || missing "Manifest missing cloudless.gr/storage-node: OMV-MAIN"

  contains "$manifest" 'cloudless.gr/storage-tier: dedicated-ssd' \
    && pass "Manifest labels storage tier as dedicated SSD" \
    || missing "Manifest missing dedicated SSD storage label"

  contains "$manifest" 'dedicated 120GB SSD on OMV-MAIN' \
    && pass "Manifest documents the 120GB SSD storage requirement" \
    || missing "Manifest missing 120GB SSD storage annotation"

  contains_re "$manifest" 'nodeSelector|nodeAffinity|affinity|kubernetes.io/hostname' \
    && pass "Manifest constrains storage/workload placement" \
    || warning "No node placement constraint found"

  contains_re "$manifest" 'emptyDir:' \
    && missing "Manifest uses emptyDir for Meilisearch data" \
    || pass "Manifest does not use emptyDir for Meilisearch data"
fi

echo
printf 'Summary: %s passed, %s warnings, %s failures\n' "$ok" "$warn" "$fail"

[[ "$fail" -eq 0 ]]
