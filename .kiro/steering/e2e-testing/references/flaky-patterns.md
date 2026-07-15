# Flaky Test Patterns & Mitigations

## 1. Rate-limit test on cloudless.gr (Lambda/CloudFront)

**Test**: `post-audit-coverage.spec.ts` — "4th rapid same-IP submission is rejected"

**Root cause**: The rate limiter is per-container (in-memory). CloudFront can route 4 rapid
requests to different Lambda containers, each with an empty bucket. Result: all 4 return 200
instead of triggering a 429.

**Mitigation**: `retries: 2` in the production config. On retry, a warm Lambda container
that already handled the first-attempt requests will likely handle all 4. Usually passes by retry #1.

**Not fixable** without a shared rate-limit store (Redis/DynamoDB) — the current architecture
intentionally uses in-process limits for Lambda cold-start simplicity.

---

## 2. Notion CMS `/docs` networkidle timeout on mobile (pi-origin.cloudless.gr)

**Test**: `notion-cms.spec.ts` — "renders the docs header and search input"

**Root cause**: `waitForLoadState("networkidle")` waits for all network activity to stop.
On pi-origin.cloudless.gr (Pi k3s), mobile throttle profile + active Notion polling
can keep network active beyond the 60s test timeout.

**Mitigation**: `retries: 2`. If the Notion client has already cached data, the second attempt
loads faster. Consider replacing `networkidle` with `domcontentloaded` + explicit `toBeVisible`
timeouts if this continues to flake.

---

## 3. Nav link clicks timing out after i18n redirect

**Test**: `customer-behavior.spec.ts` — nav navigation tests

**Root cause**: Going to `/` triggers a redirect to `/en` (or locale-detected path). The navbar
re-renders after redirect completes. Clicking a nav link immediately after `goto("/")` can
click before the hydrated link is interactive.

**Fix**: `await page.waitForLoadState("networkidle")` before clicking nav links.

---

## 4. Blog link regex missing digit-leading slugs

**Test**: `customer-behavior.spec.ts` — "lists at least one post card linking to /blog/\[slug\]"

**Root cause**: Original regex `/\/blog\/[a-z]/` required the slug to start with a letter.
Production slugs can start with digits or be absolute URLs with locale prefix.

**Fix**: Use `/\/blog\/.+/` with exclusion of the blog index: `!/\/blog\/?$/.test(href)`.

---

## 5. Store breadcrumb missing on mobile

**Test**: `customer-behavior.spec.ts` — "product page shows breadcrumb"

**Root cause**: The breadcrumb component uses `hidden lg:flex` — it's not in the DOM on mobile,
so `toBeVisible()` fails.

**Fix**: `test.skip(!!isMobile, "Breadcrumbs only render on desktop")`.

---

## 6. Contact form valid submission getting 429 in production

**Test**: `customer-behavior.spec.ts` — `@mutating` test (skipped in production config)

**Root cause**: When running locally the rate limiter isn't shared between test workers;
on production multiple workers from the same machine can exhaust the per-IP bucket.

**Fix**: Test is tagged `@mutating` and excluded from the production config via `grep`.
The `@mutating` tag is the correct long-term solution — don't remove it.

---

## General Mitigations Applied

| Problem class | Solution |
|--------------|---------|
| Network latency on pi-origin.cloudless.gr | `timeout: 60_000` in production config |
| Parallel test workers sharing rate-limit bucket | Accept `[400, 429]` in validation tests |
| Lambda cold starts / multi-instance rate limiting | `retries: 2` in production config |
| Mobile-only failures on desktop-only elements | `test.skip(!!isMobile, ...)` |
| Hydration race conditions | `waitForLoadState("networkidle")` before interactions |
| CDN vs API handler content drift | Normalize before comparing (e.g. dash variants) |
