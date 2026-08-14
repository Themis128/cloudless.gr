import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("homepage is accessible without login", async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
  });

  test("login page shows email and password fields", async ({ page }) => {
    await page.goto("/en/auth/login", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#password")).toBeVisible({ timeout: 20_000 });

    const forgotLink = page.getByRole("link", { name: /forgot/i });
    await expect(forgotLink).toBeVisible({ timeout: 10_000 });
  });

  test("signup page exposes name, email and password fields", async ({ page }) => {
    await page.goto("/en/auth/signup", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth\/signup/);
    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#signup-email")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#signup-password")).toBeVisible({ timeout: 20_000 });
    const nameField = page.locator("#signup-name, input[name=\"name\"]").first();
    await expect(nameField).toBeVisible({ timeout: 20_000 });
  });

  test("forgot-password page is reachable from login", async ({ page }) => {
    await page.goto("/en/auth/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
    const forgotLink = page.getByTestId("forgot-password-link");
    await expect(forgotLink).toBeVisible({ timeout: 10_000 });
    await Promise.all([
      page.waitForURL(/\/auth\/forgot-password/),
      forgotLink.click(),
    ]);
  });
});
