import path from "path";
import { defineConfig, devices } from "@playwright/test";

const rootDir = import.meta.dirname ?? path.resolve();

/**
 * Production smoke-test config — runs customer-behavior suite against both
 * cloudless.gr (Lambda/cloud) and pi-origin.cloudless.gr (Pi k3s).
 *
 * Usage:
 *   npx playwright test --config=playwright.production.config.mts
 *   npx playwright test --config=playwright.production.config.mts --project=cloudless-gr
 *   npx playwright test --config=playwright.production.config.mts --project=pi-origin
 *
 * Tests tagged @mutating are skipped (they POST real data to production).
 */
export default defineConfig({
  testDir: path.join(rootDir, "e2e"),

  // Skip tests that POST real data or require local dev setup
  grep: /^(?!.*@mutating)/,

  fullyParallel: true,
  forbidOnly: false,
  retries: 2,
  workers: 4,
  reporter: "html",

  // Longer timeouts — production has network latency
  timeout: 60_000,

  // No webServer — we test the live site directly
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Cloud CI runners (sandboxed Chrome) don't trust the root CA for cloudless.gr.
    // Real TLS issues are caught by pi-tls-cert-check.yml (openssl) — this just
    // prevents 189 spurious ERR_CERT_AUTHORITY_INVALID failures in cloud sessions.
    ignoreHTTPSErrors: true,
  },

  env: {
    INFRA_SMOKE: "1",
  },

  projects: [
    {
      name: "cloudless-gr-desktop",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "https://cloudless.gr",
      },
    },
    {
      name: "cloudless-gr-mobile",
      use: {
        ...devices["Pixel 7"],
        baseURL: "https://cloudless.gr",
      },
    },
    {
      name: "pi-origin-desktop",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "https://pi-origin.cloudless.gr",
      },
    },
    {
      name: "pi-origin-mobile",
      use: {
        ...devices["Pixel 7"],
        baseURL: "https://pi-origin.cloudless.gr",
      },
    },
  ],
});
