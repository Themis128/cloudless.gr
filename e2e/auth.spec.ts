import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("homepage is accessible without login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("login page exposes email and password fields", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).toHaveURL(/\/auth\/login/);
    // Page has Suspense + AuthContext init — wait for the form to hydrate.
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/password/i).first()).toBeVisible({ timeout: 10_000 });
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
    // Wait for Suspense + AuthContext to resolve before the link appears.
    await page.getByRole("link", { name: /forgot/i }).waitFor({ state: "visible", timeout: 10_000 });
    await page.getByRole("link", { name: /forgot/i }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password/, { timeout: 10_000 });
  });
});
