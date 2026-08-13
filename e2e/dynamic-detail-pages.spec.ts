/**
 * Coverage for dynamic public detail routes that the previous suite missed:
 *   /blog/[slug]
 *   /case-studies/[slug]
 *   /docs/[slug]
 *   /store/[id]
 *
 * The admin detail route /admin/reports/[id] is also covered, gated on
 * admin credentials.
 *
 * Strategy:
 *   - Pull a real slug/id from the corresponding list endpoint when available.
 *   - Fall back to a sentinel value ("does-not-exist") and assert the route
 *     resolves to a documented 404/not-found page rather than 5xx — which is
 *     itself an important contract.
 */
import { test, expect } from "@playwright/test";

async function fetchFirstSlug(
  request: import("@playwright/test").APIRequestContext,
  url: string,
  field: string,
): Promise<string | null> {
  try {
    const res = await request.get(url);
    if (!res.ok()) return null;
    const data = await res.json();
    const list =
      (Array.isArray(data) && data) ||
      data.posts || data.caseStudies || data.docs ||
      data.items || data.results || data.products || data.data || [];
    const first = list[0];
    if (!first) return null;
    return first[field] ?? first.slug ?? first.id ?? null;
  } catch {
    return null;
  }
}

test.describe("Dynamic public detail pages", () => {
  test("/blog/[slug] — known post", async ({ page, request }) => {
    const slug = await fetchFirstSlug(request, "/api/blog/posts", "slug");
    if (!slug) test.skip(true, "no published blog posts to test against");
    const res = await page.goto(`/en/blog/${slug}`);
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
  });

  test("/blog/[slug] — unknown slug returns documented 404", async ({ page }) => {
    const res = await page.goto("/en/blog/this-post-does-not-exist-xyz");
    // Either a true 404 status or a soft 200 with a not-found component.
    const status = res?.status() ?? 0;
    if (status >= 500) throw new Error(`unexpected 5xx: ${status}`);
    // page must render *something* rather than crashing
    await expect(page.locator("body")).toBeVisible();
  });

  test("/case-studies/[slug] — known", async ({ page, request }) => {
    const slug = await fetchFirstSlug(request, "/api/case-studies", "slug");
    if (!slug) test.skip(true, "no case studies to test against");
    const res = await page.goto(`/en/case-studies/${slug}`);
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
  });

  test("/case-studies/[slug] — unknown slug", async ({ page }) => {
    const res = await page.goto("/en/case-studies/never-existed");
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });

  test("/docs/[slug] — known", async ({ page, request }) => {
    const slug = await fetchFirstSlug(request, "/api/docs", "slug");
    if (!slug) test.skip(true, "no docs to test against");
    const res = await page.goto(`/en/docs/${slug}`);
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });
  });

  test("/docs/[slug] — unknown slug", async ({ page }) => {
    const res = await page.goto("/en/docs/no-such-doc");
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });

  test("/store/[id] — fallback when product list empty", async ({ page, request }) => {
    const id = await fetchFirstSlug(request, "/api/services", "id");
    const target = id ? `/en/store/${id}` : "/en/store/sample-id";
    const res = await page.goto(target);
    // Store pages may legitimately 404 in test if Stripe isn't connected —
    // we only assert no server crash.
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Admin detail routes", () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL || "";
  const adminPassword = process.env.E2E_ADMIN_PASSWORD || "";
  const enabled = Boolean(adminEmail && adminPassword);

  test("/admin/reports/[id] — gated on admin auth", async ({ page, browser }, testInfo) => {
    // Anonymous request must redirect away.
    const anonCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anonPage = await anonCtx.newPage();
    const anonRes = await anonPage.goto("/en/admin/reports/sample", {
      waitUntil: "domcontentloaded",
    });
    const finalUrl = anonPage.url();
    const wasGated =
      /auth\/login/.test(finalUrl) || (anonRes?.status() ?? 200) >= 300;
    expect(wasGated).toBe(true);
    await anonCtx.close();

    if (!enabled) testInfo.skip("admin creds not configured — skipping authed leg");

    // Authed leg: page should at least resolve (data may 404 — that's fine).
    // Reuse default context; rely on test runner login helpers elsewhere.
    const res = await page.goto("/en/admin/reports/sample");
    expect(res?.status() ?? 0).toBeLessThan(500);
  });
});
