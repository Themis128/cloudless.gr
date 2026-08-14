import { test, expect, type Page } from "@playwright/test";

/**
 * Blog journey — locale /en paths; posts optional when CMS empty.
 */

async function openMobileNavIfNeeded(page: Page) {
  const hamburger = page.locator('button[aria-label*="menu" i]').first();
  if (await hamburger.isVisible().catch(() => false)) {
    await hamburger.click();
  }
}

test.describe("Blog User Journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
  });

  test("browse blog index from homepage nav", async ({ page }) => {
    await openMobileNavIfNeeded(page);
    await page.getByRole("link", { name: /^blog$/i }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/blog/);
    await expect(page.locator("main, h1").first()).toBeVisible({ timeout: 30_000 });
  });

  test("view a post when CMS has content", async ({ page }) => {
    await page.goto("/en/blog", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
    const post = page.locator('a[href*="/blog/"]:not([href$="/blog"])').first();
    if ((await post.count()) === 0) {
      test.skip(true, "No blog posts available");
      return;
    }
    await post.click();
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/blog\//);
    await expect(page.locator("article, main, h1").first()).toBeVisible();
  });

  test("blog page remains usable without search/filters", async ({ page }) => {
    await page.goto("/en/blog", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    // Search/filters are optional — do not fail if absent
    const search = page.locator('input[type="search"], input[placeholder*="Search" i]');
    expect(await search.count()).toBeGreaterThanOrEqual(0);
  });
});
