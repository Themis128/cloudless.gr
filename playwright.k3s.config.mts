import path from "path";
import { defineConfig, devices } from "@playwright/test";

const rootDir = import.meta.dirname ?? path.resolve();
const isCi = !!process.env.CI;

/**
 * Playwright E2E configuration — targets the Pi k3s standby ("HA app").
 *
 * Hits https://pi-origin.cloudless.gr (the Pi k3s ingress hostname, direct
 * path through Traefik → k3s cloudless-app pod). This exercises the Pi
 * serving stack on every run.
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
  reporter: process.env.COVERAGE === "1"
    ? [
        ["list"],
        ["monocart-reporter", {
          name: "cloudless.gr k3s coverage",
          outputFile: "./coverage/k3s/index.html",
          coverage: {
            entryFilter: { "**/src/**": true, "**/_next/static/chunks/main-app*": false, "**/_next/static/chunks/webpack*": false, "**/_next/static/chunks/framework*": false, "**/_next/static/chunks/polyfills*": false },
            sourceFilter: { "**/src/**": true, "**/node_modules/**": false },
            reports: ["v8", "html", "lcov", "console-summary"],
            outputDir: "./coverage/k3s",
          },
        }],
      ]
    : isCi ? "github" : [["html", { open: "never" }], ["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.K3S_BASE_URL ?? "https://pi-origin.cloudless.gr",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Pi path can have latency; allow a generous nav budget.
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
