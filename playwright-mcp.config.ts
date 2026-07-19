import { defineConfig, devices } from "@playwright/test";
import monocartConfig from "./monocart.config.mts";

/**
 * Enhanced Playwright Configuration with Docker MCP Integration
 * cloudless.gr - Supports remote Playwright MCP server for distributed testing
 * 
 * Features:
 * - Docker Playwright MCP server integration
 * - Remote browser execution
 * - Distributed test execution
 * - Enhanced reporting with coverage
 * - Multi-project cross-browser testing
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
    // Default to production URL for testing, fallback to localhost:4000 for local dev
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "https://cloudless.gr",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10000,
    navigationTimeout: 30000,
    // MCP Server settings - for connecting to remote browser (optional)
    connectOptions: process.env.PLAYWRIGHT_MCP_SERVER
      ? {
          wsEndpoint: process.env.PLAYWRIGHT_MCP_SERVER,
          timeout: 30000,
        }
      : undefined,
  },
  projects: [
    // Local browser testing
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
    
    // Mobile testing
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 12"] },
    },
    
    // User & Admin flows (dependent projects)
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

    // Remote browser via MCP server (when PLAYWRIGHT_MCP_SERVER is set)
    ...(process.env.PLAYWRIGHT_MCP_SERVER
      ? [
          {
            name: "remote-mcp-chromium",
            use: {
              ...devices["Desktop Chrome"],
              connectOptions: {
                wsEndpoint: process.env.PLAYWRIGHT_MCP_SERVER,
                timeout: 30000,
              },
            },
          },
        ]
      : []),
  ],
  outputDir: "test-results/",
  /* webServer disabled for MCP-based testing against production */
  webServer: undefined,
});
