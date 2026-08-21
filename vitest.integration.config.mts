import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Vitest config for integration tests that need the REAL AWS SDK (not the
 * JSDOM-safe stubs aliased in vitest.config.mts). Used by the LocalStack
 * workflow only — local devs run the default config.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    pool: "threads",
    minWorkers: 1,
    maxWorkers: 1, // single worker — DynamoDB writes are stateful across tests
    testTimeout: 20000,
    include: ["__tests__/**/*-integration.test.ts"],
    reporters: ["default"],
  },
});
