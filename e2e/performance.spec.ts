import { test, expect } from "@playwright/test";

test.describe("Performance & Loading", () => {
  test("homepage reaches networkidle within 15s", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/", { waitUntil: "networkidle" });
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(15_000);
  });

  test("homepage renders meaningful content (h1 and links)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.getByRole("link").count()).toBeGreaterThan(0);
  });
});
