/**
 * Locale coverage sweep — public + auth pages across every configured locale.
 *
 * The existing sweep specs (`admin-pages-sweep`, `public-pages-deep`,
 * `homepage`, `blog`, `contact`, …) only exercise `/en/*`. `i18n.spec.ts`
 * confirms the homepage renders in `el`/`fr` but stops at `/`. That left
 * every locale-prefixed sub-route (`/el/blog`, `/de/services`, …) without
 * a smoke check, even though every translation key miss surfaces there
 * first — `next-intl` will throw a `MISSING_MESSAGE` and the page 5xx's.
 *
 * Strategy: take the same locale list that's authoritative in
 * `src/i18n/routing.ts` and walk every non-English locale through the
 * key public + auth pages. For each:
 *   - status < 500 (no missing-translation crash)
 *   - h1/h2/main visible (page actually rendered)
 *   - URL kept the locale prefix (middleware didn't lose it)
 *
 * Locales tested: el, fr, de. (en is already covered by the existing
 * sweeps — duplicating it here would add no signal.)
 */
import { test, expect } from "@playwright/test";

// MUST match src/i18n/routing.ts. Keep en out — covered elsewhere.
const NON_DEFAULT_LOCALES = ["el", "fr", "de"] as const;

// Locale-stripped paths that should render on every locale without
// requiring any backing service or auth.
const PUBLIC_PATHS = [
  "",                 // homepage (/el, /fr, /de)
  "/services",
  "/blog",
  "/case-studies",
  "/docs",
  "/contact",
  "/privacy",
  "/terms",
  "/cookies",
  "/refund",
  "/work",
  "/store",
] as const;

// Auth pages — same expectation: rendered with translations, no 5xx.
const AUTH_PATHS = [
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
] as const;

test.describe.configure({ mode: "serial" });
test.setTimeout(45_000);

for (const locale of NON_DEFAULT_LOCALES) {
  test.describe(`Locale: ${locale} — public pages`, () => {
    for (const path of PUBLIC_PATHS) {
      const url = `/${locale}${path}`;
      test(`${url} renders without missing-translation 5xx`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", e => errors.push(e.message));
        const r = await page.goto(url, { waitUntil: "domcontentloaded" });
        expect(r?.status() ?? 0).toBeLessThan(500);

        // Middleware must preserve the locale prefix. (A redirect to a
        // different locale's homepage would also be < 500 but is a
        // routing regression we want to catch.)
        expect(page.url()).toContain(`/${locale}`);

        // Page actually rendered — never trust a 200 alone.
        await expect(
          page.locator("h1, h2, main").first(),
        ).toBeVisible({ timeout: 20_000 });
      });
    }
  });

  test.describe(`Locale: ${locale} — auth pages`, () => {
    for (const path of AUTH_PATHS) {
      const url = `/${locale}${path}`;
      test(`${url} renders without missing-translation 5xx`, async ({ page }) => {
        const r = await page.goto(url, { waitUntil: "domcontentloaded" });
        expect(r?.status() ?? 0).toBeLessThan(500);
        expect(page.url()).toContain(`/${locale}`);
        await expect(
          page.locator("h1, h2, main, form, [role=\"form\"]").first(),
        ).toBeVisible({ timeout: 20_000 });
      });
    }
  });
}

test.describe("Locale switcher behaviour", () => {
  test("navigating between locales preserves the path", async ({ page }) => {
    // Land on the English services page, then jump to Greek services.
    // The Greek page must keep the `/services` path and stay on /el.
    await page.goto("/en/services", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1, main").first()).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/el/services", { waitUntil: "domcontentloaded" });
    expect(page.url()).toMatch(/\/el\/services\/?$/);
    await expect(page.locator("h1, main").first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
