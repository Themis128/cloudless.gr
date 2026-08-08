import path from "path";
import { defineConfig, devices } from "@playwright/test";

const rootDir = import.meta.dirname ?? path.resolve();
const isCi = !!process.env.CI;
const isCoverage = process.env.COVERAGE === "1";

export default defineConfig({
  testDir: path.join(rootDir, "e2e"),
  testMatch: "**/*.spec.{ts,mts}",
  testIgnore: ["**/k3s/**"],
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 1,
  workers: 2,

  // Pre-flight health gate — fails fast if the dev server is stale/unhealthy
  // instead of producing ~130 confusing per-route failures.
  globalSetup: path.join(rootDir, "e2e/global-setup.mts"),
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

  timeout: 45_000,
  expect: { timeout: 15_000 },

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
      testMatch: "**/auth.setup.mts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Reuse the storage state produced by the setup project so
        // authenticated tests (dashboard, admin) have cookies ready.
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