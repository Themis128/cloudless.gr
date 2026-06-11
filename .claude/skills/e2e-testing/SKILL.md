---
name: e2e-testing
description: End-to-end Playwright testing suite for cloudless.gr. Use this skill whenever the user asks about running tests, adding tests, fixing test failures, understanding test coverage, configuring Playwright, running production smoke tests against cloudless.gr or pi-origin.cloudless.gr, or anything about the e2e/ directory. Triggers on "run tests", "playwright", "test failing", "smoke test", "add coverage", "e2e", "production tests", "test suite".
---

# E2E Testing — cloudless.gr

## Overview

Playwright test suite covering the full cloudless.gr surface: public pages, API routes, auth, store, admin panel, i18n, PWA manifest, security headers, accessibility, infrastructure smoke tests, and k3s cluster health.

**Two configs:**

- `playwright.config.mts` — local dev (spins up `pnpm dev` on port 4000)
- `playwright.production.config.mts` — production smoke tests against live cloudless.gr + pi-origin.cloudless.gr

---

## Quick Commands

```bash
# Local dev — full suite
npx playwright test

# Local dev — specific file
npx playwright test e2e/customer-behavior.spec.ts

# Local dev — interactive UI
npx playwright test --ui

# Production — all 4 projects (cloudless.gr + pi-origin.cloudless.gr, desktop + mobile)
npx playwright test --config=playwright.production.config.mts

# Production — single project
npx playwright test --config=playwright.production.config.mts --project=cloudless-gr-desktop

# Production — single file
npx playwright test --config=playwright.production.config.mts e2e/customer-behavior.spec.ts

# Show last HTML report
npx playwright show-report
```

---

## Configs

### `playwright.config.mts` (local)

| Setting | Value |
|---------|-------|
| `baseURL` | `http://localhost:4000` |
| `testDir` | `e2e/` |
| `retries` | 2 (CI) / 1 (local) |
| `workers` | 1 (CI) / 6 (local) |
| `timeout` | 30 000 ms |
| `webServer` | `pnpm dev` — auto-started, reused if already running |
| Projects | `chromium` (Desktop Chrome), `mobile-chrome` (Pixel 7) |

### `playwright.production.config.mts` (production smoke)

| Setting | Value |
|---------|-------|
| Projects | `cloudless-gr-desktop`, `cloudless-gr-mobile`, `pi-origin-desktop`, `pi-origin-mobile` |
| `baseURL` | `https://cloudless.gr` or `https://pi-origin.cloudless.gr` |
| `retries` | 2 |
| `workers` | 4 |
| `timeout` | 60 000 ms |
| `grep` | `/^(?!.*@mutating)/` — skips `@mutating` tests |
| `env.INFRA_SMOKE` | `"1"` — enables infrastructure tests |
| No `webServer` | Tests hit live production directly |

---

## Test File Map

| File | What it covers | Guard |
|------|---------------|-------|
| `accessibility.spec.ts` | ARIA roles, skip links, focus management | — |
| `admin.spec.ts` | Admin panel pages (orders, users, CRM, analytics) | `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` env vars required |
| `api-auth.spec.ts` | Auth API routes (sign-in, sign-up, session) | — |
| `api-routes.spec.ts` | Input validation for `/api/contact`, `/api/subscribe`, `/api/checkout`, `/api/health` | — |
| `auth.spec.ts` | Login page, forgot password, sign-up flows | — |
| `blog.spec.ts` | Blog listing, post rendering, search | — |
| `contact-integrations.spec.ts` | Contact form integration (HubSpot, SES) | — |
| `contact.spec.ts` | Contact page render, form fields, submission UI | — |
| `customer-behavior.spec.ts` | Full user journeys: nav, store, cart, blog, docs, legal | — |
| `customer-journey.spec.ts` | End-to-end checkout / purchase funnel | — |
| `dashboard.spec.ts` | Admin dashboard cards (analytics, SEO, CRM) | auth required |
| `encryption-compression.spec.ts` | API response compression, HTTPS enforcement | — |
| `fullstack-frontend-backend.spec.ts` | Full-stack integration: pages + API together | — |
| `health.spec.ts` | `/api/health` shape and freshness | — |
| `homepage.spec.ts` | Homepage headings, hero, CTAs | — |
| `i18n.spec.ts` | Locale routing, language switching, hreflang tags | — |
| `i18n-not-found.spec.ts` | 404 pages for each locale | — |
| `infrastructure.spec.ts` | CloudFront/CDN: HTTP 200, www redirect, HTTP/2, version | `INFRA_SMOKE=1` |
| `integrations-contracts.spec.ts` | External API contract shapes (HubSpot, Stripe) | — |
| `mobile-responsive.spec.ts` | Hamburger menu, mobile layout, tap targets | — |
| `notion-cms.spec.ts` | `/blog`, `/blog/[slug]`, `/docs` (Notion CMS + static fallback) | — |
| `performance.spec.ts` | Core Web Vitals proxies, image lazy-loading, script defer | — |
| `post-audit-coverage.spec.ts` | Rate-limiter cap (3/min), AVIF/WebP image optimizer, HubSpot gate | — |
| `pwa-manifest.spec.ts` | `/manifest.webmanifest`, `/api/pwa-manifest`, icons, shortcuts | — |
| `route-audit.spec.ts` | All public routes return non-500 | — |
| `security-headers.spec.ts` | CSP, HSTS, X-Frame-Options, Referrer-Policy | — |
| `theme-switcher.spec.ts` | Dark/light theme toggle persistence | — |
| `webhook-signatures.spec.ts` | Stripe + HubSpot webhook HMAC verification | — |

### `k3s/` subdirectory (Pi k3s cluster — pi-origin.cloudless.gr)

| File | What it covers |
|------|---------------|
| `smoke.spec.ts` | `/api/health`, security headers, app signature |
| `public-pages.spec.ts` | All public routes return non-500 (some marked `optional: true`) |
| `i18n-routes.spec.ts` | Locale prefixes, language switching |
| `api-routes.spec.ts` | Input validation (same contracts as main api-routes.spec.ts) |
| `assets.spec.ts` | Static assets (icons, fonts, OG images) reachable |
| `security-headers.spec.ts` | Security header presence on standby |
| `analytics.spec.ts` | DuckDB/Metabase analytics stack health |
| `cluster-services.spec.ts` | k3s namespace health, pod counts |
| `maintenance.spec.ts` | CronJob status, backup S3 sync recency |
| `standby-path.spec.ts` | Full failover path smoke (Cloudflare tunnel → Pi → k3s) |

---

## Key Patterns & Conventions

### `@mutating` tag

Tests that POST real data to production (contact form, subscribe) are tagged in the test name:

```typescript
test("valid submission passes validation @mutating", async ({ page }) => { … });
```

The production config's `grep: /^(?!.*@mutating)/` excludes these automatically. Never remove this tag from a test that creates real HubSpot contacts or SES emails.

### Mobile guard

Desktop-only UI elements (sticky navbar, breadcrumbs) are hidden below `lg` breakpoint. Guard them:

```typescript
test("desktop: breadcrumb shows category", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "Breadcrumbs only render on desktop");
  …
});
```

### `INFRA_SMOKE` guard

Infrastructure tests are expensive and hit external endpoints. They always skip unless `INFRA_SMOKE=1`:

```typescript
const runInfra = !!process.env.INFRA_SMOKE;
test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");
```

The production config sets `env: { INFRA_SMOKE: "1" }` globally.

### `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`

Admin tests check `Boolean(adminEmail && adminPassword)` and call `testInfo.skip()` if missing. These are never set in the production config (admin panel is not public). Set them manually to run admin tests:

```bash
E2E_ADMIN_EMAIL=admin@cloudless.gr E2E_ADMIN_PASSWORD=xxx npx playwright test e2e/admin.spec.ts
```

### Rate-limit awareness

The contact and subscribe API route validation tests accept `429` alongside `400` because:

- The per-IP rate limiter runs before schema validation
- On production, parallel test workers can share the same real IP through Cloudflare tunnel
- On cloudless.gr (Lambda), different CloudFront edge instances may route requests to different Lambda containers — each with an independent in-memory rate limiter bucket

```typescript
expect([400, 429]).toContain(res.status());
if (res.status() === 400) {
  const body = await res.json();
  expect(body.error).toMatch(/required/i);
}
```

### PWA manifest dash normalization

`/manifest.webmanifest` (static CDN file) uses a plain hyphen in the app name; `/api/pwa-manifest` (handler) may use an em dash. The byte-for-byte comparison test normalizes both before comparing:

```typescript
const normDash = (s?: string) => (s ?? "").replace(/[–—]/g, "-");
expect(normDash(a.name)).toBe(normDash(b.name));
```

---

## Helpers

### `e2e/helpers/test-helpers.ts`

- `loginAsUser(page, email, password, redirectPath)` — logs in via UI
- `logout(page)` — clicks logout
- Exported constants: `URL_PATHS`, `TEST_USERS`, `WAIT_TIMES`

### `e2e/fixtures/test-user.ts`

- `TEST_USERS` — fixture user credentials for auth tests
- `URL_PATHS` — all admin + public route paths
- `WAIT_TIMES` — named timeouts (e.g. `WAIT_TIMES.animation`)

### `e2e/k3s/_helpers.ts`

- `probeHealth(request)` — fetches `/api/health`, returns `{ status, body, headers }`
- `isHealthBody(body)` — validates health response shape
- `isLikelyAppResponse(headers)` — checks for Next.js response fingerprint

---

## Flaky Test Notes

See [flaky-patterns.md](references/flaky-patterns.md) for known flakiness root causes and mitigations.

---

## Adding a New Test

1. Choose the right file — add to an existing `describe` block if the page is already covered
2. New feature → new file, named `{feature}.spec.ts`
3. If the test POSTs real data: add `@mutating` to the test name
4. If the test is desktop-only: add `test.skip(!!isMobile, "reason")`
5. If the test requires infra access: add the `INFRA_SMOKE` guard
6. Keep assertions behavioral — test what a user would see, not internal implementation
