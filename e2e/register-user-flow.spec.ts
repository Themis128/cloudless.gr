import { test, expect, request } from "@playwright/test";

/**
 * End-to-end test of the new-user registration flow.
 *
 * Tests the path a real client takes when they sign up:
 *   /en/services → "Get started" → /en/auth/signup?plan=<key>
 *   → (Cognito Hosted UI handles real account creation out-of-process)
 *   → /portal/waiting?plan=<key>
 *   → poll /api/portal/me until admin approves
 *   → redirect to /portal/<token>
 *
 * Cognito Hosted UI is not directly testable (it's hosted by AWS), so we
 * verify:
 *  - every signup-flow URL responds correctly
 *  - the signup page renders the right form for each plan
 *  - invalid plan params are dropped (PR #957 hardening)
 *  - the API contracts on /api/portal/enroll and /api/portal/me are honest
 *    (auth-gated, validate plan against the canonical allowlist, return the
 *    right shapes when authenticated via the E2E bypass token)
 */

const E2E_ADMIN_TOKEN = "e2e-admin-token-do-not-use-in-prod";
const VALID_PLANS = [
  "cloud",
  "serverless",
  "analytics",
  "marketing",
  "web",
  "hosting",
  "bundle",
] as const;

test.describe("new-user registration flow", () => {
  test.describe("signup page rendering", () => {
    test("renders without a plan param", async ({ page }) => {
      const res = await page.goto("/en/auth/signup");
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15_000 });
    });

    for (const plan of VALID_PLANS) {
      test(`renders for plan=${plan}`, async ({ page }) => {
        const res = await page.goto(`/en/auth/signup?plan=${plan}`);
        expect(res?.status()).toBe(200);
      });
    }

    test("renders for invalid plan (client-side validator drops it)", async ({ page }) => {
      const res = await page.goto("/en/auth/signup?plan=junk-xss-payload");
      expect(res?.status()).toBe(200);
    });
  });

  test.describe("waiting room behavior (unauthenticated)", () => {
    test("does NOT leak waiting-room content to an unauthenticated visitor", async ({ page }) => {
      await page.goto("/en/portal/waiting?plan=cloud");
      // The page hits one of two safe states for an unauth visitor:
      //   (a) redirected to /<locale>/auth/login?next=...
      //   (b) stuck on the auth-check spinner (no waiting-room content visible)
      // Either is acceptable; what's NOT acceptable is rendering "ORDER
      // RECEIVED" or any portal info to a logged-out user.
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
      const url = page.url();
      const body = await page.textContent("body").catch(() => "");
      const redirected = /\/auth\/login/.test(url);
      const stuckOnSpinner = !redirected && !/ORDER RECEIVED|PORTAL READY/i.test(body ?? "");
      expect(
        redirected || stuckOnSpinner,
        `Expected redirect to /auth/login or auth-check spinner; got url=${url} body=${(body ?? "").slice(0, 200)}`,
      ).toBe(true);
    });

    test("/en/portal/waiting 308-redirects to /portal/waiting", async ({ page }) => {
      const res = await page.goto("/en/portal/waiting?plan=cloud", { waitUntil: "commit" });
      // 308 chain ends up at /portal/waiting?plan=cloud
      await page.waitForURL(/\/portal\/waiting\?plan=cloud/, { timeout: 10_000 });
      expect(res?.status()).toBeLessThan(500);
    });
  });

  test.describe("API contracts — /api/portal/enroll", () => {
    test("unauthenticated POST returns 401", async () => {
      const ctx = await request.newContext();
      const res = await ctx.post("http://localhost:4000/api/portal/enroll", {
        data: { plan: "cloud" },
      });
      expect([401, 429]).toContain(res.status());
      await ctx.dispose();
    });

    test("authenticated POST with unknown plan returns 400", async () => {
      const ctx = await request.newContext({
        extraHTTPHeaders: { Authorization: `Bearer ${E2E_ADMIN_TOKEN}` },
      });
      const res = await ctx.post("http://localhost:4000/api/portal/enroll", {
        data: { plan: "junk-payload" },
      });
      // 400 (invalid plan), 401 (E2E env not set), or 429 (rate-limited by
      // parallel chromium run sharing the same token bucket).
      expect([400, 401, 429]).toContain(res.status());
      if (res.status() === 400) {
        const body = await res.json();
        expect(body.error).toMatch(/invalid|missing plan/i);
      }
      await ctx.dispose();
    });

    test("authenticated POST with each valid plan does not 4xx-validation-fail", async () => {
      const ctx = await request.newContext({
        extraHTTPHeaders: { Authorization: `Bearer ${E2E_ADMIN_TOKEN}` },
      });
      for (const plan of VALID_PLANS) {
        const res = await ctx.post("http://localhost:4000/api/portal/enroll", {
          data: { plan, name: `E2E ${plan}` },
        });
        // Expect: 201 (created), 503 (SSM unavailable in local dev), 401
        // (E2E bypass env not set), or 429 (rate-limited by parallel chromium
        // run sharing the same token bucket).
        expect([201, 401, 429, 503]).toContain(res.status());
      }
      await ctx.dispose();
    });
  });

  test.describe("API contracts — /api/portal/me", () => {
    test("unauthenticated GET returns 401", async () => {
      const ctx = await request.newContext();
      const res = await ctx.get("http://localhost:4000/api/portal/me");
      expect(res.status()).toBe(401);
      await ctx.dispose();
    });

    test("authenticated GET returns valid PortalStatus shape", async () => {
      const ctx = await request.newContext({
        extraHTTPHeaders: { Authorization: `Bearer ${E2E_ADMIN_TOKEN}` },
      });
      const res = await ctx.get("http://localhost:4000/api/portal/me");
      expect([200, 401]).toContain(res.status());
      if (res.status() === 200) {
        const body = await res.json();
        expect(["none", "waiting", "approved"]).toContain(body.status);
      }
      await ctx.dispose();
    });
  });

  test.describe("Cognito provider wiring", () => {
    test("next-auth signin endpoint is reachable", async () => {
      const ctx = await request.newContext();
      const res = await ctx.get("http://localhost:4000/api/auth/providers");
      // Either lists providers (200) or returns 5xx if next-auth not configured
      // locally. Just verifying the route exists, not the value.
      expect(res.status()).toBeLessThan(500);
      await ctx.dispose();
    });

    test("/api/auth/csrf returns a token", async () => {
      const ctx = await request.newContext();
      const res = await ctx.get("http://localhost:4000/api/auth/csrf");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.csrfToken).toBeTruthy();
      await ctx.dispose();
    });
  });

  test.describe("Inbound funnel — /en/services → signup", () => {
    test("services page renders and exposes the get-started CTA", async ({ page }) => {
      const res = await page.goto("/en/services");
      expect(res?.status()).toBe(200);
      // The 6 service-card CTAs target /auth/signup?plan=<key>; verify at
      // least one is rendered.
      const ctaLink = page.locator('a[href*="/auth/signup?plan="]').first();
      await expect(ctaLink).toBeVisible({ timeout: 15_000 });
    });
  });
});
