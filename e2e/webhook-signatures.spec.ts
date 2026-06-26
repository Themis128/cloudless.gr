/**
 * Webhook signature rejection — negative-path coverage.
 *
 * The security audit confirmed all three webhook handlers (Stripe,
 * EspoCRM, Notion) verify signatures before touching the request body.
 * These tests pin that contract: requests without a valid signature
 * MUST be rejected with 4xx, never silently processed.
 *
 * These are smoke tests — they don't construct valid signatures, so
 * positive-path verification is left to the per-route logic and to live
 * traffic. The goal here is to fail fast if someone refactors a webhook
 * handler in a way that bypasses the gate.
 */

import { test, expect } from "@playwright/test";

const FAKE_BODY = JSON.stringify({ id: "evt_fake", type: "test" });

test.describe("webhook signature gates", () => {
  test("/api/webhooks/stripe rejects missing signature header", async ({ request }) => {
    const r = await request.post("/api/webhooks/stripe", {
      data: FAKE_BODY,
      headers: { "Content-Type": "application/json" },
    });
    // Stripe handler returns 400 on missing/invalid signature.
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test("/api/webhooks/stripe rejects invalid signature", async ({ request }) => {
    const r = await request.post("/api/webhooks/stripe", {
      data: FAKE_BODY,
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=1,v1=" + "0".repeat(64),
      },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  // EspoCRM webhook signature tests removed 2026-06-20 alongside the route
  // (PR #1043 — EspoCRM decom). EspoCRM webhook auth is URL-secret-based,
  // not HMAC; covered by `/api/webhooks/espocrm` tests elsewhere.

  test("/api/webhooks/content rejects missing signature", async ({ request }) => {
    const r = await request.post("/api/webhooks/content", {
      data: FAKE_BODY,
      headers: { "Content-Type": "application/json" },
    });
    expect(r.status()).toBeGreaterThanOrEqual(400);
    expect(r.status()).toBeLessThan(500);
  });

  test("/api/cron/* requires Bearer CRON_SECRET — rejects without auth", async ({
    request,
  }) => {
    const r = await request.get("/api/cron/voice-brief");
    expect(r.status()).toBe(401);
  });

  test("/api/cron/* rejects wrong Bearer token (constant-time compare path)", async ({
    request,
  }) => {
    const r = await request.get("/api/cron/voice-brief", {
      headers: { authorization: "Bearer wrong-secret-value" },
    });
    expect(r.status()).toBe(401);
  });
});
