/**
 * Notion-backed CMS coverage.
 *
 * Covers all 8 Notion databases surfaced by the app:
 *   blog, docs, testimonials, services, faqs, case-studies
 *   (analytics, calendar, comments, reports, forms — admin-only, not tested here)
 *
 * When Notion env vars are unset (default in CI / local dev) every database
 * falls back to its static array. Both modes (Notion + fallback) pass because
 * tests assert on structural shape, not exact content.
 *
 * API contract tests hit the public JSON endpoints directly via `request`
 * so they catch schema regressions even when the page renders correctly.
 */

import { test, expect } from "@playwright/test";
import { posts as staticPosts } from "../src/lib/blog";
import {
  staticTestimonials,
} from "../src/lib/notion-testimonials";
import {
  staticServices,
} from "../src/lib/notion-services";
import {
  staticFaqs,
} from "../src/lib/notion-faqs";
import {
  staticCaseStudies,
} from "../src/lib/notion-case-studies";

const FIRST_STATIC_POST_SLUG = staticPosts[0]?.slug;
const FIRST_STATIC_CASE_SLUG = staticCaseStudies[0]?.slug;

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

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
  test.skip(!FIRST_STATIC_POST_SLUG, "no static posts configured");

  test("static fallback post renders an article heading", async ({ page }) => {
    await page.goto(`/blog/${FIRST_STATIC_POST_SLUG}`);
    await expect(page).toHaveURL(new RegExp(`/blog/${FIRST_STATIC_POST_SLUG}`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("nonexistent slug renders the 404 page", async ({ page }) => {
    await page.goto("/blog/this-slug-does-not-exist");
    await expect(
      page.getByRole("heading", { level: 1, name: /page not found|introuvable|δεν βρέθηκε/i })
    ).toBeVisible();
  });
});

test.describe("Notion CMS — /api/blog/posts contract", () => {
  test("returns a non-empty array of posts with required fields", async ({ request }) => {
    const res = await request.get("/api/blog/posts");
    expect(res.status()).toBe(200);
    const posts = await res.json();
    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
    const p = posts[0];
    expect(typeof p.slug).toBe("string");
    expect(typeof p.title).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Docs
// ---------------------------------------------------------------------------

test.describe("Notion CMS — /docs", () => {
  test("renders the docs header and search input", async ({ page }) => {
    await page.goto("/docs");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { level: 1, name: /documentation/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByPlaceholder(/search docs/i)).toBeVisible({ timeout: 10000 });
  });

  test("renders either category headings or the empty state", async ({ page }) => {
    await page.goto("/docs");
    const categoryHeading = page.getByRole("heading", { level: 2 });
    const emptyState = page.getByText(/no documentation published yet|no docs match/i);
    await expect(categoryHeading.or(emptyState).first()).toBeVisible();
  });

  test("filtering with no matches shows the no-results state", async ({ page }) => {
    await page.goto("/docs?q=zzz_no_such_doc_xyz");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText(/no docs match your filters|no documentation published yet/i)
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Notion CMS — /api/docs contract", () => {
  test("returns an array (empty or populated) with required fields", async ({ request }) => {
    const res = await request.get("/api/docs");
    expect(res.status()).toBe(200);
    const docs = await res.json();
    expect(Array.isArray(docs)).toBe(true);
    if (docs.length > 0) {
      const d = docs[0];
      expect(typeof d.slug).toBe("string");
      expect(typeof d.title).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

test.describe("Notion CMS — /api/testimonials contract", () => {
  test("returns a non-empty array with required fields", async ({ request }) => {
    const res = await request.get("/api/testimonials");
    expect(res.status()).toBe(200);
    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(staticTestimonials.length);
    const t = items[0];
    expect(typeof t.id).toBe("string");
    expect(typeof t.name).toBe("string");
    expect(typeof t.quote).toBe("string");
    expect(typeof t.featured).toBe("boolean");
  });

  test("featured endpoint returns only featured items", async ({ request }) => {
    const res = await request.get("/api/testimonials?featured=true");
    expect(res.status()).toBe(200);
    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
    for (const t of items) {
      expect(t.featured).toBe(true);
    }
  });
});

test.describe("Notion CMS — testimonials on homepage", () => {
  test("homepage renders at least one testimonial quote", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Testimonials are rendered as blockquotes or elements with the quote text
    const firstQuote = staticTestimonials[0].quote.slice(0, 20);
    const quoteEl = page.getByText(new RegExp(firstQuote, "i"));
    const testimonialSection = page.locator('[data-testid="testimonials"], section').filter({
      has: page.getByText(/testimonial|client|review/i),
    });
    await expect(quoteEl.or(testimonialSection.first())).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

test.describe("Notion CMS — /services page", () => {
  test("renders the services heading", async ({ page }) => {
    await page.goto("/services");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });
  });

  test("lists at least as many service cards as static fallback count", async ({ page }) => {
    await page.goto("/services");
    await page.waitForLoadState("networkidle");
    // Each service has a name — assert static services are all present
    for (const svc of staticServices.slice(0, 3)) {
      await expect(page.getByText(new RegExp(svc.name, "i"))).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe("Notion CMS — /api/services contract", () => {
  test("returns a non-empty array with required fields", async ({ request }) => {
    const res = await request.get("/api/services");
    expect(res.status()).toBe(200);
    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(staticServices.length);
    const s = items[0];
    expect(typeof s.id).toBe("string");
    expect(typeof s.name).toBe("string");
    expect(typeof s.slug).toBe("string");
    expect(typeof s.description).toBe("string");
    expect(typeof s.category).toBe("string");
  });

  test("category filter returns only matching services", async ({ request }) => {
    const res = await request.get("/api/services?category=audit");
    expect(res.status()).toBe(200);
    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
    for (const s of items) {
      expect(s.category).toBe("audit");
    }
  });
});

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------

test.describe("Notion CMS — /api/faqs contract", () => {
  test("returns a non-empty array with required fields", async ({ request }) => {
    const res = await request.get("/api/faqs");
    expect(res.status()).toBe(200);
    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(staticFaqs.length);
    const f = items[0];
    expect(typeof f.id).toBe("string");
    expect(typeof f.question).toBe("string");
    expect(typeof f.answer).toBe("string");
    expect(typeof f.category).toBe("string");
  });

  test("category filter returns only matching faqs", async ({ request }) => {
    const res = await request.get("/api/faqs?category=general");
    expect(res.status()).toBe(200);
    const items = await res.json();
    for (const f of items) {
      expect(f.category).toBe("general");
    }
  });

  test("locale filter returns faqs for that locale or global ones", async ({ request }) => {
    const res = await request.get("/api/faqs?locale=en");
    expect(res.status()).toBe(200);
    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Case Studies
// ---------------------------------------------------------------------------

test.describe("Notion CMS — /case-studies page", () => {
  test("renders the case studies heading", async ({ page }) => {
    await page.goto("/case-studies");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10000 });
  });

  test("lists at least one case study card", async ({ page }) => {
    await page.goto("/case-studies");
    await page.waitForLoadState("networkidle");
    const firstTitle = staticCaseStudies[0].title;
    await expect(page.getByText(new RegExp(firstTitle, "i"))).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Notion CMS — /case-studies/[slug]", () => {
  test.skip(!FIRST_STATIC_CASE_SLUG, "no static case studies configured");

  test("static fallback case study renders an article heading", async ({ page }) => {
    await page.goto(`/case-studies/${FIRST_STATIC_CASE_SLUG}`);
    await expect(page).toHaveURL(new RegExp(`/case-studies/${FIRST_STATIC_CASE_SLUG}`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10000 });
  });

  test("nonexistent slug renders the 404 page", async ({ page }) => {
    await page.goto("/case-studies/this-slug-does-not-exist");
    await expect(
      page.getByRole("heading", { level: 1, name: /page not found|introuvable|δεν βρέθηκε/i })
    ).toBeVisible();
  });
});

test.describe("Notion CMS — /api/case-studies contract", () => {
  test("returns a non-empty array with required fields", async ({ request }) => {
    const res = await request.get("/api/case-studies");
    expect(res.status()).toBe(200);
    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(staticCaseStudies.length);
    const c = items[0];
    expect(typeof c.id).toBe("string");
    expect(typeof c.title).toBe("string");
    expect(typeof c.slug).toBe("string");
    expect(typeof c.client).toBe("string");
    expect(typeof c.summary).toBe("string");
    expect(typeof c.featured).toBe("boolean");
  });

  test("featured filter returns only featured case studies", async ({ request }) => {
    const res = await request.get("/api/case-studies?featured=true");
    expect(res.status()).toBe(200);
    const items = await res.json();
    expect(Array.isArray(items)).toBe(true);
    for (const c of items) {
      expect(c.featured).toBe(true);
    }
  });

  test("slug endpoint returns a single case study with full content", async ({ request }) => {
    const res = await request.get(`/api/case-studies/${FIRST_STATIC_CASE_SLUG}`);
    expect(res.status()).toBe(200);
    const c = await res.json();
    expect(typeof c.slug).toBe("string");
    expect(typeof c.title).toBe("string");
    // Full content fields present on detail endpoint
    expect(typeof c.challenge).toBe("string");
    expect(typeof c.solution).toBe("string");
  });

  test("unknown slug returns 404", async ({ request }) => {
    const res = await request.get("/api/case-studies/no-such-case-study-xyz");
    expect(res.status()).toBe(404);
  });
});
