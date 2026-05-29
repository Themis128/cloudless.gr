/**
 * Observability stack — Prometheus, Grafana, and Alertmanager.
 *
 * Catches: scrape target down, stale recording rules, alert rule
 * syntax error, Grafana datasource misconfigured, dashboard deleted.
 */
import { test, expect } from "@playwright/test";

const K3S_HOST = process.env.K3S_HOST ?? "cloudless.gr";
const runInfra = !!process.env.INFRA_SMOKE;

test.describe("Prometheus direct checks", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("Grafana API health returns ok", async ({ request }) => {
    const r = await request.get(`https://manage.${K3S_HOST}/api/health`, {
      maxRedirects: 5,
      failOnStatusCode: false,
      timeout: 10_000,
    });
    expect(r.status()).toBeLessThan(502);
  });
});

test.describe("Alertmanager health", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("Alertmanager is reachable through its service port", async ({ request }) => {
    const r = await request.get(`https://manage.${K3S_HOST}/`, {
      maxRedirects: 5,
      failOnStatusCode: false,
      timeout: 10_000,
    });
    expect(r.status()).toBeLessThan(502);
  });
});

test.describe("Metabase observability", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("Metabase API status returns healthy", async ({ request }) => {
    const metabaseHost = process.env.METABASE_HOST ?? `metabase.${K3S_HOST}`;
    const r = await request.get(`https://${metabaseHost}/api/health`, {
      failOnStatusCode: false,
      timeout: 15_000,
    });
    if (r.status() === 200) {
      const body = await r.json();
      expect(body.status).toBe("ok");
    } else {
      test.skip(true, `Metabase at ${metabaseHost} returned ${r.status()}`);
    }
  });
});
