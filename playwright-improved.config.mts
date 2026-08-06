import path from "path";
import { defineConfig, devices } from "@playwright/test";

const rootDir = import.meta.dirname ?? path.resolve();
const isCi = !!process.env.CI;
const isCoverage = process.env.COVERAGE === "1";

export default defineConfig({
  testDir: path.join(rootDir, "e2e"),
  testMatch: "**/*.spec.ts",
  testIgnore: ["**/k3s/**"],
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 3 : 2, // Increase retries for local dev to handle flakiness
  workers: 2,

  // Use our enhanced global setup with retry logic
  globalSetup: path.join(rootDir, "e2e/enhanced-global-setup-v2.mts"),
  
  // In coverage mode, merge server-side V8 coverage after the suite finishes.
  globalTeardown: isCoverage
    ? path.join(rootDir, "e2e/coverage/server-teardown.mts")
    : undefined,

  reporter: isCoverage
    ? [
        ["list"],
        [
          "monocart-reporter",
          {
            name: "cloudless.gr E2E",
            outputFile: "./coverage/playwright/index.html",
            coverage: {
              entryFilter: {
                "**/src/**": true,
                "**/_next/static/chunks/main-app*": false,
                "**/_next/static/chunks/webpack*": false,
                "**/_next/static/chunks/framework*": false,
                "**/_next/static/chunks/polyfills*": false,
              },
              sourceFilter: {
                "**/src/**": true,
                "**/node_modules/**": false,
              },
              reports: ["v8", "html", "lcov", "console-summary"],
              outputDir: "./coverage/playwright",
            },
          },
        ],
      ]
    : isCi
      ? "github"
      : [["html", { open: "never" }], ["list"]],

  timeout: isCi ? 90_000 : 60_000,
  expect: { timeout: isCi ? 30_000 : 20_000 },

  use: {
    baseURL: "http://localhost:4000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:4000",
    timeout: 120_000,
    reuseExistingServer: !isCi,
    env: {
      NEXT_PUBLIC_E2E: "1",
      E2E_ADMIN_TOKEN: "e2e-admin-token-do-not-use-in-prod",
    },
  },

  projects: [
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(rootDir, "e2e/.auth/user.json"),
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        storageState: path.join(rootDir, "e2e/.auth/user.json"),
      },
      dependencies: ["setup"],
    },
  ],
});
