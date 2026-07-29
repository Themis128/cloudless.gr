import path from "path";
import { defineConfig, devices } from "@playwright/test";

const rootDir = import.meta.dirname ?? path.resolve();
const isCi = !!process.env.CI;

export default defineConfig({
  testDir: path.join(rootDir, "e2e"),
  testMatch: "**/*.spec.ts",
  testIgnore: ["**/k3s/**"],
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 1,
  workers: 2,
  reporter: isCi ? "github" : [["html", { open: "never" }], ["list"]],
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
    command: "pnpm dev --port 4000",
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
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
    },
  ],
});
