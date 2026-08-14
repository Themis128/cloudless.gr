# E2E Tests — cloudless.gr

Local Playwright coverage lives in `e2e/deep/`. Those specs exercise real
user and API paths (auth, store/cart, contact contracts, i18n, admin auth,
webhooks, CMS) instead of sweeping every route for “status < 600”.

Live-cluster checks stay in `e2e/k3s/` and use `playwright.k3s.config.mts`.

## Run

```bash
# Deep suite against pnpm dev on :4000 (Playwright starts it)
pnpm exec playwright test --project=chromium --workers=2

# Smoke subset
bash scripts/e2e-smart-run.sh smoke

# k3s / production
bash scripts/e2e-smart-run.sh k3s
pnpm exec playwright test --config=playwright.production.config.mts
```

Do not reuse a foreign `pnpm dev` on port 4000 unless it was started with
`NEXT_PUBLIC_E2E=1`, `E2E_ADMIN_TOKEN`, and `E2E_STRICT_RATE_LIMIT`.

Tests tagged `@mutating` POST to contact/subscribe; production config skips them.
