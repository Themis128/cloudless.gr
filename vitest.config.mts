import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // jose lives in the pnpm content-addressable store; the stub symlink at
    // node_modules/jose is missing its package.json, so Vite can't resolve it
    // via normal package resolution. Alias it to the real store location.
    alias: {
      // jose — pnpm stub is missing package.json; point directly to the store
      jose: path.resolve(
        __dirname,
        "node_modules/.pnpm/jose@5.2.3/node_modules/jose/dist/node/cjs/index.js",
      ),
      // next-intl/middleware (v4) imports next/server via ESM bare specifier,
      // which Vitest/JSDOM cannot resolve. Tests only need the proxy `config`
      // export, so we provide a no-op factory stub here.
      "next-intl/middleware": path.resolve(
        __dirname,
        "__tests__/stubs/next-intl-middleware-stub.js",
      ),
      // @aws-sdk/client-cognito-identity-provider is not installed; tests that
      // need it supply their own vi.mock() — the stub prevents Vite's import
      // analysis from failing when the route file is dynamically imported.
      "@aws-sdk/client-cognito-identity-provider": path.resolve(
        __dirname,
        "__tests__/stubs/aws-cognito-stub.js",
      ),
      // next-intl/middleware (v4) imports next/server via ESM bare specifier,
      // which Vitest/JSDOM cannot resolve. Tests only need the proxy `config`
      // export, so we provide a no-op factory stub here.
      "next-intl/middleware": path.resolve(
        __dirname,
        "__tests__/stubs/next-intl-middleware-stub.js",
      ),
    },
  },
  define: {
    // Don't override NODE_ENV — setup.ts relies on it being "test"
  },
  test: {
    environment: "jsdom",
    pool: "threads",
    maxWorkers: 2,
    include: ["__tests__/**/*.test.{ts,tsx}"],
    reporters: ["default"],
    setupFiles: ["./__tests__/setup.ts"],
  },
});
