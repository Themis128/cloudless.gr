#!/usr/bin/env bash
# Run E2E tests in small chunks to avoid overwhelming the dev server.
# Splits the 80+ spec files into logical groups so each run is small.
#
# Usage:
#   bash scripts/e2e-chunked.sh api       # API route tests only
#   bash scripts/e2e-chunked.sh pages     # Public page tests only
#   bash scripts/e2e-chunked.sh auth      # Auth + security tests only
#   bash scripts/e2e-chunked.sh journey   # User journeys only
#   bash scripts/e2e-chunked.sh admin     # Admin panel tests only
#   bash scripts/e2e-chunked.sh list      # List all available chunks
#   bash scripts/e2e-chunked.sh all       # Run every chunk sequentially

set -euo pipefail
cd "$(dirname "$0")/.."

# ─── Chunk definitions ────────────────────────────────────────────────────────
# Each chunk is a small, focused group of spec files that can run in
# under ~2 minutes with 2 workers, without starving the dev server of
# memory or triggering per-route timeouts.

declare -A CHUNKS

CHUNKS[api]="
  e2e/api-routes.spec.ts
  e2e/api-routes-extra-gaps.spec.ts
  e2e/api-routes-gaps-sweep.spec.ts
  e2e/api-all-routes.spec.ts
  e2e/api-auth.spec.ts
  e2e/public-api-deep.spec.ts
  e2e/public-api-sweep.spec.ts
  e2e/health.spec.ts
"

CHUNKS[pages]="
  e2e/homepage.spec.ts
  e2e/public-pages-deep.spec.ts
  e2e/public-pages-audit.spec.ts
  e2e/locale-pages-sweep.spec.ts
  e2e/i18n.spec.ts
  e2e/i18n-not-found.spec.ts
  e2e/route-audit.spec.ts
  e2e/blog.spec.ts
  e2e/dynamic-detail-pages.spec.ts
  e2e/app-fullstack.spec.ts
"

CHUNKS[auth]="
  e2e/auth.spec.ts
  e2e/auth-security.spec.ts
  e2e/register-user-flow.spec.ts
  e2e/security-headers.spec.ts
  e2e/encryption-compression.spec.ts
"

CHUNKS[journey]="
  e2e/journey-contact-lead.spec.ts
  e2e/journey-blog-nav.spec.ts
  e2e/journey-store-checkout.spec.ts
  e2e/journey-theme-locale.spec.ts
  e2e/journey-admin-tour.spec.ts
  e2e/customer-behavior.spec.ts
  e2e/customer-journey.spec.ts
  e2e/dashboard-authenticated-journey.spec.ts
  e2e/contact.spec.ts
  e2e/contact-integrations.spec.ts
  e2e/form-submission-flows.spec.ts
  e2e/theme-switcher.spec.ts
  e2e/cookie-consent-flow.spec.ts
"

CHUNKS[admin]="
  e2e/admin.spec.ts
  e2e/admin-api-deep.spec.ts
  e2e/admin-api-sweep.spec.ts
  e2e/admin-pages-deep.spec.ts
  e2e/admin-pages-sweep.spec.ts
  e2e/admin-pages-gaps-sweep.spec.ts
  e2e/admin-ops-baseline-deep.spec.ts
  e2e/admin-workspaces.spec.ts
  e2e/admin-cms.spec.ts
  e2e/admin-client-portals.spec.ts
  e2e/admin-crm-api.spec.ts
  e2e/admin-appflowy-cms-api.spec.ts
"

# ─── UI / component / accessibility ─────────────────────────────────────────────
CHUNKS[ui]="
  e2e/accessibility.spec.ts
  e2e/accessibility-admin-gaps.spec.ts
  e2e/components.spec.ts
  e2e/mobile-responsive.spec.ts
  e2e/style.spec.ts
  e2e/theme-switcher.spec.ts
"

# ─── Dashboard / user areas ─────────────────────────────────────────────────────
CHUNKS[dashboard]="
  e2e/dashboard.spec.ts
  e2e/dashboard-deep.spec.ts
  e2e/dashboard-gaps-sweep.spec.ts
  e2e/fullstack-frontend-backend.spec.ts
  e2e/store-checkout-edges.spec.ts
  e2e/campaigns-shop-online.spec.ts
"

# ─── Infrastructure / cloudflare / external services ─────────────────────────────
CHUNKS[infra]="
  e2e/infrastructure.spec.ts
  e2e/cloudflare-infrastructure.spec.ts
  e2e/cloudflare-migration-complete.spec.ts
  e2e/fly-proxy.spec.ts
  e2e/integrations-contracts.spec.ts
  e2e/webhook-signatures.spec.ts
  e2e/workflows.spec.ts
  e2e/test-mcp-servers.spec.ts
  e2e/github-agentic-workflows.spec.ts
"

# ─── Performance / deep coverage ─────────────────────────────────────────────────
CHUNKS[quality]="
  e2e/performance.spec.ts
  e2e/performance-budgets.spec.ts
  e2e/pwa-manifest.spec.ts
  e2e/post-audit-coverage.spec.ts
  e2e/remaining-coverage-deep.spec.ts
  e2e/coverage.spec.ts
"

# ─── Content / CMS / cron ────────────────────────────────────────────────────────
CHUNKS[content]="
  e2e/chat.spec.ts
  e2e/cron-deep.spec.ts
  e2e/notion-cms.spec.ts
  e2e/appflowy-cms.spec.ts
"

CHUNK_ORDER=(api pages auth journey admin ui dashboard infra quality content)

# ─── Helpers ───────────────────────────────────────────────────────────────────
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

  # Count actual spec files
  local count
  count=$(echo "$files" | grep -c "\.spec\.ts" || true)

  echo "==> Running chunk [$name] — $count files (workers=2)"
  echo "    Cleaning old artifacts for this chunk..."

  # Clean up old test results before the run to keep disk usage small
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

# ─── Main ──────────────────────────────────────────────────────────────────────
MODE="${1:-list}"

case "$MODE" in
  list)
    list_chunks
    ;;

  all)
    echo "==> Running all chunks sequentially..."
    for name in "${CHUNK_ORDER[@]}"; do
      run_chunk "$name"
    done
    echo "🎉 All chunks passed!"
    ;;

  *)
    run_chunk "$MODE"
    ;;
esac