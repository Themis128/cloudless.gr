import path from "path";
import { defineConfig, devices } from "@playwright/test";

const rootDir = import.meta.dirname ?? path.resolve();

/**
 * Production smoke-test config — runs customer-behavior suite against both
 * cloudless.gr and cloudless.online (Cloudflare tunnel).
 *
 * Usage:
 *   npx playwright test --config=playwright.production.config.mts
 *   npx playwright test --config=playwright.production.config.mts --project=cloudless-gr
 *   npx playwright test --config=playwright.production.config.mts --project=cloudless-online
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
  },

  // Enable infrastructure smoke tests (they skip unless this is set)
  // and pass admin credentials if available via environment
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
      name: "cloudless-online-desktop",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "https://cloudless.online",
      },
    },
    {
      name: "cloudless-online-mobile",
      use: {
        ...devices["Pixel 7"],
        baseURL: "https://cloudless.online",
      },
    },
  ],
});
