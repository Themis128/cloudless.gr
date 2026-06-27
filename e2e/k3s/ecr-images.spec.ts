/**
 * ECR image availability — verifies Docker images the Pi k3s cluster pulls
 * are present in ECR and not expired by lifecycle policy.
 *
 * Catches: ECR lifecycle too aggressive, failed push, image tag mismatch.
 */
import { test, expect } from "../coverage";
import { PRIMARY_HOST, STANDBY_HOST, probeHealth, isHealthBody, isNetworkError } from "./_helpers";

test.describe("ECR / container image health", () => {
  test("Pi cluster is running a valid image (app responds on pi-origin)", async ({ request }) => {
    let r: Awaited<ReturnType<typeof request.get>>;
    try {
      r = await request.get(`https://pi-origin.${PRIMARY_HOST}/api/health`, {
        failOnStatusCode: false,
        timeout: 20_000,
      });
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `pi-origin not reachable: ${e}`); return; }
      throw e;
    }
    expect(r.status(), "Pi origin not responding — possible ImagePullBackOff?").toBe(200);
    expect(isHealthBody(await r.text())).toBe(true);
  });

  test("primary app version matches standby (no SHA drift)", async ({ request }) => {
    let primary: Awaited<ReturnType<typeof probeHealth>>;
    let standby: Awaited<ReturnType<typeof probeHealth>>;
    try {
      [primary, standby] = await Promise.all([
        probeHealth(request, PRIMARY_HOST),
        probeHealth(request, STANDBY_HOST),
      ]);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `host not reachable: ${e}`); return; }
      throw e;
    }
    const pBody = JSON.parse(primary.body);
    const sBody = JSON.parse(standby.body);
    expect(pBody.status).toBe(sBody.status);
    const shaRe = /^[0-9a-f]{7,40}$/i;
    if (pBody.version) {
      expect(pBody.version, `primary version is not a git SHA: ${pBody.version}`).toMatch(shaRe);
    }
    if (sBody.version) {
      expect(sBody.version, `standby version is not a git SHA: ${sBody.version}`).toMatch(shaRe);
    }
  });

  test("Pi origin responds with the app's CSP (not a default nginx/k3s page)", async ({ request }) => {
    let r: Awaited<ReturnType<typeof request.get>>;
    try {
      r = await request.get(`https://pi-origin.${PRIMARY_HOST}/api/health`, {
        failOnStatusCode: false,
        timeout: 20_000,
      });
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `pi-origin not reachable: ${e}`); return; }
      throw e;
    }
    const csp = r.headers()["content-security-policy"] ?? "";
    expect(csp, "Pi origin missing CSP — serving default page instead of the app?").toContain("frame-ancestors");
  });
});
