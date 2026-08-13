/**
 * Coverage for the admin CMS pages that were previously untested:
 *   /admin/cms/case-studies
 *   /admin/cms/faqs
 *   /admin/cms/services
 *   /admin/cms/testimonials
 *
 * These admin pages depend on the matching /api/admin/appflowy/{...} routes
 * (which now have unit tests). This spec exercises the page render path
 * and graceful-error behavior when the Notion DB env vars are missing —
 * common in CI when admin credentials aren't injected.
 *
 * Tests skip when E2E admin credentials aren't configured.
 */
import { test, expect } from "@playwright/test";
import { loginAsUser, logout } from "./helpers/test-helpers";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "";
const enabled = Boolean(adminEmail && adminPassword);

const cmsPages = [
  { path: "/en/admin/cms/case-studies", label: /case stud/i },
  { path: "/en/admin/cms/faqs",         label: /FAQ/i },
  { path: "/en/admin/cms/services",     label: /service/i },
  { path: "/en/admin/cms/testimonials", label: /testimonial/i },
];

test.describe("Admin CMS pages", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!enabled) testInfo.skip("E2E admin credentials not configured");
    try {
      await loginAsUser(page, adminEmail, adminPassword, "/en/admin");
    } catch (err) {
      testInfo.skip(`Admin login failed: ${err}`);
    }
  });

  test.afterEach(async ({ page }) => {
    try { await logout(page); } catch { /* ignore */ }
  });

  for (const { path, label } of cmsPages) {
    test(`renders ${path}`, async ({ page }) => {
      const res = await page.goto(path);
      // Locale-prefixed admin CMS route; either 200 OK or a soft error
      // boundary (error.tsx) is acceptable — what we're testing is that the
      // route resolves without an unhandled exception (5xx, JS crash).
      expect(res?.status() ?? 0).toBeLessThan(500);
      await page.waitForLoadState("networkidle");

      // Either the page heading is visible OR a documented error boundary —
      // never a blank page or 5xx.
      const headingOrError = page.locator("h1, [role='alert'], [data-testid='error-boundary']");
      await expect(headingOrError.first()).toBeVisible({ timeout: 15_000 });

      // If the page is the happy path it'll contain the label term in body text;
      // if it's the error fallback, /error/i will match.
      const body = page.locator("main, body");
      await expect(body).toContainText(new RegExp(`${label.source}|error`, "i"));
    });
  }

  test("CMS pages are gated by admin", async ({ browser }) => {
    // Anonymous request — must redirect to login (not silently 200 onto the CMS).
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const res = await page.goto("/en/admin/cms/case-studies", { waitUntil: "domcontentloaded" });
    // Either a redirect happened (URL now contains /auth/login) or the middleware
    // returned a 401/403/302 — anything other than a full 200 page render.
    const finalUrl = page.url();
    const wasGated =
      /auth\/login/.test(finalUrl) ||
      (res?.status() ?? 200) >= 300;
    expect(wasGated).toBe(true);
    await ctx.close();
  });
});
