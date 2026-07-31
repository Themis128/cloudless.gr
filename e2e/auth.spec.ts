import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("homepage is accessible without login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("login page shows email and password fields", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.waitForLoadState("networkidle").catch(() => {});
    
    // Check for email and password fields (D1 auth)
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/^password/i)).toBeVisible({ timeout: 10_000 });
    
    // Check for forgot password link
    const forgotLink = page.getByRole("link", { name: /forgot/i });
    await expect(forgotLink).toBeVisible({ timeout: 5_000 });
  });

  test("signup page exposes name, email and password fields", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page).toHaveURL(/\/auth\/signup/);
    await expect(page.getByLabel(/name/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/^password/i)).toBeVisible({ timeout: 10_000 });
  });

  test("forgot-password page is reachable from login", async ({ page }) => {
    await page.goto("/auth/login");
    await page.waitForLoadState("networkidle").catch(() => {});
    // Click forgot password link
    const forgotLink = page.getByRole("link", { name: /forgot/i });
    await expect(forgotLink).toBeVisible({ timeout: 5_000 });
    await forgotLink.click();
    await expect(page).toHaveURL(/\/auth\/forgot-password/, { timeout: 10_000 });
  });
});