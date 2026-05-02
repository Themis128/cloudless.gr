import path from "path";
import { defineConfig, devices } from "@playwright/test";

const rootDir = import.meta.dirname ?? path.resolve();
const isCi = !!process.env.CI;

/**
 * Playwright E2E configuration — targets the Pi k3s standby ("HA app").
 *
 * Hits https://cloudless.online (the standby's vanity hostname, always
 * resolved to APIGW SECONDARY → Lambda cloudless-pi-proxy → Tailscale
 * Funnel → Pi Traefik :18443 → k3s cloudless-app pod). This exercises
 * the entire failover-path serving stack on every run.
 *
 * Run with:
 *   pnpm test:k3s                 # local
 *   CI=1 pnpm test:k3s            # CI mode (retries, github reporter)
 *   K3S_BASE_URL=https://example.com pnpm test:k3s   # override
 *
 * Differences from playwright.config.mts:
 *   - No webServer (target is remote)
 *   - Higher per-test timeout: 60s (cross-WAN + AWS Lambda cold start
 *     + Funnel hop + Pi rolling update windows can briefly elevate p95)
 *   - Single chromium project (mobile coverage is on the local suite)
 *   - testMatch limited to e2e/k3s/**.spec.ts
 */
export default defineConfig({
  testDir: path.join(rootDir, "e2e/k3s"),
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 1,
  workers: isCi ? 4 : undefined,
  reporter: isCi ? "github" : [["html", { open: "never" }], ["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.K3S_BASE_URL ?? "https://cloudless.online",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // The standby path crosses the public internet + APIGW + Funnel; allow
    // a generous nav budget so transient hop latency doesn't flake tests.
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
    extraHTTPHeaders: {
      // Identify these tests in any access log (Pi Traefik, APIGW, Lambda).
      "User-Agent":
        "cloudless-k3s-e2e/1.0 (+https://github.com/Themis128/cloudless.gr)",
    },
    ignoreHTTPSErrors: false,
  },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
