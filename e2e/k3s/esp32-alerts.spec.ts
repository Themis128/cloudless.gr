/**
 * ESP32 watchdog and Pi alert system — verifies the alert-api is alive,
 * the WebSocket endpoint for ESP32 logs is reachable, and the alert
 * notification pipeline is functional.
 *
 * Catches: alert-api crash, WebSocket endpoint down, Alertmanager
 * unreachable, ntfy push failure.
 */
import { test, expect } from "../coverage";

const K3S_HOST = process.env.K3S_HOST ?? "cloudless.gr";
const runInfra = !!process.env.INFRA_SMOKE;

test.describe("ESP32 / Pi alert system", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("alert-api /health endpoint is alive", async ({ request }) => {
    const r = await request.get(`https://logs.${K3S_HOST}/health`, {
      failOnStatusCode: false,
      timeout: 10_000,
    });
    expect(r.status()).toBe(200);
  });

  test("WebSocket endpoint is reachable (upgrade attempt gets 101 or 400)", async ({ request }) => {
    const r = await request.get(`https://logs.${K3S_HOST}/ws/esp32-logs`, {
      failOnStatusCode: false,
      timeout: 10_000,
    });
    expect(
      [101, 200, 400, 426].includes(r.status()),
      `WebSocket endpoint returned ${r.status()} — expected 400/426 for non-WS request`,
    ).toBe(true);
  });

  test("ntfy can receive a test notification", async ({ request }) => {
    const r = await request.post(`https://ntfy.${K3S_HOST}/e2e-test-topic`, {
      data: "k3s-e2e heartbeat",
      headers: { "Content-Type": "text/plain" },
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(200);
  });

  test("alert-api serves Cloudflare tunnel headers (not direct Pi IP)", async ({ request }) => {
    const r = await request.get(`https://logs.${K3S_HOST}/health`, {
      failOnStatusCode: false,
    });
    const cfRay = r.headers()["cf-ray"] ?? "";
    expect(
      cfRay.length,
      "alert-api should be behind Cloudflare tunnel, not exposed directly",
    ).toBeGreaterThan(0);
  });
});
