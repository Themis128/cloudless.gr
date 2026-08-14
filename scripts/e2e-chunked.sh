#!/usr/bin/env bash
# Run the deep Playwright suite in small chunks so the dev server stays healthy.
#
# Usage:
#   bash scripts/e2e-chunked.sh api
#   bash scripts/e2e-chunked.sh all
#   bash scripts/e2e-chunked.sh list

set -euo pipefail
cd "$(dirname "$0")/.."

declare -A CHUNKS

CHUNKS[api]="
  e2e/deep/public-api-contracts.spec.ts
  e2e/deep/health-routing.spec.ts
  e2e/deep/security.spec.ts
"

CHUNKS[pages]="
  e2e/deep/i18n-nav.spec.ts
  e2e/deep/cms-campaigns.spec.ts
"

CHUNKS[auth]="
  e2e/deep/auth-lifecycle.spec.ts
  e2e/deep/protected-routes.spec.ts
"

CHUNKS[journey]="
  e2e/deep/store-cart-checkout.spec.ts
  e2e/deep/contact-subscribe.spec.ts
"

CHUNKS[admin]="
  e2e/deep/admin-surface.spec.ts
"

CHUNKS[ui]="
  e2e/deep/a11y.spec.ts
"

CHUNK_ORDER=(api pages auth journey admin ui)

list_chunks() {
  echo "Available chunks:"
  for name in "${CHUNK_ORDER[@]}"; do
    count=$(echo "${CHUNKS[$name]}" | grep -c "\.spec\.ts" || true)
    printf "  %-10s %d files\n" "$name" "$count"
  done
}

run_chunk() {
  local name="$1"
  local files="${CHUNKS[$name]:-}"

  if [ -z "$files" ]; then
    echo "✗ Unknown chunk: $name"
    list_chunks
    exit 1
  fi

  local count
  count=$(echo "$files" | grep -c "\.spec\.ts" || true)

  echo "==> Running chunk [$name] — $count files (workers=2)"
  if [ -d "test-results" ]; then
    rm -rf test-results
  fi

  # shellcheck disable=SC2086
  pnpm exec playwright test \
    $files \
    --project=chromium \
    --workers=2 \
    --reporter=line

  echo "✅ Chunk [$name] passed"
}

MODE="${1:-list}"

case "$MODE" in
  list)
    list_chunks
    ;;
  all)
    echo "==> Running all deep chunks sequentially..."
    for name in "${CHUNK_ORDER[@]}"; do
      run_chunk "$name"
    done
    echo "All chunks passed."
    ;;
  *)
    run_chunk "$MODE"
    ;;
esac
