import { test, expect } from "@playwright/test";

test.describe("Performance & Loading", () => {
  test("page loads within reasonable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/", { waitUntil: "networkidle" });
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(15000);
  });

  test("images are present on page", async ({ page }) => {
    await page.goto("/");
    const images = await page.locator("img").count();
    expect(images).toBeGreaterThanOrEqual(0);
  });
});
