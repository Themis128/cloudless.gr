#!/usr/bin/env bash
# Run E2E tests with safe defaults — avoids the dev-server-OOM cascade.
#
# Usage:
#   bash scripts/e2e-smart-run.sh smoke      # quick API + homepage (~30s)
#   bash scripts/e2e-smart-run.sh full       # all tests, workers=2 (~5 min)
#   bash scripts/e2e-smart-run.sh k3s        # against live cluster
#   bash scripts/e2e-smart-run.sh prod       # against cloudless.gr

set -euo pipefail
cd "$(dirname "$0")/.."

MODE=${1:-smoke}

case "$MODE" in
  smoke)
    echo "==> Warming dev server..."
    curl -s -o /dev/null --max-time 10 http://localhost:4000/en || true
    curl -s -o /dev/null --max-time 5 http://localhost:4000/api/health || true

    echo "==> Running smoke set (API + homepage + security headers)..."
    pnpm exec playwright test \
      e2e/api-routes.spec.ts \
      e2e/api-auth.spec.ts \
      e2e/homepage.spec.ts \
      e2e/security-headers.spec.ts \
      --project=chromium \
      --workers=2 \
      --reporter=line
    ;;

  full)
    echo "==> Verifying dev server is healthy..."
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:4000/api/health)
    if [[ "$code" != "200" ]]; then
      echo "✗ Dev server returns $code on /api/health. Run dev-server-restart.sh first."
      exit 1
    fi

    echo "==> Warming up routes..."
    for r in /en /en/services /en/contact /en/blog /api/health /api/auth/session; do
      curl -s -o /dev/null --max-time 10 "http://localhost:4000${r}" || true
    done

    echo "==> Running full suite (workers=2 to avoid Turbopack overload)..."
    pnpm exec playwright test \
      --project=chromium \
      --workers=2 \
      --reporter=line
    ;;

  k3s)
    echo "==> Running k3s standby E2E (live Pi cluster)..."
    pnpm exec playwright test --config=playwright.k3s.config.mts --reporter=line
    ;;

  k3s-smoke)
    echo "==> Running k3s smoke (just the basics)..."
    pnpm exec playwright test \
      --config=playwright.k3s.config.mts \
      e2e/k3s/smoke.spec.ts \
      --reporter=line
    ;;

  prod)
    echo "==> Running production smoke (cloudless.gr)..."
    pnpm exec playwright test --config=playwright.production.config.mts --reporter=line
    ;;

  *)
    echo "Usage: $0 {smoke|full|k3s|k3s-smoke|prod}"
    exit 1
    ;;
esac
