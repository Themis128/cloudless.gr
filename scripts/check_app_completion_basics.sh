#!/usr/bin/env bash
set -euo pipefail

ok=0
missing_count=0

pass() {
  printf '✅ %s\n' "$*"
  ok=$((ok+1))
}

missing() {
  printf '❌ %s\n' "$*"
  missing_count=$((missing_count+1))
}

exists() {
  [[ -e "$1" ]]
}

contains() {
  local file="$1"
  local text="$2"
  [[ -f "$file" ]] && grep -qF "$text" "$file"
}

echo "== cloudless.gr app completion basics =="
echo

if bash scripts/check_r14_sentry_env_tagging.sh >/dev/null 2>&1; then
  pass "R14 Sentry environment tagging"
else
  missing "R14 Sentry environment tagging"
fi

if bash scripts/check_r21_search_baseline.sh >/dev/null 2>&1; then
  pass "R21 search baseline"
else
  missing "R21 search baseline"
fi

if bash scripts/check_r21_meilisearch_k3s_storage.sh >/dev/null 2>&1; then
  pass "R21 Meilisearch k3s storage contract"
else
  missing "R21 Meilisearch k3s storage contract"
fi

if exists "src/lib/product-recommendations.ts"; then
  pass "R21 product recommendations helper"
else
  missing "R21 product recommendations helper"
fi

if exists "src/app/api/products/recommendations/route.ts"; then
  pass "R21 product recommendations API"
else
  missing "R21 product recommendations API"
fi

if contains "src/app/[locale]/store/[id]/page.tsx" "recommendProductsForProduct"; then
  pass "R21 product page recommendations"
else
  missing "R21 product page recommendations"
fi

if exists "src/lib/product-recommendation-signals.ts"; then
  pass "R21 co-purchase signal helper"
else
  missing "R21 co-purchase signal helper"
fi

if grep -R "coPurchaseScore\|ProductOrderSignal" -n src/lib/product-recommendations.ts __tests__/product-recommendations.test.ts >/dev/null 2>&1; then
  pass "R21 co-purchase recommendation boost"
else
  missing "R21 co-purchase recommendation boost"
fi

if grep -R "event.id\|idempot\|dedup" -n src/app/api/webhooks/stripe src/lib __tests__ >/dev/null 2>&1; then
  pass "R22 Stripe idempotency evidence"
else
  missing "R22 Stripe idempotency evidence"
fi

if find k8s infrastructure scripts -type f 2>/dev/null | grep -Ei "espo|mariadb|mysql" | grep -Ei "backup|s3" >/dev/null 2>&1; then
  pass "R13 EspoCRM backup evidence"
else
  missing "R13 EspoCRM backup evidence"
fi

if grep -R "SSM_PREFIX\|aws ssm\|get-parameter" -n src scripts infrastructure k8s .github >/dev/null 2>&1; then
  pass "R18 SSM usage evidence"
else
  missing "R18 SSM usage evidence"
fi

echo
printf 'Summary: %s passed, %s missing\n' "$ok" "$missing_count"

[[ "$missing_count" -eq 0 ]]
