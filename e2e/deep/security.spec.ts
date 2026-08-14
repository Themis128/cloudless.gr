import { test, expect } from "@playwright/test";
import { api, expectJson, GUEST_STORAGE } from "./_helpers";

test.use({ storageState: GUEST_STORAGE });

test.describe("Security headers and webhook auth", () => {
  test("HTML pages send CSP, frame deny, and nosniff", async ({ request }) => {
    const res = await api(request, "get", "/en");
    expect(res.status()).toBeLessThan(400);
    const h = res.headers();
    expect(h["content-security-policy"] ?? h["content-security-policy-report-only"]).toBeTruthy();
    expect(h["x-frame-options"]?.toLowerCase()).toBe("deny");
    expect(h["x-content-type-options"]?.toLowerCase()).toBe("nosniff");
    expect(h["referrer-policy"]).toMatch(/strict-origin/i);
  });

  test("Stripe webhook without a signature is 400 JSON", async ({ request }) => {
    const res = await api(request, "post", "/api/webhooks/stripe", {
      data: { type: "checkout.session.completed" },
    });
    expect(res.status()).toBe(400);
    const body = await expectJson(res);
    expect(String(body.error)).toMatch(/signature/i);
  });

  test("Stripe webhook with a junk signature is 400 or 401, never 200", async ({ request }) => {
    const res = await api(request, "post", "/api/webhooks/stripe", {
      headers: { "stripe-signature": "t=1,v1=deadbeef" },
      data: { type: "checkout.session.completed" },
    });
    expect([400, 401, 503]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("EspoCRM webhook without a secret is 401", async ({ request }) => {
    const res = await api(request, "post", "/api/webhooks/espocrm", {
      data: { event: "Contact.create" },
    });
    expect(res.status()).toBe(401);
    const body = await expectJson(res);
    expect(String(body.error)).toMatch(/unauthor/i);
  });

  test("checkout POST does not honour a foreign Origin for redirects", async ({ request }) => {
    const res = await api(request, "post", "/api/checkout", {
      headers: { origin: "https://evil.example" },
      data: { items: [{ id: "srv-cloud", quantity: 1 }] },
    });
    // Unconfigured Stripe → 503; configured → JSON url on cloudless.gr, never evil.example
    expect([200, 400, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await expectJson(res);
      expect(String(body.url ?? "")).not.toMatch(/evil\.example/);
    }
  });
});
