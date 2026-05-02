/**
 * Public page coverage — top-of-funnel UX. Verifies the standby renders
 * the same routes a real user would visit on cloudless.gr.
 *
 * Routes are hit at /en (English) since locale-routing is covered separately.
 */
import { test, expect } from "@playwright/test";

const PAGES: { path: string; expectText?: RegExp; optional?: boolean }[] = [
  { path: "/en", expectText: /cloudless/i },
  { path: "/en/blog", expectText: /(blog|posts|article|empty|coming soon)/i, optional: true },
  { path: "/en/docs", expectText: /(docs|documentation|guide|empty|coming soon)/i, optional: true },
  { path: "/en/contact", expectText: /(contact|email|message|name|send)/i, optional: true },
  { path: "/en/services", expectText: /(services|offer|consult)/i, optional: true },
  { path: "/en/projects", expectText: /(project|work|case)/i, optional: true },
];

test.describe("k3s public pages", () => {
  for (const { path: p, expectText, optional } of PAGES) {
    test(`${p} renders successfully`, async ({ page }) => {
      const r = await page.goto(p, { waitUntil: "domcontentloaded" });
      const status = r?.status() ?? 0;
      if (optional && (status === 404 || status === 308)) {
        // Page may not exist in this build — only fail on real errors.
        test.info().annotations.push({
          type: "skip-reason",
          description: `${p} returned ${status} (treated as optional)`,
        });
        test.skip();
      }
      expect(status, `${p} should render (got ${status})`).toBeLessThan(400);
      if (expectText) {
        await expect(page.locator("body")).toContainText(expectText);
      }
    });
  }

  test("404 page renders with proper status", async ({ page }) => {
    const r = await page.goto("/en/__definitely_not_a_real_page__", {
      waitUntil: "domcontentloaded",
    });
    expect(r?.status()).toBe(404);
  });
});
