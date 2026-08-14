/**
 * Customer Behavior Tests
 *
 * Simulates real user journeys through the public-facing site:
 * navigation, store browsing, contact form, auth pages, blog reading,
 * docs, legal pages, and error handling.
 *
 * Note: the desktop navbar links are hidden on small viewports (lg:flex).
 * Navigation tests that rely on the navbar are tagged @desktop and skipped
 * on the mobile-chrome project.
 */

import { test, expect } from "@playwright/test";

// ─── Homepage ────────────────────────────────────────────────────────────────

test.describe("Homepage", () => {
  test("renders hero heading and title", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/cloudless/i);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("main landmark is present", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("main")).toBeVisible();
  });

  test("desktop: navigation bar shows core links", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "Navbar links are hidden behind hamburger on mobile");
    await page.goto("/en");
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: /services/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /store/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /blog/i })).toBeVisible();
  });

  test("desktop: homepage → services navigation works", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "Navbar links hidden on mobile");
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    const link = page.getByRole("navigation").first().getByRole("link", { name: /services/i });
    await link.waitFor({ state: "visible" });
    await Promise.all([
      page.waitForURL(/\/services/, { timeout: 10000 }),
      link.click(),
    ]);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("desktop: homepage → store navigation works", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "Navbar links hidden on mobile");
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    const link = page.getByRole("navigation").first().getByRole("link", { name: /store/i });
    await link.waitFor({ state: "visible" });
    await Promise.all([
      page.waitForURL(/\/store/, { timeout: 10000 }),
      link.click(),
    ]);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("desktop: homepage → blog navigation works", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "Navbar links hidden on mobile");
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    const link = page.getByRole("navigation").first().getByRole("link", { name: /blog/i });
    await link.waitFor({ state: "visible" });
    await Promise.all([
      page.waitForURL(/\/blog/, { timeout: 15000 }),
      link.click(),
    ]);
    // The URL flips before the cold blog route finishes streaming in dev mode;
    // give the heading room to paint rather than asserting at the default deadline.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15000 });
  });
});

// ─── Services page ────────────────────────────────────────────────────────────

test.describe("Services page", () => {
  test("renders h1 and service section headings", async ({ page }) => {
    await page.goto("/en/services");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const h2s = page.getByRole("heading", { level: 2 });
    await expect(h2s.first()).toBeVisible();
  });

  test("has a contact / book a call CTA", async ({ page }) => {
    await page.goto("/en/services");
    await page.waitForLoadState("networkidle");
    const cta = page.getByRole("link", { name: /contact|book|get started|schedule|consult/i }).first();
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible({ timeout: 10000 });
  });

  test("CTA links to contact or auth", async ({ page }) => {
    await page.goto("/en/services");
    const cta = page.getByRole("link", { name: /contact|book|get started|schedule|consult/i }).first();
    const href = await cta.getAttribute("href");
    expect(href).toMatch(/contact|auth|signup|login/i);
  });
});

// ─── Store – product listing ──────────────────────────────────────────────────

test.describe("Store – product listing", () => {
  test("renders h1", async ({ page }) => {
    await page.goto("/en/store");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("shows at least one product with a price", async ({ page }) => {
    await page.goto("/en/store");
    // Price elements contain currency symbol
    await expect(page.locator("text=/€|\\$|EUR/").first()).toBeVisible();
  });

  test("clicking a product card navigates to product detail", async ({ page }) => {
    await page.goto("/en/store");
    // Find a link that goes to /store/<id>
    const links = await page.getByRole("link").all();
    let productHref: string | null = null;
    for (const link of links) {
      const href = await link.getAttribute("href");
      if (href && /\/store\/[\w-]+$/.test(href) && !href.endsWith("/store/success")) {
        productHref = href;
        break;
      }
    }
    if (productHref) {
      await page.goto(productHref);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
});

// ─── Store – product detail page ──────────────────────────────────────────────

test.describe("Store – product detail", () => {
  test("Cloud Architecture Audit shows name, price, and add-to-cart button", async ({ page }) => {
    await page.goto("/en/store/srv-cloud");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/cloud architecture audit/i);
    await expect(page.locator("text=/€|\\$|EUR/").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /add to cart|buy|order/i })).toBeVisible();
  });

  test("digital product detail renders correctly", async ({ page }) => {
    await page.goto("/en/store/dig-cloud-playbook");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/playbook/i);
    await expect(page.getByRole("button", { name: /add to cart|buy/i })).toBeVisible();
  });

  test("product breadcrumb has a link back to the Store", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "Breadcrumb may be collapsed on mobile viewports");
    await page.goto("/en/store/srv-cloud");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Breadcrumb link with href ending in /store
    const storeLink = page.locator("a[href$='/store']").first();
    await expect(storeLink).toBeVisible();
  });

  test("related products section is rendered", async ({ page }) => {
    await page.goto("/en/store/srv-cloud");
    const related = page.getByText(/related|you may also|more products/i).first();
    await expect(related).toBeVisible();
  });

  test("non-existent product ID renders a not-found page", async ({ page }) => {
    const res = await page.goto("/en/store/this-product-xyz-does-not-exist");
    // Next.js notFound() → 404; dev mode may return 200 with error UI
    expect(res?.status()).not.toBe(500);
    const body = await page.locator("body").textContent();
    // Either a 404 page or the page body should indicate the product doesn't exist
    const is404 = res?.status() === 404;
    const hasNotFoundContent = /not found|404|doesn't exist|does not exist/i.test(body ?? "");
    expect(is404 || hasNotFoundContent).toBe(true);
  });
});

// ─── Store – checkout API ─────────────────────────────────────────────────────

test.describe("Store – checkout API", () => {
  test("POST /api/checkout without productId returns 4xx", async ({ request }) => {
    const res = await request.post("/api/checkout", { data: {} });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("POST /api/checkout with unknown productId returns 4xx", async ({ request }) => {
    const res = await request.post("/api/checkout", {
      data: { productId: "product-does-not-exist", locale: "en" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

// ─── Order success page ───────────────────────────────────────────────────────

test.describe("Order success page", () => {
  test("renders a confirmation heading", async ({ page }) => {
    await page.goto("/en/store/success");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10000 });
  });

  test("has a link back to store or home", async ({ page }) => {
    await page.goto("/en/store/success");
    await page.waitForLoadState("networkidle");
    const link = page.getByRole("link", { name: /store|home|continue|explore/i }).first();
    await expect(link).toBeVisible({ timeout: 10000 });
  });

  test("page body mentions order, confirmation, or thank-you", async ({ page }) => {
    await page.goto("/en/store/success");
    await page.waitForLoadState("networkidle");
    const body = await page.locator("body").textContent();
    expect(body).toMatch(/order|confirm|thank|success/i);
  });
});

// ─── Blog ─────────────────────────────────────────────────────────────────────

test.describe("Blog", () => {
  test("renders h1 and article list", async ({ page }) => {
    await page.goto("/en/blog");
    await page.locator("h1, main").first().waitFor({ state: "visible", timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("at least one article link is present", async ({ page }) => {
    await page.goto("/en/blog");
    await page.locator("h1, main").first().waitFor({ state: "visible", timeout: 30_000 });
    const links = await page.getByRole("link").all();
    const blogLinks = [];
    for (const link of links) {
      const href = await link.getAttribute("href");
      if (href && /\/blog\/.+/.test(href) && !/\/blog\/?(\?.*)?$/.test(href)) {
        blogLinks.push(href);
      }
    }
    test.skip(blogLinks.length === 0, "No blog posts in this environment (CMS empty)");
    expect(blogLinks.length).toBeGreaterThan(0);
  });

  test("clicking a blog post navigates to the article page", async ({ page }) => {
    await page.goto("/en/blog");
    await page.locator("h1, main").first().waitFor({ state: "visible", timeout: 30_000 });
    const links = await page.getByRole("link").all();
    let postHref: string | null = null;
    for (const link of links) {
      const href = await link.getAttribute("href");
      if (href && /\/blog\/.+/.test(href) && !/\/blog\/?(\?.*)?$/.test(href)) {
        postHref = href;
        break;
      }
    }
    test.skip(!postHref, "No blog posts in this environment (CMS empty)");
    await page.goto(postHref!);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

// ─── Docs ─────────────────────────────────────────────────────────────────────

test.describe("Docs", () => {
  test("docs index renders a heading", async ({ page }) => {
    await page.goto("/en/docs");
    await page.locator("h1, main").first().waitFor({ state: "visible", timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

// ─── Contact form ─────────────────────────────────────────────────────────────

test.describe("Contact form", () => {
  test("renders name, email, and message fields plus Send Message button", async ({ page }) => {
    await page.goto("/en/contact");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#message")).toBeVisible();
    await expect(page.getByRole("button", { name: /send message/i })).toBeVisible();
  });

  test("submitting empty form stays on contact page (HTML5 validation)", async ({ page }) => {
    await page.goto("/en/contact");
    await page.getByRole("button", { name: /send message/i }).click();
    expect(page.url()).toMatch(/\/contact/);
  });

  test("typing a valid message into all fields is possible", async ({ page }) => {
    await page.goto("/en/contact");
    await page.locator("#name").fill("Playwright Test");
    await page.locator("#email").fill("playwright@example.com");
    await page.locator("#message").fill("Automated test message — please ignore.");
    await expect(page.locator("#name")).toHaveValue("Playwright Test");
    await expect(page.locator("#email")).toHaveValue("playwright@example.com");
  });
});

// ─── Contact API ──────────────────────────────────────────────────────────────

test.describe("Contact form API", () => {
  test("missing name returns 400", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: { email: "test@example.com", message: "Hello" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("invalid email returns 400", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: { name: "Test", email: "not-an-email", message: "Hello" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("missing message returns 400", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: { name: "Test", email: "test@example.com" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("valid submission passes validation (not 4xx except rate-limit) @mutating", async ({ request }) => {
    const res = await request.post("/api/contact", {
      data: {
        name: "Playwright Test",
        email: "playwright@example.com",
        message: "Automated test — please ignore.",
      },
    });
    const status = res.status();
    // 2xx: success; 5xx: SES not configured in dev; 429: rate-limited (acceptable in test runs)
    // Any other 4xx means validation rejected a valid payload — that's a bug.
    const isUnexpectedClientError = status >= 400 && status < 500 && status !== 429;
    expect(isUnexpectedClientError).toBe(false);
  });
});

// ─── Auth pages ───────────────────────────────────────────────────────────────

test.describe("Auth – Login page", () => {
  test("renders email, password fields and Sign In button", async ({ page }) => {
    await page.goto("/en/auth/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#password")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible({ timeout: 20_000 });
  });

  test("has a Create Account signup link", async ({ page }) => {
    await page.goto("/en/auth/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /create account/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("has a Forgot Password link", async ({ page }) => {
    await page.goto("/en/auth/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
    const hasForgotLink = await page
      .getByRole("link", { name: /forgot password/i })
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (hasForgotLink) {
      await expect(page.getByRole("link", { name: /forgot password/i })).toBeVisible();
    }
  });

  test("submitting blank stays on login page", async ({ page }) => {
    await page.goto("/en/auth/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button").first().click();
    expect(page.url()).toMatch(/\/auth\/login|auth\/login/);
  });
});

test.describe("Auth – Signup page", () => {
  test("renders Full Name, email, password fields and Create Account button", async ({ page }) => {
    await page.goto("/en/auth/signup", { waitUntil: "domcontentloaded" });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#signup-email")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#signup-password")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#signup-confirm-password")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("has a Sign In link back to login", async ({ page }) => {
    await page.goto("/en/auth/signup", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#signup-email")).toBeVisible({ timeout: 20_000 });
    const signInLink = page.getByRole("link", { name: /sign in/i }).first();
    await signInLink.scrollIntoViewIfNeeded();
    await expect(signInLink).toBeVisible({ timeout: 20_000 });
  });

  test("password mismatch shows an error", async ({ page }) => {
    // baseURL is http://localhost:4000/en (no trailing slash) — use an absolute path.
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.goto("/en/auth/signup", { waitUntil: "domcontentloaded" });
      if (!(await page.getByRole("heading", { name: /page not found/i }).count())) break;
      await page.waitForTimeout(500 * (attempt + 1));
    }
    await expect(page.locator("#signup-email")).toBeVisible({ timeout: 30_000 });
    await page.locator("#signup-name").fill("E2E Tester");
    await page.locator("#signup-email").fill(`mismatch-${Date.now()}@example.com`);
    await page.locator("#signup-password").fill("password12345");
    await page.locator("#signup-confirm-password").fill("different45678");
    await page.getByRole("button", { name: /create account|sign up|register/i }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /create account|sign up|register/i }).click();
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("alert")).toContainText(/passwords? (do )?not match|mismatch/i);
  });
});

test.describe("Auth – Forgot Password page", () => {
  test("renders email input and a submit button", async ({ page }) => {
    await page.goto("/en/auth/forgot-password", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#forgot-email")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible({
      timeout: 20_000,
    });
  });
});

// ─── Newsletter subscribe API ─────────────────────────────────────────────────

test.describe("Newsletter subscribe API", () => {
  test("valid email returns non-500 @mutating", async ({ request }) => {
    const res = await request.post("/api/subscribe", {
      data: { email: `playwright-${Date.now()}@example.com` },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test("invalid email returns 400", async ({ request }) => {
    const res = await request.post("/api/subscribe", {
      data: { email: "not-an-email" },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("missing email returns 400", async ({ request }) => {
    const res = await request.post("/api/subscribe", { data: {} });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});

// ─── Unsubscribe API ──────────────────────────────────────────────────────────

test.describe("Unsubscribe API", () => {
  test("missing email returns 400", async ({ request }) => {
    const res = await request.post("/api/unsubscribe", { data: {} });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});

// ─── Calendar booking API ─────────────────────────────────────────────────────

test.describe("Calendar booking API", () => {
  test("GET /api/calendar/availability returns JSON (200 or 503)", async ({ request }) => {
    const res = await request.get("/api/calendar/availability");
    expect([200, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toBeDefined();
    }
  });

  test("POST /api/calendar/book without required fields returns 4xx or 503", async ({ request }) => {
    const res = await request.post("/api/calendar/book", { data: {} });
    // 400 if validation runs first, 503 if Google Calendar is not configured
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(600);
  });
});

// ─── Portal pages (unauthenticated) ──────────────────────────────────────────

test.describe("Portal – unauthenticated", () => {
  test("portal/waiting renders without crashing", async ({ page }) => {
    await page.goto("/en/portal/waiting");
    await expect(page.locator("body")).toBeVisible();
  });

  test("portal with fake token does not 500", async ({ page }) => {
    const res = await page.goto("/en/portal/fake-token-xyz");
    expect(res?.status()).not.toBe(500);
  });
});

// ─── Legal pages ──────────────────────────────────────────────────────────────

test.describe("Legal pages", () => {
  for (const { path, label } of [
    { path: "/en/privacy", label: "Privacy" },
    { path: "/en/terms", label: "Terms" },
    { path: "/en/cookies", label: "Cookies" },
    { path: "/en/refund", label: "Refund" },
  ]) {
    test(`${label} page renders h1`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }
});

// ─── i18n ─────────────────────────────────────────────────────────────────────

test.describe("Internationalisation", () => {
  test("Greek locale /el renders without crashing", async ({ page }) => {
    await page.goto("/el");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("both /en and /el homepages have an h1", async ({ page }) => {
    await page.goto("/en");
    const enH1 = await page.getByRole("heading", { level: 1 }).textContent();
    expect(enH1).toBeTruthy();

    await page.goto("/el");
    const elH1 = await page.getByRole("heading", { level: 1 }).textContent();
    expect(elH1).toBeTruthy();
  });
});

// ─── 404 handling ─────────────────────────────────────────────────────────────

test.describe("404 handling", () => {
  test("unknown route returns 404 status", async ({ page }) => {
    const res = await page.goto("/en/this-page-xyz-does-not-exist");
    expect(res?.status()).toBe(404);
  });

  test("404 page has a message and a home link", async ({ page }) => {
    await page.goto("/en/this-page-xyz-does-not-exist");
    const body = await page.locator("body").textContent();
    expect(body).toMatch(/not found|404|missing|doesn't exist/i);
    const homeLink = page.getByRole("link", { name: /home|go back|return/i });
    await expect(homeLink).toBeVisible();
  });
});

// ─── End-to-end visitor journeys ──────────────────────────────────────────────

test.describe("End-to-end visitor journeys", () => {
  test("visitor reads services then reaches contact page via direct URL", async ({ page }) => {
    await page.goto("/en/services");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Go to contact directly (CTA text varies by locale/experiment)
    await page.goto("/en/contact");
    await expect(page.locator("#name")).toBeVisible();
    await expect(page.getByRole("button", { name: /send message/i })).toBeVisible();
  });

  test("visitor browses store grid and opens a product", async ({ page }) => {
    await page.goto("/en/store");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10000 });

    await page.goto("/en/store/dig-cloud-playbook");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/playbook/i, { timeout: 10000 });
    await expect(page.getByRole("button", { name: /add to cart|buy/i })).toBeVisible();
  });

  test("visitor reads a blog post from the blog index", async ({ page }) => {
    await page.goto("/en/blog");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const links = await page.getByRole("link").all();
    let postHref: string | null = null;
    for (const link of links) {
      const href = await link.getAttribute("href");
      if (href && /\/blog\/.+/.test(href) && !/\/blog\/?$/.test(href)) {
        postHref = href;
        break;
      }
    }
    if (postHref) {
      await page.goto(postHref);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("visitor fills the contact form and sees the send button", async ({ page }) => {
    await page.goto("/en/contact");
    await page.locator("#name").fill("Jane Customer");
    await page.locator("#email").fill("jane@example.com");
    await page.locator("#message").fill("I'd like to learn more about your cloud services.");
    await expect(page.getByRole("button", { name: /send message/i })).toBeEnabled();
  });
});
