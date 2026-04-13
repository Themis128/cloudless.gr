import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("homepage is accessible without login", async ({ page }) => {
    await page.goto("/");
    expect(page.url()).toContain(":4500");
  });

  test("can navigate to login page", async ({ page }) => {
    await page.goto("/auth/login");
    const inputs = await page.locator("input").count();
    expect(inputs).toBeGreaterThan(0);
  });

  test("can navigate to signup page", async ({ page }) => {
    await page.goto("/auth/signup");
    const inputs = await page.locator("input").count();
    expect(inputs).toBeGreaterThan(0);
  });
});
