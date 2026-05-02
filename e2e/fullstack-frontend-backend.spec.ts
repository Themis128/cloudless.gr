import { expect, test, type APIRequestContext } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const PUBLIC_FRONTEND_ROUTES = [
  "/en",
  "/en/services",
  "/en/store",
  "/en/blog",
  "/en/contact",
  "/en/docs",
  "/en/privacy",
  "/en/terms",
  "/en/refund",
  "/en/cookies",
  "/el",
  "/fr",
  "/de",
];

let requestCounter = 0;
function nextIp() {
  requestCounter += 1;
  return `198.51.100.${requestCounter % 254}`;
}

async function postJson(
  request: APIRequestContext,
  url: string,
  data: unknown,
) {
  return request.post(url, {
    data,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": nextIp(),
    },
  });
}

async function expectValidationOrRateLimit(
  response: Awaited<ReturnType<typeof postJson>>,
) {
  const status = response.status();
  expect([400, 429]).toContain(status);

  if (status === 429) {
    const body = await response.json();
    expect(String(body.error ?? "")).toMatch(/too many requests/i);
  }
}

test.describe("Full-stack frontend coverage", () => {
  for (const route of PUBLIC_FRONTEND_ROUTES) {
    test(`public route responds and renders main content: ${route}`, async ({
      page,
    }) => {
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });

      const status = response?.status() ?? 0;
      expect(status, `${route} returned HTTP ${status}`).toBeLessThan(400);
      await expect(page.locator("#main-content")).toBeVisible();
    });
  }

  test("dashboard route is protected and redirects unauthenticated users", async ({
    page,
  }) => {
    const response = await page.request.get("/en/dashboard", { maxRedirects: 0 });
    expect([307, 308]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/en/auth/login");
  });

  test("admin route is protected and redirects unauthenticated users", async ({
    page,
  }) => {
    const response = await page.request.get("/en/admin", { maxRedirects: 0 });
    expect([307, 308]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/en/auth/login");
  });
});

test.describe("Full-stack backend coverage", () => {
  test("health endpoint returns status payload", async ({ page }) => {
    const response = await page.request.get("/api/health");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(typeof body.timestamp).toBe("string");
  });

  test("blog posts endpoint responds successfully", async ({ page }) => {
    const response = await page.request.get("/api/blog/posts");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.posts) || Array.isArray(body)).toBeTruthy();
  });

  test("contact endpoint validates required fields", async ({ page }) => {
    const response = await postJson(page.request, "/api/contact", { name: "Only" });
    await expectValidationOrRateLimit(response);
  });

  test("subscribe endpoint rejects invalid email", async ({ page }) => {
    const response = await postJson(page.request, "/api/subscribe", {
      email: "invalid-email",
    });
    await expectValidationOrRateLimit(response);
  });

  test("checkout endpoint rejects empty cart", async ({ page }) => {
    const response = await postJson(page.request, "/api/checkout", { items: [] });
    await expectValidationOrRateLimit(response);
  });

  test("user purchases endpoint requires authentication", async ({ page }) => {
    const response = await page.request.get("/api/user/purchases");
    expect(response.status()).toBe(401);
  });

  test("user consultations endpoint requires authentication", async ({ page }) => {
    const response = await page.request.get("/api/user/consultations");
    expect(response.status()).toBe(401);
  });

  test("admin orders endpoint blocks unauthenticated access", async ({ page }) => {
    const response = await page.request.get("/api/admin/orders");
    expect([401, 403]).toContain(response.status());
  });
});
