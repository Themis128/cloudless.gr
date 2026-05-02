/**
 * Static asset coverage — verifies the Next.js app's `_next/static/*`
 * chunks load cleanly through Lambda + Funnel. Image chunks are usually
 * the canary for Lambda response-size limits (6 MB hard cap for binary).
 */
import { test, expect } from "@playwright/test";

test.describe("k3s static assets", () => {
  test("homepage chunks all return 200", async ({ page }) => {
    const failures: { url: string; status: number; type: string }[] = [];
    page.on("response", (r) => {
      if (r.status() >= 400 && r.url().includes("/_next/static/")) {
        failures.push({ url: r.url(), status: r.status(), type: r.request().resourceType() });
      }
    });
    await page.goto("/en", { waitUntil: "networkidle" });
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  });

  test("favicon is reachable", async ({ request }) => {
    const r = await request.get("https://cloudless.online/favicon.ico", {
      failOnStatusCode: false,
    });
    expect([200, 301, 302, 304].includes(r.status())).toBe(true);
  });

  test("no fatal page errors on homepage load", async ({ page }) => {
    // Distinguish:
    //   - pageerror events (uncaught JS exceptions — always fatal)
    //   - console.error from 3rd-party scripts (expected noise; ignored)
    //   - console.error from app code (fatal)
    const fatal: string[] = [];
    page.on("pageerror", (e) => fatal.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const t = m.text();
      const url = m.location().url ?? "";
      // Treat anything emitted from a 3rd-party host as benign — extensions,
      // ad blockers, or geo-restricted Stripe/HubSpot/Sentry endpoints will
      // routinely produce console.error noise on first load.
      const thirdParty =
        /(stripe|hubspot|sentry|facebook|hsforms|hs-scripts|googletagmanager|google-analytics)/i;
      if (thirdParty.test(url) || thirdParty.test(t)) return;
      fatal.push(`console.error: ${t}`);
    });
    await page.goto("/en", { waitUntil: "networkidle" });
    expect(fatal, JSON.stringify(fatal, null, 2)).toEqual([]);
  });
});
