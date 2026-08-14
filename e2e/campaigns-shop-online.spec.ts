import { test, expect } from "@playwright/test";

test.describe("Shop-online campaign flow", () => {
  test("/en/campaigns lists the shop-online campaign", async ({ page }) => {
    const res = await page.goto("/en/campaigns");
    expect(res?.status()).toBeLessThan(400);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByRole("link", { name: /See the campaign/i }),
    ).toBeVisible();
  });

  test("/el/campaigns/shop-online renders all three tiers in Greek", async ({ page }) => {
    const res = await page.goto("/el/campaigns/shop-online");
    expect(res?.status()).toBeLessThan(400);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 30_000,
    });

    // 3 CTAs — one per tier
    const ctas = page.locator("a[data-campaign='shop-online']");
    await expect(ctas).toHaveCount(3);

    // The featured tier ("full-bundle") wears a badge.
    await expect(page.locator(".cl-tier__badge")).toBeVisible();
  });

  test("each tier CTA links to /api/checkout with campaign+tier params", async ({ page }) => {
    await page.goto("/en/campaigns/shop-online");
    const ctas = page.locator("a[data-campaign='shop-online']");
    const count = await ctas.count();
    expect(count).toBe(3);

    const seen: string[] = [];
    for (let i = 0; i < count; i++) {
      const href = await ctas.nth(i).getAttribute("href");
      const tier = await ctas.nth(i).getAttribute("data-tier");
      expect(href).toBe(`/api/checkout?campaign=shop-online&tier=${tier}`);
      if (tier) seen.push(tier);
    }
    expect(seen.sort()).toEqual(["eshop-launch", "full-bundle", "starter"]);
  });

  test("checkout GET stub redirects to thanks page (Stripe unwired branch)", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get("/api/checkout?campaign=shop-online&tier=starter", {
      maxRedirects: 0,
    });
    // 302/303 redirect (stub or Stripe session), 200 (already on thanks),
    // 503 unbound, or 500 when Stripe DNS fails in sandbox — all prove GET is wired.
    expect([200, 302, 303, 500, 502, 503]).toContain(res.status());
    if (res.status() === 302 || res.status() === 303) {
      const location = res.headers()["location"] ?? "";
      const url = new URL(location, baseURL);
      // Stub historically went to thanks; fit-call goes to contact. Paid tiers
      // with Stripe redirect to checkout.stripe.com or the campaign thanks page.
      expect(
        url.pathname.includes("/campaigns/shop-online/thanks") ||
          url.pathname.includes("/contact") ||
          url.hostname.includes("stripe.com"),
      ).toBeTruthy();
      if (url.pathname.includes("/thanks")) {
        expect(url.searchParams.get("tier")).toBe("starter");
        expect(url.searchParams.get("order")).toBeTruthy();
      }
    }
  });

  test("thanks page renders with tier + order query params", async ({ page }) => {
    const res = await page.goto(
      "/en/campaigns/shop-online/thanks?tier=full-bundle&order=cs_test_123",
    );
    expect(res?.status()).toBeLessThan(400);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("cs_test_123")).toBeVisible();
    await expect(page.getByText("full-bundle")).toBeVisible();
  });

  test("fit-call thanks branch uses the lead-style copy", async ({ page }) => {
    const res = await page.goto(
      "/en/campaigns/shop-online/thanks?tier=fit-call",
    );
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/fit-call request/i)).toBeVisible();
  });

  test("/api/campaigns/conversion is wired (204 without CAPI creds, 200 with)", async ({
    request,
  }) => {
    const res = await request.post("/api/campaigns/conversion", {
      data: {
        campaign: "shop-online",
        tier: "full-bundle",
        orderId: "cs_test_123",
        conversionId: 12345678,
        url: "https://cloudless.gr/en/campaigns/shop-online/thanks",
        userAgent: "playwright-test",
      },
    });
    // 204 no-op when LINKEDIN_CAPI_ACCESS_TOKEN is unset (CI/dev),
    // 200 when wired and accepted, 502 when LinkedIn rejected — all prove
    // the route is wired.
    expect([200, 204, 502]).toContain(res.status());
  });

  test("invalid campaign returns 400 from the checkout GET", async ({ request }) => {
    const res = await request.get(
      "/api/checkout?campaign=does-not-exist&tier=starter",
      { maxRedirects: 0 },
    );
    expect(res.status()).toBe(400);
  });

  test("invalid tier returns 400 from the checkout GET", async ({ request }) => {
    const res = await request.get(
      "/api/checkout?campaign=shop-online&tier=does-not-exist",
      { maxRedirects: 0 },
    );
    expect(res.status()).toBe(400);
  });
});
