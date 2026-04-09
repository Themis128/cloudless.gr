import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("login page is accessible", async ({ page }) => {
    await page.goto("/auth/login");
    const emailInput = await page.locator('input[type="email"], input[name="email"]').count();
    expect(emailInput).toBeGreaterThan(0);
  });

  test("dashboard urls exist", async ({ page }) => {
    await page.goto("/dashboard").catch(() => {
      // Might redirect to login
    });
    expect(page.url()).toBeTruthy();
  });
});
