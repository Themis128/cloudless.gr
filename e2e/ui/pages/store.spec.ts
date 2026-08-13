import { test, expect } from "@playwright/test";

/**
 * Store page — product grid + cart affordances for Stripe checkout journey.
 * Checkout contract: docs/product/PUBLIC-FORMS-AND-CHECKOUT.md + STRIPE.md
 */
test.describe("Store Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/store", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
  });

  test("should load successfully", async ({ page }) => {
    await expect(page).toHaveTitle(/store|shop|cloudless/i);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("should show products grid with cards", async ({ page }) => {
    const grid = page.getByTestId("products-container");
    await expect(grid).toBeVisible({ timeout: 20_000 });
    const cards = grid.getByTestId("product-card");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first().locator("h3").first()).toBeVisible();
    await expect(cards.first().getByRole("button", { name: /add to cart|subscribe/i })).toBeVisible();
  });

  test("should have category filters and sort", async ({ page }) => {
    await expect(page.getByRole("button", { name: /all products/i })).toBeVisible();
    await expect(page.getByLabel(/sort products/i)).toBeVisible();
  });

  test("should expose cart control in navbar", async ({ page }) => {
    await expect(page.getByTestId("cart").filter({ visible: true }).first()).toBeVisible();
  });

  test("product card opens detail page", async ({ page }) => {
    const card = page.getByTestId("product-card").first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.locator("a[href*='/store/']").first().click();
    await expect(page).toHaveURL(/\/en\/store\/[^/?#]+/);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
  });

  test("add to cart does not require login", async ({ page }) => {
    const add = page
      .getByTestId("product-card")
      .first()
      .getByRole("button", { name: /add to cart|subscribe/i });
    await expect(add).toBeVisible({ timeout: 20_000 });
    await add.click();
    // Still on store (anonymous cart); cart badge may appear.
    await expect(page).toHaveURL(/\/en\/store/);
    await expect(page).not.toHaveURL(/\/auth\/login/);
  });

  test("nav contact / services links", async ({ page }) => {
    const nav = page.getByTestId("main-nav");
    await nav.locator('a[href*="/contact"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/en\/contact/);

    await page.goto("/en/store", { waitUntil: "domcontentloaded" });
    await nav.locator('a[href*="/services"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/en\/services/);
  });

  test("mobile viewport shows products", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/en/store", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("products-container")).toBeVisible({ timeout: 20_000 });
  });
});
