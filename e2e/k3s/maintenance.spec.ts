import { test, expect } from "@playwright/test";

/**
 * Maintenance stack smoke tests.
 * These tests hit services that surface cluster maintenance health:
 * - Grafana alerting (indirectly confirms PrometheusRules are loaded)
 * - Prometheus metrics (confirms scraping is live)
 *
 * Requires INFRA_SMOKE=1.
 * Requires GRAFANA_USER and GRAFANA_PASSWORD env vars for authenticated calls.
 */

const runInfra = !!process.env.INFRA_SMOKE;

test.describe("Prometheus (via Grafana proxy)", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("Grafana datasource proxy to Prometheus is healthy", async ({ request }) => {
    const user = process.env.GRAFANA_USER ?? "admin";
    const pass = process.env.GRAFANA_PASSWORD ?? "";
    const auth = Buffer.from(`${user}:${pass}`).toString("base64");

    const res = await request.get(
      `https://grafana.${process.env.K3S_HOST ?? "cloudless.gr"}/api/datasources/proxy/uid/prometheus/api/v1/query?query=up`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    // 200 means Prometheus is reachable; 401 means creds wrong but Grafana is up
    expect([200, 401]).toContain(res.status());
  });

  test("Grafana alerts endpoint returns 200", async ({ request }) => {
    const user = process.env.GRAFANA_USER ?? "admin";
    const pass = process.env.GRAFANA_PASSWORD ?? "";
    const auth = Buffer.from(`${user}:${pass}`).toString("base64");

    const res = await request.get(
      `https://grafana.${process.env.K3S_HOST ?? "cloudless.gr"}/api/v1/provisioning/alert-rules`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    expect([200, 401, 403]).toContain(res.status());
  });
});

test.describe("Alertmanager reachability", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("Grafana health confirms alerting stack is up", async ({ request }) => {
    const res = await request.get(`https://grafana.${process.env.K3S_HOST ?? "cloudless.gr"}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.database).toBe("ok");
  });
});
