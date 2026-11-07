import { test, expect } from "@playwright/test";
import { GUEST_STORAGE } from "./_helpers";

test.use({ storageState: GUEST_STORAGE });

/**
 * Full public-surface sweep — every non-admin page route must render a real
 * document (200, <h1>, no error boundary). Dynamic segments use known-good
 * slugs; CMS-backed lists tolerate an empty state but must not 500.
 */

const LOCALES = ["en", "el", "fr", "de"] as const;

// Static public routes (locale-prefixed). /links and /portal/* are unprefixed.
const PUBLIC_ROUTES = [
  "/",
  "/accessibility",
  "/agents",
  "/audit",
  "/blog",
  "/campaigns",
  "/case-studies",
  "/consultation",
  "/contact",
  "/cookies",
  "/docs",
  "/partners",
  "/playbook",
  "/privacy",
  "/refund",
  "/services",
  "/store",
  "/survey",
  "/terms",
  "/work",
] as const;

for (const locale of LOCALES) {
  test.describe(`public pages [${locale}]`, () => {
    for (const route of PUBLIC_ROUTES) {
      test(`${route} renders`, async ({ page }) => {
        const res = await page.goto(`/${locale}${route === "/" ? "" : route}`);
        expect(res?.status(), `${locale}${route}`).toBeLessThan(400);
        await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
        await expect(page.locator("text=/application error|something went wrong/i")).toHaveCount(0);
      });
    }
  });
}

test.describe("dynamic public routes", () => {
  test("store product detail renders", async ({ page }) => {
    await page.goto("/en/store/srv-cloud");
    await expect(page.getByRole("heading", { name: /cloud architecture audit/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible();
  });

  test("store success page renders without session params", async ({ page }) => {
    const res = await page.goto("/en/store/success");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
  });

  test("campaign detail + thanks pages render", async ({ page }) => {
    // Campaigns are CMS-driven — probe the listing for a real slug first.
    await page.goto("/en/campaigns");
    const link = page.locator('a[href*="/campaigns/"]').first();
    if (await link.count()) {
      const href = await link.getAttribute("href");
      if (href && !href.endsWith("/campaigns")) {
        await page.goto(href);
        await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
      }
    }
    const thanks = await page.goto("/en/campaigns/implementation-kit-2026/thanks");
    // thanks may 404 for unknown slug — only assert non-5xx
    expect(thanks?.status() ?? 0).toBeLessThan(500);
  });

  test("case-study detail renders when CMS has entries", async ({ page }) => {
    await page.goto("/en/case-studies");
    const link = page.locator('a[href*="/case-studies/"]').first();
    test.skip(!(await link.count()), "no case studies published");
    const href = await link.getAttribute("href");
    await page.goto(href!);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
  });

  test("docs article renders when docs exist", async ({ page }) => {
    await page.goto("/en/docs");
    const link = page.locator('a[href*="/docs/"]').first();
    test.skip(!(await link.count()), "no docs published");
    const href = await link.getAttribute("href");
    await page.goto(href!);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
  });

  test("blog post renders when posts exist", async ({ page }) => {
    await page.goto("/en/blog");
    const link = page.locator('a[href*="/blog/"]').first();
    test.skip(!(await link.count()), "no blog posts published");
    const href = await link.getAttribute("href");
    await page.goto(href!);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
  });

  test("unknown public route returns 404 page, not 500", async ({ page }) => {
    const res = await page.goto("/en/definitely-not-a-page-xyz");
    expect(res?.status()).toBe(404);
    await expect(page.locator("body")).toContainText(/404|not found/i);
  });
});

test.describe("unprefixed utility routes", () => {
  test("/links renders link hub", async ({ page }) => {
    const res = await page.goto("/links");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  test("/portal/waiting renders", async ({ page }) => {
    const res = await page.goto("/portal/waiting");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1, h2, main").first()).toBeVisible({ timeout: 20_000 });
  });

  test("/portal/[token] with bad token renders error state, not 500", async ({ page }) => {
    const res = await page.goto("/portal/not-a-real-token-xyz");
    expect(res?.status()).toBeLessThan(500);
  });

  test("/services unprefixed alias renders", async ({ page }) => {
    const res = await page.goto("/services");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("locale integrity", () => {
  test("html lang attribute matches the locale prefix", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(`/${locale}/services`);
      const lang = await page.locator("html").getAttribute("lang");
      expect(lang, `${locale} html lang`).toBe(locale);
    }
  });

  test("hreflang alternates present on a public page", async ({ page }) => {
    await page.goto("/en/services");
    const alternates = page.locator('link[rel="alternate"][hreflang]');
    expect(await alternates.count()).toBeGreaterThanOrEqual(3);
  });
});
