#!/usr/bin/env bash
# Re-run the fragile e2e/deep specs (auth, i18n/mobile nav, cart, a11y, contact).
# Playwright starts its own server on 4010 (.next-e2e) — do not reuse :4000.
#
# Usage: bash scripts/e2e-deep-triage.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"

echo "==> instrumentation Edge doctor"
node scripts/instrumentation-edge-doctor.mjs

echo "==> Playwright deep triage (workers=2)"
pnpm exec playwright test --workers=2 --reporter=line \
  e2e/deep/auth-lifecycle.spec.ts \
  e2e/deep/i18n-nav.spec.ts \
  e2e/deep/store-cart-checkout.spec.ts \
  e2e/deep/mobile-chrome.spec.ts \
  e2e/deep/a11y.spec.ts \
  e2e/deep/contact-subscribe.spec.ts
