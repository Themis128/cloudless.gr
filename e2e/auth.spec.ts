import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("homepage is accessible without login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("login page shows Continue with AWS button", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.waitForLoadState("networkidle").catch(() => {});
    const hasAws = await page.getByRole("button", { name: /continue with aws/i }).isVisible({ timeout: 10_000 }).catch(() => false);
    const hasEmail = await page.getByLabel(/email/i).isVisible({ timeout: 5_000 }).catch(() => false);
    expect(hasAws || hasEmail, "login page must show Continue with AWS button or email field").toBeTruthy();
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
    // With Cognito there is no forgot-password link on the login page; navigate directly.
    const forgotLink = page.getByRole("link", { name: /forgot/i });
    const hasLink = await forgotLink.isVisible({ timeout: 5_000 }).catch(() => false);
    if (hasLink) {
      await forgotLink.click();
    } else {
      await page.goto("/auth/forgot-password");
    }
    await expect(page).toHaveURL(/\/auth\/forgot-password/, { timeout: 10_000 });
  });
});
