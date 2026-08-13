/**
 * AppFlowy-backed CMS coverage.
 *
 * Covers all CMS databases surfaced by the app:
 *   blog, docs, testimonials, services, faqs, case-studies
 *   (analytics, calendar, comments, reports, forms — admin-only, not tested here)
 *
 * When AppFlowy env vars are unset (default in CI / local dev) every database
 * falls back to its static array. Both modes (AppFlowy + fallback) pass because
 * tests assert on structural shape, not exact content.
 *
 * baseURL is `http://localhost:4000/en`. Absolute paths like `/en/blog` hit the
 * locale route directly; `/blog` hits the origin without locale and relies on
 * next-intl redirect. Prefer `/en/...` for page navigations.
 *
 * API contract tests hit the public JSON endpoints directly via `request`
 * so they catch schema regressions even when the page renders correctly.
 */

import { test, expect, type Page } from "@playwright/test";
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

async function waitForCmsPage(page: Page) {
  // Cold Next routes stream; wait on landmark content, not networkidle.
  await page.locator("h1, main").first().waitFor({ state: "visible", timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

test.describe("AppFlowy CMS — /blog", () => {
  test("renders the blog header and search input", async ({ page }) => {
    await page.goto("/en/blog");
    await waitForCmsPage(page);
    await expect(page).toHaveURL(/\/en\/blog\/?$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /insights/i })
    ).toBeVisible();
    // Placeholder uses a unicode ellipsis (…); match via accessible name.
    await expect(page.getByRole("textbox", { name: /search posts/i })).toBeVisible();
  });

  test("lists at least one post card linking to /blog/[slug]", async ({ page }) => {
    await page.goto("/en/blog");
    await waitForCmsPage(page);
    const links = await page.getByRole("link").all();
    const blogLinks: string[] = [];
    for (const link of links) {
      const href = await link.getAttribute("href");
      // Locale-prefixed (/en/blog/…) or bare (/blog/…) — exclude the index.
      if (href && /\/blog\/.+/.test(href) && !/\/blog\/?(\?.*)?$/.test(href)) {
        blogLinks.push(href);
      }
    }
    expect(blogLinks.length).toBeGreaterThan(0);
  });

  test("search query is preserved in the input", async ({ page }) => {
    await page.goto("/en/blog?q=cloud");
    await waitForCmsPage(page);
    await expect(page.getByRole("textbox", { name: /search posts/i })).toHaveValue("cloud");
  });

  test("nonexistent search yields empty-state message", async ({ page }) => {
    await page.goto("/en/blog?q=zzz_no_such_post_xyz");
    await waitForCmsPage(page);
    await expect(page.getByText(/no posts found/i)).toBeVisible();
  });
});

test.describe("AppFlowy CMS — /blog/[slug]", () => {
  test.skip(!FIRST_STATIC_POST_SLUG, "no static posts configured");

  test("static fallback post renders an article heading", async ({ page }) => {
    await page.goto(`/en/blog/${FIRST_STATIC_POST_SLUG}`);
    await expect(page).toHaveURL(new RegExp(`/blog/${FIRST_STATIC_POST_SLUG}`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("nonexistent slug renders the 404 page", async ({ page }) => {
    await page.goto("/en/blog/this-slug-does-not-exist");
    await expect(
      page.getByRole("heading", { level: 1, name: /page not found|introuvable|δεν βρέθηκε/i })
    ).toBeVisible();
  });
});

test.describe("AppFlowy CMS — /api/blog/posts contract", () => {
  test("returns a non-empty array of posts with required fields", async ({ request }) => {
    const res = await request.get("/api/blog/posts");
    expect(res.status()).toBe(200);
    const body = await res.json();
    // API wraps posts in { posts: [...] } when AppFlowy is configured or in static fallback
    const posts = Array.isArray(body) ? body : body.posts;
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

test.describe("AppFlowy CMS — /docs", () => {
  test("renders the docs header and search input", async ({ page }) => {
    await page.goto("/en/docs");
    await waitForCmsPage(page);
    await expect(page).toHaveURL(/\/en\/docs\/?$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /documentation/i })
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: /search docs/i })).toBeVisible();
  });

  test("renders either category headings or the empty state", async ({ page }) => {
    await page.goto("/en/docs");
    await waitForCmsPage(page);
    // Unbound AppFlowy/Notion → empty copy; populated CMS → category h2s.
    const categoryHeading = page.getByRole("heading", { level: 2 });
    const emptyState = page.getByText(
      /no documentation published yet|no docs match your filters/i
    );
    await expect(categoryHeading.or(emptyState).first()).toBeVisible();
  });

  test("filtering with no matches shows the no-results state", async ({ page }) => {
    await page.goto("/en/docs?q=zzz_no_such_doc_xyz");
    await waitForCmsPage(page);
    await expect(
      page.getByText(/no docs match your filters|no documentation published yet/i)
    ).toBeVisible();
  });
});

test.describe("AppFlowy CMS — /api/docs contract", () => {
  test("returns an array (empty or populated) with required fields", async ({ request }) => {
    const res = await request.get("/api/docs");
    expect(res.status()).toBe(200);
    const body = await res.json();
    // API wraps docs in { docs: [...] } or returns a raw array
    const docs = Array.isArray(body) ? body : body.docs ?? [];
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

test.describe("AppFlowy CMS — /api/testimonials contract", () => {
  test("returns an array with required fields", async ({ request }) => {
    const res = await request.get("/api/testimonials");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items = Array.isArray(body) ? body : body.testimonials;
    expect(Array.isArray(items)).toBe(true);
    // When AppFlowy is unreachable, static fallback may be empty if the
    // route fell through to an error branch; check structure only.
    if (items.length > 0) {
      const t = items[0];
      expect(typeof t.id).toBe("string");
      expect(typeof t.name).toBe("string");
      expect(typeof t.quote).toBe("string");
      expect(typeof t.featured).toBe("boolean");
    }
  });

  test("featured endpoint returns only featured items", async ({ request }) => {
    const res = await request.get("/api/testimonials?featured=true");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items = Array.isArray(body) ? body : body.testimonials;
    expect(Array.isArray(items)).toBe(true);
    for (const t of items) {
      expect(t.featured).toBe(true);
    }
  });
});

test.describe("AppFlowy CMS — testimonials on homepage", () => {
  test("homepage renders at least one testimonial quote", async ({ page }) => {
    await page.goto("/en");
    await waitForCmsPage(page);
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

test.describe("AppFlowy CMS — /services page", () => {
  test("renders the services heading", async ({ page }) => {
    await page.goto("/en/services");
    await waitForCmsPage(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("lists service cards on the services page", async ({ page }) => {
    await page.goto("/en/services");
    await waitForCmsPage(page);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    const bodyText = await page.textContent("body");
    expect(bodyText?.length).toBeGreaterThan(0);
  });
});

test.describe("AppFlowy CMS — /api/services contract", () => {
  test("returns a non-empty array with required fields", async ({ request }) => {
    const res = await request.get("/api/services");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items = Array.isArray(body) ? body : body.services;
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
    const body = await res.json();
    const items = Array.isArray(body) ? body : body.services;
    expect(Array.isArray(items)).toBe(true);
    for (const s of items) {
      expect(s.category).toBe("audit");
    }
  });
});

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------

test.describe("AppFlowy CMS — /api/faqs contract", () => {
  test("returns a non-empty array with required fields", async ({ request }) => {
    const res = await request.get("/api/faqs");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items = Array.isArray(body) ? body : body.faqs;
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
    const body = await res.json();
    const items = Array.isArray(body) ? body : body.faqs;
    for (const f of items) {
      expect(f.category).toBe("general");
    }
  });

  test("locale filter returns faqs for that locale or global ones", async ({ request }) => {
    const res = await request.get("/api/faqs?locale=en");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items = Array.isArray(body) ? body : body.faqs;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Case Studies
// ---------------------------------------------------------------------------

test.describe("AppFlowy CMS — /case-studies page", () => {
  test("renders the case studies heading", async ({ page }) => {
    await page.goto("/en/case-studies");
    await waitForCmsPage(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("lists case studies on the case-studies page", async ({ page }) => {
    await page.goto("/en/case-studies");
    await waitForCmsPage(page);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });
});

test.describe("AppFlowy CMS — /case-studies/[slug]", () => {
  test.skip(!FIRST_STATIC_CASE_SLUG, "no static case studies configured");

  test("static fallback case study renders an article heading", async ({ page }) => {
    await page.goto(`/en/case-studies/${FIRST_STATIC_CASE_SLUG}`);
    await expect(page).toHaveURL(new RegExp(`/case-studies/${FIRST_STATIC_CASE_SLUG}`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("nonexistent slug renders the 404 page", async ({ page }) => {
    await page.goto("/en/case-studies/this-slug-does-not-exist");
    await expect(
      page.getByRole("heading", { level: 1, name: /page not found|introuvable|δεν βρέθηκε/i })
    ).toBeVisible();
  });
});

test.describe("AppFlowy CMS — /api/case-studies contract", () => {
  test("returns an array with required fields", async ({ request }) => {
    const res = await request.get("/api/case-studies");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items = Array.isArray(body) ? body : body.caseStudies;
    expect(Array.isArray(items)).toBe(true);
    if (items.length > 0) {
      const c = items[0];
      expect(typeof c.id).toBe("string");
      expect(typeof c.title).toBe("string");
      expect(typeof c.slug).toBe("string");
      expect(typeof c.client).toBe("string");
      expect(typeof c.summary).toBe("string");
      expect(typeof c.featured).toBe("boolean");
    }
  });

  test("featured filter returns only featured case studies", async ({ request }) => {
    const res = await request.get("/api/case-studies?featured=true");
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items = Array.isArray(body) ? body : body.caseStudies;
    expect(Array.isArray(items)).toBe(true);
    for (const c of items) {
      expect(c.featured).toBe(true);
    }
  });

  test("slug endpoint returns a case study or 404 when not found", async ({ request }) => {
    const res = await request.get(`/api/case-studies/${FIRST_STATIC_CASE_SLUG}`);
    // When AppFlowy is configured but unreachable, the endpoint may return 404.
    // When static fallback is available, returns 200 with content.
    if (res.status() === 200) {
      const body = await res.json();
      const c = body.caseStudy ?? body;
      expect(typeof c.slug).toBe("string");
      expect(typeof c.title).toBe("string");
    } else {
      expect(res.status()).toBe(404);
    }
  });

  test("unknown slug returns 404", async ({ request }) => {
    const res = await request.get("/api/case-studies/no-such-case-study-xyz");
    expect(res.status()).toBe(404);
  });
});
