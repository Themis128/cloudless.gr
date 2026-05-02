/**
 * Notion-backed CMS coverage.
 *
 * The app reads Notion as a CMS for `/blog`, `/blog/[slug]`, and `/docs`.
 * When Notion env vars are unset (the default in CI / local dev), the blog
 * falls back to a static post list (`src/lib/blog.ts`) and the docs page
 * renders an empty state. Both modes are exercised here.
 */

import { test, expect } from "@playwright/test";
import { posts as staticPosts } from "../src/lib/blog";

const FIRST_STATIC_SLUG = staticPosts[0]?.slug;

test.describe("Notion CMS — /blog", () => {
  test("renders the blog header and search input", async ({ page }) => {
    await page.goto("/blog");
    await expect(
      page.getByRole("heading", { level: 1, name: /insights/i })
    ).toBeVisible();
    await expect(page.getByPlaceholder(/search posts/i)).toBeVisible();
  });

  test("lists at least one post card linking to /blog/[slug]", async ({ page }) => {
    await page.goto("/blog");

    const postLinks = page.locator('a[href^="/blog/"], a[href*="/blog/"]').filter({
      hasNot: page.locator('a[href$="/blog"]'),
    });
    expect(await postLinks.count()).toBeGreaterThan(0);
    await expect(postLinks.first()).toBeVisible();
  });

  test("search query is preserved in the input", async ({ page }) => {
    await page.goto("/blog?q=cloud");
    await expect(page.getByPlaceholder(/search posts/i)).toHaveValue("cloud");
  });

  test("nonexistent search yields empty-state message", async ({ page }) => {
    await page.goto("/blog?q=zzz_no_such_post_xyz");
    await expect(page.getByText(/no posts found/i)).toBeVisible();
  });
});

test.describe("Notion CMS — /blog/[slug]", () => {
  test.skip(!FIRST_STATIC_SLUG, "no static posts configured");

  test("static fallback post renders an article heading", async ({ page }) => {
    await page.goto(`/blog/${FIRST_STATIC_SLUG}`);
    await expect(page).toHaveURL(new RegExp(`/blog/${FIRST_STATIC_SLUG}`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("nonexistent slug renders the 404 page", async ({ page }) => {
    await page.goto("/blog/this-slug-does-not-exist");
    await expect(
      page.getByRole("heading", { level: 1, name: /page not found|introuvable|δεν βρέθηκε/i })
    ).toBeVisible();
  });
});

test.describe("Notion CMS — /docs", () => {
  test("renders the docs header and search input", async ({ page }) => {
    await page.goto("/docs");
    await expect(
      page.getByRole("heading", { level: 1, name: /documentation/i })
    ).toBeVisible();
    await expect(page.getByPlaceholder(/search docs/i)).toBeVisible();
  });

  test("renders either category headings or the empty state", async ({ page }) => {
    await page.goto("/docs");

    // With Notion configured the page shows category h2s; otherwise the
    // empty-state copy is rendered. Either is a passing render.
    const categoryHeading = page.getByRole("heading", { level: 2 });
    const emptyState = page.getByText(
      /no documentation published yet|no docs match/i
    );

    await expect(categoryHeading.or(emptyState).first()).toBeVisible();
  });

  test("filtering with no matches shows the no-results state", async ({ page }) => {
    await page.goto("/docs?q=zzz_no_such_doc_xyz");
    await expect(
      page.getByText(/no docs match your filters|no documentation published yet/i)
    ).toBeVisible();
  });
});
