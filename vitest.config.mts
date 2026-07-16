import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // jose lives in the pnpm content-addressable store; the stub symlink at
    // node_modules/jose is missing its package.json, so Vite can't resolve it
    // via normal package resolution. Alias it to the real store location.
    alias: {
      // jose — point to the installed package's webapi dist (works for both v5 and v6)
      jose: path.resolve(
        __dirname,
        "node_modules/jose/dist/webapi/index.js",
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
      // @aws-sdk/client-ssm (and its transitive dep @aws-sdk/util-endpoints) crash
      // under JSDOM during module init. All SSM tests mock @/lib/ssm-config directly.
      "@aws-sdk/client-ssm": path.resolve(
        __dirname,
        "__tests__/stubs/aws-ssm-stub.js",
      ),
      // @aws-sdk/client-dynamodb crashes via @smithy/core subpath under JSDOM.
      // Tests mock stripe-transactions.ts directly; the stub satisfies imports.
      "@aws-sdk/client-dynamodb": path.resolve(
        __dirname,
        "__tests__/stubs/aws-dynamodb-stub.js",
      ),
      // @aws-sdk/client-bedrock-runtime shares the same @aws-sdk/util-endpoints
      // crash under JSDOM. Tests mock bedrock-chat.ts directly.
      "@aws-sdk/client-bedrock-runtime": path.resolve(
        __dirname,
        "__tests__/stubs/aws-bedrock-runtime-stub.js",
      ),
      // @aws-sdk/client-sesv2 shares the same crash. Tests mock email.ts directly.
      "@aws-sdk/client-sesv2": path.resolve(
        __dirname,
        "__tests__/stubs/aws-sesv2-stub.js",
      ),
      // @/* -> ./src/* path alias. Vite does NOT honor tsconfig `paths`
      // unless the (uninstalled) vite-tsconfig-paths plugin is present, which
      // is why every test failed with "Failed to resolve import @/...". Map it
      // explicitly. Placed LAST so it does not shadow the @aws-sdk/* stubs
      // above (those are matched first by prefix).
      "@": path.resolve(__dirname, "src"),
    },
  },
  define: {
    // Don't override NODE_ENV — setup.ts relies on it being "test"
  },
  test: {
    environment: "jsdom",
    pool: "forks",
    maxWorkers: 2,
    testTimeout: 15000,
    include: ["__tests__/**/*.test.{ts,tsx}"],
    reporters: ["default"],
    setupFiles: ["./__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage/vitest",
      clean: false,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/app/**/loading.tsx",
        "src/app/**/error.tsx",
        "src/app/**/not-found.tsx",
        "src/app/**/layout.tsx",
        "src/**/types.ts",
        "src/**/index.ts",
      ],
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
