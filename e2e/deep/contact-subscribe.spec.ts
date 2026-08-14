import { test, expect } from "@playwright/test";
import { api, expectJson, expectClientError, GUEST_STORAGE } from "./_helpers";

test.use({ storageState: GUEST_STORAGE });

const VALID = {
  name: "E2E Deep",
  email: "e2e-deep@example.invalid",
  service: "Cloud Architecture & Migration",
  message: "Deep suite contact probe — ignore.",
};

test.describe("Contact + newsletter contracts", () => {
  test.describe.configure({ mode: "serial" });
  test("GET /api/contact is POST-only 405", async ({ request }) => {
    const res = await api(request, "get", "/api/contact");
    expect(res.status()).toBe(405);
    const body = await expectJson(res);
    expect(String(body.error)).toMatch(/post only/i);
  });

  test("POST /api/contact rejects malformed JSON with 400", async ({ request }) => {
    const res = await api(request, "post", "/api/contact", {
      headers: { "content-type": "application/json" },
      data: Buffer.from("{", "utf8"),
    });
    expectClientError(res.status(), "malformed contact JSON");
    const body = await expectJson(res);
    expect(String(body.error)).toMatch(/invalid|string/i);
  });

  test("POST /api/contact requires name, email, and message as strings", async ({ request }) => {
    const missing = await api(request, "post", "/api/contact", {
      data: { name: "", email: "", message: "" },
    });
    expect(missing.status()).toBe(400);
    expect(String((await expectJson(missing)).error)).toMatch(/required/i);

    const types = await api(request, "post", "/api/contact", {
      data: { name: ["x"], email: "a@b.c", message: "hi" },
    });
    expect(types.status()).toBe(400);
    expect(String((await expectJson(types)).error)).toMatch(/string/i);
  });

  test("POST /api/contact rejects an invalid email", async ({ request }) => {
    const res = await api(request, "post", "/api/contact", {
      data: { ...VALID, email: "not-an-email" },
    });
    expect(res.status()).toBe(400);
    expect(String((await expectJson(res)).error)).toMatch(/email/i);
  });

  test("POST /api/contact rejects whitespace-only message", async ({ request }) => {
    const res = await api(request, "post", "/api/contact", {
      data: { ...VALID, message: "   " },
    });
    expect(res.status()).toBe(400);
    expect(String((await expectJson(res)).error)).toMatch(/empty|whitespace/i);
  });

  test("POST /api/contact valid payload never 500s @mutating", async ({ request }) => {
    const res = await api(request, "post", "/api/contact", { data: VALID });
    expect([200, 201, 202, 403, 429, 503]).toContain(res.status());
    expect(res.status()).not.toBe(500);
    const body = await expectJson(res);
    if (res.status() >= 400) {
      expect(body.error).toBeTruthy();
    }
  });

  test("contact endpoint rate-limits a burst from one IP @mutating", async ({ request }) => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await api(request, "post", "/api/contact", {
        data: { ...VALID, message: `rate-limit probe ${i}` },
      });
      statuses.push(res.status());
      if (res.status() === 429) break;
    }
    // Either we hit the 5/10min cap, or a prior worker already exhausted it.
    expect(statuses.some((s) => s === 429 || s === 200 || s === 201 || s === 503)).toBeTruthy();
    if (!statuses.includes(429) && statuses.filter((s) => s < 400).length > 5) {
      expect(statuses, "expected 429 after more than 5 contact posts").toContain(429);
    }
  });

  test("GET /api/subscribe is POST-only; invalid email is 400", async ({ request }) => {
    expect((await api(request, "get", "/api/subscribe")).status()).toBe(405);
    const bad = await api(request, "post", "/api/subscribe", { data: { email: "nope" } });
    expect(bad.status()).toBe(400);
    expect(String((await expectJson(bad)).error)).toMatch(/email/i);
  });

  test("contact page form is labelled and blocks empty submit", async ({ page }) => {
    await page.goto("/en/contact");
    const form = page.getByTestId("contact-form");
    await expect(form).toBeVisible({ timeout: 20_000 });
    await expect(form.locator("#name, input[name=name]").first()).toBeVisible();
    await expect(form.locator("#email, input[name=email]").first()).toBeVisible();
    await expect(form.locator("#message, textarea[name=message]").first()).toBeVisible();
    await form.locator('button[type="submit"]').click();
    const name = form.locator("#name, input[name=name]").first();
    const invalid = await name.evaluate((el) => (el as HTMLInputElement).validity.valueMissing);
    expect(invalid).toBe(true);
  });
});
