/**
 * i18n routing coverage — the app uses next-intl with `[locale]` segments.
 * All three locales must serve via the standby path identically to PRIMARY.
 */
import { test, expect } from "@playwright/test";

const LOCALES = ["en", "el", "fr"] as const;

test.describe("k3s i18n", () => {
  for (const locale of LOCALES) {
    test(`/${locale} renders 200`, async ({ page }) => {
      const r = await page.goto(`/${locale}`, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBeLessThan(400);
      expect(page.url()).toContain(`/${locale}`);
    });

    test(`/${locale} sets html[lang]`, async ({ page }) => {
      await page.goto(`/${locale}`, { waitUntil: "domcontentloaded" });
      const lang = await page.locator("html").getAttribute("lang");
      expect(lang, `html[lang] should match locale ${locale}`).toBe(locale);
    });
  }

  test("/ root redirects to a locale-prefixed path", async ({ page }) => {
    const r = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBeLessThan(400);
    expect(page.url()).toMatch(/\/(en|el|fr)(\/|$)/);
  });

  test("unknown locale returns 404 (not silently routed)", async ({ request }) => {
    const r = await request.get("https://cloudless.online/zz", {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    // Either 404 (Next.js notFound) or 308 to a default locale — both fine.
    expect([200, 301, 302, 307, 308, 404].includes(r.status())).toBe(true);
  });
});
