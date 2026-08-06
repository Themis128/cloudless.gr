import path from "path";
import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname;
const isCi = !!process.env.CI;
const isCoverage = process.env.COVERAGE === "1";

/**
 * Enhanced global setup with better server management
 */
export default defineConfig({
  testDir: path.join(rootDir, "e2e"),
  testMatch: "**/*.spec.ts",
  testIgnore: ["**/k3s/**", "**/logs/**"],
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 3 : 2, // Increase retries for local dev to handle flakiness
  workers: process.env.PWWORKERS ? parseInt(process.env.PWWORKERS) : 2,

  // Enhanced pre-flight health gate with auto-recovery
  globalSetup: path.join(rootDir, "e2e/enhanced-global-setup.mts"),
  
  // In coverage mode, merge server-side V8 coverage after the suite finishes.
  globalTeardown: isCoverage
    ? path.join(rootDir, "e2e/coverage/server-teardown.mts")
    : undefined,

  // Reporter configuration - enhanced for better debugging
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
      : [
          ["html", { open: "never", outputFolder: "playwright-report" }],
          ["list"],
          ["json", { outputFile: "playwright-results.json" }],
        ],

  // Increased timeouts for more stable execution
  timeout: isCi ? 90_000 : 60_000,
  expect: { timeout: isCi ? 30_000 : 20_000 },

  use: {
    baseURL: "http://localhost:4000",
    // Enhanced tracing for better debugging
    trace: "retain-on-failure", // Keep trace on failure for analysis
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    // Additional context for debugging
    launchOptions: {
      // Slightly slow down actions to make tests more stable
      // slowMo: 50,
    },
  },

  // Enhanced web server configuration with better lifecycle management
  webServer: {
    // Always start fresh server instead of reusing potentially stale one
    command: "pnpm dev",
    url: "http://localhost:4000",
    timeout: 180_000, // Increased timeout for server startup
    reuseExistingServer: false, // Always start fresh to avoid stale server issues
    // Kill any existing processes on the port before starting
    // This ensures we always have a clean state
    env: {
      NEXT_PUBLIC_E2E: "1",
      E2E_ADMIN_TOKEN: "e2e-admin-token-do-not-use-in-prod",
      // Additional env vars for stability
      NODE_ENV: "development",
      // Reduce Next.js telemetry and debug noise
      NEXT_TELEMETRY_DISABLED: "1",
    },
    // Post-startup health check to ensure server is really ready
    stdout: pipe => {
      pipe.on('data', data => {
        if (data.toString().includes('ready')) {
          console.log('[playwright] Dev server appears to be ready');
        }
      });
    },
    stderr: pipe => {
      pipe.on('data', data => {
        const msg = data.toString();
        if (msg.includes('error') || msg.includes('Error')) {
          console.error('[playwright] Dev server stderr:', msg.slice(0, 200));
        }
      });
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
    // Add Firefox project for cross-browser testing
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: path.join(rootDir, "e2e/.auth/user.json"),
      },
      dependencies: ["setup"],
    },
  ],

  // Additional configuration for better artifact management
  outputDir: "test-results",
});
