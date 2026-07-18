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
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10000,
    navigationTimeout: 30000,
    // MCP Server settings
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

    // Docker MCP Remote execution (if available)
    ...(process.env.PLAYWRIGHT_MCP_SERVER
      ? [
          {
            name: "docker-mcp-chromium",
            use: {
              ...devices["Desktop Chrome"],
              connectOptions: {
                wsEndpoint: process.env.PLAYWRIGHT_MCP_SERVER,
              },
            },
          },
        ]
      : []),
  ],
  outputDir: "test-results/",
  webServer: process.env.COVERAGE === "1"
    ? {
        command: "pnpm dev",
        url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:4000",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      }
    : undefined,
});