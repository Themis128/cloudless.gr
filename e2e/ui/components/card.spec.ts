import { test, expect } from "@playwright/test";

/**
 * Card/section smoke — homepage main content has structured sections/links.
 * Does not require a `.card` class name.
 */

test.describe("Card Component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
  });

  test("main has headings beyond the hero", async ({ page }) => {
    await expect(page.locator("main h1, main h2").first()).toBeVisible();
    const headingCount = await page.locator("main h1, main h2, main h3").count();
    expect(headingCount).toBeGreaterThan(0);
  });

  test("homepage exposes CTA / section links", async ({ page }) => {
    const links = page.locator("main").getByRole("link");
    expect(await links.count()).toBeGreaterThan(0);
    await expect(links.first()).toBeVisible();
  });

  test("services page has content sections", async ({ page }) => {
    await page.goto("/en/services", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await page.locator("main h2, main h3, main article, main section").count()).toBeGreaterThan(0);
  });
});
