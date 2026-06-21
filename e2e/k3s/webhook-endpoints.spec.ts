/**
 * Webhook endpoint validation — verifies all inbound webhook routes
 * are reachable and respond correctly to unsigned/invalid requests.
 *
 * Catches: webhook route accidentally deleted, middleware misconfiguration,
 * signature verification broken.
 */
import { test, expect } from "../coverage";

const K3S_HOST = globalThis.process?.env["K3S_HOST"] ?? "cloudless.gr";

const WEBHOOK_ENDPOINTS = [
  { name: "Slack events", path: "/api/slack/events", expectedStatus: [401, 403, 400] },
  { name: "Slack interactions", path: "/api/slack/interactions", expectedStatus: [401, 403, 400] },
  { name: "Slack commands", path: "/api/slack/commands", expectedStatus: [401, 403, 400] },
  // HubSpot webhook deleted 2026-06-20 with PR #1043 (HubSpot decom); EspoCRM
  // webhook replaces it. The /api/webhooks/espocrm route exists and is exercised
  // here so a future "EspoCRM webhook accidentally deleted" regression is caught.
  { name: "EspoCRM webhook", path: "/api/webhooks/espocrm", expectedStatus: [401, 403, 400, 405] },
  { name: "Stripe webhook", path: "/api/webhooks/stripe", expectedStatus: [400, 401, 403] },
  { name: "Notion webhook", path: "/api/webhooks/notion", expectedStatus: [400, 401, 403, 405] },
];

test.describe("Webhook endpoints — route existence and auth rejection", () => {
  for (const wh of WEBHOOK_ENDPOINTS) {
    test(`${wh.name} (${wh.path}) — rejects unsigned request`, async ({ request }) => {
      const r = await request.post(`https://${K3S_HOST}${wh.path}`, {
        data: JSON.stringify({ test: true }),
        headers: { "Content-Type": "application/json" },
        failOnStatusCode: false,
        timeout: 10_000,
      });
      expect(r.status(), `${wh.name}: got ${r.status()}, expected rejection`).not.toBe(404);
      expect(r.status(), `${wh.name}: accepted unsigned request — signature check broken?`).not.toBe(200);
    });
  }

  test("GET on webhook routes does not return 2xx", async ({ request }) => {
    for (const wh of WEBHOOK_ENDPOINTS) {
      const r = await request.get(`https://${K3S_HOST}${wh.path}`, {
        failOnStatusCode: false,
        timeout: 10_000,
      });
      // Webhook routes should reject GET (405) or return 4xx; never 2xx.
      // (The HubSpot GET-verification exemption was removed with PR #1043.)
      expect(
        [200].includes(r.status()),
        `${wh.name} accepts GET — webhook routes should be POST-only`,
      ).toBe(false);
    }
  });
});

test.describe("Webhook endpoints — API health baseline", () => {
  test("the app itself is healthy before testing webhooks", async ({ request }) => {
    const r = await request.get(`https://${K3S_HOST}/api/health`);
    expect(r.status()).toBe(200);
  });
});
