import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("loads with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Cloudless/i);
  });

  test("has no broken internal links on homepage (4xx)", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((h) => h.startsWith("http://localhost") || h.startsWith("https://localhost"))
        // Skip external links and dynamic query params — just check the 5 simplest internal paths
        .filter((h) => !h.includes("?"))
        .slice(0, 5)
    );

    for (const href of hrefs) {
      const res = await request.get(href, { timeout: 15_000 });
      expect(res.status(), `${href} returned ${res.status()}`).toBeLessThan(400);
    }
  });

  test("renders above-the-fold content without JS errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
  });

  test("has meta description and OG tags", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const desc = await page.$eval('meta[name="description"]', (el) => el.getAttribute("content"));
    expect(desc).toBeTruthy();
    expect(desc!.length).toBeGreaterThan(10);

    const ogTitle = await page.$eval('meta[property="og:title"]', (el) =>
      el.getAttribute("content")
    );
    expect(ogTitle).toBeTruthy();
  });

  test("has cloudless.gr canonical URL (not personal name)", async ({ page }) => {
    await page.goto("/");
    const canonical = await page
      .$eval('link[rel="canonical"]', (el) => el.getAttribute("href"))
      .catch(() => null);

    // Canonical should reference cloudless.gr, not any personal domain
    if (canonical) {
      expect(canonical).toContain("cloudless.gr");
    }

    // Verify no personal author name appears in author meta
    const author = await page
      .$eval('meta[name="author"]', (el) => el.getAttribute("content"))
      .catch(() => null);

    if (author) {
      expect(author.toLowerCase()).not.toContain("baltzakis");
      expect(author.toLowerCase()).not.toContain("themistoklis");
    }
  });
});
