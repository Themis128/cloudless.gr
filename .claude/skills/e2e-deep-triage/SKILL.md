---
name: e2e-deep-triage
description: Diagnose and re-run cloudless.gr Playwright e2e/deep failures (mobile hamburger, html lang, cart drawer, auth alerts, contact 429). Use when Playwright fails, mobile-chrome flakes, locale switcher leaves lang=en, cart click is intercepted, getByRole('alert') is strict-mode, or the user asks to fix e2e / Playwright / deep suite.
---

# E2E deep triage (Playwright)

Live suite is **`e2e/deep/`** (+ `e2e/k3s/**` via `playwright.k3s.config.mts` only). Deleted files (`customer-behavior.spec.ts`, `e2e/journeys/**`, `e2e/ui/**`) are not the source of truth.

Local Playwright uses **port 4010** and `.next-e2e` so it does not fight interactive `pnpm dev` on :4000 (`e2e/_port.ts`). `reuseExistingServer` is **false**.

## Tool

```bash
pnpm e2e:deep-triage
```

Runs `scripts/e2e-deep-triage.sh` — instrumentation doctor, then the fragile deep specs (chromium + mobile-chrome, workers=2).

## Failure → fix map

| Symptom | Cause | Fix |
| --- | --- | --- |
| `getByRole('alert')` strict mode (2 elements) | Next.js `#__next-route-announcer__` also has `role="alert"` | Assert `getByTestId("auth-error")`, never bare `getByRole("alert")` |
| `html lang` stays `en` after `/el/...` | Root layout does not re-render on client locale switch | `HtmlLangSync` + `localeFromPathname()` from `next/navigation` pathname |
| Nav click stays on previous page (mobile) | `.first()` hits **hidden desktop** `lg:flex` link | Open `data-testid="mobile-menu"`; click `.filter({ visible: true })` inside the drawer. Helper: `e2e/helpers/mobile-nav.ts` |
| Hamburger `aria-expanded` stays `false` | Closed drawer used `opacity-0`/`max-h-0` instead of `hidden` | `hidden={!mobileOpen}` + `inert`; retry click (see helper) |
| `Open cart` click intercepted by cart header | Store grid opens the drawer; overlay is `z-50` | Header `z-60`; CartButton `aria-label` Open/Close from `isOpen` |
| Contact POST `429` not in allow-list | 5/10min rate limit, `E2E_STRICT_RATE_LIMIT=1` | Accept 429 (or 200/403/503) — do not disable the limiter |
| Pages 404 / `#email` missing / `main` missing | Dev server unhealthy (instrumentation Edge 500) | Run `pnpm instrumentation:doctor` first; do not widen timeouts |

## Mobile rules (from Playwright community skills)

- [currents-dev/playwright-best-practices-skill mobile](https://github.com/currents-dev/playwright-best-practices-skill/blob/HEAD/advanced/mobile-testing.md): hamburger vs desktop nav by viewport.
- [testdino-hq/playwright-skill mobile](https://github.com/testdino-hq/playwright-skill/blob/main/core/mobile-and-responsive.md): `isMobile` → open menu, then click links **inside the open panel**.
- Never `waitForTimeout`. Wait on `aria-expanded="true"` + `getByTestId("mobile-menu")`.

## Commands

```bash
pnpm exec playwright test --workers=2 --project=chromium e2e/deep/auth-lifecycle.spec.ts
pnpm exec playwright test --workers=2 e2e/deep/i18n-nav.spec.ts e2e/deep/mobile-chrome.spec.ts
```

Do not fix failures by mocking production. Fix the app (or the locator). k3s specs never run against localhost.
