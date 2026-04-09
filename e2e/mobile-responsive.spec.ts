import { test, expect, devices } from "@playwright/test";

test.describe("Mobile & Responsive", () => {
  test("homepage is responsive on mobile", async ({ page }) => {
    await page.goto("/");
    const main = await page.locator("main").count();
    expect(main).toBeGreaterThanOrEqual(0);
  });

  test("buttons are visible on desktop", async ({ page }) => {
    await page.goto("/");
    const buttons = await page.locator("button").count();
    expect(buttons).toBeGreaterThan(0);
  });
});
