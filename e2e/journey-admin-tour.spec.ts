import { test, expect } from "@playwright/test";

/**
 * Deep journey: admin dashboard tour.
 * Uses the e2e_admin=1 cookie bypass to enter the admin area as an admin
 * user, then tours the main sections asserting each renders.
 */

test.describe("Admin dashboard tour", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{
      name: "e2e_admin", value: "1", url: "http://localhost:4000",
    }]);
  });

  test("admin can land on /admin and see dashboard", async ({ page }) => {
    await page.goto("/en/admin");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain("/admin");
  });

  test("admin can navigate to analytics", async ({ page }) => {
    await page.goto("/en/admin/analytics");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("admin can navigate to CRM", async ({ page }) => {
    await page.goto("/en/admin/crm");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("admin can navigate to campaigns", async ({ page }) => {
    await page.goto("/en/admin/campaigns");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("admin can navigate to calendar", async ({ page }) => {
    await page.goto("/en/admin/calendar");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("admin sidebar has navigation links to other sections", async ({ page }) => {
    await page.goto("/en/admin");
    const links = page.locator('a[href*="/admin/"]');
    expect(await links.count()).toBeGreaterThan(3);
  });

  test("non-admin (no cookie) gets redirected away from /admin", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/en/admin");
    await page.waitForTimeout(2000);
    // Should NOT be on /admin anymore (redirected to /auth/login or /dashboard)
    expect(page.url()).not.toMatch(/\/admin\/?$/);
    await ctx.close();
  });
});
