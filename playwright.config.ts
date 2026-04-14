import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

const isCi = !!process.env.CI;

/**
 * Playwright E2E configuration for cloudless.gr
 *
 * Run with:
 *   npx playwright test              # all tests
 *   npx playwright test --ui         # interactive UI mode
 *   npx playwright test --headed     # see the browser
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 1 : undefined,
  reporter: isCi ? "github" : "html",
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:4000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],

  /* Start the dev server before tests run */
  webServer: {
    command: "NEXT_PUBLIC_E2E=1 pnpm dev",
    url: "http://localhost:4000",
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
});
