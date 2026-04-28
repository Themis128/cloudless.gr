import { test, expect } from "@playwright/test";

test.describe("Customer Journey", () => {
  test("homepage shows hero heading and main landmark", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/cloudless/i);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("services page renders an h1", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("store page renders an h1", async ({ page }) => {
    await page.goto("/store");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("blog page renders an h1", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("contact page renders the form", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send|submit/i })
    ).toBeVisible();
  });
});
