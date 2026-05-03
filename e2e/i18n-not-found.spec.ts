/**
 * 404 page localization.
 *
 * The not-found page used to hardcode messages inline and only covered
 * en/el/fr — a German user got the English fallback. After the fix in
 * 34784e50b, all four locales (en, el, fr, de) read translated strings
 * from src/locales/<locale>.json via translate().
 *
 * These tests pin that contract so a future refactor that drops a locale
 * can't silently regress to "German users see English."
 */

import { test, expect } from "@playwright/test";

const NONEXISTENT_PATH = "/this-page-does-not-exist-and-should-404";

interface LocaleCase {
  locale: string;
  expectInBody: string[]; // substrings that should appear (case-sensitive)
  expectNotInBody?: string[]; // substrings that must NOT appear (catch fallback-to-English)
}

// Pulled from src/locales/<locale>.json:notFound
const CASES: LocaleCase[] = [
  {
    locale: "en",
    expectInBody: ["Page not found", "Back to Home"],
  },
  {
    locale: "el",
    expectInBody: ["Η σελίδα δεν βρέθηκε", "Πίσω στην Αρχική"],
    expectNotInBody: ["Page not found"],
  },
  {
    locale: "fr",
    expectInBody: ["Page introuvable", "Retour à l'accueil"],
    expectNotInBody: ["Page not found"],
  },
  {
    locale: "de",
    expectInBody: ["Seite nicht gefunden", "Zurück zur Startseite"],
    // Critical: this used to leak through as English.
    expectNotInBody: ["Page not found"],
  },
];

test.describe("404 page localization", () => {
  for (const c of CASES) {
    test(`${c.locale} renders translated 404 strings`, async ({ page }) => {
      const response = await page.goto(`/${c.locale}${NONEXISTENT_PATH}`);
      // Next.js App Router serves the localized not-found.tsx with HTTP 404.
      expect(response?.status()).toBe(404);
      const body = await page.locator("body").innerText();
      for (const needle of c.expectInBody) {
        expect(body, `expected "${needle}" in ${c.locale} 404 body`).toContain(needle);
      }
      for (const banned of c.expectNotInBody ?? []) {
        expect(body, `${c.locale} should NOT fall back to English`).not.toContain(banned);
      }
    });
  }

  test("the 'Back to Home' CTA is a real internal link", async ({ page }) => {
    await page.goto(`/en${NONEXISTENT_PATH}`);
    const cta = page.locator("a", { hasText: "Back to Home" }).first();
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute("href");
    expect(href).toBeTruthy();
    // Resolves to the locale-prefixed homepage (next-intl Link prefixes locale).
    expect(href).toMatch(/^\/(en|\?|$)/);
  });
});
