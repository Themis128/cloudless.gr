import { test, expect, type Page } from "@playwright/test";

/**
 * Header smoke against the current homepage navbar.
 * Mobile: open hamburger when nav links are drawer-only.
 */

async function openMobileNavIfNeeded(page: Page) {
  const hamburger = page.locator('button[aria-label*="menu" i]').first();
  if (await hamburger.isVisible().catch(() => false)) {
    await hamburger.click();
  }
}

async function visibleNavLink(page: Page, name: RegExp) {
  await openMobileNavIfNeeded(page);
  return page.getByRole("link", { name }).filter({ visible: true }).first();
}

test.describe("Header Component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
  });

  test("banner/nav is visible with cloudless.gr brand", async ({ page }) => {
    const banner = page.getByRole("banner");
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("navigation").first()).toBeVisible();
    await expect(banner.getByText(/cloudless/i).first()).toBeVisible();
  });

  test("nav links to services, store, blog, contact", async ({ page }) => {
    for (const name of [/services/i, /store/i, /blog/i, /contact/i]) {
      await expect(await visibleNavLink(page, name)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("services link navigates", async ({ page }) => {
    await (await visibleNavLink(page, /services/i)).click();
    await expect(page).toHaveURL(/\/services/);
  });

  test("store link navigates", async ({ page }) => {
    await (await visibleNavLink(page, /store/i)).click();
    await expect(page).toHaveURL(/\/store/);
  });

  test("blog link navigates", async ({ page }) => {
    await (await visibleNavLink(page, /blog/i)).click();
    await expect(page).toHaveURL(/\/blog/);
  });

  test("contact link navigates", async ({ page }) => {
    await (await visibleNavLink(page, /contact/i)).click();
    await expect(page).toHaveURL(/\/contact/);
  });

  test("logo returns home from another page", async ({ page }) => {
    await page.goto("/en/services", { waitUntil: "domcontentloaded" });
    const logo = page
      .getByRole("banner")
      .getByRole("link", { name: /home|cloudless/i })
      .first();
    await expect(logo).toBeVisible();
    await logo.click();
    await expect(page).toHaveURL(/\/en\/?$/);
  });

  test("mobile hamburger reveals nav links when present", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const hamburger = page.locator('button[aria-label*="menu" i]').first();
    await expect(hamburger).toBeVisible();
    await hamburger.click();
    await expect(
      page.getByRole("link", { name: /services/i }).filter({ visible: true }).first(),
    ).toBeVisible();
  });
});
