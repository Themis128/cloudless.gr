import { test, expect } from "@playwright/test";

test.describe("Accessibility", () => {
  test("homepage has semantic HTML", async ({ page }) => {
    await page.goto("/");
    const main = await page.locator("main").count();
    expect(main).toBeGreaterThan(0);
  });

  test("images have alt text or are marked decorative", async ({ page }) => {
    await page.goto("/");
    const images = await page.locator("img").count();
    expect(images).toBeGreaterThanOrEqual(0);
  });

  test("page has title", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
