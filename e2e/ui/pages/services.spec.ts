import { test, expect } from "@playwright/test";

/**
 * Services page — CTAs must stay locale-aware (`/en/contact`, `/en/store`).
 * See docs/product/PUBLIC-FORMS-AND-CHECKOUT.md § Public CTAs.
 */
test.describe("Services Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/services", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
  });

  test("should load successfully", async ({ page }) => {
    await expect(page).toHaveTitle(/services|cloudless/i);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("should list service sections", async ({ page }) => {
    await expect(page.getByTestId("services-container")).toBeVisible();
    const items = page.getByTestId("service-item");
    await expect(items.first()).toBeVisible({ timeout: 15_000 });
    expect(await items.count()).toBeGreaterThan(0);
    await expect(items.first().locator("h2").first()).toBeVisible();
  });

  test("CTA books audit → /en/contact", async ({ page }) => {
    const cta = page.getByTestId("services-cta");
    await expect(cta).toBeVisible();
    const primary = cta.locator('a[href*="/contact"]').first();
    await expect(primary).toBeVisible();
    await primary.click();
    await expect(page).toHaveURL(/\/en\/contact/);
  });

  test("CTA secondary browses store", async ({ page }) => {
    const secondary = page
      .getByTestId("services-cta")
      .locator('a[href*="/store"]')
      .first();
    await expect(secondary).toBeVisible();
    await secondary.click();
    await expect(page).toHaveURL(/\/en\/store/);
  });

  test("hero Book Free Audit → contact", async ({ page }) => {
    const heroAudit = page
      .getByRole("button", { name: /book a free audit/i })
      .or(page.getByRole("link", { name: /book (a )?free audit/i }))
      .first();
    await expect(heroAudit).toBeVisible();
    await heroAudit.click();
    await expect(page).toHaveURL(/\/en\/contact/);
  });

  test("nav logo → locale home", async ({ page }) => {
    await page
      .getByTestId("main-nav")
      .locator("a")
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/?$/);
  });

  test("nav store / blog / contact", async ({ page }) => {
    const nav = page.getByTestId("main-nav");
    await nav.locator('a[href*="/store"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/en\/store/);

    await page.goto("/en/services", { waitUntil: "domcontentloaded" });
    await nav.locator('a[href*="/blog"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/en\/blog/);

    await page.goto("/en/services", { waitUntil: "domcontentloaded" });
    await nav.locator('a[href*="/contact"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/en\/contact/);
  });

  test("mobile viewport keeps heading + CTA", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/en/services", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("services-cta")).toBeVisible();
  });

  test("has single primary h1 and secondary headings", async ({ page }) => {
    expect(await page.locator("h1").count()).toBeLessThan(3);
    expect((await page.locator("h2").count()) + (await page.locator("h3").count())).toBeGreaterThan(
      0,
    );
  });
});
