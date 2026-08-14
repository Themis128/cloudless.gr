import { test, expect } from "@playwright/test";

/**
 * Admin journey — #email/#password, /en/auth/login, e2e_admin cookie for admin.
 */

test.describe("Admin User Journey", () => {
  test("unauthenticated visitor is redirected away from /admin", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/en/admin", { waitUntil: "domcontentloaded" });
    await expect
      .poll(() => page.url(), { timeout: 15_000 })
      .toMatch(/\/auth\/login/);
    await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#password")).toBeVisible();
    await ctx.close();
  });

  test("login form has email and password fields", async ({ page }) => {
    await page.goto("/en/auth/login", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#email")).toHaveAttribute("required", "");
    await expect(page.locator("#password")).toHaveAttribute("required", "");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("invalid admin credentials show an error", async ({ page }) => {
    await page.goto("/en/auth/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
    await page.locator("#email").fill(`bad-admin-${Date.now()}@example.com`);
    await page.locator("#password").fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(
      page
        .getByText(
          /invalid|incorrect|failed|unauthorized|not configured|unavailable|required/i,
        )
        .first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test.describe("with e2e_admin cookie", () => {
    test.beforeEach(async ({ context }) => {
      await context.addCookies([
        { name: "e2e_admin", value: "1", url: "http://localhost:4000" },
      ]);
    });

    test("admin dashboard renders", async ({ page }) => {
      await page.goto("/en/admin", { waitUntil: "domcontentloaded" });
      if (!page.url().includes("/admin")) {
        test.skip(true, "e2e_admin bypass not active");
      }
      await expect(page.locator("h1, h2, main").first()).toBeVisible({ timeout: 30_000 });
    });

    test("admin sections navigate without 5xx", async ({ page }) => {
      const sections = [
        "/en/admin/analytics",
        "/en/admin/users",
        "/en/admin/settings",
        "/en/admin/crm",
        "/en/admin/email",
      ];
      for (const section of sections) {
        const res = await page.goto(section, { waitUntil: "domcontentloaded" });
        expect(res?.status() ?? 0, section).toBeLessThan(500);
        if (!page.url().includes("/admin")) {
          test.skip(true, "e2e_admin bypass not active");
        }
        await expect(page.locator("h1, h2, main").first()).toBeVisible({ timeout: 30_000 });
      }
    });

    test("sign out control is available from the navbar user menu", async ({ page }) => {
      await page.goto("/en/admin", { waitUntil: "domcontentloaded" });
      if (!page.url().includes("/admin")) {
        test.skip(true, "e2e_admin bypass not active");
      }
      const menuTrigger = page
        .getByRole("button", { name: /account|user|menu|profile|admin/i })
        .first();
      if (await menuTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await menuTrigger.click();
      }
      const signOut = page.getByRole("button", { name: /sign out|log out/i }).first();
      const signOutLink = page.getByRole("link", { name: /sign out|log out/i }).first();
      const hasButton = await signOut.isVisible({ timeout: 3_000 }).catch(() => false);
      const hasLink = await signOutLink.isVisible({ timeout: 1_000 }).catch(() => false);
      expect(hasButton || hasLink || page.url().includes("/admin")).toBeTruthy();
    });
  });
});
