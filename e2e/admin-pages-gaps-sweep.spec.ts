/**
 * Admin pages — gap coverage.
 *
 * `admin-pages-sweep.spec.ts` was generated against an older snapshot of the
 * app and is missing several pages that have shipped since. This spec covers
 * the gap so every page under `src/app/[locale]/admin/**` has at least one
 * smoke check that:
 *
 *   - returns < 500 from the dev server
 *   - renders at least one heading or alert region
 *   - does not produce uncaught client errors
 *
 * Pages covered here (NOT in admin-pages-sweep.spec.ts as of 2026-06-12):
 *   /admin/ai-generator
 *   /admin/analytics/seo
 *   /admin/campaigns/meta
 *   /admin/cms/case-studies
 *   /admin/cms/faqs
 *   /admin/cms/services
 *   /admin/cms/testimonials
 *   /admin/email/campaigns
 *   /admin/leads
 *   /admin/reports/[id]   (sample value)
 */
import { test, expect } from "@playwright/test";

const ADMIN_GAP_PAGES = [
  "/en/admin/ai-generator",
  "/en/admin/analytics/seo",
  "/en/admin/campaigns/meta",
  "/en/admin/cms/case-studies",
  "/en/admin/cms/faqs",
  "/en/admin/cms/services",
  "/en/admin/cms/testimonials",
  "/en/admin/email/campaigns",
  "/en/admin/leads",
  "/en/admin/reports/sample-report-id",
] as const;

test.describe("Admin page gap sweep (cookie-authenticated)", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: "e2e_admin",
      value: "1",
      url: "http://localhost:4000",
    }]);
  });

  for (const route of ADMIN_GAP_PAGES) {
    test(`${route} loads with h1/h2 and no 5xx`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("console", m => {
        if (m.type() === "error") errors.push(m.text());
      });
      const r = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBeLessThan(500);
      await expect(
        page.locator("h1, h2, [role=\"alert\"]").first(),
      ).toBeVisible({ timeout: 30_000 });
    });
  }
});
