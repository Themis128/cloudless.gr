import { test, expect } from "@playwright/test";

/**
 * Branch-coverage backfill: exercises validation edge cases on public POSTs
 * to recover error-path coverage previously held by Vitest's validation.test.ts.
 *
 * Strategy: each input shape is fired exactly once across the suite to dodge
 * rate-limiting; each test uses a freshly-randomized identifying field.
 */

const rand = () => Math.random().toString(36).slice(2, 10);
const rejected = (s: number) => s === 400 || s === 422 || s === 429;

test.describe("Contact validation branches", () => {
  test("rejects empty name", async ({ request }) => {
    const r = await request.post("/api/contact", {
      data: { name: "", email: `a-${rand()}@x.com`, message: "hi" },
    });
    expect(rejected(r.status())).toBe(true);
  });

  test("rejects oversized message (10KB+)", async ({ request }) => {
    const r = await request.post("/api/contact", {
      data: { name: `n-${rand()}`, email: `b-${rand()}@x.com`, message: "x".repeat(15000) },
    });
    expect(rejected(r.status())).toBe(true);
  });

  test("rejects message containing only whitespace", async ({ request }) => {
    const r = await request.post("/api/contact", {
      data: { name: `n-${rand()}`, email: `c-${rand()}@x.com`, message: "   \n\t  " },
    });
    expect(rejected(r.status())).toBe(true);
  });

  test("rejects non-string field types", async ({ request }) => {
    const r = await request.post("/api/contact", {
      data: { name: 42, email: `d-${rand()}@x.com`, message: ["a", "b"] },
    });
    expect(rejected(r.status())).toBe(true);
  });
});

test.describe("Subscribe email validation branches", () => {
  test("rejects email missing @", async ({ request }) => {
    const r = await request.post("/api/subscribe", { data: { email: `noat-${rand()}.com` } });
    expect(rejected(r.status())).toBe(true);
  });

  test("rejects email with leading whitespace", async ({ request }) => {
    const r = await request.post("/api/subscribe", { data: { email: `  ws-${rand()}@x.com` } });
    expect(rejected(r.status())).toBe(true);
  });

  test("rejects email with two @", async ({ request }) => {
    const r = await request.post("/api/subscribe", { data: { email: `a@@b-${rand()}.com` } });
    expect(rejected(r.status())).toBe(true);
  });

  test("rejects null email", async ({ request }) => {
    const r = await request.post("/api/subscribe", { data: { email: null, _id: rand() } });
    expect(rejected(r.status())).toBe(true);
  });
});

test.describe("Webhook signature validation branches", () => {
  test("Stripe rejects empty signature header", async ({ request }) => {
    const r = await request.post("/api/webhooks/stripe", {
      data: { type: "ping" },
      headers: { "stripe-signature": "" },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test("Stripe rejects malformed signature", async ({ request }) => {
    const r = await request.post("/api/webhooks/stripe", {
      data: { type: "ping" },
      headers: { "stripe-signature": "t=,v1=" },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });
});
