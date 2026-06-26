import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

let reqCounter = 0;
function nextForwardedIp() {
  reqCounter += 1;
  return `203.0.113.${(reqCounter % 250) + 1}`;
}

async function postJson(
  request: APIRequestContext,
  url: string,
  data: unknown,
): Promise<APIResponse> {
  return request.post(url, {
    data,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": nextForwardedIp(),
    },
  });
}

async function postForm(
  request: APIRequestContext,
  url: string,
  form: Record<string, string>,
): Promise<APIResponse> {
  return request.post(url, {
    form,
    headers: {
      "x-forwarded-for": nextForwardedIp(),
    },
  });
}

test.describe("Integrations contracts", () => {
  test("Notion blog API returns posts with source marker", async ({ request }) => {
    const response = await request.get("/api/blog/posts");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.posts)).toBeTruthy();
    expect(["notion", "static"]).toContain(body.source);

    const sourceHeader = response.headers()["x-blog-source"];
    if (sourceHeader) {
      expect(["notion", "static"]).toContain(sourceHeader);
    }
  });

  test("Content webhook requires secret header", async ({ page }) => {
    const response = await postJson(page.request, "/api/webhooks/content", {
      type: "page.updated",
      database: "blog",
      page_id: "fake-page-id",
    });
    expect(response.status()).toBe(401);
  });

  test("Stripe checkout validates empty cart", async ({ page }) => {
    const response = await postJson(page.request, "/api/checkout", { items: [] });
    expect([400, 429]).toContain(response.status());
  });

  test("Stripe webhook requires signature header", async ({ page }) => {
    const response = await postJson(page.request, "/api/webhooks/stripe", {
      id: "evt_test",
      type: "checkout.session.completed",
    });
    expect(response.status()).toBe(400);
  });

  test("Slack event endpoint rejects unsigned requests", async ({ page }) => {
    const response = await postJson(page.request, "/api/slack/events", {
      type: "url_verification",
      challenge: "abc",
    });
    expect(response.status()).toBe(401);
  });

  test("Slack commands endpoint rejects unsigned requests", async ({ page }) => {
    const response = await postForm(page.request, "/api/slack/commands", {
      command: "/cloudless-status",
      text: "",
    });
    expect(response.status()).toBe(401);
  });

  test("Slack interactions endpoint rejects unsigned requests", async ({ page }) => {
    const response = await postForm(page.request, "/api/slack/interactions", {
      payload: JSON.stringify({ type: "block_actions", actions: [] }),
    });
    expect(response.status()).toBe(401);
  });

  test("EspoCRM webhook POST requires URL-secret auth", async ({ page }) => {
    // EspoCRM webhook replaced EspoCRM 2026-06-20 (PR #1043). Auth is a
    // URL-query-param secret (?secret=...), not HMAC. POST without secret → 4xx.
    const response = await postJson(page.request, "/api/webhooks/espocrm", {
      entity: "Lead",
      action: "create",
      id: "abc123",
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test("EspoCRM CRM upsert route handles invalid email or unconfigured CRM", async ({ page }) => {
    const response = await postJson(page.request, "/api/crm/contact", {
      email: "invalid-email",
    });
    expect([400, 429, 503]).toContain(response.status());
  });

  test("Calendar availability returns data or explicit not-configured error", async ({ page }) => {
    const response = await page.request.get("/api/calendar/availability?days=1", {
      headers: { "x-forwarded-for": nextForwardedIp() },
    });
    expect([200, 500, 503]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(Array.isArray(body.slots)).toBeTruthy();
    }
  });

  test("Calendar booking validates payload or reports unavailable service", async ({ page }) => {
    const response = await postJson(page.request, "/api/calendar/book", {
      email: "invalid-email",
    });
    expect([400, 429, 503]).toContain(response.status());
  });

  test("SES-backed subscribe endpoint rejects invalid email", async ({ page }) => {
    const response = await postJson(page.request, "/api/subscribe", {
      email: "bad-email",
    });
    expect([400, 429]).toContain(response.status());
  });

  test("SES-backed contact endpoint rejects missing required fields", async ({ page }) => {
    const response = await postJson(page.request, "/api/contact", {
      name: "OnlyName",
    });
    expect([400, 429]).toContain(response.status());
  });

  test("User purchases integration requires auth", async ({ page }) => {
    const response = await page.request.get("/api/user/purchases");
    expect(response.status()).toBe(401);
  });

  test("User consultations integration requires auth", async ({ page }) => {
    const response = await page.request.get("/api/user/consultations");
    expect(response.status()).toBe(401);
  });

  test("Sentry admin endpoint remains admin-protected", async ({ page }) => {
    const response = await page.request.get("/api/admin/ops/errors");
    expect([401, 403]).toContain(response.status());
  });
});
