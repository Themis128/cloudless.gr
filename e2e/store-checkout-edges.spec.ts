/**
 * Store / checkout — edge cases.
 *
 * `journey-store-checkout.spec.ts` covers the happy path (storefront
 * renders, /api/checkout rejects unknown productId, success page loads).
 * This spec adds the failure paths that ship every Stripe rollout:
 *
 *   - /api/checkout with malformed body shapes (missing productId,
 *     non-string productId, very-long productId)
 *   - /api/checkout with rate-limit-triggering rapid submits — the
 *     handler must stay < 500 (whatever rate-limit response it picks
 *     is fine; an unhandled throw is not).
 *   - /store/success?session_id=invalid renders a friendly state, not
 *     a 5xx error page.
 *   - /store/[id] with a non-existent id renders a 404, not a 5xx.
 *
 * Stripe is never reached — these all hit the validation layer.
 */
import { test, expect } from "@playwright/test";

test.describe("/api/checkout malformed bodies", () => {
  test("missing productId is rejected with 4xx", async ({ request }) => {
    const r = await request.post("/api/checkout", { data: { foo: "bar" } });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test("non-string productId is rejected with 4xx", async ({ request }) => {
    const r = await request.post("/api/checkout", {
      data: { productId: 12345 },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test("excessively long productId does not 5xx", async ({ request }) => {
    const r = await request.post("/api/checkout", {
      data: { productId: "x".repeat(5000) },
    });
    // 4xx (validation reject) is the right answer; we just need the
    // handler to gracefully bound the input and not blow up.
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test("array productId is rejected with 4xx", async ({ request }) => {
    const r = await request.post("/api/checkout", {
      data: { productId: ["a", "b"] },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });
});

test.describe("/api/checkout rapid-fire", () => {
  test("5 rapid requests all resolve with < 500", async ({ request }) => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request.post("/api/checkout", {
          data: { productId: "burst-probe-" + Date.now() },
        }),
      ),
    );
    for (const r of results) {
      expect(r.status()).toBeGreaterThanOrEqual(200);
      expect(r.status()).toBeLessThan(500);
    }
  });
});

test.describe("/store success + 404 pages", () => {
  test("/en/store/success?session_id=invalid renders without 5xx", async ({ page }) => {
    const r = await page.goto("/en/store/success?session_id=cs_test_invalid", {
      waitUntil: "domcontentloaded",
    });
    expect(r?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("h1, h2, main").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("/en/store/success with no query renders without 5xx", async ({ page }) => {
    const r = await page.goto("/en/store/success", {
      waitUntil: "domcontentloaded",
    });
    expect(r?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("h1, h2, main").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("/en/store/[unknown-id] resolves cleanly (404 or 200 with not-found UI)", async ({ page }) => {
    const r = await page.goto("/en/store/this-product-does-not-exist-zzz", {
      waitUntil: "domcontentloaded",
    });
    // 404 or 200 are both fine; a 5xx is not.
    const status = r?.status() ?? 0;
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });
});
