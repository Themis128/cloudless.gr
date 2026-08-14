import { test, expect } from "@playwright/test";
import { api, expectJson, expectClientError, GUEST_STORAGE } from "./_helpers";
import { openMobileNavIfNeeded } from "../helpers/mobile-nav";

test.use({ storageState: GUEST_STORAGE });

test.describe("Store, cart, checkout", () => {
  test("store grid lists priced product cards that open a PDP", async ({ page }) => {
    await page.goto("/en/store");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
    const cards = page.getByTestId("product-card");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
    await expect(cards.first()).toContainText(/€|EUR|\$/i);

    const pdp = page.locator('a[href*="/store/srv-cloud"]').first();
    await expect(pdp).toBeVisible();
    await pdp.click();
    await expect(page).toHaveURL(/\/en\/store\/srv-cloud/);
    await expect(page.getByRole("heading", { name: /cloud architecture audit/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible();
  });

  test("add to cart opens the drawer with the product and a total", async ({ page }) => {
    await page.goto("/en/store/srv-cloud");
    await page.getByRole("button", { name: /add to cart/i }).click();
    const drawer = page.getByTestId("cart-drawer");
    await expect(drawer).toHaveAttribute("data-open", "true");
    await expect(drawer).toContainText(/cloud architecture audit/i);
    await expect(drawer.getByRole("button", { name: /checkout/i })).toBeVisible();
    await expect(drawer).toContainText(/€|EUR/i);
  });

  test("mixed one-time + subscription cart blocks checkout in the UI", async ({ page }) => {
    await page.goto("/en/store/srv-cloud");
    await page.getByRole("button", { name: /add to cart/i }).click();
    await page.getByRole("button", { name: /close cart/i }).click();
    await page.goto("/en/store/srv-growth");
    await page.getByRole("button", { name: /subscribe/i }).click();
    const drawer = page.getByTestId("cart-drawer");
    await expect(drawer).toHaveAttribute("data-open", "true");
    await expect(drawer.getByRole("button", { name: /checkout/i })).toBeDisabled();
    await expect(drawer).toContainText(/can't be purchased together|cannot be purchased together/i);
  });

  test("POST /api/checkout empty cart is 400 with a stable error", async ({ request }) => {
    const res = await api(request, "post", "/api/checkout", { data: {} });
    expectClientError(res.status(), "empty checkout");
    const body = await expectJson(res);
    expect(String(body.error)).toMatch(/no items|cart/i);
  });

  test("POST /api/checkout unknown product is 400, never 500", async ({ request }) => {
    const res = await api(request, "post", "/api/checkout", {
      data: { items: [{ id: "not-a-real-sku-e2e", quantity: 1 }] },
    });
    expect(res.status()).toBe(400);
    const body = await expectJson(res);
    expect(String(body.error)).toMatch(/unknown product/i);
  });

  test("GET /api/checkout requires campaign and tier", async ({ request }) => {
    const missing = await api(request, "get", "/api/checkout");
    expect(missing.status()).toBe(400);
    await expectJson(missing);

    const unknown = await api(request, "get", "/api/checkout?campaign=no-such&tier=starter");
    expect(unknown.status()).toBe(400);
    const body = await expectJson(unknown);
    expect(String(body.error)).toMatch(/campaign/i);
  });

  test("campaign fit-call checkout redirects to the contact form", async ({ request }) => {
    const res = await request.get("/api/checkout?campaign=shop-online&tier=fit-call", {
      maxRedirects: 0,
    });
    expect([302, 303, 307]).toContain(res.status());
    const loc = res.headers()["location"] ?? "";
    expect(loc).toMatch(/\/contact/);
    expect(loc).toMatch(/topic=fit-call/);
  });

  test("campaign paid tier either redirects to Stripe or 503s when unconfigured", async ({
    request,
  }) => {
    const res = await request.get("/api/checkout?campaign=shop-online&tier=starter", {
      maxRedirects: 0,
    });
    if (res.status() === 503) {
      const body = await expectJson(res);
      expect(String(body.error)).toMatch(/stripe/i);
      return;
    }
    expect([303, 302]).toContain(res.status());
    expect(res.headers()["location"]).toBeTruthy();
  });

  test("unknown product URL is a 404, not a blank 200", async ({ page }) => {
    const res = await page.goto("/en/store/not-a-real-sku-e2e");
    expect(res?.status()).toBe(404);
    await expect(page.locator("h1, h2, main").first()).toBeVisible();
  });

  test("success page renders confirmation copy without a Stripe session", async ({ page }) => {
    await page.goto("/en/store/success");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.locator("body")).toContainText(/order|thank|confirm/i);
  });

  test("header cart control is reachable on this viewport", async ({ page }) => {
    await page.goto("/en/store");
    await openMobileNavIfNeeded(page);
    await expect(page.getByTestId("cart").filter({ visible: true }).first()).toBeVisible();
  });
});
