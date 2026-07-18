import { defineConfig, devices } from "@playwright/test";
import monocartConfig from "./monocart.config.mts";

/**
 * Playwright configuration for cloudless.gr
 * Covers 100% of the application with comprehensive E2E tests
 * Includes multiple projects for cross-browser testing and coverage
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.COVERAGE === "1"
    ? [["list"], ["monocart-reporter", monocartConfig]]
    : process.env.CI
      ? [["list"], ["github"]]
      : [["list"], ["html"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
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
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 12"] },
    },
    {
      name: "chromium-user",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["chromium"],
    },
    {
      name: "chromium-admin",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["chromium"],
    },
  ],
  webServer: process.env.COVERAGE === "1"
    ? {
        command: "pnpm dev",
        url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4000",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      }
    : undefined,
  output: "test-results/",
});
