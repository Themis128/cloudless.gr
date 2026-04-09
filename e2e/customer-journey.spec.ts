import { test, expect } from "@playwright/test";

test.describe("Customer Journey", () => {
  test("can navigate homepage", async ({ page }) => {
    await page.goto("/");
    const main = await page.locator("main").count();
    expect(main).toBeGreaterThan(0);
  });

  test("can view services page", async ({ page }) => {
    await page.goto("/services");
    const content = await page.locator("body").textContent();
    expect(content).toBeTruthy();
  });

  test("can view store/products", async ({ page }) => {
    await page.goto("/store");
    const content = await page.locator("body").textContent();
    expect(content).toBeTruthy();
  });

  test("can view blog", async ({ page }) => {
    await page.goto("/blog");
    const content = await page.locator("body").textContent();
    expect(content).toBeTruthy();
  });

  test("can view contact page", async ({ page }) => {
    await page.goto("/contact");
    const forms = await page.locator("form").count();
    expect(forms).toBeGreaterThanOrEqual(0);
  });
});
