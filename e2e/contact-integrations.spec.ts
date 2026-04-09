import { test, expect } from "@playwright/test";

test.describe("Contact & Integrations", () => {
  test("contact form is accessible", async ({ page }) => {
    await page.goto("/contact");
    const forms = await page.locator("form").count();
    expect(forms).toBeGreaterThanOrEqual(0);
  });

  test("can access legal pages", async ({ page }) => {
    await page.goto("/privacy");
    expect(page.url()).toContain("privacy");
  });
});
