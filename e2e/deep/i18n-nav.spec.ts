import { test, expect } from "@playwright/test";
import { GUEST_STORAGE } from "./_helpers";
import { clickNavHref, openMobileNavIfNeeded } from "../helpers/mobile-nav";

test.use({ storageState: GUEST_STORAGE });

test.describe("i18n routing and primary navigation", () => {
  test("bare / lands on the default locale homepage", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId("hero")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("hero-cta-primary")).toBeVisible();
  });

  test("unprefixed /store 307s to /en/store; file-like paths stay unprefixed", async ({
    request,
  }) => {
    const store = await request.get("/store", { maxRedirects: 0 });
    expect(store.status()).toBe(307);
    expect(store.headers()["location"] ?? "").toMatch(/\/en\/store/);

    const robots = await request.get("/robots.txt", { maxRedirects: 0 });
    expect(robots.status()).toBeLessThan(400);
    expect(robots.headers()["location"] ?? "").not.toMatch(/\/en\/robots/);

    const sitemap = await request.get("/sitemap.xml", { maxRedirects: 0 });
    expect(sitemap.status()).toBeLessThan(400);
    expect(sitemap.headers()["location"] ?? "").not.toMatch(/\/en\/sitemap/);
  });

  test("/el homepage sets html lang=el and keeps the path", async ({ page }) => {
    await page.goto("/el");
    await expect(page).toHaveURL(/\/el\/?$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "el");
    await expect(page.locator("h1, [data-testid=hero]").first()).toBeVisible({ timeout: 20_000 });
  });

  test("locale switcher changes the prefix without dropping the page", async ({ page }) => {
    await page.goto("/en/services");
    await openMobileNavIfNeeded(page);
    const languageBtn = page.getByRole("button", { name: /language:/i }).filter({ visible: true });
    await expect(languageBtn).toBeVisible({ timeout: 10_000 });
    await languageBtn.click();
    await page.getByRole("option", { name: /ελληνικά/i }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/el\/services/);
    await expect(page.locator("html")).toHaveAttribute("lang", "el", { timeout: 10_000 });
  });

  test("primary nav walks home → services → store → blog → contact", async ({ page }) => {
    await page.goto("/en");
    await clickNavHref(page, "/services");
    await expect(page).toHaveURL(/\/en\/services/);
    await expect(page.getByTestId("services-container")).toBeVisible({ timeout: 20_000 });

    await clickNavHref(page, "/store");
    await expect(page).toHaveURL(/\/en\/store/);
    await expect(page.getByTestId("products-container")).toBeVisible();

    await clickNavHref(page, "/blog");
    await expect(page).toHaveURL(/\/en\/blog/);
    await expect(page.locator("h1, h2").first()).toBeVisible();

    await clickNavHref(page, "/contact");
    await expect(page).toHaveURL(/\/en\/contact/);
    await expect(page.getByTestId("contact-form")).toBeVisible();
  });

  test("unknown locale path 404s with a way back home", async ({ page }) => {
    const res = await page.goto("/en/this-page-does-not-exist-e2e");
    expect(res?.status()).toBe(404);
    const home = page.getByRole("link", { name: /home|cloudless/i }).first();
    await expect(home.or(page.getByTestId("main-nav"))).toBeVisible();
  });

  test("theme switcher writes data-theme and survives reload", async ({ page }) => {
    await page.goto("/en");
    await openMobileNavIfNeeded(page);
    const inlineLight = page.getByRole("radio", { name: /theme: light/i }).filter({ visible: true });
    if (await inlineLight.count()) {
      await inlineLight.click();
    } else {
      await page
        .getByRole("button", { name: /theme:.*click to change/i })
        .filter({ visible: true })
        .click();
      await page.getByRole("option", { name: /theme: light/i }).click();
    }
    await expect(page.locator("html")).toHaveAttribute("data-theme", /light/i);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", /light/i);
  });
});
