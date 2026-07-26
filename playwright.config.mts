import path from "path";
import { defineConfig, devices } from "@playwright/test";

const rootDir = import.meta.dirname ?? path.resolve();
const isCi = !!process.env.CI;

/**
 * Playwright configuration for cloudless.gr
 * Covers 100% of the application with comprehensive E2E tests
 * Includes multiple projects for cross-browser testing and coverage
 */
export default defineConfig({
  testDir: path.join(rootDir, "e2e"),
  // k3s specs target the live Pi cluster and have their own config
  // (playwright.k3s.config.mts) — never run them against localhost.
  testIgnore: ["**/k3s/**"],
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 1,
  workers: isCi ? 1 : 6,
  reporter: isCi ? "github" : "html",
  timeout: 30_000,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    // Writes e2e/.auth/{user,admin}.json before any spec runs. Without
    // E2E_USER_* / E2E_ADMIN_* credentials it writes empty storage states so
    // the authenticated suites in the deep specs skip via their hasRealAuth()
    // guards instead of failing with ENOENT on a fresh checkout.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
    },
  ],

  /* Start the dev server before tests run */
  webServer: {
    command: "pnpm dev",
    cwd: rootDir,
    url: "http://localhost:4000",
    reuseExistingServer: !isCi,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_E2E: "1",
      E2E_ADMIN_TOKEN: "e2e-admin-token-do-not-use-in-prod",
    },
  },
});
