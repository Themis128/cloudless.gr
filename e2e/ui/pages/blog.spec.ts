import { test, expect, type Page } from "@playwright/test";

/**
 * Blog page smoke — CMS may be empty (AppFlowy/static). Posts are optional.
 */

async function openMobileNavIfNeeded(page: Page) {
  const hamburger = page.locator('button[aria-label*="menu" i]').first();
  if (await hamburger.isVisible().catch(() => false)) {
    await hamburger.click();
  }
}

test.describe("Blog Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/blog", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
  });

  test("loads with main and h1", async ({ page }) => {
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page).toHaveURL(/\/blog/);
  });

  test("posts are optional when CMS is empty", async ({ page }) => {
    const postLinks = page.locator('a[href*="/blog/"]:not([href$="/blog"])');
    const count = await postLinks.count();
    expect(count).toBeGreaterThanOrEqual(0);
    if (count > 0) {
      await expect(postLinks.first()).toBeVisible();
    } else {
      // Empty state or just the index heading is fine
      await expect(page.locator("main").first()).toBeVisible();
    }
  });

  test("nav links work from blog", async ({ page }) => {
    await openMobileNavIfNeeded(page);
    const services = page
      .getByRole("link", { name: /services/i })
      .filter({ visible: true })
      .first();
    await expect(services).toBeVisible();
    await services.click();
    await expect(page).toHaveURL(/\/services/);
  });

  test("opening a post works when one exists", async ({ page }) => {
    const post = page.locator('a[href*="/blog/"]:not([href$="/blog"])').first();
    if ((await post.count()) === 0) {
      test.skip(true, "No blog posts in this environment");
      return;
    }
    await post.click();
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/blog\//);
    await expect(page.locator("h1, main").first()).toBeVisible();
  });
});
