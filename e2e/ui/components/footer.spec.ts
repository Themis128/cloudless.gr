import { test, expect } from "@playwright/test";

/**
 * Footer smoke — contentinfo landmark + key site links.
 */

test.describe("Footer Component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
  });

  test("contentinfo footer is visible with brand", async ({ page }) => {
    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();
    await expect(footer.getByText(/cloudless/i).first()).toBeVisible();
  });

  test("footer links to services, store, blog, contact", async ({ page }) => {
    const footer = page.getByRole("contentinfo");
    for (const name of [/services/i, /store/i, /blog/i, /contact/i]) {
      await expect(footer.getByRole("link", { name }).first()).toBeVisible();
    }
  });

  test("footer services link navigates", async ({ page }) => {
    await page.getByRole("contentinfo").getByRole("link", { name: /services/i }).first().click();
    await expect(page).toHaveURL(/\/services/);
  });
});
